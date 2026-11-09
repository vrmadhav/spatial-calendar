import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { writeFileSync } from 'node:fs';
const base = 'http://127.0.0.1:3002';
let child;
let output = '';
async function start() {
  child = spawn(process.execPath, ['dist/server/server/index.js'], { env: { ...process.env, PORT: '3002' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  for (let i = 0; i < 100; i++) {
    assert.equal(child.exitCode, null, 'isolated server must stay running');
    try { if ((await fetch(`${base}/api/v1/health`)).ok) return; } catch { /* Wait for own process */ }
    await delay(50);
  }
  throw new Error('isolated server did not become healthy');
}
async function stop() {
  if (child && child.exitCode === null) {
    const ended = once(child, 'exit'); child.kill('SIGTERM'); await ended;
  }
}
async function snapshot() {
  const response = await fetch(`${base}/api/v1/households/household-rivera/snapshot`, { headers: { 'X-Demo-User': 'demo-alex' } });
  assert.equal(response.status, 200); return response.json();
}
try {
  try { await fetch(`${base}/api/v1/health`); throw new Error('Port 3002 already in use; refusing to touch it'); }
  catch (error) { if (error.message.includes('already in use')) throw error; }
  await start();
  const before = await snapshot();
  assert.equal(before.accounts.length, 2);
  assert.ok(before.sources.every(source => source.selected));
  const source = before.sources.find(source => before.events.some(event => event.sourceId === source.id));
  assert.ok(source);
  const response = await fetch(`${base}/api/v1/households/household-rivera/sources/${source.id}`, {
    method: 'PATCH', headers: { 'X-Demo-User': 'demo-alex', 'Content-Type': 'application/json' }, body: JSON.stringify({ selected: false }),
  });
  assert.equal(response.status, 200);
  const changed = await snapshot();
  assert.equal(changed.sources.find(item => item.id === source.id).selected, false);
  assert.equal(changed.events.some(event => event.sourceId === source.id), false);
  assert.equal((await snapshot()).sources.find(item => item.id === source.id).selected, false);
  await stop(); await start();
  const restarted = await snapshot();
  assert.equal(restarted.accounts.length, 2);
  assert.ok(restarted.sources.every(item => item.selected));
  assert.deepEqual(restarted.events.map(event => event.id).sort(), before.events.map(event => event.id).sort());
  console.log(JSON.stringify({ result: 'PASS', checks: ['fresh seed has two accounts and selected sources', 'selection mutation persists across reads', 'source events filtered', 'process stop and restart restores seed selection and event IDs'], sourceId: source.id, initialEvents: before.events.length, filteredEvents: changed.events.length, restoredEvents: restarted.events.length }, null, 2));
} finally {
  await stop(); writeFileSync('evidence/qa/restart-server.log', output);
}
