import JSZip from 'jszip';
import { ProjectConfig, HistoryEvent, LogEntry } from '../types';

export async function exportProjectAsZip(project: ProjectConfig): Promise<void> {
  const zip = new JSZip();

  // Add project files
  for (const file of project.files) {
    zip.file(file.path, file.content);
  }

  // Add project metadata JSON
  const meta = {
    name: project.name,
    tagline: project.tagline,
    description: project.description,
    framework: project.framework,
    version: project.version,
    branch: project.branch,
    createdAt: new Date(project.createdAt).toISOString(),
    tasks: project.tasks,
    tests: project.tests.map((t) => ({
      name: t.name,
      suite: t.suite,
      status: t.status,
    })),
    exportedAt: new Date().toISOString(),
    generator: 'Builder Board Autonomous System',
  };

  zip.file('builder-board.config.json', JSON.stringify(meta, null, 2));

  // Add .env template (masking actual secret values)
  if (project.envVariables && project.envVariables.length > 0) {
    const envContent = project.envVariables
      .map((ev) => `${ev.key}=${ev.isSecret ? '********' : ev.value}`)
      .join('\n');
    zip.file('.env.example', envContent);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-bundle.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(downloadUrl);
}

export function exportProjectAsJson(project: ProjectConfig): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project, null, 2));
  const anchor = document.createElement('a');
  anchor.setAttribute('href', dataStr);
  anchor.setAttribute('download', `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-project.json`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function exportAuditLog(project: ProjectConfig, logs: LogEntry[] = [], history: HistoryEvent[] = []): void {
  const report = {
    projectName: project.name,
    version: project.version,
    exportTimestamp: new Date().toISOString(),
    summary: {
      totalFiles: project.files.length,
      totalTasks: project.tasks.length,
      completedTasks: project.tasks.filter((t) => t.status === 'completed').length,
      totalTests: project.tests.length,
      passedTests: project.tests.filter((t) => t.status === 'passed').length,
      deployments: project.deployments.length,
    },
    historyEvents: history.length > 0 ? history : project.history,
    recentLogs: logs,
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2));
  const anchor = document.createElement('a');
  anchor.setAttribute('href', dataStr);
  anchor.setAttribute('download', `builder-board-${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-audit-report.json`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export const exportProjectZip = exportProjectAsZip;
export const exportProjectJson = exportProjectAsJson;
export function exportAuditTrail(project: ProjectConfig): void {
  exportAuditLog(project, [], project.history);
}
