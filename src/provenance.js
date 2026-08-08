'use strict';

const RULE_SOURCES = Object.freeze([
  Object.freeze({ id: 'http-semantics', match: /^(status|redirect)$/, url: 'https://www.rfc-editor.org/rfc/rfc9110' }),
  Object.freeze({ id: 'robots-exclusion', match: /^robots\./, url: 'https://www.rfc-editor.org/rfc/rfc9309' }),
  Object.freeze({ id: 'html-elements', match: /^(canonical|metadata:|link:)/, url: 'https://html.spec.whatwg.org/multipage/' }),
  Object.freeze({ id: 'sitemaps-protocol', match: /^sitemap$/, url: 'https://www.sitemaps.org/protocol.html' })
]);

function sourceForCheck(check) {
  return RULE_SOURCES.find((source) => source.match.test(check)) || null;
}

module.exports = { RULE_SOURCES, sourceForCheck };
