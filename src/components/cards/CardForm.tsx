"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { IdCard, Tag, ImagePlus, Minus, Plus, ArrowRight } from "lucide-react";
import type { CategoryDTO } from "@/lib/categories";
import type { CardDTO } from "@/lib/data/types";
import { PhotoUploadField } from "@/components/cards/PhotoUploadField";
import { InlineError } from "@/components/ui/InlineError";
import { STATUS_VALUES, useStatusLabel } from "@/lib/statusLabels";
import { fieldLabelKey } from "@/lib/fieldLabels";
import { useCards } from "@/lib/data/cards";

export type CardFormValues = {
  name: string;
  series: string;
  year: string;
  cardNumber: string;
  cardType: string;
  rarity: string;
  grade: string;
  costBasis: string;
  askingPrice: string;
  quantity: string;
  status: CardDTO["status"];
  buyerNote: string;
  qrCode: string;
  photoFront: string;
  photoBack: string;
  attributes: Record<string, string>;
};

export function emptyFormValues(category: CategoryDTO): CardFormValues {
  const attributes: Record<string, string> = {};
  for (const f of category.fieldSchema) {
    if (f.kind === "attribute") attributes[f.key] = "";
  }
  return {
    name: "",
    series: "",
    year: "",
    cardNumber: "",
    cardType: "",
    rarity: "",
    grade: "",
    costBasis: "",
    askingPrice: "",
    quantity: "1",
    status: "In Stock",
    buyerNote: "",
    qrCode: "",
    photoFront: "",
    photoBack: "",
    attributes,
  };
}

export function formValuesFromCard(card: CardDTO): CardFormValues {
  return {
    name: card.name,
    series: card.series,
    year: card.year?.toString() ?? "",
    cardNumber: card.cardNumber ?? "",
    cardType: card.cardType ?? "",
    rarity: card.rarity ?? "",
    grade: card.grade ?? "",
    costBasis: card.costBasis.toString(),
    askingPrice: card.askingPrice.toString(),
    quantity: card.quantity.toString(),
    status: card.status,
    buyerNote: card.buyerNote ?? "",
    qrCode: card.qrCode ?? "",
    photoFront: card.photoFront ?? "",
    photoBack: card.photoBack ?? "",
    attributes: Object.fromEntries(
      Object.entries(card.attributes ?? {}).map(([k, v]) => [k, String(v ?? "")])
    ),
  };
}

const inputClass =
  "w-full rounded-md border border-border-1 bg-background px-3 py-2 text-sm outline-none focus:border-accent";
const labelClass = "text-xs font-medium text-foreground/70";

function RequiredMark() {
  return (
    <span className="text-red-500" aria-hidden>
      {" "}
      *
    </span>
  );
}

