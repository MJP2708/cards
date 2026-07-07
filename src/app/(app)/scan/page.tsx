"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrowserMultiFormatReader } from "@zxing/library";

export default function ScanPage() {
  const router = useRouter();
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
        setError(`No card found for code "${code}".`);
        setStatus("scanning");
        return;
      }
      const card = await res.json();
      router.push(`/${card.category.toLowerCase()}/card/${card.id}`);
    } catch {
      setError("Lookup failed. Check your connection and try again.");
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
      .catch(() => setError("Camera access is unavailable. Use the manual code entry below instead."));

    return () => {
      reader.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-semibold">Scan Card QR</h1>
      <div className="overflow-hidden rounded-lg border border-border-1 bg-black">
        <video ref={videoRef} className="w-full" muted playsInline />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {status === "looking-up" && <p className="text-sm text-foreground/60">Looking up card…</p>}

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
          placeholder="Or type the code manually"
          className="flex-1 rounded-md border border-border-1 px-3 py-2 text-sm"
        />
        <button type="submit" className="booth-target rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark">
          Go
        </button>
      </form>
    </div>
  );
}
