'use strict';

const { fetchPage, normalizeBase } = require('./fetch');
const { directives, parseHtml } = require('./html');

async function checkManifest(manifest, options) {
  const base = normalizeBase(options.targetBase);
  const requestOptions = { timeoutMs: options.timeoutMs, fetchImpl: options.fetchImpl };
  const [robotsResource, sitemapResource] = await Promise.all([
    fetchPage(base, '/robots.txt', requestOptions),
    fetchPage(base, manifest.sitemapPath, requestOptions)
  ]);
  const sitemap = parseSitemap(sitemapResource, base.origin);
  const results = [];
  for (const entry of manifest.criticalUrls) {
    const page = await fetchPage(base, entry.path, requestOptions);
    const checks = checkEntry(entry, page, robotsResource, sitemap, base.origin);
    for (const check of checks) results.push(applyException(check, entry.exceptions, options.now));
  }
  return results;
}

function checkEntry(entry, page, robotsResource, sitemap, baseOrigin) {
  const checkIds = [
    'status', 'redirect', 'robots.noindex', 'robots.disallow', 'canonical',
    ...entry.metadata.required.map((item) => `metadata:${item}`),
    'sitemap', ...entry.requiredInternalLinks.map((link) => `link:${link}`)
  ];
  if (page.kind === 'unknown') {
    const pageUnknown = new Set(['status', 'redirect', 'robots.noindex', 'canonical', ...entry.metadata.required.map((item) => `metadata:${item}`), ...entry.requiredInternalLinks.map((link) => `link:${link}`)]);
    return checkIds.map((check) => {
      if (pageUnknown.has(check)) return result(entry.path, check, 'unknown', `Not verifiable: ${page.reason}`);
      if (check === 'robots.disallow') return checkRobotsTxt(entry.path, robotsResource);
      return checkSitemap(entry.path, sitemap);
    });
  }

  const parsed = parseHtml(page.body, new URL(page.finalPath, baseOrigin).href);
  const xRobots = directives(page.headers.get('x-robots-tag') || '');
  const jsUnknown = (check, failedMessage) => parsed.javascriptAmbiguous
    ? result(entry.path, check, 'unknown', 'HTML is an ambiguous JavaScript shell')
    : result(entry.path, check, 'fail', failedMessage);
  const checks = [];
  if (page.redirectError) {
    checks.push(result(entry.path, 'status', 'fail', `Redirect could not be completed: ${page.redirectError}`));
    checks.push(result(entry.path, 'redirect', 'fail', `Redirect could not be completed: ${page.redirectError}`));
  } else {
    checks.push(entry.status.allowed.includes(page.status)
      ? result(entry.path, 'status', 'pass', `Final status ${page.status}`)
      : result(entry.path, 'status', 'fail', `Expected ${entry.status.allowed.join(' or ')}, received ${page.status}`));
    const redirectMatches = page.chain.length === entry.redirect.expectedHops && page.finalPath === entry.redirect.finalPath;
    checks.push(redirectMatches
      ? result(entry.path, 'redirect', 'pass', `${page.chain.length} hop(s), final path ${page.finalPath}`)
      : result(entry.path, 'redirect', 'fail', `Expected ${entry.redirect.expectedHops} hop(s) to ${entry.redirect.finalPath}; observed ${page.chain.length} to ${page.finalPath}`));
  }

  const robotsDirectives = [...parsed.metaRobots, ...xRobots];
  const noindex = robotsDirectives.includes('noindex') || robotsDirectives.includes('none');
  if (noindex) {
    checks.push(result(entry.path, 'robots.noindex', 'fail', 'noindex directive present'));
  } else if (parsed.javascriptAmbiguous) {
    checks.push(result(entry.path, 'robots.noindex', 'unknown', 'HTML is an ambiguous JavaScript shell'));
  } else {
    checks.push(result(entry.path, 'robots.noindex', 'pass', 'No noindex directive found'));
  }
  checks.push(checkRobotsTxt(entry.path, robotsResource));

  const expectedCanonical = entry.canonical.path;
  if (parsed.canonicals.length === 1 && parsed.canonicals[0] === expectedCanonical) {
    checks.push(result(entry.path, 'canonical', 'pass', `Canonical is ${expectedCanonical}`));
  } else {
    const observed = parsed.canonicals.length ? parsed.canonicals.join(', ') : 'missing';
    checks.push(jsUnknown('canonical', `Expected one canonical ${expectedCanonical}; observed ${observed}`));
  }

  for (const selector of entry.metadata.required) {
    const present = selector === 'title' ? parsed.title !== '' : (parsed.metadata.get(selector.toLowerCase()) || '').trim() !== '';
    checks.push(present
      ? result(entry.path, `metadata:${selector}`, 'pass', `${selector} is present`)
      : jsUnknown(`metadata:${selector}`, `${selector} is missing or blank`));
  }
  checks.push(checkSitemap(entry.path, sitemap));
  for (const link of entry.requiredInternalLinks) {
    checks.push(parsed.links.has(link)
      ? result(entry.path, `link:${link}`, 'pass', `Internal link ${link} is present`)
      : jsUnknown(`link:${link}`, `Required internal link ${link} is missing`));
  }
  return checks;
}

