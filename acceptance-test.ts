import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SERVER_URL = 'http://127.0.0.1:3000';

async function request<T = any>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = payload && typeof payload === 'object' && 'error' in payload ? payload.error : text || response.statusText;
    throw new Error(`${response.status} ${error}`);
  }
  return payload as T;
}

async function waitForTerminalSession(projectId: string, sessionId: string) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const data = await request<{ sessions: Array<{ id: string; status: string; exitCode?: number | null }> }>(`${SERVER_URL}/api/terminal/sessions/${encodeURIComponent(projectId)}`);
    const session = data.sessions.find((candidate) => candidate.id === sessionId);
    if (session && session.status !== 'running') return session;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for terminal session ${sessionId}.`);
}

const projectId = `preview-${Date.now()}`;
const files = [
  { path: 'package.json', content: JSON.stringify({ name: 'builder-board-preview-check', private: true, version: '1.0.0', type: 'module', scripts: { dev: 'vite --host 127.0.0.1 --port 4173 --strictPort', build: 'vite build', preview: 'vite preview --host 127.0.0.1 --port 4173 --strictPort' }, dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' }, devDependencies: { '@vitejs/plugin-react': '^5.0.0', vite: '^6.0.0' } }, null, 2) },
  { path: 'vite.config.ts', content: "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({ plugins: [react()] });\n" },
  { path: 'index.html', content: '<!doctype html><html><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Preview Test</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>' },
  { path: 'src/main.tsx', content: "import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport './index.css';\nimport App from './App';\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n);\n" },
  { path: 'src/App.tsx', content: "export default function App() { return <div>BUILDER BOARD PREVIEW IS WORKING</div>; }\n" },
  { path: 'src/index.css', content: 'html, body { margin: 0; font-family: sans-serif; background: #020617; color: #f8fafc; } body { display: grid; place-items: center; min-height: 100vh; }\n' },
];

async function verify404ReadinessFailure(): Promise<void> {
  const failedProjectId = `preview-404-${Date.now()}`;
  const failedFiles = [
    { path: 'package.json', content: JSON.stringify({ name: 'preview-404-check', private: true, version: '1.0.0', scripts: { dev: 'node server.js' } }, null, 2) },
    { path: 'server.js', content: "const http = require('http');\nconst port = Number(process.env.PORT || 4173);\nhttp.createServer((req, res) => { res.statusCode = 404; res.end('Cannot GET /'); }).listen(port, '127.0.0.1', () => console.log('404 server ready'));\n" },
  ];

  const response = await fetch(`${SERVER_URL}/api/runtime/dev/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: failedProjectId, files: failedFiles }),
  });
  const data = await response.json();

  assert.equal(response.status, 502, '404 readiness should fail the runtime start');
  assert.equal(data.success, false, 'failed runtime should reject the start call');
  assert.match(String(data.error || ''), /HTTP readiness check failed|404|Cannot GET \/|FAILED/i, '404 readiness error should explain why the app is not ready');
}

