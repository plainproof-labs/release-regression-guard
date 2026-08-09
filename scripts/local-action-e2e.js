#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startFixtureServer } = require('../test/helpers/fixture-server');

async function main() {
  const root = path.resolve(__dirname, '..');
  const site = await startFixtureServer();
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rrg-e2e-'));
  try {
    for (const scenario of [
      { fixture: 'positive', conclusion: 'pass', exitCode: 0, annotation: null },
      { fixture: 'negative', conclusion: 'fail', exitCode: 1, annotation: 'error' },
      { fixture: 'exception', conclusion: 'pass', exitCode: 0, annotation: 'notice' },
      { fixture: 'unknown', conclusion: 'unknown', exitCode: 0, annotation: 'warning' }
    ]) {
      await runScenario({ root, site, temporary, ...scenario });
    }
    process.stdout.write('Local Action E2E matrix passed: positive, negative, exception, unknown\n');
  } finally {
    await site.close();
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

async function runScenario({ root, site, temporary, fixture, conclusion, exitCode, annotation }) {
  const directory = path.join(temporary, fixture);
  const reportDir = path.join(directory, 'reports');
  const githubOutput = path.join(directory, 'github-output.txt');
  const githubSummary = path.join(directory, 'github-summary.md');
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(githubOutput, '');
  fs.writeFileSync(githubSummary, '');
  const canaries = {
    repository: 'private-owner-canary/private-repository-canary',
    actor: 'private-user-canary',
    secret: 'super-secret-token-canary'
  };
  const result = await child(process.execPath, ['action/index.js'], {
    cwd: root,
    env: {
      ...process.env,
      'INPUT_MANIFEST': `fixtures/manifests/${fixture}.json`,
      'INPUT_TARGET-BASE': site.baseUrl,
      'INPUT_REPORT-DIR': reportDir,
      'INPUT_TIMEOUT-MS': '1000',
      GITHUB_OUTPUT: githubOutput,
      GITHUB_STEP_SUMMARY: githubSummary,
      GITHUB_REPOSITORY: canaries.repository,
      GITHUB_ACTOR: canaries.actor,
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: canaries.secret
    }
  });
  assert.equal(result.code, exitCode, `${fixture} exit code`);
  const files = {
    json: path.join(reportDir, 'report.json'),
    sarif: path.join(reportDir, 'results.sarif'),
    markdown: path.join(reportDir, 'report.md')
  };
  for (const file of Object.values(files)) assert.equal(fs.existsSync(file), true, `${fixture}: missing ${file}`);

  const report = JSON.parse(fs.readFileSync(files.json, 'utf8'));
  const sarif = JSON.parse(fs.readFileSync(files.sarif, 'utf8'));
  const markdown = fs.readFileSync(files.markdown, 'utf8');
  const outputs = fs.readFileSync(githubOutput, 'utf8');
  const summary = fs.readFileSync(githubSummary, 'utf8');
  assert.equal(report.summary.conclusion, conclusion, `${fixture} conclusion`);
  assert.equal(report.provenance.implementationVersion, '1.1.0', `${fixture} report version`);
  assert.equal(sarif.runs[0].tool.driver.version, '1.1.0', `${fixture} SARIF version`);
  assert.equal(sarif.runs[0].results.every((item) => item.locations[0].physicalLocation.artifactLocation.uri === `fixtures/manifests/${fixture}.json`), true, `${fixture} SARIF manifest location`);
  assert.equal(sarif.runs[0].results.every((item) => /^\/.+?: .+/.test(item.message.text)), true, `${fixture} SARIF message`);
  assert.match(outputs, new RegExp(`^conclusion=${conclusion}$`, 'm'));
  assert.match(outputs, /^json-report=(?:.+\/)?report\.json$/m);
  assert.match(outputs, /^sarif-report=(?:.+\/)?results\.sarif$/m);
  assert.match(outputs, /^markdown-report=(?:.+\/)?report\.md$/m);
  assert.match(markdown, new RegExp(`Conclusion: \\*\\*${conclusion.toUpperCase()}\\*\\*`));
  assert.equal(summary, markdown.endsWith('\n') ? markdown : `${markdown}\n`, `${fixture} summary must render the generated Markdown`);

  const annotations = result.stdout.split(/\r?\n/).filter((line) => /^::(?:error|warning|notice) /.test(line));
  if (annotation === null) {
    assert.equal(annotations.length, 0, `${fixture} must not emit an annotation`);
    assert.equal(sarif.runs[0].results.length, 0, `${fixture} SARIF must contain no non-pass result`);
  } else {
    assert.ok(annotations.length > 0, `${fixture} must emit ${annotation} annotations`);
    assert.ok(annotations.every((line) => line.startsWith(`::${annotation} `)), `${fixture} annotation level`);
    assert.ok(annotations.every((line) => line.includes(`file=fixtures/manifests/${fixture}.json`)), `${fixture} annotation location`);
    assert.ok(annotations.every((line) => /::\/.+?: .+/.test(line)), `${fixture} annotation message`);
  }
  if (fixture === 'unknown') {
    assert.equal(report.summary.fail, 0);
    assert.ok(report.summary.unknown > 0);
    assert.equal(sarif.runs[0].results.every((item) => item.level === 'warning'), true);
    assert.doesNotMatch(`${result.stdout}\n${summary}`, /completed: pass/i);
  }
  if (fixture === 'exception') {
    assert.equal(report.summary.exception, 1);
    assert.equal(sarif.runs[0].results.every((item) => item.level === 'note'), true);
  }

  const allOutput = [result.stdout, result.stderr, outputs, summary, markdown,
    fs.readFileSync(files.json, 'utf8'), fs.readFileSync(files.sarif, 'utf8')].join('\n');
  for (const forbidden of [site.baseUrl, canaries.repository, canaries.actor, canaries.secret, os.homedir()]) {
    assert.equal(allOutput.includes(forbidden), false, `${fixture} leaked ${forbidden}`);
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
