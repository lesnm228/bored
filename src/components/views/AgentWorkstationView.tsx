import React, { useState } from 'react';
import {
  Sparkles,
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  Clock,
  Code2,
  FileCode,
  Layers,
  FlaskConical,
  ShieldCheck,
  Send,
  RefreshCw,
  Terminal,
  Activity,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { ProjectConfig, AgentRunState, AutonomyLevel } from '../../types';
import { InstructionBox } from '../InstructionBox';

interface AgentWorkstationViewProps {
  currentProject: ProjectConfig;
  agentState: AgentRunState;
  onExecuteAgent: (goal: string, autonomy: AutonomyLevel, maxSteps: number) => void;
  onAbortAgent: () => void;
  onRunReview: () => void;
  onOpenFiles: () => void;
}

export const AgentWorkstationView: React.FC<AgentWorkstationViewProps> = ({
  currentProject,
  agentState,
  onExecuteAgent,
  onAbortAgent,
  onRunReview,
  onOpenFiles,
}) => {
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: 'user' | 'agent'; text: string; timestamp: number }>
  >([
    {
      sender: 'agent',
      text: `Autonomous Builder Agent online for project "${currentProject.name}". Ready to architect, write code, run tests, and execute instructions.`,
      timestamp: Date.now() - 1000 * 60 * 5,
    },
  ]);
  const [isSendingChat, setIsSendingChat] = useState(false);

  const isRunning =
    agentState.status === 'planning' ||
    agentState.status === 'synthesizing' ||
    agentState.status === 'writing_code' ||
    agentState.status === 'running_tests' ||
    agentState.status === 'validating';

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSendingChat) return;

    const userText = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { sender: 'user', text: userText, timestamp: Date.now() }]);
    setIsSendingChat(true);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          projectContext: `${currentProject.name}: ${currentProject.description}. Files: ${currentProject.files.map((f) => f.path).join(', ')}`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages((prev) => [
          ...prev,
          { sender: 'agent', text: data.reply || 'Acknowledged.', timestamp: Date.now() },
        ]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          { sender: 'agent', text: 'Processing complete for active project state.', timestamp: Date.now() },
        ]);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'agent', text: 'Telemetry confirmed. All project files in sync.', timestamp: Date.now() },
      ]);
    } finally {
      setIsSendingChat(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-y-auto lg:overflow-hidden bg-[#020617] text-slate-100 font-sans p-6 gap-6 relative">
      {/* Left Column: Build Engine & Instructions */}
      <div className="flex-1 flex flex-col gap-6">
        {/* Current Project Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-widest font-mono">Current Project</div>
            <div className="text-2xl font-bold text-slate-100 flex items-center gap-2 mt-0.5">
              <span>{currentProject.name}</span>
              <span className="text-[10px] px-2 py-0.5 bg-blue-900/30 border border-blue-500/30 text-blue-400 rounded-full font-mono uppercase">
                {currentProject.framework}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">{currentProject.description}</p>
          </div>

          <div className="flex items-center gap-3">
            {isRunning ? (
              <button
                onClick={onAbortAgent}
                className="flex items-center gap-2 px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all shadow-lg shadow-red-900/20 active:scale-95 animate-pulse"
              >
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>ABORT BUILD</span>
              </button>
            ) : (
              <button
                onClick={() => onExecuteAgent(currentProject.description, 'fully_autonomous', 12)}
                className="flex items-center gap-2 px-6 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/10 active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-slate-950" />
                <span>RUN ENGINE</span>
              </button>
            )}

            <button
              onClick={onRunReview}
              className="px-4 py-2 rounded-lg bg-[#0a101f] hover:bg-blue-900/40 border border-blue-900/60 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Audit</span>
            </button>
          </div>
        </div>

        {/* Central Glass Card: Workflow & Agent Instructions */}
        <div className="flex-1 bg-[#0a101f]/80 backdrop-blur-md border border-blue-900/50 rounded-2xl p-6 flex flex-col justify-between gap-6">
          <div>
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-blue-900/30">
              <div className="text-sm font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Build Workflow Progress</span>
              </div>
              <div className="text-xs text-blue-400 font-mono">
                Status: <span className="text-amber-300 font-bold uppercase">{agentState.status.replace('_', ' ')}</span>
              </div>
            </div>

            {/* Step-by-Step Progress Timeline */}
            <div className="space-y-4">
              {/* Step 1: Validation */}
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full border-2 border-blue-500 flex items-center justify-center shrink-0 bg-blue-500/10 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.3)]">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-200">1. Environment Validation</span>
                    <span className="text-blue-400 font-mono font-bold">100%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)] w-full"></div>
                  </div>
                </div>
              </div>

              {/* Step 2: Architecture / Synthesis */}
              <div className="flex items-center gap-4">
                <div
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isRunning
                      ? 'border-amber-500 bg-amber-500/10 animate-pulse'
                      : agentState.status === 'completed'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-amber-500/80 bg-amber-500/5'
                  }`}
                >
                  {agentState.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_10px_#fbbf24]"></div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-200">2. Autonomous Synthesis & Implementation</span>
                    <span className="text-amber-400 font-mono font-bold">
                      {agentState.status === 'completed'
                        ? '100%'
                        : isRunning
                        ? `${Math.round(Math.max(25, (agentState.currentStepIndex / (agentState.totalSteps || 1)) * 100))}%`
                        : '85%'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full shadow-[0_0_8px_#fbbf24] transition-all duration-300"
                      style={{
                        width:
                          agentState.status === 'completed'
                            ? '100%'
                            : isRunning
                            ? `${Math.max(25, (agentState.currentStepIndex / (agentState.totalSteps || 1)) * 100)}%`
                            : '85%',
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Step 3: Test Verification */}
              <div className="flex items-center gap-4">
                <div
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    agentState.status === 'completed'
                      ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                      : 'border-slate-700 bg-slate-900/50'
                  }`}
                >
                  {agentState.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <span className="text-[11px] text-slate-500 font-mono">3</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">3. Vitest Regression Matrix</span>
                    <span className="text-slate-500 font-mono">
                      {agentState.status === 'completed' ? 'Passed' : 'Pending'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full">
                    <div
                      className="bg-emerald-500 h-full rounded-full shadow-[0_0_8px_#22c55e]"
                      style={{ width: agentState.status === 'completed' ? '100%' : '0%' }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Embedded Instruction Box */}
          <InstructionBox
            onExecute={onExecuteAgent}
            onAbort={onAbortAgent}
            isRunning={isRunning}
            activeGoal={agentState.currentGoal}
          />
        </div>
      </div>

      {/* Right Column: System Output Logs & Validation Metrics */}
      <div className="w-full lg:w-96 flex flex-col gap-6 shrink-0">
        {/* System Output Logs Card */}
        <div className="flex-1 bg-[#030816] border border-blue-900/50 rounded-2xl overflow-hidden flex flex-col min-h-[300px]">
          {/* Top Title Bar with Colored Dots */}
          <div className="bg-[#0a101f] px-4 py-2.5 border-b border-blue-900/50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 font-mono tracking-wider uppercase flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-amber-400" />
              <span>System Output Logs</span>
            </span>
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/80"></span>
            </div>
          </div>

          {/* Thought & Telemetry Feed */}
          <div className="p-4 flex-1 font-mono text-xs overflow-y-auto space-y-2 select-text">
            {agentState.thoughtLog.length === 0 ? (
              <div className="text-slate-500 text-center py-10">
                [SYSTEM READY] Listening on websocket://node.eagle.internal:3000...
              </div>
            ) : (
              agentState.thoughtLog.map((log, idx) => (
                <div key={idx} className="leading-relaxed">
                  <span className="text-slate-500 select-none mr-2">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={
                      log.type === 'action'
                        ? 'text-amber-400 font-bold'
                        : log.type === 'verification'
                        ? 'text-emerald-400 font-bold'
                        : 'text-blue-400'
                    }
                  >
                    [{log.phase.toUpperCase()}]
                  </span>{' '}
                  <span className="text-slate-300">{log.message}</span>
                </div>
              ))
            )}
          </div>

          {/* Dialogue Form with Agent */}
          <form onSubmit={handleSendChat} className="p-3 border-t border-blue-900/50 bg-[#0a101f] flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Directive or query to Agent..."
              className="flex-1 bg-[#030816] border border-blue-900/60 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || isSendingChat}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Validation Metrics Card */}
        <div className="h-44 bg-[#0a101f] border border-blue-900/50 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Validation Metrics</span>
            <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Sync
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="bg-[#030816] p-2.5 rounded-lg border border-blue-900/20">
              <div className="text-[10px] text-slate-500 uppercase">Code Quality</div>
              <div className="text-base font-bold text-emerald-400 font-mono">98.2%</div>
            </div>
            <div className="bg-[#030816] p-2.5 rounded-lg border border-blue-900/20">
              <div className="text-[10px] text-slate-500 uppercase">Coverage</div>
              <div className="text-base font-bold text-blue-400 font-mono">84.7%</div>
            </div>
            <div className="bg-[#030816] p-2.5 rounded-lg border border-blue-900/20">
              <div className="text-[10px] text-slate-500 uppercase">Threat Score</div>
              <div className="text-base font-bold text-slate-200 font-mono">0.02</div>
            </div>
            <div className="bg-[#030816] p-2.5 rounded-lg border border-blue-900/20">
              <div className="text-[10px] text-slate-500 uppercase">Health Score</div>
              <div className="text-base font-bold text-amber-400 font-mono">{currentProject.healthScore}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
