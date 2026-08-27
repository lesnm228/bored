import React, { useState } from 'react';
import {
  Play,
  FolderOpen,
  Terminal,
  Cpu,
  CheckCircle2,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity,
  Code2,
  FolderGit2,
  Sliders,
  ChevronRight,
  MessageSquare,
  Lock,
} from 'lucide-react';
import { ProjectConfig, WorkspaceView } from '../types';
import eagleHeroBg from '../assets/images/eagle_hero_bg_1787772381138.jpg';
import eagleWideBg from '../assets/images/eagle_wide_bg_1787772397793.jpg';

interface LandingPageProps {
  projects: ProjectConfig[];
  currentProject: ProjectConfig;
  onSelectProject: (projectId: string) => void;
  onNavigate: (view: WorkspaceView) => void;
  onQuickStart: (goal: string) => void;
  onOpenNewProjectModal: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  projects,
  currentProject,
  onSelectProject,
  onNavigate,
  onQuickStart,
  onOpenNewProjectModal,
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [selectedEnv, setSelectedEnv] = useState<'production' | 'staging' | 'dev'>('production');

  const handleLaunch = (e: React.FormEvent) => {
    e.preventDefault();
    if (promptInput.trim()) {
      onQuickStart(promptInput.trim());
    } else {
      onNavigate('agent');
    }
  };

  const sampleSuggestions = [
    'Implement Redis token bucket rate limiting on /api/v1/stream',
    'Add JWT RS256 token verification middleware with JWKS cache',
    'Construct full Vitest test suite for WebSocket stream router',
    'Create automated health diagnostics & telemetry collector',
  ];

  return (
    <div className="relative min-h-screen bg-[#020617] text-slate-100 font-sans flex flex-col selection:bg-amber-500/30 selection:text-amber-200 overflow-x-hidden">
      {/* Background with the authentic realistic eagle and dramatic blue-and-gold atmosphere */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Eagle backdrop layer */}
        <picture>
          <source media="(min-width: 1024px)" srcSet={eagleWideBg} />
          <img
            src={eagleHeroBg}
            alt="Majestic realistic eagle in dramatic blue and gold atmosphere"
            className="w-full h-full object-cover object-top opacity-35 filter brightness-90 contrast-110 transform scale-105"
            referrerPolicy="no-referrer"
          />
        </picture>
        {/* Navy and Gold Atmospheric Vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#020617]/80 via-[#020617]/65 to-[#020617]" />
        <div className="absolute inset-0 bg-radial from-transparent via-[#020617]/50 to-[#020617]" />
        {/* Subtle golden ambient glow at the top center */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-96 bg-amber-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Top Navigation Bar */}
      <header className="relative z-10 border-b border-blue-900/40 bg-[#0a101f]/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-900/40 border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/5 text-amber-400 font-bold text-lg tracking-wider">
              BB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white font-sans">
                  Builder<span className="text-amber-400">Board</span>
                </span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Production
                </span>
              </div>
              <p className="text-xs text-slate-400">Autonomous Software Building Workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* System Status Indicator */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#030816] border border-blue-900/50 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-300 font-medium">Service ready</span>
              <span className="text-slate-500">|</span>
              <span className="text-amber-400 font-medium">All systems operational</span>
            </div>

            {/* Environment Toggle */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#030816] border border-blue-900/50 text-xs">
              <span className="text-slate-400">Env:</span>
              <select
                aria-label="Workspace Environment"
                value={selectedEnv}
                onChange={(e) => setSelectedEnv(e.target.value as 'production' | 'staging' | 'dev')}
                className="bg-transparent text-amber-300 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="production" className="bg-[#0a101f] text-white">Production</option>
                <option value="staging" className="bg-[#0a101f] text-white">Staging</option>
                <option value="dev" className="bg-[#0a101f] text-white">Development</option>
              </select>
            </div>

            <button
              onClick={() => onNavigate('projects')}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#030816] hover:bg-blue-900/40 text-slate-200 border border-blue-900/50 transition-colors flex items-center gap-1.5"
            >
              <FolderGit2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Projects ({projects.length})</span>
            </button>

            <button
              onClick={() => onNavigate('agent')}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 transition-all transform active:scale-95 flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-slate-950" />
              <span>Enter Workspace</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Hero & Landing Section */}
      <main className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-6 py-8 md:py-12 flex flex-col justify-between">
        {/* Eagle Atmospheric Centerpiece Greeting */}
        <div className="text-center space-y-4 max-w-3xl mx-auto pt-4 md:pt-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Autonomous Software-Building Workspace</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Hi Kelvin, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500">
              what should we build today?
            </span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto font-normal">
            Your high-precision autonomous builder agent for full-stack engineering, testing, deployments, and live runtime systems.
          </p>
        </div>

        {/* Primary Command & Instruction Input Box */}
        <div className="mt-8 max-w-3xl mx-auto w-full">
          <form
            onSubmit={handleLaunch}
            className="relative rounded-2xl bg-[#0a101f]/90 border border-blue-900/60 p-3 sm:p-4 shadow-2xl backdrop-blur-xl focus-within:border-amber-500/70 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all"
          >
            <div className="flex items-center gap-2 px-2 pb-2">
              <span className="flex h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                Autonomous Builder Agent
              </span>
              <span className="text-xs text-slate-500 ml-auto">
                Target: {currentProject.name}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="pl-3 text-amber-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="Give an instruction: e.g. 'Implement rate limiter, write Vitest suite, configure deployment...'"
                className="w-full bg-transparent text-white placeholder-slate-400 text-sm sm:text-base focus:outline-none py-2"
              />
              <button
                type="submit"
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg shadow-amber-500/25 transition-all shrink-0 active:scale-95"
              >
                <span>Start Building</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Suggestions Chips */}
            <div className="mt-3 pt-3 border-t border-blue-900/40 flex flex-wrap gap-2 items-center px-1">
              <span className="text-xs text-slate-400 font-medium">Quick Goals:</span>
              {sampleSuggestions.map((sug, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPromptInput(sug)}
                  className="text-xs px-2.5 py-1 rounded-md bg-[#030816] hover:bg-blue-900/40 border border-blue-900/50 hover:border-amber-500/40 text-slate-300 hover:text-amber-300 transition-colors text-left truncate max-w-xs"
                >
                  {sug}
                </button>
              ))}
            </div>
          </form>
        </div>

