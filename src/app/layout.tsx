import { SessionProvider } from "@/modules/auth";
import type { Metadata } from "next";
import { AppShell } from "@/shared/components/app-shell";
import { configureEmailService } from "@/shared/integrations/email";
import { ConsoleEmailProvider } from "@/shared/integrations/email/providers/console";
import "./fonts.css";
import "./globals.css";

configureEmailService(new ConsoleEmailProvider());

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