function checkRobotsTxt(path, resource) {
  if (resource.kind === 'unknown') return result(path, 'robots.disallow', 'unknown', `robots.txt not verifiable: ${resource.reason}`);
  if (resource.status === 404) return result(path, 'robots.disallow', 'pass', 'robots.txt is absent (no disallow rule)');
  if (resource.status !== 200) return result(path, 'robots.disallow', 'unknown', `robots.txt returned ${resource.status}`);
  const disallowed = robotsDisallows(resource.body, path);
  return disallowed
    ? result(path, 'robots.disallow', 'fail', `robots.txt disallows ${path}`)
    : result(path, 'robots.disallow', 'pass', `robots.txt allows ${path}`);
}

function robotsDisallows(body, path) {
  const groups = [];
  let group = null;
  for (const original of body.split(/\r?\n/)) {
    const line = original.replace(/#.*$/, '').trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === 'user-agent') {
      if (!group || group.rules.length > 0) {
        group = { agents: [], rules: [] };
        groups.push(group);
      }
      group.agents.push(value.toLowerCase());
      continue;
    }
    if (group && ['allow', 'disallow'].includes(field) && value) group.rules.push({ type: field, pattern: value });
  }
  let best = null;
  for (const candidate of groups.filter((item) => item.agents.includes('*')).flatMap((item) => item.rules)) {
    if (!path.startsWith(candidate.pattern)) continue;
    const length = Buffer.byteLength(candidate.pattern, 'utf8');
    if (!best || length > best.length || (length === best.length && candidate.type === 'allow')) {
      best = { type: candidate.type, length };
    }
  }
  return best ? best.type === 'disallow' : false;
}

function parseSitemap(resource, baseOrigin) {
  if (resource.kind === 'unknown') return { kind: 'unknown', reason: resource.reason };
  if (resource.status !== 200) return { kind: 'failure', reason: `sitemap returned ${resource.status}` };
  const paths = new Set();
  const xml = resource.body.replace(/<!--[\s\S]*?(?:-->|$)/g, '');
  for (const urlEntry of xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url\s*>/gi)) {
    const match = urlEntry[1].match(/<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/i);
    if (!match) continue;
    const raw = decodeXml(match[1].trim());
    try {
      const url = new URL(raw);
      if (['http:', 'https:'].includes(url.protocol) && url.origin === baseOrigin) paths.add(`${url.pathname}${url.search}`);
    } catch { /* Invalid entries do not establish membership. */ }
  }
  return { kind: 'parsed', paths };
}

function checkSitemap(path, sitemap) {
  if (sitemap.kind === 'unknown') return result(path, 'sitemap', 'unknown', `Sitemap not verifiable: ${sitemap.reason}`);
  if (sitemap.kind === 'failure') return result(path, 'sitemap', 'fail', sitemap.reason);
  return sitemap.paths.has(path)
    ? result(path, 'sitemap', 'pass', `${path} is present in the sitemap`)
    : result(path, 'sitemap', 'fail', `${path} is missing from the sitemap`);
}

function applyException(check, exceptions = [], now = new Date()) {
  if (check.status !== 'fail') return check;
  const exception = exceptions.find((item) => item.check === check.check);
  if (!exception) return check;
  const endOfDay = new Date(`${exception.expiresAt}T23:59:59.999Z`);
  if (endOfDay < now) return { ...check, message: `${check.message}; exception expired ${exception.expiresAt}` };
  return { ...check, status: 'exception', message: `${check.message}; accepted until ${exception.expiresAt}: ${exception.reason}`, exception: { source: exception.source, expiresAt: exception.expiresAt } };
}

function result(path, check, status, message) {
  return { path, check, status, message };
}

function decodeXml(value) {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

module.exports = { applyException, checkEntry, checkManifest, parseSitemap, robotsDisallows };
