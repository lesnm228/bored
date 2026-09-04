import { TaskItem, TaskStatus } from '../types';

export type PipelineResult = {
  esbuildPassed: boolean;
  requiredPipelinePassed: boolean;
  aborted: boolean;
};

export function updateAuthoritativeTask(tasks: TaskItem[], taskId: string, update: Partial<TaskItem>): TaskItem[] {
  return tasks.map((task) => task.id === taskId ? { ...task, ...update, id: taskId } : task);
}

export function taskStatusAfterPipeline(result: PipelineResult): TaskStatus {
  if (result.aborted) return 'aborted';
  if (!result.esbuildPassed || !result.requiredPipelinePassed) return 'failed';
  return 'completed';
}
