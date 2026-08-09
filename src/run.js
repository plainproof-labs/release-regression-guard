'use strict';

const path = require('node:path');
const { loadManifest } = require('./manifest');
const { checkManifest } = require('./checker');
const { buildReport, writeReports } = require('./report');

async function run(options) {
  validateOptions(options);
  const manifest = loadManifest(options.manifestPath);
  const results = await checkManifest(manifest, options);
  const report = buildReport(results, options.now || new Date());
  const files = writeReports(report, options.reportDir, portableManifestUri(options.manifestPath));
  return { manifest, report, files };
}

function portableManifestUri(manifestPath) {
  const absolute = path.resolve(manifestPath);
  const relative = path.relative(process.cwd(), absolute);
  if (relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join('/');
  }
  return path.basename(absolute);
}

function validateOptions(options) {
  if (!options || typeof options.manifestPath !== 'string' || options.manifestPath.trim() === '') throw new Error('manifest path is required');
  if (typeof options.reportDir !== 'string' || options.reportDir.trim() === '') throw new Error('report directory is required');
  if (/[\r\n]/.test(options.manifestPath) || /[\r\n]/.test(options.reportDir)) throw new Error('file paths must not contain line breaks');
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 100 || options.timeoutMs > 120000) throw new Error('timeout-ms must be an integer from 100 through 120000');
}

module.exports = { portableManifestUri, run, validateOptions };
