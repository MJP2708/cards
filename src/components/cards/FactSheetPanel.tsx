"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import type { CardDetailDTO } from "@/lib/data/types";
import type { CategoryDTO } from "@/lib/categories";
import { useUpdateCard } from "@/lib/data/cards";
import { useCreateComp, useDeleteComp } from "@/lib/data/comps";
import { useSettings } from "@/lib/data/settings";
import { COMP_SOURCES } from "@/lib/validation/priceComp";
import { explainPrice } from "@/lib/priceExplainer";
import { PriceSparkline } from "@/components/cards/PriceSparkline";
import { UsdHint } from "@/components/UsdHint";

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
    <aside className="motif-surface space-y-5 rounded-lg border border-border-1 p-4">
      <div>
        <h2 className="mb-1 text-sm font-semibold text-foreground/70">Fact Sheet — {category.displayName}</h2>
        {latestCompAt ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Comps last updated {formatDistanceToNow(new Date(latestCompAt), { addSuffix: true })} — may be stale
          </p>
        ) : (
          <p className="text-xs text-foreground/50">No comps logged yet.</p>
        )}
      </div>

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase text-foreground/50">Why is this priced high?</h3>
        <ul className="list-disc space-y-1 pl-4 text-sm">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase text-foreground/50">Price History</h3>
        <PriceSparkline comps={card.priceComps} />
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase text-foreground/50">Comps</h3>
        <ul className="mb-2 space-y-1 text-sm">
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
      </section>

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase text-foreground/50">Negotiation Floor</h3>
        {floor !== null ? (
          <p className="text-sm">
            Don&apos;t go below <span className="font-semibold">฿{floor.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            <UsdHint amountThb={floor} /> (cost ฿{card.costBasis.toLocaleString()} + {settings?.minMarginPct}% min margin)
          </p>
        ) : (
          <p className="text-sm text-foreground/50">Loading…</p>
        )}
      </section>

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase text-foreground/50">Hot Card Flag</h3>
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
      </section>

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase text-foreground/50">Set / Card Background</h3>
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
      </section>
    </aside>
  );
}
