import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  ChevronDown,
  ChevronUp,
  X,
  Trash2,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { BuildLogEntry } from '../types';

interface OutputLogsDrawerProps {
  isOpen: boolean;
  logs: BuildLogEntry[];
  onToggle: () => void;
  onClear: () => void;
}

export const OutputLogsDrawer: React.FC<OutputLogsDrawerProps> = ({
  isOpen,
  logs,
  onToggle,
  onClear,
}) => {
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen, autoScroll]);

  const filteredLogs = logs.filter((l) => {
    if (filterLevel !== 'all' && l.level !== filterLevel) return false;
    if (search && !l.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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

  return (
    <div
      className={`border-t border-blue-900/40 bg-[#020617] transition-all duration-300 flex flex-col z-40 ${
        isOpen ? 'h-72 sm:h-80' : 'h-8'
      }`}
    >
      {/* Header Bar */}
      <div
        onClick={onToggle}
        className="h-8 bg-[#0a101f] px-3 flex items-center justify-between cursor-pointer select-none text-xs border-b border-blue-900/40"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-bold text-slate-100 font-mono text-[11px] tracking-wide">
            BUILD & OUTPUT LOGS TERMINAL
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-900/30 text-blue-300 font-mono border border-blue-500/20">
            {logs.length} lines
          </span>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {isOpen ? (
            <>
              {/* Filter */}
              <div className="hidden sm:flex items-center gap-1">
                {['all', 'info', 'warn', 'error', 'success'].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setFilterLevel(lvl)}
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono font-semibold transition-colors ${
                      filterLevel === lvl
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              {/* Clear */}
              <button
                onClick={onClear}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800/40"
                title="Clear Logs"
              >
                <Trash2 className="w-3 h-3" />
              </button>

              {/* Download */}
              <button
                onClick={handleDownload}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800/40"
                title="Download Log File"
              >
                <Download className="w-3 h-3 text-blue-400" />
              </button>

              {/* Collapse */}
              <button
                onClick={onToggle}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800/40"
                title="Minimize Drawer"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={onToggle}
              className="p-1 text-slate-400 hover:text-white"
              title="Expand Drawer"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal Body */}
      {isOpen && (
        <div className="flex-1 flex flex-col overflow-hidden p-3 font-mono text-xs text-slate-300 bg-[#030816]">
          <div className="flex-1 overflow-y-auto space-y-1 pr-2 select-text">
            {filteredLogs.length === 0 ? (
              <div className="text-slate-600 text-center py-8 text-xs">
                No logs matching filter. Terminal ready.
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2 py-0.5 leading-relaxed hover:bg-blue-900/10 px-1 rounded transition-colors"
                >
                  <span className="text-slate-600 text-[10px] select-none shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`text-[10px] px-1 rounded uppercase font-bold border shrink-0 ${getLevelColor(
                      log.level
                    )}`}
                  >
                    {log.level}
                  </span>
                  {log.source && (
                    <span className="text-blue-400 text-[10px] shrink-0 font-bold">
                      [{log.source}]
                    </span>
                  )}
                  <span className="text-slate-200 break-all font-sans text-xs">{log.message}</span>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </div>
  );
};
