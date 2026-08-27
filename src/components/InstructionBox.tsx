import React, { useState } from 'react';
import {
  Sparkles,
  Play,
  Square,
  Sliders,
  Paperclip,
  Mic,
  MicOff,
  ChevronDown,
  BookOpen,
  ArrowRight,
  Shield,
  Layers,
} from 'lucide-react';
import { AutonomyLevel } from '../types';

interface InstructionBoxProps {
  onExecute: (instruction: string, autonomy: AutonomyLevel, maxSteps: number) => void;
  onAbort: () => void;
  isRunning: boolean;
  activeGoal?: string;
}

export const InstructionBox: React.FC<InstructionBoxProps> = ({
  onExecute,
  onAbort,
  isRunning,
  activeGoal,
}) => {
  const [input, setInput] = useState('');
  const [autonomy, setAutonomy] = useState<AutonomyLevel>('semi_autonomous');
  const [maxSteps, setMaxSteps] = useState(10);
  const [showConfig, setShowConfig] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const goalTemplates = [
    { label: 'Token Bucket Rate Limiter', prompt: 'Implement sliding window rate limiting on stream endpoint with Redis backoff' },
    { label: 'JWT RS256 Auth Middleware', prompt: 'Add asymmetric RS256 token verification middleware with JWKS public key cache' },
    { label: 'Vitest Unit Test Suite', prompt: 'Write comprehensive Vitest test suite testing happy paths and error edge cases' },
    { label: 'Telemetry & Latency Tracer', prompt: 'Implement p95/p99 latency tracking collector with Prometheus compatible metrics' },
    { label: 'Circuit Breaker Pattern', prompt: 'Create resilient circuit breaker middleware with automatic state recovery' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !activeGoal) return;
    const goalToRun = input.trim() || activeGoal || '';
    if (goalToRun) {
      onExecute(goalToRun, autonomy, maxSteps);
    }
  };

  const toggleVoice = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser window.');
      return;
    }
    // Simple Web Speech API handler
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      if (!isListening) {
        setIsListening(true);
        recognition.start();
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
          setIsListening(false);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
      } else {
        setIsListening(false);
        recognition.stop();
      }
    } catch {
      setIsListening(false);
    }
  };

  return (
    <div className="p-4 bg-[#030816] border border-blue-900/60 rounded-xl relative group shadow-xl">
      {/* Top Floating Badge */}
      <div className="absolute -top-3 left-4 bg-[#030816] px-2 text-[10px] font-bold text-amber-500 uppercase tracking-wider border-x border-blue-900/60">
        Instructions for Agent
      </div>

      {/* Header bar controls */}
      <div className="flex items-center justify-between pb-3 pt-1 border-b border-blue-950/80">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-200 tracking-wide">
            Goal & Directives
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950 border border-blue-900/50 text-blue-400 font-semibold uppercase">
            {autonomy.replace('_', ' ')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
              showConfig
                ? 'bg-blue-900/40 border-amber-500/50 text-amber-300'
                : 'bg-[#0a101f] border-blue-900/50 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3 h-3 text-amber-400" />
            <span>Agent Parameters</span>
          </button>
        </div>
      </div>

      {/* Advanced Parameters Config Drawer */}
      {showConfig && (
        <div className="py-3 px-3 my-3 rounded-xl bg-[#0a101f] border border-blue-900/50 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-400 font-semibold block mb-1.5 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Autonomy Policy</span>
            </label>
            <select
              aria-label="Autonomy Level"
              value={autonomy}
              onChange={(e) => setAutonomy(e.target.value as AutonomyLevel)}
              className="w-full bg-[#030816] border border-blue-900/60 rounded-lg px-2.5 py-1.5 text-slate-200 font-medium focus:outline-none focus:border-amber-500"
            >
              <option value="supervised">Supervised (Approve every file change)</option>
              <option value="semi_autonomous">Semi-Autonomous (Auto-code & verify)</option>
              <option value="fully_autonomous">Fully Autonomous (Auto-plan, build, test, repair)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 font-semibold block mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>Max Step Budget</span>
              </span>
              <span className="text-amber-400 font-mono font-bold">{maxSteps} steps</span>
            </label>
            <input
              type="range"
              aria-label="Max Step Budget"
              min="2"
              max="25"
              value={maxSteps}
              onChange={(e) => setMaxSteps(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Instruction Form */}
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isRunning}
            placeholder="e.g. Integrate WebSocket streaming telemetry for live request counts..."
            rows={3}
            className="w-full bg-[#070c17] border border-blue-900/60 focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/30 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none disabled:opacity-60 transition-all font-sans"
          />
        </div>

        {/* Action Controls & Suggestions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* Quick Goal Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
            <span className="text-[11px] text-slate-500 font-semibold shrink-0">Presets:</span>
            {goalTemplates.slice(0, 3).map((tmpl, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setInput(tmpl.prompt)}
                disabled={isRunning}
                className="text-[11px] px-2.5 py-1 rounded-md bg-[#0a101f] hover:bg-blue-900/40 border border-blue-900/50 text-slate-400 hover:text-amber-300 whitespace-nowrap transition-colors"
              >
                {tmpl.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Voice Dictation Button */}
            <button
              type="button"
              onClick={toggleVoice}
              className={`p-2 rounded-xl border text-xs font-semibold transition-colors ${
                isListening
                  ? 'bg-red-500/20 border-red-500 text-red-300 animate-pulse'
                  : 'bg-[#0a101f] border-blue-900/50 text-slate-400 hover:text-slate-200'
              }`}
              title="Voice Dictation"
            >
              {isListening ? <Mic className="w-4 h-4 text-red-400" /> : <MicOff className="w-4 h-4" />}
            </button>

            {isRunning ? (
              <button
                type="button"
                onClick={onAbort}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-900/20 transition-all active:scale-95 animate-pulse"
              >
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>ABORT BUILD</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && !activeGoal}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/10 transition-all active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-slate-950" />
                <span>EXECUTE AGENT</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
