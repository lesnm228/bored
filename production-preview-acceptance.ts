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

const prepared = await json<{ workspace: string }>(`${baseUrl}/api/runtime/prepare`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ projectId, files }),
});
const install = await json<{ command: string; session: { id: string } }>(`${baseUrl}/api/runtime/install`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ projectId, files }),
});
assert.equal(install.command, 'npm install --include=dev --no-audit --no-fund');
for (let attempt = 0; attempt < 120; attempt += 1) {
  const sessions = await json<{ sessions: Array<{ id: string; status: string; exitCode?: number | null }> }>(`${baseUrl}/api/terminal/sessions/${projectId}`);
  const session = sessions.sessions.find((candidate) => candidate.id === install.session.id);
  if (session?.status !== 'running') {
    assert.equal(session?.status, 'completed');
    assert.equal(session?.exitCode, 0);
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
assert.ok(fs.existsSync(path.join(prepared.workspace, 'node_modules', 'vite', 'package.json')));
assert.ok(fs.existsSync(path.join(prepared.workspace, 'node_modules', 'tsx', 'package.json')));
assert.ok(fs.existsSync(path.join(prepared.workspace, 'node_modules', 'typescript', 'package.json')));

const started = await json<{ runtime: { state: string } }>(`${baseUrl}/api/runtime/dev/start`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ projectId, files }),
});
assert.equal(started.runtime.state, 'RUNNING');
const preview = await fetch(`${baseUrl}/api/runtime/preview/${projectId}/`);
assert.equal(preview.status, 200);
assert.match(await preview.text(), /PRODUCTION PREVIEW OK/);
console.log('Production preview devDependency acceptance test passed');

const apiProjectId = `production-api-preview-${Date.now()}`;
const apiFiles = [
  { path: 'package.json', content: JSON.stringify({ name: 'production-api-preview', private: true, version: '1.0.0', scripts: { dev: 'node server.cjs' } }) },
  { path: 'server.cjs', content: "const http = require('node:http'); const server = http.createServer((req, res) => { if (req.url === '/health') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ healthy: true })); return; } res.statusCode = 404; res.end('Not found'); }); server.listen(Number(process.env.PORT));" },
];

const apiStarted = await json<{ runtime: { state: string } }>(`${baseUrl}/api/runtime/dev/start`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ projectId: apiProjectId, files: apiFiles }),
});
assert.equal(apiStarted.runtime.state, 'RUNNING');

const apiPreview = await fetch(`${baseUrl}/preview-runtime/${apiProjectId}/`);
assert.equal(apiPreview.status, 200);
assert.match(await apiPreview.text(), /API runtime is running/);

const apiHealth = await fetch(`${baseUrl}/preview-runtime/${apiProjectId}/health`);
assert.equal(apiHealth.status, 200);
assert.deepEqual(await apiHealth.json(), { healthy: true });
console.log('Production API preview acceptance test passed');
