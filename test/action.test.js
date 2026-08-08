'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { runAction } = require('../src/action');
const { startFixtureServer } = require('./helpers/fixture-server');

const ROOT = path.resolve(__dirname, '..');

test('Action entrypoint produces reports and honest annotations for pass, fail, and unknown', { concurrency: false }, async () => {
  const site = await startFixtureServer();
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rrg-action-matrix-'));
  const originalExitCode = process.exitCode;
  try {
    for (const scenario of [
      { fixture: 'positive', conclusion: 'pass', exitCode: 0, annotation: null },
      { fixture: 'negative', conclusion: 'fail', exitCode: 1, annotation: '::error ' },
      { fixture: 'unknown', conclusion: 'unknown', exitCode: 0, annotation: '::warning ' }
    ]) {
      process.exitCode = undefined;
      const directory = path.join(temporary, scenario.fixture);
      fs.mkdirSync(directory, { recursive: true });
      const outputFile = path.join(directory, 'github-output');
      fs.writeFileSync(outputFile, '');
      const environment = {
        'INPUT_MANIFEST': path.join(ROOT, `fixtures/manifests/${scenario.fixture}.json`),
        'INPUT_TARGET-BASE': site.baseUrl,
        'INPUT_REPORT-DIR': path.join(directory, 'reports'),
        'INPUT_TIMEOUT-MS': '1000',
        GITHUB_OUTPUT: outputFile,
        GITHUB_REPOSITORY: 'private-owner-canary/private-repository-canary',
        GITHUB_ACTOR: 'private-user-canary',
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'super-secret-token-canary'
      };
      const output = createOutputCapture();
      const value = await runAction(environment, output);
      const captured = { value, stdout: output.text() };
      assert.equal(captured.value.report.summary.conclusion, scenario.conclusion);
      assert.equal(process.exitCode || 0, scenario.exitCode);
      for (const file of Object.values(captured.value.files)) assert.equal(fs.existsSync(file), true);
      const outputs = fs.readFileSync(outputFile, 'utf8');
      assert.match(outputs, new RegExp(`^conclusion=${scenario.conclusion}$`, 'm'));
      assert.match(outputs, /^sarif-report=results\.sarif$/m);
      if (scenario.annotation) assert.match(captured.stdout, new RegExp(scenario.annotation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      else assert.doesNotMatch(captured.stdout, /::(?:error|warning|notice) /);
      if (scenario.conclusion === 'unknown') {
        assert.doesNotMatch(captured.stdout, /completed: pass/);
        assert.equal(captured.value.report.summary.fail, 0);
        assert.ok(captured.value.report.summary.unknown > 0);
      }

      const artifactParts = {
        stdout: captured.stdout,
        outputs,
        json: fs.readFileSync(captured.value.files.json, 'utf8'),
        sarif: fs.readFileSync(captured.value.files.sarif, 'utf8'),
        markdown: fs.readFileSync(captured.value.files.markdown, 'utf8')
      };
      const artifactText = Object.values(artifactParts).join('\n');
      for (const forbidden of [
        ROOT, os.homedir(), site.baseUrl, environment.GITHUB_REPOSITORY,
        environment.GITHUB_ACTOR, environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN
      ]) {
        const leakedIn = Object.entries(artifactParts).filter(([, value]) => value.includes(forbidden)).map(([name]) => name);
        assert.equal(leakedIn.length, 0, `artifact leaked ${forbidden} in ${leakedIn.join(', ')} for ${scenario.fixture}`);
      }
      assert.doesNotMatch(artifactText, /\/Users\/[^/]+\//);
    }
  } finally {
    process.exitCode = originalExitCode;
    await site.close();
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('committed example reports contain no local identity or absolute path', () => {
  const reportDirectories = [
    path.join(ROOT, 'reports/local-release'),
    path.join(ROOT, 'reports/fixtures/pass'),
    path.join(ROOT, 'reports/fixtures/fail')
  ].filter((directory) => fs.existsSync(directory));
  assert.ok(reportDirectories.length >= 2);
  const files = reportDirectories.flatMap((directory) => ['report.json', 'results.sarif', 'report.md'].map((name) => path.join(directory, name)));
  const text = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(text, /\/Users\/[^/]+\//);
  assert.doesNotMatch(text, /private-(?:owner|repository|user)-canary|super-secret-token-canary/);
  assert.doesNotMatch(text, /https?:\/\/127\.0\.0\.1:\d+/);
});

function createOutputCapture() {
  let value = '';
  return {
    write(chunk) {
      value += String(chunk);
      return true;
    },
    text() {
      return value;
    }
  };
}
