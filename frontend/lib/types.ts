/** Raw row from the Modal API — matches the Python dict keys exactly */
export interface SalesRow {
  rep_name: string;
  date: string;
  outbound_calls_made: number;
  outbound_calls_booked: number;
  calls_booked_on_calendar: number;
  calls_rescheduled: number;
  calls_cancelled: number;
  calls_shown_up: number;
  offers_made: number;
  dqs: number;
  deposits: number;
  closes: number;
  upsells: number;
  new_cash_collected: number;
  recurring_cash_collected: number;
  upsell_cash_collected: number;
  followup_cash_collected: number;
  total_revenue_generated: number;
  objections: string;
}

/** Per-rep aggregated stats, computed client-side from filtered SalesRows */
export interface RepStats {
  rep_name: string;
  days_tracked: number;
  // Raw sums
  outbound_calls_made: number;
  outbound_calls_booked: number;
  calls_booked_on_calendar: number;
  calls_rescheduled: number;
  calls_cancelled: number;
  calls_shown_up: number;
  offers_made: number;
  dqs: number;
  deposits: number;
  closes: number;
  upsells: number;
  new_cash_collected: number;
  recurring_cash_collected: number;
  upsell_cash_collected: number;
  followup_cash_collected: number;
  total_revenue_generated: number;
  // Computed rates (never average — always re-computed from sums)
  close_rate: number;             // closes / calls_shown_up
  show_rate: number;              // calls_shown_up / calls_booked_on_calendar
  offer_rate: number;             // offers_made / calls_shown_up
  dq_rate: number;                // dqs / calls_shown_up
  avg_deal_size: number;          // new_cash_collected / closes
  contract_value_per_day: number; // total_revenue_generated / days_tracked
  cash_per_day: number;           // new_cash_collected / days_tracked
}

/** Shape returned by the Modal web endpoint */
export interface ApiResponse {
  data: SalesRow[];
  last_sync: string;
  count: number;
}

/** Filter state owned by page.tsx */
export interface FilterState {
  reps: string[];           // empty array = all reps selected
  dateRange: DateRangeOption;
  customStart: string;      // ISO date string e.g. "2025-01-01"
  customEnd: string;        // ISO date string
}

export type DateRangeOption = 'all' | '1m' | '2m' | '3m' | '6m' | 'mtd' | 'custom';
export type ViewMode = 'heatmap' | 'charts' | 'leaderboard';
