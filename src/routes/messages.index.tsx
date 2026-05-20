import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import "../styles/dropdigital.css";

type Row = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: "admin" | "moderator" | "user";
};

export const Route = createFileRoute("/messages/")({
  component: MessagesIndex,
});

function MessagesIndex() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [presenceMap, setPresenceMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!loading && !user) { void navigate({ to: "/login" }); return; }
    if (!user) return;
    (async () => {
      const [{ data: profs }, { data: rolesData }, { data: presData }] = await Promise.all([
        supabase.from("profiles").select("id, username, full_name, avatar_url"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("user_presence").select("user_id, is_online, last_seen"),
      ]);
      const rolesMap: Record<string, "admin" | "moderator" | "user"> = {};
      for (const r of (rolesData ?? []) as { user_id: string; role: string }[]) {
        const cur = rolesMap[r.user_id];
        if (r.role === "admin") rolesMap[r.user_id] = "admin";
        else if (r.role === "moderator" && cur !== "admin") rolesMap[r.user_id] = "moderator";
        else if (!cur) rolesMap[r.user_id] = "user";
      }
      const list: Row[] = ((profs ?? []) as Row[])
        .filter((p) => p.id !== user.id)
        .map((p) => ({ ...p, role: rolesMap[p.id] ?? "user" }));
      const order = { admin: 0, moderator: 1, user: 2 } as const;
      list.sort((a, b) => order[a.role] - order[b.role] || (a.full_name || a.username || "").localeCompare(b.full_name || b.username || ""));
      setRows(list);
      const pm: Record<string, boolean> = {};
      const now = Date.now();
      for (const p of (presData ?? []) as { user_id: string; is_online: boolean; last_seen: string | null }[]) {
        pm[p.user_id] = !!(p.is_online && p.last_seen && now - new Date(p.last_seen).getTime() < 2 * 60 * 1000);
      }
      setPresenceMap(pm);
    })();

    const channel = supabase
      .channel("messages_index_presence")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_presence" }, (payload) => {
        const row = payload.new as { user_id: string; is_online: boolean; last_seen: string | null } | undefined;
        if (!row) return;
        const online = !!(row.is_online && row.last_seen && Date.now() - new Date(row.last_seen).getTime() < 2 * 60 * 1000);
        setPresenceMap((prev) => ({ ...prev, [row.user_id]: online }));
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [user, loading, navigate]);

  const filtered = q.trim()
    ? rows.filter((r) => (r.full_name || r.username || "").toLowerCase().includes(q.toLowerCase()))
    : rows;

  return (
    <div style={{ minHeight: "100dvh", background: "oklch(0.129 0.042 264.695)", color: "#f0e8ff" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(15,5,30,0.95)", borderBottom: "1px solid rgba(168,85,247,0.2)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link to="/" style={{ color: "#c4a3f0", fontSize: 13, textDecoration: "none" }}>←</Link>
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, flex: 1 }}>💬 Messages privés</h1>
      </div>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un élève…"
          style={{ width: "100%", background: "rgba(30,15,55,0.8)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 12, padding: "10px 16px", color: "#fff", fontSize: 14, outline: "none", marginBottom: 16 }}
        />
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: "#6b4fa0", padding: 40 }}>Aucun utilisateur.</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((r) => {
            const name = r.full_name || r.username || "Élève";
            const isAdmin = r.role === "admin";
            const isMod = r.role === "moderator";
            const ring = isAdmin
              ? { boxShadow: "0 0 0 3px #ffd700, 0 0 20px rgba(255,215,0,0.55), 0 0 36px rgba(255,200,0,0.4) inset", animation: "goldPulse 2s ease-in-out infinite" }
              : isMod
              ? { boxShadow: "0 0 0 3px #ef4444, 0 0 20px rgba(239,68,68,0.7)", animation: "modRedFlash 1.8s ease-in-out infinite" }
              : { boxShadow: "0 0 0 1px rgba(168,85,247,0.25)" };
            return (
              <Link
                key={r.id}
                to="/messages/$userId"
                params={{ userId: r.id }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "rgba(25,10,48,0.7)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 12, textDecoration: "none", color: "#f0e8ff" }}
              >
                <div style={{ position: "relative", width: 48, height: 48, flexShrink: 0 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", background: "rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center", ...ring }}>
                    {r.avatar_url ? (
                      <img src={r.avatar_url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ color: "#c4a3f0", fontWeight: 700 }}>{name[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <span style={{ position: "absolute", bottom: 1, right: 1, width: 11, height: 11, borderRadius: "50%", background: presenceMap[r.id] ? "#10b981" : "#6b7280", border: "2px solid oklch(0.129 0.042 264.695)", boxShadow: presenceMap[r.id] ? "0 0 6px #10b981" : "none" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                  <div style={{ fontSize: 11, color: isAdmin ? "#ffd700" : isMod ? "#fca5a5" : "#9a7dbd", fontWeight: 600 }}>
                    {isAdmin ? "👑 Admin" : isMod ? "🏴‍☠️ Modérateur" : "Élève"}
                  </div>
                </div>
                <span style={{ color: "#6b4fa0", fontSize: 18 }}>›</span>
              </Link>
            );
          })}
        </div>
      </div>
      <style>{`
        @keyframes goldPulse {
          0%,100% { box-shadow: 0 0 0 3px #ffd700, 0 0 14px rgba(255,215,0,0.5); }
          50%     { box-shadow: 0 0 0 3px #fff4a3, 0 0 28px rgba(255,215,0,0.9), 0 0 40px rgba(255,200,0,0.55); }
        }
      `}</style>
    </div>
  );
}
