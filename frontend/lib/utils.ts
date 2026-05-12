import { parse, parseISO, isValid, subMonths, startOfMonth, startOfDay, endOfDay, isAfter, isBefore } from 'date-fns';
import type { SalesRow, RepStats, FilterState } from './types';

// ─── Date Helpers ──────────────────────────────────────────────────────────────

/** Parses a date string from Google Sheets (M/D/YYYY or YYYY-MM-DD) */
export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Try ISO format (YYYY-MM-DD)
  try {
    const d = parseISO(dateStr);
    if (isValid(d)) return d;
  } catch {}

  // Try M/D/YYYY (Google Sheets default)
  try {
    const d = parse(dateStr, 'M/d/yyyy', new Date());
    if (isValid(d)) return d;
  } catch {}

  // Try MM/DD/YYYY
  try {
    const d = parse(dateStr, 'MM/dd/yyyy', new Date());
    if (isValid(d)) return d;
  } catch {}

  return null;
}

function getDateRange(option: string, customStart?: string, customEnd?: string): [Date | null, Date | null] {
  const now = new Date();
  switch (option) {
    case 'all':   return [null, null];
    case '1m':    return [subMonths(now, 1), now];
    case '2m':    return [subMonths(now, 2), now];
    case '3m':    return [subMonths(now, 3), now];
    case '6m':    return [subMonths(now, 6), now];
    case 'mtd':   return [startOfMonth(now), now];
    case 'custom': {
      const start = customStart ? parseDate(customStart) : null;
      const end   = customEnd   ? parseDate(customEnd)   : null;
      return [start, end];
    }
    default: return [null, null];
  }
}

// ─── Filtering ─────────────────────────────────────────────────────────────────

export function filterRows(rows: SalesRow[], filters: FilterState): SalesRow[] {
  const [startDate, endDate] = getDateRange(filters.dateRange, filters.customStart, filters.customEnd);

  return rows.filter(row => {
    // Rep filter — empty array means "all"
    if (filters.reps.length > 0 && !filters.reps.includes(row.rep_name)) {
      return false;
    }

    // Date filter
    if (startDate || endDate) {
      const rowDate = parseDate(row.date);
      if (!rowDate) return true; // rows with unparseable dates are included
      if (startDate && isBefore(rowDate, startOfDay(startDate))) return false;
      if (endDate   && isAfter(rowDate,  endOfDay(endDate)))     return false;
    }

    return true;
  });
}

// ─── Aggregation ───────────────────────────────────────────────────────────────

const SUM_FIELDS = [
  'outbound_calls_made', 'outbound_calls_booked', 'calls_booked_on_calendar',
  'calls_rescheduled', 'calls_cancelled', 'calls_shown_up', 'offers_made',
  'dqs', 'deposits', 'closes', 'upsells',
  'new_cash_collected', 'recurring_cash_collected', 'upsell_cash_collected',
  'followup_cash_collected', 'total_revenue_generated',
] as const;

type SumKey = typeof SUM_FIELDS[number];

function computeRates(sums: Record<SumKey, number>): Pick<RepStats, 'close_rate' | 'show_rate' | 'show_rate_ex_cancellations' | 'offer_rate' | 'dq_rate' | 'avg_deal_size' | 'cash_per_call_booked'> {
  const bookedExCancelled = sums.calls_booked_on_calendar - sums.calls_cancelled;
  return {
    close_rate:                 sums.calls_shown_up > 0           ? sums.closes              / sums.calls_shown_up           : 0,
    show_rate:                  sums.calls_booked_on_calendar > 0 ? sums.calls_shown_up      / sums.calls_booked_on_calendar : 0,
    show_rate_ex_cancellations: bookedExCancelled > 0             ? sums.calls_shown_up      / bookedExCancelled             : 0,
    offer_rate:                 sums.calls_shown_up > 0           ? sums.offers_made         / sums.calls_shown_up           : 0,
    dq_rate:                    sums.calls_shown_up > 0           ? sums.dqs                 / sums.calls_shown_up           : 0,
    avg_deal_size:              sums.closes > 0                   ? sums.new_cash_collected  / sums.closes                   : 0,
    cash_per_call_booked:       sums.calls_booked_on_calendar > 0 ? sums.new_cash_collected  / sums.calls_booked_on_calendar : 0,
  };
}

