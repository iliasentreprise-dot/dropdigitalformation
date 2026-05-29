import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type GroupMessage = {
  id: string;
  user_id: string;
  content: string;
  visible: boolean;
  hidden_by_admin?: boolean;
  created_at: string;
  reply_to_id: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  edited?: boolean;
  edited_at?: string | null;
  image_url?: string | null;
};

type GProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type Reaction = { id: string; message_id: string; user_id: string; emoji: string };

const EMOJI_LIST = ["🏴‍☠️", "❤️", "🔥", "👎", "😎"];

function avatarRing(role: string): CSSProperties {
  if (role === "admin") return { border: "2px solid #FFD700", boxShadow: "0 0 10px #FFD700, 0 0 20px #FFD700" };
  if (role === "moderator") return { border: "2px solid #ef4444", boxShadow: "0 0 10px #ef4444, 0 0 20px #dc2626" };
  return { border: "2px solid #7c3aed" };
}

export function GroupChat({
  userId,
  username,
  avatarUrl,
}: {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
}) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, GProfile>>({});
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [mutedSet, setMutedSet] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [myRole, setMyRole] = useState<string>("user");
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [reactionPopup, setReactionPopup] = useState<{ list: Reaction[]; emoji: string; msgId: string } | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [editingMsg, setEditingMsg] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  // profile click navigates directly to /profil/$userId
  const navigate = useNavigate();
  const goToProfile = (uid: string) => { void navigate({ to: "/profil/$userId", params: { userId: uid } }); };
  const bottomRef = useRef<HTMLDivElement>(null);

  const canModerate = myRole === "admin" || myRole === "moderator";
  const isAdmin = myRole === "admin";

  // Initial load
  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: msgs } = await (supabase as any)
        .from("group_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(200);
      const msgList = (msgs as GroupMessage[]) ?? [];
      setMessages(msgList);

      if (msgList.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rx } = await (supabase as any)
          .from("message_reactions")
          .select("*")
          .in("message_id", msgList.map((m) => m.id));
        setReactions((rx as Reaction[]) ?? []);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: muted } = await (supabase as any).from("muted_users").select("user_id");
      setMutedSet(new Set(((muted as { user_id: string }[]) ?? []).map((m) => m.user_id)));
    };
    void load();

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .then(({ data: roleRows }) => {
        const r = (roleRows ?? []) as { role: string }[];
        if (r.find((x) => x.role === "admin")) setMyRole("admin");
        else if (r.find((x) => x.role === "moderator")) setMyRole("moderator");
        else setMyRole("user");
      });

    const channel = supabase
      .channel("group_chat_v2")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages" }, (payload) => {
        const msg = payload.new as GroupMessage;
        setMessages((prev) => (prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "group_messages" }, (payload) => {
        const updated = payload.new as GroupMessage;
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "group_messages" }, (payload) => {
        const id = (payload.old as { id: string }).id;
        setMessages((prev) => prev.filter((m) => m.id !== id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const r = payload.new as Reaction;
          setReactions((prev) => (prev.find((x) => x.id === r.id) ? prev : [...prev, r]));
        } else if (payload.eventType === "DELETE") {
          const id = (payload.old as { id: string }).id;
          setReactions((prev) => prev.filter((x) => x.id !== id));
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  // Fetch profiles & roles for unknown senders
  useEffect(() => {
    const unknownIds = [...new Set(messages.map((m) => m.user_id).filter((id) => !profiles[id]))];
    if (!unknownIds.length) return;

    supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, bio")
      .in("id", unknownIds)
      .then(({ data }) => {
        if (data?.length) {
          setProfiles((prev) => ({
            ...prev,
            ...Object.fromEntries((data as GProfile[]).map((p) => [p.id, p])),
          }));
        }
      });

    // Use SECURITY DEFINER RPC — bypasses RLS so all users can read others' roles
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .rpc("get_roles_for_users", { _user_ids: unknownIds })
      .then(({ data, error }: { data: { user_id: string; role: string }[] | null; error: unknown }) => {
        const rows = error || !data?.length ? null : data;
        if (!rows) {
          // Fallback: direct query (works if RLS policy allows it after migration)
          supabase
            .from("user_roles")
            .select("user_id, role")
            .in("user_id", unknownIds)
            .then(({ data: fallback }) => {
              if (!fallback?.length) return;
              setRoles((prev) => {
                const next = { ...prev };
                const priority: Record<string, number> = { admin: 3, moderator: 2, user: 1 };
                for (const r of fallback as { user_id: string; role: string }[]) {
                  if ((priority[r.role] ?? 0) > (priority[next[r.user_id]] ?? 0)) next[r.user_id] = r.role;
                }
                return next;
              });
            });
          return;
        }
        setRoles((prev) => {
          const next = { ...prev };
          for (const r of rows) next[r.user_id] = r.role;
          return next;
        });
      });
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const deleteMessage = async (id: string) => {
    // Soft-delete: admin still sees it in red, others see "Message supprimé"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("group_messages")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", id);
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, deleted_at: new Date().toISOString(), deleted_by: userId } : m)),
    );
  };

  const restoreMessage = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("group_messages")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", id);
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, deleted_at: null, deleted_by: null } : m)),
    );
  };

  const hardDeleteMessage = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("group_messages").delete().eq("id", id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const hideMessage = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("group_messages")
      .update({ hidden_by_admin: true })
      .eq("id", id);
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, hidden_by_admin: true } : m)),
    );
  };

  const editMessage = async (msg: GroupMessage, newContent: string) => {
    if (!newContent.trim()) return;
    const isOwner = msg.user_id === userId;
    const payload = isOwner
      ? { content: newContent.trim(), edited: true, edited_at: new Date().toISOString() }
      : { content: newContent.trim() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("group_messages").update(payload).eq("id", msg.id);
    setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, ...payload } : m));
    setEditingMsg(null);
    setEditContent("");
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    const mine = reactions.find((r) => r.message_id === messageId && r.user_id === userId && r.emoji === emoji);
    if (mine) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("message_reactions").delete().eq("id", mine.id);
      setReactions((prev) => prev.filter((r) => r.id !== mine.id));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("message_reactions")
        .insert({ message_id: messageId, user_id: userId, emoji })
        .select()
        .single();
      if (data) setReactions((prev) => [...prev, data as Reaction]);
    }
    setPickerFor(null);
  };

  const muteUser = async (uid: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("muted_users").upsert({ user_id: uid, muted_by: userId });
    setMutedSet((prev) => new Set([...prev, uid]));
  };
  const unmuteUser = async (uid: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("muted_users").delete().eq("user_id", uid);
    setMutedSet((prev) => {
      const n = new Set(prev);
      n.delete(uid);
      return n;
    });
  };

  const send = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    const replyId = replyTo?.id ?? null;
    setInput("");
    setReplyTo(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("group_messages")
      .insert({ user_id: userId, content, reply_to_id: replyId })
      .select()
      .single();
    if (error) {
      alert(error.message.includes("policy") ? "Tu as été muté par un modérateur." : error.message);
    }
    if (data) {
      setMessages((prev) => {
        const row = data as GroupMessage;
        return prev.find((m) => m.id === row.id) ? prev : [...prev, row];
      });
    }
    setSending(false);
  };

  const uploadGroupImage = async (file: File) => {
    if (mutedSet.has(userId) && !isAdmin) return;
    setImageUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `group/${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("chat-images").upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (upErr) { alert("Erreur upload : " + upErr.message); return; }
      const { data: urlData } = supabase.storage.from("chat-images").getPublicUrl(path);
      const replyId = replyTo?.id ?? null;
      setReplyTo(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("group_messages")
        .insert({ user_id: userId, content: "", reply_to_id: replyId, image_url: urlData.publicUrl })
        .select().single();
      if (error) { alert(error.message); return; }
      if (data) setMessages((prev) => { const row = data as GroupMessage; return prev.find((m) => m.id === row.id) ? prev : [...prev, row]; });
    } catch (e) { alert((e as Error).message); }
    finally { setImageUploading(false); }
  };

  useEffect(() => {
    const fetchOnline = async () => {
      const { data } = await supabase
        .from("user_presence")
        .select("user_id")
        .eq("is_online", true)
        .gte("last_seen", new Date(Date.now() - 2 * 60 * 1000).toISOString());
      setOnlineCount(Math.max(1, data?.length ?? 1));
    };
    void fetchOnline();
    const ch = supabase
      .channel("online-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_presence" }, async () => {
        const { data } = await supabase
          .from("user_presence")
          .select("user_id")
          .eq("is_online", true)
          .gte("last_seen", new Date(Date.now() - 120000).toISOString());
        setOnlineCount(Math.max(1, data?.length ?? 1));
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const messagesById = useMemo(() => Object.fromEntries(messages.map((m) => [m.id, m])), [messages]);

  const nameOf = (uid: string) => {
    if (uid === userId) return username || "Moi";
    const p = profiles[uid];
    return p?.full_name || p?.username || "Élève";
  };
  const avatarOf = (uid: string) => (uid === userId ? avatarUrl : profiles[uid]?.avatar_url ?? null);
  const roleOf = (uid: string) => (uid === userId ? myRole : roles[uid] ?? "user");

  const RoleBadgeMini = ({ role: r }: { role: string }) => {
    if (r === "admin") return <span style={{ fontSize: 9, fontWeight: 800, background: "linear-gradient(135deg,#FFD700,#FFAA00)", color: "#1a0800", padding: "1px 6px", borderRadius: 5, marginLeft: 4 }}>👑 Admin</span>;
    if (r === "moderator") return <span style={{ fontSize: 9, fontWeight: 800, background: "linear-gradient(135deg,#450a0a,#b91c1c)", color: "#fca5a5", border: "1px solid #ef4444", padding: "1px 6px", borderRadius: 5, marginLeft: 4 }}>🏴‍☠️ Modo</span>;
    return <span style={{ fontSize: 9, fontWeight: 800, background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff", padding: "1px 6px", borderRadius: 5, marginLeft: 4 }}>🎓 Élève</span>;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 220px)", minHeight: 380 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: "1px solid rgba(168,85,247,0.15)", flexShrink: 0 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e, 0 0 16px #22c55e", display: "inline-block", animation: "presencePulse 1s ease-in-out infinite", flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: "#9a7dbd" }}>
          {onlineCount} personne{onlineCount !== 1 ? "s" : ""} en ligne
        </span>
      </div>
      <div className="chat-messages">
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "#6b4fa0", paddingTop: 60, fontSize: 14 }}>
            Aucun message pour l'instant. Sois le premier à dire bonjour 👋
          </div>
        )}
        {messages
          .filter((msg) => !msg.hidden_by_admin || isAdmin || msg.user_id === userId)
          .map((msg) => {
          const isOwn = msg.user_id === userId;
          const name = nameOf(msg.user_id);
          const avatar = avatarOf(msg.user_id);
          const role = roleOf(msg.user_id);
          const replied = msg.reply_to_id ? messagesById[msg.reply_to_id] : null;
          const msgReactions = reactions.filter((r) => r.message_id === msg.id);
          const grouped = msgReactions.reduce<Record<string, Reaction[]>>((acc, r) => {
            (acc[r.emoji] = acc[r.emoji] || []).push(r);
            return acc;
          }, {});

          const nameClass =
            role === "admin" ? "chat-msg-name-admin" : role === "moderator" ? "chat-msg-name-mod" : "chat-msg-name-user";

          return (
            <div key={msg.id} className={`chat-row${isOwn ? " own" : ""}`}>
              <div className="chat-avatar" onClick={() => goToProfile(msg.user_id)} title={`Voir le profil de ${name}`} style={{ cursor: "pointer", ...avatarRing(role) }}>
                {avatar ? (
                  <img src={avatar} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                ) : (
                  <span>{name[0]?.toUpperCase()}</span>
                )}
              </div>
              <div className="chat-bubble-wrap">
                <div className={`chat-msg-name ${nameClass}`}>
                  <span style={{ cursor: "pointer" }} onClick={() => goToProfile(msg.user_id)}>{name}</span>
                  {role === "admin" && <span className="chat-mini-badge admin">👑 Admin</span>}
                  {role === "moderator" && <span className="chat-mini-badge mod">Modo</span>}
                  {role !== "admin" && role !== "moderator" && <span className="chat-mini-badge eleve">🎓 Élève</span>}
                </div>


                {replied && (
                  <div className="msg-reply-quote">
                    <span className="rq-name">{nameOf(replied.user_id)}</span>
                    {replied.image_url ? "📷 Image" : replied.content.slice(0, 80)}
                  </div>
                )}

                {msg.deleted_at ? (
                  canModerate ? (
                    <div>
                      <div
                        className={`chat-bubble${isOwn ? " own" : ""}`}
                        style={{
                          background: "rgba(220,38,38,0.12)",
                          border: "1px solid rgba(239,68,68,0.4)",
                          color: "#fecaca",
                          textDecoration: "line-through",
                          opacity: 0.75,
                        }}
                      >
                        {msg.content}
                        <div style={{ fontSize: 11, marginTop: 4, color: "#fca5a5", fontStyle: "italic", textDecoration: "none" }}>
                          supprimé à {new Date(msg.deleted_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      {isAdmin && (
                        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                          <button
                            onClick={() => void restoreMessage(msg.id)}
                            style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.1)", color: "#86efac", cursor: "pointer" }}
                          >
                            ↩ Restaurer
                          </button>
                          <button
                            onClick={() => void hardDeleteMessage(msg.id)}
                            style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.1)", color: "#fca5a5", cursor: "pointer" }}
                          >
                            🗑 Supprimer définitivement
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`chat-bubble${isOwn ? " own" : ""}`}
                      style={{ background: "rgba(75,75,75,0.3)", color: "#7a7a7a", fontStyle: "italic" }}
                    >
                      {name} a supprimé ce message
                    </div>
                  )
                ) : editingMsg === msg.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 200 }}>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      autoFocus
                      rows={2}
                      style={{ background: "rgba(15,5,30,0.9)", border: "1px solid rgba(168,85,247,0.5)", borderRadius: 8, color: "#e2d4f8", padding: "8px 10px", fontSize: 13, resize: "vertical", width: "100%", boxSizing: "border-box" }}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void editMessage(msg, editContent); } if (e.key === "Escape") { setEditingMsg(null); setEditContent(""); } }}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => void editMessage(msg, editContent)} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(168,85,247,0.4)", background: "rgba(168,85,247,0.2)", color: "#e2d4f8", cursor: "pointer", fontWeight: 700 }}>✓ Sauvegarder</button>
                      <button onClick={() => { setEditingMsg(null); setEditContent(""); }} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9a7dbd", cursor: "pointer" }}>Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div className={`chat-bubble${isOwn ? " own" : ""}`}>
                    {msg.content}
                    {msg.edited && <span style={{ fontSize: 10, color: "#7c5c9a", marginLeft: 6, fontStyle: "italic" }}>(modifié)</span>}
                    {msg.image_url && (
                      <img
                        src={msg.image_url}
                        alt=""
                        style={{ display: "block", maxWidth: 200, maxHeight: 200, objectFit: "cover", borderRadius: 12, cursor: "pointer", marginTop: msg.content ? 8 : 0 }}
                        onClick={(e) => { e.stopPropagation(); setLightboxImg(msg.image_url!); }}
                      />
                    )}
                  </div>
                )}

                {!msg.deleted_at && Object.keys(grouped).length > 0 && (
                  <div className="reactions-row">
                    {Object.entries(grouped).map(([emoji, list]) => {
                      const mine = list.some((r) => r.user_id === userId);
                      return (
                        <span
                          key={emoji}
                          className={`reaction-chip${mine ? " mine" : ""}`}
                          onClick={() => setReactionPopup(reactionPopup?.msgId === msg.id && reactionPopup?.emoji === emoji ? null : { list, emoji, msgId: msg.id })}
                          title="Voir les réactions"
                        >
                          {emoji} <strong>{list.length}</strong>
                        </span>
                      );
                    })}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className={`chat-time${isOwn ? " own" : ""}`}>
                    {new Date(msg.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  {!msg.deleted_at && (
                    <div className="msg-actions" style={{ position: "relative" }}>
                      <button className="msg-action-btn" onClick={() => setPickerFor(pickerFor === msg.id ? null : msg.id)}>
                        😊
                      </button>
                      <button className="msg-action-btn" onClick={() => setReplyTo(msg)}>↩ Répondre</button>
                      {(isOwn || isAdmin) && !msg.deleted_at && (
                        <button className="msg-action-btn" onClick={() => setMenuFor(menuFor === msg.id ? null : msg.id)} title="Plus">⋯</button>
                      )}
                      {canModerate && roleOf(msg.user_id) !== "admin" && msg.user_id !== userId && (
                        <button className="msg-action-btn" onClick={() => void deleteMessage(msg.id)} title="Supprimer">
                          🗑
                        </button>
                      )}
                      {canModerate && roleOf(msg.user_id) !== "admin" && msg.user_id !== userId && (
                        mutedSet.has(msg.user_id) ? (
                          <button className="msg-action-btn" onClick={() => void unmuteUser(msg.user_id)}>🔊</button>
                        ) : (
                          <button className="msg-action-btn" onClick={() => void muteUser(msg.user_id)} title="Muter">🔇</button>
                        )
                      )}
                      {isAdmin && !isOwn && roleOf(msg.user_id) !== "admin" && !msg.deleted_at && !msg.hidden_by_admin && (
                        <button
                          className="msg-action-btn"
                          onClick={() => void hideMessage(msg.id)}
                          title="Masquer pour tous sauf l'auteur"
                        >
                          👁
                        </button>
                      )}
                      {pickerFor === msg.id && (
                        <div className="reaction-picker" style={isOwn ? { right: 0 } : { left: 0 }}>
                          {EMOJI_LIST.map((e) => (
                            <button key={e} onClick={() => void toggleReaction(msg.id, e)}>{e}</button>
                          ))}
                        </div>
                      )}
                      {menuFor === msg.id && (isOwn || isAdmin) && (
                        <div className="reaction-picker" style={{ ...(isOwn ? { right: 0 } : { left: 0 }), padding: 6, display: "flex", flexDirection: "column", gap: 4, minWidth: 140 }}>
                          <button
                            onClick={() => { setMenuFor(null); setEditingMsg(msg.id); setEditContent(msg.content); }}
                            style={{ background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.4)", color: "#e2d4f8", padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap", textAlign: "left" }}
                          >
                            ✏️ Modifier
                          </button>
                          {isOwn && (
                            <button
                              onClick={() => { setMenuFor(null); void deleteMessage(msg.id); }}
                              style={{ background: "rgba(220,38,38,0.2)", border: "1px solid rgba(239,68,68,0.4)", color: "#fecaca", padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap", textAlign: "left" }}
                            >
                              🗑 Supprimer
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div style={{ padding: "8px 16px", background: "rgba(168,85,247,0.1)", borderTop: "1px solid rgba(168,85,247,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, fontSize: 12, color: "#c4a3f0" }}>
            <strong>Réponse à {nameOf(replyTo.user_id)} :</strong> {replyTo.content.slice(0, 80)}
          </div>
          <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
      )}

      {reactionPopup && (
        <div onClick={() => setReactionPopup(null)} style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "rgba(16,6,36,0.98)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 14, width: "100%", maxWidth: 320, maxHeight: "60vh", display: "flex", flexDirection: "column" }}>
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
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(124,58,237,0.2)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...avatarRing(rl) }}>
                      {av ? <img src={av} alt={n} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#c4a3f0", fontWeight: 700, fontSize: 11 }}>{n[0]?.toUpperCase()}</span>}
                    </div>
                    <span style={{ color: "#f0e8ff", fontSize: 13, fontWeight: 600, flex: 1 }}>{n}</span>
                    <RoleBadgeMini role={rl} />
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(168,85,247,0.15)" }}>
              <button
                onClick={() => { void toggleReaction(reactionPopup.msgId, reactionPopup.emoji); setReactionPopup(null); }}
                style={{ width: "100%", background: reactionPopup.list.some(x => x.user_id === userId) ? "rgba(239,68,68,0.15)" : "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.35)", color: "#f0e8ff", borderRadius: 8, padding: "8px 0", cursor: "pointer", fontWeight: 700, fontSize: 13 }}
              >
                {reactionPopup.list.some(x => x.user_id === userId) ? "✕ Retirer ma réaction" : `${reactionPopup.emoji} Réagir`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="chat-input-row">
        <button
          type="button"
          onClick={() => imgRef.current?.click()}
          disabled={imageUploading || (mutedSet.has(userId) && !isAdmin)}
          title="Envoyer une image"
          style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#9a7dbd", padding: "0 4px", opacity: imageUploading ? 0.5 : 1, flexShrink: 0 }}
        >{imageUploading ? "⏳" : "📎"}</button>
        <input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadGroupImage(f); e.target.value = ""; }} />
        <input
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={mutedSet.has(userId) && !isAdmin ? "🔇 Tu as été muté" : "Envoie un message au groupe…"}
          maxLength={1000}
          disabled={mutedSet.has(userId) && !isAdmin}
        />
        <button
          className="chat-send-btn"
          onClick={send}
          disabled={sending || !input.trim() || (mutedSet.has(userId) && !isAdmin)}
          style={{ opacity: !input.trim() ? 0.5 : 1 }}
        >
          ➤
        </button>
      </div>

      {lightboxImg && (
        <div onClick={() => setLightboxImg(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(20px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <button onClick={() => setLightboxImg(null)} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", fontSize: 22, width: 40, height: 40, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          <img src={lightboxImg} alt="" style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 12 }} onClick={(e) => e.stopPropagation()} />
        </div>
      )}

    </div>
  );
}
