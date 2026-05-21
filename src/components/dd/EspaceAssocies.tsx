import { useEffect, useState, useCallback, type CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";

type ModeEntry = {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  role: string;
  salesId: string | null;
  salesCount: number;
  totalSales: number;
  weeklyRevenue: number;
  totalRevenue: number;
};

type Resource = {
  id: string;
  type: string;
  moderator_id: string | null;
  title: string | null;
  url: string;
};

type KnownModerator = { userId: string; username: string | null; avatarUrl: string | null; role: string };

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getNextWeekStart(): Date {
  return new Date(getWeekStart().getTime() + 7 * 24 * 60 * 60 * 1000);
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

const RED = "#ef4444";

export function EspaceAssocies({ userId, userRole }: { userId: string; userRole: string }) {
  const isAdmin = userRole === "admin";
  const [subTab, setSubTab] = useState<"classement" | "ressources">("classement");
  const [entries, setEntries] = useState<ModeEntry[]>([]);
  const [totalEntries, setTotalEntries] = useState<ModeEntry[]>([]);
  const [allModerators, setAllModerators] = useState<KnownModerator[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openResource, setOpenResource] = useState<"tiktok" | "miro" | "tunnel" | null>(null);
  const [addModoSel, setAddModoSel] = useState("");
  const [adding, setAdding] = useState(false);

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

    if (!roleRows || roleRows.length === 0) { setEntries([]); setTotalEntries([]); setAllModerators([]); setLoading(false); return; }

    const userIds = (roleRows as { user_id: string; role: string }[]).map((r) => r.user_id);
    const weekStart = getWeekStart();

    const [{ data: profiles }, { data: salesRows }] = await Promise.all([
      supabase.from("profiles").select("id, username, avatar_url").in("id", userIds),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("moderator_sales")
        .select("id, moderator_id, sales_count, week_start, total_sales, weekly_revenue, total_revenue")
        .in("moderator_id", userIds),
    ]);

    const profileMap = new Map((profiles ?? []).map((p: { id: string; username: string | null; avatar_url: string | null }) => [p.id, p]));
    const allMods: KnownModerator[] = (roleRows as { user_id: string; role: string }[]).map(({ user_id, role }) => {
      const p = profileMap.get(user_id);
      return { userId: user_id, username: p?.username ?? null, avatarUrl: p?.avatar_url ?? null, role };
    });
    setAllModerators(allMods);

    type SalesRow = { id: string; moderator_id: string; sales_count: number; week_start: string; total_sales: number; weekly_revenue: number; total_revenue: number };
    const allRows = ((salesRows ?? []) as SalesRow[]);

    // Compute cumulative totals per moderator: max total_sales and total_revenue across all their rows
    const totalPerMod: Record<string, { total: number; totalRevenue: number }> = {};
    for (const r of allRows) {
      const ex = totalPerMod[r.moderator_id];
      if (!ex || (r.total_sales ?? 0) > ex.total) {
        totalPerMod[r.moderator_id] = { total: r.total_sales ?? 0, totalRevenue: r.total_revenue ?? 0 };
      }
    }

    const currentEntries: ModeEntry[] = [];
    const allEntries: ModeEntry[] = [];

    for (const { user_id, role } of (roleRows as { user_id: string; role: string }[])) {
      const profile = profileMap.get(user_id);
      const tot = totalPerMod[user_id] ?? { total: 0, totalRevenue: 0 };
      const weekRows = allRows.filter((s) => s.moderator_id === user_id && new Date(s.week_start) >= weekStart);
      const latest = weekRows[0];
      const entry: ModeEntry = {
        userId: user_id,
        username: profile?.username ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        role,
        salesId: latest?.id ?? null,
        salesCount: latest?.sales_count ?? 0,
        totalSales: tot.total,
        weeklyRevenue: latest?.weekly_revenue ?? 0,
        totalRevenue: tot.totalRevenue,
      };
      if (weekRows.length > 0) currentEntries.push(entry);
      allEntries.push(entry);
    }

    setEntries([...currentEntries].sort((a, b) => b.salesCount - a.salesCount));
    setTotalEntries([...allEntries].sort((a, b) => b.totalSales - a.totalSales));
    setLoading(false);
  }, []);

  const loadResources = useCallback(async () => {
    const { data } = await supabase.from("moderator_resources").select("id, type, moderator_id, title, url");
    setResources((data as Resource[]) ?? []);
  }, []);

  useEffect(() => {
    void loadClassement();
    void loadResources();

    const channel = supabase.channel("ea_sales_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "moderator_sales" }, (payload) => {
        if (payload.eventType === "UPDATE") {
          const u = payload.new as { id: string; moderator_id: string; sales_count: number; weekly_revenue: number; total_revenue: number; total_sales: number };
          setEntries((prev) =>
            [...prev.map((e) => e.userId === u.moderator_id ? { ...e, salesId: u.id, salesCount: u.sales_count, weeklyRevenue: u.weekly_revenue ?? 0 } : e)]
              .sort((a, b) => b.salesCount - a.salesCount)
          );
          setTotalEntries((prev) =>
            [...prev.map((e) => e.userId === u.moderator_id ? { ...e, totalSales: u.total_sales ?? e.totalSales, totalRevenue: u.total_revenue ?? 0 } : e)]
              .sort((a, b) => b.totalSales - a.totalSales)
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
    if (!entry.salesId) return;
    const delta = newCount - entry.salesCount;
    const newTotal = Math.max(0, entry.totalSales + delta);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("moderator_sales").update({ sales_count: newCount, total_sales: newTotal, updated_at: new Date().toISOString() }).eq("id", entry.salesId);
    setEntries((prev) =>
      [...prev.map((e) => e.userId === entry.userId ? { ...e, salesCount: newCount, totalSales: newTotal } : e)]
        .sort((a, b) => b.salesCount - a.salesCount)
    );
    setTotalEntries((prev) =>
      [...prev.map((e) => e.userId === entry.userId ? { ...e, salesCount: newCount, totalSales: newTotal } : e)]
        .sort((a, b) => b.totalSales - a.totalSales)
    );
  };

  const updateWeeklyRevenue = async (entry: ModeEntry, newRevenue: number) => {
    if (newRevenue < 0) newRevenue = 0;
    if (!entry.salesId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("moderator_sales").update({ weekly_revenue: newRevenue }).eq("id", entry.salesId);
    setEntries((prev) =>
      [...prev.map((e) => e.userId === entry.userId ? { ...e, weeklyRevenue: newRevenue } : e)]
        .sort((a, b) => b.salesCount - a.salesCount)
    );
  };

  const updateTotalSales = async (entry: ModeEntry, newTotal: number) => {
    if (!entry.salesId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("moderator_sales").update({ total_sales: newTotal }).eq("id", entry.salesId);
    setTotalEntries((prev) =>
      [...prev.map((e) => e.userId === entry.userId ? { ...e, totalSales: newTotal } : e)]
        .sort((a, b) => b.totalSales - a.totalSales)
    );
  };

  const updateTotalRevenue = async (entry: ModeEntry, newRevenue: number) => {
    if (newRevenue < 0) newRevenue = 0;
    if (!entry.salesId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("moderator_sales").update({ total_revenue: newRevenue }).eq("id", entry.salesId);
    setTotalEntries((prev) =>
      [...prev.map((e) => e.userId === entry.userId ? { ...e, totalRevenue: newRevenue } : e)]
        .sort((a, b) => b.totalSales - a.totalSales)
    );
  };

  const addModerator = async () => {
    if (!addModoSel) return;
    setAdding(true);
    const mod = allModerators.find((m) => m.userId === addModoSel);
    const { data } = await supabase.from("moderator_sales")
      .insert({ moderator_id: addModoSel, sales_count: 0, week_start: getWeekStart().toISOString(), weekly_revenue: 0, total_revenue: 0 })
      .select("id").single();
    if (data && mod) {
      const newEntry: ModeEntry = { ...mod, salesId: (data as { id: string }).id, salesCount: 0, totalSales: 0, weeklyRevenue: 0, totalRevenue: 0 };
      setEntries((prev) => [...prev, newEntry].sort((a, b) => b.salesCount - a.salesCount));
      setTotalEntries((prev) => [...prev.filter((e) => e.userId !== mod.userId), newEntry].sort((a, b) => b.totalSales - a.totalSales));
    }
    setAddModoSel("");
    setAdding(false);
  };

  const removeModerator = async (entry: ModeEntry) => {
    if (!entry.salesId) return;
    await supabase.from("moderator_sales").delete().eq("id", entry.salesId);
    setEntries((prev) => prev.filter((e) => e.userId !== entry.userId));
  };

  const canEdit = (entry: ModeEntry) => isAdmin || entry.userId === userId;
  const missingMods = allModerators.filter((m) => !entries.find((e) => e.userId === m.userId));

  const tiktokLives = resources.filter((r) => r.type === "tiktok_live" && r.moderator_id === null);
  const miroLink = resources.find((r) => r.type === "miro" && r.moderator_id === userId);
  const tunnelLink = resources.find((r) => r.type === "tunnel" && r.moderator_id === userId);

  const copyLink = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const subBtnStyle = (active: boolean) => ({
    padding: "10px 22px",
    borderRadius: 10,
    border: `1px solid ${active ? `rgba(239,68,68,0.7)` : `rgba(239,68,68,0.2)`}`,
    background: active ? `rgba(127,29,29,0.5)` : `rgba(127,29,29,0.15)`,
    color: active ? "#fca5a5" : "#f87171",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: active ? `0 0 12px rgba(239,68,68,0.25)` : "none",
    transition: "all 0.2s",
  });

  const resCardStyle = (open: boolean) => ({
    borderRadius: 12,
    border: `1px solid ${open ? `rgba(239,68,68,0.5)` : `rgba(239,68,68,0.2)`}`,
    background: open ? `rgba(127,29,29,0.25)` : `rgba(127,29,29,0.1)`,
    overflow: "hidden" as const,
    transition: "all 0.2s",
  });

  const resCardHeader = (label: string, icon: string, key: "tiktok" | "miro" | "tunnel") => {
    const open = openResource === key;
    return (
      <button
        onClick={() => setOpenResource(open ? null : key)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ fontSize: 22 }}>{icon}</span>
        <span style={{ flex: 1, fontWeight: 800, fontSize: 15, color: "#fca5a5" }}>{label}</span>
        <span style={{ fontSize: 16, color: RED, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>▾</span>
      </button>
    );
  };

  const linkRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "10px 18px 14px 18px", flexWrap: "wrap" };
  const copyBtnStyle = (id: string) => ({ background: copiedId === id ? "rgba(16,185,129,0.2)" : `rgba(239,68,68,0.15)`, border: `1px solid ${copiedId === id ? "rgba(16,185,129,0.4)" : `rgba(239,68,68,0.35)`}`, color: copiedId === id ? "#10b981" : "#fca5a5", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" });
  const openBtnStyle: CSSProperties = { background: `rgba(239,68,68,0.15)`, border: `1px solid rgba(239,68,68,0.35)`, color: "#fca5a5", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, textDecoration: "none", display: "inline-block" };

  const numInputStyle = (width: number, color = "#fca5a5"): CSSProperties => ({
    width,
    textAlign: "center",
    background: "rgba(15,5,30,0.8)",
    border: `1px solid rgba(239,68,68,0.4)`,
    borderRadius: 8,
    color,
    fontSize: 18,
    fontWeight: 900,
    padding: "4px 0",
  });

  return (
    <div>
      <div className="section-header">
        <h1 style={{ color: "#fca5a5", textShadow: `0 0 20px rgba(239,68,68,0.4)` }}>🤝 Espace Associés</h1>
        <p style={{ color: "#f87171" }}>Espace réservé aux modérateurs et à l'équipe.</p>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
        <button style={subBtnStyle(subTab === "classement")} onClick={() => setSubTab("classement")}>🏆 Classement</button>
        <button style={subBtnStyle(subTab === "ressources")} onClick={() => setSubTab("ressources")}>📦 Ressources</button>
      </div>

      {/* ── CLASSEMENT ── */}
      {subTab === "classement" && (
        <div>
          {/* Gift + title + countdown */}
          <div style={{ marginBottom: 24, textAlign: "center" }}>
            <div style={{ fontSize: 64, animation: "giftBounce 1.4s ease-in-out infinite", display: "inline-block", marginBottom: 8 }}>🎁</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: "#fca5a5", marginBottom: 6 }}>
              🏆 Meilleur vendeur de la semaine — <span style={{ color: "#10b981" }}>Bonus 200€</span>
            </div>
            <div style={{ fontSize: 12, color: "#f87171", marginBottom: 10 }}>Reset dimanche soir 00h00</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: RED, fontVariantNumeric: "tabular-nums", letterSpacing: 3, fontFamily: "monospace", textShadow: `0 0 16px rgba(239,68,68,0.5)` }}>
              {countdown}
            </div>
            <div style={{ fontSize: 11, color: "#7c5c9a", marginTop: 4, letterSpacing: 2 }}>JJ : HH : MM : SS</div>
          </div>

          {/* Admin: add moderator */}
          {isAdmin && missingMods.length > 0 && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
              <select
                value={addModoSel}
                onChange={(e) => setAddModoSel(e.target.value)}
                style={{ background: "rgba(15,5,30,0.8)", border: `1px solid rgba(239,68,68,0.35)`, borderRadius: 8, color: "#fca5a5", padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
              >
                <option value="">— Ajouter un modérateur —</option>
                {missingMods.map((m) => <option key={m.userId} value={m.userId}>{m.username ?? m.userId}</option>)}
              </select>
              <button
                onClick={() => void addModerator()}
                disabled={!addModoSel || adding}
                style={{ background: `rgba(239,68,68,0.2)`, border: `1px solid rgba(239,68,68,0.4)`, color: "#fca5a5", borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                {adding ? "…" : "+ Ajouter"}
              </button>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: "center", color: "#f87171", padding: 40 }}>Chargement…</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {entries.map((entry, idx) => {
                const ringStyle = entry.role === "admin"
                  ? { border: "2.5px solid #ffd700", boxShadow: "0 0 10px #ffd700, 0 0 20px rgba(255,215,0,0.4)" }
                  : { border: `2.5px solid ${RED}`, boxShadow: `0 0 10px ${RED}, 0 0 20px rgba(239,68,68,0.35)` };
                const editable = canEdit(entry);
                return (
                  <div key={entry.userId} style={{ display: "flex", alignItems: "center", gap: 14, background: idx === 0 ? `rgba(127,29,29,0.25)` : "rgba(255,255,255,0.03)", border: `1px solid ${idx === 0 ? `rgba(239,68,68,0.4)` : "rgba(255,255,255,0.07)"}`, borderRadius: 14, padding: "14px 18px" }}>
                    <div style={{ fontSize: idx < 3 ? 22 : 15, fontWeight: 900, color: idx === 0 ? "#ffd700" : idx === 1 ? "#c0c0c0" : idx === 2 ? "#cd7f32" : "#7c5c9a", minWidth: 36, textAlign: "center" }}>
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                    </div>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", ...ringStyle, flexShrink: 0, overflow: "hidden", background: "#1e1132", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {entry.avatarUrl
                        ? <img src={entry.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span style={{ fontSize: 18, color: "#c4a3f0" }}>{(entry.username ?? "?")[0]?.toUpperCase()}</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "#fca5a5", fontSize: 15, marginBottom: 3 }}>{entry.username ?? "Anonyme"}</div>
                      <span style={{ fontSize: 11, background: entry.role === "admin" ? "rgba(255,215,0,0.12)" : `rgba(239,68,68,0.12)`, color: entry.role === "admin" ? "#ffd700" : "#fca5a5", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                        {entry.role === "admin" ? "👑 Admin" : "🏴‍☠️ Modérateur"}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      {/* Sales count row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {editable ? (
                          <>
                            <button
                              onClick={() => void updateSales(entry, entry.salesCount - 1)}
                              style={{ width: 30, height: 30, borderRadius: "50%", background: `rgba(239,68,68,0.15)`, border: `1px solid rgba(239,68,68,0.35)`, color: "#fca5a5", fontSize: 20, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                            >−</button>
                            <input
                              type="number"
                              min={0}
                              value={entry.salesCount}
                              onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 0) void updateSales(entry, v); }}
                              style={numInputStyle(54)}
                            />
                            <button
                              onClick={() => void updateSales(entry, entry.salesCount + 1)}
                              style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)", color: "#10b981", fontSize: 20, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                            >+</button>
                          </>
                        ) : (
                          <span style={{ fontSize: 22, fontWeight: 900, color: "white" }}>{entry.salesCount}</span>
                        )}
                        <span style={{ fontSize: 12, color: "white", fontWeight: 700 }}>ventes</span>
                        {isAdmin && (
                          <button
                            onClick={() => void removeModerator(entry)}
                            title="Retirer du classement"
                            style={{ background: "rgba(239,68,68,0.1)", border: `1px solid rgba(239,68,68,0.3)`, color: "#fca5a5", borderRadius: 6, width: 26, height: 26, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 4 }}
                          >🗑</button>
                        )}
                      </div>
                      {/* Weekly revenue row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {editable ? (
                          <>
                            <input
                              type="number"
                              min={0}
                              value={entry.weeklyRevenue}
                              onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 0) void updateWeeklyRevenue(entry, v); }}
                              style={{ ...numInputStyle(80, "#22c55e"), fontSize: 15, border: "1px solid rgba(34,197,94,0.4)" }}
                            />
                            <span style={{ fontSize: 14, color: "#22c55e", fontWeight: 800 }}>€</span>
                          </>
                        ) : (
                          <span style={{ fontSize: 15, color: "#22c55e", fontWeight: 800 }}>{entry.weeklyRevenue.toLocaleString("fr-FR")}€</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {entries.length === 0 && <div style={{ textAlign: "center", color: "#f87171", padding: 40 }}>Aucun modérateur dans le classement cette semaine.</div>}
            </div>
          )}

          {/* Total section */}
          <div style={{ marginTop: 36 }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: "#fca5a5", marginBottom: 18, textAlign: "center" }}>
              👑 Meilleur vendeur total
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {totalEntries.map((entry, idx) => {
                const ringStyle = entry.role === "admin"
                  ? { border: "2.5px solid #ffd700", boxShadow: "0 0 10px #ffd700, 0 0 20px rgba(255,215,0,0.4)" }
                  : { border: `2.5px solid ${RED}`, boxShadow: `0 0 10px ${RED}, 0 0 20px rgba(239,68,68,0.35)` };
                const editable = canEdit(entry);
                return (
                  <div key={entry.userId} style={{ display: "flex", alignItems: "center", gap: 14, background: idx === 0 ? `rgba(127,29,29,0.25)` : "rgba(255,255,255,0.03)", border: `1px solid ${idx === 0 ? `rgba(239,68,68,0.4)` : "rgba(255,255,255,0.07)"}`, borderRadius: 14, padding: "14px 18px" }}>
                    <div style={{ fontSize: idx < 3 ? 22 : 15, fontWeight: 900, color: idx === 0 ? "#ffd700" : idx === 1 ? "#c0c0c0" : idx === 2 ? "#cd7f32" : "#7c5c9a", minWidth: 36, textAlign: "center" }}>
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                    </div>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", ...ringStyle, flexShrink: 0, overflow: "hidden", background: "#1e1132", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {entry.avatarUrl
                        ? <img src={entry.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span style={{ fontSize: 18, color: "#c4a3f0" }}>{(entry.username ?? "?")[0]?.toUpperCase()}</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "#fca5a5", fontSize: 15, marginBottom: 3 }}>{entry.username ?? "Anonyme"}</div>
                      <span style={{ fontSize: 11, background: entry.role === "admin" ? "rgba(255,215,0,0.12)" : `rgba(239,68,68,0.12)`, color: entry.role === "admin" ? "#ffd700" : "#fca5a5", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                        {entry.role === "admin" ? "👑 Admin" : "🏴‍☠️ Modérateur"}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      {editable ? (
                        <>
                          {/* Total sales editable */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input
                              type="number"
                              min={0}
                              value={entry.totalSales}
                              onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 0) void updateTotalSales(entry, v); }}
                              style={numInputStyle(64)}
                            />
                            <span style={{ fontSize: 12, color: "white", fontWeight: 700 }}>ventes</span>
                          </div>
                          {/* Total revenue editable */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input
                              type="number"
                              min={0}
                              value={entry.totalRevenue}
                              onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 0) void updateTotalRevenue(entry, v); }}
                              style={{ ...numInputStyle(90, "#22c55e"), fontSize: 15, border: "1px solid rgba(34,197,94,0.4)" }}
                            />
                            <span style={{ fontSize: 14, color: "#22c55e", fontWeight: 800 }}>€</span>
                          </div>
                        </>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 22, fontWeight: 900, color: "white" }}>{entry.totalSales} <span style={{ fontSize: 12, fontWeight: 700 }}>ventes</span></span>
                          <span style={{ fontSize: 16, color: "#22c55e", fontWeight: 800 }}>{entry.totalRevenue.toLocaleString("fr-FR")}€</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {totalEntries.length === 0 && <div style={{ textAlign: "center", color: "#f87171", padding: 20 }}>Aucune donnée de vente.</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── RESSOURCES ── */}
      {subTab === "ressources" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* TikTok Live */}
          <div style={resCardStyle(openResource === "tiktok")}>
            {resCardHeader("Rediffusions TikTok Live", "📱", "tiktok")}
            {openResource === "tiktok" && (
              <div style={{ borderTop: `1px solid rgba(239,68,68,0.2)` }}>
                {tiktokLives.length === 0 ? (
                  <div style={{ padding: "12px 18px 16px", color: "#f87171", fontSize: 14, fontStyle: "italic" }}>Aucune rediffusion disponible pour l'instant.</div>
                ) : (
                  tiktokLives.map((r) => (
                    <div key={r.id} style={linkRowStyle}>
                      <div style={{ flex: 1, fontWeight: 600, color: "#fca5a5", fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title ?? r.url}</div>
                      <button onClick={() => void copyLink(r.url, r.id)} style={copyBtnStyle(r.id)}>{copiedId === r.id ? "✓ Copié" : "Copier"}</button>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" style={openBtnStyle}>Ouvrir</a>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Miro */}
          <div style={resCardStyle(openResource === "miro")}>
            {resCardHeader("Lien Miro personnalisé", "🖼️", "miro")}
            {openResource === "miro" && (
              <div style={{ borderTop: `1px solid rgba(239,68,68,0.2)` }}>
                {miroLink ? (
                  <div style={linkRowStyle}>
                    <div style={{ flex: 1, fontWeight: 600, color: "#fca5a5", fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{miroLink.title ?? miroLink.url}</div>
                    <button onClick={() => void copyLink(miroLink.url, miroLink.id)} style={copyBtnStyle(miroLink.id)}>{copiedId === miroLink.id ? "✓ Copié" : "Copier le lien"}</button>
                    <a href={miroLink.url} target="_blank" rel="noopener noreferrer" style={openBtnStyle}>Ouvrir</a>
                  </div>
                ) : (
                  <div style={{ padding: "12px 18px 16px", color: "#f87171", fontSize: 14, fontStyle: "italic" }}>Lien Miro non encore assigné — contacte l'admin.</div>
                )}
              </div>
            )}
          </div>

          {/* Tunnel de vente */}
          <div style={resCardStyle(openResource === "tunnel")}>
            {resCardHeader("Tunnel de vente personnalisé", "🔗", "tunnel")}
            {openResource === "tunnel" && (
              <div style={{ borderTop: `1px solid rgba(239,68,68,0.2)` }}>
                {tunnelLink ? (
                  <div style={linkRowStyle}>
                    <div style={{ flex: 1, fontWeight: 600, color: "#fca5a5", fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tunnelLink.title ?? tunnelLink.url}</div>
                    <button onClick={() => void copyLink(tunnelLink.url, tunnelLink.id)} style={copyBtnStyle(tunnelLink.id)}>{copiedId === tunnelLink.id ? "✓ Copié" : "Copier le lien"}</button>
                    <a href={tunnelLink.url} target="_blank" rel="noopener noreferrer" style={openBtnStyle}>Ouvrir</a>
                  </div>
                ) : (
                  <div style={{ padding: "12px 18px 16px", color: "#f87171", fontSize: 14, fontStyle: "italic" }}>Tunnel de vente non encore assigné — contacte l'admin.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes giftBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }
      `}</style>
    </div>
  );
}
