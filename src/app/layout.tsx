import { SessionProvider } from "@/modules/auth/components/session-context";
import type { Metadata } from "next";
import { AppShell } from "@/shared/components/app-shell";
import "./fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "StartupLab Business Center",
  description: "AI-driven innovation and education for business leaders.",
  // The icons live in public/ so the ASSETS binding serves them without waking
  // the Worker. That puts them outside the src/app/ convention, so the link
  // tags Next would have generated have to be declared here instead — without
  // this block nothing references icon.svg and browsers fall back to the .ico.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
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
