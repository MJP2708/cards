"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchBar() {
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
        placeholder="Search all categories…"
        aria-label="Search all categories"
        className="booth-target w-full rounded-md border border-border-1 bg-surface-1 px-3 py-1.5 text-sm outline-none focus:border-accent"
      />
    </form>
  );
}
