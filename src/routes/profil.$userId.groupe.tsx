import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import "../styles/dropdigital.css";

type GroupMsg = {
  id: string;
  user_id: string;
  content: string;
  visible: boolean;
  created_at: string;
  deleted_at: string | null;
};

type Profile = { id: string; username: string | null; full_name: string | null; avatar_url: string | null };

export const Route = createFileRoute("/profil/$userId/groupe")({
  component: ProfilGroupMessages,
});

function ProfilGroupMessages() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<GroupMsg[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loading && !user) { void navigate({ to: "/login" }); return; }
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: msgs }] = await Promise.all([
        supabase.from("profiles").select("id, username, full_name, avatar_url").eq("id", userId).maybeSingle(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("group_messages")
          .select("id, user_id, content, visible, created_at, deleted_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      setProfile(p as Profile | null);
      const list = ((msgs as GroupMsg[]) ?? []).filter((m) => !m.deleted_at && m.visible);
      setMessages(list);
      setLoaded(true);
    })();
  }, [user, loading, userId, navigate]);

  if (loading || !loaded) {
    return <div style={{ minHeight: "100dvh", background: "oklch(0.129 0.042 264.695)", display: "flex", alignItems: "center", justifyContent: "center", color: "#9a7dbd" }}>Chargement…</div>;
  }

  const name = profile?.full_name || profile?.username || "Élève";

  return (
    <div style={{ minHeight: "100dvh", background: "oklch(0.129 0.042 264.695)", color: "#f0e8ff" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(15,5,30,0.95)", borderBottom: "1px solid rgba(168,85,247,0.2)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link to="/profil/$userId" params={{ userId }} style={{ color: "#c4a3f0", fontSize: 13, textDecoration: "none" }}>← Profil</Link>
        <h1 style={{ fontSize: 15, margin: 0, flex: 1 }}>👥 Messages de {name} dans le groupe</h1>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "#6b4fa0", padding: 40, fontSize: 14 }}>
            {name} n'a pas encore posté de message dans le groupe.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{ background: "rgba(25,10,48,0.7)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 14, lineHeight: 1.5, color: "#fff", wordBreak: "break-word" }}>{m.content}</div>
            <div style={{ fontSize: 11, color: "#6b4fa0", marginTop: 6 }}>
              {new Date(m.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
