import type { Metadata } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import SupabaseProvider from "@/components/providers/SupabaseProvider";
import MobileViewport from "@/components/ui/MobileViewport";
import RouteTransitionIndicator from "@/components/ui/RouteTransitionIndicator";

export const metadata: Metadata = {
  title: {
    default: "WattWise",
    template: "%s | WattWise",
  },
  applicationName: "WattWise",
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
    <html lang="en" data-theme="dark">
      <body suppressHydrationWarning className="antialiased bg-base text-white">
        <SupabaseProvider session={session}>
          <RouteTransitionIndicator />
          <MobileViewport>{children}</MobileViewport>
        </SupabaseProvider>
      </body>
    </html>
  );
}
