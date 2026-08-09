'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { run } = require('./run');

const MAX_JOB_SUMMARY_BYTES = 200 * 1024;

async function runAction(environment = process.env, output = process.stdout) {
  const manifestInput = input(environment, 'manifest') || 'release-guard.json';
  const targetBase = input(environment, 'target-base');
  const reportInput = input(environment, 'report-dir') || 'release-guard-report';
  const timeoutInput = input(environment, 'timeout-ms') || '10000';
  if (!targetBase) throw new Error('Input target-base is required');
  const manifestPath = path.resolve(manifestInput);
  const reportDir = path.resolve(reportInput);
  const { report, files } = await run({ manifestPath, targetBase, reportDir, timeoutMs: Number(timeoutInput) });
  emitAnnotations(report, portableInputPath(manifestPath), output);
  const jobSummary = appendJobSummary(environment, files.markdown);
  setOutput(environment, 'conclusion', report.summary.conclusion);
  setOutput(environment, 'json-report', portableOutputPath(files.json));
  setOutput(environment, 'sarif-report', portableOutputPath(files.sarif));
  setOutput(environment, 'markdown-report', portableOutputPath(files.markdown));
  output.write(`Release Regression Guard completed: ${report.summary.conclusion} (${report.summary.total} checks)\n`);
  if (report.summary.fail > 0) process.exitCode = 1;
  return { report, files, jobSummary };
}

function appendJobSummary(environment, markdownFile) {
  if (!environment.GITHUB_STEP_SUMMARY) return { written: false, truncated: false, bytes: 0 };
  const markdown = fs.readFileSync(markdownFile, 'utf8');
  const notice = '\n\n> Job Summary truncated at 200 KiB. Download the JSON, SARIF, and Markdown report artifacts for the complete result.\n';
  const truncated = Buffer.byteLength(markdown, 'utf8') > MAX_JOB_SUMMARY_BYTES;
  const value = truncated
    ? `${truncateUtf8(markdown, MAX_JOB_SUMMARY_BYTES - Buffer.byteLength(notice, 'utf8'))}${notice}`
    : `${markdown.endsWith('\n') ? markdown : `${markdown}\n`}`;
  fs.appendFileSync(environment.GITHUB_STEP_SUMMARY, value);
  return { written: true, truncated, bytes: Buffer.byteLength(value, 'utf8') };
}

function truncateUtf8(value, maximumBytes) {
  const buffer = Buffer.from(value, 'utf8');
  if (buffer.length <= maximumBytes) return value;
  let end = maximumBytes;
  while (end > 0 && (buffer[end] & 0xC0) === 0x80) end -= 1;
  return buffer.subarray(0, end).toString('utf8');
}

function emitAnnotations(report, manifestPath, output = process.stdout) {
  for (const item of report.results) {
    if (item.status === 'pass') continue;
    const command = item.status === 'fail' ? 'error' : item.status === 'unknown' ? 'warning' : 'notice';
    const title = `Release check ${item.status}: ${item.check}`;
    output.write(`::${command} file=${escapeProperty(manifestPath)},title=${escapeProperty(title)}::${escapeData(`${item.path}: ${item.message}`)}\n`);
  }
}

function input(environment, name) {
  return environment[`INPUT_${name.toUpperCase()}`] ?? environment[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`] ?? '';
}

function setOutput(environment, name, value) {
  const stringValue = String(value);
  if (/\r|\n/.test(stringValue)) throw new Error(`Output ${name} contains a line break`);
  if (environment.GITHUB_OUTPUT) fs.appendFileSync(environment.GITHUB_OUTPUT, `${name}=${stringValue}\n`);
}

function portableOutputPath(filePath) {
  const relative = path.relative(realPath(process.cwd()), realPath(filePath));
  if (relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) return relative.split(path.sep).join('/');
  return path.basename(filePath);
}

function portableInputPath(filePath) {
  const relative = path.relative(realPath(process.cwd()), realPath(filePath));
  if (relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) return relative.split(path.sep).join('/');
  return path.basename(filePath);
}

function realPath(value) {
  try {
    return fs.realpathSync.native(value);
  } catch {
    return path.resolve(value);
  }
}

function escapeData(value) {
  return String(value).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function escapeProperty(value) {
  return escapeData(value).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

module.exports = {
  MAX_JOB_SUMMARY_BYTES,
  appendJobSummary,
  emitAnnotations,
  input,
  portableInputPath,
  portableOutputPath,
  runAction,
  setOutput,
  truncateUtf8
};
