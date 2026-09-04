import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const baseUrl = 'http://127.0.0.1:3000';
const projectId = `production-preview-${Date.now()}`;
const files = [
  { path: 'package.json', content: JSON.stringify({ name: 'production-preview', private: true, version: '1.0.0', type: 'module', scripts: { dev: 'vite --host 127.0.0.1 --port 4173 --strictPort' }, devDependencies: { vite: '^6.0.0', tsx: '^4.21.0', typescript: '^5.8.2' } }) },
  { path: 'index.html', content: '<!doctype html><html><body><h1>PRODUCTION PREVIEW OK</h1></body></html>' },
];

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  assert.equal(response.ok, true, `${response.status}: ${body.error || response.statusText}`);
  return body as T;
}

const prepared = await json<{ workspace: string }>(`${baseUrl}/api/runtime/prepare`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, files }) });
const install = await json<{ command: string; session: { id: string } }>(`${baseUrl}/api/runtime/install`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, files }) });
assert.equal(install.command, 'npm install --include=dev');
assert.equal(install.session.id.length > 0, true);
assert.ok(fs.existsSync(path.join(prepared.workspace, 'node_modules', 'vite', 'package.json')));
assert.ok(fs.existsSync(path.join(prepared.workspace, 'node_modules', 'tsx', 'package.json')));
assert.ok(fs.existsSync(path.join(prepared.workspace, 'node_modules', 'typescript', 'package.json')));
const started = await json<{ runtime: { state: string } }>(`${baseUrl}/api/runtime/dev/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, files }) });
assert.equal(started.runtime.state, 'RUNNING');
const preview = await fetch(`${baseUrl}/api/runtime/preview/${projectId}/`);
assert.equal(preview.status, 200);
assert.match(await preview.text(), /PRODUCTION PREVIEW OK/);
await fetch(`${baseUrl}/api/runtime/dev/stop/${projectId}`, { method: 'POST' });
console.log('Production preview devDependency acceptance test passed');
