'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const SITE_ROOT = path.resolve(__dirname, '../../fixtures/site');

async function startFixtureServer(port = 0) {
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://fixture.invalid').pathname;
    if (pathname === '/robots.txt') return send(response, 200, 'text/plain', 'User-agent: *\nUser-agent: fixturebot\nAllow: /negative/allowed\nDisallow: /negative\n');
    if (pathname === '/sitemap.xml') {
      const locations = ['/positive', '/moved', '/negative/allowed', '/exception', '/auth', '/bot-block', '/js-shell', '/temporary'];
      const origin = `http://127.0.0.1:${server.address().port}`;
      return send(response, 200, 'application/xml', `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locations.map((item) => `<url><loc>${origin}${item}</loc></url>`).join('')}</urlset>`);
    }
    if (pathname === '/moved') {
      response.writeHead(302, { location: '/landing' });
      return response.end();
    }
    if (pathname === '/bad-redirect') {
      response.writeHead(302, { location: 'http://[' });
      return response.end();
    }
    if (pathname === '/auth') return send(response, 401, 'text/html', '<h1>Sign in</h1>');
    if (pathname === '/temporary') return send(response, 503, 'text/html', '<h1>Try later</h1>');
    const files = new Map([
      ['/positive', 'positive.html'], ['/landing', 'landing.html'], ['/negative', 'negative.html'],
      ['/negative/allowed', 'robots-allowed.html'], ['/exception', 'exception.html'],
      ['/js-shell', 'js-shell.html'], ['/bot-block', 'bot-block.html']
    ]);
    if (files.has(pathname)) return send(response, 200, 'text/html', fs.readFileSync(path.join(SITE_ROOT, files.get(pathname)), 'utf8'));
    return send(response, 404, 'text/html', '<!doctype html><html><body>Not found</body></html>');
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}

function send(response, status, contentType, body) {
  response.writeHead(status, { 'content-type': `${contentType}; charset=utf-8` });
  response.end(body);
}

module.exports = { startFixtureServer };
