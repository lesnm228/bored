import React from 'react';
import {
  Play,
  Square,
  FlaskConical,
  Rocket,
  Download,
  Terminal,
  FolderGit2,
  ChevronDown,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
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
  currentView,
  agentState,
  logsOpen,
  onSelectProject,
  onNavigate,
  onToggleLogs,
  onRunAgent,
  onAbortAgent,
  onRunTests,
  onTriggerDeploy,
  onExportZip,
}) => {
  const isAgentActive =
    agentState.status === 'planning' ||
    agentState.status === 'synthesizing' ||
    agentState.status === 'writing_code' ||
    agentState.status === 'running_tests' ||
    agentState.status === 'validating';

  return (
    <header className="h-14 bg-[#0a101f] border-b border-blue-900/50 flex items-center justify-between px-6 z-30 shrink-0 select-none">
      {/* Left side: Brand + Landing Back Button + Quick View Navigation + Project Switcher */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-2.5 group cursor-pointer"
            title="Back to Landing Page"
          >
            <div className="w-8 h-8 bg-amber-500 rounded flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/10">
              <svg className="w-5 h-5 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-amber-500 font-bold tracking-wider text-base uppercase hidden sm:inline">
              Builder Board
            </span>
          </button>
        </div>

        <div className="h-6 w-px bg-blue-900/60 mx-1 hidden md:block" />

        {/* Quick View Links */}
        <div className="hidden md:flex items-center gap-5 text-sm font-medium">
          <button
            onClick={() => onNavigate('agent')}
            className={`transition-colors py-4 ${
              currentView === 'agent'
                ? 'text-blue-400 border-b-2 border-blue-400 font-semibold'
                : 'text-slate-400 hover:text-blue-200'
            }`}
          >
            Workspace
          </button>
          <button
            onClick={() => onNavigate('history')}
            className={`transition-colors py-4 ${
              currentView === 'history'
                ? 'text-blue-400 border-b-2 border-blue-400 font-semibold'
                : 'text-slate-400 hover:text-blue-200'
            }`}
          >
            History
          </button>
          <button
            onClick={() => onNavigate('settings')}
            className={`transition-colors py-4 ${
              currentView === 'settings'
                ? 'text-blue-400 border-b-2 border-blue-400 font-semibold'
                : 'text-slate-400 hover:text-blue-200'
            }`}
          >
            Settings
          </button>
        </div>

        <div className="h-6 w-px bg-blue-900/60 mx-1 hidden lg:block" />

        {/* Project Selector Dropdown */}
        <div className="relative group hidden sm:block">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#030816] border border-blue-900/50 hover:border-amber-500/40 cursor-pointer transition-colors text-xs">
            <FolderGit2 className="w-3.5 h-3.5 text-blue-400" />
            <select
              aria-label="Active Project"
              value={currentProject.id}
              onChange={(e) => onSelectProject(e.target.value)}
              className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer pr-3"
            >
              {allProjects.map((proj) => (
                <option key={proj.id} value={proj.id} className="bg-[#0a101f] text-white">
                  {proj.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Center: Agent Live Status Indicator */}
      <div className="hidden xl:flex items-center gap-2">
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium transition-all ${
            isAgentActive
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_8px_#fbbf24]'
              : agentState.status === 'completed'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : agentState.status === 'aborted'
              ? 'bg-red-500/15 border-red-500/40 text-red-300'
              : 'bg-[#030816] border-blue-900/50 text-slate-400'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isAgentActive
                ? 'bg-amber-400 animate-ping'
                : agentState.status === 'completed'
                ? 'bg-emerald-400'
                : agentState.status === 'aborted'
                ? 'bg-red-400'
                : 'bg-blue-400'
            }`}
          />
          <span className="capitalize text-[11px] font-mono">
            {isAgentActive
              ? `Running [Step ${agentState.currentStepIndex}/${agentState.totalSteps}]`
              : `Agent ${agentState.status}`}
          </span>
        </div>
      </div>

      {/* Right Side: Primary Project Controls */}
      <div className="flex items-center gap-2.5">
        {/* Agent Stop / Abort (Warning Red) */}
        {isAgentActive ? (
          <button
            onClick={onAbortAgent}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all shadow-lg shadow-red-900/20 active:scale-95 animate-pulse"
            title="Stop Builder Agent execution immediately"
          >
            <Square className="w-3.5 h-3.5 fill-white" />
            <span>ABORT BUILD</span>
          </button>
        ) : (
          <button
            onClick={onRunAgent}
            className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-colors flex items-center gap-1.5 shadow-md shadow-blue-600/20 active:scale-95"
            title="Start Building with current goal"
          >
            <Play className="w-3 h-3 fill-white" />
            <span>Start Building</span>
          </button>
        )}

        {/* Open Project / Projects switch button */}
        <button
          onClick={() => onNavigate('projects')}
          className="px-3.5 py-1.5 rounded border border-blue-900 text-slate-400 text-xs font-semibold hover:bg-blue-900/30 hover:text-slate-200 transition-colors hidden sm:flex items-center gap-1.5"
        >
          <FolderGit2 className="w-3 h-3 text-blue-400" />
          <span>Open Project</span>
        </button>

        {/* Run Tests Button */}
        <button
          onClick={onRunTests}
          className="px-3 py-1.5 rounded bg-[#030816] hover:bg-blue-900/40 border border-blue-900/50 text-slate-300 text-xs font-medium hidden md:flex items-center gap-1.5 transition-colors"
          title="Run project test suites"
        >
          <FlaskConical className="w-3.5 h-3.5 text-blue-400" />
          <span>Tests</span>
        </button>

        {/* Trigger Deployment Button */}
        <button
          onClick={onTriggerDeploy}
          className="px-3 py-1.5 rounded bg-[#030816] hover:bg-blue-900/40 border border-blue-900/50 text-slate-300 text-xs font-medium hidden lg:flex items-center gap-1.5 transition-colors"
          title="Deploy to Staging / Production"
        >
          <Rocket className="w-3.5 h-3.5 text-amber-400" />
          <span>Deploy</span>
        </button>

        {/* Export ZIP Button */}
        <button
          onClick={onExportZip}
          className="p-1.5 rounded bg-[#030816] hover:bg-blue-900/40 border border-blue-900/50 text-slate-400 hover:text-white transition-colors"
          title="Export project bundle as ZIP"
        >
          <Download className="w-3.5 h-3.5 text-blue-400" />
        </button>

        {/* Toggle Logs Drawer */}
        <button
          onClick={onToggleLogs}
          className={`p-1.5 rounded border transition-colors flex items-center gap-1 text-xs font-mono ${
            logsOpen
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
              : 'bg-[#030816] border-blue-900/50 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Build / Output Logs Terminal"
        >
          <Terminal className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden xl:inline text-[11px]">Logs</span>
        </button>
      </div>
    </header>
  );
};
