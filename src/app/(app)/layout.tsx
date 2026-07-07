import Link from "next/link";
import { CategorySwitcher } from "@/components/CategorySwitcher";
import { SearchBar } from "@/components/SearchBar";
import { OfflineBanner } from "@/components/OfflineBanner";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { BoothModeToggle } from "@/components/BoothModeToggle";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/reports", label: "Reports" },
  { href: "/checklist", label: "Checklist" },
  { href: "/scan", label: "Scan" },
  { href: "/settings/categories", label: "Settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border-1 bg-background">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/all" className="shrink-0 text-lg font-semibold">
            Booth Cards
          </Link>
          <SearchBar />
          <div className="ml-auto flex items-center gap-2">
            <OfflineBanner />
            <BoothModeToggle />
            <DarkModeToggle />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-1 px-4 py-2">
          <CategorySwitcher />
          <nav className="flex gap-1 overflow-x-auto text-sm" aria-label="App navigation">
            {NAV_LINKS.map((link) => (
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
    </div>
  );
}
