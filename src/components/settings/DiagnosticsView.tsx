"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

type Integration = {
  key: string;
  label: string;
  envVars: string[];
  state: "ok" | "down" | "unconfigured";
  detail: string;
  powers: string;
  ms: number | null;
};

const STATE_STYLES: Record<Integration["state"], string> = {
  ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  down: "bg-red-500/10 text-red-700 dark:text-red-400",
  unconfigured: "bg-amber-500/10 text-amber-700 dark:text-amber-500",
};

const STATE_LABELS: Record<Integration["state"], string> = {
  ok: "Working",
  down: "Unavailable",
  unconfigured: "Not configured",
};

export function DiagnosticsView({ initial, checkedAt }: { initial: Integration[]; checkedAt: string }) {
  const [integrations, setIntegrations] = useState(initial);
  const [stamp, setStamp] = useState(checkedAt);
  const [busy, setBusy] = useState(false);

  async function recheck() {
    setBusy(true);
    try {
      // force=true bypasses the eBay fast-fail cache, since this is an explicit ask.
      const res = await fetch("/api/diagnostics?force=true");
      const body = await res.json();
      if (res.ok) {
        setIntegrations(body.integrations);
        setStamp(body.checkedAt);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Integration status</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Live check of every external service this app talks to. Last checked{" "}
            {new Date(stamp).toLocaleTimeString()}.
          </p>
        </div>
        <button
          onClick={recheck}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border-1 px-3 py-2 text-sm hover:bg-surface-1 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          {busy ? "Checking…" : "Re-check now"}
        </button>
      </div>

      <ul className="mt-5 divide-y divide-border-1 rounded-md border border-border-1">
        {integrations.map((item) => (
          <li key={item.key} className="p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{item.label}</span>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATE_STYLES[item.state]}`}>
                {STATE_LABELS[item.state]}
                {item.ms !== null && item.state === "ok" ? ` · ${item.ms}ms` : ""}
              </span>
            </div>
            <p className="mt-1 text-xs text-foreground/60">{item.powers}</p>
            <p className="mt-1 text-xs text-foreground/80">{item.detail}</p>
            <p className="mt-1 font-mono text-[11px] text-foreground/40">{item.envVars.join(", ")}</p>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-foreground/50">
        &quot;Not configured&quot; means no key is set — that feature is simply off, and nothing else
        is affected. &quot;Unavailable&quot; means a key is set but the service rejected or failed
        the call; the app degrades to manual entry for that feature rather than erroring.
      </p>
    </div>
  );
}
