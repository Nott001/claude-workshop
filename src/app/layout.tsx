import { SessionProvider } from "@/modules/auth";
import type { Metadata } from "next";
import { AppShell } from "@/shared/components/app-shell";
import "./fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "StartupLab Business Center",
  description: "AI-driven innovation and education for business leaders.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <SessionProvider>
          <AppShell>{children}</AppShell>
        </SessionProvider>
      </body>
    </html>
  );
}
