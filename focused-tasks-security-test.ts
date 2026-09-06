import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TaskItem } from './src/types';
import { taskStatusAfterPipeline, updateAuthoritativeTask } from './src/services/taskExecutionPolicy';
import { TerminalService } from './src/services/terminalService';
import { resolveWorkspacePath } from './src/services/workspacePathSecurity';

const task: TaskItem = {
  id: 'clicked-task-42', title: 'Clicked task', description: 'test', status: 'planning',
  priority: 'high', assignedTo: 'user', createdAt: Date.now(), subtasks: [],
};

function testTaskIdLinkage(): void {
  const updated = updateAuthoritativeTask([task], task.id, {
    status: 'working',
    subtasks: [{ id: 'clicked-task-42-sub-0', title: 'Planner substep', completed: false }],
  });
  assert.deepEqual(updated.map((item) => item.id), [task.id], 'planner substeps must not create TaskItems');
  assert.equal(updated[0].id, task.id, 'clicked TaskItem.id remains authoritative');
  assert.equal(updated[0].subtasks?.[0].title, 'Planner substep');
}

function testTruthfulCompletion(): void {
  assert.equal(taskStatusAfterPipeline({ esbuildPassed: true, requiredPipelinePassed: false, aborted: false }), 'failed', 'esbuild-only success is not completion');
  assert.equal(taskStatusAfterPipeline({ esbuildPassed: true, requiredPipelinePassed: true, aborted: false }), 'completed', 'full pipeline success completes');
  assert.equal(taskStatusAfterPipeline({ esbuildPassed: true, requiredPipelinePassed: false, aborted: false }), 'failed', 'downstream failure fails');
  assert.equal(taskStatusAfterPipeline({ esbuildPassed: false, requiredPipelinePassed: false, aborted: true }), 'aborted', 'explicit abort aborts');
}

function testPathContainment(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-security-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-outside-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.symlinkSync(outside, path.join(root, 'linked'));
  assert.equal(resolveWorkspacePath(root, 'src/App.tsx'), path.join(root, 'src/App.tsx'));
  for (const candidate of ['../escape.txt', path.resolve(root, '../absolute.txt'), '\\\\server\\share\\escape.txt', 'linked/escape.txt']) {
    assert.throws(() => resolveWorkspacePath(root, candidate), `rejects ${candidate}`);
  }
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
}

async function testTerminalCompletionFromInitialSseSnapshot(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalEventSource = (globalThis as typeof globalThis & { EventSource?: unknown }).EventSource;
  const projectId = 'sse-race-regression';
  let finishedCallbackCalled = false;
  const session = {
    id: 'exec-race',
    projectId,
    command: 'npm run test',
    workingDirectory: '.',
    status: 'running' as const,
    startedAt: Date.now(),
    events: [],
  };
  const completedSession = { ...session, status: 'completed' as const, exitCode: 0, finishedAt: Date.now(), durationMs: 2 };

  globalThis.fetch = (async (input: URL | RequestInfo) => {
    if (String(input).includes('/api/terminal/execute')) {
      return new Response(JSON.stringify({ success: true, sessionId: session.id, session }), { status: 200 });
    }
    throw new Error(`Unexpected fetch: ${String(input)}`);
  }) as typeof fetch;
  class CompletedBeforeSseEventSource {
    onmessage: ((event: MessageEvent<string>) => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() {
      queueMicrotask(() => this.onmessage?.({
        data: JSON.stringify({ type: 'init', session: completedSession }),
      } as MessageEvent<string>));
    }
    close(): void {}
  }
  (globalThis as typeof globalThis & { EventSource?: unknown }).EventSource = CompletedBeforeSseEventSource as unknown as typeof EventSource;

  try {
    const result = await Promise.race([
      TerminalService.executeAndWait({ projectId, command: 'npm run test', onFinished: () => { finishedCallbackCalled = true; } }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Terminal completion promise hung on completed SSE init.')), 1000)),
    ]);
    assert.equal(result.session.status, 'completed', 'completed SSE init snapshot must settle executeAndWait');
    assert.equal(result.session.exitCode, 0, 'completed SSE init snapshot must preserve exit code');
    assert.equal(finishedCallbackCalled, true, 'completed SSE init snapshot must invoke completion callback');
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as typeof globalThis & { EventSource?: unknown }).EventSource = originalEventSource;
  }
}

testTaskIdLinkage();
testTruthfulCompletion();
testPathContainment();
await testTerminalCompletionFromInitialSseSnapshot();
console.log('focused task ID linkage tests passed');
console.log('focused truthful completion tests passed');
console.log('focused workspace path containment tests passed');
console.log('focused terminal SSE completion race test passed');