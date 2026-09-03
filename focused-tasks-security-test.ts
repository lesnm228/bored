import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TaskItem } from './src/types';
import { taskStatusAfterPipeline, updateAuthoritativeTask } from './src/services/taskExecutionPolicy';
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

testTaskIdLinkage();
testTruthfulCompletion();
testPathContainment();
console.log('focused task ID linkage tests passed');
console.log('focused truthful completion tests passed');
console.log('focused workspace path containment tests passed');