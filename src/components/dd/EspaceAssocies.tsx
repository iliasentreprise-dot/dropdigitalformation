import { useEffect, useState, useCallback, type CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";

type ModeEntry = {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  role: string;
  salesId: string | null;
  salesCount: number;
};

type Resource = {
  id: string;
  type: string;
  moderator_id: string | null;
  title: string | null;
  url: string;
};

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getNextWeekStart(): Date {
  const ws = getWeekStart();
  return new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000);
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(d).padStart(2, "0")}:${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function EspaceAssocies({ userId, userRole }: { userId: string; userRole: string }) {
  const isAdmin = userRole === "admin";
  const [subTab, setSubTab] = useState<"classement" | "ressources">("classement");
  const [entries, setEntries] = useState<ModeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(getNextWeekStart().getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const loadClassement = useCallback(async () => {
    setLoading(true);
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["moderator", "admin"]);

    if (!roleRows || roleRows.length === 0) { setEntries([]); setLoading(false); return; }

    const userIds = roleRows.map((r: { user_id: string; role: string }) => r.user_id);
    const weekStart = getWeekStart();

    const [{ data: profiles }, { data: salesRows }] = await Promise.all([
      supabase.from("profiles").select("id, username, avatar_url").in("id", userIds),
      supabase.from("moderator_sales")
        .select("id, moderator_id, sales_count, week_start")
        .in("moderator_id", userIds),
    ]);

    const profileMap = new Map((profiles ?? []).map((p: { id: string; username: string | null; avatar_url: string | null }) => [p.id, p]));
    const weekStartIso = weekStart.toISOString();

    const insertOps: Promise<void>[] = [];
    const result: ModeEntry[] = [];

    for (const { user_id, role } of (roleRows as { user_id: string; role: string }[])) {
      const profile = profileMap.get(user_id);
      const userSales = ((salesRows ?? []) as { id: string; moderator_id: string; sales_count: number; week_start: string }[])
        .filter((s) => s.moderator_id === user_id)
        .sort((a, b) => new Date(b.week_start).getTime() - new Date(a.week_start).getTime());
      const latest = userSales[0];

      let salesId: string | null = null;
      let salesCount = 0;

      if (latest && new Date(latest.week_start) >= weekStart) {
        salesId = latest.id;
        salesCount = latest.sales_count;
      } else {
        // Stale row: insert a new one for current week
        const entry: ModeEntry = { userId: user_id, username: profile?.username ?? null, avatarUrl: profile?.avatar_url ?? null, role, salesId: null, salesCount: 0 };
        result.push(entry);
        insertOps.push(
          supabase.from("moderator_sales")
            .insert({ moderator_id: user_id, sales_count: 0, week_start: weekStartIso })
            .select("id")
            .single()
            .then(({ data }: { data: { id: string } | null }) => {
              if (data) entry.salesId = data.id;
            })
        );
        continue;
      }

      result.push({ userId: user_id, username: profile?.username ?? null, avatarUrl: profile?.avatar_url ?? null, role, salesId, salesCount });
    }

    setEntries([...result].sort((a, b) => b.salesCount - a.salesCount));
    setLoading(false);
    if (insertOps.length) await Promise.all(insertOps);
  }, []);

  const loadResources = useCallback(async () => {
    const { data } = await supabase
      .from("moderator_resources")
      .select("id, type, moderator_id, title, url");
    setResources((data as Resource[]) ?? []);
  }, []);

  useEffect(() => {
    void loadClassement();
    void loadResources();

    const channel = supabase.channel("moderator_sales_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "moderator_sales" }, (payload) => {
        if (payload.eventType === "UPDATE") {
          const u = payload.new as { id: string; moderator_id: string; sales_count: number };
          setEntries((prev) =>
            [...prev.map((e) => e.userId === u.moderator_id ? { ...e, salesId: u.id, salesCount: u.sales_count } : e)]
              .sort((a, b) => b.salesCount - a.salesCount)
          );
        } else {
          void loadClassement();
        }
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [loadClassement, loadResources]);

  const updateSales = async (entry: ModeEntry, newCount: number) => {
    if (newCount < 0) newCount = 0;
    if (!entry.salesId) {
      const { data } = await supabase
        .from("moderator_sales")
        .insert({ moderator_id: entry.userId, sales_count: newCount, week_start: getWeekStart().toISOString() })
        .select("id")
        .single();
      setEntries((prev) =>
        [...prev.map((e) => e.userId === entry.userId ? { ...e, salesId: (data as { id: string } | null)?.id ?? null, salesCount: newCount } : e)]
          .sort((a, b) => b.salesCount - a.salesCount)
      );
    } else {
      await supabase.from("moderator_sales").update({ sales_count: newCount, updated_at: new Date().toISOString() }).eq("id", entry.salesId);
      setEntries((prev) =>
        [...prev.map((e) => e.userId === entry.userId ? { ...e, salesCount: newCount } : e)]
          .sort((a, b) => b.salesCount - a.salesCount)
      );
    }
  };

  const canEdit = (entry: ModeEntry) => isAdmin || entry.userId === userId;

  const tiktokLives = resources.filter((r) => r.type === "tiktok_live" && r.moderator_id === null);
  const miroLink = resources.find((r) => r.type === "miro" && r.moderator_id === userId);
  const tunnelLink = resources.find((r) => r.type === "tunnel" && r.moderator_id === userId);

  const copyLink = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 20px",
    borderRadius: 10,
    border: `1px solid ${active ? "rgba(168,85,247,0.6)" : "rgba(255,255,255,0.1)"}`,
    background: active ? "rgba(168,85,247,0.2)" : "transparent",
    color: active ? "#e0d0ff" : "#9a7dbd",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  });

  return (
    <div>
      <div className="section-header">
        <h1>🤝 Espace Associés</h1>
        <p>Espace réservé aux modérateurs et à l'équipe.</p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        <button style={btnStyle(subTab === "classement")} onClick={() => setSubTab("classement")}>🏆 Classement</button>
        <button style={btnStyle(subTab === "ressources")} onClick={() => setSubTab("ressources")}>📦 Ressources</button>
      </div>

      {subTab === "classement" && (
        <div>
          <div style={{ marginBottom: 28, textAlign: "center" }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: "#e2d4f8", marginBottom: 6 }}>
              🏆 Classement Vendeurs — <span style={{ color: "#10b981" }}>Bonus 200€</span> pour le meilleur de la semaine
            </div>
            <div style={{ fontSize: 12, color: "#7c5c9a", marginBottom: 10 }}>Reset dimanche soir 00h00</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#a855f7", fontVariantNumeric: "tabular-nums", letterSpacing: 3, fontFamily: "monospace" }}>
              {countdown}
            </div>
            <div style={{ fontSize: 11, color: "#7c5c9a", marginTop: 4, letterSpacing: 2 }}>JJ : HH : MM : SS</div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", color: "#9a7dbd", padding: 40 }}>Chargement…</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {entries.map((entry, idx) => (
                <div key={entry.userId} style={{ display: "flex", alignItems: "center", gap: 14, background: idx === 0 ? "rgba(168,85,247,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${idx === 0 ? "rgba(168,85,247,0.35)" : "rgba(255,255,255,0.07)"}`, borderRadius: 14, padding: "14px 18px" }}>
                  <div style={{ fontSize: idx < 3 ? 22 : 15, fontWeight: 900, color: idx === 0 ? "#ffd700" : idx === 1 ? "#c0c0c0" : idx === 2 ? "#cd7f32" : "#7c5c9a", minWidth: 36, textAlign: "center" }}>
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                  </div>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", border: "2.5px solid #ef4444", boxShadow: "0 0 10px #ef4444, 0 0 20px rgba(239,68,68,0.35)", flexShrink: 0, overflow: "hidden", background: "#1e1132", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {entry.avatarUrl
                      ? <img src={entry.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 18, color: "#c4a3f0" }}>{(entry.username ?? "?")[0]?.toUpperCase()}</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "#e2d4f8", fontSize: 15, marginBottom: 3 }}>{entry.username ?? "Anonyme"}</div>
                    <span style={{ fontSize: 11, background: entry.role === "admin" ? "rgba(255,215,0,0.12)" : "rgba(239,68,68,0.12)", color: entry.role === "admin" ? "#ffd700" : "#fca5a5", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                      {entry.role === "admin" ? "👑 Admin" : "🏴‍☠️ Modérateur"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {canEdit(entry) ? (
                      <>
                        <button
                          onClick={() => void updateSales(entry, entry.salesCount - 1)}
                          style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)", color: "#fca5a5", fontSize: 20, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                        >−</button>
                        <input
                          type="number"
                          min={0}
                          value={entry.salesCount}
                          onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 0) void updateSales(entry, v); }}
                          style={{ width: 54, textAlign: "center", background: "rgba(15,5,30,0.8)", border: "1px solid rgba(168,85,247,0.4)", borderRadius: 8, color: "#e2d4f8", fontSize: 20, fontWeight: 900, padding: "4px 0", MozAppearance: "textfield" } as CSSProperties}
                        />
                        <button
                          onClick={() => void updateSales(entry, entry.salesCount + 1)}
                          style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)", color: "#10b981", fontSize: 20, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                        >+</button>
                      </>
                    ) : (
                      <div style={{ fontSize: 26, fontWeight: 900, color: "#a855f7", minWidth: 52, textAlign: "center" }}>{entry.salesCount}</div>
                    )}
                    <div style={{ fontSize: 11, color: "#7c5c9a" }}>ventes</div>
                  </div>
                </div>
              ))}
              {entries.length === 0 && <div style={{ textAlign: "center", color: "#9a7dbd", padding: 40 }}>Aucun modérateur trouvé.</div>}
            </div>
          )}
        </div>
      )}

      {subTab === "ressources" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {/* TikTok Live */}
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#e2d4f8", marginBottom: 14 }}>📱 Rediffusions TikTok Live</div>
            {tiktokLives.length === 0 ? (
              <div style={{ color: "#7c5c9a", fontSize: 14, fontStyle: "italic" }}>Aucune rediffusion disponible pour l'instant.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {tiktokLives.map((r) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 16px", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, fontWeight: 600, color: "#e2d4f8", fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title ?? r.url}</div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button onClick={() => void copyLink(r.url, r.id)} style={{ background: copiedId === r.id ? "rgba(16,185,129,0.2)" : "rgba(168,85,247,0.12)", border: `1px solid ${copiedId === r.id ? "rgba(16,185,129,0.4)" : "rgba(168,85,247,0.3)"}`, color: copiedId === r.id ? "#10b981" : "#a855f7", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        {copiedId === r.id ? "✓ Copié" : "Copier"}
                      </button>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)", color: "#a855f7", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                        Ouvrir
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Miro */}
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#e2d4f8", marginBottom: 14 }}>🖼️ Lien Miro personnalisé</div>
            {miroLink ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 16px", flexWrap: "wrap" }}>
                <div style={{ flex: 1, fontWeight: 600, color: "#e2d4f8", fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{miroLink.title ?? miroLink.url}</div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => void copyLink(miroLink.url, miroLink.id)} style={{ background: copiedId === miroLink.id ? "rgba(16,185,129,0.2)" : "rgba(168,85,247,0.12)", border: `1px solid ${copiedId === miroLink.id ? "rgba(16,185,129,0.4)" : "rgba(168,85,247,0.3)"}`, color: copiedId === miroLink.id ? "#10b981" : "#a855f7", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {copiedId === miroLink.id ? "✓ Copié" : "Copier le lien"}
                  </button>
                  <a href={miroLink.url} target="_blank" rel="noopener noreferrer" style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)", color: "#a855f7", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Ouvrir</a>
                </div>
              </div>
            ) : (
              <div style={{ color: "#7c5c9a", fontSize: 14, fontStyle: "italic" }}>Lien Miro non encore assigné — contacte l'admin.</div>
            )}
          </div>

          {/* Tunnel de vente */}
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#e2d4f8", marginBottom: 14 }}>🔗 Tunnel de vente personnalisé</div>
            {tunnelLink ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 16px", flexWrap: "wrap" }}>
                <div style={{ flex: 1, fontWeight: 600, color: "#e2d4f8", fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tunnelLink.title ?? tunnelLink.url}</div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => void copyLink(tunnelLink.url, tunnelLink.id)} style={{ background: copiedId === tunnelLink.id ? "rgba(16,185,129,0.2)" : "rgba(168,85,247,0.12)", border: `1px solid ${copiedId === tunnelLink.id ? "rgba(16,185,129,0.4)" : "rgba(168,85,247,0.3)"}`, color: copiedId === tunnelLink.id ? "#10b981" : "#a855f7", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {copiedId === tunnelLink.id ? "✓ Copié" : "Copier le lien"}
                  </button>
                  <a href={tunnelLink.url} target="_blank" rel="noopener noreferrer" style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)", color: "#a855f7", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Ouvrir</a>
                </div>
              </div>
            ) : (
              <div style={{ color: "#7c5c9a", fontSize: 14, fontStyle: "italic" }}>Tunnel de vente non encore assigné — contacte l'admin.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
