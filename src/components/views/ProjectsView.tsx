import React, { useState, useRef, useEffect } from 'react';
import {
  FolderGit2,
  Plus,
  ArrowRight,
  Download,
  Copy,
  Trash2,
  Code2,
  Layers,
  FlaskConical,
  Rocket,
  CheckCircle2,
  Sparkles,
  Upload,
  FileCode,
  GitBranch,
  Github,
  Lock,
  Globe,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { ProjectConfig, ProjectFile } from '../../types';
import { ProjectService } from '../../services/projectService';
import { GitService, GitHubAuthStatus, GitHubRepoItem, GitHubBranchItem } from '../../services/gitService';

interface ProjectsViewProps {
  projects: ProjectConfig[];
  currentProjectId: string;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (project: Partial<ProjectConfig>) => void;
  onImportProject?: (project: ProjectConfig) => void;
  onDeleteProject: (projectId: string) => void;
  onExportProjectZip: (project: ProjectConfig) => void;
  onExportProjectJson: (project: ProjectConfig) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  currentProjectId,
  onSelectProject,
  onCreateProject,
  onImportProject,
  onDeleteProject,
  onExportProjectZip,
  onExportProjectJson,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isImportingGithub, setIsImportingGithub] = useState(false);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [framework, setFramework] = useState('Node.js / Express / TypeScript');
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // GitHub integration state
  const [ghStatus, setGhStatus] = useState<GitHubAuthStatus>({ authenticated: false });
  const [ghRepos, setGhRepos] = useState<GitHubRepoItem[]>([]);
  const [customRepoInput, setCustomRepoInput] = useState('');
  const [selectedOwner, setSelectedOwner] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('');
  const [branches, setBranches] = useState<GitHubBranchItem[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [isLoadingGh, setIsLoadingGh] = useState(false);
  const [isFetchingBranches, setIsFetchingBranches] = useState(false);
  const [isExecutingImport, setIsExecutingImport] = useState(false);
  const [ghNotice, setGhNotice] = useState<string | null>(null);

  useEffect(() => {
    GitService.getAuthStatus().then((status) => {
      setGhStatus(status);
      if (status.authenticated) {
        GitService.listRepositories().then((res) => {
          if (res.success) {
            setGhRepos(res.repos);
          }
        });
      }
    });
  }, []);

  const handleOpenGithubModal = async () => {
    setIsImportingGithub(true);
    setGhNotice(null);
    setIsLoadingGh(true);
    try {
      const status = await GitService.getAuthStatus();
      setGhStatus(status);
      if (status.authenticated) {
        const reposRes = await GitService.listRepositories();
        if (reposRes.success) {
          setGhRepos(reposRes.repos);
          if (reposRes.repos.length > 0) {
            handleSelectRepo(reposRes.repos[0].owner.login, reposRes.repos[0].name);
          }
        }
      } else {
        setGhNotice(status.message || 'Configure GITHUB_TOKEN in environment to list private repos.');
      }
    } catch (err: any) {
      setGhNotice(err.message);
    } finally {
      setIsLoadingGh(false);
    }
  };

  const handleSelectRepo = async (owner: string, repo: string) => {
    setSelectedOwner(owner);
    setSelectedRepo(repo);
    setIsFetchingBranches(true);
    try {
      const bRes = await GitService.listBranches(owner, repo);
      if (bRes.success && bRes.branches.length > 0) {
        setBranches(bRes.branches);
        setSelectedBranch(bRes.branches[0].name);
      } else {
        setBranches([{ name: 'main', commit: { sha: '', url: '' } }]);
        setSelectedBranch('main');
      }
    } catch (err: any) {
      console.warn('Failed to list branches:', err);
      setBranches([{ name: 'main', commit: { sha: '', url: '' } }]);
      setSelectedBranch('main');
    } finally {
      setIsFetchingBranches(false);
    }
  };

  const handleCustomRepoChange = async (val: string) => {
    setCustomRepoInput(val);
    const parts = val.trim().replace(/^https:\/\/github\.com\//, '').split('/');
    if (parts.length >= 2 && parts[0] && parts[1]) {
      handleSelectRepo(parts[0], parts[1]);
    }
  };

  const handleExecuteGithubImport = async () => {
    const owner = selectedOwner.trim();
    const repo = selectedRepo.trim();
    const branch = selectedBranch.trim() || 'main';

    if (!owner || !repo) {
      setGhNotice('Please provide a valid owner and repository name (e.g. owner/repo).');
      return;
    }

    setIsExecutingImport(true);
    setGhNotice(null);

    try {
      const res = await GitService.importRepository(owner, repo, branch);
      if (!res.success || !res.files || res.files.length === 0) {
        throw new Error(res.error || 'No compatible source files found in repository tree.');
      }

      const baselineFiles = res.files.map((f) => ({ path: f.path, content: f.content }));
      const newProj: ProjectConfig = {
        id: `proj_gh_${Date.now()}`,
        name: res.repoInfo?.name || repo,
        tagline: `Imported from GitHub (${owner}/${repo})`,
        description: res.repoInfo?.description || `Autonomous workspace linked to ${owner}/${repo} on branch ${branch}.`,
        framework: 'GitHub Workspace / TypeScript',
        version: 'v1.0.0',
        branch,
        repoUrl: `https://github.com/${owner}/${repo}`,
        environment: 'development',
        healthScore: 100,
        createdAt: Date.now(),
        lastActive: Date.now(),
        files: res.files,
        githubRepo: {
          owner,
          repo,
          branch,
          defaultBranch: res.repoInfo?.defaultBranch || branch,
          isPrivate: res.repoInfo?.private || false,
          lastSyncedCommitSha: res.treeSha,
        },
        gitBaselineFiles: baselineFiles,
        tasks: [
          {
            id: `task_${Date.now()}_1`,
            title: `Workspace initial sync from ${owner}/${repo}`,
            description: `Imported ${res.files.length} project files preserving tree hierarchy from branch "${branch}".`,
            status: 'completed',
            priority: 'medium',
            assignedTo: 'system',
            targetFiles: res.files.slice(0, 3).map((f) => f.path),
            createdAt: Date.now(),
            completedAt: Date.now(),
            logs: [
              `[GIT] Cloned virtual tree ${res.treeSha?.slice(0, 10)}... from ${owner}/${repo}`,
              `[GIT] Preserved ${res.files.length} source modules in sandbox workspace`,
            ],
          },
        ],
        tests: [],
        deployments: [],
        history: [
          {
            id: `hist_${Date.now()}`,
            timestamp: Date.now(),
            type: 'agent_instruction',
            title: `Imported GitHub repository ${owner}/${repo}`,
            description: `Loaded ${res.files.length} files from branch ${branch}.`,
            author: 'System',
          },
        ],
        envVariables: [],
      };

      if (onImportProject) {
        onImportProject(newProj);
      } else {
        onCreateProject(newProj);
      }

      setIsImportingGithub(false);
    } catch (err: any) {
      setGhNotice(err.message || 'Failed to import repository from GitHub.');
    } finally {
      setIsExecutingImport(false);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onCreateProject({
      name: name.trim(),
      tagline: tagline.trim() || 'Custom software service',
      description: description.trim() || 'Built with Builder Board autonomous workspace',
      framework,
      branch: 'main',
      environment: 'development',
      healthScore: 100,
    });

    setName('');
    setTagline('');
    setDescription('');
    setIsCreating(false);
  };

  const handleApplyTemplate = (tmpl: { name: string; framework: string; desc: string; tagline: string }) => {
    onCreateProject({
      name: tmpl.name,
      tagline: tmpl.tagline,
      description: tmpl.desc,
      framework: tmpl.framework,
      branch: 'main',
      environment: 'development',
      healthScore: 100,
    });
    setIsCreating(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawJson = event.target?.result as string;
        const parsed = JSON.parse(rawJson);
        const importedProject = ProjectService.importProjectFromJson(parsed);
        if (onImportProject) {
          onImportProject(importedProject);
        } else {
          onCreateProject(importedProject);
        }
      } catch (err: any) {
        setImportError(err.message || 'Failed to import project JSON');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const templates = [
    {
      name: 'High-Throughput Stream Router',
      tagline: 'Distributed event bus & sliding window rate limiter',
      framework: 'Node.js / Express / TypeScript',
      desc: 'Distributed queue broker with Redis sliding window rate limits and metrics.',
    },
    {
      name: 'Autonomous Web API Service',
      tagline: 'REST microservice with RS256 token verification',
      framework: 'Node.js / Express / TypeScript',
      desc: 'Clean REST endpoints with JWT RS256 token verification and Vitest coverage.',
    },
    {
      name: 'Real-time Telemetry Dashboard',
      tagline: 'Reactive metrics visualizer and event streams',
      framework: 'React / Vite / TypeScript',
      desc: 'Reactive telemetry charts, responsive sidebar, and dark navy aesthetics.',
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#020617] text-slate-100 p-6 font-sans">
      {/* Hidden File Input for JSON import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-blue-900/40">
        <div>
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-blue-400" />
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">Project Workspaces</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/30 border border-blue-500/30 text-blue-400 font-mono">
              {projects.length} Registered
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Switch between software products, link authorized GitHub repositories, or launch a new autonomous workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* GitHub Import Button */}
          <button
            onClick={handleOpenGithubModal}
            className="px-3.5 py-2 rounded-lg bg-[#0a101f] hover:bg-blue-900/40 text-amber-300 border border-amber-500/40 font-semibold text-xs flex items-center gap-1.5 transition-colors"
          >
            <Github className="w-3.5 h-3.5 text-amber-400" />
            <span>GitHub Repo</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-lg bg-[#0a101f] hover:bg-blue-900/40 text-slate-200 border border-blue-900/50 font-semibold text-xs flex items-center gap-1.5 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>Import JSON</span>
          </button>

          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/10 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {importError && (
        <div className="mt-4 p-3 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-xs flex items-center justify-between">
          <span>Error importing project: {importError}</span>
          <button onClick={() => setImportError(null)} className="text-red-400 hover:text-white font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* GitHub Repository Import Drawer / Modal */}
      {isImportingGithub && (
        <div className="mt-6 p-5 rounded-2xl bg-[#0a101f] border border-amber-500/60 shadow-2xl space-y-4 max-w-3xl">
          <div className="flex items-center justify-between pb-2 border-b border-blue-900/40">
            <div className="flex items-center gap-2">
              <Github className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                Connect Real GitHub Repository
              </span>
            </div>
            <button
              onClick={() => setIsImportingGithub(false)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
          </div>

          {/* Auth status banner */}
          <div className="p-3 rounded-xl bg-[#030816] border border-blue-900/50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  ghStatus.authenticated ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400'
                }`}
              />
              <div>
                <div className="font-semibold text-slate-200">
                  {ghStatus.authenticated
                    ? `Authenticated as @${ghStatus.user?.login} (${ghStatus.user?.public_repos} public repos)`
                    : 'Unauthenticated Public Mode (GITHUB_TOKEN not set)'}
                </div>
                <div className="text-[11px] text-slate-400">
                  {ghStatus.authenticated
                    ? `Rate Limit Remaining: ${ghStatus.rateLimit?.remaining}/${ghStatus.rateLimit?.limit} requests`
                    : 'You can import any public GitHub repository (e.g. facebook/react or owner/repo).'}
                </div>
              </div>
            </div>
          </div>

          {ghNotice && (
            <div className="p-2.5 rounded-lg bg-blue-950/50 border border-blue-800 text-blue-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{ghNotice}</span>
            </div>
          )}

          {/* Repository Selection */}
          <div className="space-y-3 text-xs">
            {ghStatus.authenticated && ghRepos.length > 0 ? (
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Select Permitted Repository
                </label>
                <select
                  value={selectedOwner && selectedRepo ? `${selectedOwner}/${selectedRepo}` : ''}
                  onChange={(e) => {
                    const [o, r] = e.target.value.split('/');
                    handleSelectRepo(o, r);
                  }}
                  className="w-full bg-[#030816] border border-blue-900/60 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                >
                  {ghRepos.map((repo) => (
                    <option key={repo.id} value={`${repo.owner.login}/${repo.name}`}>
                      {repo.full_name} {repo.private ? '🔒 (Private)' : '🌐 (Public)'}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Repository Owner / Name (or GitHub URL)
                </label>
                <input
                  type="text"
                  value={customRepoInput}
                  onChange={(e) => handleCustomRepoChange(e.target.value)}
                  placeholder="e.g. octocat/Hello-World or owner/repo"
                  className="w-full bg-[#030816] border border-blue-900/60 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            )}

            {/* Branch Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1 flex items-center justify-between">
                  <span>Branch</span>
                  {isFetchingBranches && (
                    <span className="text-[10px] text-amber-400 flex items-center gap-1">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      <span>Fetching branches...</span>
                    </span>
                  )}
                </label>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full bg-[#030816] border border-blue-900/60 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                >
                  {branches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name} {b.commit.sha ? `(${b.commit.sha.slice(0, 7)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Import Destination</label>
                <div className="p-2 rounded-lg bg-[#030816] border border-blue-900/60 text-slate-300 font-mono text-[11px] truncate">
                  Target: {selectedOwner || 'owner'}/{selectedRepo || 'repo'}@{selectedBranch || 'main'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-blue-900/40">
            <span className="text-[11px] text-slate-400">
              Preserves exact recursive directory structure and file tree.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsImportingGithub(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteGithubImport}
                disabled={isExecutingImport || !selectedOwner || !selectedRepo}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/10 disabled:opacity-50"
              >
                {isExecutingImport ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Importing Repository...</span>
                  </>
                ) : (
                  <>
                    <FolderGit2 className="w-3.5 h-3.5" />
                    <span>Import into Workspace</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Creation Modal / Drawer */}
      {isCreating && (
        <div className="mt-6 p-5 rounded-2xl bg-[#0a101f] border border-amber-500/60 shadow-2xl space-y-5 max-w-3xl">
          <div className="flex items-center justify-between pb-2 border-b border-blue-900/40">
            <span className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Initialize New Software Project</span>
            </span>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
          </div>

          {/* Quick Starter Templates */}
          <div>
            <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider block mb-2">
              Quick Start From Architecture Template:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {templates.map((tmpl, idx) => (
                <div
                  key={idx}
                  onClick={() => handleApplyTemplate(tmpl)}
                  className="p-3 rounded-xl bg-[#030816] border border-blue-900/50 hover:border-amber-500/60 cursor-pointer transition-all hover:-translate-y-0.5 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100 group-hover:text-amber-300">
                      {tmpl.name}
                    </span>
                    <ArrowRight className="w-3 h-3 text-amber-400 opacity-0 group-hover:opacity-100" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">{tmpl.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-blue-900/40">
            <span className="text-[11px] font-semibold text-slate-300 block mb-3">
              Or Customize Custom Workspace:
            </span>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Apex Gateway"
                    required
                    className="w-full bg-[#030816] border border-blue-900/60 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                    Tech Stack / Framework
                  </label>
                  <select
                    value={framework}
                    onChange={(e) => setFramework(e.target.value)}
                    className="w-full bg-[#030816] border border-blue-900/60 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Node.js / Express / TypeScript">Node.js / Express / TypeScript</option>
                    <option value="React / Vite / TypeScript">React / Vite / TypeScript</option>
                    <option value="Next.js / Full-Stack SSR">Next.js / Full-Stack SSR</option>
                    <option value="Microservice / gRPC / TypeScript">Microservice / gRPC / TypeScript</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">Tagline</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. High-throughput distributed event bus"
                  className="w-full bg-[#030816] border border-blue-900/60 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Description & Architecture Spec
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Brief architectural goal for Builder Agent..."
                  className="w-full bg-[#030816] border border-blue-900/60 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-blue-900/40">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/10"
                >
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {projects.map((proj) => {
          const isSelected = proj.id === currentProjectId;
          const passedCount = proj.tests.filter((t) => t.status === 'passed').length;
          const pendingTaskCount = proj.tasks.filter((t) => t.status !== 'completed').length;

          return (
            <div
              key={proj.id}
              onClick={() => onSelectProject(proj.id)}
              className={`rounded-2xl p-6 border flex flex-col justify-between cursor-pointer transition-all ${
                isSelected
                  ? 'bg-[#0a101f] border-amber-500/80 shadow-[0_0_20px_rgba(251,191,36,0.1)] ring-1 ring-amber-500/30'
                  : 'bg-[#0a101f]/80 backdrop-blur-md border-blue-900/50 hover:border-blue-700/80 hover:-translate-y-0.5'
              }`}
            >
              <div>
                {/* Top card header */}
                <div className="flex items-start justify-between gap-2 pb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white tracking-tight">{proj.name}</h2>
                      {isSelected && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-amber-400/90 font-medium mt-0.5">{proj.tagline}</p>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                  {proj.description}
                </p>

                {/* Badges and Metrics */}
                <div className="mt-4 pt-3 border-t border-blue-900/30 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-lg bg-[#030816] border border-blue-900/30">
                    <span className="text-slate-500 block text-[10px] uppercase">Files</span>
                    <span className="font-bold text-white font-mono">{proj.files.length}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#030816] border border-blue-900/30">
                    <span className="text-slate-500 block text-[10px] uppercase">Tasks</span>
                    <span className="font-bold text-amber-400 font-mono">{pendingTaskCount}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#030816] border border-blue-900/30">
                    <span className="text-slate-500 block text-[10px] uppercase">Tests</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      {passedCount}/{proj.tests.length}
                    </span>
                  </div>
                </div>

                {proj.githubRepo && (
                  <div className="mt-3 p-2 rounded-lg bg-[#030816] border border-blue-900/40 text-[11px] text-slate-300 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 truncate">
                      <Github className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate font-mono">{proj.githubRepo.owner}/{proj.githubRepo.repo}</span>
                    </div>
                    <span className="text-blue-400 font-mono shrink-0 ml-2">@{proj.githubRepo.branch}</span>
                  </div>
                )}
              </div>

              {/* Bottom Card Actions */}
              <div className="mt-5 pt-3 border-t border-blue-900/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onExportProjectZip(proj);
                    }}
                    className="p-1.5 rounded-lg bg-[#030816] hover:bg-blue-900/40 border border-blue-900/50 text-slate-300 hover:text-white transition-colors"
                    title="Export ZIP"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onExportProjectJson(proj);
                    }}
                    className="p-1.5 rounded-lg bg-[#030816] hover:bg-blue-900/40 border border-blue-900/50 text-slate-300 hover:text-white transition-colors"
                    title="Export JSON"
                  >
                    <Code2 className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                  {projects.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProject(proj.id);
                      }}
                      className="p-1.5 rounded-lg bg-[#030816] hover:bg-red-950/80 border border-blue-900/50 text-slate-400 hover:text-red-400 transition-colors"
                      title="Delete Project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                  <span>Open Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

