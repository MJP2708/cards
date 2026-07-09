"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  LineChart as LineChartIcon,
  Receipt,
  Flame,
  BookOpen,
  RefreshCw,
  Star,
  Users,
  Sparkles,
  Layers,
  ShieldCheck,
  HelpCircle,
  ChevronDown,
  Scale,
  Plus,
} from "lucide-react";
import type { CardDetailDTO } from "@/lib/data/types";
import type { CategoryDTO } from "@/lib/categories";
import { useUpdateCard } from "@/lib/data/cards";
import { useCreateComp, useDeleteComp } from "@/lib/data/comps";
import { useSettings } from "@/lib/data/settings";
import { useRefreshStats } from "@/lib/data/liveStats";
import { COMP_SOURCES } from "@/lib/validation/priceComp";
import { explainPrice, type PriceReasonIcon } from "@/lib/priceExplainer";
import { PriceSparkline } from "@/components/cards/PriceSparkline";
import { Price } from "@/components/ui/Price";
import { UsdHint } from "@/components/UsdHint";
import { HelpTooltip } from "@/components/ui/Tooltip";
import { useRelativeTime } from "@/lib/relativeTime";

const LIVE_STATS_CATEGORIES = new Set(["NBA", "Football"]);

const REASON_ICONS: Record<PriceReasonIcon, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  rookie: Star,
  veteran: Users,
  tcg: Sparkles,
  rarity: Layers,
  grading: ShieldCheck,
  hot: Flame,
  comps: Receipt,
  noComps: HelpCircle,
};

function Section({
  icon: Icon,
  title,
  help,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2 rounded-lg border border-border-1 p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--accent-dark)" }}>
        <Icon className="h-3.5 w-3.5" />
        {title}
        {help && <HelpTooltip text={help} />}
      </h3>
      {children}
    </section>
  );
}

