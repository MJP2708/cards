"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BrowserMultiFormatReader } from "@zxing/library";

export default function ScanPage() {
  const router = useRouter();
  const t = useTranslations("scan");
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [status, setStatus] = useState<"idle" | "scanning" | "looking-up">("idle");

  async function lookupAndGo(code: string) {
    setStatus("looking-up");
    try {
      const res = await fetch(`/api/cards/lookup?qrCode=${encodeURIComponent(code)}`);
      if (!res.ok) {
        setError(t("notFound", { code }));
        setStatus("scanning");
        return;
      }
      const card = await res.json();
      router.push(`/${card.category.toLowerCase()}/card/${card.id}`);
    } catch {
      setError(t("lookupFailed"));
      setStatus("scanning");
    }
  }

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    setStatus("scanning");

    reader
      .decodeFromVideoDevice(null, videoRef.current!, (result) => {
        if (result) lookupAndGo(result.getText());
      })
      .catch(() => setError(t("cameraUnavailable")));

    return () => {
      reader.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="font-display text-xl font-semibold">{t("title")}</h1>
      <div className="overflow-hidden rounded-lg border border-border-1 bg-black">
        <video ref={videoRef} className="w-full" muted playsInline />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {status === "looking-up" && <p className="text-sm text-foreground/60">{t("lookingUp")}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manualCode.trim()) lookupAndGo(manualCode.trim());
        }}
        className="flex gap-2"
      >
        <input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder={t("manualPlaceholder")}
          className="flex-1 rounded-md border border-border-1 px-3 py-2 text-sm"
        />
        <button type="submit" className="booth-target rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark">
          {t("go")}
        </button>
      </form>
    </div>
  );
}
