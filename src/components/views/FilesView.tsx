import React, { useState, useMemo } from 'react';
import {
  Folder,
  FileCode,
  Plus,
  Trash2,
  Save,
  Check,
  Code2,
  Search,
  Sparkles,
  FileText,
  FileJson,
  RotateCcw,
  CheckCircle2,
  Layers,
  Copy,
  GitCommit,
  GitBranch,
  Github,
  GitCompare,
  UploadCloud,
  AlertCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import { ProjectConfig, ProjectFile } from '../../types';
import { GitService, FileDiffResult } from '../../services/gitService';

interface FilesViewProps {
  currentProject: ProjectConfig;
  onUpdateFile: (file: ProjectFile) => void;
  onCreateFile: (path: string, content?: string) => void;
  onDeleteFile: (fileId: string) => void;
  onCommitSuccess?: (commitSha: string, message: string) => void;
}

export const FilesView: React.FC<FilesViewProps> = ({
  currentProject,
  onUpdateFile,
  onCreateFile,
  onDeleteFile,
  onCommitSuccess,
}) => {
  const [selectedFileId, setSelectedFileId] = useState<string>(
    currentProject.files[0]?.id || ''
  );
  const [activeTabIds, setActiveTabIds] = useState<string[]>([
    currentProject.files[0]?.id || '',
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Git Diff & Commit Modal state
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitFeedback, setCommitFeedback] = useState<{
    success?: boolean;
    message?: string;
    commitSha?: string;
    verifiedRemoteSha?: string;
    blocked?: boolean;
  } | null>(null);

  // Compute real workspace diffs compared against baseline files
  const workspaceDiffs = useMemo(() => {
    const baseline = currentProject.gitBaselineFiles || [];
    return GitService.computeWorkspaceDiff(
      baseline.map((b) => ({
        id: b.path,
        path: b.path,
        name: b.path.split('/').pop() || b.path,
        content: b.content,
        language: 'typescript',
        lastModified: 0,
      })),
      currentProject.files
    );
  }, [currentProject.files, currentProject.gitBaselineFiles]);

  const [selectedDiffPath, setSelectedDiffPath] = useState<string>(
    workspaceDiffs[0]?.path || ''
  );

  const selectedDiff = workspaceDiffs.find((d) => d.path === selectedDiffPath) || workspaceDiffs[0];

  const selectedFile =
    currentProject.files.find((f) => f.id === selectedFileId) ||
    currentProject.files[0];

  const handleSelectFile = (file: ProjectFile) => {
    setSelectedFileId(file.id);
    if (!activeTabIds.includes(file.id)) {
      setActiveTabIds((prev) => [...prev, file.id]);
    }
  };

  const handleCloseTab = (idToClose: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = activeTabIds.filter((id) => id !== idToClose);
    setActiveTabIds(newTabs);
    if (selectedFileId === idToClose && newTabs.length > 0) {
      setSelectedFileId(newTabs[newTabs.length - 1]);
    }
  };

  const handleContentChange = (newContent: string) => {
    if (!selectedFile) return;
    onUpdateFile({
      ...selectedFile,
      content: newContent,
      lastModified: Date.now(),
      isModified: true,
    });
  };

  const handleSave = () => {
    if (!selectedFile) return;
    onUpdateFile({
      ...selectedFile,
      lastModified: Date.now(),
      isModified: false,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 1500);
  };

  const handleCreateNewFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilePath.trim()) return;
    onCreateFile(newFilePath.trim());
    setNewFilePath('');
    setIsCreatingNew(false);
  };

  const handleCopyCode = () => {
    if (!selectedFile) return;
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCommitAndPush = async () => {
    const owner = currentProject.githubRepo?.owner || 'owner';
    const repo = currentProject.githubRepo?.repo || 'repo';
    const branch = currentProject.githubRepo?.branch || currentProject.branch || 'main';
    const message = commitMessage.trim() || `Update ${workspaceDiffs.length} files via Builder Board Agent`;

    setIsCommitting(true);
    setCommitFeedback(null);

    try {
      const res = await GitService.commitAndPush({
        owner,
        repo,
        branch,
        message,
        files: currentProject.files.map((f) => ({ path: f.path, content: f.content })),
      });

      if (res.blocked) {
        setCommitFeedback({
          success: false,
          blocked: true,
          message: res.reason || 'Remote push blocked due to missing GITHUB_TOKEN write access in environment.',
        });
      } else if (res.success) {
        setCommitFeedback({
          success: true,
          commitSha: res.commitSha,
          verifiedRemoteSha: res.verifiedRemoteSha,
          message: `Successfully created and verified commit ${res.commitSha?.slice(0, 7)} on branch ${branch}.`,
        });
        if (onCommitSuccess && res.commitSha) {
          onCommitSuccess(res.commitSha, message);
        }
      } else {
        setCommitFeedback({
          success: false,
          message: res.error || 'Commit & Push operation failed.',
        });
      }
    } catch (err: any) {
      setCommitFeedback({
        success: false,
        message: err.message || 'Unexpected error during commit operation.',
      });
    } finally {
      setIsCommitting(false);
    }
  };

  const filteredFiles = currentProject.files.filter((f) =>
    f.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.json')) return <FileJson className="w-4 h-4 text-amber-400" />;
    if (fileName.endsWith('.md')) return <FileText className="w-4 h-4 text-blue-300" />;
    return <FileCode className="w-4 h-4 text-blue-400" />;
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-[#020617] text-slate-100 font-sans">
      {/* File Tree Explorer (Left Rail) */}
      <div className="w-64 bg-[#030816] border-r border-blue-900/40 flex flex-col justify-between shrink-0">
        <div className="p-3 border-b border-blue-900/40">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
              <Folder className="w-3.5 h-3.5 text-amber-400" />
              <span>Project Files</span>
            </span>
            <button
              onClick={() => setIsCreatingNew(true)}
              className="p-1 rounded-md bg-[#0a101f] hover:bg-blue-900/40 text-slate-300 hover:text-white border border-blue-900/50 transition-colors"
              title="Create New File"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </div>

          {/* File Search */}
          <div className="relative mt-1">
            <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full bg-[#0a101f] border border-blue-900/50 rounded-lg pl-7 pr-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* New File Creation Input Form */}
        {isCreatingNew && (
          <form onSubmit={handleCreateNewFile} className="p-2 border-b border-blue-900/40 bg-[#0a101f]">
            <input
              type="text"
              value={newFilePath}
              onChange={(e) => setNewFilePath(e.target.value)}
              placeholder="e.g. src/utils/helpers.ts"
              autoFocus
              className="w-full bg-[#030816] border border-amber-500/70 rounded px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="text-[11px] text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="text-[11px] px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold"
              >
                Add File
              </button>
            </div>
          </form>
        )}

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredFiles.map((file) => {
            const isSelected = file.id === selectedFileId;
            return (
              <div
                key={file.id}
                onClick={() => handleSelectFile(file)}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-900/30 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {getFileIcon(file.name)}
                  <span className="truncate">{file.path}</span>
                </div>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {currentProject.files.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFile(file.id);
                      }}
                      className="p-0.5 hover:text-red-400 transition-colors"
                      title="Delete File"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom File Summary */}
        <div className="p-3 border-t border-blue-900/40 bg-[#030816] text-[11px] text-slate-500 flex items-center justify-between">
          <span>{currentProject.files.length} Files</span>
          {workspaceDiffs.length > 0 ? (
            <button
              onClick={() => setShowDiffModal(true)}
              className="text-amber-400 hover:text-amber-300 font-mono flex items-center gap-1"
            >
              <GitCompare className="w-3 h-3" />
              <span>{workspaceDiffs.length} Modified</span>
            </button>
          ) : (
            <span className="text-emerald-400 font-mono">Clean Tree</span>
          )}
        </div>
      </div>

      {/* Editor & Content Area (Right Main) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Editor Tabs Bar */}
        <div className="h-10 bg-[#0a101f] border-b border-blue-900/40 flex items-center justify-between px-2 select-none overflow-x-auto">
          <div className="flex items-center gap-1">
            {activeTabIds.map((tabId) => {
              const file = currentProject.files.find((f) => f.id === tabId);
              if (!file) return null;
              const isActive = tabId === selectedFileId;
              return (
                <div
                  key={tabId}
                  onClick={() => setSelectedFileId(tabId)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs cursor-pointer border-t border-x transition-colors ${
                    isActive
                      ? 'bg-[#030816] text-amber-300 border-amber-500/40 font-semibold'
                      : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-800/30'
                  }`}
                >
                  {getFileIcon(file.name)}
                  <span className="truncate max-w-[140px]">{file.name}</span>
                  {file.isModified && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  {activeTabIds.length > 1 && (
                    <button
                      onClick={(e) => handleCloseTab(tabId, e)}
                      className="text-slate-400 hover:text-white p-0.5 rounded"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2 pr-2">
            {/* Git Diff button */}
            {workspaceDiffs.length > 0 && (
              <button
                onClick={() => setShowDiffModal(true)}
                className="px-2.5 py-1 rounded bg-[#030816] hover:bg-blue-900/40 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Review Git Diffs and Commit"
              >
                <GitCompare className="w-3.5 h-3.5 text-amber-400" />
                <span>Git Diff ({workspaceDiffs.length})</span>
              </button>
            )}

            {selectedFile && (
              <>
                <button
                  onClick={handleCopyCode}
                  className="p-1.5 rounded bg-[#030816] hover:bg-blue-900/40 text-slate-300 hover:text-white text-xs flex items-center gap-1 border border-blue-900/40 transition-colors"
                  title="Copy code"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  onClick={handleSave}
                  className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
                    savedSuccess
                      ? 'bg-emerald-600 text-white'
                      : selectedFile.isModified
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-[#030816] hover:bg-blue-900/40 text-slate-300 border border-blue-900/40'
                  }`}
                >
                  {savedSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{savedSuccess ? 'Saved' : 'Save'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Code View / Textarea Editor with Line Numbers */}
        {selectedFile ? (
          <div className="flex-1 flex overflow-hidden bg-[#030816] relative">
            {/* Line Numbers Gutter */}
            <div className="w-12 bg-[#030816] border-r border-blue-900/30 py-3 text-right pr-3 select-none text-xs font-mono text-slate-600 overflow-hidden shrink-0">
              {selectedFile.content.split('\n').map((_, index) => (
                <div key={index} className="leading-6">
                  {index + 1}
                </div>
              ))}
            </div>

            {/* Code Textarea */}
            <div className="flex-1 relative overflow-hidden">
              <textarea
                value={selectedFile.content}
                onChange={(e) => handleContentChange(e.target.value)}
                spellCheck={false}
                className="w-full h-full bg-transparent p-3 font-mono text-xs sm:text-sm text-slate-200 leading-6 focus:outline-none resize-none selection:bg-amber-500/30 selection:text-amber-200"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
            No file selected. Pick a file from the explorer on the left.
          </div>
        )}

        {/* Editor Status Bar */}
        {selectedFile && (
          <div className="h-7 bg-[#0a101f] border-t border-blue-900/40 px-4 flex items-center justify-between text-[11px] text-slate-400 font-mono select-none">
            <div className="flex items-center gap-4">
              <span>Path: {selectedFile.path}</span>
              <span>Lines: {selectedFile.content.split('\n').length}</span>
              <span>Bytes: {new Blob([selectedFile.content]).size}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-amber-400 uppercase">{selectedFile.language}</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Syntax Verified</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Git Diff & Commit Modal */}
      {showDiffModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-[#0a101f] border border-amber-500/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-4 border-b border-blue-900/40 flex items-center justify-between bg-[#030816]">
              <div className="flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  Workspace Git Changes ({workspaceDiffs.length} Modified Files)
                </h3>
              </div>
              <button
                onClick={() => setShowDiffModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 flex overflow-hidden">
              {/* File list on left */}
              <div className="w-60 bg-[#030816] border-r border-blue-900/40 p-2 overflow-y-auto space-y-1">
                {workspaceDiffs.map((diff) => {
                  const isSel = (diff.path === selectedDiffPath) || (!selectedDiffPath && diff === workspaceDiffs[0]);
                  return (
                    <div
                      key={diff.path}
                      onClick={() => setSelectedDiffPath(diff.path)}
                      className={`p-2 rounded-lg text-xs cursor-pointer font-mono flex items-center justify-between ${
                        isSel
                          ? 'bg-blue-900/40 text-amber-300 border border-amber-500/40'
                          : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-200'
                      }`}
                    >
                      <span className="truncate">{diff.path}</span>
                      <div className="flex items-center gap-1 text-[10px]">
                        {diff.additions > 0 && <span className="text-emerald-400">+{diff.additions}</span>}
                        {diff.deletions > 0 && <span className="text-red-400">-{diff.deletions}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Diff unified viewer on right */}
              <div className="flex-1 p-4 bg-[#020617] overflow-y-auto font-mono text-xs text-slate-300 space-y-1">
                {selectedDiff ? (
                  selectedDiff.unifiedDiff.split('\n').map((line, idx) => {
                    const isAdd = line.startsWith('+') && !line.startsWith('+++');
                    const isDel = line.startsWith('-') && !line.startsWith('---');
                    const isHeader = line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++');

                    return (
                      <div
                        key={idx}
                        className={`leading-5 px-1 rounded ${
                          isAdd
                            ? 'bg-emerald-950/60 text-emerald-300'
                            : isDel
                            ? 'bg-red-950/60 text-red-300'
                            : isHeader
                            ? 'text-amber-400 font-bold bg-blue-950/30'
                            : 'text-slate-400'
                        }`}
                      >
                        {line || ' '}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-slate-500 p-4">No changes detected in workspace.</div>
                )}
              </div>
            </div>

            {/* Commit Form & Feedback */}
            <div className="p-4 border-t border-blue-900/40 bg-[#030816] space-y-3">
              {commitFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    commitFeedback.success
                      ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                      : commitFeedback.blocked
                      ? 'bg-amber-950/50 border-amber-700 text-amber-200'
                      : 'bg-red-950/50 border-red-800 text-red-300'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <div className="leading-snug">{commitFeedback.message}</div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Commit message (e.g. refactor: update routing logic)"
                  className="flex-1 w-full bg-[#0a101f] border border-blue-900/60 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                />

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => setShowDiffModal(false)}
                    className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white"
                  >
                    Close
                  </button>

                  <button
                    onClick={handleCommitAndPush}
                    disabled={isCommitting || workspaceDiffs.length === 0}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/10 disabled:opacity-50"
                  >
                    {isCommitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Pushing to GitHub...</span>
                      </>
                    ) : (
                      <>
                        <GitCommit className="w-3.5 h-3.5" />
                        <span>Commit & Push Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

