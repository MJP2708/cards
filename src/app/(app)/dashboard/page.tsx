"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Wallet, ShoppingBag, Archive, CheckCircle2, TrendingUp, TrendingDown, Minus, Clock, Flame, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDashboard } from "@/lib/data/dashboard";
import { useCategories } from "@/hooks/useCategories";
import { useUiStore } from "@/store/uiStore";
import { chartColors } from "@/lib/chartColors";
import { Price } from "@/components/ui/Price";
import { UsdHint } from "@/components/UsdHint";
import { StatTileSkeleton, ChartSkeleton, Skeleton } from "@/components/ui/Skeleton";

function trendOf(today: number, yesterday: number) {
  if (yesterday === 0) return today === 0 ? null : { pct: null, up: true };
  return { pct: ((today - yesterday) / yesterday) * 100, up: today >= yesterday };
}

function TrendBadge({ today, yesterday }: { today: number; yesterday: number }) {
  const t = useTranslations("dashboard");
  const trend = trendOf(today, yesterday);
  if (!trend) return null;

  const Icon = trend.pct === null ? Minus : trend.up ? TrendingUp : TrendingDown;
  const color = trend.pct === null ? "text-foreground/40" : trend.up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {trend.pct === null ? t("trendNew") : t("trendVsYesterday", { pct: `${trend.pct >= 0 ? "+" : ""}${trend.pct.toFixed(0)}%` })}
    </span>
  );
}

function StatTile({
  label,
  value,
  usdAmount,
  icon: Icon,
  emphasize,
  trend,
}: {
  label: string;
  value: string;
  usdAmount?: number;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  emphasize?: boolean;
  trend?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${emphasize ? "border-accent bg-[var(--accent-tint-weak)]" : "border-border-1"}`}
    >
      <div className="mb-1 flex items-center gap-1.5 text-xs text-foreground/50">
        <Icon className="h-3.5 w-3.5" style={{ color: emphasize ? "var(--accent)" : undefined }} />
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <p className="font-display text-2xl font-semibold tabular-nums">
          {value}
          {usdAmount !== undefined && <UsdHint amountThb={usdAmount} className="text-sm font-normal" />}
        </p>
        {trend}
      </div>
    </div>
  );
}

function ChartCard({ title, children, hero }: { title: string; children: React.ReactNode; hero?: boolean }) {
  return (
    <div className={`rounded-lg border border-border-1 p-4 ${hero ? "bg-[var(--accent-tint-weak)]" : ""}`}>
      <h2 className="mb-3 text-sm font-semibold text-foreground/70">{title}</h2>
      <div className={hero ? "h-80 w-full" : "h-64 w-full"}>
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
  const { data: categories } = useCategories();
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
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <ChartSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const soldRatio = data.inStockCount + data.soldCount > 0 ? (data.soldCount / (data.inStockCount + data.soldCount)) * 100 : 0;
  const priorities = [...data.hotNeedsAttention, ...data.agingInventory.slice(0, 3)];

  function categoryHref(category: string, id: string) {
    return `/${category.toLowerCase()}/card/${id}`;
  }
  function categoryLabel(key: string) {
    return categories?.find((c) => c.key.toLowerCase() === key.toLowerCase())?.displayName ?? key;
  }

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
          trend={<TrendBadge today={data.todayRevenue} yesterday={data.yesterdayRevenue} />}
        />
        <StatTile
          label={t("itemsSoldToday")}
          value={data.todayItemsSold.toLocaleString()}
          icon={ShoppingBag}
          emphasize
          trend={<TrendBadge today={data.todayItemsSold} yesterday={data.yesterdayItemsSold} />}
        />
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

      {/* Today's Priorities — the one thing the old dashboard never answered:
          what should I actually do right now. Built from data already on the
          card (age in stock, hot flag + comp staleness), not a new field. */}
      {priorities.length > 0 && (
        <div className="rounded-lg border border-border-1 p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground/70">
            <Flame className="h-4 w-4" style={{ color: "var(--accent)" }} />
            {t("todaysPriorities")}
          </h2>
          <ul className="divide-y divide-border-1">
            {data.hotNeedsAttention.map((c) => (
              <li key={c.id}>
                <Link href={categoryHref(c.category, c.id)} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-accent">
                  <span className="flex min-w-0 items-center gap-2">
                    <Flame className="h-3.5 w-3.5 shrink-0 text-red-500" />
                    <span className="truncate">{c.name}</span>
                    <span className="shrink-0 text-xs text-foreground/40">{categoryLabel(c.category)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-foreground/50">{t("priorityStaleComps")}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-foreground/30" />
                  </span>
                </Link>
              </li>
            ))}
            {data.agingInventory.slice(0, 3).map((c) => (
              <li key={c.id}>
                <Link href={categoryHref(c.category, c.id)} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-accent">
                  <span className="flex min-w-0 items-center gap-2">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span className="truncate">{c.name}</span>
                    <span className="shrink-0 text-xs text-foreground/40">{categoryLabel(c.category)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Price amountThb={c.askingPrice} size="sm" />
                    <span className="text-xs text-foreground/50">{t("priorityDaysInStock", { days: c.daysInStock })}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-foreground/30" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Hero chart — cumulative profit is the real health signal for the
          event; it used to sit last, same size as four other charts. */}
      <ChartCard title={t("cumulativeProfit")} hero>
        <LineChart data={data.profitOverTime} margin={{ left: 4, right: 12 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: colors.text, fontSize: 12 }} axisLine={{ stroke: colors.grid }} tickLine={false} />
          <YAxis tick={{ fill: colors.text, fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
          <Tooltip formatter={(v) => [`฿${Number(v).toLocaleString()}`, t("tooltipCumulativeProfit")]} />
          <Line type="monotone" dataKey="cumulativeProfit" stroke={colors.blue} strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ChartCard>

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
            <Tooltip formatter={(v, _n, item) => [`${item.payload.profit >= 0 ? "+" : ""}฿${Number(v).toLocaleString()}`, t("tooltipProfit")]} />
            <Bar dataKey="profit" radius={[0, 4, 4, 0]} maxBarSize={16}>
              {data.cardTypePerformance.map((entry) => (
                <Cell key={entry.cardType} fill={entry.profit >= 0 ? colors.blue : colors.red} />
              ))}
              {/* Sign is never color-only — a losing card type reads "-฿X" even
                  for a colorblind viewer or in a quick black-and-white glance. */}
              <LabelList
                dataKey="profit"
                position="right"
                fontSize={10}
                fill={colors.text}
                formatter={(v: React.ReactNode) => {
                  const n = Number(v);
                  return Number.isFinite(n) ? `${n >= 0 ? "+" : ""}฿${n.toLocaleString()}` : "";
                }}
              />
            </Bar>
          </BarChart>
        </ChartCard>
      </div>
    </div>
  );
}
