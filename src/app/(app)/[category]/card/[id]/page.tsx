"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useCategories } from "@/hooks/useCategories";
import { useCard, useUpdateCard, useDeleteCard } from "@/lib/data/cards";
import { CardForm, formValuesFromCard, formValuesToInput } from "@/components/cards/CardForm";
import { MarkSoldDialog } from "@/components/cards/MarkSoldDialog";
import { FactSheetPanel } from "@/components/cards/FactSheetPanel";

export default function CardDetailPage() {
  const params = useParams<{ category: string; id: string }>();
  const router = useRouter();
  const { data: categories } = useCategories();
  const { data: card, isLoading } = useCard(params.id);
  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();
  const [errors, setErrors] = useState<string[]>([]);
  const [showSoldDialog, setShowSoldDialog] = useState(false);

  const category = categories?.find((c) => c.key.toLowerCase() === (card?.category ?? params.category).toLowerCase());

  if (isLoading || !card || !category) {
    return <p className="text-sm text-foreground/60">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{card.name}</h1>
          <p className="text-sm text-foreground/60">
            {category.displayName} · {card.status} · Qty {card.quantity}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/label/${card.id}`}
            target="_blank"
            className="booth-target rounded-md border border-border-1 px-4 py-2 text-sm hover:bg-surface-1"
          >
            Print QR Label
          </Link>
          {card.status !== "Sold" && (
            <button
              onClick={() => setShowSoldDialog(true)}
              className="booth-target rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
            >
              Mark Sold
            </button>
          )}
          <button
            onClick={async () => {
              if (!confirm(`Delete "${card.name}"? This cannot be undone.`)) return;
              await deleteCard.mutateAsync(card.id);
              router.push(`/${category.key.toLowerCase()}`);
            }}
            className="booth-target rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <CardForm
          category={category}
          initial={formValuesFromCard(card)}
          submitLabel="Save Changes"
          errors={errors}
          onSubmit={async (values) => {
            setErrors([]);
            try {
              await updateCard.mutateAsync({ id: card.id, input: formValuesToInput(category, values) });
            } catch (e) {
              setErrors([e instanceof Error ? e.message : "Failed to save"]);
            }
          }}
        />
        <FactSheetPanel card={card} category={category} />
      </div>

      {showSoldDialog && <MarkSoldDialog card={card} onClose={() => setShowSoldDialog(false)} />}
    </div>
  );
}
