import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export function GlobalProgressBar() {
  const { user } = useAuth();
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (!user) {
      setPct(0);
      return;
    }
    let alive = true;

    const refresh = async () => {
      const [{ count: totalCh }, { count: doneCh }] = await Promise.all([
        supabase.from("chapters").select("id", { count: "exact", head: true }),
        supabase
          .from("user_chapter_progress")
          .select("chapter_id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);
      if (!alive) return;
      const total = totalCh ?? 0;
      const done = doneCh ?? 0;
      setPct(total > 0 ? Math.round((done / total) * 100) : 0);
    };

    void refresh();
    const handler = () => void refresh();
    window.addEventListener("dd-progress-changed", handler);
    return () => {
      alive = false;
      window.removeEventListener("dd-progress-changed", handler);
    };
  }, [user]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: "rgba(0,0,0,0.15)",
        zIndex: 1000,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: "linear-gradient(90deg, #7c3aed, #a855f7)",
          transition: "width 0.5s ease",
        }}
      />
    </div>
  );
}

export function notifyProgressChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("dd-progress-changed"));
  }
}
