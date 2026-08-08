#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startFixtureServer } = require('../test/helpers/fixture-server');

async function main() {
  const root = path.resolve(__dirname, '..');
  const site = await startFixtureServer();
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rrg-e2e-'));
  const reportDir = path.resolve(process.env.RRG_REPORT_DIR || path.join(temporary, 'reports'));
  fs.mkdirSync(reportDir, { recursive: true });
  const githubOutput = path.join(temporary, 'github-output.txt');
  fs.writeFileSync(githubOutput, '');
  try {
    const result = await child(process.execPath, ['action/index.js'], {
      cwd: root,
      env: {
        ...process.env,
        'INPUT_MANIFEST': 'fixtures/manifests/positive.json',
        'INPUT_TARGET-BASE': site.baseUrl,
        'INPUT_REPORT-DIR': reportDir,
        'INPUT_TIMEOUT-MS': '1000',
        GITHUB_OUTPUT: githubOutput
      }
    });
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    if (result.code !== 0) process.exitCode = result.code;
  } finally {
    await site.close();
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function child(command, args, options) {
  return new Promise((resolve, reject) => {
    const processChild = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    processChild.stdout.on('data', (chunk) => { stdout += chunk; });
    processChild.stderr.on('data', (chunk) => { stderr += chunk; });
    processChild.on('error', reject);
    processChild.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
