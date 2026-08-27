import { ProjectFile, HistoryEvent } from '../types';

export interface FileDiffResult {
  path: string;
  isNew: boolean;
  isDeleted: boolean;
  isModified: boolean;
  additions: number;
  deletions: number;
  unifiedDiff: string;
}

export interface GitCommitPayload {
  owner: string;
  repo: string;
  branch: string;
  message: string;
  files: { path: string; content: string }[];
}

export interface GitHubRepoItem {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  private: boolean;
  description: string | null;
  default_branch: string;
  updated_at: string;
  html_url: string;
}

export interface GitHubBranchItem {
  name: string;
  commit: { sha: string; url: string };
  protected?: boolean;
}

export interface GitHubAuthStatus {
  authenticated: boolean;
  message?: string;
  user?: {
    login: string;
    name: string;
    avatar_url: string;
    public_repos: number;
  };
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: number;
  };
  error?: string;
}

export class GitService {
  /**
   * Generates line-by-line unified diff between old and new string content.
   */
  public static computeFileDiff(
    filePath: string,
    originalContent: string,
    newContent: string
  ): FileDiffResult {
    if (originalContent === newContent) {
      return {
        path: filePath,
        isNew: false,
        isDeleted: false,
        isModified: false,
        additions: 0,
        deletions: 0,
        unifiedDiff: '',
      };
    }

    const isNew = originalContent.length === 0 && newContent.length > 0;
    const isDeleted = originalContent.length > 0 && newContent.length === 0;

    const oldLines = originalContent.length > 0 ? originalContent.split('\n') : [];
    const newLines = newContent.length > 0 ? newContent.split('\n') : [];

    const diffLines: string[] = [
      `--- a/${filePath}`,
      `+++ b/${filePath}`,
      `@@ -1,${oldLines.length || 1} +1,${newLines.length || 1} @@`,
    ];

    let additions = 0;
    let deletions = 0;

    // Simple LCS-based or line comparison for diff display
    const maxLen = Math.max(oldLines.length, newLines.length);
    let i = 0;
    let j = 0;

    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
        diffLines.push(` ${oldLines[i]}`);
        i++;
        j++;
      } else if (i < oldLines.length && (j >= newLines.length || !newLines.includes(oldLines[i]))) {
        diffLines.push(`-${oldLines[i]}`);
        deletions++;
        i++;
      } else if (j < newLines.length) {
        diffLines.push(`+${newLines[j]}`);
        additions++;
        j++;
      } else {
        if (i < oldLines.length) {
          diffLines.push(`-${oldLines[i]}`);
          deletions++;
          i++;
        }
        if (j < newLines.length) {
          diffLines.push(`+${newLines[j]}`);
          additions++;
          j++;
        }
      }
    }

    return {
      path: filePath,
      isNew,
      isDeleted,
      isModified: true,
      additions,
      deletions,
      unifiedDiff: diffLines.join('\n'),
    };
  }

  /**
   * Compare a baseline set of files with current working files to find modified files and generate real diffs.
   */
  public static computeWorkspaceDiff(
    baselineFiles: ProjectFile[],
    workingFiles: ProjectFile[]
  ): FileDiffResult[] {
    const baselineMap = new Map(baselineFiles.map((f) => [f.path, f.content]));
    const workingMap = new Map(workingFiles.map((f) => [f.path, f.content]));
    const allPaths = Array.from(new Set([...baselineMap.keys(), ...workingMap.keys()])).sort();

    const results: FileDiffResult[] = [];

    for (const p of allPaths) {
      const orig = baselineMap.get(p) ?? '';
      const curr = workingMap.get(p) ?? '';
      if (orig !== curr) {
        results.push(this.computeFileDiff(p, orig, curr));
      }
    }

    return results;
  }

  /**
   * Check real GitHub authentication status from backend
   */
  public static async getAuthStatus(): Promise<GitHubAuthStatus> {
    try {
      const res = await fetch('/api/github/status');
      if (!res.ok) {
        return { authenticated: false, error: `HTTP ${res.status}: ${res.statusText}` };
      }
      return await res.json();
    } catch (err: any) {
      return { authenticated: false, error: err.message || 'Failed to connect to backend' };
    }
  }

  /**
   * List authorized repositories for authenticated user
   */
  public static async listRepositories(): Promise<{ success: boolean; repos: GitHubRepoItem[]; error?: string }> {
    try {
      const res = await fetch('/api/github/repos');
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, repos: [], error: err.message };
    }
  }

  /**
   * Fetch branches for a specific repository
   */
  public static async listBranches(
    owner: string,
    repo: string
  ): Promise<{ success: boolean; branches: GitHubBranchItem[]; error?: string }> {
    try {
      const res = await fetch(`/api/github/branches?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`);
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, branches: [], error: err.message };
    }
  }

  /**
   * Import repository files from GitHub into Builder Board workspace
   */
  public static async importRepository(
    owner: string,
    repo: string,
    branch: string
  ): Promise<{
    success: boolean;
    files?: ProjectFile[];
    treeSha?: string;
    repoInfo?: { name: string; fullName?: string; description: string; defaultBranch: string; private?: boolean };
    error?: string;
    totalFilesFound?: number;
  }> {
    try {
      const res = await fetch('/api/github/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, branch }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Execute real commit and push to GitHub (or report blocked if unauthenticated)
   */
  public static async commitAndPush(payload: GitCommitPayload): Promise<{
    success: boolean;
    commitSha?: string;
    verifiedRemoteSha?: string;
    pushed?: boolean;
    blocked?: boolean;
    reason?: string;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/github/commit-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
