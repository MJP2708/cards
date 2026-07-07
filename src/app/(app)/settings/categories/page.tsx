"use client";

import { useEffect, useState } from "react";
import { useCategories } from "@/hooks/useCategories";
import { useSettings, useUpdateSettings } from "@/lib/data/settings";
import type { FieldDef } from "@/lib/fieldSchema";

type DraftField = FieldDef & { optionsText: string };

function emptyField(): DraftField {
  return { key: "", label: "", kind: "attribute", type: "text", optionsText: "", required: false };
}

export default function SettingsPage() {
  const { data: categories } = useCategories();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  const [minMarginPct, setMinMarginPct] = useState("20");
  const [usdExchangeRate, setUsdExchangeRate] = useState("");
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setMinMarginPct(String(settings.minMarginPct));
      setUsdExchangeRate(settings.usdExchangeRate ? String(settings.usdExchangeRate) : "");
    }
  }, [settings]);

  const [key, setKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accent, setAccent] = useState("#64748B");
  const [secondary, setSecondary] = useState("#334155");
  const [motif, setMotif] = useState<"hardwood" | "pitch" | "holo" | "frame" | "none">("none");
  const [fields, setFields] = useState<DraftField[]>([emptyField()]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(false);
    const fieldSchema = fields
      .filter((f) => f.key && f.label)
      .map((f) => ({
        key: f.key,
        label: f.label,
        kind: f.kind,
        type: f.type,
        required: f.required,
        options: f.type === "select" ? f.optionsText.split(",").map((o) => o.trim()).filter(Boolean) : undefined,
      }));

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          displayName,
          fieldSchema,
          themeTokens: { accent, secondary, motif },
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(JSON.stringify(body.error ?? body));
      }
      setCreateSuccess(true);
      setKey("");
      setDisplayName("");
      setFields([emptyField()]);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create category");
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-xl font-semibold">Settings</h1>

      <section className="space-y-3 rounded-lg border border-border-1 p-4">
        <h2 className="text-sm font-semibold text-foreground/70">Currency &amp; Negotiation</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex flex-col gap-1">
            Minimum margin %
            <input
              type="number"
              value={minMarginPct}
              onChange={(e) => setMinMarginPct(e.target.value)}
              className="w-32 rounded-md border border-border-1 px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1">
            THB per 1 USD (for reference conversion)
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 36.5"
              value={usdExchangeRate}
              onChange={(e) => setUsdExchangeRate(e.target.value)}
              className="w-32 rounded-md border border-border-1 px-2 py-1.5"
            />
          </label>
        </div>
        <button
          onClick={async () => {
            await updateSettings.mutateAsync({
              minMarginPct: Number(minMarginPct),
              ...(usdExchangeRate ? { usdExchangeRate: Number(usdExchangeRate) } : {}),
            });
            setSettingsSaved(true);
          }}
          className="booth-target rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
        >
          Save
        </button>
        {settingsSaved && <p className="text-sm text-emerald-600">Saved.</p>}
      </section>

      <section className="space-y-3 rounded-lg border border-border-1 p-4">
        <h2 className="text-sm font-semibold text-foreground/70">Backup</h2>
        <p className="text-sm text-foreground/60">Download a full JSON export of all inventory, sales, and settings data.</p>
        <a
          href="/api/backup"
          className="booth-target inline-block rounded-md border border-border-1 px-4 py-2 text-sm hover:bg-surface-1"
        >
          Download Backup (JSON)
        </a>
      </section>

      <section className="space-y-3 rounded-lg border border-border-1 p-4">
        <h2 className="text-sm font-semibold text-foreground/70">Existing Categories</h2>
        <ul className="flex flex-wrap gap-2 text-sm">
          {categories?.map((c) => (
            <li key={c.key} className="flex items-center gap-2 rounded-full border border-border-1 px-3 py-1">
              <span className="h-2 w-2 rounded-full" style={{ background: c.themeTokens.accent }} />
              {c.displayName}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 rounded-lg border border-border-1 p-4">
        <h2 className="text-sm font-semibold text-foreground/70">Add a Custom Category</h2>
        <form onSubmit={handleCreateCategory} className="space-y-4">
          {createError && <p className="text-sm text-red-600">{createError}</p>}
          {createSuccess && <p className="text-sm text-emerald-600">Category created.</p>}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="flex flex-col gap-1">
              Key (unique, e.g. "YuGiOh")
              <input required value={key} onChange={(e) => setKey(e.target.value)} className="rounded-md border border-border-1 px-2 py-1.5" />
            </label>
            <label className="flex flex-col gap-1">
              Display name
              <input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="rounded-md border border-border-1 px-2 py-1.5" />
            </label>
            <label className="flex flex-col gap-1">
              Accent color
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 rounded-md border border-border-1" />
            </label>
            <label className="flex flex-col gap-1">
              Secondary color
              <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="h-9 rounded-md border border-border-1" />
            </label>
            <label className="flex flex-col gap-1">
              Motif
              <select value={motif} onChange={(e) => setMotif(e.target.value as typeof motif)} className="rounded-md border border-border-1 px-2 py-1.5">
                <option value="none">None</option>
                <option value="hardwood">Hardwood</option>
                <option value="pitch">Pitch</option>
                <option value="holo">Holo</option>
                <option value="frame">Frame</option>
              </select>
            </label>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase text-foreground/50">Extra Fields for this Category</h3>
            <div className="space-y-2">
              {fields.map((field, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs">
                  <input
                    placeholder="key"
                    value={field.key}
                    onChange={(e) => setFields((fs) => fs.map((f, idx) => (idx === i ? { ...f, key: e.target.value } : f)))}
                    className="w-24 rounded-md border border-border-1 px-2 py-1"
                  />
                  <input
                    placeholder="Label"
                    value={field.label}
                    onChange={(e) => setFields((fs) => fs.map((f, idx) => (idx === i ? { ...f, label: e.target.value } : f)))}
                    className="w-32 rounded-md border border-border-1 px-2 py-1"
                  />
                  <select
                    value={field.type}
                    onChange={(e) =>
                      setFields((fs) => fs.map((f, idx) => (idx === i ? { ...f, type: e.target.value as DraftField["type"] } : f)))
                    }
                    className="rounded-md border border-border-1 px-2 py-1"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="select">Select</option>
                    <option value="textarea">Textarea</option>
                  </select>
                  {field.type === "select" && (
                    <input
                      placeholder="option1, option2"
                      value={field.optionsText}
                      onChange={(e) => setFields((fs) => fs.map((f, idx) => (idx === i ? { ...f, optionsText: e.target.value } : f)))}
                      className="w-40 rounded-md border border-border-1 px-2 py-1"
                    />
                  )}
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => setFields((fs) => fs.map((f, idx) => (idx === i ? { ...f, required: e.target.checked } : f)))}
                    />
                    required
                  </label>
                  <button
                    type="button"
                    onClick={() => setFields((fs) => fs.filter((_, idx) => idx !== i))}
                    className="text-foreground/40 hover:text-red-600"
                  >
                    remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setFields((fs) => [...fs, emptyField()])}
                className="rounded-md border border-dashed border-border-1 px-2 py-1 text-xs hover:bg-surface-1"
              >
                + Add field
              </button>
            </div>
          </div>

          <button type="submit" className="booth-target rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark">
            Create Category
          </button>
        </form>
      </section>
    </div>
  );
}
