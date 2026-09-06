import assert from 'node:assert/strict';

const baseUrl = 'http://127.0.0.1:3000';
const projectId = `api-preview-${Date.now()}`;
const files = [
  { path: 'package.json', content: JSON.stringify({ name: 'api-preview', private: true, version: '1.0.0', scripts: { dev: 'node server.cjs' } }) },
  { path: 'server.cjs', content: "const http = require('node:http'); const server = http.createServer((req, res) => { if (req.url === '/health') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ healthy: true })); return; } res.statusCode = 404; res.end('Not found'); }); server.listen(Number(process.env.PORT));" },
];

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  assert.equal(response.ok, true, `${response.status}: ${body.error || response.statusText}`);
  return body as T;
}

const started = await json<{ runtime: { state: string } }>(`${baseUrl}/api/runtime/dev/start`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ projectId, files }),
});
assert.equal(started.runtime.state, 'RUNNING');

const preview = await fetch(`${baseUrl}/preview-runtime/${projectId}/`);
assert.equal(preview.status, 200);
assert.match(await preview.text(), /API runtime is running/);

const health = await fetch(`${baseUrl}/preview-runtime/${projectId}/health`);
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), { healthy: true });
console.log('API preview acceptance test passed');
