import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Trash2, Download, Square, CornerDownLeft } from 'lucide-react';
import { BuildLogEntry, TerminalSession } from '../../types';

interface TerminalViewProps {
  logs: BuildLogEntry[];
  activeSession?: TerminalSession | null;
  isExecuting?: boolean;
  onExecuteCommand: (command: string) => void;
  onCancelCommand: () => void;
  onClearLogs: () => void;
}

const QUICK_COMMANDS = [
  { label: 'npm test', cmd: 'npm test' },
  { label: 'npm run build', cmd: 'npm run build' },
  { label: 'npm run lint', cmd: 'npm run lint' },
  { label: 'npm run typecheck', cmd: 'npm run typecheck' },
  { label: 'git status', cmd: 'git status' },
];

const getLevelColor = (level: string) => {
  switch (level) {
    case 'error':
      return 'text-red-400 bg-red-950/40 border-red-900/60';
    case 'warn':
      return 'text-amber-400 bg-amber-950/40 border-amber-900/60';
    case 'success':
      return 'text-emerald-400 bg-emerald-950/40 border-emerald-900/60';
    case 'debug':
      return 'text-blue-400 bg-blue-950/40 border-blue-900/60';
    default:
      return 'text-slate-300 bg-slate-900/40 border-slate-800';
  }
};

export const TerminalView: React.FC<TerminalViewProps> = ({
  logs,
  activeSession,
  isExecuting,
  onExecuteCommand,
  onCancelCommand,
  onClearLogs,
}) => {
  const [commandInput, setCommandInput] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim() || isExecuting) return;
    onExecuteCommand(commandInput.trim());
    setCommandInput('');
  };

  const handleDownload = () => {
    const text = logs
      .map((l) => `[${new Date(l.timestamp).toISOString()}] [${l.level.toUpperCase()}] ${l.source ? `[${l.source}] ` : ''}${l.message}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `builder-board-logs-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#020617] text-slate-100">
      {/* Header */}
      <div className="px-6 py-4 border-b border-blue-900/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <TerminalIcon className="w-4 h-4 text-amber-400" />
          <h1 className="text-lg font-bold text-slate-100">Terminal</h1>
          {activeSession && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1 border ${
                activeSession.status === 'running'
                  ? 'bg-amber-950/60 border-amber-500/50 text-amber-400 animate-pulse'
                  : activeSession.status === 'completed'
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400'
                  : activeSession.status === 'failed'
                  ? 'bg-red-950/60 border-red-500/50 text-red-400'
                  : 'bg-slate-900/80 border-slate-700 text-slate-400'
              }`}
            >
              {activeSession.status.toUpperCase()} ({activeSession.command})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onClearLogs}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/5"
            title="Clear terminal"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/5"
            title="Download log file"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
          </button>
        </div>
      </div>

      {/* Quick commands */}
      <div className="px-6 py-2 border-b border-blue-900/20 flex items-center gap-2 overflow-x-auto text-[11px] font-mono shrink-0">
        <span className="text-slate-500 text-[10px] uppercase tracking-wider shrink-0">Quick:</span>
        {QUICK_COMMANDS.map((qc) => (
          <button
            key={qc.cmd}
            disabled={isExecuting}
            onClick={() => onExecuteCommand(qc.cmd)}
            className="px-2 py-0.5 rounded bg-[#0a101f] hover:bg-blue-900/40 border border-blue-900/50 hover:border-amber-500/50 text-slate-300 hover:text-amber-300 text-[10px] transition-colors shrink-0 disabled:opacity-40"
          >
            {qc.label}
          </button>
        ))}
      </div>

      {/* Log output */}
      <div
        className="flex-1 overflow-y-auto space-y-1 p-4 font-mono text-xs text-slate-300 select-text"
        onScroll={(e) => {
          const el = e.currentTarget;
          setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
        }}
      >
        {logs.length === 0 ? (
          <div className="text-slate-600 text-center py-16 text-xs">
            No output yet. Run a command below to get started.
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 py-0.5 leading-relaxed hover:bg-blue-900/10 px-1 rounded transition-colors">
              <span className="text-slate-600 text-[10px] select-none shrink-0">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className={`text-[10px] px-1 rounded uppercase font-bold border shrink-0 ${getLevelColor(log.level)}`}>
                {log.level}
              </span>
              {log.source && <span className="text-blue-400 text-[10px] shrink-0 font-bold">[{log.source}]</span>}
              <span className="text-slate-200 break-all font-mono text-xs">{log.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Command input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-blue-900/30 bg-[#0a101f] flex items-center gap-2 shrink-0">
        <span className="text-amber-400 font-mono text-xs font-bold pl-1">$</span>
        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          placeholder="Execute command (e.g. npm test, npm run build, tsc --noEmit)..."
          disabled={isExecuting}
          className="flex-1 bg-[#030816] border border-blue-900/60 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500 disabled:opacity-50"
        />
        {isExecuting ? (
          <button
            type="button"
            onClick={onCancelCommand}
            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors active:scale-95 animate-pulse"
          >
            <Square className="w-3 h-3 fill-white" />
            <span>Cancel</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!commandInput.trim()}
            className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-900 font-bold text-xs flex items-center gap-1 transition-colors active:scale-95"
          >
            <span>Run</span>
            <CornerDownLeft className="w-3 h-3" />
          </button>
        )}
      </form>
    </div>
  );
};
