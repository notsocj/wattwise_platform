import type { Metadata } from "next";
import { AppProviders } from "@/components/providers/AppProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wattwise Platform",
  description: "Energy monitoring, insights, and controls for the Wattwise platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[var(--color-surface)] text-[var(--color-ink)] antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
