import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Key,
  Sliders,
  Save,
  Check,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Cpu,
  Server,
  Zap,
  History,
  Rocket,
  ChevronRight,
} from 'lucide-react';
import { ProjectConfig, WorkspaceSettings, AutonomyLevel, WorkspaceView } from '../../types';

interface SettingsViewProps {
  currentProject: ProjectConfig;
  settings: WorkspaceSettings;
  onUpdateSettings: (newSettings: WorkspaceSettings) => void;
  onUpdateProjectEnv: (newEnvs: ProjectConfig['envVariables']) => void;
  onNavigate: (view: WorkspaceView) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentProject,
  settings,
  onUpdateSettings,
  onUpdateProjectEnv,
  onNavigate,
}) => {
  const [localSettings, setLocalSettings] = useState<WorkspaceSettings>(settings);
  const [envVars, setEnvVars] = useState(currentProject.envVariables || []);
  const [showSecretMap, setShowSecretMap] = useState<Record<number, boolean>>({});
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [newIsSecret, setNewIsSecret] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(localSettings);
    onUpdateProjectEnv(envVars);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 1500);
  };

  const handleAddEnv = () => {
    if (!newKey.trim()) return;
    setEnvVars([
      ...envVars,
      { key: newKey.trim(), value: newVal.trim(), isSecret: newIsSecret },
    ]);
    setNewKey('');
    setNewVal('');
    setNewIsSecret(false);
  };

  const handleRemoveEnv = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const toggleShowSecret = (index: number) => {
    setShowSecretMap((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#020617] text-slate-100 p-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-blue-900/40">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">Workspace Configuration</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/30 border border-blue-500/30 text-blue-300 font-mono">
              Engine Settings
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Fine-tune autonomous agent permissions, runtime environment variables, and build safety constraints.
          </p>
        </div>

        <button
          onClick={handleSave}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
            saveSuccess
              ? 'bg-emerald-600 text-white'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/10 active:scale-95'
          }`}
        >
          {saveSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          <span>{saveSuccess ? 'Settings Saved' : 'Save Changes'}</span>
        </button>
      </div>

      <div className="mt-6 space-y-6 max-w-4xl">
        {/* Workspace Tools: secondary access for History & Deployments */}
        <div className="rounded-2xl bg-[#0a101f]/80 backdrop-blur-md border border-blue-900/50 p-5 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-blue-900/40">
            <Server className="w-4 h-4 text-blue-400" />
            <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Workspace Tools</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => onNavigate('history')}
              className="flex items-center justify-between p-3 rounded-xl bg-[#030816] border border-blue-900/40 hover:border-amber-500/40 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <History className="w-4 h-4 text-blue-400" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">History</div>
                  <div className="text-[11px] text-slate-500">Commits, builds, and milestones</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
            <button
              onClick={() => onNavigate('deployments')}
              className="flex items-center justify-between p-3 rounded-xl bg-[#030816] border border-blue-900/40 hover:border-amber-500/40 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <Rocket className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">Deployments</div>
                  <div className="text-[11px] text-slate-500">Environments, releases, rollbacks</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Section 1: Agent Safety & Autonomy Controls */}
        <div className="rounded-2xl bg-[#0a101f]/80 backdrop-blur-md border border-blue-900/50 p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-blue-900/40">
            <Shield className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Autonomous Agent Safety Policies
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-300 font-semibold block mb-1.5">
                Default Autonomy Level
              </label>
              <select
                value={localSettings.autonomyLevel}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    autonomyLevel: e.target.value as AutonomyLevel,
                  })
                }
                className="w-full bg-[#030816] border border-blue-900/60 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="supervised">Supervised (Require confirmation for file writes)</option>
                <option value="semi_autonomous">Semi-Autonomous (Auto-plan & code)</option>
                <option value="fully_autonomous">Fully Autonomous (Auto-plan, build, test, repair)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1.5 flex items-center justify-between">
                <span>Maximum Execution Step Budget</span>
                <span className="text-amber-400 font-mono font-bold">
                  {localSettings.maxStepBudget} steps
                </span>
              </label>
              <input
                type="range"
                min="3"
                max="30"
                value={localSettings.maxStepBudget}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    maxStepBudget: Number(e.target.value),
                  })
                }
                className="w-full accent-amber-500 cursor-pointer mt-2"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.autoRunTests}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, autoRunTests: e.target.checked })
                }
                className="accent-amber-500 rounded"
              />
              <span className="text-slate-300">Auto-run tests after code generation</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.strictTypeValidation}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    strictTypeValidation: e.target.checked,
                  })
                }
                className="accent-amber-500 rounded"
              />
              <span className="text-slate-300">Strict TypeScript type assertions</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.autoFormatCode}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, autoFormatCode: e.target.checked })
                }
                className="accent-amber-500 rounded"
              />
              <span className="text-slate-300">Auto-format generated files</span>
            </label>
          </div>

          {/* Custom System Prompt Instructions */}
          <div className="pt-3 border-t border-blue-900/40">
            <label className="text-slate-300 font-semibold block mb-1 text-xs">
              Agent Directives & Engineering Standards
            </label>
            <textarea
              value={localSettings.customInstructions}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, customInstructions: e.target.value })
              }
              rows={2}
              placeholder="e.g. Always write defensive null checks, adhere to strict REST conventions, enforce RS256 token verification..."
              className="w-full bg-[#030816] border border-blue-900/60 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Section 2: Environment Variables */}
        <div className="rounded-2xl bg-[#0a101f]/80 backdrop-blur-md border border-blue-900/50 p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-blue-900/40">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-400" />
              <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                Environment Variables & Secrets (.env)
              </h2>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Target: {currentProject.name}
            </span>
          </div>

          {/* Existing Env Vars List */}
          <div className="space-y-2">
            {envVars.map((ev, index) => {
              const isVisible = showSecretMap[index];
              return (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 rounded-lg bg-[#030816] border border-blue-900/40 text-xs"
                >
                  <span className="font-mono font-bold text-amber-300 w-1/3 truncate">
                    {ev.key}
                  </span>
                  <div className="flex-1 font-mono text-slate-300 truncate">
                    {ev.isSecret && !isVisible ? '••••••••••••••••' : ev.value}
                  </div>
                  {ev.isSecret && (
                    <button
                      type="button"
                      onClick={() => toggleShowSecret(index)}
                      className="p-1 text-slate-400 hover:text-white"
                      title={isVisible ? 'Mask secret' : 'Reveal secret'}
                    >
                      {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveEnv(index)}
                    className="p-1 text-slate-500 hover:text-red-400"
                    title="Remove Variable"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add New Env Var */}
          <div className="pt-3 border-t border-blue-900/40 grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="KEY_NAME"
              className="bg-[#030816] border border-blue-900/60 rounded-lg px-2.5 py-1.5 text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500"
            />
            <input
              type="text"
              value={newVal}
              onChange={(e) => setNewVal(e.target.value)}
              placeholder="value"
              className="bg-[#030816] border border-blue-900/60 rounded-lg px-2.5 py-1.5 text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500 sm:col-span-2"
            />
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={newIsSecret}
                  onChange={(e) => setNewIsSecret(e.target.checked)}
                  className="accent-amber-500 rounded"
                />
                <span>Secret</span>
              </label>
              <button
                type="button"
                onClick={handleAddEnv}
                className="px-3 py-1.5 rounded-lg bg-[#0a101f] hover:bg-blue-900/40 border border-blue-900/50 text-slate-200 font-semibold text-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
