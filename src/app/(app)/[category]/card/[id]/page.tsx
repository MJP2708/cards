"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCategories } from "@/hooks/useCategories";
import { useCard, useUpdateCard, useDeleteCard } from "@/lib/data/cards";
import { CardForm, formValuesFromCard, formValuesToInput } from "@/components/cards/CardForm";
import { MarkSoldDialog } from "@/components/cards/MarkSoldDialog";
import { FactSheetPanel } from "@/components/cards/FactSheetPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { actionWithUndo } from "@/lib/undoToast";
import { useStatusLabel } from "@/lib/statusLabels";

export default function CardDetailPage() {
  const params = useParams<{ category: string; id: string }>();
  const router = useRouter();
  const t = useTranslations("cardDetail");
  const cardFormT = useTranslations("cardForm");
  const common = useTranslations("common");
  const statusLabel = useStatusLabel();
  const { data: categories } = useCategories();
  const { data: card, isLoading } = useCard(params.id);
  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();
  const [errors, setErrors] = useState<string[]>([]);
  const [showSoldDialog, setShowSoldDialog] = useState(false);

  const category = categories?.find((c) => c.key.toLowerCase() === (card?.category ?? params.category).toLowerCase());

  if (isLoading || !card || !category) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/${category.key.toLowerCase()}`}
        className="inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {cardFormT("backTo", { category: category.displayName })}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">{card.name}</h1>
          <p className="text-sm text-foreground/60">
            {category.displayName} · {statusLabel(card.status)} · {t("qty", { count: card.quantity })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/label/${card.id}`}
            target="_blank"
            className="booth-target rounded-md border border-border-1 px-4 py-2 text-sm hover:bg-surface-1"
          >
            {t("printQrLabel")}
          </Link>
          {card.status !== "Sold" && (
            <button
              onClick={() => setShowSoldDialog(true)}
              className="booth-target rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
            >
              {common("markSold")}
            </button>
          )}
          <button
            onClick={() => {
              actionWithUndo(t("cardDeleted", { name: card.name }), () => {
                deleteCard.mutate(card.id);
              });
              router.push(`/${category.key.toLowerCase()}`);
            }}
            className="booth-target rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
          >
            {common("delete")}
          </button>
        </div>
      </div>

      {/* Fact Sheet comes first in DOM order so it's what you see first when
          stacked on mobile — that's what you need instantly with a buyer in
          front of you, not the edit form. Desktop shows them side by side. */}
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <CardForm
            category={category}
            initial={formValuesFromCard(card)}
            submitLabel={common("saveChanges")}
            errors={errors}
            onSubmit={async (values) => {
              setErrors([]);
              try {
                await updateCard.mutateAsync({ id: card.id, input: formValuesToInput(category, values) });
              } catch (e) {
                setErrors([e instanceof Error ? e.message : cardFormT("saveFailed")]);
              }
            }}
          />
        </div>
        <div className="order-1 lg:order-2">
          <FactSheetPanel card={card} category={category} />
        </div>
      </div>

      {showSoldDialog && <MarkSoldDialog card={card} onClose={() => setShowSoldDialog(false)} />}
    </div>
  );
}
