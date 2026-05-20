import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
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
  show_progression: boolean | null;
};

export const Route = createFileRoute("/profil/$userId")({
  component: ProfilPage,
});

type FollowEntry = { id: string; username: string | null; full_name: string | null; avatar_url: string | null };

function avatarRing(role: string): React.CSSProperties {
  if (role === "admin") return { border: "2px solid #FFD700", boxShadow: "0 0 10px #FFD700, 0 0 20px #FFD700" };
  if (role === "moderator") return { border: "2px solid #ef4444", boxShadow: "0 0 10px #ef4444, 0 0 20px #dc2626" };
  return { border: "2px solid #7c3aed" };
}

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
  const [listRoles, setListRoles] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [groupMsgsOpen, setGroupMsgsOpen] = useState(false);
  const [groupMsgs, setGroupMsgs] = useState<{ id: string; content: string; created_at: string }[]>([]);
  const [groupMsgsLoading, setGroupMsgsLoading] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [presence, setPresence] = useState<{ is_online: boolean; last_seen: string | null } | null>(null);
  const [myRole, setMyRole] = useState<string>("user");

  const openList = async (kind: "followers" | "following") => {
    setListOpen(kind);
    setListLoading(true);
    setListData([]);
    setListRoles({});
    const col = kind === "followers" ? "follower_id" : "following_id";
    const matchCol = kind === "followers" ? "following_id" : "follower_id";
    const { data: rows } = await supabase.from("follows").select(col).eq(matchCol, userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = (rows ?? []).map((r: any) => r[col]).filter(Boolean) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username, full_name, avatar_url").in("id", ids);
      setListData((profs ?? []) as FollowEntry[]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: roleRows, error } = await (supabase as any).rpc("get_roles_for_users", { _user_ids: ids });
      if (!error && roleRows?.length) {
        const rm: Record<string, string> = {};
        for (const r of roleRows as { user_id: string; role: string }[]) rm[r.user_id] = r.role;
        setListRoles(rm);
      } else {
        const { data: fb } = await supabase.from("user_roles").select("user_id, role").in("user_id", ids);
        const rm: Record<string, string> = {};
        const pri: Record<string, number> = { admin: 3, moderator: 2, user: 1 };
        for (const r of (fb ?? []) as { user_id: string; role: string }[]) {
          if ((pri[r.role] ?? 0) > (pri[rm[r.user_id]] ?? 0)) rm[r.user_id] = r.role;
        }
        setListRoles(rm);
      }
    }
    setListLoading(false);
  };

  useEffect(() => {
    if (!loading && !user) { void navigate({ to: "/login" }); return; }
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: f }, { data: chapters }, { data: done }] = await Promise.all([
        supabase.from("profiles").select("id, username, full_name, avatar_url, bio, followers_count, following_count, show_progression").eq("id", userId).maybeSingle(),
        supabase.from("follows").select("follower_id").eq("follower_id", user.id).eq("following_id", userId).maybeSingle(),
        supabase.from("chapters").select("id"),
        supabase.from("user_chapter_progress").select("chapter_id").eq("user_id", userId),
      ]);
      setProfile(p as PublicProfile | null);

      // Presence
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pres } = await (supabase as any).from("user_presence").select("is_online, last_seen").eq("user_id", userId).maybeSingle();
      setPresence(pres as { is_online: boolean; last_seen: string | null } | null);

      // My role (for admin-only last_seen display)
      const { data: myRoleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const pri: Record<string, number> = { admin: 3, moderator: 2, user: 1 };
      const topMyRole = ((myRoleRows ?? []) as { role: string }[]).reduce<string>((b, r) => ((pri[r.role] ?? 0) > (pri[b] ?? 0) ? r.role : b), "user");
      setMyRole(topMyRole);

      // Use SECURITY DEFINER RPC — bypasses RLS so regular users can read others' roles
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcRole } = await (supabase as any).rpc("get_top_role", { _user_id: userId });
      if (rpcRole) {
        setRole(rpcRole as string);
      } else {
        // Fallback: direct query (works if RLS policy allows it after migration)
        const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
        const priority: Record<string, number> = { admin: 3, moderator: 2, user: 1 };
        const top = (roleRows ?? []).reduce<string>((b, r) => ((priority[r.role] ?? 0) > (priority[b] ?? 0) ? r.role : b), "user");
        setRole(top);
      }
      setIsFollowing(!!f);
      setProgress({ done: (done ?? []).length, total: (chapters ?? []).length });
      setLoaded(true);
    })();

    // Realtime presence for this profile
    const ch = supabase
      .channel(`profile-presence-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { is_online: boolean; last_seen: string } | null;
          if (row) setPresence({ is_online: row.is_online, last_seen: row.last_seen });
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(ch); };
  }, [user, loading, userId, navigate]);

  const openGroupMessages = async () => {
    setGroupMsgsOpen(true);
    if (groupMsgs.length) return;
    setGroupMsgsLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("group_messages")
      .select("id, content, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("visible", true)
      .order("created_at", { ascending: true })
      .limit(200);
    setGroupMsgs((data ?? []) as { id: string; content: string; created_at: string }[]);
    setGroupMsgsLoading(false);
  };

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
          <div
            style={{ width: 140, height: 140, borderRadius: "50%", margin: "0 auto 18px", background: "rgba(124,58,237,0.2)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", cursor: profile.avatar_url ? "zoom-in" : "default", ...(role === "admin" ? { border: "3px solid #FFD700", boxShadow: "0 0 14px #FFD700, 0 0 28px #FFD700" } : role === "moderator" ? { border: "3px solid #ef4444", boxShadow: "0 0 14px #ef4444, 0 0 28px #dc2626" } : { border: "3px solid #7c3aed" }) }}
            onClick={() => { if (profile.avatar_url) setLightboxSrc(profile.avatar_url); }}
          >
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

          <div style={{ marginBottom: 10 }}>
            {role === "admin" && <span className="chat-mini-badge admin" style={{ fontSize: 13, padding: "5px 14px", borderRadius: 8 }}>👑 Admin</span>}
            {role === "moderator" && (
              <span className="chat-mini-badge mod" style={{ fontSize: 13, padding: "5px 14px", borderRadius: 8, overflow: "hidden", display: "inline-flex", alignItems: "center" }}>🏴‍☠️ Modérateur</span>
            )}
            {role !== "admin" && role !== "moderator" && <span className="chat-mini-badge eleve" style={{ fontSize: 13, padding: "5px 14px", borderRadius: 8 }}>🎓 Élève</span>}
          </div>

          {(() => {
            const isSelf = user?.id === userId;
            const isOnline = isSelf || !!(presence?.is_online && presence.last_seen && (Date.now() - new Date(presence.last_seen).getTime()) < 2 * 60 * 1000);
            const fmtLastSeen = (iso: string) => {
              const d = new Date(iso);
              const diffMs = Date.now() - d.getTime();
              const diffMins = Math.floor(diffMs / 60000);
              const diffH = Math.floor(diffMs / 3600000);
              if (diffMins < 1) return "à l'instant";
              if (diffMins < 60) return `il y a ${diffMins}min`;
              return `il y a ${diffH}h le ${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
            };
            return (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 14 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: isOnline ? "#10b981" : "#6b7280", boxShadow: isOnline ? "0 0 6px #10b981" : "none", display: "inline-block", animation: isOnline ? "onlinePulse 2s ease-in-out infinite" : "none" }} />
                <span style={{ fontSize: 12, color: isOnline ? "#10b981" : "#6b7280", fontWeight: 600 }}>{isOnline ? "En ligne" : "Hors ligne"}</span>
                {!isOnline && myRole === "admin" && presence?.last_seen && (
                  <span style={{ fontSize: 11, color: "#6b4fa0" }}>— Dernière connexion {fmtLastSeen(presence.last_seen)}</span>
                )}
              </div>
            );
          })()}

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
            <p style={{ color: "#c4a3f0", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px", maxWidth: 440, marginInline: "auto" }}>{profile.bio}</p>
          )}

          {profile.show_progression !== false && (
            <div style={{ margin: "0 0 22px", maxWidth: 440, marginInline: "auto", textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, color: "#9a7dbd", textTransform: "uppercase", letterSpacing: 0.5 }}>
                <span>Progression formation</span>
                <span style={{ color: role === "admin" ? "#ff6a00" : role === "moderator" ? "#ff6a00" : "#c4a3f0", fontWeight: 800 }}>
                  {role === "admin" ? "⚡ 1000%" : role === "moderator" ? "🔥 100%" : `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`}
                </span>
              </div>
              <div style={{ height: 10, background: "rgba(168,85,247,0.12)", borderRadius: 6, overflow: "hidden" }}>
                {role === "admin"
                  ? <div className="nitro-progress" style={{ height: "100%", width: "100%", borderRadius: 6 }} />
                  : role === "moderator"
                  ? <div className="fire-progress" style={{ height: "100%", width: "100%", borderRadius: 6 }} />
                  : <div style={{ height: "100%", width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, background: "linear-gradient(90deg, #7c3aed, #a855f7)", borderRadius: 6, transition: "width 0.3s" }} />}
              </div>
              <div style={{ fontSize: 11, color: "#7c5c9a", marginTop: 4 }}>
                {(role === "admin" || role === "moderator") ? "∞ chapitres terminés" : `${progress.done} / ${progress.total} chapitre${progress.total > 1 ? "s" : ""} terminé${progress.done > 1 ? "s" : ""}`}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {!isMe && (
              <>
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
              </>
            )}
            <button
              onClick={() => void openGroupMessages()}
              style={{ background: "rgba(124,58,237,0.18)", border: "1px solid rgba(168,85,247,0.45)", color: "#e9d5ff", padding: "10px 22px", borderRadius: 22, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
            >
              👥 Messages dans le groupe
            </button>
          </div>
        </div>
      </div>

      {groupMsgsOpen && (
        <div onClick={() => setGroupMsgsOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", zIndex: 1001, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 0 0" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, maxHeight: "80vh", display: "flex", flexDirection: "column", background: "rgba(16,6,36,0.99)", border: "1px solid rgba(168,85,247,0.3)", borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(168,85,247,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <strong style={{ color: "#f0e8ff", fontSize: 15 }}>👥 Messages de {name} dans le groupe</strong>
              <button onClick={() => setGroupMsgsOpen(false)} style={{ background: "none", border: "none", color: "#c4a3f0", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {groupMsgsLoading && (
                <div style={{ padding: 32, textAlign: "center", color: "#9a7dbd" }}>Chargement…</div>
              )}
              {!groupMsgsLoading && groupMsgs.length === 0 && (
                <div style={{ padding: 32, textAlign: "center", color: "#9a7dbd", fontSize: 14 }}>
                  {name} n'a pas encore envoyé de message dans le groupe.
                </div>
              )}
              {groupMsgs.map((m) => (
                <div key={m.id} style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(168,85,247,0.18)", borderRadius: 12, padding: "10px 14px" }}>
                  <div style={{ color: "#f0e8ff", fontSize: 14, lineHeight: 1.55, wordBreak: "break-word" }}>{m.content}</div>
                  <div style={{ fontSize: 11, color: "#6b4fa0", marginTop: 5 }}>
                    {new Date(m.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
                const uRole = listRoles[u.id] ?? "user";
                return (
                  <Link key={u.id} to="/profil/$userId" params={{ userId: u.id }} onClick={() => setListOpen(null)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, textDecoration: "none", color: "#f0e8ff" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(124,58,237,0.2)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...avatarRing(uRole) }}>
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

      {/* Lightbox */}
      {lightboxSrc && (
        <div onClick={() => setLightboxSrc(null)} style={{ position: "fixed", inset: 0, zIndex: 9500, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${lightboxSrc})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(20px)", opacity: 0.3, transform: "scale(1.1)" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.72)" }} />
          <img src={lightboxSrc} onClick={(e) => e.stopPropagation()} className="lightbox-img-anim" style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh", borderRadius: "50%", objectFit: "cover", width: "min(80vw,80vh)", height: "min(80vw,80vh)", boxShadow: "0 0 60px rgba(0,0,0,0.8)" }} alt="avatar" />
          <button onClick={() => setLightboxSrc(null)} style={{ position: "absolute", top: 20, right: 20, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "50%", width: 40, height: 40, color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
      )}
    </div>
  );
}
