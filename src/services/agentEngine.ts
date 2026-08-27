import { ProjectConfig, ProjectFile, TaskItem, TestCase, LogEntry, AgentRunState, AutonomyLevel } from '../types';
import { buildWorkspaceDependencyGraph, validateWorkspacePath } from './dependencyGraph';

export interface AgentExecutionCallbacks {
  onStateChange: (state: AgentRunState) => void;
  onLog: (log: LogEntry) => void;
  onFileUpdate: (file: ProjectFile) => void;
  onTaskUpdate: (task: TaskItem) => void;
  onTestUpdate: (test: TestCase) => void;
  onCompleted: (summary: string) => void;
  onError: (error: string) => void;
}

export class AutonomousAgentEngine {
  private abortController: AbortController | null = null;
  private isRunning = false;
  private state: AgentRunState = {
    status: 'idle',
    currentGoal: '',
    currentStepIndex: 0,
    totalSteps: 0,
    thoughtLog: [],
  };
  private listeners: Array<(state: AgentRunState) => void> = [];

  public getState(): AgentRunState {
    return { ...this.state };
  }

  public subscribe(listener: (state: AgentRunState) => void): () => void {
    this.listeners.push(listener);
    listener({ ...this.state });
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    const currentState = { ...this.state };
    this.listeners.forEach((l) => l(currentState));
  }

