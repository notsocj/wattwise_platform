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

  // Refresh session — do not add logic between createServerClient and getUser
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // One profile read per request serves every role check below and is
  // forwarded to the page, which then skips its own auth round trip.
  type MiddlewareProfile = {
    role: string | null;
    must_update_password: boolean | null;
    billing_cycle_start_day: number | null;
  };
  let profile: MiddlewareProfile | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("role, must_update_password, billing_cycle_start_day")
      .eq("id", user.id)
      .maybeSingle<MiddlewareProfile>();
    profile = data;
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

