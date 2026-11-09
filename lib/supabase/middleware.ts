import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getHomePathForRole } from "@/lib/roles";
import {
  FORWARDED_IDENTITY_HEADERS,
  USER_BILLING_DAY_HEADER,
  USER_EMAIL_HEADER,
  USER_ID_HEADER,
  USER_ROLE_HEADER,
} from "@/lib/auth-headers";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — do not add logic between createServerClient and getClaims.
  // getClaims verifies the ES256 access token locally against Supabase's cached
  // signing keys (refreshing an expired token first), so the request no longer
  // waits on an Auth server round trip the way getUser did.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  let user: { id: string; email: string | null } | null =
    typeof claims?.sub === "string"
      ? { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null }
      : null;

  // One round trip (migration 045) returns the profile fields every role check
  // below needs, forwarded to the page so it skips its own auth round trip, and
  // whether this session still exists. A signed-out session ("log out of all
  // devices") or a disabled account is treated as signed out immediately, even
  // though its token has not expired yet.
  type MiddlewareProfile = {
    role: string | null;
    must_update_password: boolean | null;
    billing_cycle_start_day: number | null;
    disabled_at: string | null;
    session_active: boolean;
  };
  let profile: MiddlewareProfile | null = null;
  if (user) {
    const { data, error } = await supabase.rpc("middleware_session_profile").maybeSingle<MiddlewareProfile>();
    profile = error ? null : data;
    if (!error && data && (!data.session_active || data.disabled_at)) {
      user = null;
      profile = null;
    }
  }

  // Protected routes — redirect unauthenticated users to login
  const protectedRoutes = [
    "/dashboard",
    "/analytics",
    "/settings",
    "/admin",
    "/manager",
    "/update-password",
  ];
  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes — require super_admin role
  if (pathname.startsWith("/admin") && user && profile?.role !== "super_admin") {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/manager") && user && profile?.role !== "manager") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = getHomePathForRole(profile?.role);
    return NextResponse.redirect(redirectUrl);
  }

  const mustUpdatePassword =
    profile?.role === "tenant" && profile.must_update_password === true;

  if (user && mustUpdatePassword && !pathname.startsWith("/update-password")) {
    const updateUrl = request.nextUrl.clone();
    updateUrl.pathname = "/update-password";
    return NextResponse.redirect(updateUrl);
  }

  // Auth routes — redirect authenticated users away from login/register
  const authRoutes = ["/login", "/register", "/onboarding"];
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (isAuthRoute && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = mustUpdatePassword
      ? "/update-password"
      : getHomePathForRole(profile?.role);
    return NextResponse.redirect(redirectUrl);
  }

  // Forward the verified identity to server components and route handlers.
  // Always drop client-supplied copies so they cannot be spoofed.
  const requestHeaders = new Headers(request.headers);
  for (const header of FORWARDED_IDENTITY_HEADERS) {
    requestHeaders.delete(header);
  }
  if (user) {
    requestHeaders.set(USER_ID_HEADER, user.id);
    if (user.email) requestHeaders.set(USER_EMAIL_HEADER, user.email);
    if (profile?.role) requestHeaders.set(USER_ROLE_HEADER, profile.role);
    if (profile?.billing_cycle_start_day) {
      requestHeaders.set(USER_BILLING_DAY_HEADER, String(profile.billing_cycle_start_day));
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // Keep any refreshed session cookies Supabase set above.
  for (const cookie of supabaseResponse.cookies.getAll()) {
    response.cookies.set(cookie);
  }
  return response;
}

