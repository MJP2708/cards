import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CategorySwitcher } from "@/components/CategorySwitcher";
import { SearchBar } from "@/components/SearchBar";
import { OfflineBanner } from "@/components/OfflineBanner";
import { CommandPalette } from "@/components/CommandPalette";
import { CommandPaletteButton } from "@/components/CommandPaletteButton";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { MoreMenu } from "@/components/MoreMenu";

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
      <header className="border-b border-border-1 bg-background">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/all" className="shrink-0 text-lg font-semibold">
            {common("appName")}
          </Link>
          <SearchBar />
          <div className="ml-auto flex items-center gap-2">
            <OfflineBanner />
            <CommandPaletteButton />
            <MoreMenu />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-1 px-4 py-2">
          <CategorySwitcher />
          <nav className="flex gap-1 overflow-x-auto text-sm" aria-label="App navigation">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-foreground/70 hover:bg-surface-1 hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="motif-surface flex-1 px-4 py-6">{children}</main>
      <CommandPalette />
      <OnboardingTour />
    </div>
  );
}