function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-border-1 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--accent-dark)" }}>
        <Icon className="h-4 w-4" />
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function CardForm({
  category,
  initial,
  onSubmit,
  submitLabel,
  errors,
  allowAddSimilar = false,
}: {
  category: CategoryDTO;
  initial: CardFormValues;
  // Returns whether the submit succeeded — "Save & Add Similar" only clears
  // the form and refocuses Name when it did, otherwise the failed values
  // (and the error banner) stay exactly as the dealer left them.
  onSubmit: (values: CardFormValues, mode: "save" | "similar") => boolean | Promise<boolean>;
  submitLabel: string;
  errors?: string[];
  allowAddSimilar?: boolean;
}) {
  const t = useTranslations("cardForm");
  const statusLabel = useStatusLabel();
  const [values, setValues] = useState(initial);
  const formRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState<"save" | "similar" | null>(null);

  // Sourced from the dealer's own existing inventory in this category — no
  // new data model, just distinct values already sitting in cards they've
  // entered, offered as <datalist> suggestions so repeated set/team names
  // don't get retyped from scratch on every card.
  const { data: existingCards } = useCards({ category: category.key });
  const seriesSuggestions = useMemo(
    () => Array.from(new Set((existingCards ?? []).map((c) => c.series).filter(Boolean))).slice(0, 50),
    [existingCards]
  );
  const teamSuggestions = useMemo(
    () =>
      Array.from(
        new Set((existingCards ?? []).map((c) => (c.attributes?.team as string | undefined) ?? "").filter(Boolean))
      ).slice(0, 50),
    [existingCards]
  );

  function update<K extends keyof CardFormValues>(key: K, value: CardFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function updateAttribute(key: string, value: string) {
    setValues((v) => ({ ...v, attributes: { ...v.attributes, [key]: value } }));
  }

  const coreLabels: Record<string, string> = Object.fromEntries(
    category.fieldSchema.filter((f) => f.kind === "core").map((f) => [f.key, f.label])
  );

  function labelFor(key: string, dbLabel: string) {
    const translationKey = fieldLabelKey(key);
    return translationKey ? t(translationKey) : dbLabel;
  }

  const costBasis = Number(values.costBasis);
  const askingPrice = Number(values.askingPrice);
  const hasMargin = values.costBasis !== "" && values.askingPrice !== "" && !Number.isNaN(costBasis) && !Number.isNaN(askingPrice);
  const profit = askingPrice - costBasis;
  const marginPct = costBasis > 0 ? (profit / costBasis) * 100 : 0;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting("save");
    try {
      await onSubmit(values, "save");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleAddSimilar() {
    if (!formRef.current?.reportValidity()) return;
    setSubmitting("similar");
    try {
      const ok = await onSubmit(values, "similar");
      if (ok) {
        setValues((v) => ({ ...v, name: "", cardNumber: "", photoFront: "", photoBack: "", qrCode: "" }));
        nameInputRef.current?.focus();
      }
    } finally {
      setSubmitting(null);
    }
  }

  function stepQuantity(delta: number) {
    const next = Math.max(1, (Number(values.quantity) || 1) + delta);
    update("quantity", String(next));
  }

  return (
    <form ref={formRef} onSubmit={handleSave} className="max-w-2xl space-y-5 pb-24 md:pb-0">
      {errors && errors.length > 0 && <InlineError message={errors.join(" ")} />}

      <FormSection icon={IdCard} title={t("sectionIdentity")}>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>
            {t("fieldName")}
            <RequiredMark />
          </span>
          <input ref={nameInputRef} required autoFocus className={inputClass} value={values.name} onChange={(e) => update("name", e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>
            {t("fieldSeriesSet")}
            <RequiredMark />
          </span>
          <input
            required
            list="series-suggestions"
            className={inputClass}
            value={values.series}
            onChange={(e) => update("series", e.target.value)}
          />
          <datalist id="series-suggestions">
            {seriesSuggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t("fieldYear")}</span>
          <input type="number" className={inputClass} value={values.year} onChange={(e) => update("year", e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t("fieldCardNumber")}</span>
          <input className={inputClass} value={values.cardNumber} onChange={(e) => update("cardNumber", e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>{labelFor("cardType", coreLabels.cardType ?? t("fieldCardType"))}</span>
          <input className={inputClass} value={values.cardType} onChange={(e) => update("cardType", e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t("fieldRarity")}</span>
          <input className={inputClass} value={values.rarity} onChange={(e) => update("rarity", e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t("fieldGrade")}</span>
          <input className={inputClass} value={values.grade} onChange={(e) => update("grade", e.target.value)} />
        </label>

        {category.fieldSchema
          .filter((f) => f.kind === "attribute")
          .map((field) => {
            const isTeamField = field.key === "team";
            return (
              <label key={field.key} className="flex flex-col gap-1">
                <span className={labelClass}>
                  {labelFor(field.key, field.label)}
                  {field.required && <RequiredMark />}
                </span>
                {field.type === "select" ? (
                  <select
                    required={field.required}
                    className={inputClass}
                    value={values.attributes[field.key] ?? ""}
                    onChange={(e) => updateAttribute(field.key, e.target.value)}
                  >
                    <option value="" disabled>
                      {t("selectPlaceholder")}
                    </option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input
                      required={field.required}
                      list={isTeamField ? "team-suggestions" : undefined}
                      className={inputClass}
                      value={values.attributes[field.key] ?? ""}
                      onChange={(e) => updateAttribute(field.key, e.target.value)}
                    />
                    {isTeamField && (
                      <datalist id="team-suggestions">
                        {teamSuggestions.map((v) => (
                          <option key={v} value={v} />
                        ))}
                      </datalist>
                    )}
                  </>
                )}
              </label>
            );
          })}
      </FormSection>

      <FormSection icon={Tag} title={t("sectionPricingStatus")}>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>
            {t("fieldCostBasis")}
            <RequiredMark />
          </span>
          <input required type="number" step="0.01" className={inputClass} value={values.costBasis} onChange={(e) => update("costBasis", e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>
            {t("fieldAskingPrice")}
            <RequiredMark />
          </span>
          <input required type="number" step="0.01" className={inputClass} value={values.askingPrice} onChange={(e) => update("askingPrice", e.target.value)} />
          {hasMargin && (
            <span className={`text-xs ${profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {profit >= 0 ? "→ +" : "→ "}฿{profit.toLocaleString()} {t("profitLabel")} ({marginPct.toFixed(0)}%)
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t("fieldQuantity")}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => stepQuantity(-1)}
              aria-label={t("decreaseQuantity")}
              className="tap-compact flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-1 hover:bg-surface-1"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <input
              required
              type="number"
              min="1"
              className={`${inputClass} text-center`}
              value={values.quantity}
              onChange={(e) => update("quantity", e.target.value)}
            />
            <button
              type="button"
              onClick={() => stepQuantity(1)}
              aria-label={t("increaseQuantity")}
              className="tap-compact flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-1 hover:bg-surface-1"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t("fieldStatus")}</span>
          <select className={inputClass} value={values.status} onChange={(e) => update("status", e.target.value as CardDTO["status"])}>
            {STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
      </FormSection>

      <FormSection icon={ImagePlus} title={t("sectionPhotosNotes")}>
        <PhotoUploadField label={t("frontPhoto")} value={values.photoFront} onChange={(url) => update("photoFront", url)} />
        <PhotoUploadField label={t("backPhoto")} value={values.photoBack} onChange={(url) => update("photoBack", url)} />

        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t("fieldQrCode")}</span>
          <input className={inputClass} value={values.qrCode} onChange={(e) => update("qrCode", e.target.value)} />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelClass}>{t("fieldBuyerNote")}</span>
          <textarea className={inputClass} rows={2} value={values.buyerNote} onChange={(e) => update("buyerNote", e.target.value)} />
        </label>
      </FormSection>

      {/* Sticky on mobile so submitting never requires scrolling back up past
          the (often-skipped) photos section — always one thumb-reach away. */}
      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-border-1 bg-background px-4 py-3 pb-safe md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        {allowAddSimilar && (
          <button
            type="button"
            onClick={handleAddSimilar}
            disabled={submitting !== null}
            className="booth-target flex flex-1 items-center justify-center gap-1.5 rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-[var(--accent-tint-weak)] disabled:opacity-50 md:flex-none"
          >
            <ArrowRight className="h-4 w-4" />
            {submitting === "similar" ? t("saving") : t("saveAndAddSimilar")}
          </button>
        )}
        <button
          type="submit"
          disabled={submitting !== null}
          className="booth-target flex-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50 md:flex-none"
        >
          {submitting === "save" ? t("saving") : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function formValuesToInput(category: CategoryDTO, values: CardFormValues) {
  return {
    category: category.key,
    name: values.name,
    series: values.series,
    year: values.year ? Number(values.year) : null,
    cardNumber: values.cardNumber || null,
    cardType: values.cardType || null,
    rarity: values.rarity || null,
    grade: values.grade || null,
    status: values.status,
    costBasis: Number(values.costBasis),
    askingPrice: Number(values.askingPrice),
    quantity: Number(values.quantity),
    qrCode: values.qrCode || null,
    photoFront: values.photoFront || null,
    photoBack: values.photoBack || null,
    buyerNote: values.buyerNote || null,
    attributes: values.attributes,
  };
}
