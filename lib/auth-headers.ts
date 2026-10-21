// Request headers the middleware sets after verifying the session (see
// lib/supabase/middleware.ts) and lib/auth-context.ts reads. The middleware
// deletes any client-supplied copies before setting them.
export const USER_ID_HEADER = "x-wattwise-user-id";
export const USER_EMAIL_HEADER = "x-wattwise-user-email";
export const USER_ROLE_HEADER = "x-wattwise-user-role";
export const USER_BILLING_DAY_HEADER = "x-wattwise-billing-day";
export const FORWARDED_IDENTITY_HEADERS = [
  USER_ID_HEADER,
  USER_EMAIL_HEADER,
  USER_ROLE_HEADER,
  USER_BILLING_DAY_HEADER,
];
