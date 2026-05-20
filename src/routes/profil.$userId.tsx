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

type FollowEntry = { id: string; username: string | null; full_name: string | null; avatar_url: string | null };

function ProfilPage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [role, setRole] = useState<string>("user");
  const [isFollowing, setIsFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [listOpen, setListOpen] = useState<null | "followers" | "following">(null);
  const [listData, setListData] = useState<FollowEntry[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const openList = async (kind: "followers" | "following") => {
    setListOpen(kind);
    setListLoading(true);
    setListData([]);
    const col = kind === "followers" ? "follower_id" : "following_id";
    const matchCol = kind === "followers" ? "following_id" : "follower_id";
    const { data: rows } = await supabase.from("follows").select(col).eq(matchCol, userId);
    const ids = (rows ?? []).map((r: any) => r[col]).filter(Boolean);
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username, full_name, avatar_url").in("id", ids);
      setListData((profs ?? []) as FollowEntry[]);
    }
    setListLoading(false);
  };

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
            <button onClick={() => void openList("followers")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{profile.followers_count ?? 0}</div>
              <div style={{ fontSize: 12, color: "#9a7dbd", textTransform: "uppercase", letterSpacing: 0.5 }}>Abonnés</div>
            </button>
            <div style={{ width: 1, background: "rgba(168,85,247,0.2)" }} />
            <button onClick={() => void openList("following")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{profile.following_count ?? 0}</div>
              <div style={{ fontSize: 12, color: "#9a7dbd", textTransform: "uppercase", letterSpacing: 0.5 }}>Abonnements</div>
            </button>
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

      {listOpen && (
        <div onClick={() => setListOpen(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, maxHeight: "80vh", overflowY: "auto", background: "rgba(20,8,40,0.98)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 14 }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(168,85,247,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ color: "#f0e8ff" }}>{listOpen === "followers" ? "Abonnés" : "Abonnements"}</strong>
              <button onClick={() => setListOpen(null)} style={{ background: "none", border: "none", color: "#c4a3f0", fontSize: 20, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ padding: 8 }}>
              {listLoading ? (
                <div style={{ padding: 24, textAlign: "center", color: "#9a7dbd" }}>Chargement…</div>
              ) : listData.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "#9a7dbd", fontSize: 14 }}>
                  {listOpen === "followers" ? "Pas encore d'abonné pour l'instant" : "Pas encore d'abonnement"}
                </div>
              ) : listData.map((u) => {
                const n = u.full_name || u.username || "Élève";
                return (
                  <Link key={u.id} to="/profil/$userId" params={{ userId: u.id }} onClick={() => setListOpen(null)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, textDecoration: "none", color: "#f0e8ff" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(124,58,237,0.2)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {u.avatar_url ? <img src={u.avatar_url} alt={n} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#c4a3f0", fontWeight: 700 }}>{n[0]?.toUpperCase()}</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{n}</div>
                      {u.username && <div style={{ fontSize: 12, color: "#9a7dbd" }}>@{u.username}</div>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
