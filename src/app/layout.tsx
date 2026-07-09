import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Oswald, Barlow_Condensed, Baloo_2, Cinzel, Kanit, Chakra_Petch, Noto_Sans_Thai } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ThemeEffect } from "@/components/providers/ThemeEffect";
import { SyncManagerMount } from "@/components/providers/SyncManagerMount";
import { ServiceWorkerRegister } from "@/components/providers/ServiceWorkerRegister";
import { Toaster } from "sonner";
import { MotionConfig } from "@/components/ui/MotionConfig";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display fonts for category headers only — all four preloaded once here, then
// ThemeEffect switches which one `--font-display` points at per active category.
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"], weight: ["500", "600", "700"] });
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
const baloo2 = Baloo_2({ variable: "--font-baloo2", subsets: ["latin"], weight: ["600", "700", "800"] });
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["500", "600"] });

// Thai equivalents — none of the four Latin display fonts above have Thai
// glyphs at all, so Thai headers would silently fall back to a generic system
// font without these. Kanit stands in for Oswald (NBA), Chakra Petch for
// Barlow Condensed (Football); Noto Sans Thai is the body font in Thai mode
// (Geist Sans has no Thai coverage either).
const kanit = Kanit({ variable: "--font-kanit", subsets: ["thai", "latin"], weight: ["600", "700", "800"] });
const chakraPetch = Chakra_Petch({ variable: "--font-chakra-petch", subsets: ["thai", "latin"], weight: ["600", "700"] });
const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Booth Cards — Convention Inventory & Sales",
  description: "Multi-category trading card inventory, research, and sales tracker",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#64748b",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      data-locale={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${oswald.variable} ${barlowCondensed.variable} ${baloo2.variable} ${cinzel.variable} ${kanit.variable} ${chakraPetch.variable} ${notoSansThai.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryProvider>
            <MotionConfig>
              <ThemeEffect />
              <SyncManagerMount />
              <ServiceWorkerRegister />
              {children}
              <Toaster richColors position="bottom-right" />
            </MotionConfig>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
