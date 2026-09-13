import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CategorySwitcher } from "@/components/CategorySwitcher";
import { SearchBar } from "@/components/SearchBar";
import { OfflineBanner } from "@/components/OfflineBanner";
import { CommandPalette } from "@/components/CommandPalette";
import { CommandPaletteButton } from "@/components/CommandPaletteButton";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { MoreMenu } from "@/components/MoreMenu";
import { NavLinks } from "@/components/nav/NavLinks";
import { MobileTabBar } from "@/components/nav/MobileTabBar";
import { UserMenu } from "@/components/auth/UserMenu";
import { getSessionUser } from "@/lib/auth/guards";
import { getStoreName } from "@/lib/storeName";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Authoritative check. The proxy only sniffs for a session cookie to bounce
  // signed-out visitors early; this is what actually gates the app shell.
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const t = await getTranslations("nav");
  // The shop's own name, not a translated product name — one value for every
  // account on this install, so Admin and Staff always see the same header.
  const storeName = await getStoreName(user.storeId);

  const navLinks = [
    { href: "/dashboard", label: t("dashboard") },
    { href: "/reports", label: t("reports") },
    { href: "/checklist", label: t("checklist") },
    ...(user.role === "OWNER" ? [{ href: "/import", label: t("import") }] : []),
    { href: "/scan", label: t("scan") },
    ...(user.role === "OWNER"
      ? [
          { href: "/settings/categories", label: t("settings") },
          { href: "/settings/users", label: t("users") },
          { href: "/settings/diagnostics", label: t("diagnostics") },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Row 1 shrinks on mobile — MoreMenu (language/dark) and the user menu
          stay here for desktop; on a phone both live in the "More" sheet on the
          bottom tab bar, which is handed the same role-aware `navLinks` so no
          destination can be desktop-only by omission. */}
      <header className="border-b border-border-1 bg-background">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 md:py-3">
          <Link href="/all" className="shrink-0 text-base font-semibold md:text-lg">
            {storeName}
          </Link>
          <SearchBar />
          <div className="ml-auto flex items-center gap-2">
            <OfflineBanner />
            <CommandPaletteButton />
            <span className="hidden md:contents">
              <UserMenu name={user.name} role={user.role} />
              <MoreMenu />
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-1 px-4 py-2">
          <CategorySwitcher />
          <NavLinks links={navLinks} />
        </div>
      </header>
      <main className="motif-surface flex-1 px-4 py-6 pb-24 md:pb-6">{children}</main>
      <MobileTabBar links={navLinks} user={{ name: user.name, role: user.role }} />
      <CommandPalette />
      <OnboardingTour />
    </div>
  );
}
