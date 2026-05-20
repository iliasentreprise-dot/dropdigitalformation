import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import "../styles/dropdigital.css";

const sendDmFn = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const { senderId, recipientId, content, senderName, recipientName } = (data as unknown) as { senderId: string; recipientId: string; content: string; senderName: string; recipientName: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sa = supabaseAdmin as any;
    const { data: msg, error } = await sa
      .from("private_messages")
      .insert({ sender_id: senderId, recipient_id: recipientId, content })
      .select()
      .single();
    if (error) throw new Error((error as { message: string }).message);
    // Notify admin of all DMs
    const { data: adminRow } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    if (adminRow?.user_id && adminRow.user_id !== senderId && adminRow.user_id !== recipientId) {
      const preview = content.length > 50 ? content.slice(0, 50) + "…" : content;
      await sa.from("notifications").insert({
        user_id: adminRow.user_id,
        message: `[DM] ${senderName} → ${recipientName} : ${preview}`,
      });
    }
    return msg;
  });

type PMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  deleted_at: string | null;
};

type MiniProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type Role = "admin" | "moderator" | "user";

export const Route = createFileRoute("/messages/$userId")({
  component: MessagesPage,
});

function MessagesPage() {
  const { userId: otherId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [other, setOther] = useState<MiniProfile | null>(null);
  const [messages, setMessages] = useState<PMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [me, setMe] = useState<MiniProfile | null>(null);
  const [myRole, setMyRole] = useState<Role>("user");
  const [otherRole, setOtherRole] = useState<Role>("user");
  const [hasAcceptedMe, setHasAcceptedMe] = useState<boolean | null>(null); // other accepted my messages
  const [iHaveAccepted, setIHaveAccepted] = useState<boolean | null>(null); // I accepted theirs
  const [otherPresence, setOtherPresence] = useState<{ is_online: boolean } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) { void navigate({ to: "/login" }); return; }
    if (!user) return;

    (async () => {
      const [{ data: prof }, { data: myProf }, { data: rolesData }, { data: msgs }, { data: accs }, { data: presRow }] = await Promise.all([
        supabase.from("profiles").select("id, username, full_name, avatar_url").eq("id", otherId).maybeSingle(),
        supabase.from("profiles").select("id, username, full_name, avatar_url").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("user_id, role").in("user_id", [user.id, otherId]),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("private_messages")
          .select("*")
          .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${user.id})`)
          .order("created_at", { ascending: true })
          .limit(500),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("dm_acceptances")
          .select("recipient_id, sender_id")
          .or(`and(recipient_id.eq.${user.id},sender_id.eq.${otherId}),and(recipient_id.eq.${otherId},sender_id.eq.${user.id})`),
        supabase.from("user_presence").select("is_online, last_seen").eq("user_id", otherId).maybeSingle(),
      ]);
      setOther(prof as MiniProfile | null);
      setMe(myProf as MiniProfile | null);
      const rmap: Record<string, Role> = {};
      for (const r of (rolesData ?? []) as { user_id: string; role: string }[]) {
        const cur = rmap[r.user_id];
        if (r.role === "admin") rmap[r.user_id] = "admin";
        else if (r.role === "moderator" && cur !== "admin") rmap[r.user_id] = "moderator";
        else if (!cur) rmap[r.user_id] = "user";
      }
      setMyRole(rmap[user.id] ?? "user");
      setOtherRole(rmap[otherId] ?? "user");
      setIsAdmin(rmap[user.id] === "admin");
      setMessages((msgs as PMessage[]) ?? []);
      const list = (accs as { recipient_id: string; sender_id: string }[] | null) ?? [];
      setIHaveAccepted(list.some((a) => a.recipient_id === user.id && a.sender_id === otherId));
      setHasAcceptedMe(list.some((a) => a.recipient_id === otherId && a.sender_id === user.id));
      if (presRow) {
        const p = presRow as { is_online: boolean; last_seen: string | null };
        setOtherPresence({ is_online: !!(p.is_online && p.last_seen && Date.now() - new Date(p.last_seen).getTime() < 2 * 60 * 1000) });
      }
    })();

    const channel = supabase
      .channel(`pm_${user.id}_${otherId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "private_messages" }, (payload) => {
        const m = payload.new as PMessage;
        const matches =
          (m.sender_id === user.id && m.recipient_id === otherId) ||
          (m.sender_id === otherId && m.recipient_id === user.id);
        if (matches) setMessages((prev) => (prev.find((x) => x.id === m.id) ? prev : [...prev, m]));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "private_messages" }, (payload) => {
        const m = payload.new as PMessage;
        setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_acceptances" }, (payload) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = (payload.new ?? payload.old) as any;
        if (!row) return;
        const isInsert = payload.eventType === "INSERT";
        if (row.recipient_id === user.id && row.sender_id === otherId) setIHaveAccepted(isInsert);
        if (row.recipient_id === otherId && row.sender_id === user.id) setHasAcceptedMe(isInsert);
      })
      .subscribe();

    const presChannel = supabase
      .channel(`dm_presence_${otherId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_presence", filter: `user_id=eq.${otherId}` }, (payload) => {
        const row = payload.new as { is_online: boolean; last_seen: string | null } | undefined;
        if (!row) return;
        setOtherPresence({ is_online: !!(row.is_online && row.last_seen && Date.now() - new Date(row.last_seen).getTime() < 2 * 60 * 1000) });
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); void supabase.removeChannel(presChannel); };
  }, [user, loading, otherId, navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!user || !input.trim() || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");
    try {
      const msg = await (sendDmFn as unknown as (args: { data: { senderId: string; recipientId: string; content: string; senderName: string; recipientName: string } }) => Promise<PMessage>)({
        data: {
          senderId: user.id,
          recipientId: otherId,
          content,
          senderName: me?.full_name || me?.username || user.email || "Élève",
          recipientName: other?.full_name || other?.username || "Élève",
        },
      });
      if (msg) setMessages((prev) => (prev.find((x) => x.id === msg.id) ? prev : [...prev, msg]));
    } catch (e) {
      alert((e as Error).message);
    }
    setSending(false);
  };

  const acceptDM = async () => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("dm_acceptances").upsert({ recipient_id: user.id, sender_id: otherId });
    setIHaveAccepted(true);
  };

  const softDelete = async (id: string) => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("private_messages")
      .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
      .eq("id", id);
  };

  const restoreMessage = async (id: string) => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("private_messages")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", id);
  };

  if (loading || !user) {
    return <div style={{ minHeight: "100dvh", background: "oklch(0.129 0.042 264.695)" }} />;
  }

  const name = other?.full_name || other?.username || "Élève";
  const myName = me?.full_name || me?.username || "Moi";
  const otherSentToMe = messages.some((m) => m.sender_id === otherId && m.recipient_id === user.id);
  const iSentToOther = messages.some((m) => m.sender_id === user.id && m.recipient_id === otherId);
  const showAcceptBanner = otherSentToMe && iHaveAccepted === false;
  const showPending = iSentToOther && hasAcceptedMe === false;

  const roleBadge = (role: Role, size: "sm" | "md" = "sm") => {
    if (role === "user") return null;
    const isAdminB = role === "admin";
    const fs = size === "md" ? 11 : 10;
    const pad = size === "md" ? "3px 9px" : "2px 7px";
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4, padding: pad, borderRadius: 999,
        fontSize: fs, fontWeight: 800, letterSpacing: 0.3,
        background: isAdminB ? "linear-gradient(135deg,#ffd700,#ffb700)" : "linear-gradient(135deg,#ef4444,#dc2626)",
        color: isAdminB ? "#3b2a00" : "#fff",
        boxShadow: isAdminB
          ? "0 0 12px rgba(255,215,0,0.7)"
          : "0 0 12px rgba(239,68,68,0.7)",
        animation: isAdminB ? "goldBadgePulse 2s ease-in-out infinite" : "modBadgeFlash 1.6s ease-in-out infinite",
      }}>
        {isAdminB ? "👑 ADMIN" : "🏴‍☠️ MODÉRATEUR"}
      </span>
    );
  };

  const headerRing = otherRole === "admin"
    ? { boxShadow: "0 0 0 2px #ffd700, 0 0 16px rgba(255,215,0,0.65)", animation: "goldBadgePulse 2s ease-in-out infinite" }
    : otherRole === "moderator"
    ? { boxShadow: "0 0 0 2px #ef4444, 0 0 16px rgba(239,68,68,0.75)", animation: "modBadgeFlash 1.6s ease-in-out infinite" }
    : {};

  return (
    <div style={{ minHeight: "100dvh", background: "oklch(0.129 0.042 264.695)", color: "#f0e8ff", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(15,5,30,0.95)", borderBottom: "1px solid rgba(168,85,247,0.2)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link to="/messages" style={{ color: "#c4a3f0", fontSize: 13, textDecoration: "none" }}>←</Link>
        <Link to="/profil/$userId" params={{ userId: otherId }} style={{ display: "flex", alignItems: "center", gap: 10, color: "#fff", textDecoration: "none", flex: 1 }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(124,58,237,0.2)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", ...headerRing }}>
            {other?.avatar_url ? (
              <img src={other.avatar_url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ color: "#c4a3f0", fontWeight: 700 }}>{name[0]?.toUpperCase()}</span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{name}</span>
              {roleBadge(otherRole, "md")}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: otherPresence?.is_online ? "#10b981" : "#6b7280", boxShadow: otherPresence?.is_online ? "0 0 5px #10b981" : "none", display: "inline-block" }} />
              <span style={{ fontSize: 11, color: otherPresence?.is_online ? "#10b981" : "#9a7dbd" }}>
                {otherPresence === null ? "Message privé" : otherPresence.is_online ? "En ligne" : "Hors ligne"}
              </span>
            </div>
          </div>
        </Link>
      </div>

      {showAcceptBanner && (
        <div style={{ background: "rgba(124,58,237,0.18)", borderBottom: "1px solid rgba(168,85,247,0.25)", padding: "10px 14px", display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ flex: 1, fontSize: 13, color: "#c4a3f0" }}>
            <strong>{name}</strong> souhaite t'envoyer des messages.
          </div>
          <button onClick={() => void acceptDM()} style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 18, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Accepter
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "#6b4fa0", paddingTop: 40 }}>Aucun message. Lance la conversation 👋</div>
        )}
        {messages.map((m) => {
          const own = m.sender_id === user.id;
          const isDeleted = !!m.deleted_at;
          const senderName = own ? myName : name;
          const senderRole = own ? myRole : otherRole;
          if (isDeleted && !isAdmin) {
            return (
              <div key={m.id} style={{ alignSelf: own ? "flex-end" : "flex-start", maxWidth: "75%", background: "rgba(75,75,75,0.3)", color: "#7a7a7a", fontStyle: "italic", padding: "8px 14px", borderRadius: 14, fontSize: 13 }}>
                Message supprimé
              </div>
            );
          }
          return (
            <div key={m.id} style={{ alignSelf: own ? "flex-end" : "flex-start", maxWidth: "75%", display: "flex", flexDirection: "column", alignItems: own ? "flex-end" : "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, paddingLeft: own ? 0 : 4, paddingRight: own ? 4 : 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#c4a3f0" }}>{senderName}</span>
                {roleBadge(senderRole, "sm")}
              </div>
              <div style={{
                background: isDeleted
                  ? "rgba(220, 38, 38, 0.25)"
                  : own ? "linear-gradient(135deg, #7c3aed, #a855f7)" : "rgba(30,15,55,0.85)",
                border: isDeleted ? "1px solid rgba(239,68,68,0.6)" : own ? "none" : "1px solid rgba(168,85,247,0.2)",
                color: isDeleted ? "#fecaca" : "#fff",
                borderRadius: own ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                padding: "10px 14px",
                fontSize: 14, lineHeight: 1.5, wordBreak: "break-word",
              }}>
                {m.content}
                {isDeleted && (
                  <div style={{ fontSize: 11, marginTop: 6, color: "#fca5a5", fontStyle: "italic" }}>
                    (message supprimé à {new Date(m.deleted_at!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })})
                  </div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: own ? "flex-end" : "flex-start", gap: 8, marginTop: 3, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "#6b4fa0" }}>
                  {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                {!isDeleted && own && (
                  <button onClick={() => void softDelete(m.id)} title="Supprimer" style={{ background: "none", border: "none", color: "#6b4fa0", fontSize: 11, cursor: "pointer" }}>🗑</button>
                )}
                {isDeleted && isAdmin && (
                  <button onClick={() => void restoreMessage(m.id)} title="Restaurer (rendre public)" style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.5)", color: "#86efac", fontSize: 11, padding: "2px 8px", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>
                    ♻ Restaurer
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {showPending && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 12px", background: "rgba(168,85,247,0.08)", borderTop: "1px solid rgba(168,85,247,0.15)", fontSize: 12, color: "#c4a3f0" }}>
          <span style={{ display: "inline-block", animation: "dmClockSpin 2s linear infinite" }}>⏳</span>
          <span>{name} n'a pas encore accepté votre demande de message</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderTop: "1px solid rgba(168,85,247,0.15)", background: "rgba(14,4,24,0.6)" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder={`Écrire à ${name}…`}
          maxLength={1000}
          style={{ flex: 1, background: "rgba(30,15,55,0.8)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 22, padding: "10px 18px", color: "#fff", fontSize: 14, outline: "none" }}
        />
        <button
          onClick={() => void send()}
          disabled={sending || !input.trim()}
          style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg, #7c3aed, #a855f7)", color: "#fff", border: "none", cursor: "pointer", fontSize: 18, opacity: !input.trim() ? 0.5 : 1 }}
        >
          ➤
        </button>
      </div>
      <style>{`
        @keyframes dmClockSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes goldBadgePulse {
          0%,100% { box-shadow: 0 0 10px rgba(255,215,0,0.55), 0 0 0 2px #ffd700; filter: brightness(1); }
          50%     { box-shadow: 0 0 22px rgba(255,215,0,0.95), 0 0 0 2px #fff4a3; filter: brightness(1.15); }
        }
        @keyframes modBadgeFlash {
          0%,100% { box-shadow: 0 0 10px rgba(239,68,68,0.6), 0 0 0 2px #ef4444; filter: brightness(1); }
          40%     { box-shadow: 0 0 24px rgba(255,80,80,1), 0 0 0 2px #fff; filter: brightness(1.3); }
          70%     { box-shadow: 0 0 18px rgba(239,68,68,0.85), 0 0 0 2px #ef4444; filter: brightness(1.1); }
        }
      `}</style>
    </div>
  );
}
