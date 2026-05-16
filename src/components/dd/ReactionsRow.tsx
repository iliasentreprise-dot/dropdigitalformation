import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

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
  const [mine, setMine] = useState<ReactionKey | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const { data: all } = await supabase
      .from("chapter_reactions")
      .select("reaction, user_id")
      .eq("chapter_id", chapterId);
    const c: Record<ReactionKey, number> = {
      like: 0,
      fire: 0,
      lightbulb: 0,
      think: 0,
    };
    let m: ReactionKey | null = null;
    for (const row of (all ?? []) as Array<{ reaction: ReactionKey; user_id: string }>) {
      if (row.reaction in c) c[row.reaction] += 1;
      if (user && row.user_id === user.id) m = row.reaction;
    }
    setCounts(c);
    setMine(m);
  };

  useEffect(() => {
    if (!chapterId) return;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, user?.id]);

  const toggle = async (key: ReactionKey) => {
    if (!user || busy) return;
    setBusy(true);
    if (mine === key) {
      await supabase
        .from("chapter_reactions")
        .delete()
        .eq("user_id", user.id)
        .eq("chapter_id", chapterId);
    } else {
      await supabase
        .from("chapter_reactions")
        .upsert(
          { user_id: user.id, chapter_id: chapterId, reaction: key },
          { onConflict: "user_id,chapter_id" },
        );
    }
    await reload();
    setBusy(false);
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginTop: 14,
      }}
    >
      {REACTIONS.map((r) => {
        const active = mine === r.key;
        return (
          <button
            key={r.key}
            onClick={() => void toggle(r.key)}
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
              {counts[r.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
