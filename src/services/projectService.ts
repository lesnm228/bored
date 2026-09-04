import { ProjectConfig, ProjectContext, ProjectFile, TaskItem } from '../types';
import { initialProjects } from '../data/initialData';

const STORAGE_KEY_PROJECTS = 'builder_board_projects_v3';
const STORAGE_KEY_ACTIVE = 'builder_board_active_proj_v3';
const CURRENT_SCHEMA_VERSION = 1;

export class ProjectService {
  /**
   * Sanitizes a project config to guarantee no secrets, auth tokens, or private keys are saved
   */
  public static sanitizeProject(project: ProjectConfig): ProjectConfig {
    const clone = JSON.parse(JSON.stringify(project)) as ProjectConfig;
    if (Array.isArray(clone.envVariables)) {
      clone.envVariables = clone.envVariables.map((ev) => {
        const isSecretKey = /token|secret|password|api_?key|auth|credential/i.test(ev.key || '');
        if (ev.isSecret || isSecretKey) {
          return {
            ...ev,
            isSecret: true,
            value: '[REDACTED_SECRET]',
          };
        }
        return ev;
      });
    }
    return clone;
  }

  /**
   * Load all saved projects from local storage synchronously
   */
  public static loadProjects(): ProjectConfig[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PROJECTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load projects from localStorage:', e);
    }
    return initialProjects;
  }

  /**
   * Asynchronously fetch durable persisted workspaces from server filesystem
   */
  public static async fetchWorkspacesFromServer(): Promise<{
    workspaces: ProjectConfig[];
    activeProjectId?: string;
  } | null> {
    try {
      const res = await fetch('/api/workspaces');
      if (!res.ok) return null;
      const data = await res.json();
      if (data.success && Array.isArray(data.workspaces) && data.workspaces.length > 0) {
        // Cache to localStorage for fast future loads
        try {
          localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(data.workspaces));
          if (data.activeProjectId) {
            localStorage.setItem(STORAGE_KEY_ACTIVE, data.activeProjectId);
          }
        } catch {
          // ignore quota issues
        }
        return {
          workspaces: data.workspaces,
          activeProjectId: data.activeProjectId,
        };
      }
    } catch (err) {
      console.warn('Server workspace fetch skipped/failed (using client storage):', err);
    }
    return null;
  }

  /**
   * Persist projects to both local storage and server disk
   */
  public static saveProjects(projects: ProjectConfig[], activeId?: string): void {
    try {
      const sanitized = projects.map(ProjectService.sanitizeProject);
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(sanitized));

      // Async sync to server disk
      fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaces: sanitized,
          activeProjectId: activeId,
          schemaVersion: CURRENT_SCHEMA_VERSION,
        }),
      }).catch((err) => {
        console.warn('Failed to push workspaces to server storage:', err);
      });
    } catch (e) {
      console.error('Failed to save projects:', e);
    }
  }

  /**
   * Save a single workspace to server disk
   */
  public static async saveSingleWorkspace(project: ProjectConfig): Promise<boolean> {
    try {
      const sanitized = ProjectService.sanitizeProject(project);
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace: sanitized,
          schemaVersion: CURRENT_SCHEMA_VERSION,
        }),
      });
      return res.ok;
    } catch (err) {
      console.warn('Failed to save single workspace:', err);
      return false;
    }
  }

  /**
   * Delete a workspace from server disk and local storage
   */
  public static async deleteProjectFromServer(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/workspaces/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch (err) {
      console.warn('Failed to delete workspace from server:', err);
      return false;
    }
  }

  /**
   * Load active project ID
   */
  public static getActiveProjectId(projects: ProjectConfig[]): string {
    const active = localStorage.getItem(STORAGE_KEY_ACTIVE);
    if (active && projects.some((p) => p.id === active)) {
      return active;
    }
    return projects[0]?.id || '';
  }

  /**
   * Save active project ID
   */
  public static setActiveProjectId(id: string): void {
    localStorage.setItem(STORAGE_KEY_ACTIVE, id);
  }

  /**
   * Create a new project workspace with genuine files and initial structure
   */
  public static createProject(params: {
    name: string;
    tagline?: string;
    description?: string;
    framework?: string;
    template?: 'minimal' | 'node_api' | 'react_app' | 'microservice';
  }): ProjectConfig {
    const timestamp = Date.now();
    const cleanName = params.name.trim() || 'New Software Project';
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const framework = params.framework || 'Node.js / Express / TypeScript';

    const defaultFiles: ProjectFile[] = [
      {
        id: `f-${timestamp}-1`,
        path: 'src/index.ts',
        name: 'index.ts',
        language: 'typescript',
        content: `/**
 * ${cleanName}
 * ${params.tagline || 'Autonomous Software Service'}
 */

import express, { Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    service: '${slug}',
    version: '1.0.0'
  });
});

app.listen(PORT, () => {
  console.log(\`⚡ ${cleanName} listening on port \${PORT}\`);
});
`,
        lastModified: timestamp,
      },
      {
        id: `f-${timestamp}-2`,
        path: 'package.json',
        name: 'package.json',
        language: 'json',
        content: JSON.stringify(
          {
            name: slug,
            version: '1.0.0',
            description: params.description || 'Constructed with Builder Board workspace',
            main: 'src/index.ts',
            type: 'module',
            scripts: {
              dev: 'tsx watch src/index.ts',
              build: 'tsc',
              test: 'vitest run',
            },
            dependencies: {
              express: '^4.21.2',
            },
            devDependencies: {
              '@types/express': '^4.17.21',
              '@types/node': '^22.14.0',
              tsx: '^4.21.0',
              typescript: '^5.8.2',
              vitest: '^2.0.0',
            },
          },
          null,
          2
        ),
        lastModified: timestamp,
      },
      {
        id: `f-${timestamp}-3`,
        path: 'README.md',
        name: 'README.md',
        language: 'markdown',
        content: `# ${cleanName}

${params.description || params.tagline || 'Autonomous software workspace initialized in Builder Board.'}

## Tech Stack
- **Framework**: ${framework}
- **Language**: TypeScript

## Getting Started
\`\`\`bash
npm install
npm run dev
\`\`\`
`,
        lastModified: timestamp,
      },
    ];

    if (params.template === 'react_app' || params.framework?.toLowerCase().includes('react')) {
      const packageFile = defaultFiles.find((file) => file.path === 'package.json');
      if (packageFile) {
        packageFile.content = JSON.stringify({
          name: slug,
          version: '1.0.0',
          private: true,
          type: 'module',
          scripts: { dev: 'vite --host 0.0.0.0', build: 'tsc --noEmit && vite build', lint: 'tsc --noEmit', typecheck: 'tsc --noEmit', test: 'vitest run' },
          dependencies: { react: '^19.0.1', 'react-dom': '^19.0.1' },
          devDependencies: { '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0', '@vitejs/plugin-react': '^5.0.4', typescript: '^5.8.2', vite: '^6.2.3', vitest: '^2.0.0' },
        }, null, 2);
      }
      defaultFiles.push(
        { id: `f-${timestamp}-4`, path: 'index.html', name: 'index.html', language: 'html', content: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Task Manager</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>', lastModified: timestamp },
        { id: `f-${timestamp}-5`, path: 'src/main.tsx', name: 'main.tsx', language: 'typescript', content: "import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App';\nimport './index.css';\n\ncreateRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);\n", lastModified: timestamp },
        { id: `f-${timestamp}-6`, path: 'src/App.tsx', name: 'App.tsx', language: 'typescript', content: "import { useEffect, useState } from 'react';\n\ntype Task = { id: number; title: string; completed: boolean };\n\nexport default function App() {\n  const [tasks, setTasks] = useState<Task[]>(() => JSON.parse(localStorage.getItem('tasks') || '[]'));\n  const [title, setTitle] = useState('');\n  useEffect(() => localStorage.setItem('tasks', JSON.stringify(tasks)), [tasks]);\n  const addTask = () => { if (title.trim()) { setTasks([{ id: Date.now(), title: title.trim(), completed: false }, ...tasks]); setTitle(''); } };\n  return <main><h1>Task Manager</h1><form onSubmit={(event) => { event.preventDefault(); addTask(); }}><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder=\"Add a task\" /><button>Add task</button></form><ul>{tasks.map((task) => <li key={task.id}><button onClick={() => setTasks(tasks.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item))}>{task.completed ? 'Completed' : 'Complete'}</button><span>{task.title}</span><button onClick={() => setTasks(tasks.filter((item) => item.id !== task.id))}>Delete</button></li>)}</ul></main>;\n}\n", lastModified: timestamp },
        { id: `f-${timestamp}-7`, path: 'src/index.css', name: 'index.css', language: 'css', content: 'body { margin: 0; font-family: sans-serif; } main { max-width: 42rem; margin: 0 auto; padding: 2rem 1rem; } li { display: flex; gap: 0.75rem; margin: 0.75rem 0; }', lastModified: timestamp },
        { id: `f-${timestamp}-8`, path: 'test/taskManager.test.ts', name: 'taskManager.test.ts', language: 'typescript', content: "import { describe, expect, it } from 'vitest';\n\ndescribe('task manager project', () => { it('has a working test runner', () => { expect(true).toBe(true); }); });\n", lastModified: timestamp },
      );
    }

    const initialTask: TaskItem = {
      id: `task-${timestamp}-1`,
      title: `Bootstrap ${cleanName} architecture`,
      description: params.description || 'Initialize core interfaces, types, and foundational application logic.',
      status: 'pending',
      priority: 'high',
      assignedTo: 'builder-agent',
      targetFiles: ['src/index.ts', 'package.json'],
      createdAt: timestamp,
      subtasks: [
        { id: `sub-${timestamp}-1`, title: 'Define data models and route interfaces', completed: false },
        { id: `sub-${timestamp}-2`, title: 'Implement application business logic', completed: false },
        { id: `sub-${timestamp}-3`, title: 'Add Vitest unit verification tests', completed: false },
      ],
    };

    const projectContext = {
      isExistingProject: false,
      framework,
      language: 'TypeScript',
      packageManager: 'npm',
      scripts: {
        dev: 'npm run dev',
        build: 'npm run build',
        test: 'npm test',
      },
      buildScript: 'npm run build',
      testScript: 'npm test',
      lintScript: 'npm run lint',
      projectStructure: ['src'],
      gitBranch: 'main',
      gitStatus: '',
      gitDirty: false,
      runtimeStartCommand: 'npm run dev',
      source: 'generated' as const,
      generatedAt: timestamp,
    };

    return {
      id: `proj-${timestamp}-${Math.random().toString(36).substring(2, 7)}`,
      name: cleanName,
      tagline: params.tagline || 'Custom autonomous software service',
      description: params.description || 'Full-stack application maintained via Builder Board.',
      framework,
      branch: 'main',
      environment: 'development',
      healthScore: 100,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastActive: timestamp,
      files: defaultFiles,
      tasks: [initialTask],
      tests: [
        {
          id: `test-${timestamp}-1`,
          name: 'should respond 200 OK on GET /health',
          file: 'test/health.test.ts',
          suite: 'Health Suite',
          status: 'idle',
          durationMs: 0,
        },
      ],
      deployments: [],
      history: [
        {
          id: `hist-${timestamp}-1`,
          timestamp,
          type: 'milestone',
          title: `Project workspace "${cleanName}" initialized`,
          description: `Created initial repository structure with ${defaultFiles.length} files.`,
          author: 'Kelvin (Owner)',
        },
      ],
      envVariables: [
        { key: 'PORT', value: '3000', isSecret: false },
        { key: 'NODE_ENV', value: 'development', isSecret: false },
      ],
      projectContext,
    };
  }

  public static analyzeProjectFiles(files: Array<{ path: string; content: string }>, fallbackName = 'Imported Project'): ProjectContext {
    const packageJson = files.find((file) => file.path === 'package.json' || file.path.endsWith('/package.json'));
    const scripts: Record<string, string> = {};
    let packageManager = 'npm';
    let framework = 'Unknown';
    let language = 'Unknown';
    let buildScript: string | undefined;
    let testScript: string | undefined;
    let lintScript: string | undefined;
    let runtimeStartCommand = 'npm run dev';

    if (packageJson) {
      try {
        const parsed = JSON.parse(packageJson.content || '{}') as any;
        if (parsed.name) fallbackName = parsed.name;
        if (parsed.packageManager) {
          packageManager = String(parsed.packageManager).startsWith('npm') ? 'npm' : String(parsed.packageManager).split('@')[0];
        }
        if (parsed.scripts && typeof parsed.scripts === 'object') {
          Object.entries(parsed.scripts).forEach(([key, value]) => {
            if (typeof value === 'string') {
              scripts[key] = value;
            }
          });
          buildScript = scripts.build;
          testScript = scripts.test;
          lintScript = scripts.lint || scripts.typecheck;
          if (scripts.dev) runtimeStartCommand = `${packageManager} run dev`;
          else if (scripts.start) runtimeStartCommand = `${packageManager} run start`;
        }
        const deps = { ...(parsed.dependencies || {}), ...(parsed.devDependencies || {}) };
        if (deps.react || deps['react-dom']) framework = 'React / Vite / TypeScript';
        else if (deps.express) framework = 'Node.js / Express / TypeScript';
        else if (deps.next) framework = 'Next.js';
        else if (deps.vue) framework = 'Vue';
        else if (parsed.type === 'module') framework = 'TypeScript / Node.js';
        if (parsed.type === 'module' || files.some((file) => file.path.endsWith('.ts') || file.path.endsWith('.tsx'))) language = 'TypeScript';
        else if (files.some((file) => file.path.endsWith('.js') || file.path.endsWith('.jsx'))) language = 'JavaScript';
      } catch {
        // ignore malformed package.json and fall back to file-based detection
      }
    }

    const rootEntries = Array.from(new Set(files.map((file) => file.path.split('/')[0]).filter(Boolean))).slice(0, 12);
    const projectStructure = rootEntries.length ? rootEntries : ['src'];

    return {
      isExistingProject: true,
      framework,
      language,
      packageManager,
      scripts,
      buildScript,
      testScript,
      lintScript,
      projectStructure,
      runtimeStartCommand,
      source: 'imported',
      generatedAt: Date.now(),
    };
  }

  /**
   * Import project from parsed JSON
   */
  public static importProjectFromJson(data: unknown): ProjectConfig {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid project file: expected a JSON object');
    }
    const obj = data as Record<string, any>;
    if (!obj.name || !Array.isArray(obj.files)) {
      throw new Error('Invalid project structure: "name" and "files" array are required');
    }

    const timestamp = Date.now();
    const projectFiles = Array.isArray(obj.files) ? obj.files : [];
    const derivedContext = ProjectService.analyzeProjectFiles(projectFiles, String(obj.name || 'Imported Project'));

    return {
      id: `proj-import-${timestamp}-${Math.random().toString(36).substring(2, 6)}`,
      name: String(obj.name),
      tagline: String(obj.tagline || 'Imported Workspace'),
      description: String(obj.description || 'Imported into Builder Board'),
      framework: String(obj.framework || derivedContext.framework || 'TypeScript / Node.js'),
      branch: String(obj.branch || 'main'),
      environment: 'development',
      healthScore: typeof obj.healthScore === 'number' ? obj.healthScore : 95,
      createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : timestamp,
      updatedAt: timestamp,
      lastActive: timestamp,
      files: projectFiles,
      tasks: Array.isArray(obj.tasks) ? obj.tasks : [],
      tests: Array.isArray(obj.tests) ? obj.tests : [],
      deployments: Array.isArray(obj.deployments) ? obj.deployments : [],
      history: [
        ...(Array.isArray(obj.history) ? obj.history : []),
        {
          id: `hist-${timestamp}`,
          timestamp,
          type: 'milestone',
          title: `Project "${obj.name}" imported into workspace`,
          description: `Loaded ${obj.files?.length || 0} files and ${obj.tasks?.length || 0} tasks.`,
          author: 'User',
        },
      ],
      envVariables: Array.isArray(obj.envVariables) ? obj.envVariables : [],
      projectContext: derivedContext,
    };
  }

  /**
   * Import an existing project from a browser-selected local directory without overwriting templates.
   */
  public static importProjectFromFiles(
    files: Array<{ path: string; content: string; lastModified?: number }>,
    fallbackName = 'Imported Project'
  ): ProjectConfig {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('No project files were selected. Please choose a valid local project directory.');
    }

    const normalized = files
      .map((file) => {
        const relativePath = (file.path || '').replace(/^\/+/, '').replace(/\\/g, '/');
        if (!relativePath || relativePath === '/' || relativePath.startsWith('C:')) return null;
        const clean = relativePath.split('/').filter(Boolean).join('/');
        if (!clean) return null;
        return {
          path: clean,
          content: file.content || '',
          lastModified: typeof file.lastModified === 'number' ? file.lastModified : Date.now(),
        };
      })
      .filter(Boolean) as Array<{ path: string; content: string; lastModified: number }>;

    if (!normalized.length) {
      throw new Error('No readable files were found in the selected project directory.');
    }

    const packageJson = normalized.find((f) => f.path.endsWith('package.json'));
    const inferredRoot = packageJson ? packageJson.path.replace(/\/package\.json$/, '') : normalized[0].path.split('/')[0];
    const rootName = packageJson?.content ? (() => {
      try {
        const parsed = JSON.parse(packageJson.content);
        return typeof parsed.name === 'string' ? parsed.name : inferredRoot;
      } catch {
        return inferredRoot;
      }
    })() : inferredRoot || fallbackName;

    const framework = packageJson?.content ? (() => {
      try {
        const parsed = JSON.parse(packageJson.content);
        const deps = { ...parsed.dependencies, ...parsed.devDependencies };
        if (deps.react || deps['react-dom']) return 'React / Vite / TypeScript';
        if (deps.express && deps.typescript) return 'Node.js / Express / TypeScript';
        if (deps.next) return 'Next.js';
        if (deps.vue) return 'Vue';
        return parsed.type === 'module' ? 'TypeScript / Node.js' : 'JavaScript / Node.js';
      } catch {
        return 'TypeScript / Node.js';
      }
    })() : 'TypeScript / Node.js';

    const timestamp = Date.now();
    const importedFiles: ProjectFile[] = normalized.map((file, index) => ({
      id: `f-open-${timestamp}-${index}`,
      path: file.path,
      name: file.path.split('/').pop() || 'file',
      language: file.path.endsWith('.json')
        ? 'json'
        : file.path.endsWith('.md')
          ? 'markdown'
          : file.path.endsWith('.css')
            ? 'css'
            : file.path.endsWith('.tsx') || file.path.endsWith('.ts')
              ? 'typescript'
              : file.path.endsWith('.jsx') || file.path.endsWith('.js')
                ? 'javascript'
                : file.path.endsWith('.html')
                  ? 'html'
                  : 'typescript',
      content: file.content,
      lastModified: file.lastModified,
    }));

    const projectContext = ProjectService.analyzeProjectFiles(normalized, rootName || fallbackName);

    return {
      id: `proj-open-${timestamp}-${Math.random().toString(36).substring(2, 6)}`,
      name: rootName || fallbackName,
      tagline: 'Imported existing project workspace',
      description: `Imported ${normalized.length} files from a local project directory while preserving the original codebase structure.`,
      framework: projectContext.framework || framework,
      branch: 'main',
      environment: 'development',
      healthScore: 96,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastActive: timestamp,
      files: importedFiles,
      tasks: [
        {
          id: `task-open-${timestamp}`,
          title: `Review imported project: ${rootName || fallbackName}`,
          description: 'Inspect the imported workspace, verify setup scripts, and confirm the project is ready to run or edit.',
          status: 'received',
          priority: 'medium',
          assignedTo: 'builder-agent',
          targetFiles: importedFiles.slice(0, 4).map((f) => f.path),
          createdAt: timestamp,
          logs: [`Imported ${normalized.length} files from the existing local workspace.`],
        },
      ],
      tests: [],
      deployments: [],
      history: [
        {
          id: `hist-open-${timestamp}`,
          timestamp,
          type: 'milestone',
          title: `Project "${rootName || fallbackName}" opened from local folder`,
          description: `Loaded ${normalized.length} files while preserving the original repository structure.`,
          author: 'User',
        },
      ],
      envVariables: [],
      projectContext,
    };
  }
}
