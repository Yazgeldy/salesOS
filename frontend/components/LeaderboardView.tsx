'use client';

import { useState } from 'react';
import type { RepStats } from '../lib/types';
import { formatCurrency, formatPercent, formatNumber } from '../lib/utils';

const MEDALS = ['🥇', '🥈', '🥉'];

const MEDAL_BORDER = [
  'border-l-2 border-l-yellow-500',
  'border-l-2 border-l-gray-400',
  'border-l-2 border-l-amber-700',
];

interface ColDef {
  key: keyof RepStats;
  label: string;
  format: 'currency' | 'percent' | 'number';
}

const COLUMNS: ColDef[] = [
  { key: 'total_revenue_generated',  label: 'Contract Value', format: 'currency' },
  { key: 'new_cash_collected',       label: 'Cash Collected', format: 'currency' },
  { key: 'recurring_cash_collected', label: 'Recurring',      format: 'currency' },
  { key: 'upsell_cash_collected',    label: 'Upsell',         format: 'currency' },
  { key: 'followup_cash_collected',  label: 'Follow-Up',      format: 'currency' },
  { key: 'closes',                   label: 'Closes',         format: 'number'   },
  { key: 'close_rate',               label: 'Close %',        format: 'percent'  },
  { key: 'show_rate',                label: 'Show %',         format: 'percent'  },
  { key: 'avg_deal_size',            label: 'Avg Deal',       format: 'currency' },
  { key: 'days_tracked',             label: 'Days',           format: 'number'   },
];

function fmtValue(value: number, format: 'currency' | 'percent' | 'number'): string {
  if (format === 'currency') return formatCurrency(value);
  if (format === 'percent')  return formatPercent(value);
  return formatNumber(value);
}

interface LeaderboardViewProps {
  repStats: RepStats[];
  totals: RepStats;
}

export default function LeaderboardView({ repStats, totals }: LeaderboardViewProps) {
  const [sortKey, setSortKey] = useState<keyof RepStats>('total_revenue_generated');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const sorted = [...repStats].sort((a, b) => {
    const av = (a[sortKey] as number) ?? 0;
    const bv = (b[sortKey] as number) ?? 0;
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  function handleSort(key: keyof RepStats) {
    if (sortKey === key) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#2a2b38]">
      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr className="bg-[#0d0e15]">
            <th className="px-4 py-3 text-left text-[10px] font-semibold text-[#6b7280] uppercase tracking-widest w-10 border-b border-[#2a2b38]">
              #
            </th>
            <th className="px-4 py-3 text-left text-[10px] font-semibold text-[#6b7280] uppercase tracking-widest border-b border-[#2a2b38]">
              Rep
            </th>
            {COLUMNS.map(col => (
              <th
                key={col.key as string}
                onClick={() => handleSort(col.key)}
                className={`px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest cursor-pointer select-none whitespace-nowrap border-b border-[#2a2b38] transition-colors hover:text-[#3b82f6] ${
                  sortKey === col.key ? 'text-[#3b82f6]' : 'text-[#6b7280]'
                }`}
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {sorted.map((rep, i) => (
            <tr
              key={rep.rep_name}
              className={`border-b border-[#2a2b38] transition-colors hover:bg-[#1a1b24] ${
                i < 3 ? MEDAL_BORDER[i] : ''
              }`}
            >
              {/* Rank */}
              <td className="px-4 py-3 text-sm">
                {i < 3 ? (
                  <span>{MEDALS[i]}</span>
                ) : (
                  <span className="text-[#6b7280] font-mono">{i + 1}</span>
                )}
              </td>

              {/* Rep name */}
              <td className="px-4 py-3 text-[#e8e9f0] font-medium whitespace-nowrap">
                {rep.rep_name}
              </td>

              {/* Data columns */}
              {COLUMNS.map(col => (
                <td
                  key={col.key as string}
                  className={`px-4 py-3 font-mono tabular-nums text-right whitespace-nowrap ${
                    sortKey === col.key ? 'text-[#e8e9f0]' : 'text-[#9093a8]'
                  }`}
                >
                  {fmtValue((rep[col.key] as number) ?? 0, col.format)}
                </td>
              ))}
            </tr>
          ))}

          {/* Totals row */}
          <tr className="border-t-2 border-[#3b82f6] bg-[#0d0e15]">
            <td className="px-4 py-3 text-[#6b7280]">—</td>
            <td className="px-4 py-3 text-[10px] font-semibold text-[#6b7280] uppercase tracking-widest">
              Totals
            </td>
            {COLUMNS.map(col => (
              <td
                key={col.key as string}
                className="px-4 py-3 font-mono tabular-nums text-right text-[11px] font-semibold text-[#9093a8] whitespace-nowrap"
              >
                {fmtValue((totals[col.key] as number) ?? 0, col.format)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
