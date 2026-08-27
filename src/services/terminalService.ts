import { TerminalSession, TerminalEvent } from '../types';

export interface ExecuteCommandOptions {
  projectId: string;
  command: string;
  args?: string[];
  workingDirectory?: string;
  files?: Array<{ path: string; content: string }>;
  timeoutMs?: number;
  onEvent?: (event: TerminalEvent) => void;
  onFinished?: (session: TerminalSession) => void;
}

export class TerminalService {
  /**
   * Execute a command in the workspace and stream output via Server-Sent Events (SSE)
   */
  public static async executeCommand(options: ExecuteCommandOptions): Promise<{
    session: TerminalSession;
    cancel: () => Promise<boolean>;
  }> {
    const { projectId, command, args, workingDirectory, files, timeoutMs, onEvent, onFinished } = options;

    const res = await fetch('/api/terminal/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        command,
        args,
        workingDirectory,
        files,
        timeoutMs,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errData.error || `Execution failed with status ${res.status}`);
    }

    const data = await res.json();
    const session: TerminalSession = data.session;
    const sessionId = session.id;

    // Connect SSE Stream
    if (typeof EventSource !== 'undefined') {
      try {
        const sse = new EventSource(`/api/terminal/stream/${encodeURIComponent(sessionId)}`);

        sse.onmessage = (e) => {
          try {
            const eventPayload = JSON.parse(e.data);
            if (eventPayload.type === 'init') {
              // initial state
            } else {
              const termEvent: TerminalEvent = {
                type: eventPayload.type,
                text: eventPayload.text,
                timestamp: eventPayload.timestamp || Date.now(),
              };
              session.events.push(termEvent);
              onEvent?.(termEvent);

              if (eventPayload.type === 'exit') {
                session.status = eventPayload.status || (eventPayload.exitCode === 0 ? 'completed' : 'failed');
                session.exitCode = eventPayload.exitCode;
                session.durationMs = eventPayload.durationMs;
                session.finishedAt = Date.now();
                onFinished?.(session);
                sse.close();
              }
            }
          } catch (parseErr) {
            console.warn('Failed to parse SSE payload:', parseErr);
          }
        };

        sse.onerror = () => {
          sse.close();
        };
      } catch (sseErr) {
        console.warn('Could not establish EventSource:', sseErr);
      }
    }

    const cancel = async (): Promise<boolean> => {
      try {
        const cancelRes = await fetch(`/api/terminal/cancel/${encodeURIComponent(sessionId)}`, {
          method: 'POST',
        });
        return cancelRes.ok;
      } catch {
        return false;
      }
    };

    return { session, cancel };
  }

  /**
   * Cancel an active terminal execution session
   */
  public static async cancelExecution(sessionId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/terminal/cancel/${encodeURIComponent(sessionId)}`, {
        method: 'POST',
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch all terminal execution sessions for a workspace
   */
  public static async fetchSessions(projectId: string): Promise<TerminalSession[]> {
    try {
      const res = await fetch(`/api/terminal/sessions/${encodeURIComponent(projectId)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.sessions) ? data.sessions : [];
    } catch {
      return [];
    }
  }
}
