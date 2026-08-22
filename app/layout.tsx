import type { Metadata } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import SupabaseProvider from "@/components/providers/SupabaseProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import MobileViewport from "@/components/ui/MobileViewport";
import RouteTransitionIndicator from "@/components/ui/RouteTransitionIndicator";
import OneSignalIdentityBridge from "@/components/providers/OneSignalIdentityBridge";

export const metadata: Metadata = {
  title: {
    default: "WattWise",
    template: "%s | WattWise",
  },
  applicationName: "WattWise",
  description: "Smart Energy. Real Savings.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
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
          <OneSignalIdentityBridge
            appId={process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? null}
          />
          <ThemeProvider>
            <RouteTransitionIndicator />
            <MobileViewport>{children}</MobileViewport>
          </ThemeProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
