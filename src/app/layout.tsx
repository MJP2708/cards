import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ThemeEffect } from "@/components/providers/ThemeEffect";
import { SyncManagerMount } from "@/components/providers/SyncManagerMount";
import { ServiceWorkerRegister } from "@/components/providers/ServiceWorkerRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Booth Cards — Convention Inventory & Sales",
  description: "Multi-category trading card inventory, research, and sales tracker",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#64748b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <ThemeEffect />
          <SyncManagerMount />
          <ServiceWorkerRegister />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
