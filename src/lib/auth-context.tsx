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

    const updatePresence = async () => {
      try {
        await supabase.from("user_presence").upsert(
          { user_id: uid, last_seen: new Date().toISOString(), is_online: true },
          { onConflict: "user_id" }
        );
        console.log("[presence] heartbeat ok", uid);
      } catch (e) {
        console.error("[presence] heartbeat error", e);
      }
    };

    void updatePresence();
    const interval = setInterval(() => void updatePresence(), 20000);

    const onBeforeUnload = () => {
      supabase.from("user_presence").update({ is_online: false }).eq("user_id", uid);
    };

    const onVisibility = () => {
      if (document.hidden) {
        supabase.from("user_presence").update({ is_online: false, last_seen: new Date().toISOString() }).eq("user_id", uid);
      } else {
        void updatePresence();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
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
