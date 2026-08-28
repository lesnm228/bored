import { ProjectConfig, ProjectFile, TaskItem } from '../types';
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
          scripts: { dev: 'vite', build: 'tsc --noEmit && vite build', lint: 'tsc --noEmit', typecheck: 'tsc --noEmit', test: 'vitest run' },
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
    return {
      id: `proj-import-${timestamp}-${Math.random().toString(36).substring(2, 6)}`,
      name: String(obj.name),
      tagline: String(obj.tagline || 'Imported Workspace'),
      description: String(obj.description || 'Imported into Builder Board'),
      framework: String(obj.framework || 'TypeScript / Node.js'),
      branch: String(obj.branch || 'main'),
      environment: 'development',
      healthScore: typeof obj.healthScore === 'number' ? obj.healthScore : 95,
      createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : timestamp,
      updatedAt: timestamp,
      lastActive: timestamp,
      files: Array.isArray(obj.files) ? obj.files : [],
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
    };
  }
}
