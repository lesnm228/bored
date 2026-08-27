export type WorkspaceView =
  | 'landing'
  | 'agent'
  | 'projects'
  | 'files'
  | 'tasks'
  | 'tests'
  | 'deployments'
  | 'history'
  | 'settings';

export type AgentStatus =
  | 'idle'
  | 'planning'
  | 'synthesizing'
  | 'writing_code'
  | 'running_tests'
  | 'validating'
  | 'self_correcting'
  | 'completed'
  | 'error'
  | 'aborted';

export type AutonomyLevel = 'supervised' | 'semi_autonomous' | 'fully_autonomous';

export interface ProjectFile {
  id: string;
  path: string;
  name: string;
  content: string;
  language: 'typescript' | 'javascript' | 'json' | 'css' | 'html' | 'markdown' | 'env' | 'yaml' | 'sql';
  lastModified: number;
  isModified?: boolean;
}

export type TaskStatus =
  | 'received'
  | 'planning'
  | 'working'
  | 'validating'
  | 'completed'
  | 'failed'
  | 'aborted'
  | 'pending'
  | 'in_progress'
  | 'skipped';

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo: 'builder-agent' | 'user' | 'system';
  targetFiles?: string[];
  plannedFiles?: string[];
  modifiedFiles?: { path: string; previousContent: string; newContent: string }[];
  canRollback?: boolean;
  isRolledBack?: boolean;
  validationError?: string;
  estimatedMinutes?: number;
  createdAt: number;
  completedAt?: number;
  logs?: string[];
  subtasks?: {
    id: string;
    title: string;
    completed: boolean;
  }[];
}

export interface TestCase {
  id: string;
  name: string;
  file: string;
  suite: string;
  status: 'passed' | 'failed' | 'running' | 'idle';
  durationMs: number;
  errorMessage?: string;
  expected?: string;
  actual?: string;
  lastRun?: number;
}

export interface DeploymentRecord {
  id: string;
  environment: 'production' | 'staging' | 'preview' | 'cloud-run';
  version: string;
  commitHash: string;
  status: 'active' | 'deploying' | 'failed' | 'rolled_back' | 'queued';
  deployedAt: number;
  url?: string;
  author: string;
  branch: string;
  buildDurationSec: number;
  logs: string[];
}

export interface HistoryEvent {
  id: string;
  timestamp: number;
  type: 'agent_instruction' | 'build' | 'test_run' | 'deployment' | 'file_edit' | 'commit' | 'milestone';
  title: string;
  description: string;
  author: string;
  details?: Record<string, unknown>;
  diff?: {
    file: string;
    added: number;
    removed: number;
  }[];
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug' | 'agent' | 'success';
  source?: string;
  message: string;
  details?: string;
}

export type BuildLogEntry = LogEntry;

export type TerminalSessionStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TerminalEvent {
  type: 'stdout' | 'stderr' | 'system' | 'exit';
  text: string;
  timestamp: number;
  exitCode?: number | null;
  status?: TerminalSessionStatus;
}

export interface TerminalSession {
  id: string;
  projectId: string;
  command: string;
  workingDirectory: string;
  status: TerminalSessionStatus;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  exitCode?: number | null;
  events: TerminalEvent[];
}

export interface ProjectConfig {
  id: string;
  name: string;
  tagline: string;
  description: string;
  framework: string;
  version?: string;
  createdAt: number;
  lastActive?: number;
  updatedAt?: number;
  repoUrl?: string;
  branch: string;
  environment: 'development' | 'staging' | 'production';
  healthScore: number;
  files: ProjectFile[];
  tasks: TaskItem[];
  tests: TestCase[];
  deployments: DeploymentRecord[];
  history: HistoryEvent[];
  terminalSessions?: TerminalSession[];
  envVariables: {
    key: string;
    value: string;
    isSecret: boolean;
  }[];
  githubRepo?: {
    owner: string;
    repo: string;
    branch: string;
    defaultBranch?: string;
    isPrivate?: boolean;
    lastSyncedCommitSha?: string;
  };
  gitBaselineFiles?: { path: string; content: string }[];
}

export interface AgentRunState {
  status: AgentStatus;
  currentGoal: string;
  currentStepIndex: number;
  totalSteps: number;
  thoughtLog: {
    timestamp: number;
    phase: string;
    message: string;
    type?: 'thought' | 'action' | 'observation' | 'verification';
  }[];
  activeFile?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface WorkspaceSettings {
  theme: 'dark-navy';
  autonomyLevel: AutonomyLevel;
  maxStepBudget: number;
  autoRunTests: boolean;
  autoFormatCode: boolean;
  strictTypeValidation: boolean;
  telemetryEnabled: boolean;
  notificationSound: boolean;
  apiKeyConfigured: boolean;
  customInstructions: string;
}
