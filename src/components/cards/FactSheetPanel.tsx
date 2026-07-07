"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
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
  const refreshStats = useRefreshStats(card.id);
  const [error, setError] = useState<string | null>(null);

  if (!LIVE_STATS_CATEGORIES.has(card.category)) return null;

  async function handleRefresh() {
    setError(null);
    try {
      await refreshStats.mutateAsync(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh stats");
    }
  }

  return (
    <Section
      icon={Activity}
      title="Live Stats"
      help="Pulls season stats from balldontlie (NBA) or API-Football (soccer). Cached for an hour between refreshes since the free API tiers have tight daily limits."
    >
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
            {card.liveStats.season} season · {card.liveStats.team ?? "—"}
            {card.liveStatsFetchedAt && (
              <> · updated {formatDistanceToNow(new Date(card.liveStatsFetchedAt), { addSuffix: true })}</>
            )}
          </p>
        </>
      ) : (
        <p className="text-xs text-foreground/50">No live stats fetched yet.</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={handleRefresh}
        disabled={refreshStats.isPending}
        className="flex items-center gap-1.5 rounded-md border border-border-1 px-2 py-1 text-xs hover:bg-surface-1 disabled:opacity-50"
      >
        <RefreshCw className={`h-3 w-3 ${refreshStats.isPending ? "animate-spin" : ""}`} />
        {refreshStats.isPending ? "Refreshing…" : "Refresh Stats"}
      </button>
    </Section>
  );
}

export function FactSheetPanel({ card, category }: { card: CardDetailDTO; category: CategoryDTO }) {
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
  const reasons = explainPrice(card);

  return (
    <aside className="motif-surface space-y-3 rounded-lg border border-border-1 p-4">
      <h2 className="font-display text-sm font-semibold text-foreground/70">Fact Sheet — {category.displayName}</h2>

      <LiveStatsSection card={card} />

      <Section icon={Sparkles} title="Why is this priced high?">
        <ul className="list-disc space-y-1 pl-4 text-sm">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Section>

      <Section icon={LineChartIcon} title="Price History">
        <PriceSparkline comps={card.priceComps} />
      </Section>

      <Section
        icon={Receipt}
        title="Comps"
        help="Manually logged comparable sale prices from eBay, 130point, PWCC, or wherever you found them — there's no live pricing API wired up, so add these yourself."
      >
        {latestCompAt && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Last added {formatDistanceToNow(new Date(latestCompAt), { addSuffix: true })} — may be stale
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
                remove
              </button>
            </li>
          ))}
          {card.priceComps.length === 0 && <li className="text-foreground/50">None yet.</li>}
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
            placeholder="Price ฿"
            value={compPrice}
            onChange={(e) => setCompPrice(e.target.value)}
            className="w-24 rounded-md border border-border-1 px-2 py-1"
          />
          <input
            type="url"
            placeholder="URL (optional)"
            value={compUrl}
            onChange={(e) => setCompUrl(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-border-1 px-2 py-1"
          />
          <button type="submit" className="rounded-md bg-accent px-2.5 py-1 font-medium text-white hover:bg-accent-dark">
            Add comp
          </button>
        </form>
      </Section>

      <Section
        icon={Scale}
        title="Negotiation Floor"
        help="Cost basis plus your minimum margin % (set in Settings) — a haggling floor so you don't accidentally sell under cost."
      >
        {floor !== null ? (
          <p className="text-sm">
            Don&apos;t go below <span className="font-semibold">฿{floor.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            <UsdHint amountThb={floor} /> (cost ฿{card.costBasis.toLocaleString()} + {settings?.minMarginPct}% min margin)
          </p>
        ) : (
          <p className="text-sm text-foreground/50">Loading…</p>
        )}
      </Section>

      <Section icon={Flame} title="Hot Card Flag">
        <label className="mb-1 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={card.isHot}
            onChange={(e) => updateCard.mutate({ id: card.id, input: { isHot: e.target.checked } })}
          />
          Flag as hot (reprice before quoting)
        </label>
        <div className="flex gap-1.5">
          <input
            value={hotNote}
            onChange={(e) => setHotNote(e.target.value)}
            placeholder="Why is it hot? (e.g. recent big game, news)"
            className="min-w-0 flex-1 rounded-md border border-border-1 px-2 py-1 text-sm"
          />
          <button
            onClick={() => updateCard.mutate({ id: card.id, input: { hotNote } })}
            className="rounded-md border border-border-1 px-2 py-1 text-sm hover:bg-surface-1"
          >
            Save
          </button>
        </div>
      </Section>

      <Section icon={BookOpen} title="Set / Card Background">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="What makes this set/insert/expansion notable, reprints, errors, tournament relevance…"
          className="w-full rounded-md border border-border-1 px-2 py-1.5 text-sm"
        />
        <button
          onClick={() => updateCard.mutate({ id: card.id, input: { researchNotes: notes } })}
          className="mt-1 rounded-md border border-border-1 px-2 py-1 text-sm hover:bg-surface-1"
        >
          Save notes
        </button>
      </Section>
    </aside>
  );
}
