import assert from 'node:assert/strict';

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

const projectId = `preview-${Date.now()}`;
const files = [
  { path: 'package.json', content: JSON.stringify({ name: 'builder-board-preview-check', private: true, version: '1.0.0', type: 'module', scripts: { dev: 'vite --host 127.0.0.1 --port 4173 --strictPort', build: 'vite build', preview: 'vite preview --host 127.0.0.1 --port 4173 --strictPort' }, dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' }, devDependencies: { '@vitejs/plugin-react': '^5.0.0', vite: '^6.0.0' } }, null, 2) },
  { path: 'vite.config.ts', content: "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({ plugins: [react()] });\n" },
  { path: 'index.html', content: '<!doctype html><html><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Preview Test</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>' },
  { path: 'src/main.tsx', content: "import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport './index.css';\nimport App from './App';\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n);\n" },
  { path: 'src/App.tsx', content: "export default function App() { return <div>BUILDER BOARD PREVIEW IS WORKING</div>; }\n" },
  { path: 'src/index.css', content: 'html, body { margin: 0; font-family: sans-serif; background: #020617; color: #f8fafc; } body { display: grid; place-items: center; min-height: 100vh; }\n' },
];

export async function verifyBuilderBoard(): Promise<string> {
  const start = await request<{ success: boolean; runtime?: { state: string; port?: number } }>(`${SERVER_URL}/api/runtime/dev/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, files }),
  });

  assert.equal(start.success, true, 'runtime should start successfully');
  assert.equal(start.runtime?.state, 'RUNNING', 'runtime should be RUNNING');

  const status = await request<{ runtime: { state: string } | null }>(`${SERVER_URL}/api/runtime/dev/status/${projectId}`);
  assert.equal(status.runtime?.state, 'RUNNING', 'status endpoint should match running runtime');

  const previewHtml = await fetch(`${SERVER_URL}/api/runtime/preview/${projectId}/`);
  assert.equal(previewHtml.status, 200, 'preview route should be reachable');
  const htmlText = await previewHtml.text();
  assert.match(htmlText, /BUILDER BOARD PREVIEW IS WORKING|src=\"\/api\/runtime\/preview\//i, 'preview HTML should be served by the project-scoped preview proxy');

  const previewRoot = await fetch(`${SERVER_URL}/api/runtime/preview/${projectId}`);
  assert.equal(previewRoot.status, 200, 'preview project root without trailing slash should resolve to the same project-scoped app');
  const previewRootText = await previewRoot.text();
  assert.match(previewRootText, /BUILDER BOARD PREVIEW IS WORKING|src=\"\/api\/runtime\/preview\//i, 'preview root should render the generated app without falling back to bare \/');

  const clientResponse = await fetch(`${SERVER_URL}/api/runtime/preview/${projectId}/@vite/client`);
  assert.equal(clientResponse.status, 200, '@vite client should load');
  assert.match(clientResponse.headers.get('content-type') || '', /javascript|text\/plain/i, 'Vite client should be served as JavaScript');

  const mainResponse = await fetch(`${SERVER_URL}/api/runtime/preview/${projectId}/src/main.tsx`);
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
