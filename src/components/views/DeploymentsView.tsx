import React, { useState } from 'react';
import {
  Rocket,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
  Server,
  Cloud,
  Globe,
  Play,
  Terminal,
} from 'lucide-react';
import { ProjectConfig, DeploymentRecord } from '../../types';

interface DeploymentsViewProps {
  currentProject: ProjectConfig;
  previewState?: { status: 'stopped' | 'starting' | 'running' | 'failed'; port?: number; previewUrl?: string; pid?: number };
  onDeploy: (environment: 'production' | 'staging' | 'preview') => void;
  onRollback: (deploymentId: string) => void;
  onTogglePreview: () => void;
}

export const DeploymentsView: React.FC<DeploymentsViewProps> = ({
  currentProject,
  previewState,
  onDeploy,
  onRollback,
  onTogglePreview,
}) => {
  const [selectedEnv, setSelectedEnv] = useState<'production' | 'staging' | 'preview'>('staging');
  const [isDeploying, setIsDeploying] = useState(false);

  const handleTrigger = (env: 'production' | 'staging' | 'preview') => {
    setIsDeploying(true);
    onDeploy(env);
    setTimeout(() => setIsDeploying(false), 2000);
  };

  const environments = [
    {
      id: 'local',
      name: 'Local Dev Server',
      type: 'Local Workspace',
      url: 'http://localhost:3000',
      status: 'active',
      version: 'v1.0.0 (Local)',
      ssl: 'Local Loopback (Ingress)',
      region: 'localhost (Container)',
      trafficSplit: '100%',
      configured: true,
    },
    {
      id: 'staging',
      name: 'Staging Environment',
      type: 'Staging Target',
      url: currentProject.githubRepo
        ? `https://github.com/${currentProject.githubRepo.owner}/${currentProject.githubRepo.repo}/tree/${currentProject.githubRepo.branch}`
        : 'Target: Not Configured',
      status: currentProject.githubRepo ? 'git_linked' : 'not_connected',
      version: currentProject.githubRepo ? `Branch: ${currentProject.githubRepo.branch}` : 'Pending CI Link',
      ssl: currentProject.githubRepo ? 'GitHub TLS / Verified' : 'N/A',
      region: currentProject.githubRepo ? `Remote: ${currentProject.githubRepo.owner}/${currentProject.githubRepo.repo}` : 'Unassigned',
      trafficSplit: '0%',
      configured: Boolean(currentProject.githubRepo),
    },
    {
      id: 'production',
      name: 'Production Cloud Target',
      type: 'Production Target',
      url: currentProject.repoUrl ? currentProject.repoUrl : 'Target: Not Configured',
      status: currentProject.repoUrl ? 'git_linked' : 'not_connected',
      version: currentProject.version || 'v1.0.0',
      ssl: currentProject.repoUrl ? 'GitHub TLS / Verified' : 'N/A',
      region: currentProject.githubRepo ? 'Production Branch (main)' : 'Unassigned',
      trafficSplit: '0%',
      configured: Boolean(currentProject.repoUrl),
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#020617] text-slate-100 p-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-blue-900/40">
        <div>
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">Deployments & Environments</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/30 border border-blue-500/30 text-emerald-400 font-mono font-semibold">
              VFS Live
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Build release pipelines, verify local server outputs, and configure remote deployment targets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleTrigger('staging')}
            disabled={isDeploying}
            className="px-3.5 py-1.5 rounded-lg bg-[#0a101f] hover:bg-blue-900/40 border border-blue-900/50 text-blue-300 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Cloud className="w-3.5 h-3.5 text-blue-400" />
            <span>Deploy to Staging</span>
          </button>

          <button
            onClick={() => handleTrigger('production')}
            disabled={isDeploying}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/10 transition-all active:scale-95 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-slate-950" />
            <span>Release to Production</span>
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-[#0a101f]/80 border border-blue-900/50 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-blue-900/40 bg-[#030816]">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-100 uppercase tracking-wider">
            <Server className="w-4 h-4 text-amber-400" />
            <span>Live Preview</span>
          </div>
          <button
            onClick={onTogglePreview}
            className="px-3 py-1.5 rounded-lg border border-blue-900/60 bg-[#0a101f] text-xs font-semibold text-blue-300 hover:text-amber-300"
          >
            {previewState?.status === 'running' ? 'Stop Preview' : previewState?.status === 'starting' ? 'Starting...' : 'Start Preview'}
          </button>
        </div>

        <div className="h-[420px] bg-[#020617]">
          {previewState?.status === 'running' && previewState.previewUrl ? (
            <iframe
              title={`${currentProject.name} live preview`}
              src={previewState.previewUrl}
              className="w-full h-full border-0 bg-white"
              sandbox="allow-scripts allow-forms allow-popups allow-modals"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              {previewState?.status === 'starting'
                ? 'Preview starting…'
                : previewState?.status === 'failed'
                ? 'Preview failed to start.'
                : 'No live preview is running for this project.'}
            </div>
          )}
        </div>
      </div>

      {/* Target Environments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
        {environments.map((env) => (
          <div
            key={env.id}
            className="rounded-2xl bg-[#0a101f]/80 backdrop-blur-md border border-blue-900/50 hover:border-amber-500/40 p-5 transition-all"
          >
            <div className="flex items-center justify-between pb-2 border-b border-blue-900/40">
              <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                {env.type}
              </span>
              {env.configured ? (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {env.status}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-amber-400/80 font-semibold px-2 py-0.5 rounded-full bg-amber-950/40 border border-amber-800/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  NOT CONNECTED
                </span>
              )}
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Version:</span>
                <span className="font-mono text-amber-400 font-semibold">{env.version}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Traffic:</span>
                <span className="font-mono">{env.trafficSplit}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Region:</span>
                <span className="font-mono text-slate-400">{env.region}</span>
              </div>
              <div className="pt-2 border-t border-blue-900/40">
                {env.configured ? (
                  <a
                    href={env.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-400 hover:text-amber-300 flex items-center gap-1 truncate font-mono"
                  >
                    <Globe className="w-3 h-3 shrink-0" />
                    <span className="truncate">{env.url}</span>
                    <ExternalLink className="w-2.5 h-2.5 shrink-0 ml-auto" />
                  </a>
                ) : (
                  <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                    <Globe className="w-3 h-3 shrink-0 text-slate-600" />
                    <span>Remote Target Not Connected</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Deployment History Table */}
      <div className="mt-6">
        <div className="flex items-center justify-between pb-3">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>Release History & Audit Trace</span>
          </h2>
        </div>

        <div className="rounded-2xl bg-[#0a101f] border border-blue-900/50 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#030816] border-b border-blue-900/40 text-slate-400 font-mono text-[11px] uppercase">
              <tr>
                <th className="py-3 px-4">Environment</th>
                <th className="py-3 px-4">Version</th>
                <th className="py-3 px-4">Commit</th>
                <th className="py-3 px-4">Author</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4 text-right">Rollback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-900/30">
              {currentProject.deployments.map((dep) => (
                <tr key={dep.id} className="hover:bg-blue-900/20 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-100 capitalize">{dep.environment}</td>
                  <td className="py-3 px-4 text-amber-400 font-mono font-bold">{dep.version}</td>
                  <td className="py-3 px-4 text-slate-400 font-mono">{dep.commitHash}</td>
                  <td className="py-3 px-4 text-slate-300">{dep.author}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                      {dep.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-mono">{dep.buildDurationSec}s</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => onRollback(dep.id)}
                      className="p-1 rounded bg-[#030816] hover:bg-blue-900/40 border border-blue-900/50 text-slate-300 hover:text-amber-300 transition-colors"
                      title="Rollback to this release"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
