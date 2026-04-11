'use client';

import { useState, useEffect, useMemo } from 'react';
import type { SalesRow, RepStats, FilterState, ViewMode } from '../lib/types';
import {
  filterRows,
  aggregateByRep,
  aggregateAll,
  getUniqueReps,
  getUniqueDateCount,
} from '../lib/utils';
import { fetchSalesData } from '../lib/api';
import FilterBar from '../components/FilterBar';
import KPICards from '../components/KPICards';
import HeatmapView from '../components/HeatmapView';
import ChartsView from '../components/ChartsView';
import LeaderboardView from '../components/LeaderboardView';

const DEFAULT_FILTERS: FilterState = {
  reps: [],
  dateRange: 'all',
  customStart: '',
  customEnd: '',
};

export default function Dashboard() {
  const [rawData, setRawData]   = useState<SalesRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [lastSync, setLastSync] = useState('');
  const [activeView, setActiveView] = useState<ViewMode>('heatmap');
  const [filters, setFilters]   = useState<FilterState>(DEFAULT_FILTERS);

  useEffect(() => {
    fetchSalesData()
      .then(({ data, last_sync }) => {
        setRawData(data);
        setLastSync(last_sync);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Derived state — all computed from rawData + filters
  const allReps      = useMemo(() => getUniqueReps(rawData), [rawData]);
  const filteredRows = useMemo(() => filterRows(rawData, filters), [rawData, filters]);
  const repStats     = useMemo(() => aggregateByRep(filteredRows), [filteredRows]);
  const totals       = useMemo(() => aggregateAll(repStats), [repStats]);
  const dayCount     = useMemo(() => getUniqueDateCount(filteredRows), [filteredRows]);

  const syncLabel = lastSync
    ? `synced ${new Date(lastSync).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
          <span className="text-[#6b7280] text-sm">Loading data…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center">
        <div className="bg-[#12131a] border border-red-900/40 rounded-lg p-6 max-w-md text-center">
          <div className="text-red-400 font-semibold mb-2">Failed to load data</div>
          <div className="text-[#6b7280] text-sm">{error}</div>
          <div className="text-[#6b7280] text-xs mt-3">
            Make sure <code className="text-[#a0a0b8]">MODAL_API_URL</code> is set in{' '}
            <code className="text-[#a0a0b8]">frontend/.env.local</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0b0f]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between px-6 py-4 border-b border-[#2a2b38]">
        <div>
          <h1 className="text-lg font-bold text-[#e8e9f0] tracking-tight leading-tight">
            SOS MASTERMIND{' '}
            <span className="text-[#6b7280] font-normal">—</span>{' '}
            <span className="text-[#3b82f6]">INBOUND CLOSING</span>
          </h1>
          <p className="text-xs text-[#6b7280] mt-0.5">
            {filteredRows.length.toLocaleString()} records
            {dayCount > 0 && ` · ${dayCount} day${dayCount !== 1 ? 's' : ''}`}
            {syncLabel && ` · ${syncLabel}`}
          </p>
        </div>

        {/* View toggle */}
        <div className="flex gap-1 bg-[#12131a] border border-[#2a2b38] rounded-md p-1">
          {(['heatmap', 'charts', 'leaderboard'] as ViewMode[]).map(view => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={`px-4 py-1.5 text-xs font-semibold rounded transition-colors capitalize ${
                activeView === view
                  ? 'bg-[#3b82f6] text-white'
                  : 'text-[#6b7280] hover:text-[#e8e9f0]'
              }`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────────────────── */}
      <FilterBar allReps={allReps} filters={filters} onChange={setFilters} />

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <KPICards totals={totals} />

      {/* ── Main View ──────────────────────────────────────────────────────── */}
      <div className="px-6 pb-10">
        {repStats.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-[#6b7280] text-sm">
            No data for the selected filters.
          </div>
        ) : (
          <>
            {activeView === 'heatmap'     && <HeatmapView repStats={repStats} />}
            {activeView === 'charts'      && <ChartsView repStats={repStats} />}
            {activeView === 'leaderboard' && <LeaderboardView repStats={repStats} totals={totals} />}
          </>
        )}
      </div>
    </div>
  );
}
