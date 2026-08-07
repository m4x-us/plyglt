// ============================================================
// layout.tsx — Root Next.js layout: fonts, metadata, and global providers
// ============================================================
import type { Metadata } from "next";
import { Suspense } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ACTIVE_LANGUAGE } from "@/lib/language";
import { InterruptHandler } from "@/components/InterruptHandler";
import { EntitlementValidator } from "@/components/EntitlementValidator";
import { AuthSessionListener } from "@/components/AuthSessionListener";

export const metadata: Metadata = {
  title: ACTIVE_LANGUAGE.uiStrings.appTitle,
  description: ACTIVE_LANGUAGE.uiStrings.appSubtitle,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
          <Suspense fallback={null}>
            <InterruptHandler />
          </Suspense>
          <EntitlementValidator />
          <AuthSessionListener />
          {children}
        </body>
    </html>
  );
}
