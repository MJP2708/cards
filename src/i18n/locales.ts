// Client-safe constants — kept separate from request.ts so client components
// never pull in next/headers (server-only) transitively.
export const SUPPORTED_LOCALES = ["en", "th"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "th";
export const LOCALE_COOKIE = "NEXT_LOCALE";
