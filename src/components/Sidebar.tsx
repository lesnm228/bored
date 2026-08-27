import React from 'react';
import {
  Sparkles,
  FolderGit2,
  Code2,
  Layers,
  FlaskConical,
  Rocket,
  History,
  Settings,
  ShieldCheck,
  Zap,
  Activity,
  ArrowLeft,
  ChevronRight,
  HelpCircle,
  LogOut,
} from 'lucide-react';
import { WorkspaceView, ProjectConfig, AgentRunState } from '../types';

interface SidebarProps {
  currentView: WorkspaceView;
  currentProject: ProjectConfig;
  agentState: AgentRunState;
  onNavigate: (view: WorkspaceView) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  currentProject,
  agentState,
  onNavigate,
}) => {
  const pendingTasksCount = currentProject.tasks.filter((t) => t.status !== 'completed').length;
  const passedTestsCount = currentProject.tests.filter((t) => t.status === 'passed').length;

  const navItems = [
    { id: 'agent', label: 'Builder Agent', icon: Sparkles, badge: agentState.status !== 'idle' ? 'Active' : undefined, badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    { id: 'tasks', label: 'Tasks', icon: Layers, badge: pendingTasksCount > 0 ? `${pendingTasksCount}` : undefined, badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    { id: 'files', label: 'Files', icon: Code2, badge: `${currentProject.files.length}`, badgeColor: 'bg-slate-800 text-slate-400 border-slate-700' },
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'tests', label: 'Tests', icon: FlaskConical, badge: `${passedTestsCount}/${currentProject.tests.length}`, badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    { id: 'deployments', label: 'Deployments', icon: Rocket },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-56 bg-[#030816] border-r border-blue-900/40 p-4 flex flex-col gap-1 select-none z-20 shrink-0">
      {/* Category: Main Console */}
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 px-3 flex items-center justify-between">
        <span>Main Console</span>
        <button
          onClick={() => onNavigate('landing')}
          className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium transition-colors lowercase"
          title="Back to Landing Page"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>landing</span>
        </button>
      </div>

      {navItems.slice(0, 4).map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id as WorkspaceView)}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
              isActive
                ? 'bg-blue-900/20 text-blue-300 font-medium border border-blue-500/20'
                : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon
                className={`w-4 h-4 ${
                  isActive ? 'text-amber-400' : 'text-slate-400'
                }`}
              />
              <span>{item.label}</span>
            </div>
            {item.badge && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border font-mono font-bold ${item.badgeColor}`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}

      {/* Category: Operations */}
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 mt-4 px-3">
        Operations
      </div>

      {navItems.slice(4).map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id as WorkspaceView)}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
              isActive
                ? 'bg-blue-900/20 text-blue-300 font-medium border border-blue-500/20'
                : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon
                className={`w-4 h-4 ${
                  isActive ? 'text-amber-400' : 'text-slate-400'
                }`}
              />
              <span>{item.label}</span>
            </div>
            {item.badge && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border font-mono font-bold ${item.badgeColor}`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}

      {/* Bottom Card: Active Node */}
      <div className="mt-auto p-4 bg-[#0a101f] border border-blue-900/50 rounded-xl mb-1">
        <div className="text-[10px] font-bold text-amber-500 uppercase mb-1">Active Node</div>
        <div className="text-xs text-slate-200 font-semibold truncate">{currentProject.name}</div>
        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{currentProject.branch}</div>
        <div className="flex items-center gap-1.5 mt-2.5">
          <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
          <span className="text-[10px] text-blue-400 uppercase tracking-tighter font-mono font-bold">
            Live Stream v1.2
          </span>
        </div>
      </div>
    </aside>
  );
};
