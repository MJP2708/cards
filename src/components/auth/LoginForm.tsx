"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { InlineError } from "@/components/ui/InlineError";

export function LoginForm({ appName }: { appName: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (result?.error) {
      // Deliberately vague: never reveal whether the email exists.
      setError(t("badCredentials"));
      return;
    }
    router.push(params.get("next") ?? "/all");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{appName}</h1>
        <p className="mt-1 text-sm text-foreground/60">{t("signInTitle")}</p>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t("email")}</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
          className="w-full rounded-md border border-border-1 bg-transparent px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t("password")}</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-border-1 bg-transparent px-3 py-2"
        />
      </label>
      {error && <InlineError message={error} />}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {busy ? t("signingIn") : t("signIn")}
      </button>
      {/* Sign-up is open: each one creates its own store. Staff of an existing
          store are added by its owner instead, not through here. */}
      <p className="text-center text-sm text-foreground/60">
        {t("noAccount")}{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          {t("signUp")}
        </Link>
      </p>
    </form>
  );
}
