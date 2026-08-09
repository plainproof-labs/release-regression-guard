'use strict';

const fs = require('node:fs');

const TOP_KEYS = new Set(['$schema', 'version', 'sitemapPath', 'criticalUrls']);
const URL_KEYS = new Set(['path', 'status', 'redirect', 'robots', 'canonical', 'metadata', 'sitemap', 'requiredInternalLinks', 'exceptions']);
const PATH_PATTERN = /^\/(?!\/)[^\u0000-\u0020\u007F#]*$/u;
const METADATA_PATTERN = /^(title|name:[A-Za-z0-9:_-]+|property:[A-Za-z0-9:_-]+)$/;

function loadManifest(filePath) {
  let value;
  try {
    value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read manifest: ${error instanceof SyntaxError ? 'invalid JSON' : 'file unavailable'}`);
  }
  validateManifest(value);
  return value;
}

function validateManifest(manifest) {
  const errors = [];
  if (!isObject(manifest)) throw new Error('Manifest must be an object');
  rejectExtraKeys(manifest, TOP_KEYS, 'manifest', errors);
  if (manifest.version !== 1) errors.push('version must be 1');
  validatePath(manifest.sitemapPath, 'sitemapPath', errors);
  if (!Array.isArray(manifest.criticalUrls) || manifest.criticalUrls.length === 0) {
    errors.push('criticalUrls must contain at least one entry');
  } else {
    const paths = new Set();
    manifest.criticalUrls.forEach((entry, index) => {
      const at = `criticalUrls[${index}]`;
      if (!isObject(entry)) {
        errors.push(`${at} must be an object`);
        return;
      }
      rejectExtraKeys(entry, URL_KEYS, at, errors);
      validatePath(entry.path, `${at}.path`, errors);
      if (paths.has(entry.path)) errors.push(`${at}.path must be unique`);
      paths.add(entry.path);
      validateStatus(entry.status, at, errors);
      validateRedirect(entry.redirect, at, errors);
      if (!isExactObject(entry.robots, ['indexable']) || entry.robots.indexable !== true) {
        errors.push(`${at}.robots must declare {"indexable":true}`);
      }
      if (!isExactObject(entry.canonical, ['path'])) {
        errors.push(`${at}.canonical must contain only path`);
      } else validatePath(entry.canonical.path, `${at}.canonical.path`, errors);
      validateMetadata(entry.metadata, at, errors);
      if (!isExactObject(entry.sitemap, ['required']) || entry.sitemap.required !== true) {
        errors.push(`${at}.sitemap must declare {"required":true}`);
      }
      validateLinks(entry.requiredInternalLinks, at, errors);
      validateExceptions(entry.exceptions, entry, at, errors);
    });
  }
  if (errors.length) throw new Error(`Invalid manifest:\n- ${errors.join('\n- ')}`);
  return manifest;
}

function validateStatus(status, at, errors) {
  if (!isExactObject(status, ['allowed']) || !Array.isArray(status.allowed) || status.allowed.length === 0) {
    errors.push(`${at}.status.allowed must be a non-empty array`);
    return;
  }
  if (new Set(status.allowed).size !== status.allowed.length) errors.push(`${at}.status.allowed must be unique`);
  if (status.allowed.some((code) => !Number.isInteger(code) || code < 200 || code > 499)) {
    errors.push(`${at}.status.allowed must contain HTTP statuses from 200 through 499`);
  }
}

function validateRedirect(redirect, at, errors) {
  if (!isExactObject(redirect, ['finalPath', 'expectedHops'])) {
    errors.push(`${at}.redirect must contain finalPath and expectedHops`);
    return;
  }
  validatePath(redirect.finalPath, `${at}.redirect.finalPath`, errors);
  if (!Number.isInteger(redirect.expectedHops) || redirect.expectedHops < 0 || redirect.expectedHops > 10) {
    errors.push(`${at}.redirect.expectedHops must be an integer from 0 through 10`);
  }
}

function validateMetadata(metadata, at, errors) {
  if (!isExactObject(metadata, ['required']) || !Array.isArray(metadata.required) || metadata.required.length === 0) {
    errors.push(`${at}.metadata.required must be a non-empty array`);
    return;
  }
  if (new Set(metadata.required).size !== metadata.required.length) errors.push(`${at}.metadata.required must be unique`);
  metadata.required.forEach((item) => {
    if (typeof item !== 'string' || !METADATA_PATTERN.test(item)) {
      errors.push(`${at}.metadata.required has unsupported selector ${JSON.stringify(item)}`);
    }
  });
}

function validateLinks(links, at, errors) {
  if (!Array.isArray(links)) {
    errors.push(`${at}.requiredInternalLinks must be an array`);
    return;
  }
  if (new Set(links).size !== links.length) errors.push(`${at}.requiredInternalLinks must be unique`);
  links.forEach((link, index) => validatePath(link, `${at}.requiredInternalLinks[${index}]`, errors));
}

function validateExceptions(exceptions, entry, at, errors) {
  if (exceptions === undefined) return;
  if (!Array.isArray(exceptions)) {
    errors.push(`${at}.exceptions must be an array`);
    return;
  }
  const known = checkIdsFor(entry);
  const seen = new Set();
  exceptions.forEach((exception, index) => {
    const where = `${at}.exceptions[${index}]`;
    if (!isExactObject(exception, ['check', 'reason', 'source', 'expiresAt'])) {
      errors.push(`${where} must contain check, reason, source, and expiresAt`);
      return;
    }
    if (!known.has(exception.check)) errors.push(`${where}.check does not name a declared check`);
    if (seen.has(exception.check)) errors.push(`${where}.check must be unique`);
    seen.add(exception.check);
    for (const field of ['reason', 'source']) {
      if (typeof exception[field] !== 'string' || exception[field].trim() === '') errors.push(`${where}.${field} must not be blank`);
    }
    if (!isDateOnly(exception.expiresAt)) errors.push(`${where}.expiresAt must be a real YYYY-MM-DD date`);
  });
}

function checkIdsFor(entry) {
  return new Set([
    'status', 'redirect', 'robots.noindex', 'robots.disallow', 'canonical', 'sitemap',
    ...((entry.metadata && entry.metadata.required) || []).map((item) => `metadata:${item}`),
    ...((entry.requiredInternalLinks) || []).map((item) => `link:${item}`)
  ]);
}

function validatePath(value, at, errors) {
  if (typeof value !== 'string' || !PATH_PATTERN.test(value)) {
    errors.push(`${at} must be an origin-relative path without whitespace, control characters, or a fragment`);
  }
}

function isDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function rejectExtraKeys(value, allowed, at, errors) {
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) errors.push(`${at}.${key} is not supported`);
  });
}

function isExactObject(value, keys) {
  return isObject(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

module.exports = { checkIdsFor, loadManifest, validateManifest };
