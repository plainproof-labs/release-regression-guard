#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const { startFixtureServer } = require('../test/helpers/fixture-server');

async function main() {
  const port = Number(process.env.RRG_FIXTURE_PORT || '0');
  if (!Number.isInteger(port) || port < 0 || port > 65535 || (port > 0 && port < 1024)) throw new Error('RRG_FIXTURE_PORT must be 0 or an integer from 1024 through 65535');
  if (process.env.RRG_FIXTURE_READY) fs.rmSync(process.env.RRG_FIXTURE_READY, { force: true });
  const site = await startFixtureServer(port);
  if (process.env.RRG_FIXTURE_READY) fs.writeFileSync(process.env.RRG_FIXTURE_READY, `${site.baseUrl}\n`);
  process.stdout.write(`Fixture site ready on ${site.baseUrl}\n`);
  const stop = async () => { await site.close(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
