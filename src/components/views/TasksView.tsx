import React, { useState } from 'react';
import {
  Layers,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Play,
  Trash2,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
  ArrowRight,
  XCircle,
  StopCircle,
  RotateCcw,
} from 'lucide-react';
import { ProjectConfig, TaskItem, TaskStatus } from '../../types';

interface TasksViewProps {
  currentProject: ProjectConfig;
  onAddTask: (task: Omit<TaskItem, 'id' | 'createdAt'>) => void;
  onToggleTaskStatus: (taskId: string, targetStatus?: TaskStatus) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onRollbackTask?: (taskId: string) => void;
  onExecuteTaskWithAgent: (task: TaskItem) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  currentProject,
  onAddTask,
  onToggleTaskStatus,
  onToggleSubtask,
  onDeleteTask,
  onRollbackTask,
  onExecuteTaskWithAgent,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [newTargetFiles, setNewTargetFiles] = useState('src/index.ts');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const files = newTargetFiles
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);

    onAddTask({
      title: newTitle.trim(),
      description: newDesc.trim(),
      status: 'received',
      priority: newPriority,
      assignedTo: 'builder-agent',
      targetFiles: files.length > 0 ? files : ['src/index.ts'],
      subtasks: [
        { id: `st-${Date.now()}-1`, title: 'Analyze requirements and dependencies', completed: false },
        { id: `st-${Date.now()}-2`, title: 'Implement logic in target files', completed: false },
        { id: `st-${Date.now()}-3`, title: 'Execute verification tests', completed: false },
      ],
    });

    setNewTitle('');
    setNewDesc('');
    setIsAddingTask(false);
  };

  const filteredTasks = currentProject.tasks.filter((task) => {
    if (filterStatus === 'all') return true;
    return task.status === filterStatus;
  });

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'critical':
        return 'bg-red-950/80 text-red-400 border-red-800/80';
      case 'high':
        return 'bg-amber-950/80 text-amber-400 border-amber-800/80';
      case 'medium':
        return 'bg-blue-950/80 text-blue-300 border-blue-800/80';
      default:
        return 'bg-slate-900 text-slate-400 border-slate-700';
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'received':
        return {
          label: 'RECEIVED',
          className: 'bg-blue-950/70 text-blue-300 border-blue-800/60',
          icon: <Clock className="w-3 h-3 text-blue-400" />,
        };
      case 'planning':
        return {
          label: 'PLANNING',
          className: 'bg-purple-950/70 text-purple-300 border-purple-800/60',
          icon: <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />,
        };
      case 'working':
      case 'in_progress':
        return {
          label: 'WORKING',
          className: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
          icon: <Clock className="w-3 h-3 text-amber-400 animate-spin" />,
        };
      case 'validating':
        return {
          label: 'VALIDATING',
          className: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80',
          icon: <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />,
        };
      case 'completed':
        return {
          label: 'COMPLETED',
          className: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80',
          icon: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
        };
      case 'failed':
        return {
          label: 'FAILED',
          className: 'bg-red-950/80 text-red-300 border-red-800/80',
          icon: <XCircle className="w-3 h-3 text-red-400" />,
        };
      case 'aborted':
        return {
          label: 'ABORTED',
          className: 'bg-slate-900 text-slate-400 border-slate-700',
          icon: <StopCircle className="w-3 h-3 text-slate-500" />,
        };
      default:
        return {
          label: 'PENDING',
          className: 'bg-slate-900 text-slate-400 border-slate-700',
          icon: <Square className="w-3 h-3 text-slate-500" />,
        };
    }
  };

  const statusList: TaskStatus[] = [
    'received',
    'planning',
    'working',
    'validating',
    'completed',
    'failed',
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#020617] text-slate-100 p-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-blue-900/40">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">Task Queue & Lifecycle</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/30 border border-blue-500/30 text-blue-400 font-mono">
              {currentProject.tasks.length} Total
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real task lifecycle pipeline: <span className="text-slate-300 font-mono">RECEIVED → PLANNING → WORKING → VALIDATING → COMPLETED</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddingTask(true)}
            className="px-3.5 py-1.5 rounded-lg bg-[#0a101f] hover:bg-blue-900/40 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Lifecycle Flow Ribbon */}
      <div className="mt-4 p-3 rounded-xl bg-[#0a101f] border border-blue-900/40 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Filter by Stage:
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-2.5 py-1 rounded text-xs font-semibold uppercase transition-colors ${
              filterStatus === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-[#030816] text-slate-400 hover:text-white border border-blue-900/40'
            }`}
          >
            All ({currentProject.tasks.length})
          </button>
          {statusList.map((st) => {
            const count = currentProject.tasks.filter((t) => t.status === st).length;
            return (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 rounded text-xs font-semibold uppercase transition-colors flex items-center gap-1.5 ${
                  filterStatus === st
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-[#030816] text-slate-400 hover:text-white border border-blue-900/40'
                }`}
              >
                <span>{st}</span>
                <span className="text-[10px] opacity-80">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* New Task Creator Modal / Drawer */}
      {isAddingTask && (
        <form
          onSubmit={handleCreate}
          className="mt-4 p-5 rounded-2xl bg-[#0a101f] border border-amber-500/50 shadow-xl space-y-3"
        >
          <div className="flex items-center justify-between pb-2 border-b border-blue-900/40">
            <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Create Engineering Task
            </span>
            <button
              type="button"
              onClick={() => setIsAddingTask(false)}
              className="text-slate-400 hover:text-white text-xs"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[11px] text-slate-400 block mb-1">Task Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Implement sliding window rate limiter"
                required
                className="w-full bg-[#030816] border border-blue-900/60 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as any)}
                className="w-full bg-[#030816] border border-blue-900/60 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Target Files (comma-separated)</label>
            <input
              type="text"
              value={newTargetFiles}
              onChange={(e) => setNewTargetFiles(e.target.value)}
              placeholder="e.g. src/index.ts, src/services/rateLimiter.ts"
              className="w-full bg-[#030816] border border-blue-900/60 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Technical Requirements / Description</label>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Specify requirements, constraints, or endpoints..."
              rows={2}
              className="w-full bg-[#030816] border border-blue-900/60 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
            >
              Add to Queue
            </button>
          </div>
        </form>
      )}

      {/* Task Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
        {filteredTasks.map((task) => {
          const completedSubCount = task.subtasks?.filter((s) => s.completed).length || 0;
          const totalSubCount = task.subtasks?.length || 0;
          const statusInfo = getStatusBadge(task.status);

          return (
            <div
              key={task.id}
              className="rounded-2xl bg-[#0a101f]/80 backdrop-blur-md border border-blue-900/50 hover:border-amber-500/40 p-5 flex flex-col justify-between transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2 pb-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span
                      className={`text-xs font-bold leading-snug ${
                        task.status === 'completed'
                          ? 'line-through text-slate-500'
                          : 'text-slate-100'
                      }`}
                    >
                      {task.title}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase border ${getPriorityBadge(
                      task.priority
                    )}`}
                  >
                    {task.priority}
                  </span>
                </div>

                {/* Stage Badge & Selector */}
                <div className="flex items-center justify-between gap-2 mt-1 mb-2">
                  <div
                    className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-semibold uppercase border flex items-center gap-1.5 ${statusInfo.className}`}
                  >
                    {statusInfo.icon}
                    <span>{statusInfo.label}</span>
                  </div>

                  <select
                    value={task.status}
                    onChange={(e) => onToggleTaskStatus(task.id, e.target.value as TaskStatus)}
                    className="bg-[#030816] border border-blue-900/50 rounded text-[10px] text-slate-300 px-1.5 py-0.5 focus:outline-none focus:border-amber-500"
                  >
                    {statusList.map((st) => (
                      <option key={st} value={st}>
                        {st.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{task.description}</p>

                {/* Target Files List */}
                {task.targetFiles && task.targetFiles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {task.targetFiles.map((file, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/60 border border-blue-900/60 text-blue-300 font-mono"
                      >
                        {file}
                      </span>
                    ))}
                  </div>
                )}

                {/* Subtask checklist */}
                {task.subtasks && task.subtasks.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-blue-900/30 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pb-1">
                      <span>Subtasks</span>
                      <span className="text-amber-400 font-bold">
                        {completedSubCount} / {totalSubCount}
                      </span>
                    </div>
                    {task.subtasks.map((sub) => (
                      <div
                        key={sub.id}
                        onClick={() => onToggleSubtask(task.id, sub.id)}
                        className="flex items-center gap-2 text-xs cursor-pointer hover:text-white text-slate-300 select-none py-0.5"
                      >
                        {sub.completed ? (
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        )}
                        <span className={`text-[11px] ${sub.completed ? 'line-through text-slate-500' : ''}`}>
                          {sub.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="mt-4 pt-3 border-t border-blue-900/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onExecuteTaskWithAgent(task)}
                    className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Assign to Agent</span>
                  </button>

                  {task.canRollback && task.modifiedFiles && task.modifiedFiles.length > 0 && !task.isRolledBack && onRollbackTask && (
                    <button
                      onClick={() => onRollbackTask(task.id)}
                      className="px-2.5 py-1 rounded bg-red-950/60 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      title="Rollback modified files to pre-task state"
                    >
                      <RotateCcw className="w-3 h-3 text-red-400" />
                      <span>Rollback ({task.modifiedFiles.length})</span>
                    </button>
                  )}

                  {task.isRolledBack && (
                    <span className="text-[10px] text-slate-500 font-mono italic">
                      [Rolled Back]
                    </span>
                  )}
                </div>

                <button
                  onClick={() => onDeleteTask(task.id)}
                  className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                  title="Delete Task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

