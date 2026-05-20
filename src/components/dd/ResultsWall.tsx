import { useEffect, useRef, useState, type CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";

type Result = {
  id: string;
  user_id: string;
  content: string;
  amount: number | null;
  photo_url: string | null;
  visible: boolean;
  created_at: string;
  deleted?: boolean;
  deleted_by?: string | null;
  deleted_at?: string | null;
};

type RProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type Reaction = { id: string; result_id: string; user_id: string; emoji: string };
type Comment = { id: string; result_id: string; user_id: string; body: string; created_at: string };

function avatarRing(role: string): CSSProperties {
  if (role === "admin") return { border: "2px solid #FFD700", boxShadow: "0 0 10px #FFD700, 0 0 20px #FFD700" };
  if (role === "moderator") return { border: "2px solid #ef4444", boxShadow: "0 0 10px #ef4444, 0 0 20px #dc2626" };
  return { border: "2px solid #7c3aed" };
}

function RoleBadgeMini({ role }: { role: string }) {
  if (role === "admin") return <span style={{ fontSize: 10, fontWeight: 800, background: "linear-gradient(135deg,#FFD700,#FFAA00)", color: "#1a0800", padding: "1px 7px", borderRadius: 6, marginLeft: 5 }}>👑 Admin</span>;
  if (role === "moderator") return <span style={{ fontSize: 10, fontWeight: 800, background: "linear-gradient(135deg,#450a0a,#b91c1c)", color: "#fca5a5", border: "1px solid #ef4444", padding: "1px 7px", borderRadius: 6, marginLeft: 5 }}>🏴‍☠️ Modo</span>;
  return <span style={{ fontSize: 10, fontWeight: 800, background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff", padding: "1px 7px", borderRadius: 6, marginLeft: 5 }}>🎓 Élève</span>;
}

const EMOJIS = ["🔥", "🚀", "👏", "💪", "❤️"];

export function ResultsWall({
  userId,
  username,
  avatarUrl,
}: {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
}) {
  const [myRole, setMyRole] = useState<string>("user");
  const [results, setResults] = useState<Result[]>([]);
  const [profiles, setProfiles] = useState<Record<string, RProfile>>({});
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [content, setContent] = useState("");
  const [amount, setAmount] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [reactionPopup, setReactionPopup] = useState<{ list: Reaction[]; emoji: string; resultId: string } | null>(null);

  // Fetch current user's role
  useEffect(() => {
    if (!userId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).rpc("get_top_role", { _user_id: userId }).then(({ data }: { data: string | null }) => {
      if (data) { setMyRole(data); return; }
      supabase.from("user_roles").select("role").eq("user_id", userId).then(({ data: rows }) => {
        const pri: Record<string, number> = { admin: 3, moderator: 2, user: 1 };
        const top = ((rows ?? []) as { role: string }[]).reduce<string>((b, r) => ((pri[r.role] ?? 0) > (pri[b] ?? 0) ? r.role : b), "user");
        setMyRole(top);
      });
    });
  }, [userId]);

  // Load results + reactions + comments + subscribe
  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sa = supabase as any;
      const [{ data: rs }, { data: rx }, { data: cm }] = await Promise.all([
        sa.from("results").select("*").order("created_at", { ascending: false }).limit(100),
        sa.from("result_reactions").select("*").limit(2000),
        sa.from("result_comments").select("*").order("created_at", { ascending: true }).limit(2000),
      ]);
      setResults((rs as Result[]) ?? []);
      setReactions((rx as Reaction[]) ?? []);
      setComments((cm as Comment[]) ?? []);
    };
    void load();

    const channel = supabase
      .channel("results_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "results" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const r = payload.new as Result;
          setResults((prev) => (prev.find((x) => x.id === r.id) ? prev : [r, ...prev]));
        } else if (payload.eventType === "UPDATE") {
          const u = payload.new as Result;
          setResults((prev) => prev.map((r) => (r.id === u.id ? u : r)));
        } else if (payload.eventType === "DELETE") {
          const o = payload.old as Result;
          setResults((prev) => prev.filter((r) => r.id !== o.id));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "result_reactions" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const r = payload.new as Reaction;
          setReactions((prev) => (prev.find((x) => x.id === r.id) ? prev : [...prev, r]));
        } else if (payload.eventType === "DELETE") {
          const o = payload.old as Reaction;
          setReactions((prev) => prev.filter((r) => r.id !== o.id));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "result_comments" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const c = payload.new as Comment;
          setComments((prev) => (prev.find((x) => x.id === c.id) ? prev : [...prev, c]));
        } else if (payload.eventType === "DELETE") {
          const o = payload.old as Comment;
          setComments((prev) => prev.filter((c) => c.id !== o.id));
        }
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  // Load missing profiles + roles for all user_ids
  useEffect(() => {
    const ids = new Set<string>();
    results.forEach((r) => ids.add(r.user_id));
    comments.forEach((c) => ids.add(c.user_id));
    reactions.forEach((r) => ids.add(r.user_id));
    const missing = [...ids].filter((id) => !profiles[id]);
    if (!missing.length) return;
    supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", missing)
      .then(({ data }) => {
        if (data?.length) {
          setProfiles((prev) => ({
            ...prev,
            ...Object.fromEntries((data as RProfile[]).map((p) => [p.id, p])),
          }));
        }
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).rpc("get_roles_for_users", { _user_ids: missing })
      .then(({ data, error }: { data: { user_id: string; role: string }[] | null; error: unknown }) => {
        const rows = error || !data?.length ? null : data;
        if (!rows) {
          supabase.from("user_roles").select("user_id, role").in("user_id", missing)
            .then(({ data: fb }) => {
              if (!fb?.length) return;
              setRoles((prev) => {
                const next = { ...prev };
                const pri: Record<string, number> = { admin: 3, moderator: 2, user: 1 };
                for (const r of fb as { user_id: string; role: string }[]) {
                  if ((pri[r.role] ?? 0) > (pri[next[r.user_id]] ?? 0)) next[r.user_id] = r.role;
                }
                return next;
              });
            });
          return;
        }
        setRoles((prev) => { const next = { ...prev }; for (const r of rows) next[r.user_id] = r.role; return next; });
      });
  }, [results, comments, reactions]);

  const submit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);

    let photo_url: string | null = null;
    if (photoFile) {
      const ext = photoFile.name.split(".").pop() || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("result-photos").upload(path, photoFile, { upsert: false });
      if (!error) {
        const { data } = supabase.storage.from("result-photos").getPublicUrl(path);
        photo_url = data.publicUrl;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("results")
      .insert({
        user_id: userId,
        content: content.trim(),
        amount: amount ? parseInt(amount, 10) : null,
        photo_url,
      })
      .select()
      .single();

    if (data) {
      setResults((prev) => {
        const row = data as Result;
        return prev.find((r) => r.id === row.id) ? prev : [row, ...prev];
      });
    }
    setContent(""); setAmount(""); setPhotoFile(null); setPhotoPreview(""); setSubmitting(false);
  };

  const toggleReaction = async (resultId: string, emoji: string) => {
    const existing = reactions.find((r) => r.result_id === resultId && r.user_id === userId && r.emoji === emoji);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sa = supabase as any;
    if (existing) {
      setReactions((prev) => prev.filter((r) => r.id !== existing.id));
      await sa.from("result_reactions").delete().eq("id", existing.id);
    } else {
      const { data } = await sa.from("result_reactions").insert({ result_id: resultId, user_id: userId, emoji }).select().single();
      if (data) setReactions((prev) => (prev.find((r) => r.id === data.id) ? prev : [...prev, data as Reaction]));
    }
  };

  const sendComment = async (resultId: string) => {
    const draft = (commentDrafts[resultId] ?? "").trim();
    if (!draft) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sa = supabase as any;
    const { data } = await sa.from("result_comments").insert({ result_id: resultId, user_id: userId, body: draft }).select().single();
    if (data) setComments((prev) => (prev.find((c) => c.id === data.id) ? prev : [...prev, data as Comment]));
    setCommentDrafts((p) => ({ ...p, [resultId]: "" }));
  };

  const softDeleteResult = async (resultId: string) => {
    const now = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("results").update({ deleted: true, deleted_by: userId, deleted_at: now }).eq("id", resultId);
    setResults((prev) => prev.map((r) => r.id === resultId ? { ...r, deleted: true, deleted_by: userId, deleted_at: now } : r));
  };

  const restoreResult = async (resultId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("results").update({ deleted: false, deleted_by: null, deleted_at: null }).eq("id", resultId);
    setResults((prev) => prev.map((r) => r.id === resultId ? { ...r, deleted: false, deleted_by: null, deleted_at: null } : r));
  };

  const hardDeleteResult = async (resultId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("results").delete().eq("id", resultId);
    setResults((prev) => prev.filter((r) => r.id !== resultId));
  };

  const nameOf = (uid: string) => {
    if (uid === userId) return username || "Moi";
    const p = profiles[uid];
    return p?.full_name || p?.username || "Élève";
  };
  const avatarOf = (uid: string) => (uid === userId ? avatarUrl : profiles[uid]?.avatar_url ?? null);
  const roleOf = (uid: string) => roles[uid] ?? "user";

  return (
    <div>
      <div className="results-form">
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14, color: "#f0e8ff" }}>🚀 Partage ton résultat</h2>
        <textarea className="results-textarea" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Décris ton résultat… première vente, chiffre du mois, client signé…" maxLength={500} rows={3} />
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input className="results-amount-input" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Montant gagné (€) — optionnel" />
          <button type="button" className="admin-btn-ghost sm" onClick={() => fileRef.current?.click()}>
            📷 {photoFile ? "Photo ajoutée ✓" : "Ajouter une photo"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)); } }} />
        </div>
        {photoPreview && (
          <div style={{ marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <img src={photoPreview} alt="preview" style={{ maxHeight: 100, borderRadius: 8, objectFit: "cover" }} />
            <button onClick={() => { setPhotoFile(null); setPhotoPreview(""); }} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
        )}
        <button className="admin-btn-primary" onClick={submit} disabled={submitting || !content.trim()}>
          {submitting ? "Envoi en cours…" : "🏆 Partager mon résultat"}
        </button>
      </div>

      {reactionPopup && (
        <div onClick={() => setReactionPopup(null)} style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "rgba(16,6,36,0.98)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 14, width: "100%", maxWidth: 360, maxHeight: "60vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(168,85,247,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 18 }}>{reactionPopup.emoji}</span>
              <span style={{ color: "#c4a3f0", fontSize: 13 }}>{reactionPopup.list.length} réaction{reactionPopup.list.length > 1 ? "s" : ""}</span>
              <button onClick={() => setReactionPopup(null)} style={{ background: "none", border: "none", color: "#c4a3f0", fontSize: 20, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: 8 }}>
              {reactionPopup.list.map((rx) => {
                const n = nameOf(rx.user_id);
                const av = avatarOf(rx.user_id);
                const rl = roleOf(rx.user_id);
                return (
                  <div key={rx.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(124,58,237,0.2)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...avatarRing(rl) }}>
                      {av ? <img src={av} alt={n} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#c4a3f0", fontWeight: 700, fontSize: 12 }}>{n[0]?.toUpperCase()}</span>}
                    </div>
                    <span style={{ color: "#f0e8ff", fontSize: 13, fontWeight: 600 }}>{n}</span>
                    <RoleBadgeMini role={rl} />
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(168,85,247,0.15)" }}>
              <button
                onClick={() => { void toggleReaction(reactionPopup.resultId, reactionPopup.emoji); setReactionPopup(null); }}
                style={{ width: "100%", background: reactionPopup.list.some(x => x.user_id === userId) ? "rgba(239,68,68,0.15)" : "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.35)", color: "#f0e8ff", borderRadius: 8, padding: "8px 0", cursor: "pointer", fontWeight: 700, fontSize: 13 }}
              >
                {reactionPopup.list.some(x => x.user_id === userId) ? "✕ Retirer ma réaction" : `${reactionPopup.emoji} Réagir`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="results-wall">
        {results.filter((r) => !r.deleted || myRole === "admin").length === 0 && (
          <div style={{ textAlign: "center", color: "#6b4fa0", padding: "40px 0", fontSize: 14 }}>
            Aucun résultat partagé pour l'instant. Sois le premier !
          </div>
        )}
        {results.filter((r) => !r.deleted || myRole === "admin").map((r) => {
          const name = nameOf(r.user_id);
          const avatar = avatarOf(r.user_id);
          const myReacts = new Set(reactions.filter((x) => x.result_id === r.id && x.user_id === userId).map((x) => x.emoji));
          const commentsForResult = comments.filter((c) => c.result_id === r.id);
          const isOpen = !!openComments[r.id];
          const rRole = roleOf(r.user_id);
          const isDeleted = !!r.deleted;
          return (
            <div key={r.id} className="result-card" style={isDeleted ? { background: "rgba(220,38,38,0.08)", border: "1px solid rgba(239,68,68,0.3)" } : {}}>
              {isDeleted && (
                <div style={{ fontSize: 11, color: "#fca5a5", fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>🗑 Post masqué</span>
                  <button onClick={() => void restoreResult(r.id)} style={{ background: "rgba(16,185,129,0.15)", border: "1px solid #10b981", borderRadius: 6, color: "#10b981", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "2px 8px" }}>↩ Restaurer</button>
                  <button onClick={() => void hardDeleteResult(r.id)} style={{ background: "rgba(239,68,68,0.15)", border: "1px solid #ef4444", borderRadius: 6, color: "#ef4444", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "2px 8px" }}>✕ Supprimer définitivement</button>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(168,85,247,0.2)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, ...avatarRing(rRole) }}>
                  {avatar
                    ? <img src={avatar} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 14, color: "#c4a3f0" }}>{name[0]?.toUpperCase()}</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#f0e8ff", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 2 }}>{name}<RoleBadgeMini role={rRole} /></div>
                  <div style={{ fontSize: 11, color: "#7c5c9a" }}>
                    {new Date(r.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                </div>
                {r.amount != null && (
                  <div style={{ background: "linear-gradient(135deg, #059669, #10b981)", color: "#fff", fontWeight: 800, fontSize: 14, padding: "4px 14px", borderRadius: 20, whiteSpace: "nowrap" }}>
                    +{r.amount.toLocaleString("fr-FR")}€
                  </div>
                )}
                {!isDeleted && (r.user_id === userId || myRole === "admin") && (
                  <button
                    onClick={() => void softDeleteResult(r.id)}
                    title="Masquer ce post"
                    style={{ background: "none", border: "none", color: "#6b4fa0", cursor: "pointer", fontSize: 15, padding: "2px 4px", opacity: 0.5, flexShrink: 0, transition: "opacity 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}
                  >
                    🗑
                  </button>
                )}
              </div>
              <p style={{ color: "#c4a3f0", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{r.content}</p>
              {r.photo_url && (
                <img src={r.photo_url} alt="résultat" style={{ marginTop: 12, width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 10 }} />
              )}

              {/* Reactions */}
              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                {EMOJIS.map((emo) => {
                  const list = reactions.filter((x) => x.result_id === r.id && x.emoji === emo);
                  const count = list.length;
                  const active = myReacts.has(emo);
                  return (
                    <button
                      key={emo}
                      onClick={() => {
                        if (count > 0) {
                          setReactionPopup(reactionPopup?.resultId === r.id && reactionPopup?.emoji === emo ? null : { list, emoji: emo, resultId: r.id });
                        } else {
                          void toggleReaction(r.id, emo);
                        }
                      }}
                      style={{
                        background: active ? "rgba(168,85,247,0.35)" : "rgba(168,85,247,0.1)",
                        border: active ? "1px solid #a855f7" : "1px solid rgba(168,85,247,0.25)",
                        borderRadius: 16, padding: "3px 10px", fontSize: 13, cursor: "pointer", color: "#f0e8ff",
                        display: "inline-flex", alignItems: "center", gap: 4,
                      }}
                    >
                      <span>{emo}</span>
                      {count > 0 && <span style={{ fontSize: 11, fontWeight: 700 }}>{count}</span>}
                    </button>
                  );
                })}
                <button
                  onClick={() => setOpenComments((p) => ({ ...p, [r.id]: !isOpen }))}
                  style={{ background: "none", border: "none", color: "#9a7dbd", cursor: "pointer", fontSize: 12, marginLeft: "auto", fontWeight: 700 }}
                >
                  💬 {commentsForResult.length} commentaire{commentsForResult.length > 1 ? "s" : ""}
                </button>
              </div>

              {/* Comments */}
              {isOpen && (
                <div style={{ marginTop: 12, borderTop: "1px solid rgba(168,85,247,0.15)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {commentsForResult.map((c) => {
                    const cname = nameOf(c.user_id);
                    const cav = avatarOf(c.user_id);
                    const cRole = roleOf(c.user_id);
                    return (
                      <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(168,85,247,0.2)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, ...avatarRing(cRole) }}>
                          {cav ? <img src={cav} alt={cname} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 11, color: "#c4a3f0" }}>{cname[0]?.toUpperCase()}</span>}
                        </div>
                        <div style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(168,85,247,0.18)", borderRadius: 10, padding: "6px 10px", flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#c4a3f0", marginBottom: 2 }}>{cname}</div>
                          <div style={{ fontSize: 13, color: "#f0e8ff", lineHeight: 1.4, wordBreak: "break-word" }}>{c.body}</div>
                          <div style={{ fontSize: 10, color: "#6b4fa0", marginTop: 2 }}>
                            {new Date(c.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <input
                      value={commentDrafts[r.id] ?? ""}
                      onChange={(e) => setCommentDrafts((p) => ({ ...p, [r.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") void sendComment(r.id); }}
                      placeholder="Écris un commentaire…"
                      maxLength={1000}
                      style={{ flex: 1, background: "rgba(15,9,32,0.8)", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 18, padding: "6px 12px", color: "#f0e8ff", fontSize: 13, outline: "none" }}
                    />
                    <button
                      onClick={() => void sendComment(r.id)}
                      disabled={!(commentDrafts[r.id] ?? "").trim()}
                      style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)", color: "#fff", border: "none", borderRadius: 18, padding: "6px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                    >
                      ➤
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
