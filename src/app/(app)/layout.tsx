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

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("nav");
  const common = await getTranslations("common");

  const navLinks = [
    { href: "/dashboard", label: t("dashboard") },
    { href: "/reports", label: t("reports") },
    { href: "/checklist", label: t("checklist") },
    { href: "/scan", label: t("scan") },
    { href: "/settings/categories", label: t("settings") },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Row 1 shrinks on mobile — MoreMenu (language/booth/dark) stays here
          for desktop, since the mobile "More" sheet lives in the bottom tab
          bar instead. Row 2's link list is desktop-only for the same reason:
          those five destinations already have thumb-zone equivalents below. */}
      <header className="border-b border-border-1 bg-background">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 md:py-3">
          <Link href="/all" className="shrink-0 text-base font-semibold md:text-lg">
            {common("appName")}
          </Link>
          <SearchBar />
          <div className="ml-auto flex items-center gap-2">
            <OfflineBanner />
            <CommandPaletteButton />
            <span className="hidden md:contents">
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
      <MobileTabBar />
      <CommandPalette />
      <OnboardingTour />
    </div>
  );
}
