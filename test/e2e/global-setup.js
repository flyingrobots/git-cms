import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

function run(args, cwd) {
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'ignore' });
}

export default async function globalSetup() {
  const repoPath = path.resolve(process.cwd(), 'test-repo');
  
  // Clean start
  rmSync(repoPath, { recursive: true, force: true });
  mkdirSync(repoPath);
  
  // Init git
  run(['init'], repoPath);
  run(['config', 'user.name', 'E2E Bot'], repoPath);
  run(['config', 'user.email', 'e2e@example.com'], repoPath);
  
  console.log('[E2E] Initialized test-repo at', repoPath);
}
