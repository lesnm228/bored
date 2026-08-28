import { ProjectFile, TerminalSession } from '../types';

export interface RuntimeProcess {
  projectId: string;
  sessionId: string;
  pid?: number;
  port?: number;
  startedAt?: number;
  state: 'STARTING' | 'RUNNING' | 'FAILED' | 'STOPPED';
  error?: string;
}

interface RuntimeResponse<T> {
  success: boolean;
  error?: string;
  session?: TerminalSession;
  runtime?: RuntimeProcess;
  packageManager?: string | { name: string; command: string; reason: string };
  detection?: string;
  readiness?: string;
  [key: string]: unknown;
}

export class RuntimeService {
  private static async request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) throw new Error(data.error || `Runtime request failed (${response.status})`);
    return data as T;
  }

  public static prepare(projectId: string, files: ProjectFile[], signal?: AbortSignal) {
    return this.request<RuntimeResponse<unknown>>('/api/runtime/prepare', { projectId, files }, signal);
  }

  public static install(projectId: string, files: ProjectFile[], signal?: AbortSignal) {
    return this.request<RuntimeResponse<unknown>>('/api/runtime/install', { projectId, files }, signal);
  }

  public static runScript(projectId: string, files: ProjectFile[], script: 'lint' | 'typecheck' | 'test' | 'build', signal?: AbortSignal) {
    return this.request<RuntimeResponse<unknown>>('/api/runtime/command', { projectId, files, script }, signal);
  }

  public static startDev(projectId: string, files: ProjectFile[], signal?: AbortSignal) {
    return this.request<RuntimeResponse<unknown>>('/api/runtime/dev/start', { projectId, files }, signal);
  }

  public static stopDev(projectId: string) {
    return this.request<RuntimeResponse<unknown>>(`/api/runtime/dev/stop/${encodeURIComponent(projectId)}`);
  }

  public static async checkPreview(projectId: string, signal?: AbortSignal): Promise<void> {
    const response = await fetch(`/api/runtime/preview/${encodeURIComponent(projectId)}/`, { signal });
    if (!response.ok) throw new Error(`Real preview endpoint failed (${response.status}).`);
  }

  public static cancelSession(sessionId: string) {
    return fetch(`/api/terminal/cancel/${encodeURIComponent(sessionId)}`, { method: 'POST' });
  }

  public static async waitForSession(projectId: string, sessionId: string, signal?: AbortSignal): Promise<TerminalSession> {
    for (;;) {
      if (signal?.aborted) throw new Error('Aborted by user');
      const data = await this.request<{ sessions: TerminalSession[] }>(`/api/terminal/sessions/${encodeURIComponent(projectId)}`);
      const session = data.sessions.find((candidate) => candidate.id === sessionId);
      if (session && session.status !== 'running') return session;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 200);
        signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Aborted by user')); }, { once: true });
      });
    }
  }
}
