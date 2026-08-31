import React from 'react';
import {
  MessageSquare,
  FolderGit2,
  FileCode2,
  TerminalSquare,
  FlaskConical,
  Monitor,
  ListChecks,
  Settings,
} from 'lucide-react';
import { WorkspaceView, ProjectConfig, AgentRunState } from '../types';

interface SidebarProps {
  currentView: WorkspaceView;
  currentProject: ProjectConfig;
  agentState: AgentRunState;
  onNavigate: (view: WorkspaceView) => void;
}

// Nav order matches the approved Builder Board UI reference exactly:
// Chat, Projects, Files, Terminal, Tests, Preview, Tasks, Settings.
// History and Deployments are intentionally not in the primary rail —
// they remain fully functional, reachable from Settings and the header's
// secondary menu.
const NAV_ITEMS: { id: WorkspaceView; label: string; icon: React.ElementType }[] = [
  { id: 'agent', label: 'Chat', icon: MessageSquare },
  { id: 'projects', label: 'Projects', icon: FolderGit2 },
  { id: 'files', label: 'Files', icon: FileCode2 },
  { id: 'terminal', label: 'Terminal', icon: TerminalSquare },
  { id: 'tests', label: 'Tests', icon: FlaskConical },
  { id: 'preview', label: 'Preview', icon: Monitor },
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  return (
    <aside className="w-full md:w-52 bg-[#0a1024] border-b md:border-b-0 md:border-r border-blue-900/30 flex flex-row md:flex-col shrink-0 select-none z-20">
      <nav className="flex-none md:flex-1 flex flex-row md:flex-col gap-1 p-2 md:p-3 md:pt-4 overflow-x-auto md:overflow-visible">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex shrink-0 items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-amber-400 text-slate-900 font-semibold shadow-sm shadow-amber-500/20'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer brand mark */}
      <div className="hidden md:flex p-4 items-center gap-2.5 border-t border-blue-900/30">
        <div className="w-6 h-6 rounded bg-amber-400 flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="text-xs font-bold text-slate-100">Builder Board</div>
          <div className="text-[10px] text-slate-500">Build • Create • Ship</div>
        </div>
      </div>
    </aside>
  );
};
