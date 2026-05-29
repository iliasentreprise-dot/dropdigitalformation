import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type Notif = {
  id: string;
  kind: "dm" | "comment" | "admin_post";
  title: string;
  body: string;
  at: string;
  to: { route: string; params?: Record<string, string> } | null;
};

const SEEN_KEY = (uid: string) => `dd_notif_seen_${uid}`;

export function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [lastSeen, setLastSeen] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem(SEEN_KEY(userId)) || "0");
  });

  const load = async () => {
    // 1. DMs received
    const { data: dms } = await supabase
      .from("private_messages")
      .select("id, content, created_at, sender_id")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(15);

    // 2. Comments on MY results (replies to my posts)
    const { data: myResults } = await supabase
      .from("results")
      .select("id")
      .eq("user_id", userId);
    const myResultIds = (myResults ?? []).map((r) => r.id);
    let comments: { id: string; body: string; created_at: string; user_id: string; result_id: string }[] = [];
    if (myResultIds.length) {
      const { data: cs } = await supabase
        .from("result_comments")
        .select("id, body, created_at, user_id, result_id")
        .in("result_id", myResultIds)
        .neq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(15);
      comments = cs ?? [];
    }

    // 3. Admin results (new posts by admin)
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = (adminRoles ?? []).map((r) => r.user_id);
    let adminPosts: { id: string; content: string; created_at: string; user_id: string }[] = [];
    if (adminIds.length) {
      const { data: rs } = await supabase
        .from("results")
        .select("id, content, created_at, user_id")
        .in("user_id", adminIds)
        .order("created_at", { ascending: false })
        .limit(10);
      adminPosts = rs ?? [];
    }

    // Resolve sender names
    const senderIds = Array.from(new Set([
      ...(dms ?? []).map((d) => d.sender_id),
      ...comments.map((c) => c.user_id),
      ...adminPosts.map((p) => p.user_id),
    ]));
    const nameMap = new Map<string, string>();
    if (senderIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, full_name")
        .in("id", senderIds);
      (profs ?? []).forEach((p: any) => nameMap.set(p.id, p.full_name || p.username || "Utilisateur"));
    }

    const merged: Notif[] = [
      ...(dms ?? []).map<Notif>((d) => ({
        id: `dm-${d.id}`,
        kind: "dm",
        title: `💬 ${nameMap.get(d.sender_id) || "Quelqu'un"}`,
        body: d.content?.slice(0, 80) ?? "",
        at: d.created_at,
        to: { route: "/messages/$userId", params: { userId: d.sender_id } },
      })),
      ...comments.map<Notif>((c) => ({
        id: `cm-${c.id}`,
        kind: "comment",
        title: `↩️ ${nameMap.get(c.user_id) || "Quelqu'un"} a répondu à ton post`,
        body: c.body?.slice(0, 80) ?? "",
        at: c.created_at,
        to: null,
      })),
      ...adminPosts.map<Notif>((p) => ({
        id: `ap-${p.id}`,
        kind: "admin_post",
        title: `👑 Nouveau post de l'admin`,
        body: p.content?.slice(0, 80) ?? "",
        at: p.created_at,
        to: null,
      })),
    ].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 30);

    setNotifs(merged);
  };

  useEffect(() => {
    void load();
    const ch = supabase
      .channel(`notif-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "private_messages", filter: `recipient_id=eq.${userId}` }, () => void load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "result_comments" }, () => void load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "results" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const unread = useMemo(() => notifs.filter((n) => +new Date(n.at) > lastSeen).length, [notifs, lastSeen]);

  const markSeen = () => {
    const now = Date.now();
    localStorage.setItem(SEEN_KEY(userId), String(now));
    setLastSeen(now);
  };

  const toggle = () => {
    setOpen((o) => {
      const nv = !o;
      if (nv) markSeen();
      return nv;
    });
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={toggle}
        aria-label="Notifications"
        style={{
          background: "rgba(124,58,237,0.15)",
          border: "1px solid rgba(168,85,247,0.3)",
          color: "#f0e8ff",
          width: 40, height: 40, borderRadius: 20,
          cursor: "pointer", fontSize: 18,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative",
        }}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: "absolute", top: -2, right: -2,
            background: "#ef4444", color: "#fff",
            fontSize: 10, fontWeight: 800,
            minWidth: 18, height: 18, borderRadius: 9,
            padding: "0 5px",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid oklch(0.129 0.042 264.695)",
          }}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 998 }} />
          <div style={{
            position: "absolute", top: 48, right: 0, zIndex: 999,
            width: 340, maxWidth: "92vw", maxHeight: 460, overflowY: "auto",
            background: "rgba(20,8,40,0.98)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(168,85,247,0.3)", borderRadius: 12,
            boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
          }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(168,85,247,0.2)", fontWeight: 700, color: "#f0e8ff" }}>
              Notifications
            </div>
            {notifs.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "#9a7dbd", fontSize: 13 }}>
                Aucune notification pour l'instant
              </div>
            ) : notifs.map((n) => {
              const inner = (
                <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(168,85,247,0.1)", cursor: n.to ? "pointer" : "default" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#f0e8ff", marginBottom: 2 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: "#c4a3f0", lineHeight: 1.4 }}>{n.body}</div>
                  <div style={{ fontSize: 10, color: "#7a5a9d", marginTop: 4 }}>{new Date(n.at).toLocaleString("fr-FR")}</div>
                </div>
              );
              return n.to ? (
                <Link key={n.id} to={n.to.route} params={n.to.params as any} onClick={() => setOpen(false)} style={{ textDecoration: "none", display: "block" }}>
                  {inner}
                </Link>
              ) : (
                <div key={n.id}>{inner}</div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
