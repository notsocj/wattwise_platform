import type { Session, User } from "@supabase/supabase-js";
import type { ReactNode } from "react";

export type SupabaseContextType = {
  user: User | null;
  session: Session | null;
};

export type SupabaseProviderProps = {
  children: ReactNode;
  session: Session | null;
};
