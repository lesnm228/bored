import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Square,
  Settings as SettingsIcon,
  ChevronDown,
  History,
  Rocket,
  FlaskConical,
  Download,
  Terminal,
  FolderGit2,
} from 'lucide-react';
import { ProjectConfig, AgentRunState, WorkspaceView } from '../types';

interface HeaderNavProps {
  currentProject: ProjectConfig;
  allProjects: ProjectConfig[];
  currentView: WorkspaceView;
  agentState: AgentRunState;
  logsOpen: boolean;
  onSelectProject: (projectId: string) => void;
  onNavigate: (view: WorkspaceView) => void;
  onToggleLogs: () => void;
  onRunAgent: () => void;
  onAbortAgent: () => void;
  onRunTests: () => void;
  onTriggerDeploy: () => void;
  onExportZip: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  currentProject,
  allProjects,
  logsOpen,
  agentState,
  onSelectProject,
  onNavigate,
  onToggleLogs,
  onRunAgent,
  onAbortAgent,
  onRunTests,
  onTriggerDeploy,
  onExportZip,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAgentActive =
    agentState.status === 'planning' ||
    agentState.status === 'synthesizing' ||
    agentState.status === 'writing_code' ||
    agentState.status === 'running_tests' ||
    agentState.status === 'validating';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="h-14 bg-[#0a1024] border-b border-blue-900/30 flex items-center justify-between px-4 z-30 shrink-0 select-none">
      {/* Left: Brand + Project Switcher */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-2 group cursor-pointer"
          title="Back to Landing Page"
        >
          <div className="w-7 h-7 bg-amber-400 rounded flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-slate-100 font-bold text-sm hidden sm:inline">Builder Board</span>
        </button>

        <div className="relative hidden sm:block">
          <select
            aria-label="Active Project"
            value={currentProject.id}
            onChange={(e) => onSelectProject(e.target.value)}
            className="appearance-none bg-transparent text-slate-300 text-sm font-medium pr-5 focus:outline-none cursor-pointer hover:text-white"
          >
            {allProjects.map((proj) => (
              <option key={proj.id} value={proj.id} className="bg-[#0a1024] text-white">
                {proj.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Right: Settings, Run, Avatar + secondary menu */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => onNavigate('settings')}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>

        {isAgentActive ? (
          <button
            onClick={onAbortAgent}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-all shadow-sm active:scale-95 animate-pulse"
            title="Stop Builder Agent execution immediately"
          >
            <Square className="w-3 h-3 fill-white" />
            <span>Stop</span>
          </button>
        ) : (
          <button
            onClick={onRunAgent}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold text-xs transition-all shadow-sm active:scale-95"
            title="Run Builder Agent"
          >
            <Play className="w-3 h-3 fill-slate-900" />
            <span>Run</span>
          </button>
        )}

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-xs flex items-center justify-center transition-colors"
            title="More options"
          >
            U
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-11 w-56 bg-[#0f1730] border border-blue-900/50 rounded-xl shadow-xl py-1.5 text-xs z-50">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                Workspace
              </div>
              <button
                onClick={() => { onNavigate('history'); setMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <History className="w-3.5 h-3.5 text-blue-400" />
                <span>History</span>
              </button>
              <button
                onClick={() => { onNavigate('deployments'); setMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <Rocket className="w-3.5 h-3.5 text-amber-400" />
                <span>Deployments</span>
              </button>

              <div className="my-1 border-t border-blue-900/30" />

              <button
                onClick={() => { onRunTests(); setMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <FlaskConical className="w-3.5 h-3.5 text-blue-400" />
                <span>Run All Tests</span>
              </button>
              <button
                onClick={() => { onTriggerDeploy(); setMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <Rocket className="w-3.5 h-3.5 text-amber-400" />
                <span>Deploy to Staging</span>
              </button>
              <button
                onClick={() => { onExportZip(); setMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span>Export Project ZIP</span>
              </button>
              <button
                onClick={() => { onToggleLogs(); setMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                <span>{logsOpen ? 'Hide' : 'Show'} Build Logs</span>
              </button>

              <div className="my-1 border-t border-blue-900/30" />

              <button
                onClick={() => { onNavigate('projects'); setMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <FolderGit2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Open Project</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
