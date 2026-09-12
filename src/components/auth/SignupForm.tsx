"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { InlineError } from "@/components/ui/InlineError";
import { signupSchema } from "@/lib/validation/signup";

type Fields = "name" | "storeName" | "email" | "password" | "confirmPassword";
type FieldErrors = Partial<Record<Fields, string>>;

const EMPTY = { name: "", storeName: "", email: "", password: "", confirmPassword: "" };

const INPUT_CLASS = "w-full rounded-md border border-border-1 bg-transparent px-3 py-2";

export function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(field: Fields, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
    // Clear a field's error as soon as it's edited, so the message doesn't sit
    // there contradicting what the user has already fixed.
    setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    // Same schema the route handler runs, so the inline errors shown here are
    // the real rules rather than a looser client-side approximation.
    const validated = signupSchema.safeParse(form);
    if (!validated.success) {
      const flattened = validated.error.flatten().fieldErrors;
      setFieldErrors(
        Object.fromEntries(
          Object.entries(flattened).map(([key, messages]) => [key, messages?.[0]])
        ) as FieldErrors
      );
      return;
    }

    setBusy(true);
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validated.data),
    });

    if (!response.ok) {
      setBusy(false);
      const body = await response.json().catch(() => null);
      // 400 returns zod's flattened shape; 403 returns a plain message.
      const serverFields = body?.error?.fieldErrors as Record<string, string[]> | undefined;
      if (serverFields) {
        setFieldErrors(
          Object.fromEntries(
            Object.entries(serverFields).map(([key, messages]) => [key, messages?.[0]])
          ) as FieldErrors
        );
        return;
      }
      setFormError(typeof body?.error === "string" ? body.error : "Could not create the account.");
      return;
    }

    // Straight in — no email verification step for a private single-shop tool.
    const signedIn = await signIn("credentials", {
      email: validated.data.email,
      password: validated.data.password,
      redirect: false,
    });
    setBusy(false);

    if (signedIn?.error) {
      setFormError("Account created, but sign-in failed. Try signing in.");
      return;
    }
    router.push("/all");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full max-w-sm space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Create your store</h1>
        <p className="mt-1 text-sm text-foreground/60">
          This sets up the owner account. You can add staff afterwards.
        </p>
      </div>

      <Field
        label="Full name"
        value={form.name}
        error={fieldErrors.name}
        autoComplete="name"
        onChange={(value) => update("name", value)}
      />
      <Field
        label="Store name"
        value={form.storeName}
        error={fieldErrors.storeName}
        autoComplete="organization"
        hint="Shown in the app header and on your sales reports."
        onChange={(value) => update("storeName", value)}
      />
      <Field
        label="Email"
        type="email"
        value={form.email}
        error={fieldErrors.email}
        autoComplete="username"
        onChange={(value) => update("email", value)}
      />
      <Field
        label="Password"
        type="password"
        value={form.password}
        error={fieldErrors.password}
        autoComplete="new-password"
        hint="At least 8 characters, with an uppercase letter, a lowercase letter and a number."
        onChange={(value) => update("password", value)}
      />
      <Field
        label="Confirm password"
        type="password"
        value={form.confirmPassword}
        error={fieldErrors.confirmPassword}
        autoComplete="new-password"
        onChange={(value) => update("confirmPassword", value)}
      />

      {formError && <InlineError message={formError} />}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {busy ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-sm text-foreground/60">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  hint,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  autoComplete?: string;
}) {
  const describedBy = error ? `${label}-error` : hint ? `${label}-hint` : undefined;
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${INPUT_CLASS} ${error ? "border-red-500" : ""}`}
      />
      {error ? (
        <span id={`${label}-error`} role="alert" className="mt-1 block text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : hint ? (
        <span id={`${label}-hint`} className="mt-1 block text-xs text-foreground/50">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
