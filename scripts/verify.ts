import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

type CheckResult = { script: string; command: string; status: 'passed' | 'failed'; exitCode: number; durationMs: number };

const scripts = ['context:check', 'status:check', 'typecheck', 'lint', 'test', 'build'];
if (process.argv.includes('--full')) scripts.push('test:e2e');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run verification through npm so npm_execpath is available.');
const results: CheckResult[] = [];

for (const script of scripts) {
  const started = Date.now();
  const outcome = spawnSync(process.execPath, [npmCli, 'run', script], { cwd: process.cwd(), env: process.env, stdio: 'inherit' });
  const exitCode = outcome.status ?? 1;
  results.push({ script, command: `npm run ${script}`, status: exitCode === 0 ? 'passed' : 'failed', exitCode, durationMs: Date.now() - started });
}

const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: process.cwd(), encoding: 'utf8' });
const summary = {
  schemaVersion: 1,
  commit: git.status === 0 ? git.stdout.trim() : null,
  startedAt: new Date(Date.now() - results.reduce((total, item) => total + item.durationMs, 0)).toISOString(),
  completedAt: new Date().toISOString(),
  status: results.every((item) => item.status === 'passed') ? 'passed' : 'failed',
  checks: results,
};
const output = path.join(process.cwd(), 'test-results', 'verification-summary.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
process.stdout.write(`Verification summary: ${path.relative(process.cwd(), output)}\n`);
if (summary.status === 'failed') process.exitCode = 1;
