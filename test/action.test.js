'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { MAX_JOB_SUMMARY_BYTES, appendJobSummary, runAction } = require('../src/action');
const { startFixtureServer } = require('./helpers/fixture-server');

const ROOT = path.resolve(__dirname, '..');

test('Action entrypoint produces reports, summaries, and honest annotations for pass, fail, exception, and unknown', { concurrency: false }, async () => {
  const site = await startFixtureServer();
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rrg-action-matrix-'));
  const originalExitCode = process.exitCode;
  try {
    for (const scenario of [
      { fixture: 'positive', conclusion: 'pass', exitCode: 0, annotation: null },
      { fixture: 'negative', conclusion: 'fail', exitCode: 1, annotation: '::error ' },
      { fixture: 'exception', conclusion: 'pass', exitCode: 0, annotation: '::notice ' },
      { fixture: 'unknown', conclusion: 'unknown', exitCode: 0, annotation: '::warning ' }
    ]) {
      process.exitCode = undefined;
      const directory = path.join(temporary, scenario.fixture);
      fs.mkdirSync(directory, { recursive: true });
      const outputFile = path.join(directory, 'github-output');
      const summaryFile = path.join(directory, 'github-summary.md');
      fs.writeFileSync(outputFile, '');
      fs.writeFileSync(summaryFile, '');
      const environment = {
        'INPUT_MANIFEST': path.join(ROOT, `fixtures/manifests/${scenario.fixture}.json`),
        'INPUT_TARGET-BASE': site.baseUrl,
        'INPUT_REPORT-DIR': path.join(directory, 'reports'),
        'INPUT_TIMEOUT-MS': '5000',
        GITHUB_OUTPUT: outputFile,
        GITHUB_STEP_SUMMARY: summaryFile,
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
      const jobSummary = fs.readFileSync(summaryFile, 'utf8');
      assert.match(outputs, new RegExp(`^conclusion=${scenario.conclusion}$`, 'm'));
      assert.match(outputs, /^sarif-report=results\.sarif$/m);
      assert.equal(captured.value.jobSummary.written, true);
      assert.equal(captured.value.jobSummary.truncated, false);
      assert.match(jobSummary, new RegExp(`Conclusion: \\*\\*${scenario.conclusion.toUpperCase()}\\*\\*`));
      const generatedMarkdown = fs.readFileSync(captured.value.files.markdown, 'utf8');
      assert.equal(jobSummary, generatedMarkdown.endsWith('\n') ? generatedMarkdown : `${generatedMarkdown}\n`);
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
        jobSummary,
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

test('Job Summary is bounded and points to complete artifacts when Markdown is oversized', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rrg-summary-limit-'));
  try {
    const markdownFile = path.join(temporary, 'report.md');
    const summaryFile = path.join(temporary, 'summary.md');
    fs.writeFileSync(markdownFile, `# Report\n\n${'あ'.repeat(MAX_JOB_SUMMARY_BYTES)}\nSECRET_TAIL_CANARY\n`);
    fs.writeFileSync(summaryFile, '');
    const value = appendJobSummary({ GITHUB_STEP_SUMMARY: summaryFile }, markdownFile);
    const summary = fs.readFileSync(summaryFile, 'utf8');
    assert.equal(value.written, true);
    assert.equal(value.truncated, true);
    assert.ok(Buffer.byteLength(summary, 'utf8') <= MAX_JOB_SUMMARY_BYTES);
    assert.match(summary, /Job Summary truncated at 200 KiB/);
    assert.match(summary, /JSON, SARIF, and Markdown report artifacts/);
    assert.doesNotMatch(summary, /SECRET_TAIL_CANARY/);
    assert.doesNotMatch(summary, /�/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('committed example reports contain no local identity or absolute path', () => {
  const reportDirectories = [
    path.join(ROOT, 'reports/local-release'),
    path.join(ROOT, 'reports/fixtures/pass'),
    path.join(ROOT, 'reports/fixtures/fail'),
    path.join(ROOT, 'reports/fixtures/exception'),
    path.join(ROOT, 'reports/fixtures/unknown')
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
