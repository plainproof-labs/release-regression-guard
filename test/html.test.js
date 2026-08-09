'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { parseHtml } = require('../src/html');

test('comments and script, style, and template text cannot establish document checks', () => {
  const html = `<!doctype html><html><head>
    <!-- <title>comment title</title><meta name="description" content="comment"> -->
    <style>.x::after { content: '<link rel="canonical" href="/fake">'; }</style>
    <template><title>template title</title><a href="/docs">template link</a></template>
    <script src="/app.js">const fake = '<title>script title</title><meta name="description" content="script"><link rel="canonical" href="/fake"><a href="/docs">script link</a>';</script>
  </head><body><div id="root"></div></body></html>`;
  const parsed = parseHtml(html, 'https://example.test/app');
  assert.equal(parsed.javascriptAmbiguous, true);
  assert.equal(parsed.title, '');
  assert.equal(parsed.metadata.has('name:description'), false);
  assert.deepEqual(parsed.canonicals, []);
  assert.deepEqual([...parsed.links], []);
});

test('unclosed comments and raw-text elements cannot establish document checks', () => {
  for (const html of [
    '<html><head><!-- <title>fake</title><meta name="description" content="fake">',
    '<html><head><script>const fake = `<title>fake</title><link rel="canonical" href="/fake">`;',
    '<html><head><style><title>fake</title><a href="/fake">',
    '<html><head><template><title>fake</title><meta name="description" content="fake">'
  ]) {
    const parsed = parseHtml(html, 'https://example.test/');
    assert.equal(parsed.title, '');
    assert.equal(parsed.metadata.has('name:description'), false);
    assert.deepEqual(parsed.canonicals, []);
    assert.deepEqual([...parsed.links], []);
  }
});

test('document URL, base href, and character references resolve canonical and internal links', () => {
  const parsed = parseHtml(`<!doctype html><html><head>
    <base href="/releases/current/">
    <title>Release</title>
    <link rel="canonical" href="page?left=1&amp;right=2">
  </head><body><a href="../docs">Docs</a></body></html>`, 'https://example.test/original/page');
  assert.deepEqual(parsed.canonicals, ['/releases/current/page?left=1&right=2']);
  assert.deepEqual([...parsed.links], ['/releases/docs']);
});

test('multiple robots tags preserve restrictive directives and any nonblank metadata value', () => {
  const parsed = parseHtml(`<!doctype html><html><head>
    <title>Release</title>
    <meta name="description" content="present">
    <meta name="description" content="">
    <meta name="robots" content="none">
    <meta name="robots" content="index, follow">
  </head></html>`, 'https://example.test/');
  assert.equal(parsed.metadata.get('name:description'), 'present');
  assert.ok(parsed.metaRobots.includes('none'));
});
