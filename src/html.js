'use strict';

function attributes(tag) {
  const values = {};
  const expression = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match;
  while ((match = expression.exec(tag))) values[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return values;
}

function parseHtml(html, documentUrl) {
  const withoutComments = html.replace(/<!--[\s\S]*?(?:-->|$)/g, '');
  const documentMarkup = withoutComments
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*$/gi, '');
  const targetOrigin = new URL(documentUrl).origin;
  const titleMatch = documentMarkup.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  const metadata = new Map();
  const metaRobots = [];
  for (const match of documentMarkup.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (attrs.name) {
      const key = `name:${attrs.name.toLowerCase()}`;
      rememberPresentValue(metadata, key, attrs.content || '');
      if (['name:robots', 'name:googlebot'].includes(key)) metaRobots.push(...directives(attrs.content || ''));
    }
    if (attrs.property) rememberPresentValue(metadata, `property:${attrs.property.toLowerCase()}`, attrs.content || '');
  }
  const baseMatch = documentMarkup.match(/<base\b[^>]*>/i);
  const baseAttributes = baseMatch ? attributes(baseMatch[0]) : {};
  const resolutionBase = resolveBase(baseAttributes.href, documentUrl);
  const canonicals = [];
  const links = new Set();
  for (const match of documentMarkup.matchAll(/<(?:link|a)\b[^>]*>/gi)) {
    const tag = match[0];
    const attrs = attributes(tag);
    if (/^<link/i.test(tag) && (attrs.rel || '').toLowerCase().split(/\s+/).includes('canonical') && attrs.href) {
      canonicals.push(normalizeHref(decodeText(attrs.href), resolutionBase, targetOrigin));
    }
    if (/^<a/i.test(tag) && attrs.href) {
      const normalized = normalizeInternalHref(decodeText(attrs.href), resolutionBase, targetOrigin);
      if (normalized) links.add(normalized);
    }
  }
  return {
    title: decodeText(titleMatch ? titleMatch[1] : '').trim(),
    metadata,
    canonicals,
    links,
    metaRobots,
    javascriptAmbiguous: isJavascriptShell(withoutComments)
  };
}

function rememberPresentValue(metadata, key, value) {
  if (!metadata.has(key) || (metadata.get(key) || '').trim() === '') metadata.set(key, value);
}

function directives(value) {
  return String(value).toLowerCase().split(/[\s,]+/).filter(Boolean);
}

function resolveBase(href, documentUrl) {
  if (!href) return documentUrl;
  try {
    const resolved = new URL(decodeText(href), documentUrl);
    return ['http:', 'https:'].includes(resolved.protocol) ? resolved.href : documentUrl;
  } catch { return documentUrl; }
}

function normalizeInternalHref(href, resolutionBase, targetOrigin) {
  try {
    const url = new URL(href, resolutionBase);
    return url.origin === targetOrigin && ['http:', 'https:'].includes(url.protocol) ? `${url.pathname}${url.search}` : null;
  } catch { return null; }
}

function normalizeHref(href, resolutionBase, targetOrigin) {
  try {
    const url = new URL(href, resolutionBase);
    return url.origin === targetOrigin ? `${url.pathname}${url.search}` : `[cross-origin]${url.pathname}${url.search}`;
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

module.exports = { attributes, directives, parseHtml };
