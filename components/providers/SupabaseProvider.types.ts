import type { Session } from "@supabase/supabase-js";
import type { ReactNode } from "react";

export type SupabaseProviderProps = {
  children: ReactNode;
  session: Session | null;
};
