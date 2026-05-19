import type { Session, User } from "@supabase/supabase-js";

export type SupabaseContextType = {
  user: User | null;
  session: Session | null;
};
