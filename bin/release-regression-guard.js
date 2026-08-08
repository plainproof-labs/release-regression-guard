#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { run } = require('../src/run');

const args = parseArgs(process.argv.slice(2));
if (!args.manifest || !args.targetBase) {
  process.stderr.write('Usage: release-regression-guard --manifest <file> --target-base <origin> [--report-dir <dir>] [--timeout-ms <ms>]\n');
  process.exitCode = 2;
} else {
  run({
    manifestPath: path.resolve(args.manifest),
    targetBase: args.targetBase,
    reportDir: path.resolve(args.reportDir || 'release-guard-report'),
    timeoutMs: args.timeoutMs ? Number(args.timeoutMs) : 10000
  }).then(({ report, files }) => {
    process.stdout.write(`Release Regression Guard: ${report.summary.conclusion}\n`);
    process.stdout.write(`${files.markdown}\n`);
    if (report.summary.fail > 0) process.exitCode = 1;
  }).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  });
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key || !key.startsWith('--') || value === undefined) continue;
    const camel = key.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    parsed[camel] = value;
  }
  return parsed;
}