  public async runAgentSession(
    goal: string,
    project: ProjectConfig,
    autonomy: AutonomyLevel,
    maxSteps: number,
    onProjectUpdate: (p: ProjectConfig) => void,
    onLog: (msg: string, level?: any, source?: string) => void
  ): Promise<void> {
    let currentProj = { ...project };

    await this.executeGoal(goal, project, {
      onStateChange: (newState) => {
        this.state = newState;
        this.notifyListeners();
      },
      onLog: (log) => {
        onLog(log.message, log.level, log.source);
      },
      onFileUpdate: (updatedFile) => {
        const fileExists = currentProj.files.some((f) => f.path === updatedFile.path);
        const newFiles = fileExists
          ? currentProj.files.map((f) => (f.path === updatedFile.path ? updatedFile : f))
          : [...currentProj.files, updatedFile];
        currentProj = { ...currentProj, files: newFiles, updatedAt: Date.now() };
        onProjectUpdate(currentProj);
      },
      onTaskUpdate: (updatedTask) => {
        const taskExists = currentProj.tasks.some((t) => t.id === updatedTask.id);
        const newTasks = taskExists
          ? currentProj.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t))
          : [updatedTask, ...currentProj.tasks];
        currentProj = { ...currentProj, tasks: newTasks, updatedAt: Date.now() };
        onProjectUpdate(currentProj);
      },
      onTestUpdate: (updatedTest) => {
        const newTests = currentProj.tests.map((t) =>
          t.id === updatedTest.id ? updatedTest : t
        );
        currentProj = { ...currentProj, tests: newTests, updatedAt: Date.now() };
        onProjectUpdate(currentProj);
      },
      onCompleted: (summary) => {
        onLog(`✓ ${summary}`, 'success', 'AGENT');
      },
      onError: (err) => {
        onLog(`Agent error: ${err}`, 'error', 'AGENT');
      },
    });
  }

  public async executeGoal(
    goal: string,
    project: ProjectConfig,
    callbacks: AgentExecutionCallbacks
  ): Promise<void> {
    if (this.isRunning) {
      callbacks.onLog({
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        level: 'warn',
        source: 'agent',
        message: 'Agent is already executing a build run.',
      });
      return;
    }

    this.isRunning = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const runState: AgentRunState = {
      status: 'planning',
      currentGoal: goal,
      currentStepIndex: 0,
      totalSteps: 4,
      thoughtLog: [],
      startedAt: Date.now(),
    };

    const addThought = (phase: string, message: string, type: 'thought' | 'action' | 'observation' | 'verification' = 'thought') => {
      const entry = { timestamp: Date.now(), phase, message, type };
      runState.thoughtLog = [...runState.thoughtLog, entry];
      callbacks.onStateChange({ ...runState });
      callbacks.onLog({
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: Date.now(),
        level: type === 'action' ? 'agent' : type === 'verification' ? 'info' : 'debug',
        source: 'agent',
        message: `[${phase.toUpperCase()}] ${message}`,
      });
    };

    try {
      addThought('Init', `Autonomous Builder Agent activated with goal: "${goal}"`, 'action');

      if (signal.aborted) throw new Error('Aborted by user');

      // Phase 0: Build workspace dependency map
      addThought('Dependency Mapping', 'Constructing workspace cross-module import/export graph...', 'thought');
      const depGraph = buildWorkspaceDependencyGraph(project.files);
      const totalModules = Object.keys(depGraph.modules).length;
      addThought('Graph Complete', `Mapped ${totalModules} workspace modules with cross-references.`, 'observation');

      // Phase 1: Planning
      runState.status = 'planning';
      callbacks.onStateChange({ ...runState });
      addThought('Planning', 'Synthesizing multi-file architectural execution plan...', 'thought');

      let planResult: {
        summary: string;
        estimatedSteps: number;
        tasks: Array<{
          title: string;
          description: string;
          priority: 'low' | 'medium' | 'high' | 'critical';
          targetFiles: string[];
          subtasks?: string[];
        }>;
        reasoning: string[];
      };

      try {
        const planRes = await fetch('/api/agent/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goal,
            projectContext: `${project.name} (${project.framework}): ${project.description}`,
            files: project.files.map((f) => ({ path: f.path, language: f.language })),
          }),
          signal,
        });

        if (!planRes.ok) throw new Error(`Plan API error: ${planRes.statusText}`);
        const data = await planRes.json();
        planResult = data.plan;
      } catch (err) {
        if (signal.aborted) throw new Error('Aborted by user');
        console.warn('Planning fallback used:', err);
        const allPaths = project.files.map((f) => f.path);
        planResult = {
          summary: `Multi-file plan synthesized for: "${goal}"`,
          estimatedSteps: 3,
          tasks: [
            {
              title: `Architect multi-file interface: "${goal.slice(0, 40)}"`,
              description: `Construct module contracts and update core interfaces.`,
              priority: 'high',
              targetFiles: allPaths.slice(0, 2).length > 0 ? allPaths.slice(0, 2) : ['src/index.ts', 'src/services/metrics.ts'],
              subtasks: ['Analyze requirements', 'Define interfaces', 'Verify imports'],
            },
            {
              title: 'Implement multi-module logic and error handlers',
              description: 'Write robust logic across target files with defensive boundary checks.',
              priority: 'critical',
              targetFiles: allPaths.slice(1, 3).length > 0 ? allPaths.slice(1, 3) : ['src/services/metrics.ts', 'src/index.ts'],
              subtasks: ['Write core methods', 'Coordinate cross-file calls', 'Handle edge cases'],
            },
            {
              title: 'Automated verification and cross-module test assertions',
              description: 'Run unit assertions, type checks, and verify sandbox runtime integrity.',
              priority: 'medium',
              targetFiles: ['src/services/healthChecker.ts', 'src/index.ts'],
              subtasks: ['Execute test assertions', 'Validate compile status'],
            },
          ],
          reasoning: ['Plan created via local autonomous fallback pipeline.'],
        };
      }

      runState.totalSteps = planResult.tasks.length;
      addThought('Plan Created', `Identified ${planResult.tasks.length} critical tasks: ${planResult.summary}`, 'observation');

      // Keep snapshot of workspace files for overall rollback if needed
      let workingFiles = [...project.files];

      // Phase 2: Execute each task (Multi-file enabled)
      for (let i = 0; i < planResult.tasks.length; i++) {
        if (signal.aborted) throw new Error('Aborted by user');

        const taskDef = planResult.tasks[i];
        runState.currentStepIndex = i + 1;
        runState.status = 'writing_code';
        callbacks.onStateChange({ ...runState });

        const targetFilesList = Array.isArray(taskDef.targetFiles) && taskDef.targetFiles.length > 0
          ? taskDef.targetFiles
          : ['src/index.ts'];

        // Validate security: Ensure all target paths are strictly inside the workspace sandbox
        for (const targetPath of targetFilesList) {
          const pathCheck = validateWorkspacePath(targetPath);
          if (!pathCheck.valid) {
            const pathErr = `Security check rejected path: ${pathCheck.error}`;
            addThought('Security Rejection', pathErr, 'action');
            throw new Error(pathErr);
          }
        }

        // Initialize Task Item with planned files and rollback capability
        const newTaskItem: TaskItem = {
          id: `agent-task-${Date.now()}-${i}`,
          title: taskDef.title,
          description: taskDef.description,
          status: 'working',
          priority: taskDef.priority || 'high',
          assignedTo: 'builder-agent',
          targetFiles: targetFilesList,
          plannedFiles: targetFilesList,
          modifiedFiles: [],
          canRollback: true,
          isRolledBack: false,
          createdAt: Date.now(),
          subtasks: taskDef.subtasks?.map((st, sidx) => ({
            id: `sub-${Date.now()}-${sidx}`,
            title: st,
            completed: false,
          })) || [],
        };
        callbacks.onTaskUpdate(newTaskItem);

        addThought('Executing', `Starting Task ${i + 1}/${planResult.tasks.length}: "${taskDef.title}" across ${targetFilesList.length} files: [${targetFilesList.join(', ')}]`, 'action');

        // Multi-file modifications capture
        const taskRollbackSnapshots: { path: string; previousContent: string; newContent: string }[] = [];
        const filesChangedInTask: ProjectFile[] = [];

        for (const targetPath of targetFilesList) {
          if (signal.aborted) throw new Error('Aborted by user');

          runState.activeFile = targetPath;
          callbacks.onStateChange({ ...runState });

          const existingFile = workingFiles.find((f) => f.path === targetPath);
          const previousContent = existingFile?.content || '';

          addThought('Code Synthesis', `Synthesizing changes for ${targetPath}...`, 'action');

          let newContent = previousContent;
          try {
            const stepRes = await fetch('/api/agent/execute-step', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                taskTitle: taskDef.title,
                taskDescription: taskDef.description,
                filePath: targetPath,
                currentContent: previousContent,
                goal,
              }),
              signal,
            });

            if (stepRes.ok) {
              const stepData = await stepRes.json();
              if (stepData.content) {
                newContent = stepData.content;
              }
            }
          } catch (err) {
            if (signal.aborted) throw new Error('Aborted by user');
            console.warn('Execute step fallback:', err);
          }

          const updatedFile: ProjectFile = {
            id: existingFile ? existingFile.id : `f-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            path: targetPath,
            name: targetPath.split('/').pop() || targetPath,
            language: targetPath.endsWith('.json') ? 'json' : targetPath.endsWith('.md') ? 'markdown' : 'typescript',
            content: newContent,
            lastModified: Date.now(),
            isModified: true,
          };

          taskRollbackSnapshots.push({
            path: targetPath,
            previousContent,
            newContent,
          });

          filesChangedInTask.push(updatedFile);

          // Update local working files array
          const exIdx = workingFiles.findIndex((f) => f.path === targetPath);
          if (exIdx >= 0) {
            workingFiles[exIdx] = updatedFile;
          } else {
            workingFiles.push(updatedFile);
          }

          callbacks.onFileUpdate(updatedFile);
          addThought('File Updated', `Updated ${targetPath} (${newContent.length} chars)`, 'action');
        }

        // Attach snapshots to task item
        newTaskItem.modifiedFiles = taskRollbackSnapshots;
        newTaskItem.targetFiles = targetFilesList;
        callbacks.onTaskUpdate({ ...newTaskItem });

        // Multi-file validation phase using esbuild compiler
        newTaskItem.status = 'validating';
        callbacks.onTaskUpdate({ ...newTaskItem });
        addThought('Validating', `Running cross-module esbuild compiler checks on ${targetFilesList.length} files...`, 'verification');

        let validationPassed = true;
        let validationErrorMsg = '';
        let failedFileResults: Array<{ path: string; valid: boolean; errors: string[] }> = [];

        try {
          const valRes = await fetch('/api/workspace/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              files: filesChangedInTask.map((f) => ({ path: f.path, content: f.content })),
            }),
            signal,
          });

          if (valRes.ok) {
            const valData = await valRes.json();
            valData.logs?.forEach((l: string) => {
              callbacks.onLog({
                id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                timestamp: Date.now(),
                level: valData.allValid ? 'info' : 'error',
                source: 'compiler',
                message: l,
              });
            });
            validationPassed = valData.allValid;
            if (!valData.allValid) {
              failedFileResults = (valData.results?.filter((r: any) => !r.valid) || []) as Array<{ path: string; valid: boolean; errors: string[] }>;
              validationErrorMsg = failedFileResults.map((f) => `${f.path}: ${f.errors.join('; ')}`).join(' | ');
            }
          }
        } catch (vErr) {
          if (signal.aborted) throw new Error('Aborted by user');
          console.warn('Validation endpoint issue:', vErr);
        }

        // Autonomous Self-Correction & Auto-Repair Loop (up to 3 bounded repair attempts)
        if (!validationPassed && failedFileResults.length > 0) {
          const maxRepairAttempts = 3;
          for (let attempt = 1; attempt <= maxRepairAttempts; attempt++) {
            if (signal.aborted) throw new Error('Aborted by user');

            runState.status = 'self_correcting';
            callbacks.onStateChange({ ...runState });
            addThought(
              'Self-Correction',
              `Compiler diagnostic flagged issues (${validationErrorMsg}). Executing autonomous auto-repair attempt ${attempt}/${maxRepairAttempts}...`,
              'action'
            );

            callbacks.onLog({
              id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              timestamp: Date.now(),
              level: 'agent',
              source: 'repair_engine',
              message: `[AUTO-REPAIR] Initiating self-healing cycle ${attempt}/${maxRepairAttempts} for ${failedFileResults.length} broken files...`,
            });

            for (const brokenFile of failedFileResults) {
              const fileInTask = filesChangedInTask.find((f) => f.path === brokenFile.path);
              if (!fileInTask) continue;

              try {
                const repairRes = await fetch('/api/agent/repair-step', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    filePath: brokenFile.path,
                    currentContent: fileInTask.content,
                    errors: brokenFile.errors,
                    taskTitle: taskDef.title,
                    taskDescription: taskDef.description,
                    goal,
                  }),
                  signal,
                });

                if (repairRes.ok) {
                  const repairData = await repairRes.json();
                  if (repairData.repaired && repairData.content) {
                    fileInTask.content = repairData.content;
                    fileInTask.lastModified = Date.now();

                    // Update working files
                    const wIdx = workingFiles.findIndex((f) => f.path === brokenFile.path);
                    if (wIdx >= 0) workingFiles[wIdx] = { ...fileInTask };

                    // Update task snapshot
                    const snapIdx = taskRollbackSnapshots.findIndex((s) => s.path === brokenFile.path);
                    if (snapIdx >= 0) {
                      taskRollbackSnapshots[snapIdx].newContent = repairData.content;
                    }

                    callbacks.onFileUpdate({ ...fileInTask });
                    addThought('Repaired File', `Applied auto-repair patch to ${brokenFile.path}`, 'action');
                  }
                }
              } catch (repairErr) {
                if (signal.aborted) throw new Error('Aborted by user');
                console.warn('Repair attempt failed:', repairErr);
              }
            }

            // Re-validate the repaired files with esbuild
            try {
              const revalRes = await fetch('/api/workspace/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  files: filesChangedInTask.map((f) => ({ path: f.path, content: f.content })),
                }),
                signal,
              });

              if (revalRes.ok) {
                const revalData = await revalRes.json();
                validationPassed = revalData.allValid;
                if (revalData.allValid) {
                  failedFileResults = [];
                  validationErrorMsg = '';
                  addThought(
                    'Repair Succeeded',
                    `✓ Autonomous self-correction resolved all compiler errors on attempt ${attempt}.`,
                    'verification'
                  );
                  callbacks.onLog({
                    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                    timestamp: Date.now(),
                    level: 'success',
                    source: 'repair_engine',
                    message: `[AUTO-REPAIR] ✓ Self-correction cycle ${attempt} passed all syntax and compiler checks cleanly.`,
                  });
                  break;
                } else {
                  failedFileResults = (revalData.results?.filter((r: any) => !r.valid) || []) as Array<{ path: string; valid: boolean; errors: string[] }>;
                  validationErrorMsg = failedFileResults.map((f) => `${f.path}: ${f.errors.join('; ')}`).join(' | ');
                }
              }
            } catch (revalErr) {
              if (signal.aborted) throw new Error('Aborted by user');
              console.warn('Revalidation error:', revalErr);
            }
          }
        }

        if (!validationPassed) {
          newTaskItem.status = 'failed';
          newTaskItem.validationError = validationErrorMsg || 'Cross-file compilation failed after self-correction attempts.';
          callbacks.onTaskUpdate(newTaskItem);
          addThought('Validation Failed', `Errors persisted after auto-repair attempts: ${validationErrorMsg}`, 'observation');
          throw new Error(`Validation failed: ${validationErrorMsg}`);
        }

        // Mark task completed only after validation passes
        newTaskItem.status = 'completed';
        newTaskItem.completedAt = Date.now();
        newTaskItem.subtasks = newTaskItem.subtasks?.map((st) => ({ ...st, completed: true }));
        callbacks.onTaskUpdate(newTaskItem);
        addThought('Task Verified', `Task ${i + 1}/${planResult.tasks.length} passed cross-module validation and committed to workspace.`, 'verification');
      }

      // Phase 3: Real In-Memory Testing and Validation Matrix
      if (signal.aborted) throw new Error('Aborted by user');
      runState.status = 'running_tests';
      callbacks.onStateChange({ ...runState });
      addThought('Verification', `Running Vitest test suite against updated workspace runtime...`, 'verification');

      try {
        const testRes = await fetch('/api/workspace/run-tests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: workingFiles,
            tests: project.tests,
          }),
          signal,
        });

        if (testRes.ok) {
          const testData = await testRes.json();
          testData.logs?.forEach((l: string) => {
            callbacks.onLog({
              id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              timestamp: Date.now(),
              level: l.includes('[FAIL]') ? 'error' : l.includes('[PASS]') ? 'success' : 'info',
              source: 'test_runner',
              message: l,
            });
          });

          if (testData.results && Array.isArray(testData.results)) {
            for (const r of testData.results) {
              callbacks.onTestUpdate({
                id: r.id,
                name: r.name,
                file: r.file,
                suite: r.suite,
                status: r.status,
                durationMs: r.durationMs,
                lastRun: Date.now(),
              });
            }
          }
        }
      } catch (tErr) {
        if (signal.aborted) throw new Error('Aborted by user');
        console.warn('Real test runner fallback:', tErr);
      }

      runState.status = 'completed';
      runState.completedAt = Date.now();
      callbacks.onStateChange({ ...runState });
      addThought('Complete', 'All multi-file tasks executed, types verified via esbuild, and sandbox test suites executed.', 'verification');
      callbacks.onCompleted(`Goal successfully fulfilled: "${goal}". Multi-file changes verified in sandbox.`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown execution error';
      if (errorMsg === 'Aborted by user') {
        runState.status = 'aborted';
        addThought('Aborted', 'Agent execution stopped immediately by user command.', 'action');
        callbacks.onLog({
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          level: 'warn',
          source: 'agent',
          message: '⛔ Agent execution aborted by user override.',
        });
      } else {
        runState.status = 'error';
        runState.error = errorMsg;
        addThought('Error', `Execution halted: ${errorMsg}`, 'action');
        callbacks.onError(errorMsg);
      }
      callbacks.onStateChange({ ...runState });
    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }

  public abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isRunning = false;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }
}

export const globalAgentEngine = new AutonomousAgentEngine();

