import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import "../styles/admin.css";
import "../styles/dropdigital.css";

// ── Types ──────────────────────────────────────────────────────────────────

type StudentProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  followers_count: number | null;
  following_count: number | null;
  temp_password: string | null;
  admin_notes: string | null;
  has_software_access: boolean;
};

type StudentMessage = {
  id: string;
  content: string;
  created_at: string;
  visible: boolean;
};

type ProgressEntry = {
  chapter_id: string;
  completed_at: string;
};

type StudentData = {
  email: string;
  profile: StudentProfile | null;
  role: string;
  progress: ProgressEntry[];
  totalChapters: number;
  messages: StudentMessage[];
};

type DmRow = { id: string; sender_id: string; recipient_id: string; content: string; created_at: string; deleted_at: string | null };
type DmPartner = { id: string; username: string | null; full_name: string | null; avatar_url: string | null; lastAt: string; count: number };

// ── Server functions ────────────────────────────────────────────────────────

const getStudentFn = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const { userId } = (data as unknown) as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sa = supabaseAdmin as any;

    const [
      authResult,
      { data: profile },
      { data: roles },
      { data: progress },
      { count: totalChapters },
      { data: messages },
    ] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(userId),
      sa.from("profiles")
        .select("id, username, full_name, avatar_url, bio, followers_count, following_count, temp_password, admin_notes, has_software_access")
        .eq("id", userId)
        .maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
      sa.from("user_chapter_progress").select("chapter_id, completed_at").eq("user_id", userId),
      sa.from("chapters").select("id", { count: "exact", head: true }),
      sa.from("group_messages")
        .select("id, content, created_at, visible")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const rolePriority: Record<string, number> = { admin: 3, moderator: 2, user: 1 };
    const topRole = ((roles ?? []) as { role: string }[]).reduce<string>((best, r) => {
      return (rolePriority[r.role] ?? 0) > (rolePriority[best] ?? 0) ? r.role : best;
    }, "user");

    return {
      email: authResult.data.user?.email ?? "",
      profile: profile as StudentProfile | null,
      role: topRole,
      progress: (progress ?? []) as ProgressEntry[],
      totalChapters: (totalChapters ?? 0) as number,
      messages: (messages ?? []) as StudentMessage[],
    };
  });

const saveNotesFn = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const { userId, notes } = (data as unknown) as { userId: string; notes: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from("profiles")
      .update({ admin_notes: notes || null })
      .eq("id", userId);
    if (error) throw new Error((error as { message: string }).message);
    return { success: true };
  });

const saveTempPasswordFn = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const { userId, tempPassword } = (data as unknown) as { userId: string; tempPassword: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from("profiles")
      .update({ temp_password: tempPassword || null })
      .eq("id", userId);
    if (error) throw new Error((error as { message: string }).message);
    return { success: true };
  });

const saveProfileFn = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const { userId, username, bio } = (data as unknown) as { userId: string; username: string | null; bio: string | null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from("profiles")
      .update({ username: username || null, bio: bio || null })
      .eq("id", userId);
    if (error) throw new Error((error as { message: string }).message);
    return { success: true };
  });

const setRoleFn = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const { userId, role } = (data as unknown) as { userId: string; role: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sa = supabaseAdmin as any;

    const { data: targetAuth } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (targetAuth.user?.email === "ilias.entreprise@gmail.com") {
      throw new Error("Impossible de modifier le rôle de l'admin originel");
    }

    if (role === "moderator") {
      const { error } = await sa
        .from("user_roles")
        .upsert({ user_id: userId, role: "moderator" }, { onConflict: "user_id,role", ignoreDuplicates: true });
      if (error) throw new Error((error as { message: string }).message);
    } else {
      const { error } = await sa
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "moderator");
      if (error) throw new Error((error as { message: string }).message);
    }
    return { success: true };
  });