function LiveStatsSection({ card }: { card: CardDetailDTO }) {
  const t = useTranslations("cardDetail");
  const relativeTime = useRelativeTime();
  const refreshStats = useRefreshStats(card.id);
  const [error, setError] = useState<string | null>(null);

  if (!LIVE_STATS_CATEGORIES.has(card.category)) return null;

  async function handleRefresh() {
    setError(null);
    try {
      await refreshStats.mutateAsync(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("refreshStatsFailed"));
    }
  }

  return (
    <Section icon={Activity} title={t("liveStats")} help={t("liveStatsHelp")}>
      {card.liveStats ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {card.liveStats.summary.map((s) => (
              <div key={s.label} className="rounded-md bg-surface-1 px-2 py-1.5 text-center">
                <p className="text-[0.65rem] uppercase text-foreground/50">{s.label}</p>
                <p className="text-sm font-semibold tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-foreground/50">
            {t("seasonAndTeam", { season: card.liveStats.season, team: card.liveStats.team ?? "—" })}
            {card.liveStatsFetchedAt && <> · {t("updatedAgo", { time: relativeTime(new Date(card.liveStatsFetchedAt)) })}</>}
          </p>
        </>
      ) : (
        <p className="text-xs text-foreground/50">{t("noLiveStats")}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={handleRefresh}
        disabled={refreshStats.isPending}
        className="flex items-center gap-1.5 rounded-md border border-border-1 px-2 py-1 text-xs hover:bg-surface-1 disabled:opacity-50"
      >
        <RefreshCw className={`h-3 w-3 ${refreshStats.isPending ? "animate-spin" : ""}`} />
        {refreshStats.isPending ? t("refreshing") : t("refreshStats")}
      </button>
    </Section>
  );
}

function CompsSection({ card }: { card: CardDetailDTO }) {
  const t = useTranslations("cardDetail");
  const relativeTime = useRelativeTime();
  const createComp = useCreateComp(card.id);
  const deleteComp = useDeleteComp(card.id);
  const [adding, setAdding] = useState(false);
  const [compSource, setCompSource] = useState<(typeof COMP_SOURCES)[number]>("Manual");
  const [compPrice, setCompPrice] = useState("");
  const [compUrl, setCompUrl] = useState("");

  const latestCompAt = card.priceComps[0]?.fetchedAt;

  return (
    <Section icon={Receipt} title={t("comps")} help={t("compsHelp")}>
      {latestCompAt && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{t("compsLastAdded", { time: relativeTime(new Date(latestCompAt)) })}</p>
      )}
      <ul className="space-y-1 text-sm">
        {card.priceComps.map((comp) => (
          <li key={comp.id} className="flex items-center justify-between gap-2">
            <span>
              {comp.source}: <Price amountThb={comp.price} size="sm" showUsd />
              {comp.url && (
                <a href={comp.url} target="_blank" rel="noreferrer" className="ml-1 text-accent hover:underline">
                  link
                </a>
              )}
            </span>
            <button onClick={() => deleteComp.mutate(comp.id)} className="tap-compact text-xs text-foreground/40 hover:text-red-600">
              {t("compRemove")}
            </button>
          </li>
        ))}
        {card.priceComps.length === 0 && <li className="text-foreground/50">{t("compsNone")}</li>}
      </ul>

      {!adding ? (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs text-accent hover:underline"
        >
          <Plus className="h-3 w-3" />
          {t("addComp")}
        </button>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!compPrice) return;
            await createComp.mutateAsync({ source: compSource, price: Number(compPrice), url: compUrl || undefined });
            setCompPrice("");
            setCompUrl("");
            setAdding(false);
          }}
          className="flex flex-wrap gap-1.5 text-xs"
        >
          <select
            value={compSource}
            onChange={(e) => setCompSource(e.target.value as (typeof COMP_SOURCES)[number])}
            className="tap-compact rounded-md border border-border-1 px-2 py-1"
          >
            {COMP_SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            autoFocus
            placeholder={t("compPricePlaceholder")}
            value={compPrice}
            onChange={(e) => setCompPrice(e.target.value)}
            className="tap-compact w-24 rounded-md border border-border-1 px-2 py-1"
          />
          <input
            type="url"
            placeholder={t("compUrlPlaceholder")}
            value={compUrl}
            onChange={(e) => setCompUrl(e.target.value)}
            className="tap-compact min-w-0 flex-1 rounded-md border border-border-1 px-2 py-1"
          />
          <button type="submit" className="tap-compact rounded-md bg-accent px-2.5 py-1 font-medium text-white hover:bg-accent-dark">
            {t("addComp")}
          </button>
        </form>
      )}
    </Section>
  );
}

export function FactSheetPanel({ card, category }: { card: CardDetailDTO; category: CategoryDTO }) {
  const t = useTranslations("cardDetail");
  const common = useTranslations("common");
  const updateCard = useUpdateCard();
  const { data: settings } = useSettings();

  const [notes, setNotes] = useState(card.researchNotes ?? "");
  const [hotNote, setHotNote] = useState(card.hotNote ?? "");
  const [moreOpen, setMoreOpen] = useState(false);

  const floor = settings ? card.costBasis * (1 + settings.minMarginPct / 100) : null;
  const reasons = explainPrice(card, t);

  return (
    <aside className="motif-surface space-y-3 rounded-lg border border-border-1 p-4">
      <h2 className="font-display text-sm font-semibold text-foreground/70">
        {t("factSheetTitle", { category: category.displayName })}
      </h2>

      {/* Pricing hero — the negotiation floor is the one number that matters
          with a buyer standing there, so it leads the panel instead of sitting
          5th in a stack of equal-weight boxes. Everything below is reference
          material consulted between customers, not during. */}
      <div className="space-y-3 rounded-lg p-3" style={{ background: "var(--accent-tint-strong)" }}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground/60">{t("askingPriceLabel")}</span>
          <Price amountThb={card.askingPrice} size="lg" showUsd />
        </div>

        <div className="flex items-start gap-2 rounded-md bg-background/70 p-2.5">
          <Scale className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--accent-dark)" }} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--accent-dark)" }}>
              {t("negotiationFloor")}
              <HelpTooltip text={t("negotiationFloorHelp")} />
            </p>
            {floor !== null ? (
              <p className="text-sm">
                {t("negotiationFloorText", {
                  floor: `฿${floor.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                  cost: card.costBasis.toLocaleString(),
                  margin: settings?.minMarginPct ?? 0,
                })}
                <UsdHint amountThb={floor} />
              </p>
            ) : (
              <p className="text-sm text-foreground/50">{common("loading")}</p>
            )}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/60">{t("whyPricedHigh")}</p>
          <ul className="space-y-1.5">
            {reasons.map((r) => {
              const Icon = REASON_ICONS[r.icon];
              return (
                <li key={r.text} className="flex items-start gap-2 text-sm">
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent-dark)" }} />
                  <span>{r.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <LiveStatsSection card={card} />

      <Section icon={LineChartIcon} title={t("priceHistory")}>
        <PriceSparkline comps={card.priceComps} />
      </Section>

      <CompsSection card={card} />

      <button
        onClick={() => setMoreOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-border-1 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground/60 hover:bg-surface-1"
        aria-expanded={moreOpen}
      >
        {t("moreDetails")}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
      </button>

      {moreOpen && (
        <div className="space-y-3">
          <Section icon={Flame} title={t("hotCardFlag")}>
            <label className="mb-1 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={card.isHot}
                onChange={(e) => updateCard.mutate({ id: card.id, input: { isHot: e.target.checked } })}
              />
              {t("hotCardCheckbox")}
            </label>
            <div className="flex gap-1.5">
              <input
                value={hotNote}
                onChange={(e) => setHotNote(e.target.value)}
                placeholder={t("hotNotePlaceholder")}
                className="tap-compact min-w-0 flex-1 rounded-md border border-border-1 px-2 py-1 text-sm"
              />
              <button
                onClick={() => updateCard.mutate({ id: card.id, input: { hotNote } })}
                className="tap-compact rounded-md border border-border-1 px-2 py-1 text-sm hover:bg-surface-1"
              >
                {common("save")}
              </button>
            </div>
          </Section>

          <Section icon={BookOpen} title={t("setBackground")}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t("setBackgroundPlaceholder")}
              className="w-full rounded-md border border-border-1 px-2 py-1.5 text-sm"
            />
            <button
              onClick={() => updateCard.mutate({ id: card.id, input: { researchNotes: notes } })}
              className="tap-compact mt-1 rounded-md border border-border-1 px-2 py-1 text-sm hover:bg-surface-1"
            >
              {t("saveNotes")}
            </button>
          </Section>
        </div>
      )}
    </aside>
  );
}
