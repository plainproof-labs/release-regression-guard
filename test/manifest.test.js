'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { loadManifest, validateManifest } = require('../src/manifest');

const ROOT = path.resolve(__dirname, '..');

test('published schema and every fixture manifest are valid JSON', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schema/release-guard.schema.json'), 'utf8'));
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  for (const fixture of ['positive', 'negative', 'exception', 'unknown']) {
    assert.doesNotThrow(() => loadManifest(path.join(ROOT, `fixtures/manifests/${fixture}.json`)));
  }
});

test('validator rejects undeclared fields and incomplete check declarations', () => {
  const valid = loadManifest(path.join(ROOT, 'fixtures/manifests/positive.json'));
  const extra = structuredClone(valid);
  extra.analytics = { endpoint: 'https://example.invalid' };
  assert.throws(() => validateManifest(extra), /analytics is not supported/);

  const incomplete = structuredClone(valid);
  delete incomplete.criticalUrls[0].canonical;
  assert.throws(() => validateManifest(incomplete), /canonical must contain only path/);
});

test('validator rejects an exception that does not map to a declared check', () => {
  const manifest = loadManifest(path.join(ROOT, 'fixtures/manifests/exception.json'));
  manifest.criticalUrls[0].exceptions[0].check = 'seo.score';
  assert.throws(() => validateManifest(manifest), /does not name a declared check/);
});

test('published path pattern and runtime reject network paths, fragments, whitespace, and controls', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schema/release-guard.schema.json'), 'utf8'));
  const publishedPattern = new RegExp(schema.$defs.path.pattern, 'u');
  const valid = loadManifest(path.join(ROOT, 'fixtures/manifests/positive.json'));
  for (const accepted of ['/', '/pricing', '/search?q=release%20guard']) {
    assert.equal(publishedPattern.test(accepted), true, accepted);
    const manifest = structuredClone(valid);
    manifest.criticalUrls[0].path = accepted;
    assert.doesNotThrow(() => validateManifest(manifest), accepted);
  }
  for (const rejected of ['//outside.test/path', '/fragment#part', '/literal space', '/line\nbreak', '/tab\tpath', '/control\u007f']) {
    assert.equal(publishedPattern.test(rejected), false, JSON.stringify(rejected));
    const manifest = structuredClone(valid);
    manifest.criticalUrls[0].path = rejected;
    assert.throws(() => validateManifest(manifest), /without whitespace, control characters, or a fragment/, JSON.stringify(rejected));
  }
});
