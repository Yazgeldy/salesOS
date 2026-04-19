'use client';

import { useMemo, useState } from 'react';
import type { RepStats } from '../lib/types';
import { aggregateAll, formatCurrency, formatPercent, formatNumber, getHeatmapColor } from '../lib/utils';

interface KpiRowDef {
  key: keyof RepStats;
  label: string;
  higherIsBetter: boolean;
  format: 'currency' | 'percent' | 'number';
}

const KPI_ROWS: KpiRowDef[] = [
  { key: 'total_revenue_generated',    label: 'Total Contract Value',  higherIsBetter: true,  format: 'currency' },
  { key: 'new_cash_collected',         label: 'Cash Collected',        higherIsBetter: true,  format: 'currency' },
  { key: 'recurring_cash_collected',   label: 'Recurring Cash',        higherIsBetter: true,  format: 'currency' },
  { key: 'upsell_cash_collected',      label: 'Upsell Cash',           higherIsBetter: true,  format: 'currency' },
  { key: 'followup_cash_collected',    label: 'Follow-Up Cash',        higherIsBetter: true,  format: 'currency' },
  { key: 'closes',                     label: 'Closes',                higherIsBetter: true,  format: 'number'   },
  { key: 'close_rate',                 label: 'Close Rate',            higherIsBetter: true,  format: 'percent'  },
  { key: 'avg_deal_size',              label: 'Avg Deal Size',         higherIsBetter: true,  format: 'currency' },
  { key: 'calls_booked_on_calendar',   label: 'Calls Booked',          higherIsBetter: true,  format: 'number'   },
  { key: 'calls_shown_up',             label: 'Showed Up',             higherIsBetter: true,  format: 'number'   },
  { key: 'show_rate',                  label: 'Show Rate',             higherIsBetter: true,  format: 'percent'  },
  { key: 'offers_made',                label: 'Offers Made',           higherIsBetter: true,  format: 'number'   },
  { key: 'offer_rate',                 label: 'Offer Rate',            higherIsBetter: true,  format: 'percent'  },
  { key: 'deposits',                   label: 'Deposits',              higherIsBetter: true,  format: 'number'   },
  { key: 'outbound_calls_made',        label: 'Outbound Made',         higherIsBetter: true,  format: 'number'   },
  { key: 'outbound_calls_booked',      label: 'Outbound Booked',       higherIsBetter: true,  format: 'number'   },
  { key: 'calls_cancelled',            label: 'Cancelled',             higherIsBetter: false, format: 'number'   },
  { key: 'calls_rescheduled',          label: 'Rescheduled',           higherIsBetter: false, format: 'number'   },
  { key: 'dqs',                        label: 'DQs',                   higherIsBetter: false, format: 'number'   },
  { key: 'dq_rate',                    label: 'DQ Rate',               higherIsBetter: false, format: 'percent'  },
  { key: 'upsells',                    label: 'Upsell Count',          higherIsBetter: true,  format: 'number'   },
  { key: 'contract_value_per_day',     label: 'Contract Value/Day',    higherIsBetter: true,  format: 'currency' },
  { key: 'cash_per_day',               label: 'Cash/Day',              higherIsBetter: true,  format: 'currency' },
  { key: 'days_tracked',               label: 'Days Tracked',          higherIsBetter: true,  format: 'number'   },
];

function fmtValue(value: number, format: 'currency' | 'percent' | 'number'): string {
  if (format === 'currency') return formatCurrency(value);
  if (format === 'percent')  return formatPercent(value);
  return formatNumber(value);
}

interface HeatmapViewProps {
  repStats: RepStats[];
}

export default function HeatmapView({ repStats }: HeatmapViewProps) {
  const [sortKpi, setSortKpi] = useState<keyof RepStats>('total_revenue_generated');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const sortedReps = [...repStats].sort((a, b) => {
    const av = (a[sortKpi] as number) ?? 0;
    const bv = (b[sortKpi] as number) ?? 0;
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  const totals = useMemo(() => aggregateAll(repStats), [repStats]);

  function handleKpiClick(key: keyof RepStats) {
    if (sortKpi === key) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKpi(key);
      setSortDir('desc');
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#2a2b38]">
      <table className="text-xs border-collapse" style={{ minWidth: `${160 + (sortedReps.length + 1) * 130}px` }}>
        <thead>
          <tr>
            {/* KPI label header */}
            <th className="sticky left-0 z-20 bg-[#0d0e15] border-r border-b border-[#2a2b38] px-4 py-3 text-left text-[10px] font-semibold text-[#6b7280] uppercase tracking-widest whitespace-nowrap min-w-[170px]">
              KPI
            </th>
            {/* Rep column headers */}
            {sortedReps.map(rep => (
              <th
                key={rep.rep_name}
                className="border-b border-[#2a2b38] px-3 py-3 text-center text-[11px] font-semibold text-[#e8e9f0] whitespace-nowrap"
              >
                {rep.rep_name}
              </th>
            ))}
            {/* Team total header */}
            <th className="sticky right-0 z-20 bg-[#0d0e15] border-l border-b border-[#2a2b38] px-3 py-3 text-center text-[10px] font-semibold text-[#6b7280] uppercase tracking-widest whitespace-nowrap">
              Team Total
            </th>
          </tr>
        </thead>

        <tbody>
          {KPI_ROWS.map(({ key, label, higherIsBetter, format }) => {
            const values   = sortedReps.map(r => (r[key] as number) ?? 0);
            const min      = Math.min(...values);
            const max      = Math.max(...values);
            const isActive = sortKpi === key;
            const totalValue = (totals[key] as number) ?? 0;

            return (
              <tr
                key={key}
                className={`border-b border-[#2a2b38] transition-colors hover:brightness-125 ${
                  isActive ? 'bg-[#141520]' : ''
                }`}
              >
                {/* KPI label — sticky, clickable to sort */}
                <td
                  className={`sticky left-0 z-10 border-r border-[#2a2b38] px-4 py-2.5 text-[11px] font-medium whitespace-nowrap cursor-pointer select-none transition-colors ${
                    isActive
                      ? 'bg-[#141520] text-[#3b82f6]'
                      : 'bg-[#0d0e15] text-[#9093a8] hover:text-[#3b82f6]'
                  }`}
                  onClick={() => handleKpiClick(key)}
                >
                  <div className="flex items-center gap-1.5">
                    {label}
                    {isActive && (
                      <span className="text-[10px] text-[#3b82f6]">
                        {sortDir === 'desc' ? '↓' : '↑'}
                      </span>
                    )}
                  </div>
                </td>

                {/* Data cells */}
                {sortedReps.map(rep => {
                  const value   = (rep[key] as number) ?? 0;
                  const bgColor = getHeatmapColor(value, min, max, higherIsBetter);
                  return (
                    <td
                      key={rep.rep_name}
                      className="px-3 py-2.5 text-center font-mono tabular-nums text-[11px] text-white whitespace-nowrap"
                      style={{ backgroundColor: bgColor }}
                    >
                      {fmtValue(value, format)}
                    </td>
                  );
                })}

                {/* Team total cell — sticky right, neutral style */}
                <td
                  className={`sticky right-0 z-10 border-l border-[#2a2b38] px-3 py-2.5 text-center font-mono tabular-nums text-[11px] font-semibold text-[#e8e9f0] whitespace-nowrap ${
                    isActive ? 'bg-[#141520]' : 'bg-[#0d0e15]'
                  }`}
                >
                  {fmtValue(totalValue, format)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
