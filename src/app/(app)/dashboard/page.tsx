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
import { Wallet, ShoppingBag, Archive, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDashboard } from "@/lib/data/dashboard";
import { useUiStore } from "@/store/uiStore";
import { chartColors } from "@/lib/chartColors";
import { UsdHint } from "@/components/UsdHint";
import { StatTileSkeleton, ChartSkeleton } from "@/components/ui/Skeleton";

function StatTile({
  label,
  value,
  usdAmount,
  icon: Icon,
  emphasize,
}: {
  label: string;
  value: string;
  usdAmount?: number;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${emphasize ? "border-accent bg-[color-mix(in_srgb,var(--accent)_8%,var(--background))]" : "border-border-1"}`}
    >
      <div className="mb-1 flex items-center gap-1.5 text-xs text-foreground/50">
        <Icon className="h-3.5 w-3.5" style={{ color: emphasize ? "var(--accent)" : undefined }} />
        {label}
      </div>
      <p className="font-display text-2xl font-semibold">
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
  const t = useTranslations("dashboard");
  const { data, isLoading } = useDashboard();
  const isDark = useUiStore((s) => s.isDark);
  const colors = chartColors(isDark);

  if (isLoading || !data) {
    return (
      <div className="max-w-5xl space-y-6">
        <h1 className="font-display text-xl font-semibold">{t("title")}</h1>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <StatTileSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <ChartSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const soldRatio = data.inStockCount + data.soldCount > 0 ? (data.soldCount / (data.inStockCount + data.soldCount)) * 100 : 0;

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="font-display text-xl font-semibold">{t("title")}</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label={t("todayRevenue")}
          value={`฿${data.todayRevenue.toLocaleString()}`}
          usdAmount={data.todayRevenue}
          icon={Wallet}
          emphasize
        />
        <StatTile label={t("itemsSoldToday")} value={data.todayItemsSold.toLocaleString()} icon={ShoppingBag} emphasize />
        <StatTile
          label={t("inStockValue")}
          value={`฿${data.totalInventoryValue.toLocaleString()}`}
          usdAmount={data.totalInventoryValue}
          icon={Archive}
        />
        <StatTile
          label={t("totalSold")}
          value={`${data.soldCount.toLocaleString()} (${soldRatio.toFixed(0)}%)`}
          icon={CheckCircle2}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title={t("revenueByCategory")}>
          <BarChart data={data.categoryBreakdown} margin={{ left: 4, right: 12 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="category" tick={{ fill: colors.text, fontSize: 12 }} axisLine={{ stroke: colors.grid }} tickLine={false} />
            <YAxis tick={{ fill: colors.text, fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip formatter={(v) => [`฿${Number(v).toLocaleString()}`, t("tooltipRevenue")]} />
            <Bar dataKey="revenue" fill={colors.blue} radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ChartCard>

        <ChartCard title={t("profitByCategory")}>
          <BarChart data={data.categoryBreakdown} margin={{ left: 4, right: 12 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="category" tick={{ fill: colors.text, fontSize: 12 }} axisLine={{ stroke: colors.grid }} tickLine={false} />
            <YAxis tick={{ fill: colors.text, fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip formatter={(v) => [`฿${Number(v).toLocaleString()}`, t("tooltipProfit")]} />
            <Bar dataKey="profit" fill={colors.aqua} radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ChartCard>

        <ChartCard title={t("topSelling")}>
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
            <Tooltip formatter={(v) => [`฿${Number(v).toLocaleString()}`, t("tooltipRevenue")]} />
            <Bar dataKey="revenue" fill={colors.blue} radius={[0, 4, 4, 0]} maxBarSize={16} />
          </BarChart>
        </ChartCard>

        <ChartCard title={t("cardTypePerformance")}>
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
            <Tooltip formatter={(v) => [`฿${Number(v).toLocaleString()}`, t("tooltipProfit")]} />
            <Bar dataKey="profit" radius={[0, 4, 4, 0]} maxBarSize={16}>
              {data.cardTypePerformance.map((entry) => (
                <Cell key={entry.cardType} fill={entry.profit >= 0 ? colors.blue : colors.red} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>
      </div>

      <ChartCard title={t("cumulativeProfit")}>
        <LineChart data={data.profitOverTime} margin={{ left: 4, right: 12 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: colors.text, fontSize: 12 }} axisLine={{ stroke: colors.grid }} tickLine={false} />
          <YAxis tick={{ fill: colors.text, fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
          <Tooltip formatter={(v) => [`฿${Number(v).toLocaleString()}`, t("tooltipCumulativeProfit")]} />
          <Line type="monotone" dataKey="cumulativeProfit" stroke={colors.blue} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ChartCard>
    </div>
  );
}
