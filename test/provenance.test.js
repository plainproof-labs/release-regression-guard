'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { checkIdsFor, loadManifest } = require('../src/manifest');
const { RULE_SOURCES, sourceForCheck } = require('../src/provenance');

const ROOT = path.resolve(__dirname, '..');

test('every implemented manifest check maps to a source recorded in the ledger', () => {
  const ledger = fs.readFileSync(path.join(ROOT, 'sources/PROVENANCE.md'), 'utf8');
  const manifests = ['positive', 'negative', 'exception', 'unknown'].map((name) => loadManifest(path.join(ROOT, `fixtures/manifests/${name}.json`)));
  for (const manifest of manifests) {
    for (const entry of manifest.criticalUrls) {
      for (const check of checkIdsFor(entry)) {
        const source = sourceForCheck(check);
        assert.ok(source, `missing source for ${check}`);
        assert.match(ledger, new RegExp(source.id));
        assert.ok(ledger.includes(source.url));
      }
    }
  }
  assert.deepEqual(new Set(RULE_SOURCES.map((source) => source.id)).size, RULE_SOURCES.length);
});

test('self-hosted example is deterministic and has no live target or secret input', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/self-hosted-example.yml'), 'utf8');
  assert.match(workflow, /node scripts\/serve-fixtures\.js/);
  assert.match(workflow, /RRG_FIXTURE_PORT: "0"/);
  assert.match(workflow, /target-base: \$\{\{ steps\.fixture\.outputs\.base \}\}/);
  assert.match(workflow, /manifest: fixtures\/manifests\/positive\.json/);
  assert.match(workflow, /uses: actions\/upload-artifact@v7/);
  assert.match(workflow, /if: always\(\)/);
  assert.doesNotMatch(workflow, /secrets\.|inputs\.target_base|https:\/\/|127\.0\.0\.1:4173/);
});
