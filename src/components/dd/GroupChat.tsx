import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type GroupMessage = {
  id: string;
  user_id: string;
  content: string;
  visible: boolean;
  hidden_by_admin: boolean;
  created_at: string;
};

type GProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export function GroupChat({
  userId,
  username,
  avatarUrl,
  isAdmin = false,
}: {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  isAdmin?: boolean;
}) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, GProfile>>({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("group_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(200);
      setMessages((data as unknown as GroupMessage[]) ?? []);
    };
    void load();

    const channel = supabase
      .channel("group_chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages" }, (payload) => {
        const msg = payload.new as GroupMessage;
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "group_messages" }, (payload) => {
        const updated = payload.new as GroupMessage;
        // If hidden by admin and current user is not the author, remove from view
        if (updated.hidden_by_admin && updated.user_id !== userId) {
          setMessages((prev) => prev.filter((m) => m.id !== updated.id));
        } else {
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "group_messages" }, (payload) => {
        const deleted = payload.old as { id: string };
        setMessages((prev) => prev.filter((m) => m.id !== deleted.id));
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`[data-chat-menu="${openMenuId}"]`)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenuId]);

  // Fetch profiles for unknown senders
  useEffect(() => {
    const unknownIds = [...new Set(messages.map((m) => m.user_id).filter((id) => !profiles[id]))];
    if (!unknownIds.length) return;
    supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", unknownIds)
      .then(({ data }) => {
        if (data?.length) {
          setProfiles((prev) => ({
            ...prev,
            ...Object.fromEntries((data as GProfile[]).map((p) => [p.id, p])),
          }));
        }
      });
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("group_messages")
      .insert({ user_id: userId, content })
      .select()
      .single();
    if (data) {
      setMessages((prev) => {
        const row = data as unknown as GroupMessage;
        if (prev.find((m) => m.id === row.id)) return prev;
        return [...prev, row];
      });
    }
    setSending(false);
  };

  const hideMessage = async (msgId: string) => {
    setOpenMenuId(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("group_messages")
      .update({ hidden_by_admin: true })
      .eq("id", msgId);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  };

  const deleteMessage = async (msgId: string) => {
    setOpenMenuId(null);
    if (!window.confirm("Supprimer ce message définitivement ?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("group_messages").delete().eq("id", msgId);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  };

  const nameOf = (uid: string) => {
    if (uid === userId) return username || "Moi";
    const p = profiles[uid];
    return p?.full_name || p?.username || "Élève";
  };

  const avatarOf = (uid: string) => {
    if (uid === userId) return avatarUrl;
    return profiles[uid]?.avatar_url ?? null;
  };

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
          const canAdmin = isAdmin && !isOwn;
          const menuOpen = openMenuId === msg.id;
          return (
            <div key={msg.id} className={`chat-row${isOwn ? " own" : ""}${canAdmin ? " adminable" : ""}`}>
              <div className="chat-avatar">
                {avatar ? (
                  <img src={avatar} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                ) : (
                  <span>{name[0]?.toUpperCase()}</span>
                )}
              </div>
              <div className="chat-bubble-wrap">
                {!isOwn && <div className="chat-sender">{name}</div>}
                <div className={`chat-bubble${isOwn ? " own" : ""}`}>{msg.content}</div>
                <div className={`chat-time${isOwn ? " own" : ""}`}>
                  {new Date(msg.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              {canAdmin && (
                <div
                  className="chat-admin-wrap"
                  data-chat-menu={msg.id}
                >
                  <button
                    className="chat-admin-trigger"
                    onClick={() => setOpenMenuId(menuOpen ? null : msg.id)}
                    title="Options admin"
                  >
                    ⋮
                  </button>
                  {menuOpen && (
                    <div className="chat-admin-dropdown">
                      <button
                        className="chat-admin-item"
                        onClick={() => void hideMessage(msg.id)}
                      >
                        👻 Mode discret
                      </button>
                      <button
                        className="chat-admin-item danger"
                        onClick={() => void deleteMessage(msg.id)}
                      >
                        🗑 Supprimer définitivement
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
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
          placeholder="Envoie un message au groupe…"
          maxLength={1000}
        />
        <button
          className="chat-send-btn"
          onClick={send}
          disabled={sending || !input.trim()}
          style={{ opacity: !input.trim() ? 0.5 : 1 }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
