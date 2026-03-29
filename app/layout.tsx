import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import SupabaseProvider from "@/components/providers/SupabaseProvider";
import MobileViewport from "@/components/ui/MobileViewport";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wattwise",
  description: "Smart Energy. Real Savings.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return (
    <html lang="en">
      <body suppressHydrationWarning className={`${spaceGrotesk.variable} antialiased bg-base text-white`}>
        <SupabaseProvider session={session}>
          <MobileViewport>{children}</MobileViewport>
        </SupabaseProvider>
      </body>
    </html>
  );
}
