#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { run } = require('../src/run');
const { startFixtureServer } = require('../test/helpers/fixture-server');

const root = path.resolve(__dirname, '..');
const reportRoot = path.join(root, 'reports/fixtures');
const now = new Date('2026-08-08T00:00:00Z');

async function main() {
  const site = await startFixtureServer();
  try {
    for (const scenario of [
      { fixture: 'positive', directory: 'pass', conclusion: 'pass' },
      { fixture: 'negative', directory: 'fail', conclusion: 'fail' }
    ]) {
      const reportDir = path.join(reportRoot, scenario.directory);
      fs.mkdirSync(reportDir, { recursive: true });
      const { report } = await run({
        manifestPath: path.join(root, `fixtures/manifests/${scenario.fixture}.json`),
        targetBase: site.baseUrl,
        reportDir,
        timeoutMs: 1000,
        now
      });
      if (report.summary.conclusion !== scenario.conclusion) {
        throw new Error(`${scenario.fixture} produced ${report.summary.conclusion}, expected ${scenario.conclusion}`);
      }
      process.stdout.write(`${scenario.directory}: ${report.summary.conclusion} (${report.summary.total} checks)\n`);
    }
  } finally {
    await site.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
