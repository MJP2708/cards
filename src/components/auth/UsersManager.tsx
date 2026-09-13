"use client";

import { useTranslations } from "next-intl";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InlineError } from "@/components/ui/InlineError";

type User = { id: string; email: string; name: string; role: string; createdAt: string };

export function UsersManager({ initialUsers, currentUserId }: { initialUsers: User[]; currentUserId: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "MEMBER" });
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      const body = await res.json();
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Request failed.");
      return body;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    const list = await call("/api/users", { method: "GET" });
    if (list) setUsers(list);
    router.refresh();
  }

  async function addUser(event: React.FormEvent) {
    event.preventDefault();
    const created = await call("/api/users", { method: "POST", body: JSON.stringify(form) });
    if (created) {
      setForm({ email: "", name: "", password: "", role: "MEMBER" });
      await refresh();
    }
  }

  async function doReset(id: string) {
    const done = await call(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify({ password: resetPassword }) });
    if (done) {
      setResetFor(null);
      setResetPassword("");
    }
  }

  async function remove(id: string) {
    const done = await call(`/api/users/${id}`, { method: "DELETE" });
    if (done) await refresh();
  }

  return (
    <>
      {error && <InlineError message={error} className="mb-3" />}

      <ul className="mb-6 divide-y divide-border-1 rounded-md border border-border-1">
        {users.map((user) => (
          <li key={user.id} className="p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium">{user.name}</span>
                <span className="ml-2 rounded bg-surface-1 px-1.5 py-0.5 text-xs uppercase">{user.role}</span>
                <div className="text-xs text-foreground/60">{user.email}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setResetFor(resetFor === user.id ? null : user.id)}
                  className="tap-compact rounded-md border border-border-1 px-2 py-1 text-xs hover:bg-surface-1"
                >
                  Reset password
                </button>
                {user.id !== currentUserId && (
                  <button
                    onClick={() => remove(user.id)}
                    disabled={busy}
                    className="tap-compact rounded-md border border-border-1 px-2 py-1 text-xs text-red-600 hover:bg-surface-1"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            {resetFor === user.id && (
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder={t("newPassword")}
                  className="flex-1 rounded-md border border-border-1 bg-transparent px-2 py-1 text-xs"
                />
                <button
                  onClick={() => doReset(user.id)}
                  disabled={busy || resetPassword.length < 8}
                  className="tap-compact rounded-md bg-foreground px-3 py-1 text-xs text-background disabled:opacity-50"
                >
                  Set
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={addUser} className="space-y-3 rounded-md border border-border-1 p-4">
        <h2 className="text-sm font-semibold">Add a staff account</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="text" required placeholder={t("name")} value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-md border border-border-1 bg-transparent px-3 py-2 text-sm"
          />
          <input
            type="email" required placeholder={t("email")} value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-md border border-border-1 bg-transparent px-3 py-2 text-sm"
          />
          <input
            type="password" autoComplete="new-password" required minLength={8} placeholder={t("passwordMin")} value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded-md border border-border-1 bg-transparent px-3 py-2 text-sm"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="rounded-md border border-border-1 bg-transparent px-3 py-2 text-sm"
          >
            <option value="MEMBER">{t("roleMember")}</option>
            <option value="OWNER">{t("roleOwner")}</option>
          </select>
        </div>
        <button
          type="submit" disabled={busy}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          Create account
        </button>
      </form>
    </>
  );
}
