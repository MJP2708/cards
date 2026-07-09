"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useCategories } from "@/hooks/useCategories";
import { useSettings, useUpdateSettings } from "@/lib/data/settings";
import { useUiStore } from "@/store/uiStore";
import { useOnboardingStore } from "@/store/onboardingStore";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import { HEADER_FONTS, ICON_SETS, type FieldDef, type ThemeTokens } from "@/lib/fieldSchema";

type DraftField = FieldDef & { optionsText: string };

function emptyField(): DraftField {
  return { key: "", label: "", kind: "attribute", type: "text", optionsText: "", required: false };
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const { data: categories } = useCategories();

  const HEADER_FONT_LABELS: Record<ThemeTokens["headerFont"], string> = {
    oswald: t("fontOswald"),
    barlowCondensed: t("fontBarlowCondensed"),
    baloo2: t("fontBaloo2"),
    cinzel: t("fontCinzel"),
    geist: t("fontGeist"),
  };

  const ICON_SET_LABELS: Record<ThemeTokens["iconSet"], string> = {
    basketball: t("iconBasketball"),
    soccer: t("iconSoccer"),
    pokemon: t("iconPokemon"),
    tcg: t("iconTcg"),
    neutral: t("iconNeutral"),
  };
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
  const [headerFont, setHeaderFont] = useState<ThemeTokens["headerFont"]>("geist");
  const [iconSet, setIconSet] = useState<ThemeTokens["iconSet"]>("neutral");
  const [fields, setFields] = useState<DraftField[]>([emptyField()]);
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  const setReducedMotion = useUiStore((s) => s.setReducedMotion);
  const openTour = useOnboardingStore((s) => s.openTour);
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
          themeTokens: { accent, secondary, motif, headerFont, iconSet },
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
      setCreateError(err instanceof Error ? err.message : t("createCategoryFailed"));
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="font-display text-xl font-semibold">{t("title")}</h1>

      <section className="space-y-3 rounded-lg border border-border-1 p-4">
        <h2 className="text-sm font-semibold text-foreground/70">{t("currencyAndNegotiation")}</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex flex-col gap-1">
            {t("minMarginPct")}
            <input
              type="number"
              value={minMarginPct}
              onChange={(e) => setMinMarginPct(e.target.value)}
              className="w-32 rounded-md border border-border-1 px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1">
            {t("usdExchangeRate")}
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
          {common("save")}
        </button>
        {settingsSaved && <p className="text-sm text-emerald-600">{t("saved")}</p>}
      </section>

      <section className="space-y-3 rounded-lg border border-border-1 p-4">
        <h2 className="text-sm font-semibold text-foreground/70">{t("help")}</h2>
        <button
          onClick={openTour}
          className="booth-target rounded-md border border-border-1 px-4 py-2 text-sm hover:bg-surface-1"
        >
          {t("replayTour")}
        </button>
      </section>

      <section className="space-y-3 rounded-lg border border-border-1 p-4">
        <h2 className="text-sm font-semibold text-foreground/70">{t("accessibility")}</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} />
          {t("reduceMotion")}
        </label>
      </section>

      <section className="space-y-3 rounded-lg border border-border-1 p-4">
        <h2 className="text-sm font-semibold text-foreground/70">{t("backup")}</h2>
        <p className="text-sm text-foreground/60">{t("backupDescription")}</p>
        <a
          href="/api/backup"
          className="booth-target inline-block rounded-md border border-border-1 px-4 py-2 text-sm hover:bg-surface-1"
        >
          {t("downloadBackup")}
        </a>
      </section>

      <section className="space-y-3 rounded-lg border border-border-1 p-4">
        <h2 className="text-sm font-semibold text-foreground/70">{t("existingCategories")}</h2>
        <ul className="flex flex-wrap gap-2 text-sm">
          {categories?.map((c) => (
            <li key={c.key} className="flex items-center gap-2 rounded-full border border-border-1 px-3 py-1">
              <CategoryIcon iconSet={c.themeTokens.iconSet} className="h-3.5 w-3.5" style={{ color: c.themeTokens.accent }} />
              {c.displayName}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 rounded-lg border border-border-1 p-4">
        <h2 className="text-sm font-semibold text-foreground/70">{t("addCustomCategory")}</h2>
        <form onSubmit={handleCreateCategory} className="space-y-4">
          {createError && <p className="text-sm text-red-600">{createError}</p>}
          {createSuccess && <p className="text-sm text-emerald-600">{t("categoryCreated")}</p>}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="flex flex-col gap-1">
              {t("categoryKey")}
              <input required value={key} onChange={(e) => setKey(e.target.value)} className="rounded-md border border-border-1 px-2 py-1.5" />
            </label>
            <label className="flex flex-col gap-1">
              {t("displayName")}
              <input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="rounded-md border border-border-1 px-2 py-1.5" />
            </label>
            <label className="flex flex-col gap-1">
              {t("accentColor")}
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 rounded-md border border-border-1" />
            </label>
            <label className="flex flex-col gap-1">
              {t("secondaryColor")}
              <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="h-9 rounded-md border border-border-1" />
            </label>
            <label className="flex flex-col gap-1">
              {t("motif")}
              <select value={motif} onChange={(e) => setMotif(e.target.value as typeof motif)} className="rounded-md border border-border-1 px-2 py-1.5">
                <option value="none">{t("motifNone")}</option>
                <option value="hardwood">{t("motifHardwood")}</option>
                <option value="pitch">{t("motifPitch")}</option>
                <option value="holo">{t("motifHolo")}</option>
                <option value="frame">{t("motifFrame")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              {t("headerFont")}
              <select
                value={headerFont}
                onChange={(e) => setHeaderFont(e.target.value as ThemeTokens["headerFont"])}
                className="rounded-md border border-border-1 px-2 py-1.5"
              >
                {HEADER_FONTS.map((f) => (
                  <option key={f} value={f}>
                    {HEADER_FONT_LABELS[f]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              {t("icon")}
              <select
                value={iconSet}
                onChange={(e) => setIconSet(e.target.value as ThemeTokens["iconSet"])}
                className="rounded-md border border-border-1 px-2 py-1.5"
              >
                {ICON_SETS.map((i) => (
                  <option key={i} value={i}>
                    {ICON_SET_LABELS[i]}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2 pb-1.5">
              <span className="text-xs text-foreground/50">{t("preview")}</span>
              <CategoryIcon iconSet={iconSet} className="h-5 w-5" style={{ color: accent }} />
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase text-foreground/50">{t("extraFields")}</h3>
            <div className="space-y-2">
              {fields.map((field, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs">
                  <input
                    placeholder={t("fieldKeyPlaceholder")}
                    value={field.key}
                    onChange={(e) => setFields((fs) => fs.map((f, idx) => (idx === i ? { ...f, key: e.target.value } : f)))}
                    className="w-24 rounded-md border border-border-1 px-2 py-1"
                  />
                  <input
                    placeholder={t("fieldLabelPlaceholder")}
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
                    <option value="text">{t("fieldTypeText")}</option>
                    <option value="number">{t("fieldTypeNumber")}</option>
                    <option value="select">{t("fieldTypeSelect")}</option>
                    <option value="textarea">{t("fieldTypeTextarea")}</option>
                  </select>
                  {field.type === "select" && (
                    <input
                      placeholder={t("fieldOptionsPlaceholder")}
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
                    {t("required")}
                  </label>
                  <button
                    type="button"
                    onClick={() => setFields((fs) => fs.filter((_, idx) => idx !== i))}
                    className="text-foreground/40 hover:text-red-600"
                  >
                    {t("remove")}
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setFields((fs) => [...fs, emptyField()])}
                className="rounded-md border border-dashed border-border-1 px-2 py-1 text-xs hover:bg-surface-1"
              >
                {t("addField")}
              </button>
            </div>
          </div>

          <button type="submit" className="booth-target rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark">
            {t("createCategory")}
          </button>
        </form>
      </section>
    </div>
  );
}
