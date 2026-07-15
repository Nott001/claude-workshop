import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { DebugMenu } from "@/components/debug-menu";
import "./globals.css";

export const metadata: Metadata = {
  title: "Live Events Platform",
  description: "Role-based platform for live, course-aligned events",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full antialiased">
        <body className="flex min-h-full flex-col">
          {children}
          <DebugMenu />
        </body>
      </html>
    </ClerkProvider>
  );
}