async function verifyManualPreviewFlow(): Promise<void> {
  const flowProjectId = `preview-manual-${Date.now()}`;
  const flowFiles = [
    { path: 'package.json', content: JSON.stringify({ name: 'manual-preview-flow', private: true, version: '1.0.0', type: 'module', scripts: { dev: 'vite --host 127.0.0.1 --port 4173 --strictPort', build: 'vite build', preview: 'vite preview --host 127.0.0.1 --port 4173 --strictPort' }, dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' }, devDependencies: { '@vitejs/plugin-react': '^5.0.0', vite: '^6.0.0' } }, null, 2) },
    { path: 'vite.config.ts', content: "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });\n" },
    { path: 'index.html', content: '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>' },
    { path: 'src/main.tsx', content: "import React from 'react';\nimport ReactDOM from 'react-dom/client';\nReactDOM.createRoot(document.getElementById('root')!).render(<div>MANUAL FLOW OK</div>);\n" },
  ];

  const prepared = await request<{ success: boolean; workspace: string }>(`${SERVER_URL}/api/runtime/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: flowProjectId, files: flowFiles }),
  });
  assert.equal(prepared.success, true, 'manual preview prepare step should succeed');
  assert.ok(prepared.workspace, 'prepare should return the generated workspace');

  const generatedNodeModules = path.join(prepared.workspace, 'node_modules');
  if (fs.existsSync(generatedNodeModules)) {
    const stats = fs.lstatSync(generatedNodeModules);
    assert.equal(stats.isSymbolicLink(), false, 'generated workspace must not symlink to host node_modules before install');
  }

  const installResponse = await request<{ success: boolean; session?: { id: string } }>(`${SERVER_URL}/api/runtime/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: flowProjectId, files: flowFiles }),
  });
  assert.equal(installResponse.success, true, 'manual preview install step should succeed');
  assert.ok(installResponse.session?.id, 'install response should include a session');
  const installResult = await waitForTerminalSession(flowProjectId, installResponse.session!.id);
  assert.equal(installResult.status, 'completed', 'dependency install should finish successfully');
  assert.equal(installResult.exitCode, 0, 'dependency install should exit 0');

  const start = await request<{ success: boolean; runtime?: { state: string; port?: number; previewUrl?: string } }>(`${SERVER_URL}/api/runtime/dev/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: flowProjectId, files: flowFiles }),
  });
  assert.equal(start.success, true, 'manual preview dev start should succeed after install');
  assert.equal(start.runtime?.state, 'RUNNING', 'manual preview runtime should reach RUNNING');

  const preview = await fetch(`${SERVER_URL}/api/runtime/preview/${flowProjectId}/`);
  assert.equal(preview.status, 200, 'manual preview should render the project after full flow');
  const html = await preview.text();
  assert.match(html, /MANUAL FLOW OK|<div id="root">/i, 'manual preview should return the generated app HTML');
}

async function verifyNodeRuntimePortIsolation(): Promise<void> {
  const projectId = `preview-port-isolation-${Date.now()}`;
  const files = [
    { path: 'package.json', content: JSON.stringify({ name: 'preview-port-isolation', private: true, version: '1.0.0', type: 'module', scripts: { dev: 'node server.js' }, dependencies: { express: '^4.21.2' } }, null, 2) },
    { path: 'server.js', content: "import http from 'node:http';\nconst port = Number(process.env.PORT || 3000);\nconst server = http.createServer((req, res) => { res.statusCode = 200; res.end(`PORT=${port}`); });\nserver.listen(port, '127.0.0.1', () => console.log(`ready:${port}`));\n" },
  ];

  const start = await request<{ success: boolean; runtime?: { state: string; port?: number; previewUrl?: string } }>(`${SERVER_URL}/api/runtime/dev/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, files, port: 4173 }),
  });

  assert.equal(start.success, true, 'node runtime should start with its own allocated preview port');
  assert.equal(start.runtime?.state, 'RUNNING', 'node runtime should become RUNNING');
  assert.notEqual(start.runtime?.port, 3000, 'node runtime should not reuse the Builder Board port');

  const preview = await fetch(`${SERVER_URL}/api/runtime/preview/${projectId}/`);
  assert.equal(preview.status, 200, 'generated preview should resolve over the project-scoped proxy');
  const text = await preview.text();
  assert.match(text, /PORT=4\d{3}/, 'preview content should originate from the runtime port assigned via PORT env');
}

