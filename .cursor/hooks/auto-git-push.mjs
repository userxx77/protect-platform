/**
 * Cursor hook: afterAgentResponse
 * - If the repo has uncommitted changes: git add -A, commit, push current branch.
 * - Opt out: create empty file `.cursor/no-autopush` or set env CURSOR_AUTO_PUSH=0
 * - Requires: git + non-interactive credentials for `git push` (HTTPS token or SSH agent).
 */
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const optOutFile = path.join(repoRoot, '.cursor', 'no-autopush');

function run(cmd, opts = {}) {
  return execSync(cmd, {
    encoding: 'utf8',
    cwd: repoRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
    ...opts,
  });
}

function printVpsHints() {
  const branch = run('git rev-parse --abbrev-ref HEAD').trim();
  console.error('\n--- VPS (na push) ---');
  console.error(`Branch: ${branch}`);
  console.error('SSH op de server, in de projectmap:');
  console.error('  git fetch origin && git checkout ' + branch + ' && git pull origin ' + branch);
  console.error('  docker compose up -d --build');
  console.error('  docker compose logs migrate --tail 40   # migraties');
  console.error('  curl -sS https://dashboard.sentra.gg/api/ready | head -c 800');
  console.error('Zie ook: scripts/vps-update.sh');
  console.error('----------------------\n');
}

function main() {
  if (process.env.CURSOR_AUTO_PUSH === '0' || process.env.CURSOR_AUTO_PUSH === 'false') {
    return;
  }
  if (fs.existsSync(optOutFile)) {
    return;
  }

  let status;
  try {
    status = run('git status --porcelain');
  } catch {
    return;
  }

  if (!status.trim()) {
    return;
  }

  try {
    run('git add -A');
    const msg = `chore(auto): cursor sync ${new Date().toISOString()}`;
    try {
      run(`git commit -m ${JSON.stringify(msg)}`);
    } catch {
      // nothing to commit after add (e.g. all ignored) or hook blocked
    }
    run('git push -u origin HEAD');
    printVpsHints();
  } catch (e) {
    console.error('[auto-git-push]', e && e.message ? e.message : e);
  }
}

try {
  main();
} finally {
  // Command hooks may expect JSON on stdout
  process.stdout.write('{}\n');
}
