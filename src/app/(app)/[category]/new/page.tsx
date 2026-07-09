"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCategories } from "@/hooks/useCategories";
import { ArrowLeft } from "lucide-react";
import { useCreateCard } from "@/lib/data/cards";
import { CardForm, emptyFormValues, formValuesToInput } from "@/components/cards/CardForm";

export default function NewCardPage() {
  const params = useParams<{ category: string }>();
  const router = useRouter();
  const t = useTranslations("cardForm");
  const common = useTranslations("common");
  const { data: categories, isLoading } = useCategories();
  const createCard = useCreateCard();
  const [errors, setErrors] = useState<string[]>([]);

  const category = categories?.find((c) => c.key.toLowerCase() === params.category.toLowerCase());

  if (isLoading) return <p className="text-sm text-foreground/60">{common("loading")}</p>;

  if (!category) {
    return (
      <div className="max-w-md space-y-3">
        <p className="text-sm">{t("chooseCategory")}</p>
        <div className="flex flex-wrap gap-2">
          {categories?.map((c) => (
            <Link
              key={c.key}
              href={`/${c.key.toLowerCase()}/new`}
              className="rounded-md border border-border-1 px-3 py-1.5 text-sm hover:bg-surface-1"
            >
              {c.displayName}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href={`/${category.key.toLowerCase()}`}
        className="inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("backTo", { category: category.displayName })}
      </Link>
      <h1 className="font-display text-xl font-semibold">{t("addCardTitle", { category: category.displayName })}</h1>
      <CardForm
        category={category}
        initial={emptyFormValues(category)}
        submitLabel={common("addCard")}
        errors={errors}
        onSubmit={async (values) => {
          setErrors([]);
          try {
            const card = await createCard.mutateAsync(formValuesToInput(category, values));
            router.push(`/${category.key.toLowerCase()}/card/${card.id}`);
          } catch (e) {
            setErrors([e instanceof Error ? e.message : t("createFailed")]);
          }
        }}
      />
    </div>
  );
}