async function verifyNoHostNodeModulesSymlink(): Promise<void> {
  const projectId = `preview-no-symlink-${Date.now()}`;
  const files = [
    { path: 'package.json', content: JSON.stringify({ name: 'no-symlink-check', private: true, version: '1.0.0', type: 'module', scripts: { dev: 'vite --host 127.0.0.1 --port 4173 --strictPort', build: 'vite build' }, devDependencies: { vite: '^6.0.0' } }, null, 2) },
    { path: 'index.html', content: '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>' },
    { path: 'src/main.tsx', content: "document.getElementById('root')!.textContent = 'NO SYMLINK';\n" },
  ];

  const prepared = await request<{ success: boolean; workspace: string }>(`${SERVER_URL}/api/runtime/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, files }),
  });
  assert.equal(prepared.success, true, 'workspace preparation should succeed');

  const generatedNodeModules = path.join(prepared.workspace, 'node_modules');
  if (fs.existsSync(generatedNodeModules)) {
    const stats = fs.lstatSync(generatedNodeModules);
    assert.equal(stats.isSymbolicLink(), false, 'generated workspace node_modules must not be a symlink pointing at host dependencies');
  }
}

async function verifyPreviewRestartLifecycle(): Promise<void> {
  const restartProjectId = `preview-restart-${Date.now()}`;
  const restartFiles = [
    { path: 'package.json', content: JSON.stringify({ name: 'preview-restart-check', private: true, version: '1.0.0', type: 'module', scripts: { dev: 'vite --host 127.0.0.1 --port 4173 --strictPort', build: 'vite build' }, dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' }, devDependencies: { '@vitejs/plugin-react': '^5.0.0', vite: '^6.0.0' } }, null, 2) },
    { path: 'vite.config.ts', content: "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });\n" },
    { path: 'index.html', content: '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>' },
    { path: 'src/main.tsx', content: "import React from 'react';\nimport ReactDOM from 'react-dom/client';\nReactDOM.createRoot(document.getElementById('root')!).render(<div>RESTART OK</div>);\n" },
  ];

  const initial = await request<{ success: boolean; runtime?: { state: string } }>(`${SERVER_URL}/api/runtime/dev/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: restartProjectId, files: restartFiles }),
  });
  assert.equal(initial.success, true, 'runtime should start cleanly for the restart lifecycle test');
  assert.equal(initial.runtime?.state, 'RUNNING', 'runtime should be RUNNING initially');

  const stop = await request<{ success: boolean }>(`${SERVER_URL}/api/runtime/dev/stop/${restartProjectId}`, { method: 'POST' });
  assert.equal(stop.success, true, 'restart lifecycle should stop the running runtime');

  const statusAfterStop = await request<{ runtime: { state: string } | null }>(`${SERVER_URL}/api/runtime/dev/status/${restartProjectId}`);
  assert.equal(statusAfterStop.runtime, null, 'status should report no running dev server after stop');

  const restarted = await request<{ success: boolean; runtime?: { state: string } }>(`${SERVER_URL}/api/runtime/dev/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: restartProjectId, files: restartFiles }),
  });
  assert.equal(restarted.success, true, 'runtime should restart after the stop lifecycle');
  assert.equal(restarted.runtime?.state, 'RUNNING', 'runtime should be RUNNING again after restart');
}

export async function verifyBuilderBoard(): Promise<string> {
  await verify404ReadinessFailure();
  await verifyManualPreviewFlow();
  await verifyNodeRuntimePortIsolation();
  await verifyNoHostNodeModulesSymlink();
  await verifyPreviewRestartLifecycle();

  const start = await request<{ success: boolean; runtime?: { state: string; port?: number; previewUrl?: string } }>(`${SERVER_URL}/api/runtime/dev/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, files }),
  });

  assert.equal(start.success, true, 'runtime should start successfully');
  assert.equal(start.runtime?.state, 'RUNNING', 'runtime should be RUNNING');
  assert.ok(start.runtime?.port, 'runtime should expose a direct port');

  const directPreviewUrl = `http://127.0.0.1:${start.runtime!.port}/`;
  assert.equal(start.runtime?.previewUrl, directPreviewUrl, 'runtime previewUrl should point directly at the assigned runtime port');

  const legacyPreviewRedirect = await fetch(`${SERVER_URL}/api/runtime/preview/${projectId}/`);
  assert.equal(legacyPreviewRedirect.redirected, true, 'legacy preview route should redirect to the direct runtime URL');
  assert.equal(legacyPreviewRedirect.url, directPreviewUrl, 'legacy preview route should expose the direct runtime origin');

  const status = await request<{ runtime: { state: string } | null }>(`${SERVER_URL}/api/runtime/dev/status/${projectId}`);
  assert.equal(status.runtime?.state, 'RUNNING', 'status endpoint should match running runtime');

  const previewHtml = await fetch(directPreviewUrl);
  assert.equal(previewHtml.status, 200, 'direct runtime preview should be reachable');
  const htmlText = await previewHtml.text();
  assert.match(htmlText, /BUILDER BOARD PREVIEW IS WORKING|<script type="module" src="\/src\/main.tsx">/i, 'preview HTML should be served directly by the runtime');

  const previewRoot = await fetch(directPreviewUrl);
  assert.equal(previewRoot.status, 200, 'preview project root should resolve on the direct runtime URL');
  const previewRootText = await previewRoot.text();
  assert.match(previewRootText, /BUILDER BOARD PREVIEW IS WORKING|<script type="module" src="\/src\/main.tsx">/i, 'preview root should render the generated app from the runtime origin');

  const clientResponse = await fetch(new URL('/@vite/client', directPreviewUrl));
  assert.equal(clientResponse.status, 200, '@vite client should load');
  assert.match(clientResponse.headers.get('content-type') || '', /javascript|text\/plain/i, 'Vite client should be served as JavaScript');

  const mainResponse = await fetch(new URL('/src/main.tsx', directPreviewUrl));
  assert.equal(mainResponse.status, 200, 'main module should load');
  assert.match(mainResponse.headers.get('content-type') || '', /javascript|text\/plain/i, 'module should use JavaScript MIME type');
  const mainText = await mainResponse.text();
  assert.match(mainText, /BUILDER BOARD PREVIEW IS WORKING|ReactDOM\.createRoot/i, 'module content should include the generated app source');

  const stop = await request<{ success: boolean }>(`${SERVER_URL}/api/runtime/dev/stop/${projectId}`, { method: 'POST' });
  assert.equal(stop.success, true, 'runtime should stop successfully');

  const stopped = await request<{ runtime: { state: string } | null }>(`${SERVER_URL}/api/runtime/dev/status/${projectId}`);
  assert.equal(stopped.runtime, null, 'status should be truthful after stop');

  const restarted = await request<{ success: boolean; runtime?: { state: string } }>(`${SERVER_URL}/api/runtime/dev/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, files }),
  });
  assert.equal(restarted.success, true, 'runtime should restart cleanly');
  assert.equal(restarted.runtime?.state, 'RUNNING', 'runtime should be RUNNING after restart');

  return 'Builder Board preview acceptance test passed';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifyBuilderBoard()
    .then((result) => {
      console.log(result);
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
