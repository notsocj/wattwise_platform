import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  USER_BILLING_DAY_HEADER,
  USER_EMAIL_HEADER,
  USER_ID_HEADER,
  USER_ROLE_HEADER,
} from "@/lib/auth-headers";


export type SessionUser = {
  id: string;
  email: string | null;
  /** profiles.role as read by the middleware; null when unknown. */
  role: string | null;
  /**
   * The user's own profiles.billing_cycle_start_day as read by the middleware,
   * so pages can start billing-cycle queries before their profile read
   * returns. Null when unknown. Tenants bill on their owner's day instead.
   */
  billingCycleStartDay: number | null;
};

/**
 * The signed-in user for this request, resolved once per request.
 * Falls back to Supabase Auth when the middleware did not run.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const requestHeaders = await headers();
  const id = requestHeaders.get(USER_ID_HEADER);
  if (id) {
    const billingDay = Number(requestHeaders.get(USER_BILLING_DAY_HEADER));
    return {
      id,
      email: requestHeaders.get(USER_EMAIL_HEADER) || null,
      role: requestHeaders.get(USER_ROLE_HEADER) || null,
      billingCycleStartDay: Number.isInteger(billingDay) && billingDay >= 1 ? billingDay : null,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user
    ? { id: user.id, email: user.email ?? null, role: null, billingCycleStartDay: null }
    : null;
});
