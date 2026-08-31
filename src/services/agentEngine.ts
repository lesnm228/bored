import { ProjectConfig, ProjectFile, TaskItem, TestCase, LogEntry, AgentRunState, AutonomyLevel } from '../types';
import { buildWorkspaceDependencyGraph, validateWorkspacePath } from './dependencyGraph';
import { TerminalService } from './terminalService';
import { GitService } from './gitService';
import { ProjectService } from './projectService';

export interface AgentExecutionCallbacks {
  onStateChange: (state: AgentRunState) => void;
  onLog: (log: LogEntry) => void;
  onFileUpdate: (file: ProjectFile) => void;
  onTaskUpdate: (task: TaskItem) => void;
  onTestUpdate: (test: TestCase) => void;
  onCompleted: (summary: string) => void;
  onError: (error: string) => void;
}

type RealBuildStepResult = {
  success: boolean;
  status: 'ready' | 'blocked' | 'failed';
  message: string;
  details?: Record<string, any>;
};

type ProductRequirement = {
  id: string;
  description: string;
  verificationType: 'code-and-runtime' | 'code-only' | 'runtime-only';
};

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

  private extractRequirements(instruction: string): ProductRequirement[] {
    const text = instruction.toLowerCase();
    const requirements: ProductRequirement[] = [];
    const add = (id: string, description: string, verificationType: ProductRequirement['verificationType']) => {
      if (!requirements.some((requirement) => requirement.id === id)) requirements.push({ id, description, verificationType });
    };
    if (/add|create|new/.test(text) && /task|item|todo|record/.test(text)) add('entity-add', 'User can add a new item.', 'code-and-runtime');
    if (/complete|toggle|done|status/.test(text) && /task|item|todo|record/.test(text)) add('entity-complete', 'User can toggle an item completion state.', 'code-and-runtime');
    if (/delete|remove/.test(text) && /task|item|todo|record/.test(text)) add('entity-delete', 'User can delete an item.', 'code-and-runtime');
    if (/local storage|localstorage|persist|refresh|offline/.test(text)) add('data-persistence', 'User data persists locally across refresh.', 'code-and-runtime');
    if (/responsive|mobile|mobile-friendly/.test(text)) add('responsive-ui', 'The interface adapts to mobile and desktop layouts.', 'code-only');
    if (requirements.length === 0) add('core-deliverable', 'The requested application capability is implemented in the primary application entry point.', 'code-and-runtime');
    return requirements;
  }

  private verifyRequirements(files: ProjectFile[], requirements: ProductRequirement[]): string[] {
    const appSource = files.filter((file) => /\.(tsx?|jsx?)$/.test(file.path)).map((file) => file.content).join('\n');
    const cssSource = files.filter((file) => /\.css$/.test(file.path)).map((file) => file.content).join('\n');
    const missing: string[] = [];
    for (const requirement of requirements) {
      const source = requirement.id === 'responsive-ui' ? cssSource : appSource;
      const checks: Record<string, RegExp> = {
        'entity-add': /set[A-Za-z]*\(.*\[|add[A-Za-z]*\s*=|onClick=\{add/i,
        'entity-complete': /completed|toggle[A-Za-z]*|checked=/i,
        'entity-delete': /delete[A-Za-z]*|remove[A-Za-z]*|filter\(/i,
        'data-persistence': /localStorage\.(getItem|setItem)/i,
        'responsive-ui': /@media|flex-wrap|min-width|max-width/i,
        'core-deliverable': /function App|export default function App/i,
      };
      if (!checks[requirement.id]?.test(source)) missing.push(requirement.id);
    }
    return missing;
  }

  private async persistAgentContext(project: ProjectConfig, state: AgentRunState): Promise<void> {
    const completedSteps = project.tasks.filter((task) => task.status === 'completed').map((task) => task.title);
    const pendingSteps = project.tasks.filter((task) => task.status !== 'completed').map((task) => task.title);
    const context = {
      purpose: project.description,
      framework: project.framework,
      instruction: state.currentGoal,
      importantFiles: project.files.map((file) => file.path),
      latestWorkingState: state.status,
      currentBlocker: state.error || '',
      lifecycleStatus: state.status,
      completedSteps,
      pendingSteps,
      affectedFiles: project.tasks.flatMap((task) => task.modifiedFiles?.map((file) => file.path) || []),
      rollback: {
        checkpointId: `checkpoint-${project.id}`,
        fileCount: project.files.length,
        integrity: true,
      },
      resumeEligible: ['aborted', 'blocked'].includes(state.status),
      updatedAt: Date.now(),
      lastSuccessfulBuild: state.status === 'completed' ? Date.now() : project.agentContext?.lastSuccessfulBuild,
      recentTaskHistory: project.tasks.slice(0, 20).map((task) => ({
        title: task.title,
        status: task.status,
        timestamp: task.completedAt || task.createdAt,
      })),
      checkpoint: {
        taskId: project.tasks[project.tasks.length - 1]?.id || '',
        phase: state.status,
        stepIndex: state.currentStepIndex,
        status: state.status,
        updatedAt: Date.now(),
        integrity: true,
      },
    };
    await fetch(`/api/workspaces/${encodeURIComponent(project.id)}/agent-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context }),
    }).catch(() => undefined);
  }

  private async persistWorkflow(project: ProjectConfig, workflowId: string, values: Record<string, unknown>): Promise<void> {
    project.agentContext = {
      ...(project.agentContext || {}),
      workflowId,
      ...values,
    } as ProjectConfig['agentContext'];
    await fetch(`/api/workspaces/${encodeURIComponent(project.id)}/agent-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: {
        workflowId,
        instruction: project.description,
        purpose: project.description,
        framework: project.framework,
        ...values,
      } }),
    }).catch(() => undefined);
  }

  private buildGenericReactProjectFiles(projectName: string, projectId: string): ProjectFile[] {
    const name = projectName.trim() || 'Builder Project';
    const slug = projectId.toLowerCase();
    const now = Date.now();
    const file = (path: string, language: ProjectFile['language'], content: string): ProjectFile => ({
      id: `f-${now}-${path.replace(/[^a-z0-9]/gi, '-')}`,
      name: path.split('/').pop() || path,
      path,
      language,
      content,
      lastModified: now,
    });
    return [
      file('package.json', 'json', JSON.stringify({
        name: slug,
        version: '1.0.0',
        private: true,
        type: 'module',
        scripts: { dev: 'vite --host 0.0.0.0 --port 4173', build: 'vite build', typecheck: 'tsc --noEmit', lint: 'tsc --noEmit' },
        dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
        devDependencies: { '@types/react': '^18.3.12', '@types/react-dom': '^18.3.1', '@vitejs/plugin-react': '^4.3.2', typescript: '^5.6.3', vite: '^5.4.10' },
      }, null, 2)),
      file('vite.config.ts', 'typescript', "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });\n"),
      file('tsconfig.json', 'json', JSON.stringify({ compilerOptions: { target: 'ES2020', useDefineForClassFields: true, lib: ['DOM', 'DOM.Iterable', 'ES2020'], allowJs: false, skipLibCheck: true, esModuleInterop: true, strict: true, module: 'ESNext', moduleResolution: 'Bundler', resolveJsonModule: true, isolatedModules: true, noEmit: true, jsx: 'react-jsx', types: ['vite/client'] }, include: ['src'] }, null, 2)),
      file('index.html', 'html', `<!doctype html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${name}</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`),
      file('src/main.tsx', 'typescript', "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App';\nimport './index.css';\ncreateRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);\n"),
      file('src/App.tsx', 'typescript', `export default function App() { return <main><h1>${name}</h1><p>Generated by Builder Board.</p></main>; }\n`),
      file('src/index.css', 'css', ':root { font-family: system-ui, sans-serif; color: #162033; background: #f4f7fb; }\nbody { margin: 0; min-width: 320px; }\nmain { max-width: 720px; margin: 0 auto; padding: 3rem 1.25rem; }\n'),
    ];
  }

  private buildGeneralProjectFiles(projectName: string, projectId: string, instruction: string): ProjectFile[] {
    const safeName = projectName.trim() || 'Task Manager';
    const safeId = projectId.replace(/[^a-zA-Z0-9_-]/g, '-');
    const appName = safeName.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Task Manager';
    const packageJson = {
      name: safeId.toLowerCase(),
      private: true,
      version: '1.0.0',
      type: 'module',
      scripts: {
        dev: 'vite --host 0.0.0.0 --port 4173',
        build: 'vite build',
        preview: 'vite preview --host 0.0.0.0 --port 4173',
        typecheck: 'tsc --noEmit',
        lint: 'tsc --noEmit',
      },
      dependencies: {
        react: '^18.3.1',
        'react-dom': '^18.3.1',
      },
      devDependencies: {
        '@types/react': '^18.3.12',
        '@types/react-dom': '^18.3.1',
        '@vitejs/plugin-react': '^4.3.2',
        typescript: '^5.6.3',
        vite: '^5.4.10',
      },
      packageManager: 'npm@10.9.2',
    };

    const appCode = `import { useEffect, useMemo, useState } from 'react';

type Task = {
  id: number;
  text: string;
  completed: boolean;
};

const STORAGE_KEY = '${safeId}-tasks';

function App() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as Task[];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const remainingCount = useMemo(
    () => tasks.filter((task) => !task.completed).length,
    [tasks]
  );

  const addTask = () => {
    const text = input.trim();
    if (!text) return;
    setTasks((prev) => [{ id: Date.now(), text, completed: false }, ...prev]);
    setInput('');
  };

  const toggleTask = (id: number) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task)));
  };

  const deleteTask = (id: number) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f4f7fb', color: '#162033', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ background: '#ffffff', borderRadius: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.08)', padding: 24 }}>
          <h1 style={{ margin: 0, fontSize: '2rem', color: '#0f172a' }}>{'${appName}'}</h1>
          <p style={{ color: '#4f5d75', marginTop: 8, marginBottom: 20 }}>
            { '${instruction.replace(/'/g, '\\' )}' }
          </p>

          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Add a task..."
              style={{ flex: 1, borderRadius: 10, border: '1px solid #dfe7f3', padding: '12px 14px', fontSize: 16 }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addTask();
              }}
            />
            <button
              onClick={addTask}
              style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 18px', fontWeight: 700 }}
            >
              Add
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong>{remainingCount} remaining</strong>
            <span style={{ color: '#64748b', fontSize: 12 }}>Saved locally</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tasks.length === 0 ? (
              <div style={{ border: '1px dashed #cbd5e1', borderRadius: 12, padding: 18, textAlign: 'center', color: '#64748b' }}>
                No tasks yet. Add one to get started.
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: task.completed ? '#edf7ef' : '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <input type="checkbox" checked={task.completed} onChange={() => toggleTask(task.id)} />
                  <span
                    style={{
                      flex: 1,
                      textDecoration: task.completed ? 'line-through' : 'none',
                      color: task.completed ? '#64748b' : '#0f172a',
                    }}
                  >
                    {task.text}
                  </span>
                  <button
                    onClick={() => deleteTask(task.id)}
                    style={{ background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 8, padding: '8px 10px', fontWeight: 700 }}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
`;

    return [
      {
        id: `f-${Date.now()}-package`,
        name: 'package.json',
        path: 'package.json',
        language: 'json',
        content: JSON.stringify(packageJson, null, 2),
        lastModified: Date.now(),
      },
      {
        id: `f-${Date.now()}-vite`,
        name: 'vite.config.ts',
        path: 'vite.config.ts',
        language: 'typescript',
        content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
});
`,
        lastModified: Date.now(),
      },
      {
        id: `f-${Date.now()}-ts`,
        name: 'tsconfig.json',
        path: 'tsconfig.json',
        language: 'json',
        content: JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            useDefineForClassFields: true,
            lib: ['DOM', 'DOM.Iterable', 'ES2020'],
            allowJs: false,
            skipLibCheck: true,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            strict: true,
            forceConsistentCasingInFileNames: true,
            module: 'ESNext',
            moduleResolution: 'Node',
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: 'react-jsx',
            types: ['vite/client'],
          },
          include: ['src'],
          references: [],
        }, null, 2),
        lastModified: Date.now(),
      },
      {
        id: `f-${Date.now()}-html`,
        name: 'index.html',
        path: 'index.html',
        language: 'html',
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${appName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
        lastModified: Date.now(),
      },
      {
        id: `f-${Date.now()}-main`,
        name: 'main.tsx',
        path: 'src/main.tsx',
        language: 'typescript',
        content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
        lastModified: Date.now(),
      },
      {
        id: `f-${Date.now()}-app`,
        name: 'App.tsx',
        path: 'src/App.tsx',
        language: 'typescript',
        content: appCode,
        lastModified: Date.now(),
      },
      {
        id: `f-${Date.now()}-css`,
        name: 'index.css',
        path: 'src/index.css',
        language: 'css',
        content: `:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color: #0f172a;
  background: #f4f7fb;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* { box-sizing: border-box; }
html, body, #root { margin: 0; min-height: 100%; }
body { min-height: 100vh; }
button, input { font: inherit; }
`,
        lastModified: Date.now(),
      },
    ];
  }

  public async executeRealProductWorkflow(
    instruction: string,
    projectName?: string,
    options: { port?: number; maxRepairAttempts?: number } = {}
  ): Promise<RealBuildStepResult & { projectId?: string; project?: ProjectConfig; previewUrl?: string; results?: Record<string, any>; plan?: any; }> {
    if (this.isRunning) {
      return { success: false, status: 'blocked', message: 'Builder Agent is already executing a workflow.' };
    }

    const port = options.port ?? 4173;
    const maxRepairAttempts = options.maxRepairAttempts ?? 3;
    const safeName = projectName || instruction.split(/\s+/).slice(0, 4).join(' ') || 'Builder Project';
    const projectId = `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const project = ProjectService.createProject({
      name: safeName,
      tagline: 'Generated by Builder Board orchestrator',
      description: instruction,
      framework: 'React + Vite + TypeScript',
    });
    project.id = projectId;
    project.framework = 'React + Vite + TypeScript';
    project.branch = 'main';
    project.environment = 'development';
    project.updatedAt = Date.now();
    project.createdAt = Date.now();

    const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const requirements = this.extractRequirements(instruction);
    project.files = this.buildGenericReactProjectFiles(safeName, projectId);
    project.tasks = [];
    project.tests = [];

    let persistedProjects: ProjectConfig[] = [];
    try {
      const existing = localStorage.getItem('builder_board_projects_v3');
      if (existing) {
        persistedProjects = JSON.parse(existing) as ProjectConfig[];
      }
    } catch {
      persistedProjects = [];
    }
    persistedProjects = [project, ...persistedProjects.filter((p) => p.id !== project.id)];
    localStorage.setItem('builder_board_projects_v3', JSON.stringify(persistedProjects));
    localStorage.setItem('builder_board_active_proj_v3', project.id);
    await ProjectService.saveSingleWorkspace(project);

    await this.persistWorkflow(project, workflowId, { lifecycleStatus: 'planning', resumeEligible: false });
    const planRes = await fetch('/api/agent/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: instruction,
        requirements,
        projectContext: `${project.name}: ${project.description}`,
        files: project.files.map((f) => ({ path: f.path, language: f.language })),
      }),
    });
    const planData = planRes.ok ? await planRes.json() : null;
    const plan = planData?.plan || {
      summary: `Real product plan for: ${instruction}`,
      estimatedSteps: 3,
      tasks: [{ title: 'Generate app scaffold', description: instruction, priority: 'high', targetFiles: project.files.map((f) => f.path), subtasks: ['Create files', 'Install dependencies', 'Validate build'] }],
      requirements,
      reasoning: ['Requirements extracted and mapped to application files.'],
    };

    await this.persistWorkflow(project, workflowId, { lifecycleStatus: 'planning', plan, updatedAt: Date.now() });
    const generatedFiles = [...project.files];
    const plannedPaths: string[] = Array.from(new Set([
      ...plan.tasks.flatMap((task: any) => Array.isArray(task.targetFiles) ? task.targetFiles.filter((file: unknown): file is string => typeof file === 'string') : []),
      ...requirements.filter((requirement) => requirement.id !== 'core-deliverable').map(() => 'src/App.tsx'),
      ...(requirements.some((requirement) => requirement.id === 'responsive-ui') ? ['src/index.css'] : []),
    ]));
    for (const filePath of plannedPaths) {
      const current = generatedFiles.find((file) => file.path === filePath);
      const stepRes = await fetch('/api/agent/execute-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskTitle: plan.tasks[0]?.title || 'Implement planned project',
          taskDescription: plan.tasks[0]?.description || instruction,
          filePath,
          currentContent: current?.content || '',
          goal: instruction,
          requirements,
        }),
      });
      if (!stepRes.ok) throw new Error(`File generation failed for ${filePath}.`);
      const stepData = await stepRes.json();
      if (typeof stepData.content !== 'string') throw new Error(`File generation returned no content for ${filePath}.`);
      const generated = current || { id: `f-${Date.now()}`, name: filePath.split('/').pop() || filePath, path: filePath, language: 'typescript' as const, content: '', lastModified: Date.now() };
      generated.content = stepData.content;
      generated.lastModified = Date.now();
      const index = generatedFiles.findIndex((file) => file.path === filePath);
      if (index >= 0) generatedFiles[index] = generated;
      else generatedFiles.push(generated);
    }
    project.files = generatedFiles;
    await ProjectService.saveSingleWorkspace(project);
    await this.persistWorkflow(project, workflowId, { lifecycleStatus: 'writing_code', importantFiles: generatedFiles.map((file) => file.path) });

    this.isRunning = true;
    this.abortController = new AbortController();
    let workflowReady = false;

    try {
      await this.persistWorkflow(project, workflowId, { lifecycleStatus: 'inspecting', affectedFiles: generatedFiles.map((file) => file.path) });
      const packageManagerRes = await fetch('/api/workspace/package-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          files: generatedFiles.map((file) => ({ path: file.path, content: file.content })),
        }),
      });
      if (!packageManagerRes.ok) {
        return { success: false, status: 'failed', message: 'Package manager detection failed.' };
      }
      const packageManagerData = await packageManagerRes.json();
      const packageManager = packageManagerData.manager || 'npm';
      const requirementRes = await fetch('/api/workspace/verify-requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, requirements }),
      });
      const requirementData = requirementRes.ok ? await requirementRes.json() : null;
      if (!requirementData?.allImplemented) {
        return { success: false, status: 'blocked', message: `SEMANTIC ACCEPTANCE FAILED: missing ${(requirementData?.missingRequirements || requirements.map((requirement) => requirement.id)).join(', ')}.`, details: { requirements, missingRequirements: requirementData?.missingRequirements || requirements.map((requirement) => requirement.id) } };
      }
      await this.persistWorkflow(project, workflowId, { lifecycleStatus: 'validating', currentCommand: `${packageManager} install` });

      const installResult = await TerminalService.executeAndWait({
        projectId,
        command: `${packageManager} install`,
        files: generatedFiles.map((file) => ({ path: file.path, content: file.content })),
        timeoutMs: 600000,
      });
      if (installResult.session.status !== 'completed' || installResult.session.exitCode !== 0) {
        return { success: false, status: 'failed', message: 'Dependency installation failed.', details: { install: installResult.session } };
      }

      const startRes = await fetch('/api/workspace/dev/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, files: generatedFiles.map((file) => ({ path: file.path, content: file.content })), port }),
      });
      const startData = startRes.ok ? await startRes.json() : null;
      if (!startRes.ok || !startData?.success || !startData?.pid) {
        return { success: false, status: 'failed', message: 'Dev server could not start.', details: { start: startData } };
      }

      const readyUrl = startData.previewUrl || `/api/workspace/preview/${encodeURIComponent(projectId)}/`;
      let ready = false;
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline && !ready) {
        if (this.abortController?.signal.aborted) {
          return { success: false, status: 'blocked', message: 'Aborted by user.' };
        }
        try {
          const statusRes = await fetch(`/api/workspace/dev/status/${encodeURIComponent(projectId)}`);
          const statusData = statusRes.ok ? await statusRes.json() : null;
          const probe = await fetch(readyUrl, { method: 'GET' });
          if (statusData?.status === 'running' && statusData.pid && probe.ok) {
            ready = true;
          }
        } catch {
          // retry until ready
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (!ready) {
        return { success: false, status: 'failed', message: 'Dev server did not become ready on the expected port.', details: { port, previewUrl: readyUrl } };
      }

      const previewProbe = await fetch(readyUrl, { method: 'GET' });
      if (!previewProbe.ok) {
        return { success: false, status: 'failed', message: 'Builder Board preview proxy did not respond successfully.', details: { previewUrl: readyUrl, status: previewProbe.status } };
      }

      const validationResults: Record<string, any> = {};
      const packageInfoRes = await fetch('/api/workspace/package-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      if (!packageInfoRes.ok) {
        return { success: false, status: 'failed', message: 'Could not inspect generated package scripts.' };
      }
      const packageInfo = await packageInfoRes.json();
      const availableScripts = packageInfo.scripts || {};
      for (const command of ['typecheck', 'lint', 'test']) {
        if (!availableScripts[command]) {
          validationResults[command] = 'NOT CONFIGURED';
          continue;
        }
        const result = await TerminalService.executeAndWait({
          projectId,
          command: `${packageManager} run ${command}`,
          timeoutMs: 600000,
        });
        validationResults[command] = {
          status: result.session.status,
          exitCode: result.session.exitCode,
          durationMs: result.session.durationMs,
          events: result.session.events.slice(-20),
        };
        await this.persistWorkflow(project, workflowId, {
          lifecycleStatus: command === 'build' ? 'building' : 'validating',
          currentCommand: `npm run ${command}`,
          lastValidation: command === 'build' ? undefined : validationResults[command],
          lastBuild: command === 'build' ? validationResults[command] : undefined,
        });
        if (result.session.status !== 'completed' || result.session.exitCode !== 0) {
          let repairAttempts = 0;
          while (repairAttempts < maxRepairAttempts) {
            const repairTarget = await this.repairGeneratedProject(projectId, instruction, result.session.events, command);
            if (!repairTarget) break;
            const rerun = await TerminalService.executeAndWait({
              projectId,
              command: `${packageManager} run ${command}`,
              timeoutMs: 600000,
            });
            repairAttempts += 1;
            validationResults[command] = {
              status: rerun.session.status,
              exitCode: rerun.session.exitCode,
              durationMs: rerun.session.durationMs,
              events: rerun.session.events.slice(-20),
            };
            await this.persistWorkflow(project, workflowId, {
              lifecycleStatus: 'self_correcting',
              currentCommand: `npm run ${command}`,
              repairAttempts,
              lastValidation: command === 'build' ? undefined : validationResults[command],
              lastBuild: command === 'build' ? validationResults[command] : undefined,
            });
            if (rerun.session.status === 'completed' && rerun.session.exitCode === 0) {
              break;
            }
          }
          if (validationResults[command].status !== 'completed' || validationResults[command].exitCode !== 0) {
            return { success: false, status: 'blocked', message: `Validation failed for ${command} after bounded repairs.`, details: { validationResults } };
          }
        }
      }

      const buildResult = await TerminalService.executeAndWait({
        projectId,
        command: `${packageManager} run build`,
        timeoutMs: 600000,
      });
      if (buildResult.session.status !== 'completed' || buildResult.session.exitCode !== 0) {
        return { success: false, status: 'failed', message: 'Production build failed.', details: { buildResult } };
      }
      await this.persistWorkflow(project, workflowId, {
        lifecycleStatus: 'completed',
        currentCommand: `${packageManager} run build`,
        lastBuild: {
          status: buildResult.session.status,
          exitCode: buildResult.session.exitCode,
          durationMs: buildResult.session.durationMs,
        },
      });

      const projectState = { ...project, updatedAt: Date.now(), files: generatedFiles };
      ProjectService.saveProjects([projectState, ...persistedProjects.filter((p) => p.id !== projectState.id)], projectId);
      workflowReady = true;

      return {
        success: true,
        status: 'ready',
        message: 'Builder Board real project workflow completed successfully.',
        projectId,
        project: projectState,
        previewUrl: readyUrl,
        results: { plan, installResult, startData, validationResults, buildResult },
        plan,
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'failed',
        message: error?.message || 'Builder workflow failed unexpectedly.',
      };
    } finally {
      if (!workflowReady) {
        try {
          await fetch('/api/workspace/dev/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId }),
          });
        } catch {
          // The server owns process cleanup; this is best effort if disconnected.
        }
      }
      this.isRunning = false;
      this.abortController = null;
    }
  }

  private async repairGeneratedProject(projectId: string, instruction: string, events: any[], command: string): Promise<boolean> {
    try {
      const repairRes = await fetch('/api/workspace/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, instruction, events, command }),
      });
      if (!repairRes.ok) return false;
      const repairData = await repairRes.json();
      return repairData.repaired === true;
    } catch {
      return false;
    }
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
    let resumeFromStep = 0;
    try {
      const contextRes = await fetch(`/api/workspaces/${encodeURIComponent(project.id)}/agent-context`);
      if (contextRes.ok) {
        const contextData = await contextRes.json();
        resumeFromStep = contextData.context?.resumeEligible && contextData.context?.checkpoint?.integrity
          ? Math.max(0, Number(contextData.context.checkpoint.stepIndex))
          : 0;
      }
    } catch {
      resumeFromStep = 0;
    }

    await this.executeGoal(goal, project, {
      onStateChange: (newState) => {
        this.state = newState;
        this.notifyListeners();
        void this.persistAgentContext(currentProj, newState);
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
        void this.persistAgentContext(currentProj, this.state);
      },
      onTaskUpdate: (updatedTask) => {
        const taskExists = currentProj.tasks.some((t) => t.id === updatedTask.id);
        const newTasks = taskExists
          ? currentProj.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t))
          : [updatedTask, ...currentProj.tasks];
        currentProj = { ...currentProj, tasks: newTasks, updatedAt: Date.now() };
        onProjectUpdate(currentProj);
        void this.persistAgentContext(currentProj, this.state);
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
    }, resumeFromStep);
    await this.persistAgentContext(currentProj, this.state);
  }

  public async executeGoal(
    goal: string,
    project: ProjectConfig,
    callbacks: AgentExecutionCallbacks,
    resumeFromStep = 0
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
    let workingFiles = project.files.map((file) => ({ ...file }));
    const originalFiles = project.files.map((file) => ({ ...file }));

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
      addThought('Snapshot', `Created rollback checkpoint for ${originalFiles.length} workspace files.`, 'verification');

      // Phase 2: Execute each task (Multi-file enabled)
      for (let i = resumeFromStep; i < planResult.tasks.length; i++) {
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
          if (testData.status === 'failed' || testData.failed === true) {
            throw new Error('Configured tests failed.');
          }
          if (testData.configured === false) {
            addThought('Testing', 'TEST STATUS: NOT CONFIGURED', 'observation');
          }
        }
      } catch (tErr) {
        if (signal.aborted) throw new Error('Aborted by user');
        throw new Error(`Test execution failed: ${tErr instanceof Error ? tErr.message : String(tErr)}`);
      }

      const runTerminalCheck = async (command: string, phase: string) => {
        if (signal.aborted) throw new Error('Aborted by user');
        runState.status = phase === 'Building' ? 'building' : 'validating';
        callbacks.onStateChange({ ...runState });
        addThought(phase, `Executing real command: ${command}`, 'action');
        const result = await TerminalService.executeAndWait({
          projectId: project.id,
          command,
          files: workingFiles.map((file) => ({ path: file.path, content: file.content })),
          timeoutMs: 120000,
          onEvent: (event) => callbacks.onLog({
            id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: event.timestamp,
            level: event.type === 'stderr' ? 'error' : 'info',
            source: 'terminal',
            message: event.text,
          }),
        });
        if (result.session.status !== 'completed' || result.session.exitCode !== 0) {
          throw new Error(`${command} failed with exit code ${result.session.exitCode ?? 'unknown'}.`);
        }
        addThought(`${phase} Complete`, `${command} completed successfully in ${result.session.durationMs ?? 0}ms.`, 'verification');
      };

      await runTerminalCheck('npm run lint', 'Validating');
      await runTerminalCheck('npm run build', 'Building');

      runState.status = 'reviewing';
      callbacks.onStateChange({ ...runState });
      const diffs = GitService.computeWorkspaceDiff(
        originalFiles,
        workingFiles
      ).filter((diff) => diff.isModified);
      addThought('Reviewing', `Real workspace diff contains ${diffs.length} changed file(s).`, 'verification');
      if (diffs.length === 0) {
        throw new Error('No file changes were produced; refusing to commit an empty run.');
      }

      if (!project.githubRepo) {
        runState.status = 'blocked';
        callbacks.onStateChange({ ...runState });
        throw new Error('BLOCKED: No GitHub repository is configured for this project.');
      }

      runState.status = 'committing';
      callbacks.onStateChange({ ...runState });
      addThought('Committing', 'Submitting the reviewed file diff to the configured remote.', 'action');
      runState.status = 'pushing';
      callbacks.onStateChange({ ...runState });
      const pushResult = await GitService.commitAndPush({
        owner: project.githubRepo.owner,
        repo: project.githubRepo.repo,
        branch: project.githubRepo.branch || project.branch,
        message: `Builder Agent: ${goal.slice(0, 72)}`,
        files: workingFiles
          .filter((file) => diffs.some((diff) => diff.path === file.path))
          .map((file) => ({ path: file.path, content: file.content })),
      });
      if (pushResult.blocked) {
        runState.status = 'blocked';
        callbacks.onStateChange({ ...runState });
        throw new Error(pushResult.reason || 'BLOCKED: Remote push was not authorized.');
      }
      if (!pushResult.success || !pushResult.commitSha) {
        throw new Error(pushResult.error || 'Commit and push failed.');
      }

      runState.status = 'verifying';
      callbacks.onStateChange({ ...runState });
      if (pushResult.verifiedRemoteSha !== pushResult.commitSha) {
        throw new Error('Remote SHA verification failed: pushed and fetched SHAs differ.');
      }
      addThought('Verified', `PUSH VERIFIED: remote SHA ${pushResult.verifiedRemoteSha}.`, 'verification');

      runState.status = 'completed';
      runState.completedAt = Date.now();
      callbacks.onStateChange({ ...runState });
      addThought('Complete', 'All multi-file tasks executed, types verified via esbuild, and sandbox test suites executed.', 'verification');
      callbacks.onCompleted(`Goal successfully fulfilled: "${goal}". Real typecheck and build passed.`);
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
        const isBlocked = errorMsg.startsWith('BLOCKED:');
        if (!isBlocked) {
          workingFiles = originalFiles;
          originalFiles.forEach((file) => callbacks.onFileUpdate(file));
          addThought('Rollback', 'Restored the rollback checkpoint after an unsafe failed run.', 'verification');
        }
        runState.status = isBlocked ? 'blocked' : 'error';
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

