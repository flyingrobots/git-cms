import { spawnSync } from 'node:child_process';
import readline from 'node:readline';

const MAC_ACCOUNT = 'git-cms';

export function isMac() {
  return process.platform === 'darwin';
}

export function isLinux() {
  return process.platform === 'linux';
}

export function isWindows() {
  return process.platform === 'win32';
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  return result;
}

function trimResult(result) {
  if (result.status !== 0) return undefined;
  if (typeof result.stdout !== 'string') return undefined;
  return result.stdout.trim();
}

function getMacSecret(target) {
  const result = run('security', ['find-generic-password', '-a', MAC_ACCOUNT, '-s', target, '-w'], { stdio: ['ignore', 'pipe', 'ignore'] });
  return trimResult(result);
}

function setMacSecret(target, value) {
  run('security', ['delete-generic-password', '-a', MAC_ACCOUNT, '-s', target], { stdio: 'ignore' });
  const add = run(
    'security',
    ['add-generic-password', '-a', MAC_ACCOUNT, '-s', target, '-w', value, '-U'],
    {
      stdio: 'ignore',
    }
  );
  if (add.status !== 0) {
    throw new Error(`Failed to store secret for ${target}`);
  }
}

function deleteMacSecret(target) {
  const result = run('security', ['delete-generic-password', '-a', MAC_ACCOUNT, '-s', target], {
    stdio: 'ignore',
  });
  return result.status === 0;
}

function getLinuxSecret(target) {
  const result = run('secret-tool', ['lookup', 'service', target]);
  return trimResult(result);
}

function setLinuxSecret(target, value) {
  const result = run('secret-tool', ['store', '--label', target, 'service', target], {
    input: value,
    encoding: 'utf8',
    stdio: ['pipe', 'ignore', 'inherit'],
  });
  if (result.status !== 0) {
    throw new Error(`Failed to store secret for ${target}`);
  }
}

function deleteLinuxSecret(target) {
  const result = run('secret-tool', ['clear', 'service', target], { stdio: 'ignore' });
  return result.status === 0;
}

function psLiteral(value) {
  return "'" + value.replace(/'/g, "''") + "'";
}

function runPowershell(script) {
  const result = run('powershell', ['-NoProfile', '-Command', script]);
  return result;
}

function getWindowsSecret(target) {
  const script = `try {
  if (Get-Module -ListAvailable -Name CredentialManager) {
    Import-Module CredentialManager -ErrorAction Stop
    $c = Get-StoredCredential -Target ${psLiteral(target)}
    if ($c -and $c.Password) { Write-Output $c.Password }
  }
} catch { }`;
  const result = runPowershell(script);
  return trimResult(result);
}

function setWindowsSecret(target, value) {
  const script = `try {
  if (!(Get-Module -ListAvailable -Name CredentialManager)) {
    Install-Module -Name CredentialManager -Scope CurrentUser -Force -ErrorAction Stop
  }
  Import-Module CredentialManager -ErrorAction Stop
  $pwd = ${psLiteral(value)}
  New-StoredCredential -Target ${psLiteral(target)} -UserName '${MAC_ACCOUNT}' -Password $pwd -Persist CurrentUser | Out-Null
  exit 0
} catch {
  Write-Error $_ 
  exit 1
}`;
  const result = runPowershell(script);
  if (result.status !== 0) {
    throw new Error(`Failed to store secret for ${target}`);
  }
}

function deleteWindowsSecret(target) {
  const script = `try {
  if (Get-Module -ListAvailable -Name CredentialManager) {
    Import-Module CredentialManager -ErrorAction Stop
    Remove-StoredCredential -Target ${psLiteral(target)} -ErrorAction SilentlyContinue | Out-Null
  }
  exit 0
} catch { exit 1 }`;
  const result = runPowershell(script);
  return result.status === 0;
}

export function getSecret(target) {
  if (!target) throw new Error('target is required');
  if (isMac()) return getMacSecret(target);
  if (isLinux()) return getLinuxSecret(target);
  if (isWindows()) return getWindowsSecret(target);
  throw new Error('Secrets keeper is only supported on macOS, Linux, or Windows');
}

export function setSecret(target, value) {
  if (!target) throw new Error('target is required');
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('value must be a non-empty string');
  }
  if (isMac()) return setMacSecret(target, value);
  if (isLinux()) return setLinuxSecret(target, value);
  if (isWindows()) return setWindowsSecret(target, value);
  throw new Error('Secrets keeper is only supported on macOS, Linux, or Windows');
}

export function deleteSecret(target) {
  if (!target) throw new Error('target is required');
  if (isMac()) return deleteMacSecret(target);
  if (isLinux()) return deleteLinuxSecret(target);
  if (isWindows()) return deleteWindowsSecret(target);
  throw new Error('Secrets keeper is only supported on macOS, Linux, or Windows');
}

function promptHidden(prompt) {
  if (!process.stdin.isTTY) {
    throw new Error('Cannot prompt for secrets without a TTY');
  }
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: true,
    });
    rl.stdoutMuted = true;
    const question = `${prompt}: `;
    rl._writeToOutput = function writeToOutput(stringToWrite) {
      if (rl.stdoutMuted) {
        rl.output.write('*');
      } else {
        rl.output.write(stringToWrite);
      }
    };
    rl.on('SIGINT', () => {
      rl.stdoutMuted = false;
      rl.close();
      process.stderr.write('\n');
      process.exit(1);
    });
    rl.question(question, (answer) => {
      rl.stdoutMuted = false;
      rl.close();
      process.stderr.write('\n');
      resolve(answer.trim());
    });
  });
}

export async function ensureSecret(target, { prompt, quiet = false } = {}) {
  if (!target) throw new Error('target is required');
  let value = getSecret(target);
  if (value) {
    return value;
  }
  if (!prompt) {
    throw new Error(`Secret ${target} is missing and no prompt was provided to set it`);
  }
  while (!value) {
    const input = await promptHidden(prompt);
    if (!input) {
      console.error('Value cannot be empty. Press Ctrl+C to abort.');
      continue;
    }
    setSecret(target, input);
    value = input;
  }
  if (!quiet) {
    return value;
  }
  return value;
}

export function resolveSecret(envKey, envName, suffix) {
  // Try env var first
  if (process.env[envKey]) return process.env[envKey];
  // Then keychain
  try {
    return getSecret(`git-cms-${envName}-${suffix}`);
  } catch {
    return null;
  }
}
