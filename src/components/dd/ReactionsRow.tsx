import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

type ReactorProfile = { id: string; username: string | null; full_name: string | null; avatar_url: string | null };
type ReactionDetail = { user_id: string; reaction: string };
type ReactionPopup = { key: ReactionKey; users: ReactorProfile[] };

type ReactionKey = "like" | "fire" | "lightbulb" | "think";

const REACTIONS: { key: ReactionKey; emoji: string; label: string }[] = [
  { key: "like", emoji: "👍", label: "Utile" },
  { key: "fire", emoji: "🔥", label: "Incroyable" },
  { key: "lightbulb", emoji: "💡", label: "Inspirant" },
  { key: "think", emoji: "🤔", label: "À revoir" },
];

export function ReactionsRow({ chapterId }: { chapterId: string }) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<ReactionKey, number>>({
    like: 0,
    fire: 0,
    lightbulb: 0,
    think: 0,
  });
  const [mine, setMine] = useState<Set<ReactionKey>>(new Set());
  const [busy, setBusy] = useState(false);
  const [allReactions, setAllReactions] = useState<ReactionDetail[]>([]);
  const [popup, setPopup] = useState<ReactionPopup | null>(null);

  const reload = async () => {
    const { data: all } = await supabase
      .from("chapter_reactions")
      .select("reaction, user_id")
      .eq("chapter_id", chapterId);
    const rows = (all ?? []) as Array<{ reaction: ReactionKey; user_id: string }>;
    const c: Record<ReactionKey, number> = { like: 0, fire: 0, lightbulb: 0, think: 0 };
    const m = new Set<ReactionKey>();
    for (const row of rows) {
      if (row.reaction in c) c[row.reaction] += 1;
      if (user && row.user_id === user.id) m.add(row.reaction as ReactionKey);
    }
    setCounts(c);
    setMine(m);
    setAllReactions(rows);
  };

  const openPopup = async (key: ReactionKey) => {
    const reactors = allReactions.filter((r) => r.reaction === key).map((r) => r.user_id);
    if (!reactors.length) return;
    const { data } = await supabase.from("profiles").select("id, username, full_name, avatar_url").in("id", reactors);
    setPopup({ key, users: (data ?? []) as ReactorProfile[] });
  };

  useEffect(() => {
    if (!chapterId) return;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, user?.id]);

  const toggle = async (key: ReactionKey) => {
    if (!user || busy) return;
    setBusy(true);
    if (mine.has(key)) {
      await supabase
        .from("chapter_reactions")
        .delete()
        .eq("user_id", user.id)
        .eq("chapter_id", chapterId)
        .eq("reaction", key);
    } else {
      await supabase
        .from("chapter_reactions")
        .upsert(
          { user_id: user.id, chapter_id: chapterId, reaction: key },
          { onConflict: "chapter_id,user_id,reaction" },
        );
    }
    await reload();
    setBusy(false);
  };

  return (
    <>
      {popup && (
        <div onClick={() => setPopup(null)} style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "rgba(16,6,36,0.98)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 14, width: "100%", maxWidth: 320, maxHeight: "50vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(168,85,247,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 17 }}>{REACTIONS.find((r) => r.key === popup.key)?.emoji} {REACTIONS.find((r) => r.key === popup.key)?.label}</span>
              <button onClick={() => setPopup(null)} style={{ background: "none", border: "none", color: "#c4a3f0", fontSize: 20, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: 8 }}>
              {popup.users.map((u) => {
                const n = u.full_name || u.username || "Élève";
                return (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(124,58,237,0.2)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid rgba(168,85,247,0.4)" }}>
                      {u.avatar_url ? <img src={u.avatar_url} alt={n} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#c4a3f0", fontSize: 11, fontWeight: 700 }}>{n[0]?.toUpperCase()}</span>}
                    </div>
                    <span style={{ color: "#f0e8ff", fontSize: 13, fontWeight: 600 }}>{n}</span>
                    {u.username && <span style={{ color: "#7c5c9a", fontSize: 11 }}>@{u.username}</span>}
                  </div>
                );
              })}
            </div>
            {user && (
              <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(168,85,247,0.15)" }}>
                {mine.has(popup.key) ? (
                  <button
                    onClick={async () => { setPopup(null); await toggle(popup.key); }}
                    style={{ width: "100%", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 8, color: "#fca5a5", fontSize: 13, fontWeight: 700, padding: "8px 0", cursor: "pointer" }}
                  >
                    ✕ Retirer ma réaction
                  </button>
                ) : (
                  <button
                    onClick={async () => { setPopup(null); await toggle(popup.key); }}
                    style={{ width: "100%", background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.45)", borderRadius: 8, color: "#c4a3f0", fontSize: 13, fontWeight: 700, padding: "8px 0", cursor: "pointer" }}
                  >
                    {REACTIONS.find((r) => r.key === popup.key)?.emoji} Réagir
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginTop: 14,
        }}
      >
        {REACTIONS.map((r) => {
          const active = mine.has(r.key);
          const count = counts[r.key];
          return (
            <button
              key={r.key}
              onClick={() => {
                if (count > 0) {
                  void openPopup(r.key);
                } else {
                  void toggle(r.key);
                }
              }}
              disabled={busy}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 999,
                border: active
                  ? "1px solid #a855f7"
                  : "1px solid rgba(168,85,247,0.25)",
                background: active
                  ? "rgba(168,85,247,0.18)"
                  : "rgba(25,10,48,0.5)",
                color: active ? "#fff" : "#c4a3f0",
                cursor: busy ? "wait" : "pointer",
                fontSize: 13,
                fontWeight: 600,
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 15 }}>{r.emoji}</span>
              <span>{r.label}</span>
              <span style={{ opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
