'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { checkManifest, parseSitemap, robotsDisallows } = require('../src/checker');
const { loadManifest } = require('../src/manifest');
const { startFixtureServer } = require('./helpers/fixture-server');

const ROOT = path.resolve(__dirname, '..');
const NOW = new Date('2026-08-08T00:00:00Z');
let site;

test.before(async () => { site = await startFixtureServer(); });
test.after(async () => { await site.close(); });

test('positive fixture passes status, redirect, robots, canonical, metadata, sitemap, and links', async () => {
  const results = await runFixture('positive');
  assert.ok(results.length > 0);
  assert.deepEqual([...new Set(results.map((item) => item.status))], ['pass']);
  assert.ok(results.some((item) => item.path === '/moved' && item.check === 'redirect' && item.status === 'pass'));
  assert.equal(results.find((item) => item.path === '/negative/allowed' && item.check === 'robots.disallow').status, 'pass');
});

test('negative fixture reports each concrete regression as fail', async () => {
  const results = await runFixture('negative');
  const failed = new Set(results.filter((item) => item.status === 'fail').map((item) => `${item.path}|${item.check}`));
  for (const expected of [
    '/negative|robots.noindex', '/negative|robots.disallow', '/negative|canonical',
    '/negative|metadata:title', '/negative|metadata:name:description', '/negative|sitemap',
    '/negative|link:/docs', '/not-found|status', '/bad-redirect|status', '/bad-redirect|redirect'
  ]) assert.ok(failed.has(expected), `missing ${expected}`);
  assert.equal(results.some((item) => item.status === 'unknown'), false);
});

test('robots wildcard groups use all consecutive agents, longest match, and Allow on a tie', () => {
  assert.equal(robotsDisallows('User-agent: *\nUser-agent: fixturebot\nDisallow: /private\n', '/private/page'), true);
  assert.equal(robotsDisallows('User-agent: *\nAllow: /private/public\nDisallow: /private\n', '/private/public/page'), false);
  assert.equal(robotsDisallows('User-agent: *\nDisallow: /same\nAllow: /same\n', '/same/page'), false);
});

test('sitemap membership requires an absolute same-origin URL entry outside XML comments', () => {
  const resource = (body) => ({ kind: 'response', status: 200, body });
  const origin = 'https://example.test';
  assert.equal(parseSitemap(resource('<urlset><url><loc>https://example.test/ok</loc></url></urlset>'), origin).paths.has('/ok'), true);
  assert.equal(parseSitemap(resource('<urlset><url><loc>/relative</loc></url></urlset>'), origin).paths.has('/relative'), false);
  assert.equal(parseSitemap(resource('<urlset><!-- <url><loc>https://example.test/commented</loc></url> --></urlset>'), origin).paths.has('/commented'), false);
  assert.equal(parseSitemap(resource('<urlset><!-- <url><loc>https://example.test/unclosed</loc></url>'), origin).paths.has('/unclosed'), false);
  assert.equal(parseSitemap(resource('<urlset><url><loc>https://outside.test/foreign</loc></url></urlset>'), origin).paths.has('/foreign'), false);
});

test('active documented exception is explicit and an expired one fails', async () => {
  const manifest = fixture('exception');
  const active = await checkManifest(manifest, { targetBase: site.baseUrl, timeoutMs: 1000, now: NOW });
  assert.equal(active.find((item) => item.check === 'metadata:name:description').status, 'exception');
  assert.equal(active.some((item) => item.status === 'fail'), false);

  const expired = await checkManifest(manifest, { targetBase: site.baseUrl, timeoutMs: 1000, now: new Date('2027-01-02T00:00:00Z') });
  const result = expired.find((item) => item.check === 'metadata:name:description');
  assert.equal(result.status, 'fail');
  assert.match(result.message, /exception expired/);
});

test('auth, bot blocking, JavaScript ambiguity, and temporary errors remain unknown', async () => {
  const results = await runFixture('unknown');
  for (const route of ['/auth', '/bot-block', '/temporary']) {
    assert.equal(results.find((item) => item.path === route && item.check === 'status').status, 'unknown');
  }
  for (const check of ['robots.noindex', 'canonical', 'metadata:title', 'metadata:name:description', 'link:/docs']) {
    assert.equal(results.find((item) => item.path === '/js-shell' && item.check === check).status, 'unknown', check);
  }
  assert.equal(results.some((item) => item.status === 'fail'), false);
});

test('transport failure does not become a guessed failure', async () => {
  const results = await checkManifest(fixture('positive'), { targetBase: 'http://127.0.0.1:1', timeoutMs: 100, now: NOW });
  assert.equal(results.some((item) => item.status === 'fail'), false);
  assert.ok(results.some((item) => item.status === 'unknown'));
});

function fixture(name) {
  return loadManifest(path.join(ROOT, `fixtures/manifests/${name}.json`));
}

function runFixture(name) {
  return checkManifest(fixture(name), { targetBase: site.baseUrl, timeoutMs: 1000, now: NOW });
}
