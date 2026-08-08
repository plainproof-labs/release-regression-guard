'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildReport, toMarkdown, toSarif } = require('../src/report');

const RESULTS = [
  { path: '/ok', check: 'status', status: 'pass', message: 'Final status 200' },
  { path: '/bad', check: 'canonical', status: 'fail', message: 'Canonical missing' },
  { path: '/maybe', check: 'metadata:title', status: 'unknown', message: 'Ambiguous JavaScript' },
  { path: '/known', check: 'sitemap', status: 'exception', message: 'Accepted temporarily' }
];

test('JSON summary has a stable shape and fail dominates unknown', () => {
  const report = buildReport(RESULTS, new Date('2026-08-08T00:00:00Z'));
  assert.deepEqual(report.summary, { conclusion: 'fail', total: 4, pass: 1, fail: 1, unknown: 1, exception: 1 });
  assert.equal(report.generatedAt, '2026-08-08T00:00:00.000Z');
  assert.equal(report.provenance.schemaVersion, 1);
  assert.equal(Object.hasOwn(report, 'targetBase'), false);
  assert.deepEqual(report.results.map((item) => item.source), ['http-semantics', 'html-elements', 'html-elements', 'sitemaps-protocol']);
});

test('Markdown contains the complete result table and ambiguity note', () => {
  const markdown = toMarkdown(buildReport(RESULTS, new Date('2026-08-08T00:00:00Z')));
  assert.match(markdown, /Conclusion: \*\*FAIL\*\*/);
  assert.match(markdown, /\| \/maybe \| metadata:title \| UNKNOWN \|/);
  assert.match(markdown, /not a pass or fail/);
});

test('SARIF includes actionable non-pass results with correct levels', () => {
  const sarif = toSarif(buildReport(RESULTS, new Date('2026-08-08T00:00:00Z')));
  assert.equal(sarif.version, '2.1.0');
  assert.deepEqual(sarif.runs[0].results.map((item) => item.level), ['error', 'warning', 'note']);
  assert.equal(sarif.runs[0].results.some((item) => item.message.text.includes('/ok')), false);
});
