"use client";

import { useState } from "react";
import { IdCard, Tag, ImagePlus } from "lucide-react";
import type { CategoryDTO } from "@/lib/categories";
import type { CardDTO } from "@/lib/data/types";
import { PhotoUploadField } from "@/components/cards/PhotoUploadField";

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
}: {
  category: CategoryDTO;
  initial: CardFormValues;
  onSubmit: (values: CardFormValues) => void;
  submitLabel: string;
  errors?: string[];
}) {
  const [values, setValues] = useState(initial);

  function update<K extends keyof CardFormValues>(key: K, value: CardFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function updateAttribute(key: string, value: string) {
    setValues((v) => ({ ...v, attributes: { ...v.attributes, [key]: value } }));
  }

  const coreLabels: Record<string, string> = Object.fromEntries(
    category.fieldSchema.filter((f) => f.kind === "core").map((f) => [f.key, f.label])
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
      className="max-w-2xl space-y-5"
    >
      {errors && errors.length > 0 && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}

      <FormSection icon={IdCard} title="Identity">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Name</span>
          <input required autoFocus className={inputClass} value={values.name} onChange={(e) => update("name", e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Series / Set</span>
          <input required className={inputClass} value={values.series} onChange={(e) => update("series", e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Year</span>
          <input type="number" className={inputClass} value={values.year} onChange={(e) => update("year", e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Card Number</span>
          <input className={inputClass} value={values.cardNumber} onChange={(e) => update("cardNumber", e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>{coreLabels.cardType ?? "Card Type"}</span>
          <input className={inputClass} value={values.cardType} onChange={(e) => update("cardType", e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Rarity / Print Run</span>
          <input className={inputClass} value={values.rarity} onChange={(e) => update("rarity", e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Grade / Condition</span>
          <input className={inputClass} value={values.grade} onChange={(e) => update("grade", e.target.value)} />
        </label>

        {category.fieldSchema
          .filter((f) => f.kind === "attribute")
          .map((field) => (
            <label key={field.key} className="flex flex-col gap-1">
              <span className={labelClass}>
                {field.label}
                {field.required && " *"}
              </span>
              {field.type === "select" ? (
                <select
                  required={field.required}
                  className={inputClass}
                  value={values.attributes[field.key] ?? ""}
                  onChange={(e) => updateAttribute(field.key, e.target.value)}
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  required={field.required}
                  className={inputClass}
                  value={values.attributes[field.key] ?? ""}
                  onChange={(e) => updateAttribute(field.key, e.target.value)}
                />
              )}
            </label>
          ))}
      </FormSection>

      <FormSection icon={Tag} title="Pricing & Status">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Cost Basis (THB)</span>
          <input required type="number" step="0.01" className={inputClass} value={values.costBasis} onChange={(e) => update("costBasis", e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Asking Price (THB)</span>
          <input required type="number" step="0.01" className={inputClass} value={values.askingPrice} onChange={(e) => update("askingPrice", e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Quantity</span>
          <input required type="number" min="1" className={inputClass} value={values.quantity} onChange={(e) => update("quantity", e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Status</span>
          <select className={inputClass} value={values.status} onChange={(e) => update("status", e.target.value as CardDTO["status"])}>
            <option>In Stock</option>
            <option>Reserved</option>
            <option>On Hold</option>
            <option>Sold</option>
          </select>
        </label>
      </FormSection>

      <FormSection icon={ImagePlus} title="Photos & Notes">
        <PhotoUploadField label="Front Photo" value={values.photoFront} onChange={(url) => update("photoFront", url)} />
        <PhotoUploadField label="Back Photo" value={values.photoBack} onChange={(url) => update("photoBack", url)} />

        <label className="flex flex-col gap-1">
          <span className={labelClass}>QR Code (optional, unique)</span>
          <input className={inputClass} value={values.qrCode} onChange={(e) => update("qrCode", e.target.value)} />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelClass}>Buyer Note</span>
          <textarea className={inputClass} rows={2} value={values.buyerNote} onChange={(e) => update("buyerNote", e.target.value)} />
        </label>
      </FormSection>

      <button
        type="submit"
        className="booth-target rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
      >
        {submitLabel}
      </button>
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
