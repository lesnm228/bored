import assert from 'node:assert/strict';
import { initialProjects } from './src/data/initialData';

const baseUrl = 'http://127.0.0.1:3000';
const source = initialProjects.find((project) => project.id === 'proj-eagle-engine');
assert.ok(source, 'Eagle Engine fixture must exist');
const projectId = `real-tests-${Date.now()}`;

const commandResponse = await fetch(`${baseUrl}/api/runtime/command`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ projectId, files: source.files, script: 'test' }),
});
const commandBody = await commandResponse.json();
assert.equal(commandResponse.ok, true, commandBody.error || 'Runtime command request failed');
assert.ok(commandBody.session?.id, 'Runtime command must return a session');

let terminalSession;
for (let attempt = 0; attempt < 240; attempt += 1) {
  const response = await fetch(`${baseUrl}/api/terminal/sessions/${projectId}`);
  const body = await response.json();
  terminalSession = body.sessions?.find((session: { id: string }) => session.id === commandBody.session.id);
  if (terminalSession && terminalSession.status !== 'running') break;
  await new Promise((resolve) => setTimeout(resolve, 250));
}

assert.equal(terminalSession?.status, 'completed');
assert.equal(terminalSession?.exitCode, 0);
const output = terminalSession.events.map((event: { text: string }) => event.text).join('\n');
assert.match(output, /4 passed/i);
console.log('Real Eagle Engine Vitest acceptance test passed');
