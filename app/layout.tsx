import type { Metadata } from "next";
import { Suspense } from "react";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import SupabaseProvider from "@/components/providers/SupabaseProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import AppFrame from "@/components/ui/AppFrame";
import RouteTransitionIndicator from "@/components/ui/RouteTransitionIndicator";
import OneSignalIdentityBridge from "@/components/providers/OneSignalIdentityBridge";

// Self-hosted at build time as one variable woff2, preloaded, with a
// size-adjusted fallback so text doesn't jump when it loads.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

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

const THEME_BOOT_SCRIPT =
  "try{var t=localStorage.getItem('wattwise-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}";

// No cookies are read here, so pages that don't read them (login, register,
// onboarding, ...) can be served statically. The session is read in the
// browser by SupabaseProvider.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The inline script applies the saved theme before first paint (no dark
    // flash for light-mode users); it may change data-theme before hydration.
    <html lang="en" data-theme="dark" className={spaceGrotesk.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning className="antialiased bg-canvas text-fg">
        <SupabaseProvider>
          <OneSignalIdentityBridge
            appId={process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? null}
          />
          <ThemeProvider>
            {/* Reads search params; Suspense keeps the rest of the page static. */}
            <Suspense fallback={null}>
              <RouteTransitionIndicator />
            </Suspense>
            <AppFrame>{children}</AppFrame>
          </ThemeProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
