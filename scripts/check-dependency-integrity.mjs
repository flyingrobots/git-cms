#!/usr/bin/env node

import fs from 'node:fs';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function checkPackageJson(packageJson) {
  const dependencySections = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ];

  /** @type {string[]} */
  const errors = [];

  for (const section of dependencySections) {
    const deps = packageJson[section] || {};
    for (const [name, spec] of Object.entries(deps)) {
      if (typeof spec !== 'string') {
        continue;
      }

      if (spec.startsWith('file:') || spec.startsWith('link:') || spec.startsWith('workspace:')) {
        errors.push(`package.json ${section}.${name} uses disallowed local spec "${spec}"`);
      }
    }
  }

  return errors;
}

function checkPackageLock(lockJson) {
  /** @type {string[]} */
  const errors = [];

  const packages = lockJson.packages || {};
  for (const [key, value] of Object.entries(packages)) {
    if (key.startsWith('../') || key.includes('/../')) {
      errors.push(`package-lock.json contains local package key "${key}"`);
    }

    if (!value || typeof value !== 'object') {
      continue;
    }

    if (value.link === true) {
      errors.push(`package-lock.json package "${key}" uses link=true`);
    }

    if (typeof value.resolved === 'string') {
      if (value.resolved.startsWith('../') || value.resolved.startsWith('file:') || value.resolved.startsWith('link:')) {
        errors.push(`package-lock.json package "${key}" resolved to local path "${value.resolved}"`);
      }
    }
  }

  return errors;
}

function main() {
  const packageJson = readJson('package.json');
  const lockJson = readJson('package-lock.json');

  const errors = [
    ...checkPackageJson(packageJson),
    ...checkPackageLock(lockJson),
  ];

  if (errors.length > 0) {
    console.error('Dependency integrity check failed:');
    for (const err of errors) {
      console.error(`- ${err}`);
    }
    process.exit(1);
  }

  console.log('Dependency integrity check passed.');
}

main();
