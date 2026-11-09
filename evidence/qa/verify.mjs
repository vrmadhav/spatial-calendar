import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { platform, release } from 'node:os';

const output = 'evidence/qa';
mkdirSync(output, { recursive: true });
const excluded = new Set(['.git', 'node_modules', 'dist', 'evidence', 'test-results', 'playwright-report']);
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (excluded.has(entry.name)) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
const reportingFiles = new Set(['docs/qa-report.md', 'docs/release-readiness.md', 'docs/implementation-plan.md']);
const manifest = files('.').filter((path) => !reportingFiles.has(path)).sort().map((path) => `${createHash('sha256').update(readFileSync(path)).digest('hex')}  ${path}`).join('\n');
writeFileSync(`${output}/source-sha256.txt`, `${manifest}\n`);
const snapshot = createHash('sha256').update(manifest).digest('hex');
const metadata = { cwd: process.cwd(), date: new Date().toISOString(), node: process.version, os: `${platform()} ${release()}`, baseRevision: spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(), snapshot, checks: [] };
for (const [name, args] of [['lint', ['run', 'lint']], ['typecheck', ['run', 'typecheck']], ['test', ['test']], ['build', ['run', 'build']], ['e2e', ['run', 'test:e2e']]]) {
  console.log(`Running ${name}…`);
  const result = spawnSync('npm', args, { encoding: 'utf8', timeout: 240000, maxBuffer: 10 * 1024 * 1024 });
  writeFileSync(`${output}/${name}.log`, `$ npm ${args.join(' ')}\ncwd: ${process.cwd()}\nsnapshot: ${snapshot}\n${result.stdout ?? ''}${result.stderr ?? ''}\nexit: ${result.status}\n${result.error ?? ''}\n`);
  metadata.checks.push({ name, command: `npm ${args.join(' ')}`, exit: result.status, signal: result.signal });
  console.log(`${name}: ${result.status === 0 ? 'PASS' : 'FAIL'}`);
}
writeFileSync(`${output}/results.json`, `${JSON.stringify(metadata, null, 2)}\n`);
process.exitCode = metadata.checks.every((check) => check.exit === 0) ? 0 : 1;
