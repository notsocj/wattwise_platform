import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getHomePathForRole } from "@/lib/roles";

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

  // Admin routes — require super_admin role
  if (pathname.startsWith("/admin") && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "super_admin") {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith("/manager") && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "manager") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = getHomePathForRole(profile?.role);
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (user && !pathname.startsWith("/update-password")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, must_update_password")
      .eq("id", user.id)
      .single();

    if (profile?.role === "tenant" && profile.must_update_password === true) {
      const updateUrl = request.nextUrl.clone();
      updateUrl.pathname = "/update-password";
      return NextResponse.redirect(updateUrl);
    }
  }

  // Auth routes — redirect authenticated users away from login/register
  const authRoutes = ["/login", "/register", "/onboarding"];
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (isAuthRoute && user) {
    // Route users by role after sign-in.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, must_update_password")
      .eq("id", user.id)
      .single();

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname =
      profile?.role === "tenant" && profile.must_update_password === true
        ? "/update-password"
        : getHomePathForRole(profile?.role);
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
