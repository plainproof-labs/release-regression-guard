'use strict';

function attributes(tag) {
  const values = {};
  const expression = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match;
  while ((match = expression.exec(tag))) values[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return values;
}

function parseHtml(html, baseOrigin) {
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  const metadata = new Map();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (attrs.name) metadata.set(`name:${attrs.name.toLowerCase()}`, attrs.content || '');
    if (attrs.property) metadata.set(`property:${attrs.property.toLowerCase()}`, attrs.content || '');
  }
  const canonicals = [];
  const links = new Set();
  for (const match of html.matchAll(/<(?:link|a)\b[^>]*>/gi)) {
    const tag = match[0];
    const attrs = attributes(tag);
    if (/^<link/i.test(tag) && (attrs.rel || '').toLowerCase().split(/\s+/).includes('canonical') && attrs.href) {
      canonicals.push(normalizeHref(attrs.href, baseOrigin));
    }
    if (/^<a/i.test(tag) && attrs.href) {
      const normalized = normalizeInternalHref(attrs.href, baseOrigin);
      if (normalized) links.add(normalized);
    }
  }
  return {
    title: decodeText(titleMatch ? titleMatch[1] : '').trim(),
    metadata,
    canonicals,
    links,
    metaRobots: collectMetaRobots(metadata),
    javascriptAmbiguous: isJavascriptShell(html)
  };
}

function collectMetaRobots(metadata) {
  return ['name:robots', 'name:googlebot']
    .flatMap((key) => (metadata.get(key) || '').toLowerCase().split(/[\s,]+/))
    .filter(Boolean);
}

function normalizeInternalHref(href, baseOrigin) {
  try {
    const url = new URL(href, baseOrigin);
    return url.origin === baseOrigin && ['http:', 'https:'].includes(url.protocol) ? `${url.pathname}${url.search}` : null;
  } catch { return null; }
}

function normalizeHref(href, baseOrigin) {
  try {
    const url = new URL(href, baseOrigin);
    return url.origin === baseOrigin ? `${url.pathname}${url.search}` : `[cross-origin]${url.pathname}${url.search}`;
  } catch { return '[invalid]'; }
}

function isJavascriptShell(html) {
  if (!/<script\b/i.test(html)) return false;
  if (/<noscript\b[^>]*>[\s\S]*?(enable|requires?) javascript/i.test(html)) return true;
  if (/<(?:div|main)\b[^>]*(?:id|class)=["'][^"']*(?:root|app|__next)[^"']*["'][^>]*>\s*<\/(?:div|main)>/i.test(html)) return true;
  const withoutCode = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<[^>]+>/g, '').replace(/\s+/g, '');
  return withoutCode.length < 20 && /<script\b[^>]+src=/i.test(html);
}

function decodeText(value) {
  return value.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#39;/g, "'").replace(/&quot;/gi, '"');
}

module.exports = { attributes, parseHtml };
