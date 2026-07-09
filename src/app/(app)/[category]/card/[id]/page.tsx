"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Trash2, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCategories } from "@/hooks/useCategories";
import { useCard, useUpdateCard, useDeleteCard } from "@/lib/data/cards";
import { CardForm, formValuesFromCard, formValuesToInput } from "@/components/cards/CardForm";
import { MarkSoldDialog } from "@/components/cards/MarkSoldDialog";
import { FactSheetPanel } from "@/components/cards/FactSheetPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { actionWithUndo } from "@/lib/undoToast";

export default function CardDetailPage() {
  const params = useParams<{ category: string; id: string }>();
  const router = useRouter();
  const t = useTranslations("cardDetail");
  const cardFormT = useTranslations("cardForm");
  const common = useTranslations("common");
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
          <div className="mt-1 flex items-center gap-2 text-sm text-foreground/60">
            <span>{category.displayName}</span>
            <StatusPill status={card.status} />
            <span>{t("qty", { count: card.quantity })}</span>
          </div>
        </div>
        {/* Mark Sold leads visually since it's the frequent, revenue-generating
            action; Delete is rare and destructive, so it's icon-only and set
            apart rather than sitting at equal weight beside it. */}
        <div className="flex items-center gap-2">
          {card.status !== "Sold" && (
            <button
              onClick={() => setShowSoldDialog(true)}
              className="booth-target rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
            >
              {common("markSold")}
            </button>
          )}
          <Link
            href={`/label/${card.id}`}
            target="_blank"
            aria-label={t("printQrLabel")}
            className="booth-target flex items-center gap-1.5 rounded-md border border-border-1 px-3 py-2 text-sm hover:bg-surface-1"
          >
            <Printer className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{t("printQrLabel")}</span>
          </Link>
          <button
            onClick={() => {
              actionWithUndo(t("cardDeleted", { name: card.name }), () => {
                deleteCard.mutate(card.id);
              });
              router.push(`/${category.key.toLowerCase()}`);
            }}
            aria-label={common("delete")}
            className="booth-target flex items-center justify-center rounded-md px-3 py-2 text-foreground/40 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
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
                return true;
              } catch (e) {
                setErrors([e instanceof Error ? e.message : cardFormT("saveFailed")]);
                return false;
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
