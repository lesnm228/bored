import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Search,
  Code2,
  Check,
} from 'lucide-react';
import { ProjectConfig, TestCase } from '../../types';

interface TestsViewProps {
  currentProject: ProjectConfig;
  onRunAllTests: () => void;
  onRunSingleTest: (testId: string) => void;
}

export const TestsView: React.FC<TestsViewProps> = ({
  currentProject,
  onRunAllTests,
  onRunSingleTest,
}) => {
  const [filter, setFilter] = useState<'all' | 'passed' | 'failed'>('all');
  const [search, setSearch] = useState('');
  const [selectedTest, setSelectedTest] = useState<TestCase | null>(null);

  const passedCount = currentProject.tests.filter((t) => t.status === 'passed').length;
  const failedCount = currentProject.tests.filter((t) => t.status === 'failed').length;
  const totalCount = currentProject.tests.length;
  const passRate = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 100;

  const filteredTests = currentProject.tests.filter((t) => {
    if (filter === 'passed') return t.status === 'passed';
    if (filter === 'failed') return t.status === 'failed';
    return true;
  }).filter((t) => t.name.toLowerCase().includes(search.toLowerCase()) || t.suite.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#020617] text-slate-100 p-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-blue-900/40">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-blue-400" />
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">Test Matrix & Validation</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/30 border border-blue-500/30 text-amber-300 font-mono">
              Vitest / TypeScript
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated unit tests, integration contracts, and regression test suites.
          </p>
        </div>

        <button
          onClick={onRunAllTests}
          className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/10 transition-all active:scale-95"
        >
          <Play className="w-3.5 h-3.5 fill-slate-950" />
          <span>Run All Tests</span>
        </button>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">
        <div className="rounded-2xl bg-[#0a101f]/80 backdrop-blur-md border border-blue-900/50 p-5">
          <span className="text-xs text-slate-400 font-medium">Test Pass Rate</span>
          <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">{passRate}%</div>
          <div className="w-full bg-[#030816] h-1.5 rounded-full mt-2 overflow-hidden border border-blue-900/30">
            <div className="bg-emerald-400 h-full rounded-full shadow-[0_0_8px_#22c55e]" style={{ width: `${passRate}%` }} />
          </div>
        </div>

        <div className="rounded-2xl bg-[#0a101f]/80 backdrop-blur-md border border-blue-900/50 p-5">
          <span className="text-xs text-slate-400 font-medium">Passed Suites</span>
          <div className="text-2xl font-black text-white mt-1 font-mono">
            {passedCount} <span className="text-xs text-slate-500 font-normal">/ {totalCount}</span>
          </div>
          <p className="text-[10px] text-emerald-400 mt-2">Zero regressions reported</p>
        </div>

        <div className="rounded-2xl bg-[#0a101f]/80 backdrop-blur-md border border-blue-900/50 p-5">
          <span className="text-xs text-slate-400 font-medium">Avg Execution Time</span>
          <div className="text-2xl font-black text-amber-400 mt-1 font-mono">18ms</div>
          <p className="text-[10px] text-slate-400 mt-2">Target &lt; 50ms (Passed)</p>
        </div>

        <div className="rounded-2xl bg-[#0a101f]/80 backdrop-blur-md border border-blue-900/50 p-5">
          <span className="text-xs text-slate-400 font-medium">Code Coverage</span>
          <div className="text-2xl font-black text-blue-400 mt-1 font-mono">92.4%</div>
          <p className="text-[10px] text-slate-400 mt-2">Branches & Functions</p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pb-2">
        <div className="flex items-center gap-2">
          {['all', 'passed', 'failed'].map((st) => (
            <button
              key={st}
              onClick={() => setFilter(st as any)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                filter === st
                  ? 'bg-blue-900/40 border border-amber-500/50 text-amber-300'
                  : 'bg-[#0a101f] border border-blue-900/50 text-slate-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search test assertions..."
            className="w-full bg-[#0a101f] border border-blue-900/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Test Cases Table */}
      <div className="mt-2 rounded-2xl bg-[#0a101f] border border-blue-900/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#030816] border-b border-blue-900/40 text-slate-400 font-mono text-[11px] uppercase">
              <tr>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Assertion / Test Name</th>
                <th className="py-3 px-4">Suite</th>
                <th className="py-3 px-4">File</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-900/30">
              {filteredTests.map((test) => (
                <tr
                  key={test.id}
                  className="hover:bg-blue-900/20 transition-colors cursor-pointer"
                  onClick={() => setSelectedTest(test)}
                >
                  <td className="py-3 px-4">
                    {test.status === 'passed' ? (
                      <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>PASS</span>
                      </span>
                    ) : test.status === 'failed' ? (
                      <span className="flex items-center gap-1.5 text-red-400 font-semibold">
                        <XCircle className="w-4 h-4" />
                        <span>FAIL</span>
                      </span>
                    ) : test.status === 'running' ? (
                      <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                        <Clock className="w-4 h-4 animate-spin" />
                        <span>RUNNING</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 font-mono">IDLE</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-200">{test.name}</td>
                  <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{test.suite}</td>
                  <td className="py-3 px-4 text-blue-400 font-mono text-[11px]">{test.file}</td>
                  <td className="py-3 px-4 text-slate-400 font-mono">{test.durationMs}ms</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRunSingleTest(test.id);
                      }}
                      className="px-2 py-1 rounded bg-[#030816] hover:bg-blue-900/40 border border-blue-900/50 text-slate-200 text-[11px] font-semibold transition-colors"
                    >
                      Re-run
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
