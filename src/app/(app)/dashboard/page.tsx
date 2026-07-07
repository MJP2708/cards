"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDashboard } from "@/lib/data/dashboard";
import { useUiStore } from "@/store/uiStore";
import { chartColors } from "@/lib/chartColors";
import { UsdHint } from "@/components/UsdHint";

function StatTile({ label, value, usdAmount }: { label: string; value: string; usdAmount?: number }) {
  return (
    <div className="rounded-lg border border-border-1 p-4">
      <p className="text-xs text-foreground/50">{label}</p>
      <p className="text-2xl font-semibold">
        {value}
        {usdAmount !== undefined && <UsdHint amountThb={usdAmount} className="text-sm" />}
      </p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border-1 p-4">
      <h2 className="mb-3 text-sm font-semibold text-foreground/70">{title}</h2>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();
  const isDark = useUiStore((s) => s.isDark);
  const colors = chartColors(isDark);

  if (isLoading || !data) return <p className="text-sm text-foreground/60">Loading…</p>;

  const soldRatio = data.inStockCount + data.soldCount > 0 ? (data.soldCount / (data.inStockCount + data.soldCount)) * 100 : 0;

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-3 gap-3">
        <StatTile
          label="In-Stock Inventory Value"
          value={`฿${data.totalInventoryValue.toLocaleString()}`}
          usdAmount={data.totalInventoryValue}
        />
        <StatTile label="Items In Stock" value={data.inStockCount.toLocaleString()} />
        <StatTile label="Items Sold" value={`${data.soldCount.toLocaleString()} (${soldRatio.toFixed(0)}%)`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Revenue by Category">
          <BarChart data={data.categoryBreakdown} margin={{ left: 4, right: 12 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="category" tick={{ fill: colors.text, fontSize: 12 }} axisLine={{ stroke: colors.grid }} tickLine={false} />
            <YAxis tick={{ fill: colors.text, fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip formatter={(v) => [`฿${Number(v).toLocaleString()}`, "Revenue"]} />
            <Bar dataKey="revenue" fill={colors.blue} radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Profit by Category">
          <BarChart data={data.categoryBreakdown} margin={{ left: 4, right: 12 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="category" tick={{ fill: colors.text, fontSize: 12 }} axisLine={{ stroke: colors.grid }} tickLine={false} />
            <YAxis tick={{ fill: colors.text, fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip formatter={(v) => [`฿${Number(v).toLocaleString()}`, "Profit"]} />
            <Bar dataKey="profit" fill={colors.aqua} radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Top Selling Cards">
          <BarChart data={data.topSelling} layout="vertical" margin={{ left: 12, right: 12 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fill: colors.text, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: colors.text, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={110}
            />
            <Tooltip formatter={(v) => [`฿${Number(v).toLocaleString()}`, "Revenue"]} />
            <Bar dataKey="revenue" fill={colors.blue} radius={[0, 4, 4, 0]} maxBarSize={16} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Card Type Performance (Profit)">
          <BarChart data={data.cardTypePerformance} layout="vertical" margin={{ left: 12, right: 12 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fill: colors.text, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="cardType"
              tick={{ fill: colors.text, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip formatter={(v) => [`฿${Number(v).toLocaleString()}`, "Profit"]} />
            <Bar dataKey="profit" radius={[0, 4, 4, 0]} maxBarSize={16}>
              {data.cardTypePerformance.map((entry) => (
                <Cell key={entry.cardType} fill={entry.profit >= 0 ? colors.blue : colors.red} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>
      </div>

      <ChartCard title="Cumulative Profit Over the Event">
        <LineChart data={data.profitOverTime} margin={{ left: 4, right: 12 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: colors.text, fontSize: 12 }} axisLine={{ stroke: colors.grid }} tickLine={false} />
          <YAxis tick={{ fill: colors.text, fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
          <Tooltip formatter={(v) => [`฿${Number(v).toLocaleString()}`, "Cumulative Profit"]} />
          <Line type="monotone" dataKey="cumulativeProfit" stroke={colors.blue} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ChartCard>
    </div>
  );
}
