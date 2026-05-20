import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import "../styles/dropdigital.css";

type PublicProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  followers_count: number | null;
  following_count: number | null;
};

export const Route = createFileRoute("/profil/$userId")({
  component: ProfilPage,
});

function ProfilPage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [role, setRole] = useState<string>("user");
  const [isFollowing, setIsFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loading && !user) { void navigate({ to: "/login" }); return; }
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: roleRows }, { data: f }] = await Promise.all([
        supabase.from("profiles").select("id, username, full_name, avatar_url, bio, followers_count, following_count").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("follows").select("follower_id").eq("follower_id", user.id).eq("following_id", userId).maybeSingle(),
      ]);
      setProfile(p as PublicProfile | null);
      const priority: Record<string, number> = { admin: 3, moderator: 2, user: 1 };
      const top = (roleRows ?? []).reduce<string>((b, r) => ((priority[r.role] ?? 0) > (priority[b] ?? 0) ? r.role : b), "user");
      setRole(top);
      setIsFollowing(!!f);
      setLoaded(true);
    })();
  }, [user, loading, userId, navigate]);

  const toggleFollow = async () => {
    if (!user || user.id === userId) return;
    setBusy(true);
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", userId);
      setIsFollowing(false);
      setProfile((p) => p ? { ...p, followers_count: Math.max(0, (p.followers_count ?? 0) - 1) } : p);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: userId });
      setIsFollowing(true);
      setProfile((p) => p ? { ...p, followers_count: (p.followers_count ?? 0) + 1 } : p);
    }
    setBusy(false);
  };

  if (loading || !loaded) {
    return <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", color: "#9a7dbd", background: "oklch(0.129 0.042 264.695)" }}>Chargement…</div>;
  }
  if (!profile) {
    return <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", color: "#9a7dbd", background: "oklch(0.129 0.042 264.695)" }}>Profil introuvable.</div>;
  }

  const name = profile.full_name || profile.username || "Élève";
  const isMe = user?.id === userId;

  return (
    <div style={{ minHeight: "100dvh", background: "oklch(0.129 0.042 264.695)", color: "#f0e8ff", padding: "24px 16px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <Link to="/" style={{ color: "#c4a3f0", fontSize: 13, textDecoration: "none", display: "inline-block", marginBottom: 20 }}>← Retour</Link>

        <div style={{ background: "rgba(25,10,48,0.7)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 16, padding: "32px 24px", textAlign: "center" }}>
          <div style={{ width: 140, height: 140, borderRadius: "50%", margin: "0 auto 18px", background: "rgba(124,58,237,0.2)", border: "3px solid rgba(168,85,247,0.4)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 56, color: "#c4a3f0" }}>{name[0]?.toUpperCase()}</span>
            )}
          </div>

          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{name}</div>
          {profile.username && profile.full_name && (
            <div style={{ fontSize: 14, color: "#9a7dbd", marginBottom: 10 }}>@{profile.username}</div>
          )}

          <div style={{ marginBottom: 16 }}>
            {role === "admin" && <span className="chat-mini-badge admin" style={{ fontSize: 13, padding: "5px 14px", borderRadius: 8 }}>👑 Admin</span>}
            {role === "moderator" && <span className="chat-mini-badge mod" style={{ fontSize: 13, padding: "5px 14px", borderRadius: 8 }}>Modérateur</span>}
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 36, margin: "20px 0 24px" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{profile.followers_count ?? 0}</div>
              <div style={{ fontSize: 12, color: "#9a7dbd", textTransform: "uppercase", letterSpacing: 0.5 }}>Abonnés</div>
            </div>
            <div style={{ width: 1, background: "rgba(168,85,247,0.2)" }} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{profile.following_count ?? 0}</div>
              <div style={{ fontSize: 12, color: "#9a7dbd", textTransform: "uppercase", letterSpacing: 0.5 }}>Abonnements</div>
            </div>
          </div>

          {profile.bio && (
            <p style={{ color: "#c4a3f0", fontSize: 14, lineHeight: 1.6, margin: "0 0 24px", maxWidth: 440, marginInline: "auto" }}>{profile.bio}</p>
          )}

          {!isMe && (
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => void toggleFollow()}
                disabled={busy}
                style={{
                  background: isFollowing ? "rgba(124,58,237,0.2)" : "linear-gradient(135deg, #7c3aed, #a855f7)",
                  color: "#fff", border: isFollowing ? "1px solid rgba(168,85,247,0.5)" : "none",
                  padding: "10px 22px", borderRadius: 22, fontWeight: 700, fontSize: 14, cursor: "pointer",
                }}
              >
                {busy ? "…" : isFollowing ? "✓ Abonné" : "+ S'abonner"}
              </button>
              <Link
                to="/messages/$userId"
                params={{ userId }}
                style={{ background: "linear-gradient(135deg, #ec4899, #f43f5e)", color: "#fff", padding: "10px 22px", borderRadius: 22, fontWeight: 700, fontSize: 14, textDecoration: "none" }}
              >
                💬 Message privé
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
