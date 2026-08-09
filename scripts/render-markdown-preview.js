#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const outputRoot = path.join(os.tmpdir(), 'release-regression-guard-preview');
fs.mkdirSync(outputRoot, { recursive: true });

for (const [input, output, title] of [
  ['README.md', 'readme.html', 'Release Regression Guard README'],
  ['reports/fixtures/pass/report.md', 'report-pass.html', 'Release Regression Guard PASS report'],
  ['reports/fixtures/fail/report.md', 'report-fail.html', 'Release Regression Guard FAIL report'],
  ['reports/fixtures/exception/report.md', 'report-exception.html', 'Release Regression Guard EXCEPTION report'],
  ['reports/fixtures/unknown/report.md', 'report-unknown.html', 'Release Regression Guard UNKNOWN report'],
  ['.github/MARKETPLACE.md', 'marketplace.html', 'Release Regression Guard Marketplace copy']
]) {
  const markdown = fs.readFileSync(path.join(root, input), 'utf8');
  fs.writeFileSync(path.join(outputRoot, output), page(title, render(markdown)));
}
process.stdout.write(`${outputRoot}\n`);

function render(markdown) {
  const lines = markdown.split(/\r?\n/).filter((line) => !/^\s*<!--[\s\S]*-->\s*$/.test(line));
  const html = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line.startsWith('```')) {
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) code.push(lines[index++]);
      html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      index += 1;
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }
    if (/^\|.*\|$/.test(line) && index + 1 < lines.length && /^\|(?:\s*:?-+:?\s*\|)+$/.test(lines[index + 1])) {
      const headers = cells(line);
      index += 2;
      const rows = [];
      while (index < lines.length && /^\|.*\|$/.test(lines[index])) rows.push(cells(lines[index++]));
      html.push(`<div class="table-scroll"><table><thead><tr>${headers.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) items.push(readListItem(lines, () => index, (value) => { index = value; }, /^\s*[-*]\s+/));
      html.push(`<ul>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) items.push(readListItem(lines, () => index, (value) => { index = value; }, /^\s*\d+\.\s+/));
      html.push(`<ol>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</ol>`);
      continue;
    }
    if (line.trim() === '') {
      index += 1;
      continue;
    }
    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,6})\s|^```|^\s*[-*]\s+|^\s*\d+\.\s+|^\|.*\|$/.test(lines[index])) paragraph.push(lines[index++].trim());
    html.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }
  return html.join('\n');
}

function readListItem(lines, getIndex, setIndex, marker) {
  let index = getIndex();
  const parts = [lines[index].replace(marker, '').trim()];
  index += 1;
  while (index < lines.length && /^\s{2,}\S/.test(lines[index]) && !/^\s*(?:[-*]|\d+\.)\s+/.test(lines[index])) {
    parts.push(lines[index].trim());
    index += 1;
  }
  setIndex(index);
  return parts.join(' ');
}

function cells(line) {
  return line.slice(1, -1).split('|').map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function inline(value) {
  const code = [];
  let escaped = escapeHtml(value).replace(/`([^`]+)`/g, (_, content) => {
    code.push(`<code>${content}</code>`);
    return `@@CODE${code.length - 1}@@`;
  });
  escaped = escaped
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return escaped.replace(/@@CODE(\d+)@@/g, (_, position) => code[Number(position)]);
}

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function page(title, content) {
  const stress = `<section class="qa-stress" aria-label="Overflow QA fixture"><h2>Overflow QA fixture</h2><p>これは長い日本語がモバイル幅でも切れずに判読できることを確認するためのローカル表示専用テキストです。認証や一時障害を推測で合格または不合格にせずunknownとして保持する境界も読みやすいことを確認します。</p><p>https://preview.example.test/releases/2026/08/08/a-very-long-critical-path-for-overflow-verification/language/ja-JP</p><div class="table-scroll"><table><thead><tr><th>Critical path</th><th>Check</th><th>Result</th><th>Evidence</th></tr></thead><tbody><tr><td>/非常に長い宣言済みクリティカルパス/改行確認</td><td>metadata:name:description</td><td>UNKNOWN</td><td>JavaScriptの実行結果が曖昧なため推測せずunknownとして保持</td></tr></tbody></table></div></section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
  :root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;background:#f6f8fa;color:#1f2328;font:16px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.markdown{width:min(980px,100%);min-height:100vh;margin:auto;padding:32px 40px;background:#fff;overflow-wrap:anywhere}h1,h2{padding-bottom:.3em;border-bottom:1px solid #d0d7de}h1{font-size:2em}h2{margin-top:1.6em;font-size:1.5em}h3{font-size:1.25em}a{color:#0969da}code{font:85% ui-monospace,SFMono-Regular,Consolas,monospace;background:#eff1f3;border-radius:5px;padding:.2em .4em}pre{overflow:auto;padding:16px;background:#f6f8fa;border-radius:6px}pre code{padding:0;background:none}.table-scroll{max-width:100%;overflow-x:auto}table{border-spacing:0;border-collapse:collapse;width:100%;min-width:620px}th,td{padding:6px 13px;border:1px solid #d0d7de;text-align:left;vertical-align:top}th:nth-child(3),td:nth-child(3){white-space:nowrap}tr:nth-child(2n){background:#f6f8fa}li+li{margin-top:.25em}@media(max-width:600px){.markdown{padding:20px 16px}h1{font-size:1.65em}h2{font-size:1.3em}pre{font-size:12px}.table-scroll{margin-right:-16px}}
  .qa-stress{margin-top:48px;padding-top:16px;border-top:2px dashed #8c959f}
  </style></head><body><main class="markdown">${content}${stress}</main></body></html>`;
}