/** Groups rows by rep, sums all numeric fields, computes derived rates. */
export function aggregateByRep(rows: SalesRow[]): RepStats[] {
  const repMap = new Map<string, { sums: Record<SumKey, number>; dates: Set<string> }>();

  for (const row of rows) {
    if (!repMap.has(row.rep_name)) {
      const sums = {} as Record<SumKey, number>;
      for (const f of SUM_FIELDS) sums[f] = 0;
      repMap.set(row.rep_name, { sums, dates: new Set() });
    }
    const entry = repMap.get(row.rep_name)!;
    for (const f of SUM_FIELDS) {
      entry.sums[f] += (row[f] as number) || 0;
    }
    if (row.date) entry.dates.add(row.date);
  }

  return Array.from(repMap.entries()).map(([rep_name, { sums, dates }]) => {
    const days_tracked = dates.size || 1;
    return {
      rep_name,
      days_tracked,
      ...sums,
      ...computeRates(sums),
    };
  });
}

/**
 * Aggregates all rep stats into a single totals row.
 * Rates are re-computed from summed raws — never averaged across reps.
 */
export function aggregateAll(repStats: RepStats[]): RepStats {
  const sums = {} as Record<SumKey, number>;
  for (const f of SUM_FIELDS) sums[f] = 0;
  let totalDays = 0;

  for (const rep of repStats) {
    for (const f of SUM_FIELDS) sums[f] += rep[f] || 0;
    totalDays += rep.days_tracked || 0;
  }

  return {
    rep_name: 'TOTALS',
    days_tracked: totalDays,
    ...sums,
    ...computeRates(sums),
  };
}

// ─── Heatmap Colors ────────────────────────────────────────────────────────────

/**
 * Returns an rgba background color for a heatmap cell.
 * Each row fades from dark green (best) through progressively darker greens to
 * black (worst). For lower-is-better metrics, the gradient is reversed.
 */
const HEATMAP_GREEN: [number, number, number] = [ 22, 163,  74]; // tailwind green-600
const HEATMAP_BLACK: [number, number, number] = [  0,   0,   0];

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpRgb(
  c1: [number, number, number],
  c2: [number, number, number],
  t: number,
): [number, number, number] {
  return [lerpChannel(c1[0], c2[0], t), lerpChannel(c1[1], c2[1], t), lerpChannel(c1[2], c2[2], t)];
}

export function getHeatmapColor(value: number, min: number, max: number, higherIsBetter: boolean): string {
  if (max === min) return 'rgba(120, 120, 120, 0.20)';
  let ratio = (value - min) / (max - min);  // 0 = min, 1 = max
  if (!higherIsBetter) ratio = 1 - ratio;   // flip so 1 always = "good"
  const rgb = lerpRgb(HEATMAP_BLACK, HEATMAP_GREEN, ratio);
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.95)`;
}

// ─── Formatting ────────────────────────────────────────────────────────────────

export function formatCurrency(n: number): string {
  if (!isFinite(n) || n === 0) return '$0';
  if (Math.abs(n) >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function formatPercent(n: number): string {
  if (!isFinite(n)) return '0.0%';
  return (n * 100).toFixed(1) + '%';
}

export function formatNumber(n: number): string {
  if (!isFinite(n)) return '0';
  return Math.round(n).toLocaleString('en-US');
}

// ─── Utility ───────────────────────────────────────────────────────────────────

export function getUniqueReps(rows: SalesRow[]): string[] {
  const reps = new Set<string>();
  for (const row of rows) {
    if (row.rep_name) reps.add(row.rep_name);
  }
  return Array.from(reps).sort();
}

export function getUniqueDateCount(rows: SalesRow[]): number {
  const dates = new Set<string>();
  for (const row of rows) {
    if (row.date) dates.add(row.date);
  }
  return dates.size;
}

/** Shortens "First Last" to "F. Last" for chart labels */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return name;
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}
