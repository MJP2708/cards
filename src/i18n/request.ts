import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "./locales";

const NAMESPACES = [
  "common",
  "nav",
  "dashboard",
  "reports",
  "settings",
  "inventory",
  "cardForm",
  "cardDetail",
  "dialogs",
  "checklist",
  "scan",
  "onboarding",
] as const;

async function loadMessages(locale: Locale) {
  const modules = await Promise.all(
    NAMESPACES.map((ns) => import(`../messages/${locale}/${ns}.json`).then((m) => [ns, m.default] as const))
  );
  return Object.fromEntries(modules);
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = (SUPPORTED_LOCALES as readonly string[]).includes(raw ?? "") ? (raw as Locale) : DEFAULT_LOCALE;

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
