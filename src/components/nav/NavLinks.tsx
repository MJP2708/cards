"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname() ?? "/";

  return (
    <nav className="hidden gap-1 overflow-x-auto text-sm md:flex" aria-label="App navigation">
      {links.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-md px-2.5 py-1.5 ${
              active ? "bg-[var(--accent-tint-strong)] font-medium text-accent-dark" : "text-foreground/70 hover:bg-surface-1 hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
