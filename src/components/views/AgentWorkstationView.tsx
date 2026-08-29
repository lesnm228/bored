import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  Loader2,
  Play,
  Send,
  ShieldCheck,
  Square,
} from 'lucide-react';
import { ProjectConfig, AgentRunState, AutonomyLevel } from '../../types';
import { InstructionBox } from '../InstructionBox';

interface AgentWorkstationViewProps {
  currentProject: ProjectConfig;
  agentState: AgentRunState;
  onExecuteAgent: (
    goal: string,
    autonomy: AutonomyLevel,
    maxSteps: number
  ) => void;
  onAbortAgent: () => void;
  onRunReview: () => void;
  onOpenFiles: () => void;
}

type ChatMessage = {
  sender: 'user' | 'agent';
  text: string;
  timestamp: number;
};

export const AgentWorkstationView: React.FC<AgentWorkstationViewProps> = ({
  currentProject,
  agentState,
  onExecuteAgent,
  onAbortAgent,
  onRunReview,
  onOpenFiles,
}) => {
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isSendingChat, setIsSendingChat] = useState(false);

  const isRunning =
    agentState.status === 'planning' ||
    agentState.status === 'synthesizing' ||
    agentState.status === 'writing_code' ||
    agentState.status === 'running_tests' ||
    agentState.status === 'validating';

  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

  // Stage 3: expose only execution evidence that is safe/useful to the user.
  // Raw internal "thought" entries are intentionally not rendered.
  const executionEvidence = agentState.thoughtLog
    .filter((entry) => entry.type !== 'thought')
    .slice(-12);
  const runtimeEvidence = (agentState.runtimeEvidence || []).slice(-8);
  const filesTouched = (agentState.filesTouched || []).slice(0, 8);

  const sendChat = async () => {
    const userText = chatInput.trim();

    if (!userText || isSendingChat) return;

    setChatInput('');
    setChatMessages((prev) => [
      ...prev,
      {
        sender: 'user',
        text: userText,
        timestamp: Date.now(),
      },
    ]);

    setIsSendingChat(true);

    try {
      const isBuildRequest = /\b(build|implement|fix|add|create|update|refactor|debug|repair|test|deploy|integrate|optimize)\b/i.test(userText);

      if (isBuildRequest) {
        await onExecuteAgent(userText, 'fully_autonomous', 12);
        setChatMessages((prev) => [
          ...prev,
          {
            sender: 'agent',
            text: `Executing the real Builder Board runtime for: "${userText}". Runtime status, task progress, and verification evidence will be shown in the execution panel as they are reported.`,
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userText,
          projectContext: `${currentProject.name}: ${
            currentProject.description
          }. Files: ${currentProject.files.map((file) => file.path).join(', ')}`,
        }),
      });

      if (!res.ok) {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: 'agent',
            text: `Agent request failed with HTTP ${res.status}. No successful result was recorded.`,
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      const data = await res.json();

      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text:
            typeof data.reply === 'string' && data.reply.trim()
              ? data.reply
              : 'The agent service returned no response.',
          timestamp: Date.now(),
        },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: 'Unable to reach the agent service. No task completion was recorded.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleChatKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendChat();
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#020617] text-slate-100">
      <div className="border-b border-slate-800 bg-[#07111f] px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-medium">
              Current Project
            </div>

            <div className="flex items-center gap-2 mt-1 min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-slate-100 truncate">
                {currentProject.name}
              </h1>

              <span className="shrink-0 rounded border border-blue-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-blue-300">
                {currentProject.framework}
              </span>
            </div>

            {currentProject.description && (
              <p className="mt-1 text-xs sm:text-sm text-slate-400 line-clamp-2">
                {currentProject.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isRunning ? (
              <button
                type="button"
                onClick={onAbortAgent}
                className="inline-flex items-center gap-2 rounded-md border border-red-700 bg-red-950/40 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-950/70"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  onExecuteAgent(
                    currentProject.description,
                    'fully_autonomous',
                    12
                  )
                }
                className="inline-flex items-center gap-2 rounded-md bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Run
              </button>
            )}

            <button
              type="button"
              onClick={onRunReview}
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Audit
            </button>

            <button
              type="button"
              onClick={onOpenFiles}
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Files
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {chatMessages.length === 0 && (
            <div className="py-10 sm:py-14">
              <div className="max-w-2xl">
                <div className="w-10 h-10 rounded-md bg-amber-400 flex items-center justify-center text-slate-950 font-black text-sm">
                  BB
                </div>

                <h2 className="mt-4 text-xl sm:text-2xl font-semibold text-slate-100">
                  What do you want to build?
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Describe the change you want. Builder Board will use the
                  connected project and agent services. Runtime results and
                  failures are shown only when the underlying system reports
                  them.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {chatMessages.map((message, index) => (
              <div
                key={`${message.timestamp}-${index}`}
                className={`flex ${
                  message.sender === 'user'
                    ? 'justify-end'
                    : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[92%] sm:max-w-[82%] ${
                    message.sender === 'user'
                      ? 'rounded-lg bg-blue-700 px-4 py-3 text-white'
                      : 'border-l-2 border-amber-400 pl-4 py-1 text-slate-200'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words text-sm leading-6">
                    {message.text}
                  </div>

                  <div
                    className={`mt-2 text-[10px] ${
                      message.sender === 'user'
                        ? 'text-blue-200'
                        : 'text-slate-500'
                    }`}
                  >
                    {message.sender === 'user' ? 'You' : 'Builder Board'} ·{' '}
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            ))}

            {isSendingChat && (
              <div className="flex items-center gap-2 border-l-2 border-amber-400 pl-4 text-sm text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Waiting for agent response…
              </div>
            )}

            {(agentState.currentGoal || agentState.status) && (
              <section className="border border-slate-800 rounded-lg bg-[#07111f]">
                <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-slate-800">
                  <div className="text-xs font-semibold text-slate-200">
                    Execution status
                  </div>

                  <div className="text-[10px] uppercase tracking-wide text-amber-300">
                    {String(agentState.status).replace(/_/g, ' ')}
                  </div>
                </div>

                <div className="px-4 py-4 space-y-3">
                  {agentState.currentGoal && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">
                        Current goal
                      </div>
                      <div className="mt-1 text-sm text-slate-300">
                        {agentState.currentGoal}
                      </div>
                    </div>
                  )}

                  {agentState.activeTask && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">
                        Active task
                      </div>
                      <div className="mt-1 text-sm text-slate-300">
                        {agentState.activeTask}
                      </div>
                    </div>
                  )}

                  {agentState.planSummary && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">
                        Plan summary
                      </div>
                      <div className="mt-1 text-sm text-slate-300">
                        {agentState.planSummary}
                      </div>
                    </div>
                  )}

                  {agentState.totalSteps > 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      {agentState.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : isRunning ? (
                        <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-slate-500" />
                      )}

                      <span>
                        Step {agentState.currentStepIndex} of{' '}
                        {agentState.totalSteps}
                      </span>
                    </div>
                  )}

                  <p className="text-[11px] leading-5 text-slate-500">
                    This section reflects the real agent state supplied by the
                    existing Builder Board runtime. No synthetic completion
                    percentage is generated here.
                  </p>
                </div>
              </section>
            )}

            {(executionEvidence.length > 0 ||
              agentState.activeFile ||
              agentState.error ||
              agentState.startedAt ||
              agentState.completedAt) && (
              <section className="mt-6 border border-slate-800 rounded-lg bg-[#07111f]">
                <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-slate-800">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">
                      Execution evidence
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500">
                      Reported by the existing Builder Board agent runtime
                    </div>
                  </div>

                  <div className="text-[10px] uppercase tracking-wide text-amber-300">
                    {String(agentState.status).replace(/_/g, ' ')}
                  </div>
                </div>

                <div className="px-4 py-4 space-y-4">
                  {(agentState.startedAt || agentState.completedAt) && (
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
                      {agentState.startedAt && (
                        <span>
                          Started {formatTime(agentState.startedAt)}
                        </span>
                      )}

                      {agentState.completedAt && (
                        <span>
                          Completed {formatTime(agentState.completedAt)}
                        </span>
                      )}
                    </div>
                  )}

                  {agentState.activeFile && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">
                        Active file
                      </div>
                      <button
                        type="button"
                        onClick={onOpenFiles}
                        className="mt-1 text-left font-mono text-xs text-blue-300 hover:text-blue-200"
                      >
                        {agentState.activeFile}
                      </button>
                    </div>
                  )}

                  {filesTouched.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">
                        Files touched
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {filesTouched.map((file) => (
                          <button
                            key={file}
                            type="button"
                            onClick={onOpenFiles}
                            className="rounded border border-slate-700 bg-slate-900/80 px-2 py-1 font-mono text-[10px] text-slate-300 hover:border-blue-500 hover:text-blue-200"
                          >
                            {file}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {agentState.runtimePort && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">
                        Runtime status
                      </div>
                      <div className="mt-1 text-xs text-slate-300">
                        {agentState.runtimeStatus || 'running'} on port {agentState.runtimePort}
                      </div>
                    </div>
                  )}

                  {agentState.error && (
                    <div className="rounded-md border border-red-900/70 bg-red-950/30 px-3 py-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                        <div>
                          <div className="text-xs font-semibold text-red-300">
                            Execution error
                          </div>
                          <div className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-red-200/80">
                            {agentState.error}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">
                      Activity
                    </div>

                    {executionEvidence.length === 0 && runtimeEvidence.length === 0 ? (
                      <div className="text-xs text-slate-500">
                        No runtime evidence has been generated yet for this instruction.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {runtimeEvidence.map((entry, index) => (
                          <div
                            key={`${entry.id}-${index}`}
                            className="border-l-2 border-slate-700 pl-3 py-1"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-[10px] font-semibold uppercase tracking-wide ${
                                  entry.status === 'passed'
                                    ? 'text-emerald-400'
                                    : entry.status === 'failed'
                                      ? 'text-red-400'
                                      : entry.status === 'unavailable'
                                        ? 'text-slate-400'
                                        : 'text-amber-300'
                                }`}
                              >
                                {entry.category}
                              </span>
                              <span className="text-[10px] text-slate-600">
                                {entry.label}
                              </span>
                              <span className="text-[10px] text-slate-600">
                                {formatTime(entry.timestamp)}
                              </span>
                            </div>

                            <div className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-300">
                              {entry.detail}
                            </div>
                          </div>
                        ))}

                        {executionEvidence.map((entry, index) => (
                          <div
                            key={`${entry.timestamp}-${index}`}
                            className="border-l-2 border-slate-700 pl-3 py-1"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-[10px] font-semibold uppercase tracking-wide ${
                                  entry.type === 'verification'
                                    ? 'text-emerald-400'
                                    : entry.type === 'action'
                                      ? 'text-amber-300'
                                      : 'text-blue-300'
                                }`}
                              >
                                {entry.type}
                              </span>

                              {entry.phase && (
                                <span className="text-[10px] text-slate-600">
                                  {entry.phase}
                                </span>
                              )}

                              <span className="text-[10px] text-slate-600">
                                {formatTime(entry.timestamp)}
                              </span>
                            </div>

                            <div className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-300">
                              {entry.message}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] leading-4 text-slate-600">
                    Builder Board does not mark work successful here unless the
                    underlying runtime reports corresponding execution or
                    verification evidence.
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800 bg-[#07111f]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-end gap-2 rounded-lg border border-slate-700 bg-[#020617] p-2 focus-within:border-amber-500">
            <textarea
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={handleChatKeyDown}
              rows={1}
              placeholder="Message Builder Board…"
              className="min-h-[44px] max-h-36 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none"
            />

            <button
              type="button"
              onClick={() => void sendChat()}
              disabled={!chatInput.trim() || isSendingChat}
              className="h-10 w-10 shrink-0 rounded-md bg-amber-400 text-slate-950 flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-40 hover:bg-amber-300"
              aria-label="Send message"
            >
              {isSendingChat ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="mt-2 text-[10px] text-slate-600">
            Enter to send · Shift+Enter for a new line
          </div>

          <div className="mt-4 border-t border-slate-800 pt-4">
            <InstructionBox
              onExecute={onExecuteAgent}
              onAbort={onAbortAgent}
              isRunning={isRunning}
              activeGoal={agentState.currentGoal}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
