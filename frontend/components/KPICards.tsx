import type { RepStats } from '../lib/types';
import { formatCurrency, formatPercent, formatNumber } from '../lib/utils';

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  accent?: boolean;
}

function KPICard({ title, value, subtitle, accent = false }: KPICardProps) {
  return (
    <div className="bg-[#12131a] border border-[#2a2b38] rounded-lg p-4 flex flex-col gap-1 min-w-0">
      <span className="text-[10px] font-semibold text-[#6b7280] uppercase tracking-widest truncate">
        {title}
      </span>
      <span className={`text-2xl font-bold font-mono tabular-nums leading-none ${accent ? 'text-[#3b82f6]' : 'text-[#e8e9f0]'}`}>
        {value}
      </span>
      {subtitle && (
        <span className="text-[11px] text-[#6b7280] truncate">{subtitle}</span>
      )}
    </div>
  );
}

interface KPICardsProps {
  totals: RepStats;
}

export default function KPICards({ totals }: KPICardsProps) {
  const totalCash =
    totals.new_cash_collected +
    totals.recurring_cash_collected +
    totals.upsell_cash_collected +
    totals.followup_cash_collected;

  function pct(n: number) {
    return totalCash > 0 ? formatPercent(n / totalCash) : '—';
  }

  return (
    <div className="px-6 py-4 flex flex-col gap-3 border-b border-[#2a2b38]">
      {/* Row 1 — Revenue */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPICard
          title="Total Contract Value"
          value={formatCurrency(totals.total_revenue_generated)}
          subtitle="Sum of all contract values"
        />
        <KPICard
          title="Cash Collected"
          value={formatCurrency(totals.new_cash_collected)}
          subtitle="New cash collected"
        />
        <KPICard
          title="Recurring Cash"
          value={formatCurrency(totals.recurring_cash_collected)}
          subtitle={`${pct(totals.recurring_cash_collected)} of cash`}
        />
        <KPICard
          title="Upsell Cash"
          value={formatCurrency(totals.upsell_cash_collected)}
          subtitle={`${pct(totals.upsell_cash_collected)} of cash`}
        />
        <KPICard
          title="Follow-Up Cash"
          value={formatCurrency(totals.followup_cash_collected)}
          subtitle={`${pct(totals.followup_cash_collected)} of cash`}
        />
      </div>

      {/* Row 2 — Performance Rates */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPICard
          title="Close Rate"
          value={formatPercent(totals.close_rate)}
          subtitle={`${formatNumber(totals.closes)}/${formatNumber(totals.calls_shown_up)} shows`}
          accent
        />
        <KPICard
          title="Show Rate"
          value={formatPercent(totals.show_rate)}
          subtitle={`${formatNumber(totals.calls_shown_up)}/${formatNumber(totals.calls_booked_on_calendar)} booked`}
          accent
        />
        <KPICard
          title="Offer Rate"
          value={formatPercent(totals.offer_rate)}
          subtitle={`${formatNumber(totals.offers_made)}/${formatNumber(totals.calls_shown_up)} shown`}
          accent
        />
        <KPICard
          title="Avg Deal Size"
          value={formatCurrency(totals.avg_deal_size)}
          subtitle="Cash collected / close"
        />
        <KPICard
          title="Outbound Dials"
          value={formatNumber(totals.outbound_calls_made)}
          subtitle={`${formatNumber(totals.outbound_calls_booked)} booked`}
        />
      </div>
    </div>
  );
}
