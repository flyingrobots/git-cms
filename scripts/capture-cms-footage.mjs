import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.resolve(root, process.env.MEDIA_OUT_DIR || 'docs/media/generated/git-cms');
const resultsDir = path.resolve(root, 'test-results/media');
const mediaProject = process.env.MEDIA_PROJECT || 'git-cms-media';
async function findOpenPort(start = 47639) {
  for (let port = start; port < start + 50; port += 1) {
    const isOpen = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, '127.0.0.1');
    });
    if (isOpen) return String(port);
  }
  throw new Error(`Could not find an open media port starting at ${start}`);
}

const mediaPort = process.env.MEDIA_PORT || await findOpenPort();

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = walk(full);
      if (nested) return nested;
      continue;
    }
    if (entry.isFile() && entry.name === 'video.webm') {
      return full;
    }
  }
  return null;
}

rmSync(resultsDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

spawnSync('docker', ['compose', '-p', mediaProject, 'down', '-v', '--remove-orphans'], {
  cwd: root,
  stdio: 'ignore',
});

const env = {
  ...process.env,
  MEDIA_OUT_DIR: outDir,
  MEDIA_PORT: mediaPort,
  MEDIA_PROJECT: mediaProject,
};
delete env.NO_COLOR;

const args = [
  path.join(root, 'node_modules/@playwright/test/cli.js'),
  'test',
  '--config',
  'playwright.media.config.js',
];

const result = spawnSync(process.execPath, args, {
  cwd: root,
  env,
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (!existsSync(resultsDir)) {
  console.error(`Expected Playwright output directory at ${resultsDir}`);
  process.exit(1);
}

const videoPath = walk(resultsDir);
if (!videoPath) {
  console.error(`Could not find recorded video under ${resultsDir}`);
  process.exit(1);
}

const finalVideoPath = path.join(outDir, 'git-cms-walkthrough.webm');
copyFileSync(videoPath, finalVideoPath);

console.log(`Saved browser footage to ${finalVideoPath}`);
console.log(`Saved poster image to ${path.join(outDir, 'git-cms-poster.png')}`);
