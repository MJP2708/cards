// next/image only optimizes hosts listed in next.config.ts's remotePatterns
// (our Vercel Blob store). Users can also paste an arbitrary external URL via
// PhotoUploadField's "or paste URL" fallback, so callers must pass
// `unoptimized` for anything that isn't a known-good Blob URL, or next/image
// throws at runtime for the unlisted host.
export function isOptimizableImageUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}
