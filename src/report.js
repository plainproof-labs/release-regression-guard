'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { version: IMPLEMENTATION_VERSION } = require('../package.json');
const { sourceForCheck } = require('./provenance');

const PROVENANCE = Object.freeze({
  schema: 'https://release-regression-guard.invalid/schema/v1.json',
  schemaVersion: 1,
  implementationVersion: IMPLEMENTATION_VERSION,
  sourceLedger: 'sources/PROVENANCE.md',
  ruleSourceMap: 'src/provenance.js'
});

function buildReport(results, now = new Date()) {
  const counts = { pass: 0, fail: 0, unknown: 0, exception: 0 };
  results.forEach((item) => { counts[item.status] += 1; });
  const conclusion = counts.fail > 0 ? 'fail' : counts.unknown > 0 ? 'unknown' : 'pass';
  return {
    formatVersion: 1,
    generatedAt: now.toISOString(),
    provenance: PROVENANCE,
    summary: { conclusion, total: results.length, ...counts },
    results: results.map((item) => ({ ...item, source: sourceForCheck(item.check).id }))
  };
}

function toMarkdown(report) {
  const lines = [
    '# Release Regression Guard report',
    '',
    `Conclusion: **${report.summary.conclusion.toUpperCase()}**`,
    '',
    `Checks: ${report.summary.total} total · ${report.summary.pass} pass · ${report.summary.fail} fail · ${report.summary.unknown} unknown · ${report.summary.exception} exception`,
    '',
    '| Critical path | Check | Result | Evidence |',
    '| --- | --- | --- | --- |'
  ];
  for (const item of report.results) {
    lines.push(`| ${escapeCell(item.path)} | ${escapeCell(item.check)} | ${item.status.toUpperCase()} | ${escapeCell(item.message)} |`);
  }
  lines.push('', 'Unknown is preserved for authentication, blocking, ambiguous JavaScript, transport, and temporary server states. It is not a pass or fail.', '', `Schema: v${report.provenance.schemaVersion} · Sources: ${report.provenance.sourceLedger}`, '');
  return lines.join('\n');
}

function toSarif(report, manifestUri = 'release-guard.json') {
  const included = report.results.filter((item) => item.status !== 'pass');
  const rules = [...new Set(included.map((item) => item.check))].sort().map((id) => {
    const source = sourceForCheck(id);
    return {
      id,
      shortDescription: { text: `Release check: ${id}` },
      helpUri: source.url,
      properties: { source: source.id }
    };
  });
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [{
      tool: { driver: { name: 'Release Regression Guard', version: report.provenance.implementationVersion, rules } },
      automationDetails: { id: 'release-regression-guard/' },
      results: included.map((item) => ({
        ruleId: item.check,
        level: item.status === 'fail' ? 'error' : item.status === 'unknown' ? 'warning' : 'note',
        message: { text: `${item.path}: ${item.message}` },
        locations: [{ physicalLocation: { artifactLocation: { uri: manifestUri } } }],
        properties: { status: item.status, criticalPath: item.path }
      }))
    }]
  };
}

function writeReports(report, reportDir, manifestUri = 'release-guard.json') {
  fs.mkdirSync(reportDir, { recursive: true });
  const files = {
    json: path.join(reportDir, 'report.json'),
    sarif: path.join(reportDir, 'results.sarif'),
    markdown: path.join(reportDir, 'report.md')
  };
  fs.writeFileSync(files.json, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(files.sarif, `${JSON.stringify(toSarif(report, manifestUri), null, 2)}\n`);
  fs.writeFileSync(files.markdown, toMarkdown(report));
  return files;
}

function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

module.exports = { PROVENANCE, buildReport, toMarkdown, toSarif, writeReports };
