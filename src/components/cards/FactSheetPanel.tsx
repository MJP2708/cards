"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  Sparkles,
  LineChart as LineChartIcon,
  Receipt,
  Scale,
  Flame,
  BookOpen,
  RefreshCw,
} from "lucide-react";
import type { CardDetailDTO } from "@/lib/data/types";
import type { CategoryDTO } from "@/lib/categories";
import { useUpdateCard } from "@/lib/data/cards";
import { useCreateComp, useDeleteComp } from "@/lib/data/comps";
import { useSettings } from "@/lib/data/settings";
import { useRefreshStats } from "@/lib/data/liveStats";
import { COMP_SOURCES } from "@/lib/validation/priceComp";
import { explainPrice } from "@/lib/priceExplainer";
import { PriceSparkline } from "@/components/cards/PriceSparkline";
import { UsdHint } from "@/components/UsdHint";
import { HelpTooltip } from "@/components/ui/Tooltip";
import { useRelativeTime } from "@/lib/relativeTime";

const LIVE_STATS_CATEGORIES = new Set(["NBA", "Football"]);

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
                <p className="text-sm font-semibold">{s.value}</p>
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

export function FactSheetPanel({ card, category }: { card: CardDetailDTO; category: CategoryDTO }) {
  const t = useTranslations("cardDetail");
  const common = useTranslations("common");
  const relativeTime = useRelativeTime();
  const updateCard = useUpdateCard();
  const createComp = useCreateComp(card.id);
  const deleteComp = useDeleteComp(card.id);
  const { data: settings } = useSettings();

  const [notes, setNotes] = useState(card.researchNotes ?? "");
  const [hotNote, setHotNote] = useState(card.hotNote ?? "");
  const [compSource, setCompSource] = useState<(typeof COMP_SOURCES)[number]>("Manual");
  const [compPrice, setCompPrice] = useState("");
  const [compUrl, setCompUrl] = useState("");

  const latestCompAt = card.priceComps[0]?.fetchedAt;
  const floor = settings ? card.costBasis * (1 + settings.minMarginPct / 100) : null;
  const reasons = explainPrice(card, t);

  return (
    <aside className="motif-surface space-y-3 rounded-lg border border-border-1 p-4">
      <h2 className="font-display text-sm font-semibold text-foreground/70">
        {t("factSheetTitle", { category: category.displayName })}
      </h2>

      <LiveStatsSection card={card} />

      <Section icon={Sparkles} title={t("whyPricedHigh")}>
        <ul className="list-disc space-y-1 pl-4 text-sm">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Section>

      <Section icon={LineChartIcon} title={t("priceHistory")}>
        <PriceSparkline comps={card.priceComps} />
      </Section>

      <Section icon={Receipt} title={t("comps")} help={t("compsHelp")}>
        {latestCompAt && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t("compsLastAdded", { time: relativeTime(new Date(latestCompAt)) })}
          </p>
        )}
        <ul className="space-y-1 text-sm">
          {card.priceComps.map((comp) => (
            <li key={comp.id} className="flex items-center justify-between gap-2">
              <span>
                {comp.source}: ฿{comp.price.toLocaleString()}
                <UsdHint amountThb={comp.price} />
                {comp.url && (
                  <a href={comp.url} target="_blank" rel="noreferrer" className="ml-1 text-accent hover:underline">
                    link
                  </a>
                )}
              </span>
              <button onClick={() => deleteComp.mutate(comp.id)} className="text-xs text-foreground/40 hover:text-red-600">
                {t("compRemove")}
              </button>
            </li>
          ))}
          {card.priceComps.length === 0 && <li className="text-foreground/50">{t("compsNone")}</li>}
        </ul>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!compPrice) return;
            await createComp.mutateAsync({ source: compSource, price: Number(compPrice), url: compUrl || undefined });
            setCompPrice("");
            setCompUrl("");
          }}
          className="flex flex-wrap gap-1.5 text-xs"
        >
          <select
            value={compSource}
            onChange={(e) => setCompSource(e.target.value as (typeof COMP_SOURCES)[number])}
            className="rounded-md border border-border-1 px-2 py-1"
          >
            {COMP_SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            placeholder={t("compPricePlaceholder")}
            value={compPrice}
            onChange={(e) => setCompPrice(e.target.value)}
            className="w-24 rounded-md border border-border-1 px-2 py-1"
          />
          <input
            type="url"
            placeholder={t("compUrlPlaceholder")}
            value={compUrl}
            onChange={(e) => setCompUrl(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-border-1 px-2 py-1"
          />
          <button type="submit" className="rounded-md bg-accent px-2.5 py-1 font-medium text-white hover:bg-accent-dark">
            {t("addComp")}
          </button>
        </form>
      </Section>

      <Section icon={Scale} title={t("negotiationFloor")} help={t("negotiationFloorHelp")}>
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
      </Section>

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
            className="min-w-0 flex-1 rounded-md border border-border-1 px-2 py-1 text-sm"
          />
          <button
            onClick={() => updateCard.mutate({ id: card.id, input: { hotNote } })}
            className="rounded-md border border-border-1 px-2 py-1 text-sm hover:bg-surface-1"
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
          className="mt-1 rounded-md border border-border-1 px-2 py-1 text-sm hover:bg-surface-1"
        >
          {t("saveNotes")}
        </button>
      </Section>
    </aside>
  );
}
