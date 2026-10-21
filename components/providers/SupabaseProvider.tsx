"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { type Session, type User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type SupabaseContextType = {
  user: User | null;
  session: Session | null;
};

const SupabaseContext = createContext<SupabaseContextType>({
  user: null,
  session: null,
});

export function useSupabase() {
  return useContext(SupabaseContext);
}

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();

  useEffect(() => {
    // Fires INITIAL_SESSION immediately with the stored session, then on
    // every sign-in, sign-out, and token refresh.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <SupabaseContext.Provider value={{ user, session }}>
      {children}
    </SupabaseContext.Provider>
  );
}