        {/* Primary Action & Workspace Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">
          {/* Card 1: Ask Builder Agent */}
          <div
            onClick={() => onNavigate('agent')}
            className="group relative rounded-2xl bg-[#0a101f]/80 border border-blue-900/50 hover:border-amber-500/60 p-5 backdrop-blur-md cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="w-12 h-12 rounded-xl bg-[#030816] border border-blue-900/60 text-blue-400 flex items-center justify-center mb-4 group-hover:text-amber-400 group-hover:border-amber-500/40 transition-colors">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors flex items-center justify-between">
              <span>Builder Agent</span>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all text-amber-400" />
            </h2>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Autonomous multi-step coding, planning, execution, and self-correction engine.
            </p>
            <div className="mt-4 pt-3 border-t border-blue-900/30 flex items-center justify-between text-xs text-amber-400/90 font-medium">
              <span>Run Agent</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 2: View Tasks */}
          <div
            onClick={() => onNavigate('tasks')}
            className="group relative rounded-2xl bg-[#0a101f]/80 border border-blue-900/50 hover:border-amber-500/60 p-5 backdrop-blur-md cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="w-12 h-12 rounded-xl bg-[#030816] border border-blue-900/60 text-amber-400 flex items-center justify-center mb-4 group-hover:border-amber-500/40 transition-colors">
              <Layers className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors flex items-center justify-between">
              <span>View Tasks</span>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all text-amber-400" />
            </h2>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              {currentProject.tasks.length} active tasks queued. Track real-time progress and sub-step checklists.
            </p>
            <div className="mt-4 pt-3 border-t border-blue-900/30 flex items-center justify-between text-xs text-amber-400/90 font-medium">
              <span>Inspect Queue</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 3: Files & Code Workspace */}
          <div
            onClick={() => onNavigate('files')}
            className="group relative rounded-2xl bg-[#0a101f]/80 border border-blue-900/50 hover:border-amber-500/60 p-5 backdrop-blur-md cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="w-12 h-12 rounded-xl bg-[#030816] border border-blue-900/60 text-purple-400 flex items-center justify-center mb-4 group-hover:text-amber-400 group-hover:border-amber-500/40 transition-colors">
              <Code2 className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors flex items-center justify-between">
              <span>Files & Editor</span>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all text-amber-400" />
            </h2>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              {currentProject.files.length} project files. Interactive virtual filesystem, diffs, and syntax highlights.
            </p>
            <div className="mt-4 pt-3 border-t border-blue-900/30 flex items-center justify-between text-xs text-amber-400/90 font-medium">
              <span>Open Code IDE</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 4: Projects & Deployments */}
          <div
            onClick={() => onNavigate('projects')}
            className="group relative rounded-2xl bg-[#0a101f]/80 border border-blue-900/50 hover:border-amber-500/60 p-5 backdrop-blur-md cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="w-12 h-12 rounded-xl bg-[#030816] border border-blue-900/60 text-blue-400 flex items-center justify-center mb-4 group-hover:text-amber-400 group-hover:border-amber-500/40 transition-colors">
              <FolderOpen className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors flex items-center justify-between">
              <span>My Projects</span>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all text-amber-400" />
            </h2>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Manage {projects.length} workspaces. Switch branches, export ZIP, or initiate new repositories.
            </p>
            <div className="mt-4 pt-3 border-t border-blue-900/30 flex items-center justify-between text-xs text-amber-400/90 font-medium">
              <span>View Projects</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Quick Launch & Active Workspace Summary */}
        <div className="mt-8 rounded-2xl bg-[#0a101f]/80 border border-blue-900/40 p-5 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Active Workspace:</span>
                <span className="text-sm font-bold text-white">{currentProject.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-900/30 border border-blue-500/30 text-blue-300 font-mono">
                  {currentProject.branch}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{currentProject.tagline}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              onClick={onOpenNewProjectModal}
              className="flex-1 md:flex-none px-4 py-2 rounded-lg bg-[#030816] hover:bg-blue-900/40 text-slate-200 border border-blue-900/50 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
              <span>Create / Open Project</span>
            </button>
            <button
              onClick={() => onNavigate('agent')}
              className="flex-1 md:flex-none px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-slate-950" />
              <span>Open Builder Board</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer info & Security status */}
      <footer className="relative z-10 border-t border-blue-900/40 bg-[#020617]/90 py-4 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Owner Mode</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Encrypted Runtime</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <span>Confidence 98%</span>
            </span>
          </div>

          <div className="text-slate-500 text-center sm:text-right">
            Builder Board — Autonomous Production Software Engineering Workspace
          </div>
        </div>
      </footer>
    </div>
  );
};
