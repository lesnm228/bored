import React, { useEffect, useState } from 'react';
import { Monitor, Play, Square, RefreshCw, ExternalLink } from 'lucide-react';
import { ProjectConfig } from '../../types';

interface PreviewViewProps {
  currentProject: ProjectConfig;
  runtime: { state: string; port?: number; sessionId?: string } | null;
  onStartRuntime: () => void;
  onStopRuntime: () => void;
}

export const PreviewView: React.FC<PreviewViewProps> = ({ currentProject, runtime, onStartRuntime, onStopRuntime }) => {
  const isRunning = runtime?.state === 'RUNNING';
  const isStarting = runtime?.state === 'STARTING';
  const previewUrl = `/api/runtime/preview/${encodeURIComponent(currentProject.id)}/`;
  const [reloadKey, setReloadKey] = useState(0);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    setPreviewError(false);
  }, [previewUrl, runtime?.state]);

  const handleRetry = () => {
    setPreviewError(false);
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#020617] text-slate-100">
      <div className="px-6 py-4 border-b border-blue-900/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <Monitor className="w-4 h-4 text-amber-400" />
          <h1 className="text-lg font-bold text-slate-100">Preview</h1>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold border flex items-center gap-1 ${
              isRunning
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400'
                : isStarting
                ? 'bg-amber-950/60 border-amber-500/50 text-amber-400 animate-pulse'
                : 'bg-slate-900/80 border-slate-700 text-slate-400'
            }`}
          >
            {runtime?.state || 'STOPPED'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isRunning && (
            <>
              <button
                onClick={() => handleRetry()}
                className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/5"
                title="Reload preview"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/5"
                title="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
              </a>
            </>
          )}

          {isRunning ? (
            <button
              onClick={onStopRuntime}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors active:scale-95"
            >
              <Square className="w-3 h-3 fill-white" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              onClick={onStartRuntime}
              disabled={isStarting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-900 font-semibold text-xs transition-colors active:scale-95"
            >
              <Play className="w-3 h-3 fill-slate-900" />
              <span>{isStarting ? 'Starting…' : 'Start Preview'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 bg-[#030816] p-6 overflow-hidden">
        {isRunning && !previewError ? (
          <div className="w-full h-full rounded-xl overflow-hidden border border-blue-900/40 bg-white">
            <iframe
              key={reloadKey}
              src={previewUrl}
              title="Live project preview"
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              onLoad={() => setPreviewError(false)}
              onError={() => setPreviewError(true)}
            />
          </div>
        ) : (
          <div className="w-full h-full rounded-xl border border-dashed border-blue-900/50 flex flex-col items-center justify-center gap-3 text-center px-6">
            {isRunning && previewError ? (
              <>
                <Monitor className="w-10 h-10 text-red-400" />
                <p className="text-sm text-slate-200 max-w-md">Preview failed to load or render the generated app. The dev server is running, but the preview endpoint could not complete the render.</p>
                <button
                  onClick={handleRetry}
                  className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-white font-semibold text-xs transition-colors active:scale-95"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              </>
            ) : (
              <>
                <Monitor className="w-10 h-10 text-slate-600" />
                <p className="text-sm text-slate-400 max-w-sm">
                  {isStarting
                    ? 'Starting the dev server for this project…'
                    : 'No live preview running. Start the dev server to see your generated project rendered here.'}
                </p>
                {!isStarting && (
                  <button
                    onClick={onStartRuntime}
                    className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold text-xs transition-colors active:scale-95"
                  >
                    <Play className="w-3 h-3 fill-slate-900" />
                    <span>Start Preview</span>
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
