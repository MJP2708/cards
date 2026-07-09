"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import Image from "next/image";
import { Upload, X, Loader2, Link as LinkIcon } from "lucide-react";
import { isOptimizableImageUrl } from "@/lib/images";

export function PhotoUploadField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      onChange(blob.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground/70">{label}</span>

      {value ? (
        <div className="flex items-center gap-2">
          <div className="relative h-16 w-12 overflow-hidden rounded-md border border-border-1 bg-surface-1">
            <Image
              src={value}
              alt=""
              fill
              sizes="48px"
              unoptimized={!isOptimizableImageUrl(value)}
              className="object-cover"
            />
          </div>
          <button
            type="button"
            onClick={() => onChange("")}
            className="flex items-center gap-1 rounded-md border border-border-1 px-2 py-1.5 text-xs hover:bg-surface-1"
          >
            <X className="h-3 w-3" />
            Remove
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-md border border-dashed border-border-1 px-3 py-2 text-xs hover:bg-surface-1 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? "Uploading…" : "Upload photo"}
          </button>
          <button
            type="button"
            onClick={() => setShowUrlInput((s) => !s)}
            className="flex items-center gap-1 text-xs text-foreground/50 hover:text-foreground"
          >
            <LinkIcon className="h-3 w-3" />
            or paste URL
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {showUrlInput && !value && (
        <input
          type="url"
          placeholder="https://…"
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-border-1 bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
