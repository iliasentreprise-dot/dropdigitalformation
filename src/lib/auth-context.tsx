import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Set up listener FIRST (per security guidance)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      setLoading(false);
    });

    // 2. THEN check existing session
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sa = supabase as any;
    const goOnline = () =>
      sa.from("user_presence").upsert(
        { user_id: uid, last_seen: new Date().toISOString(), is_online: true },
        { onConflict: "user_id" }
      );
    const goOffline = () =>
      sa.from("user_presence").update({ is_online: false }).eq("user_id", uid);

    void goOnline();
    const interval = window.setInterval(() => void goOnline(), 30000);

    const onVisibility = () => {
      if (document.hidden) void goOffline();
      else void goOnline();
    };
    const onUnload = () => void goOffline();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
      void goOffline();
    };
  }, [user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