const getAdminDmsFn = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const { userId } = (data as unknown) as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sa = supabaseAdmin as any;
    const { data: msgs } = await sa
      .from("private_messages")
      .select("id, sender_id, recipient_id, content, created_at, deleted_at")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: true })
      .limit(2000);
    const rows = (msgs ?? []) as DmRow[];
    const map: Record<string, DmRow[]> = {};
    for (const r of rows) {
      const partner = r.sender_id === userId ? r.recipient_id : r.sender_id;
      (map[partner] = map[partner] || []).push(r);
    }
    const partnerIds = Object.keys(map);
    const { data: profs } = partnerIds.length
      ? await sa.from("profiles").select("id, username, full_name, avatar_url").in("id", partnerIds)
      : { data: [] };
    const profMap: Record<string, { username: string | null; full_name: string | null; avatar_url: string | null }> =
      Object.fromEntries(((profs ?? []) as Array<{ id: string; username: string | null; full_name: string | null; avatar_url: string | null }>).map((p) => [p.id, p]));
    const partners: DmPartner[] = partnerIds.map((pid) => {
      const list = map[pid];
      const p = profMap[pid] ?? { username: null, full_name: null, avatar_url: null };
      return { id: pid, username: p.username, full_name: p.full_name, avatar_url: p.avatar_url, lastAt: list[list.length - 1]?.created_at ?? "", count: list.length };
    }).sort((a, b) => (b.lastAt > a.lastAt ? 1 : -1));
    return { partners, messagesByPartner: map };
  });

// ── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin_/student/$userId")({
  component: StudentProfilePage,
});

// ── RoleBadge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #FFD700, #FFC200, #FFAA00)", color: "#1a0800", fontWeight: 800, fontSize: 14, padding: "6px 16px", borderRadius: 8, animation: "adminGlow 2s ease-in-out infinite" }}>
        👑 Admin
      </span>
    );
  }
  if (role === "moderator") {
    return (
      <span className="chat-mini-badge mod" style={{ fontSize: 13, padding: "6px 14px", borderRadius: 8 }}>
        Modérateur
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", background: "rgba(55,65,81,0.6)", color: "#9ca3af", fontWeight: 600, fontSize: 14, padding: "6px 16px", borderRadius: 8 }}>
      Élève
    </span>
  );
}


// ── Component ────────────────────────────────────────────────────────────────

function StudentProfilePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { userId } = Route.useParams();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [tempPw, setTempPw] = useState("");
  const [tempPwVisible, setTempPwVisible] = useState(false);
  const [tempPwEditing, setTempPwEditing] = useState(false);
  const [tempPwDraft, setTempPwDraft] = useState("");
  const [tempPwSaving, setTempPwSaving] = useState(false);
  const [roleChanging, setRoleChanging] = useState(false);
  const [currentRole, setCurrentRole] = useState("user");
  const [messages, setMessages] = useState<StudentMessage[]>([]);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [dmsOpen, setDmsOpen] = useState(false);
  const [dmsData, setDmsData] = useState<{ partners: DmPartner[]; messagesByPartner: Record<string, DmRow[]> } | null>(null);
  const [dmsActive, setDmsActive] = useState<string | null>(null);
  const [dmsLoading, setDmsLoading] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  };

  useEffect(() => {
    if (!loading && !user) { void navigate({ to: "/login" }); return; }
    if (!user) return;

    (async () => {
      const { data: adminCheck } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!adminCheck) { void navigate({ to: "/" }); return; }

      try {
        const result = await (getStudentFn as unknown as (args: { data: { userId: string } }) => Promise<StudentData>)({ data: { userId } });
        setStudentData(result);
        setCurrentRole(result.role);
        setNotes(result.profile?.admin_notes ?? "");
        setTempPw(result.profile?.temp_password ?? "");
        setMessages(result.messages);
      } catch (e) {
        console.error(e);
      }
      setDataLoading(false);
    })();
  }, [user, loading, userId]);

  const handleSaveNotes = async () => {
    setNotesSaving(true);
    try {
      await (saveNotesFn as unknown as (args: { data: { userId: string; notes: string } }) => Promise<void>)({ data: { userId, notes } });
      showFlash("Notes sauvegardées ✓");
    } catch (e) {
      showFlash((e as Error).message);
    }
    setNotesSaving(false);
  };

  const handleSaveTempPw = async () => {
    setTempPwSaving(true);
    try {
      await (saveTempPasswordFn as unknown as (args: { data: { userId: string; tempPassword: string } }) => Promise<void>)({ data: { userId, tempPassword: tempPwDraft } });
      setTempPw(tempPwDraft);
      setTempPwEditing(false);
      showFlash("Mot de passe temporaire sauvegardé ✓");
    } catch (e) {
      showFlash((e as Error).message);
    }
    setTempPwSaving(false);
  };

  const handleRoleToggle = async () => {
    const newRole = currentRole === "moderator" ? "user" : "moderator";
    setRoleChanging(true);
    try {
      await (setRoleFn as unknown as (args: { data: { userId: string; role: string } }) => Promise<void>)({ data: { userId, role: newRole } });
      setCurrentRole(newRole);
      showFlash(newRole === "moderator" ? "Promu modérateur ✓" : "Rétrogradé élève ✓");
    } catch (e) {
      showFlash((e as Error).message);
    }
    setRoleChanging(false);
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      await (saveProfileFn as unknown as (args: { data: { userId: string; username: string | null; bio: string | null } }) => Promise<void>)({ data: { userId, username: usernameDraft.trim(), bio: bioDraft.trim() } });
      setStudentData((prev) => prev && prev.profile ? { ...prev, profile: { ...prev.profile, username: usernameDraft.trim() || null, bio: bioDraft.trim() || null } } : prev);
      setEditingProfile(false);
      showFlash("Profil mis à jour ✓");
    } catch (e) {
      showFlash((e as Error).message);
    }
    setProfileSaving(false);
  };

  const deleteMessage = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("group_messages").delete().eq("id", id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
    showFlash("Message supprimé ✓");
  };

  const uploadAvatar = async (file: File) => {
    setAvatarUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", userId);
      setStudentData((prev) =>
        prev ? { ...prev, profile: prev.profile ? { ...prev.profile, avatar_url: data.publicUrl } : null } : null
      );
      showFlash("Photo mise à jour ✓");
    }
    setAvatarUploading(false);
  };

  const openDms = async () => {
    setDmsOpen(true);
    if (dmsData) return;
    setDmsLoading(true);
    try {
      const result = await (getAdminDmsFn as unknown as (a: { data: { userId: string } }) => Promise<{ partners: DmPartner[]; messagesByPartner: Record<string, DmRow[]> }>)({ data: { userId } });
      setDmsData(result);
      if (result.partners.length) setDmsActive(result.partners[0].id);
    } catch (e) { console.error(e); }
    setDmsLoading(false);
  };

  if (loading || dataLoading) {
    return (
      <div style={{ minHeight: "100dvh", background: "oklch(0.129 0.042 264.695)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#9a7dbd", fontSize: 14 }}>Chargement…</div>
      </div>
    );
  }

  if (!studentData) {
    return (
      <div style={{ minHeight: "100dvh", background: "oklch(0.129 0.042 264.695)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#9a7dbd", fontSize: 14 }}>Élève introuvable.</div>
      </div>
    );
  }

  const { profile, email } = studentData;
  const displayName = profile?.full_name || profile?.username || email.split("@")[0];
  const isAdminStudent = currentRole === "admin";
  const completedCount = studentData.progress.length;
  const progressPct = studentData.totalChapters > 0
    ? Math.min(100, Math.round((completedCount / studentData.totalChapters) * 100))
    : 0;

  const card: React.CSSProperties = {
    background: "rgba(25,10,48,0.7)",
    border: "1px solid rgba(168,85,247,0.15)",
    borderRadius: 16,
    padding: "24px 20px",
    marginBottom: 16,
  };

  return (
    <div style={{ minHeight: "100dvh", background: "oklch(0.129 0.042 264.695)", overflowY: "auto", fontFamily: "inherit" }}>

      {/* Flash banner */}
      {flash && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#10b981", color: "#fff", fontSize: 13, fontWeight: 700, padding: "8px 20px", borderRadius: 20, zIndex: 9999, whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(16,185,129,0.35)" }}>
          {flash}
        </div>
      )}

      {/* ── Section 1 : Header sticky ── */}
      <div className="admin-topbar" style={{ position: "sticky", top: 0, zIndex: 100, display: "flex", alignItems: "center", gap: 12 }}>
        <Link to="/admin" className="admin-back" style={{ flexShrink: 0 }}>← Admin</Link>
        <h1 className="admin-title" style={{ fontSize: 15, flex: 1, margin: 0 }}>Le Profil de {displayName}</h1>
        {!isAdminStudent && (
          <button
            className={currentRole === "moderator" ? "admin-btn-danger" : "admin-btn-primary"}
            onClick={() => void handleRoleToggle()}
            disabled={roleChanging}
            style={{ fontSize: 12, padding: "6px 14px", flexShrink: 0 }}
          >
            {roleChanging ? "…" : currentRole === "moderator" ? "↩ Rétrograder élève" : "⬆ Promouvoir modérateur"}
          </button>
        )}
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>

        {/* ── Section 2 : Profil visuel ── */}
        <div style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>

          {/* Avatar + overlay upload */}
          <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
            <div
              style={{ width: 120, height: 120, borderRadius: "50%", background: "rgba(124,58,237,0.2)", border: "3px solid rgba(168,85,247,0.4)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer" }}
              onClick={() => avatarInputRef.current?.click()}
              title="Changer la photo de profil"
            >
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontSize: 48, color: "#c4a3f0" }}>{displayName[0]?.toUpperCase()}</span>
              }
            </div>
            {/* Always-visible overlay at low opacity, full on hover */}
            <div
              onClick={() => avatarInputRef.current?.click()}
              style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, cursor: "pointer", opacity: 0.5, transition: "opacity 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}
            >
              {avatarUploading ? "…" : "📷"}
            </div>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAvatar(f); e.target.value = ""; }}
          />

          {/* Name + username */}
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#f0e8ff", marginBottom: 4 }}>{displayName}</div>
            {profile?.username && profile.full_name && (
              <div style={{ fontSize: 13, color: "#9a7dbd", marginBottom: 4 }}>@{profile.username}</div>
            )}
          </div>

          {/* Role badge */}
          <RoleBadge role={currentRole} />

          {/* Followers / Following */}
          <div style={{ display: "flex", gap: 40, justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#f0e8ff" }}>{profile?.followers_count ?? 0}</div>
              <div style={{ fontSize: 12, color: "#7c5c9a" }}>Abonnés</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#f0e8ff" }}>{profile?.following_count ?? 0}</div>
              <div style={{ fontSize: 12, color: "#7c5c9a" }}>Abonnements</div>
            </div>
          </div>

          {/* Bio */}
          {!editingProfile && profile?.bio && (
            <p style={{ color: "#c4a3f0", fontSize: 14, lineHeight: 1.6, margin: "0", maxWidth: 440 }}>{profile.bio}</p>
          )}

          {/* Admin edit profile */}
          {editingProfile ? (
            <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
              <input
                className="profile-edit-input"
                placeholder="Pseudo (@username)"
                value={usernameDraft}
                onChange={(e) => setUsernameDraft(e.target.value)}
              />
              <textarea
                placeholder="Bio"
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
                rows={3}
                style={{ width: "100%", background: "rgba(15,9,32,0.8)", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 8, padding: "10px 12px", color: "#f0e8ff", fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
              />
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="admin-btn-primary sm" disabled={profileSaving} onClick={() => void handleSaveProfile()}>{profileSaving ? "…" : "✓ Enregistrer"}</button>
                <button className="admin-btn-ghost sm" onClick={() => setEditingProfile(false)}>Annuler</button>
              </div>
            </div>
          ) : (
            <button
              className="admin-btn-ghost sm"
              onClick={() => { setUsernameDraft(profile?.username ?? ""); setBioDraft(profile?.bio ?? ""); setEditingProfile(true); }}
              style={{ marginTop: 4 }}
            >
              ✏️ Modifier pseudo & bio
            </button>
          )}

          {/* Quick links */}
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", justifyContent: "center" }}>
            <button className="admin-btn-ghost sm" onClick={() => void openDms()}>
              💬 Messages privés
            </button>
          </div>
        </div>



        {/* ── Section 3 : Progression ── */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#c4a3f0", marginBottom: 14 }}>📊 Progression globale</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, height: 12, background: "rgba(168,85,247,0.12)", borderRadius: 6, overflow: "hidden" }}>
              {currentRole === "admin" ? (
                <div className="nitro-progress" style={{ borderRadius: 6, height: "100%", width: "100%" }} />
              ) : currentRole === "moderator" ? (
                <div className="fire-progress" style={{ borderRadius: 6, height: "100%", width: "100%" }} />
              ) : (
                <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg, #7c3aed, #a855f7)", borderRadius: 6, transition: "width 0.6s" }} />
              )}
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, minWidth: 64, textAlign: "right", color: currentRole === "admin" ? "#ff6a00" : currentRole === "moderator" ? "#ff8c00" : "#9a7dbd", textShadow: currentRole === "admin" || currentRole === "moderator" ? "0 0 6px rgba(255,106,0,0.55)" : undefined }}>
              {currentRole === "admin" ? "⚡ 1000%" : currentRole === "moderator" ? "🔥 100%" : `${progressPct}%`}
            </span>
          </div>
          {currentRole === "user" && (
            <div style={{ fontSize: 12, color: "#6b4fa0", marginTop: 8 }}>
              {completedCount} chapitre{completedCount !== 1 ? "s" : ""} validé{completedCount !== 1 ? "s" : ""} sur {studentData.totalChapters}
            </div>
          )}
          {(currentRole === "admin" || currentRole === "moderator") && (
            <div style={{ fontSize: 12, color: "#fca5a5", marginTop: 8 }}>
              ∞ chapitres terminés{currentRole === "moderator" ? " — Accès total : tous les modules + tous les logiciels." : ""}
            </div>
          )}
        </div>


        {/* ── Section 4 : Informations admin ── */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#c4a3f0", marginBottom: 18 }}>🔐 Informations admin</div>

          {/* Email */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#7c5c9a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Email</div>
            <div style={{ fontSize: 14, color: "#e2d4f8", fontFamily: "monospace", background: "rgba(15,9,32,0.6)", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(168,85,247,0.15)" }}>
              {email}
            </div>
          </div>

          {/* Temp password */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#7c5c9a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Mot de passe temporaire</div>
            {tempPwEditing ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  className="profile-edit-input"
                  type={tempPwVisible ? "text" : "password"}
                  value={tempPwDraft}
                  onChange={(e) => setTempPwDraft(e.target.value)}
                  placeholder="Nouveau mot de passe temporaire"
                  autoFocus
                  style={{ flex: 1, minWidth: 0 }}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleSaveTempPw(); if (e.key === "Escape") setTempPwEditing(false); }}
                />
                <button className="admin-btn-ghost sm" onClick={() => setTempPwVisible((v) => !v)} title={tempPwVisible ? "Masquer" : "Afficher"}>
                  {tempPwVisible ? "🙈" : "👁"}
                </button>
                <button className="admin-btn-primary sm" onClick={() => void handleSaveTempPw()} disabled={tempPwSaving}>
                  {tempPwSaving ? "…" : "✓"}
                </button>
                <button className="admin-btn-ghost sm" onClick={() => setTempPwEditing(false)}>✕</button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(15,9,32,0.6)", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(168,85,247,0.15)" }}>
                <div style={{ fontSize: 14, color: "#e2d4f8", fontFamily: "monospace", flex: 1, letterSpacing: tempPwVisible ? "normal" : "0.15em" }}>
                  {tempPw
                    ? (tempPwVisible ? tempPw : "••••••••")
                    : <span style={{ color: "#6b4fa0", fontStyle: "italic", fontFamily: "inherit", letterSpacing: "normal", fontSize: 13 }}>Non défini</span>
                  }
                </div>
                {tempPw && (
                  <button className="admin-btn-ghost sm" onClick={() => setTempPwVisible((v) => !v)} title={tempPwVisible ? "Masquer" : "Afficher"}>
                    {tempPwVisible ? "🙈" : "👁"}
                  </button>
                )}
                <button className="admin-btn-primary sm" onClick={() => { setTempPwDraft(tempPw); setTempPwEditing(true); }}>
                  Modifier
                </button>
              </div>
            )}
          </div>

          {/* Admin notes */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#7c5c9a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Notes internes</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Ajouter des notes sur cet élève…"
              style={{ width: "100%", background: "rgba(15,9,32,0.8)", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 8, padding: "10px 12px", color: "#f0e8ff", fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
            />
            <button
              className="admin-btn-primary"
              onClick={() => void handleSaveNotes()}
              disabled={notesSaving}
              style={{ marginTop: 10 }}
            >
              {notesSaving ? "…" : "Sauvegarder les notes"}
            </button>
          </div>
        </div>

        {/* ── Section 5 : Messages du groupe ── */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#c4a3f0", marginBottom: 14 }}>
            💬 Messages dans le groupe ({messages.length})
          </div>

          {messages.length === 0 ? (
            <div style={{ color: "#6b4fa0", textAlign: "center", padding: "24px 0", fontSize: 14 }}>
              Cet élève n'a envoyé aucun message.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 480, overflowY: "auto" }}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 10, alignItems: "flex-start" }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#f0e8ff", fontSize: 13, lineHeight: 1.55, marginBottom: 4, wordBreak: "break-word" }}>{msg.content}</div>
                    <div style={{ fontSize: 11, color: "#6b4fa0", display: "flex", alignItems: "center", gap: 8 }}>
                      <span>{new Date(msg.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      {!msg.visible && <span style={{ color: "#f59e0b", fontWeight: 700 }}>EN ATTENTE</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => void deleteMessage(msg.id)}
                    title="Supprimer ce message"
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#6b4fa0", padding: "2px 4px", lineHeight: 1, opacity: 0.55, flexShrink: 0, transition: "opacity 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.55")}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── DM Panel Overlay ── */}
      {dmsOpen && (
        <div onClick={() => setDmsOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 820, height: "85vh", background: "rgba(16,6,36,0.99)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 16, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(168,85,247,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <strong style={{ color: "#f0e8ff", fontSize: 15 }}>💬 Messages privés — {displayName}</strong>
              <button onClick={() => setDmsOpen(false)} style={{ background: "none", border: "none", color: "#c4a3f0", fontSize: 22, cursor: "pointer" }}>×</button>
            </div>
            {dmsLoading ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9a7dbd" }}>Chargement…</div>
            ) : !dmsData || dmsData.partners.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#6b4fa0", fontSize: 14 }}>Aucune conversation privée.</div>
            ) : (
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "220px 1fr", minHeight: 0 }}>
                <div style={{ borderRight: "1px solid rgba(168,85,247,0.15)", overflowY: "auto", padding: 8 }}>
                  {dmsData.partners.map((p) => {
                    const pname = p.full_name || p.username || "Élève";
                    return (
                      <button key={p.id} onClick={() => setDmsActive(p.id)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: dmsActive === p.id ? "rgba(124,58,237,0.25)" : "transparent", border: "none", borderRadius: 8, cursor: "pointer", marginBottom: 2, color: "#f0e8ff" }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(124,58,237,0.2)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#c4a3f0", fontWeight: 700, fontSize: 12 }}>{pname[0]?.toUpperCase()}</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pname}</div>
                          <div style={{ fontSize: 10, color: "#9a7dbd" }}>{p.count} msg</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div style={{ overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  {dmsActive && (dmsData.messagesByPartner[dmsActive] ?? []).map((m) => {
                    const fromStudent = m.sender_id === userId;
                    const isDeleted = !!m.deleted_at;
                    return (
                      <div key={m.id} style={{ alignSelf: fromStudent ? "flex-end" : "flex-start", maxWidth: "78%" }}>
                        <div style={{ background: isDeleted ? "rgba(220,38,38,0.22)" : fromStudent ? "linear-gradient(135deg, #7c3aed, #a855f7)" : "rgba(30,15,55,0.85)", border: isDeleted ? "1px solid rgba(239,68,68,0.55)" : "1px solid rgba(168,85,247,0.18)", color: isDeleted ? "#fecaca" : "#fff", borderRadius: 10, padding: "7px 11px", fontSize: 13, lineHeight: 1.45, wordBreak: "break-word" }}>
                          {m.content}
                          {isDeleted && <div style={{ fontSize: 10, marginTop: 3, color: "#fca5a5", fontStyle: "italic" }}>(supprimé)</div>}
                        </div>
                        <div style={{ fontSize: 10, color: "#6b4fa0", marginTop: 2, textAlign: fromStudent ? "right" : "left" }}>
                          {new Date(m.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
