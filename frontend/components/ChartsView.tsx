'use client';

import type { RepStats } from '../lib/types';
import { formatCurrency, formatPercent, shortName } from '../lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, ReferenceLine,
} from 'recharts';

// ─── Chart Palette ─────────────────────────────────────────────────────────────
const C = {
  blue:   '#3b82f6',
  green:  '#22c55e',
  purple: '#a855f7',
  orange: '#f97316',
  teal:   '#14b8a6',
  yellow: '#eab308',
};

// ─── Shared Tooltip / Grid styles ──────────────────────────────────────────────
const TOOLTIP = {
  contentStyle: {
    backgroundColor: '#12131a',
    border: '1px solid #2a2b38',
    borderRadius: '8px',
    color: '#e8e9f0',
    fontSize: '12px',
  },
  labelStyle:   { color: '#a0a0b8' },
  itemStyle:    { color: '#e8e9f0' },
};

const GRID = <CartesianGrid strokeDasharray="3 3" stroke="#1e1f2c" />;

const X_TICK = { fill: '#6b7280', fontSize: 11 };
const Y_TICK = { fill: '#6b7280', fontSize: 11 };

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#12131a] border border-[#2a2b38] rounded-lg p-4">
      <h3 className="text-[10px] font-semibold text-[#6b7280] uppercase tracking-widest mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ChartsView({ repStats }: { repStats: RepStats[] }) {
  if (repStats.length === 0) return null;

  const byRevenue   = [...repStats].sort((a, b) => b.total_revenue_generated - a.total_revenue_generated);
  const byCloseRate = [...repStats].sort((a, b) => b.close_rate - a.close_rate);

  // Donut — aggregate cash composition
  const totalRecurring = repStats.reduce((s, r) => s + r.recurring_cash_collected, 0);
  const totalUpsell    = repStats.reduce((s, r) => s + r.upsell_cash_collected, 0);
  const totalFollowup  = repStats.reduce((s, r) => s + r.followup_cash_collected, 0);
  const totalNew       = repStats.reduce((s, r) => s + r.new_cash_collected, 0);
  const totalBase      = Math.max(0, totalNew - totalRecurring - totalUpsell - totalFollowup);

  const donutData = [
    { name: 'Base',      value: totalBase,      color: C.blue   },
    { name: 'Recurring', value: totalRecurring,  color: C.green  },
    { name: 'Upsell',    value: totalUpsell,     color: C.purple },
    { name: 'Follow-Up', value: totalFollowup,   color: C.orange },
  ].filter(d => d.value > 0);

  // Reference lines — mean rates
  const meanShow  = repStats.reduce((s, r) => s + r.show_rate, 0) / repStats.length;
  const meanClose = repStats.reduce((s, r) => s + r.close_rate, 0) / repStats.length;

  // Scatter data
  const scatterData = repStats.map(r => ({
    rep_name: r.rep_name,
    x: r.show_rate,
    y: r.close_rate,
    z: Math.max(r.closes * 15 + 60, 60),
  }));

  const AXIS_MARGIN = { bottom: 55, left: 8, right: 8, top: 4 };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4">

      {/* (a) Contract Value by Rep */}
      <ChartCard title="Contract Value by Rep">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={byRevenue.map(r => ({ name: shortName(r.rep_name), value: r.total_revenue_generated }))}
              margin={AXIS_MARGIN}
            >
              {GRID}
              <XAxis dataKey="name" tick={X_TICK} angle={-40} textAnchor="end" interval={0} />
              <YAxis tick={Y_TICK} tickFormatter={v => formatCurrency(v)} width={72} />
              <Tooltip {...TOOLTIP} formatter={(v: number) => [formatCurrency(v), 'Contract Value']} />
              <Bar dataKey="value" fill={C.blue} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* (b) Cash Breakdown Stacked Bar */}
      <ChartCard title="Cash Collected Breakdown by Rep">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={byRevenue.map(r => ({
                name:      shortName(r.rep_name),
                base:      Math.max(0, r.new_cash_collected - r.recurring_cash_collected - r.upsell_cash_collected - r.followup_cash_collected),
                recurring: r.recurring_cash_collected,
                upsell:    r.upsell_cash_collected,
                followup:  r.followup_cash_collected,
              }))}
              margin={AXIS_MARGIN}
            >
              {GRID}
              <XAxis dataKey="name" tick={X_TICK} angle={-40} textAnchor="end" interval={0} />
              <YAxis tick={Y_TICK} tickFormatter={v => formatCurrency(v)} width={72} />
              <Tooltip
                {...TOOLTIP}
                formatter={(v: number, name: string) => [formatCurrency(v), name.charAt(0).toUpperCase() + name.slice(1)]}
              />
              <Legend wrapperStyle={{ color: '#6b7280', fontSize: '11px', paddingTop: '6px' }} />
              <Bar dataKey="base"      stackId="cash" fill={C.blue}   name="Base"      />
              <Bar dataKey="recurring" stackId="cash" fill={C.green}  name="Recurring" />
              <Bar dataKey="upsell"    stackId="cash" fill={C.purple} name="Upsell"    />
              <Bar dataKey="followup"  stackId="cash" fill={C.orange} name="Follow-Up" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* (c) Cash Composition Donut */}
      <ChartCard title="Cash Composition">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius="52%"
                outerRadius="72%"
                dataKey="value"
                paddingAngle={2}
              >
                {donutData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                {...TOOLTIP}
                formatter={(v: number, name: string) => [formatCurrency(v), name]}
              />
              <Legend wrapperStyle={{ color: '#6b7280', fontSize: '11px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* (d) Close Rate by Rep */}
      <ChartCard title="Close Rate by Rep">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={byCloseRate.map(r => ({ name: shortName(r.rep_name), value: r.close_rate }))}
              margin={AXIS_MARGIN}
            >
              {GRID}
              <XAxis dataKey="name" tick={X_TICK} angle={-40} textAnchor="end" interval={0} />
              <YAxis tick={Y_TICK} tickFormatter={v => `${(v * 100).toFixed(0)}%`} width={40} />
              <Tooltip {...TOOLTIP} formatter={(v: number) => [formatPercent(v), 'Close Rate']} />
              <ReferenceLine y={meanClose} stroke="#3b82f6" strokeDasharray="4 4" label={{ value: 'Avg', fill: '#3b82f6', fontSize: 10, position: 'right' }} />
              <Bar dataKey="value" fill={C.green} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* (e) Pipeline Funnel — Grouped Bars */}
      <ChartCard title="Pipeline Funnel by Rep">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={byRevenue.map(r => ({
                name:   shortName(r.rep_name),
                Booked: r.calls_booked_on_calendar,
                Shown:  r.calls_shown_up,
                Offers: r.offers_made,
                Closes: r.closes,
              }))}
              margin={AXIS_MARGIN}
            >
              {GRID}
              <XAxis dataKey="name" tick={X_TICK} angle={-40} textAnchor="end" interval={0} />
              <YAxis tick={Y_TICK} width={35} />
              <Tooltip {...TOOLTIP} />
              <Legend wrapperStyle={{ color: '#6b7280', fontSize: '11px', paddingTop: '6px' }} />
              <Bar dataKey="Booked" fill="#60a5fa" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Shown"  fill="#34d399" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Offers" fill="#c084fc" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Closes" fill="#fb923c" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* (f) Show Rate vs Close Rate — Scatter */}
      <ChartCard title="Show Rate vs Close Rate">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 30, bottom: 30, left: 10 }}>
              {GRID}
              <XAxis
                dataKey="x"
                type="number"
                name="Show Rate"
                tick={X_TICK}
                tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                label={{ value: 'Show Rate', position: 'insideBottom', offset: -15, fill: '#6b7280', fontSize: 11 }}
              />
              <YAxis
                dataKey="y"
                type="number"
                name="Close Rate"
                tick={Y_TICK}
                tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                label={{ value: 'Close Rate', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
                width={42}
              />
              <ZAxis dataKey="z" range={[60, 400]} />
              <Tooltip
                {...TOOLTIP}
                cursor={{ strokeDasharray: '3 3', stroke: '#2a2b38' }}
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-[#12131a] border border-[#2a2b38] rounded-lg p-2.5 text-xs shadow-xl">
                      <div className="font-semibold text-[#e8e9f0] mb-1">{d.rep_name}</div>
                      <div className="text-[#6b7280]">Show:  {formatPercent(d.x)}</div>
                      <div className="text-[#6b7280]">Close: {formatPercent(d.y)}</div>
                    </div>
                  );
                }}
              />
              <ReferenceLine x={meanShow}  stroke="#3b82f6" strokeDasharray="4 4" />
              <ReferenceLine y={meanClose} stroke="#3b82f6" strokeDasharray="4 4" />
              <Scatter data={scatterData} fill={C.blue} fillOpacity={0.8} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

    </div>
  );
}
