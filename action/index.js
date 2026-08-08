#!/usr/bin/env node
'use strict';

const { runAction } = require('../src/action');

runAction().catch((error) => {
  const message = error && error.message ? error.message : 'Unexpected action error';
  process.stdout.write(`::error title=Release Regression Guard::${escapeCommand(message)}\n`);
  process.exitCode = 1;
});

function escapeCommand(value) {
  return String(value).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}
