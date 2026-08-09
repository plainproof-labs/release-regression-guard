'use strict';

const UNKNOWN_STATUSES = new Set([401, 403, 407, 408, 425, 429, 500, 502, 503, 504]);
const BOT_MARKERS = [
  /cf-chl-/i,
  /cloudflare.*challenge/i,
  /attention required[^<]*cloudflare/i,
  /verify (?:that )?you are human/i,
  /captcha/i,
  /access denied.*bot/i
];

function normalizeBase(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('target-base must be a valid HTTP(S) origin'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('target-base must be an HTTP(S) origin without credentials');
  }
  if (url.pathname !== '/' || url.search || url.hash) throw new Error('target-base must be an origin without a path, query, or fragment');
  return url;
}

async function fetchPage(base, requestedPath, options = {}) {
  const timeoutMs = options.timeoutMs || 10000;
  const fetchImpl = options.fetchImpl || fetch;
  const origin = base.origin;
  let current = new URL(requestedPath, origin);
  const chain = [];
  for (let hop = 0; hop <= 10; hop += 1) {
    let response;
    try {
      response = await fetchImpl(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'user-agent': 'release-regression-guard/1.0' }
      });
    } catch {
      return { kind: 'unknown', reason: 'transport-or-timeout', chain, finalPath: pathOf(current) };
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return { kind: 'response', status: response.status, body: '', headers: response.headers, chain, finalPath: pathOf(current), redirectError: 'redirect-without-location' };
      }
      let next;
      try {
        next = new URL(location, current);
      } catch {
        return { kind: 'response', status: response.status, body: '', headers: response.headers, chain, finalPath: pathOf(current), redirectError: 'invalid-redirect-location' };
      }
      chain.push({ status: response.status, from: pathOf(current), to: next.origin === origin ? pathOf(next) : '[cross-origin]' });
      if (next.origin !== origin) {
        return { kind: 'response', status: response.status, body: '', headers: response.headers, chain, finalPath: '[cross-origin]', redirectError: 'cross-origin-redirect-not-followed' };
      }
      current = next;
      continue;
    }
    let body = '';
    try { body = await response.text(); } catch {
      return { kind: 'unknown', reason: 'unreadable-response', chain, finalPath: pathOf(current) };
    }
    if (UNKNOWN_STATUSES.has(response.status) || response.status >= 500) {
      return { kind: 'unknown', reason: classifyStatus(response.status), status: response.status, chain, finalPath: pathOf(current) };
    }
    if (BOT_MARKERS.some((marker) => marker.test(body))) {
      return { kind: 'unknown', reason: 'possible-bot-challenge', status: response.status, chain, finalPath: pathOf(current) };
    }
    return { kind: 'response', status: response.status, body, headers: response.headers, chain, finalPath: pathOf(current) };
  }
  return { kind: 'response', status: null, body: '', headers: new Headers(), chain, finalPath: pathOf(current), redirectError: 'too-many-redirects' };
}

function classifyStatus(status) {
  if ([401, 407].includes(status)) return 'authentication-required';
  if ([403, 429].includes(status)) return 'blocked-or-rate-limited';
  return 'temporary-http-failure';
}

function pathOf(url) {
  return `${url.pathname}${url.search}`;
}

module.exports = { fetchPage, normalizeBase, pathOf };
