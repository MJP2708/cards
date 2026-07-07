"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function SearchBar() {
  const t = useTranslations("common");
  const router = useRouter();
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/all?q=${encodeURIComponent(q)}` : "/all");
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0 flex-1 max-w-sm">
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("search")}
        aria-label={t("search")}
        className="booth-target w-full rounded-md border border-border-1 bg-surface-1 px-3 py-1.5 text-sm outline-none focus:border-accent"
      />
    </form>
  );
}
