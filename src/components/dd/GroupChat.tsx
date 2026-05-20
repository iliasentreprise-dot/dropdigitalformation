import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type GroupMessage = {
  id: string;
  user_id: string;
  content: string;
  visible: boolean;
  created_at: string;
  reply_to_id: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
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
    supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", unknownIds)
      .then(({ data }) => {
        if (data?.length) {
          setRoles((prev) => {
            const next = { ...prev };
            for (const r of data as { user_id: string; role: string }[]) {
              const cur = next[r.user_id];
              if (!cur || (r.role === "admin") || (r.role === "moderator" && cur !== "admin")) {
                next[r.user_id] = r.role;
              }
            }
            return next;
          });
        }
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

  const messagesById = useMemo(() => Object.fromEntries(messages.map((m) => [m.id, m])), [messages]);

  const nameOf = (uid: string) => {
    if (uid === userId) return username || "Moi";
    const p = profiles[uid];
    return p?.full_name || p?.username || "Élève";
  };
  const avatarOf = (uid: string) => (uid === userId ? avatarUrl : profiles[uid]?.avatar_url ?? null);
  const roleOf = (uid: string) => (uid === userId ? myRole : roles[uid] ?? "user");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 220px)", minHeight: 380 }}>
      <div className="chat-messages">
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "#6b4fa0", paddingTop: 60, fontSize: 14 }}>
            Aucun message pour l'instant. Sois le premier à dire bonjour 👋
          </div>
        )}
        {messages.map((msg) => {
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
              <div className="chat-avatar" onClick={() => goToProfile(msg.user_id)} title={`Voir le profil de ${name}`} style={{ cursor: "pointer" }}>
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
                </div>


                {replied && (
                  <div className="msg-reply-quote">
                    <span className="rq-name">{nameOf(replied.user_id)}</span>
                    {replied.content.slice(0, 80)}
                  </div>
                )}

                {msg.deleted_at ? (
                  canModerate ? (
                    <div
                      className={`chat-bubble${isOwn ? " own" : ""}`}
                      style={{
                        background: "rgba(220,38,38,0.22)",
                        border: "1px solid rgba(239,68,68,0.55)",
                        color: "#fecaca",
                      }}
                    >
                      {msg.content}
                      <div style={{ fontSize: 11, marginTop: 6, color: "#fca5a5", fontStyle: "italic" }}>
                        (message supprimé à {new Date(msg.deleted_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })})
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`chat-bubble${isOwn ? " own" : ""}`}
                      style={{ background: "rgba(75,75,75,0.3)", color: "#7a7a7a", fontStyle: "italic" }}
                    >
                      {name} a supprimé ce message
                    </div>
                  )
                ) : (
                  <div className={`chat-bubble${isOwn ? " own" : ""}`}>{msg.content}</div>
                )}

                {!msg.deleted_at && Object.keys(grouped).length > 0 && (
                  <div className="reactions-row">
                    {Object.entries(grouped).map(([emoji, list]) => {
                      const mine = list.some((r) => r.user_id === userId);
                      return (
                        <span
                          key={emoji}
                          className={`reaction-chip${mine ? " mine" : ""}`}
                          onClick={() => void toggleReaction(msg.id, emoji)}
                          title={mine ? "Retirer" : "Réagir"}
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
                      {isOwn && (
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
                      {pickerFor === msg.id && (
                        <div className="reaction-picker" style={isOwn ? { right: 0 } : { left: 0 }}>
                          {EMOJI_LIST.map((e) => (
                            <button key={e} onClick={() => void toggleReaction(msg.id, e)}>{e}</button>
                          ))}
                        </div>
                      )}
                      {menuFor === msg.id && isOwn && (
                        <div className="reaction-picker" style={{ ...(isOwn ? { right: 0 } : { left: 0 }), padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                          <button
                            onClick={() => { setMenuFor(null); void deleteMessage(msg.id); }}
                            style={{ background: "rgba(220,38,38,0.2)", border: "1px solid rgba(239,68,68,0.4)", color: "#fecaca", padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}
                          >
                            🗑 Supprimer
                          </button>
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

      <div className="chat-input-row">
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

    </div>
  );
}
