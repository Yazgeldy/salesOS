'use client';

import { useState, useRef, useEffect } from 'react';
import type { FilterState, DateRangeOption } from '../lib/types';

interface FilterBarProps {
  allReps: string[];
  filters: FilterState;
  onChange: (f: FilterState) => void;
}

const DATE_PRESETS: { label: string; value: DateRangeOption }[] = [
  { label: 'All Time', value: 'all'    },
  { label: '1M',       value: '1m'     },
  { label: '2M',       value: '2m'     },
  { label: '3M',       value: '3m'     },
  { label: '6M',       value: '6m'     },
  { label: 'Custom',   value: 'custom' },
];

export default function FilterBar({ allReps, filters, onChange }: FilterBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch]             = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const filteredReps = allReps.filter(r =>
    r.toLowerCase().includes(search.toLowerCase())
  );

  // reps: [] means "all selected"
  const allSelected    = filters.reps.length === 0;
  const selectedCount  = filters.reps.length;
  const isRepSelected  = (rep: string) => allSelected || filters.reps.includes(rep);

  function toggleSelectAll() {
    onChange({ ...filters, reps: [] });
  }

  function toggleRep(rep: string) {
    if (allSelected) {
      // Was all-selected; deselect this rep specifically
      onChange({ ...filters, reps: allReps.filter(r => r !== rep) });
    } else if (filters.reps.includes(rep)) {
      const next = filters.reps.filter(r => r !== rep);
      // If we just deselected the last remaining rep, treat as "show nothing"
      onChange({ ...filters, reps: next });
    } else {
      const next = [...filters.reps, rep];
      // If all reps are now explicitly selected, normalize back to []
      onChange({ ...filters, reps: next.length === allReps.length ? [] : next });
    }
  }

  function setDateRange(value: DateRangeOption) {
    onChange({ ...filters, dateRange: value });
  }

  const triggerLabel = allSelected
    ? 'All Closers'
    : `${selectedCount} Closer${selectedCount !== 1 ? 's' : ''}`;

  return (
    <div className="flex flex-wrap gap-6 items-end px-6 py-4 border-b border-[#2a2b38] bg-[#0a0b0f]">

      {/* ── Closer dropdown ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold text-[#6b7280] uppercase tracking-widest">
          Closer
        </label>
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setDropdownOpen(d => !d)}
            className="flex items-center justify-between gap-3 px-3 py-2 bg-[#12131a] border border-[#2a2b38] rounded text-sm text-[#e8e9f0] hover:border-[#3b82f6] transition-colors min-w-[160px]"
          >
            <span className={allSelected ? 'text-[#6b7280]' : 'text-[#e8e9f0]'}>
              {triggerLabel}
            </span>
            <span className="text-[#6b7280] text-xs">{dropdownOpen ? '▴' : '▾'}</span>
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-[#12131a] border border-[#2a2b38] rounded-lg shadow-2xl z-50">
              {/* Search */}
              <div className="p-2 border-b border-[#2a2b38]">
                <input
                  type="text"
                  placeholder="Search closers…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#0a0b0f] border border-[#2a2b38] rounded text-sm text-[#e8e9f0] placeholder-[#6b7280] outline-none focus:border-[#3b82f6] transition-colors"
                  autoFocus
                />
              </div>

              {/* Select All */}
              <div className="border-b border-[#2a2b38]">
                <label className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#1a1b24] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5"
                  />
                  <span className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wide">
                    Select All
                  </span>
                </label>
              </div>

              {/* Rep list */}
              <div className="max-h-60 overflow-y-auto">
                {filteredReps.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-[#6b7280]">No closers found</div>
                ) : (
                  filteredReps.map(rep => (
                    <label
                      key={rep}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-[#1a1b24] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isRepSelected(rep)}
                        onChange={() => toggleRep(rep)}
                        className="w-3.5 h-3.5"
                      />
                      <span className="text-sm text-[#e8e9f0]">{rep}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Date Range ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold text-[#6b7280] uppercase tracking-widest">
          Date Range
        </label>
        <div className="flex flex-col gap-2">
          <div className="flex gap-1">
            {DATE_PRESETS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setDateRange(value)}
                className={`px-3 py-2 text-xs font-medium rounded border transition-colors ${
                  filters.dateRange === value
                    ? 'bg-[#3b82f6] border-[#3b82f6] text-white'
                    : 'bg-[#12131a] border-[#2a2b38] text-[#a0a0b8] hover:border-[#3b82f6] hover:text-[#e8e9f0]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Custom date pickers */}
          {filters.dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.customStart}
                onChange={e => onChange({ ...filters, customStart: e.target.value })}
                className="px-2.5 py-1.5 bg-[#12131a] border border-[#2a2b38] rounded text-xs text-[#e8e9f0] outline-none focus:border-[#3b82f6] transition-colors"
              />
              <span className="text-[#6b7280] text-xs">→</span>
              <input
                type="date"
                value={filters.customEnd}
                min={filters.customStart}
                onChange={e => onChange({ ...filters, customEnd: e.target.value })}
                className="px-2.5 py-1.5 bg-[#12131a] border border-[#2a2b38] rounded text-xs text-[#e8e9f0] outline-none focus:border-[#3b82f6] transition-colors"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
