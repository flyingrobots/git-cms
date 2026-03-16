#!/usr/bin/env node

import { spawn } from 'node:child_process';

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('Usage: node scripts/run-node-with-disabled-warning.mjs <command> [args...]');
  process.exit(1);
}

const disabledWarning = '--disable-warning=DEP0169';
const existingNodeOptions = process.env.NODE_OPTIONS?.trim() || '';
const nextNodeOptions = existingNodeOptions.includes(disabledWarning)
  ? existingNodeOptions
  : [existingNodeOptions, disabledWarning].filter(Boolean).join(' ');

const env = {
  ...process.env,
  NODE_OPTIONS: nextNodeOptions,
};

// Some runners add FORCE_COLOR in child processes; drop NO_COLOR up front so it
// cannot combine later into a startup warning.
if ('NO_COLOR' in env) {
  delete env.NO_COLOR;
}

const child = spawn(command, args, {
  stdio: 'inherit',
  env,
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
