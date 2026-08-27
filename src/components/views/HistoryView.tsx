import React, { useState } from 'react';
import {
  History,
  GitCommit,
  Sparkles,
  FileCode,
  Rocket,
  FlaskConical,
  Download,
  Filter,
  ArrowRight,
  Clock,
  User,
} from 'lucide-react';
import { ProjectConfig, HistoryEvent } from '../../types';

interface HistoryViewProps {
  currentProject: ProjectConfig;
  onExportAudit: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  currentProject,
  onExportAudit,
}) => {
  const [filterType, setFilterType] = useState<string>('all');

  const filteredHistory = currentProject.history.filter((ev) => {
    if (filterType === 'all') return true;
    return ev.type === filterType;
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'agent_instruction':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'deployment':
        return <Rocket className="w-4 h-4 text-blue-400" />;
      case 'test_run':
        return <FlaskConical className="w-4 h-4 text-emerald-400" />;
      case 'file_edit':
        return <FileCode className="w-4 h-4 text-purple-400" />;
      default:
        return <GitCommit className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#020617] text-slate-100 p-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-blue-900/40">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">Audit History & Timeline</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/30 border border-blue-500/30 text-blue-300 font-mono">
              {currentProject.history.length} Events
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Immutable changelog of autonomous agent runs, human modifications, and deployment releases.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Event Filter */}
          <div className="flex items-center gap-1 bg-[#030816] border border-blue-900/50 p-1 rounded-lg text-xs">
            {['all', 'agent_instruction', 'deployment', 'test_run'].map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2.5 py-1 rounded capitalize font-medium transition-colors ${
                  filterType === t
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>

          <button
            onClick={onExportAudit}
            className="px-3.5 py-1.5 rounded-lg bg-[#0a101f] hover:bg-blue-900/40 border border-blue-900/50 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Export Audit JSON</span>
          </button>
        </div>
      </div>

      {/* History Timeline */}
      <div className="mt-6 space-y-4 max-w-4xl">
        {filteredHistory.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No history records found for this filter. Run an agent goal to generate session history.
          </div>
        ) : (
          filteredHistory.map((event, idx) => (
            <div
              key={event.id}
              className="relative flex items-start gap-4 p-5 rounded-2xl bg-[#0a101f]/80 backdrop-blur-md border border-blue-900/50 hover:border-amber-500/40 transition-all"
            >
              {/* Icon avatar */}
              <div className="w-10 h-10 rounded-xl bg-[#030816] border border-blue-900/60 flex items-center justify-center shrink-0">
                {getEventIcon(event.type)}
              </div>

              {/* Event Content */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h3 className="text-sm font-bold text-slate-100 leading-snug">{event.title}</h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mt-1">{event.description}</p>

                {/* Diff stats if available */}
                {event.diff && event.diff.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {event.diff.map((d, didx) => (
                      <div
                        key={didx}
                        className="px-2.5 py-1 rounded-lg bg-[#030816] border border-blue-900/50 text-[11px] font-mono flex items-center gap-1.5"
                      >
                        <span className="text-slate-300">{d.file}</span>
                        <span className="text-emerald-400 font-bold">+{d.added}</span>
                        <span className="text-red-400 font-bold">-{d.removed}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 pt-2.5 border-t border-blue-900/30 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3 h-3 text-amber-400" />
                    <span>Author: {event.author}</span>
                  </span>
                  <span className="font-mono text-slate-500 capitalize">
                    Type: {event.type.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
