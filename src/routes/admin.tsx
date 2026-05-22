import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { createServerFn } from "@tanstack/react-start";
import { ChapterResourcesAdmin } from "@/components/dd/ChapterResourcesAdmin";
import { AdminDashboard } from "@/components/dd/AdminDashboard";
import "../styles/admin.css";

type AppNotification = {
  id: string;
  message: string;
  read: boolean;
  created_at: string;
};

function VideoInput({
  moduleId,
  value,
  onChange,
}: {
  moduleId: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isStorage = value.includes("supabase") || value.includes("course-videos");

  const upload = async (file: File) => {
    if (!file.type.startsWith("video/")) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "mp4";
    const path = `${moduleId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("course-videos")
      .upload(path, file, { upsert: false });
    if (!error) {
      const { data } = supabase.storage.from("course-videos").getPublicUrl(path);
      onChange(data.publicUrl);
    }
    setUploading(false);
  };

  if (uploading) {
    return (
      <div className="video-input">
        <div className="admin-dropzone uploading">
          <div className="dz-uploading">
            <div className="dz-spinner" />
            Envoi en cours…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="video-input">
      {showUrl ? (
        <>
          <input
            className="dz-url-input"
            placeholder="https://www.youtube.com/watch?v=…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <button
            type="button"
            className="dz-url-toggle"
            onClick={() => setShowUrl(false)}
          >
            ← Retour au dropzone
          </button>
        </>
      ) : (
        <>
          <div
            className={[
              "admin-dropzone",
              dragging ? "dragging" : "",
              isStorage ? "has-video" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) void upload(f);
            }}
          >
            {isStorage ? (
              <div className="dz-has-video">
                <div className="dz-icon">✅</div>
                <div className="dz-name">Vidéo uploadée</div>
                <div className="dz-replace">Glisser pour remplacer</div>
              </div>
            ) : (
              <>
                <div className="dz-icon">🎬</div>
                <div className="dz-label">Glisser une vidéo ici</div>
                <div className="dz-sub">MP4 · WebM · MOV</div>
                <button type="button" className="dz-browse">
                  Parcourir
                </button>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
          </div>
          <button
            type="button"
            className="dz-url-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setShowUrl(true);
            }}
          >
            ou coller une URL (YouTube / Vimeo)
          </button>
        </>
      )}
    </div>
  );
}

function SimpleThumbnailPicker({ value, onChange, moduleId }: { value: string; onChange: (url: string) => void; moduleId?: string }) {
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploadErr(null);
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${moduleId || "new"}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("module-thumbnails")
        .upload(path, file, { upsert: true, contentType: file.type || undefined, cacheControl: "3600" });
      if (uploadError) { setUploadErr("Échec de l'upload : " + uploadError.message); return; }
      const { data } = supabase.storage.from("module-thumbnails").getPublicUrl(path);
      const url = `${data.publicUrl}?v=${Date.now()}`;
      if (moduleId) {
        const { error: updateError } = await supabase.from("modules").update({ thumbnail_url: url }).eq("id", moduleId);
        if (updateError) { setUploadErr("Échec de la sauvegarde : " + updateError.message); return; }
      }
      onChange(url);
    } catch (e: unknown) {
      setUploadErr("Erreur : " + ((e as Error)?.message ?? "inconnue"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        onClick={() => fileRef.current?.click()}
        style={{ width: "100%", height: 90, borderRadius: 8, border: "2px dashed rgba(168,85,247,0.4)", background: "rgba(124,58,237,0.08)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}
      >
        {uploading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#a855f7", fontSize: 13 }}>
            <div style={{ width: 16, height: 16, border: "2px solid rgba(168,85,247,0.3)", borderTopColor: "#a855f7", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            Envoi…
          </div>
        ) : value ? (
          <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ textAlign: "center", color: "#7c5c9a" }}>
            <div style={{ fontSize: 28 }}>🖼️</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Ajouter une miniature</div>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
      </div>
      {uploadErr && <div style={{ color: "#fca5a5", fontSize: 11, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, padding: "4px 8px" }}>{uploadErr}</div>}
      <input
        className="dz-url-input"
        placeholder="ou coller une URL"
        value={value}
        onChange={(e) => { setUploadErr(null); onChange(e.target.value); }}
        style={{ fontSize: 12 }}
      />
    </div>
  );
}

const inviteStudentFn = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const { email, origin } = (data as unknown) as { email: string; origin: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

const createStudentFn = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const { email, password } = (data as unknown) as { email: string; password: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw new Error(error.message);
    if (newUser.user?.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any).from("profiles").upsert({ id: newUser.user.id, temp_password: password }, { onConflict: "id" });
    }
    return { success: true };
  });

function generatePassword(): string {
  const words = ["chocolat", "pirate", "dragon", "soleil", "ocean", "tigre", "rocket", "ninja"];
  return words[Math.floor(Math.random() * words.length)] + Math.floor(Math.random() * 9000 + 1000).toString();
}

const listStudentsFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const listResult = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (listResult.error) throw new Error(listResult.error.message);
    const authUsers = listResult.data.users;

    const [
      { data: profiles },
      { data: roles },
      { data: progress },
      { count: totalChapters },
      { data: presenceRows },
    ] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any).from("profiles").select("id, username, full_name, avatar_url, bio, has_software_access, temp_password"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("user_chapter_progress").select("user_id"),
      supabaseAdmin.from("chapters").select("id", { count: "exact", head: true }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any).from("user_presence").select("user_id, last_seen, is_online"),
    ]);

    const profileMap = Object.fromEntries(((profiles ?? []) as { id: string }[]).map((p) => [p.id, p]));
    const presenceMap = Object.fromEntries(((presenceRows ?? []) as { user_id: string; last_seen: string | null; is_online: boolean }[]).map((p) => [p.user_id, p]));

    const rolePriority: Record<string, number> = { admin: 3, moderator: 2, user: 1 };
    const roleMap: Record<string, string> = {};
    for (const r of roles ?? []) {
      const p = rolePriority[r.role] ?? 0;
      const ep = rolePriority[roleMap[r.user_id]] ?? 0;
      if (p > ep) roleMap[r.user_id] = r.role;
    }

    const completionMap: Record<string, number> = {};
    for (const row of progress ?? []) {
      completionMap[row.user_id] = (completionMap[row.user_id] ?? 0) + 1;
    }

    return {
      users: authUsers.map((u) => ({
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at,
        profile: (profileMap[u.id] as unknown as { username: string | null; full_name: string | null; avatar_url: string | null; bio: string | null; temp_password?: string | null } | undefined) ?? null,
        role: roleMap[u.id] ?? "user",
        completedChapters: completionMap[u.id] ?? 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        has_software_access: ((profileMap[u.id] as any)?.has_software_access) ?? false,
        last_seen: presenceMap[u.id]?.last_seen ?? null,
        is_online: !!(presenceMap[u.id]?.is_online && presenceMap[u.id]?.last_seen && (Date.now() - new Date(presenceMap[u.id].last_seen!).getTime()) < 2 * 60 * 1000),
      })),
      totalChapters: totalChapters ?? 0,
    };
  });

const updateRoleFn = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const { userId, role, adminUserId, targetUsername } = (data as unknown) as { userId: string; role: "admin" | "moderator" | "user"; adminUserId: string; targetUsername: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sa = supabaseAdmin as any;

    const { data: targetAuth } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (targetAuth.user?.email === "ilias.entreprise@gmail.com") {
      throw new Error("Impossible de modifier le rôle de l'admin originel");
    }

    // Remove any non-target roles for this user, then add the target role (if not "user")
    const { error: delErr } = await sa
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .in("role", ["admin", "moderator"]);
    if (delErr) throw new Error((delErr as { message: string }).message);

    if (role === "admin" || role === "moderator") {
      const { error } = await sa
        .from("user_roles")
        .upsert({ user_id: userId, role }, { onConflict: "user_id,role", ignoreDuplicates: true });
      if (error) throw new Error((error as { message: string }).message);
    }

    if (adminUserId) {
      const notifMsg = role === "moderator"
        ? `Tu as promu ${targetUsername} modérateur ⬆️`
        : `Tu as rétrogradé ${targetUsername} en élève ↩️`;
      await sa.from("notifications").insert({ user_id: adminUserId, message: notifMsg });
    }

    return { success: true };
  });

const updateTempPasswordFn = createServerFn({ method: "POST" })
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

const updateSoftwareAccessFn = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const { userId, access } = (data as unknown) as { userId: string; access: boolean };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from("profiles")
      .update({ has_software_access: access })
      .eq("id", userId);
    if (error) throw new Error((error as { message: string }).message);
    return { success: true };
  });

const listGroupMessagesFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sa = supabaseAdmin as any;
    const { data: messages } = await sa
      .from("group_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    const msgList = (messages ?? []) as { user_id: string; [k: string]: unknown }[];
    const userIds = [...new Set(msgList.map((m) => m.user_id))];
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, username, full_name, avatar_url").in("id", userIds)
      : { data: [] };

    const profileMap = Object.fromEntries(((profiles ?? []) as { id: string; username: string | null; full_name: string | null; avatar_url: string | null }[]).map((p) => [p.id, p]));
    return {
      messages: msgList.map((m) => ({
        ...m,
        profile: (profileMap[m.user_id] as { username: string | null; full_name: string | null; avatar_url: string | null } | undefined) ?? null,
      })),
    };
  });

const approveMessageFn = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const { messageId } = (data as unknown) as { messageId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from("group_messages")
      .update({ visible: true })
      .eq("id", messageId);
    if (error) throw new Error((error as { message: string }).message);
    return { success: true };
  });

const listResultsFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sa = supabaseAdmin as any;
    const { data: results } = await sa
      .from("results")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    const resList = (results ?? []) as { user_id: string; [k: string]: unknown }[];
    const userIds = [...new Set(resList.map((r) => r.user_id))];
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, username, full_name, avatar_url").in("id", userIds)
      : { data: [] };

    const profileMap = Object.fromEntries(((profiles ?? []) as { id: string; username: string | null; full_name: string | null; avatar_url: string | null }[]).map((p) => [p.id, p]));
    return {
      results: resList.map((r) => ({
        ...r,
        profile: (profileMap[r.user_id] as { username: string | null; full_name: string | null; avatar_url: string | null } | undefined) ?? null,
      })),
    };
  });

const approveResultFn = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const { resultId } = (data as unknown) as { resultId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from("results")
      .update({ visible: true })
      .eq("id", resultId);
    if (error) throw new Error((error as { message: string }).message);
    return { success: true };
  });

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type Module = {
  id: string;
  title: string;
  description: string;
  section: string;
  position: number;
  thumbnail_url: string | null;
  badge: string | null;
  badge_color: string | null;
};

type Chapter = {
  id: string;
  module_id: string;
  title: string;
  description: string;
  video_url: string;
  duration_seconds: number;
  position: number;
};

type ModuleForm = {
  title: string;
  description: string;
  section: string;
  position: number;
  thumbnail_url: string;
  badge: string;
  badge_color: string;
};

type ChapterForm = {
  title: string;
  description: string;
  video_url: string;
  duration_seconds: number;
  position: number;
};

type ChapterResource = {
  id: string;
  file_url: string;
};

type StudentUser = {
  id: string;
  email: string;
  created_at: string;
  profile: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    temp_password?: string | null;
  } | null;
  role: string;
  completedChapters: number;
  has_software_access: boolean;
  last_seen: string | null;
  is_online: boolean;
};

type GroupMsgWithProfile = {
  id: string;
  user_id: string;
  content: string;
  visible: boolean;
  created_at: string;
  profile: { username: string | null; full_name: string | null; avatar_url: string | null } | null;
};

type ResultWithProfile = {
  id: string;
  user_id: string;
  content: string;
  amount: number | null;
  photo_url: string | null;
  visible: boolean;
  created_at: string;
  profile: { username: string | null; full_name: string | null; avatar_url: string | null } | null;
};

const SECTIONS = [
  { value: "mindset", label: "📘 Introduction" },
  { value: "jour1", label: "Jour 1" },
  { value: "jour2", label: "Jour 2" },
  { value: "jour3", label: "Jour 3" },
  { value: "bonus", label: "🎁 Bonus" },
  { value: "ultime", label: "⚡ Ultime" },
  { value: "general", label: "Général" },
];

const EMPTY_MODULE_FORM: ModuleForm = {
  title: "",
  description: "",
  section: "general",
  position: 0,
  thumbnail_url: "",
  badge: "",
  badge_color: "",
};

const EMPTY_CHAPTER_FORM: ChapterForm = {
  title: "",
  description: "",
  video_url: "",
  duration_seconds: 0,
  position: 0,
};

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        background: "linear-gradient(135deg, #FFD700, #FFC200, #FFAA00)",
        color: "#1a0800", fontWeight: 800, fontSize: 11,
        padding: "3px 10px", borderRadius: 6,
        animation: "adminGlow 2s ease-in-out infinite",
        position: "relative",
      }}>
        👑 Admin <span style={{ animation: "starPop 1.5s ease-in-out infinite", fontSize: 9 }}>✦</span>
      </span>
    );
  }
  if (role === "moderator") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        background: "linear-gradient(135deg, #7f1d1d, #991b1b)", color: "#fca5a5",
        fontWeight: 800, fontSize: 11,
        padding: "3px 10px", borderRadius: 6,
        border: "1px solid #ef4444",
        animation: "modNeon 2s ease-in-out infinite",
      }}>
        🏴‍☠️ Modérateur <span style={{ animation: "lightning 5s ease-in-out infinite", display: "inline-block", fontSize: 10 }}>⚡</span>
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      background: "rgba(55, 65, 81, 0.6)", color: "#9ca3af",
      fontWeight: 600, fontSize: 11,
      padding: "3px 10px", borderRadius: 6,
    }}>Élève</span>
  );
}

function StudentModal({
  student,
  totalChapters,
  onClose,
  onRoleChange,
  onSoftwareAccessChange,
}: {
  student: StudentUser;
  totalChapters: number;
  onClose: () => void;
  onRoleChange: (userId: string, role: string) => Promise<void>;
  onSoftwareAccessChange: (userId: string, access: boolean) => Promise<void>;
}) {
  const [changing, setChanging] = useState(false);
  const [togglingAccess, setTogglingAccess] = useState(false);
  const name = student.profile?.full_name || student.profile?.username || student.email.split("@")[0];
  const isAdminUser = student.role === "admin";
  const isMod = student.role === "moderator";
  const pct = totalChapters > 0
    ? Math.round((student.completedChapters / totalChapters) * 100)
    : 0;

  const handleSetRole = async (newRole: "admin" | "moderator" | "user") => {
    setChanging(true);
    await onRoleChange(student.id, newRole);
    setChanging(false);
  };

  const handleAccessToggle = async () => {
    setTogglingAccess(true);
    await onSoftwareAccessChange(student.id, !student.has_software_access);
    setTogglingAccess(false);
  };

  const nameStyle = isAdminUser
    ? { backgroundImage: "linear-gradient(135deg, #f59e0b, #fbbf24)", backgroundClip: "text" as const, WebkitBackgroundClip: "text", color: "transparent" }
    : isMod
    ? { color: "#fca5a5", textShadow: "0 0 10px rgba(239, 68, 68, 0.4)" }
    : { color: "#f0e8ff" };

  return (
    <div className="s-modal-backdrop" onClick={onClose}>
      <div className="s-modal" onClick={(e) => e.stopPropagation()}>
        <button className="s-modal-close" onClick={onClose}>✕</button>

        <div className="s-modal-avatar">
          {student.profile?.avatar_url
            ? <img src={student.profile.avatar_url} alt={name} />
            : <span>{name[0]?.toUpperCase() ?? "?"}</span>
          }
        </div>

        <div className="s-modal-name" style={nameStyle}>{name}</div>
        <div className="s-modal-email">{student.email}</div>

        <div className="s-modal-badge-row">
          <RoleBadge role={student.role} />
        </div>

        {student.profile?.bio && (
          <div className="s-modal-bio">{student.profile.bio}</div>
        )}

        <div>
          <div className="s-modal-prog-label">Progression — {isAdminUser ? "⚡ 1000%" : isMod ? "🔥 100%" : `${pct}%`}</div>
          <div className="s-modal-prog-bg">
            {isAdminUser
              ? <div className="nitro-progress" style={{ borderRadius: 6, height: "100%", width: "100%" }} />
              : isMod
              ? <div className="fire-progress" style={{ borderRadius: 6, height: "100%", width: "100%" }} />
              : <div className="s-modal-prog-fill" style={{ width: `${pct}%` }} />
            }
          </div>
        </div>

        {/* Mot de passe temporaire déplacé dans Profil complet → Informations personnelles */}

        <div className="s-modal-actions" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            className={student.has_software_access ? "admin-btn-danger" : "admin-btn-primary"}
            onClick={handleAccessToggle}
            disabled={togglingAccess}
            style={{ width: "100%" }}
          >
            {togglingAccess ? "…" : student.has_software_access ? "🔒 Révoquer logiciel" : "⚡ Donner accès logiciel"}
          </button>
          {!isAdminUser && (
            <>
              <button className="admin-btn-ghost" onClick={() => void handleSetRole(isMod ? "user" : "moderator")} disabled={changing} style={{ width: "100%" }}>
                {changing ? "…" : isMod ? "↩ Rétrograder modérateur → élève" : "⬆ Passer modérateur"}
              </button>
              <button className="admin-btn-primary" onClick={() => void handleSetRole("admin")} disabled={changing} style={{ width: "100%", background: "linear-gradient(135deg, #FFD700, #FFAA00)", color: "#1a0800", fontWeight: 800 }}>
                {changing ? "…" : "👑 Promouvoir admin"}
              </button>
            </>
          )}
          {isAdminUser && (
            <button className="admin-btn-danger" onClick={() => void handleSetRole("user")} disabled={changing} style={{ width: "100%" }}>
              {changing ? "…" : "↩ Rétrograder admin → élève"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [chapters, setChapters] = useState<Record<string, Chapter[]>>({});
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  const [moduleForm, setModuleForm] = useState<ModuleForm>(EMPTY_MODULE_FORM);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [showModuleForm, setShowModuleForm] = useState(false);

  const [chapterForm, setChapterForm] = useState<ChapterForm>(EMPTY_CHAPTER_FORM);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [showChapterForm, setShowChapterForm] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"content" | "dashboard" | "students" | "groupe" | "ressources-assoc">("content");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ text: string; isErr: boolean } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState<{ text: string; isErr: boolean } | null>(null);

  const [students, setStudents] = useState<StudentUser[]>([]);
  const [totalChapters, setTotalChapters] = useState(0);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentUser | null>(null);

  const [groupeMessages, setGroupeMessages] = useState<GroupMsgWithProfile[]>([]);
  const [groupeResults, setGroupeResults] = useState<ResultWithProfile[]>([]);
  const [groupeLoading, setGroupeLoading] = useState(false);
  const [groupeSubTab, setGroupeSubTab] = useState<"messages" | "resultats">("messages");

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const [thumbUploading, setThumbUploading] = useState<string | null>(null);
  const [thumbTargetModuleId, setThumbTargetModuleId] = useState<string | null>(null);
  const thumbFileRef = useRef<HTMLInputElement>(null);

  // Resources modérateurs
  type ResResource = { id: string; type: string; moderator_id: string | null; title: string | null; url: string };
  type ResModerator = { user_id: string; username: string | null };
  const [resResources, setResResources] = useState<ResResource[]>([]);
  const [resModerators, setResModerators] = useState<ResModerator[]>([]);
  const [resLoading, setResLoading] = useState(false);
  const [resTiktokTitle, setResTiktokTitle] = useState("");
  const [resTiktokUrl, setResTiktokUrl] = useState("");
  const [resSelModo, setResSelModo] = useState("");
  const [resMiroUrl, setResMiroUrl] = useState("");
  const [resTunnelUrl, setResTunnelUrl] = useState("");
  const [resSaving, setResSaving] = useState(false);

  const loadResAssoc = async () => {
    setResLoading(true);
    const [{ data: rRows }, { data: rRoles }] = await Promise.all([
      supabase.from("moderator_resources").select("id, type, moderator_id, title, url").order("created_at"),
      supabase.from("user_roles").select("user_id").in("role", ["moderator"]),
    ]);
    setResResources((rRows as ResResource[]) ?? []);
    if (rRoles && rRoles.length > 0) {
      const ids = (rRoles as { user_id: string }[]).map((r) => r.user_id);
      const { data: profs } = await supabase.from("profiles").select("id, username").in("id", ids);
      setResModerators(((profs ?? []) as { id: string; username: string | null }[]).map((p) => ({ user_id: p.id, username: p.username })));
    }
    setResLoading(false);
  };

  const addTiktokLive = async () => {
    if (!resTiktokUrl.trim()) return;
    setResSaving(true);
    await supabase.from("moderator_resources").insert({ type: "tiktok_live", moderator_id: null, title: resTiktokTitle.trim() || null, url: resTiktokUrl.trim() });
    setResTiktokTitle(""); setResTiktokUrl("");
    await loadResAssoc();
    setResSaving(false);
  };

  const deleteResResource = async (id: string) => {
    await supabase.from("moderator_resources").delete().eq("id", id);
    setResResources((prev) => prev.filter((r) => r.id !== id));
  };

  const upsertModoLink = async (type: "miro" | "tunnel", modoId: string, url: string) => {
    if (!modoId || !url.trim()) return;
    setResSaving(true);
    const existing = resResources.find((r) => r.type === type && r.moderator_id === modoId);
    if (existing) {
      await supabase.from("moderator_resources").update({ url: url.trim() }).eq("id", existing.id);
    } else {
      await supabase.from("moderator_resources").insert({ type, moderator_id: modoId, url: url.trim() });
    }
    await loadResAssoc();
    setResSaving(false);
  };

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setNotifications((data as AppNotification[]) ?? []);
    };
    void load();

    const channel = supabase
      .channel("admin_notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
        setNotifications((prev) => [payload.new as AppNotification, ...prev]);
      })
      .subscribe();

    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      void supabase.removeChannel(channel);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [user]);

  const markAllRead = async () => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login" });
      return;
    }
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!data) {
        navigate({ to: "/" });
        return;
      }
      setIsAdmin(true);
      void loadModules();
    })();
  }, [user, loading]);

  const loadModules = async () => {
    const { data } = await supabase
      .from("modules")
      .select("*")
      .order("section")
      .order("position");
    setModules((data as Module[]) || []);
  };

  const uploadThumbnailDirect = async (moduleId: string, file: File) => {
    setThumbUploading(moduleId);
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "_").slice(0, 50);
    const contentType = file.type || "image/webp";
    const path = `${Date.now()}_${safeName}`;
    console.log("[thumbnail-card] uploading", { name: file.name, safeName, type: file.type, size: file.size, path, contentType });
    const { error } = await supabase.storage.from("module-thumbnails").upload(path, file, { upsert: true, contentType });
    console.log("[thumbnail-card] result", { error });
    if (!error) {
      const { data: urlData } = supabase.storage.from("module-thumbnails").getPublicUrl(path);
      const url = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from("modules").update({ thumbnail_url: url }).eq("id", moduleId);
      setModules((prev) => prev.map((m) => m.id === moduleId ? { ...m, thumbnail_url: url } : m));
      if (editingModule?.id === moduleId) setModuleForm((f) => ({ ...f, thumbnail_url: url }));
      flash("Miniature mise à jour ✓");
    } else {
      flash(`Erreur upload miniature : ${error.message}`, true);
    }
    setThumbUploading(null);
  };

  const loadChapters = async (moduleId: string) => {
    const { data } = await supabase
      .from("chapters")
      .select("*")
      .eq("module_id", moduleId)
      .order("position");
    setChapters((prev) => ({ ...prev, [moduleId]: (data as Chapter[]) || [] }));
  };

  const toggleModule = (moduleId: string) => {
    if (expandedModule === moduleId) {
      setExpandedModule(null);
    } else {
      setExpandedModule(moduleId);
      if (!chapters[moduleId]) void loadChapters(moduleId);
    }
  };

  const flash = (message: string, isErr = false) => {
    if (isErr) {
      setErr(message);
      setMsg(null);
    } else {
      setMsg(message);
      setErr(null);
    }
    setTimeout(() => {
      setMsg(null);
      setErr(null);
    }, 3500);
  };

  const loadStudents = async () => {
    setStudentsLoading(true);
    try {
      const result = await listStudentsFn();
      setStudents(result.users as StudentUser[]);
      setTotalChapters(result.totalChapters);
    } catch (e) {
      flash((e as Error).message, true);
    }
    setStudentsLoading(false);
  };

  const loadGroupe = async () => {
    setGroupeLoading(true);
    try {
      const [msgs, res] = await Promise.all([listGroupMessagesFn(), listResultsFn()]);
      setGroupeMessages(msgs.messages as GroupMsgWithProfile[]);
      setGroupeResults(res.results as ResultWithProfile[]);
    } catch (e) {
      flash((e as Error).message, true);
    }
    setGroupeLoading(false);
  };

  const getStoragePath = (url: string, bucket: string) => {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const markerIndex = url.indexOf(marker);
    if (markerIndex >= 0) {
      return decodeURIComponent(url.slice(markerIndex + marker.length).split("?")[0]);
    }
    return null;
  };

  const fetchChapterResources = async (chapterIds: string[]) => {
    if (!chapterIds.length) return;

    const { data: resources } = await supabase
      .from("chapter_resources")
      .select("id, file_url")
      .in("chapter_id", chapterIds);

    return ((resources as ChapterResource[] | null) ?? []);
  };

  const purgeChapterResources = async (chapterIds: string[], knownResources?: ChapterResource[]) => {
    if (!chapterIds.length) return;

    const resources = knownResources ?? (await fetchChapterResources(chapterIds)) ?? [];

    const storagePaths = resources
      .map((resource) => getStoragePath(resource.file_url, "chapter-resources"))
      .filter((path): path is string => Boolean(path));

    if (storagePaths.length > 0) {
      await supabase.storage.from("chapter-resources").remove(storagePaths);
    }

    await supabase.from("chapter_resources").delete().in("chapter_id", chapterIds);
  };

  // ── MODULE CRUD ──

  const openModuleCreate = () => {
    setEditingModule(null);
    setModuleForm({ ...EMPTY_MODULE_FORM, position: modules.length });
    setShowModuleForm(true);
  };

  const openModuleEdit = (m: Module) => {
    setEditingModule(m);
    setModuleForm({
      title: m.title,
      description: m.description,
      section: m.section,
      position: m.position,
      thumbnail_url: m.thumbnail_url || "",
      badge: m.badge || "",
      badge_color: m.badge_color || "",
    });
    setShowModuleForm(true);
  };

  const saveModule = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: moduleForm.title.trim(),
      description: moduleForm.description.trim(),
      section: moduleForm.section,
      position: Number(moduleForm.position),
      thumbnail_url: moduleForm.thumbnail_url.trim() || null,
      badge: moduleForm.badge.trim() || null,
      badge_color: moduleForm.badge_color.trim() || null,
    };
    const { error } = editingModule
      ? await supabase.from("modules").update(payload).eq("id", editingModule.id)
      : await supabase.from("modules").insert(payload);

    if (error) {
      flash(error.message, true);
    } else {
      flash(editingModule ? "Module mis à jour ✓" : "Module créé ✓");
      setShowModuleForm(false);
      setEditingModule(null);
      void loadModules();
    }
    setSaving(false);
  };

  const deleteModule = async (id: string) => {
    if (!confirm("Supprimer ce module et tous ses chapitres ? Cette action est irréversible.")) return;

    const moduleChapters = chapters[id] ?? [];
    const { data: fetchedChapters } = moduleChapters.length
      ? { data: moduleChapters }
      : await supabase.from("chapters").select("id, module_id, title, description, video_url, duration_seconds, position").eq("module_id", id);
    const chapterIds = ((fetchedChapters as Chapter[] | null) ?? []).map((chapter) => chapter.id);

    const { error } = await supabase.from("modules").delete().eq("id", id);
    if (error) {
      flash(error.message, true);
    } else {
      await supabase.from("chapters").delete().eq("module_id", id);
      await purgeChapterResources(chapterIds);
      setModules((prev) => prev.filter((moduleItem) => moduleItem.id !== id));
      setChapters((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setExpandedModule((current) => (current === id ? null : current));
      flash("Module supprimé ✓");
    }
  };

  // ── CHAPTER CRUD ──

  const openChapterCreate = (moduleId: string) => {
    setEditingChapter(null);
    setChapterForm({
      ...EMPTY_CHAPTER_FORM,
      position: (chapters[moduleId] || []).length,
    });
    setShowChapterForm(moduleId);
  };

  const openChapterEdit = (c: Chapter) => {
    setEditingChapter(c);
    setChapterForm({
      title: c.title,
      description: c.description,
      video_url: c.video_url,
      duration_seconds: c.duration_seconds,
      position: c.position,
    });
    setShowChapterForm(c.module_id);
  };

  const saveChapter = async (e: FormEvent, moduleId: string) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      module_id: moduleId,
      title: chapterForm.title.trim(),
      description: chapterForm.description.trim(),
      video_url: chapterForm.video_url.trim(),
      duration_seconds: Number(chapterForm.duration_seconds),
      position: Number(chapterForm.position),
    };
    const { error } = editingChapter
      ? await supabase.from("chapters").update(payload).eq("id", editingChapter.id)
      : await supabase.from("chapters").insert(payload);

    if (error) {
      flash(error.message, true);
    } else {
      flash(editingChapter ? "Chapitre mis à jour ✓" : "Chapitre créé ✓");
      setShowChapterForm(null);
      setEditingChapter(null);
      void loadChapters(moduleId);
    }
    setSaving(false);
  };

  const deleteChapter = async (c: Chapter) => {
    if (!confirm("Supprimer ce chapitre ?")) return;
    const resources = await fetchChapterResources([c.id]);
    const { error } = await supabase.from("chapters").delete().eq("id", c.id);
    if (error) {
      flash(error.message, true);
    } else {
      await purgeChapterResources([c.id], resources);
      setChapters((prev) => ({
        ...prev,
        [c.module_id]: (prev[c.module_id] ?? []).filter((chapter) => chapter.id !== c.id),
      }));
      flash("Chapitre supprimé ✓");
    }
  };

  if (loading || isAdmin === null) {
    return <div className="admin-loading">Chargement…</div>;
  }

  return (
    <div className="admin-root">
      <div className="admin-topbar">
        <Link to="/" className="admin-back">
          ← Formation
        </Link>
        <h1 className="admin-title">⚙️ Admin</h1>
        <div style={{ display: "flex", gap: 8, marginLeft: 16 }}>
          <button
            className={activeTab === "content" ? "admin-btn-primary sm" : "admin-btn-ghost sm"}
            onClick={() => setActiveTab("content")}
          >
            📚 Contenu
          </button>
          <button
            className={activeTab === "dashboard" ? "admin-btn-primary sm" : "admin-btn-ghost sm"}
            onClick={() => setActiveTab("dashboard")}
          >
            📊 Dashboard
          </button>
          <button
            className={activeTab === "students" ? "admin-btn-primary sm" : "admin-btn-ghost sm"}
            onClick={() => {
              setActiveTab("students");
              void loadStudents();
            }}
          >
            👥 Élèves
          </button>
          <button
            className={activeTab === "groupe" ? "admin-btn-primary sm" : "admin-btn-ghost sm"}
            onClick={() => {
              setActiveTab("groupe");
              void loadGroupe();
            }}
          >
            💬 Groupe
          </button>
          <button
            className={activeTab === "ressources-assoc" ? "admin-btn-primary sm" : "admin-btn-ghost sm"}
            onClick={() => {
              setActiveTab("ressources-assoc");
              void loadResAssoc();
            }}
          >
            🤝 Ressources Associés
          </button>
        </div>
        {msg && <span className="admin-msg">{msg}</span>}
        {err && <span className="admin-err">{err}</span>}
        <div ref={notifRef} style={{ position: "relative", marginLeft: "auto" }}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, position: "relative", padding: "4px 8px", display: "flex", alignItems: "center" }}
            title="Notifications"
          >
            🔔
            {notifications.filter((n) => !n.read).length > 0 && (
              <span style={{ position: "absolute", top: 0, right: 0, background: "#ef4444", color: "#fff", borderRadius: "50%", fontSize: 10, fontWeight: 800, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                {notifications.filter((n) => !n.read).length}
              </span>
            )}
          </button>
          {notifOpen && (
            <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: "#1e1132", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 10, width: 320, maxHeight: 400, overflowY: "auto", zIndex: 1000, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(168,85,247,0.2)" }}>
                <span style={{ fontWeight: 700, color: "#e0d0ff", fontSize: 14 }}>Notifications</span>
                {notifications.some((n) => !n.read) && (
                  <button onClick={() => void markAllRead()} style={{ background: "none", border: "none", color: "#a855f7", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                    Tout marquer lu
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div style={{ padding: "20px 16px", color: "#7c5c9a", fontSize: 13, textAlign: "center" }}>Aucune notification</div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} style={{ padding: "10px 16px", borderBottom: "1px solid rgba(168,85,247,0.1)", background: n.read ? "transparent" : "rgba(168,85,247,0.07)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    {!n.read && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a855f7", flexShrink: 0, marginTop: 5 }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: n.message.startsWith("[DM]") ? "#10b981" : "#e0d0ff" }}>{n.message}</div>
                      <div style={{ fontSize: 11, color: "#7c5c9a", marginTop: 2 }}>
                        {new Date(n.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {activeTab === "dashboard" && (
        <div className="admin-body">
          <AdminDashboard />
        </div>
      )}

      {activeTab === "students" && (
        <div className="admin-body">
          <div className="admin-section-header">
            <h2>👥 Élèves ({students.length})</h2>
            <button
              className="admin-btn-ghost"
              onClick={() => void loadStudents()}
              disabled={studentsLoading}
            >
              {studentsLoading ? "Chargement…" : "↻ Actualiser"}
            </button>
          </div>

          {studentsLoading && students.length === 0 ? (
            <div className="admin-empty">Chargement des élèves…</div>
          ) : (
            <div className="student-grid">
              {students.map((s) => {
                const name = s.profile?.full_name || s.profile?.username || s.email.split("@")[0];
                const isAdminUser = s.role === "admin";
                const isMod = s.role === "moderator";
                const pct = totalChapters > 0
                  ? Math.round((s.completedChapters / totalChapters) * 100)
                  : 0;
                const label = isAdminUser ? "⚡ 1000%" : isMod ? "🔥 100%" : `${pct}%`;
                return (
                  <div key={s.id} className="student-card">
                    <div className="s-card-top">
                      <div className="s-avatar">
                        {s.profile?.avatar_url
                          ? <img src={s.profile.avatar_url} alt={name} />
                          : <span>{name[0]?.toUpperCase() ?? "?"}</span>
                        }
                      </div>
                      <div className="s-info">
                        <div className="s-name" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          {name}
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.is_online ? "#10b981" : "#6b7280", boxShadow: s.is_online ? "0 0 5px #10b981" : "none", display: "inline-block", flexShrink: 0 }} />
                        </div>
                        <div className="s-email">{s.email}</div>
                        <div style={{ fontSize: 10, color: "#6b4fa0", marginTop: 1 }}>
                          {s.is_online ? "En ligne" : s.last_seen ? (() => { const d = new Date(s.last_seen); const now = new Date(); const isToday = d.toDateString() === now.toDateString(); const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); return isToday ? `aujourd'hui à ${time}` : `${d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" })} à ${time}`; })() : "Jamais connecté"}
                        </div>
                      </div>
                      <RoleBadge role={s.role} />
                    </div>
                    <div className="s-prog-row">
                      <div className="s-prog-bg">
                        {isAdminUser
                          ? <div className="nitro-progress" style={{ width: "100%", height: "100%", borderRadius: 6 }} />
                          : isMod
                          ? <div className="fire-progress" style={{ width: "100%", height: "100%", borderRadius: 6 }} />
                          : <div className="s-prog-fill" style={{ width: `${pct}%` }} />
                        }
                      </div>
                      <span className="s-prog-pct" style={isAdminUser || isMod ? { color: "#ff6a00", textShadow: "0 0 6px rgba(255,106,0,0.6)", fontWeight: 800 } : undefined}>{label}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="admin-btn-ghost sm"
                        onClick={() => setSelectedStudent(s)}
                      >
                        Aperçu
                      </button>
                      <Link
                        to="/admin/student/$userId"
                        params={{ userId: s.id }}
                        className="admin-btn-primary sm"
                        style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                      >
                        Profil complet →
                      </Link>
                    </div>
                  </div>
                );
              })}
              {!students.length && !studentsLoading && (
                <div className="admin-empty" style={{ gridColumn: "1/-1" }}>
                  Aucun élève trouvé.
                </div>
              )}
            </div>
          )}

          {selectedStudent && (
            <StudentModal
              student={selectedStudent}
              totalChapters={totalChapters}
              onClose={() => setSelectedStudent(null)}
              onRoleChange={async (userId, role) => {
                try {
                  const target = students.find((s) => s.id === userId);
                  const targetUsername = target?.profile?.full_name || target?.profile?.username || target?.email?.split("@")[0] || "cet élève";
                  await (updateRoleFn as unknown as (args: { data: { userId: string; role: string; adminUserId: string; targetUsername: string } }) => Promise<void>)({ data: { userId, role, adminUserId: user?.id ?? "", targetUsername } });
                  setStudents((prev) =>
                    prev.map((s) => s.id === userId ? { ...s, role } : s)
                  );
                  setSelectedStudent((prev) => prev ? { ...prev, role } : null);
                  flash(role === "moderator" ? `${targetUsername} est maintenant modérateur ⬆️` : `${targetUsername} a été rétrogradé en élève ↩️`);
                } catch (e) {
                  flash((e as Error).message, true);
                }
              }}
              onSoftwareAccessChange={async (userId, access) => {
                try {
                  await (updateSoftwareAccessFn as unknown as (args: { data: { userId: string; access: boolean } }) => Promise<void>)({ data: { userId, access } });
                  setStudents((prev) =>
                    prev.map((s) => s.id === userId ? { ...s, has_software_access: access } : s)
                  );
                  setSelectedStudent((prev) => prev ? { ...prev, has_software_access: access } : null);
                } catch (e) {
                  flash((e as Error).message, true);
                }
              }}
            />
          )}
        </div>
      )}

      {activeTab === "groupe" && (
        <div className="admin-body">
          <div className="admin-section-header">
            <h2>💬 Modération groupe</h2>
            <button className="admin-btn-ghost" onClick={() => void loadGroupe()} disabled={groupeLoading}>
              {groupeLoading ? "Chargement…" : "↻ Actualiser"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button
              className={groupeSubTab === "messages" ? "admin-btn-primary sm" : "admin-btn-ghost sm"}
              onClick={() => setGroupeSubTab("messages")}
            >
              Messages ({groupeMessages.filter((m) => !m.visible).length} en attente)
            </button>
            <button
              className={groupeSubTab === "resultats" ? "admin-btn-primary sm" : "admin-btn-ghost sm"}
              onClick={() => setGroupeSubTab("resultats")}
            >
              Résultats ({groupeResults.filter((r) => !r.visible).length} en attente)
            </button>
          </div>

          {groupeSubTab === "messages" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {groupeMessages.length === 0 && !groupeLoading && (
                <div className="admin-empty">Aucun message.</div>
              )}
              {groupeMessages.map((msg) => {
                const name = msg.profile?.full_name || msg.profile?.username || "Élève";
                return (
                  <div key={msg.id} style={{
                    background: "rgba(25,10,48,0.7)", borderRadius: 10, padding: "12px 16px",
                    border: msg.visible ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(168,85,247,0.2)",
                    display: "flex", alignItems: "flex-start", gap: 12,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#f0e8ff", marginBottom: 4 }}>
                        {name}
                        <span style={{ color: "#7c5c9a", fontWeight: 400, fontSize: 11, marginLeft: 8 }}>
                          {new Date(msg.created_at).toLocaleString("fr-FR")}
                        </span>
                      </div>
                      <div style={{ color: "#c4a3f0", fontSize: 14, lineHeight: 1.5 }}>{msg.content}</div>
                    </div>
                    {msg.visible
                      ? <span style={{ color: "#10b981", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>✅ Visible</span>
                      : (
                        <button
                          className="admin-btn-primary sm"
                          onClick={async () => {
                            try {
                              await (approveMessageFn as unknown as (args: { data: { messageId: string } }) => Promise<void>)({ data: { messageId: msg.id } });
                              setGroupeMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, visible: true } : m));
                            } catch (e) {
                              flash((e as Error).message, true);
                            }
                          }}
                        >
                          ✅ Approuver
                        </button>
                      )
                    }
                  </div>
                );
              })}
            </div>
          )}

          {groupeSubTab === "resultats" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {groupeResults.length === 0 && !groupeLoading && (
                <div className="admin-empty">Aucun résultat.</div>
              )}
              {groupeResults.map((res) => {
                const name = res.profile?.full_name || res.profile?.username || "Élève";
                return (
                  <div key={res.id} style={{
                    background: "rgba(25,10,48,0.7)", borderRadius: 10, padding: "12px 16px",
                    border: res.visible ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(168,85,247,0.2)",
                    display: "flex", alignItems: "flex-start", gap: 12,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#f0e8ff", marginBottom: 4 }}>
                        {name}
                        {res.amount != null && (
                          <span style={{ background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff", fontWeight: 800, fontSize: 11, padding: "2px 10px", borderRadius: 20, marginLeft: 8 }}>
                            +{res.amount.toLocaleString("fr-FR")}€
                          </span>
                        )}
                        <span style={{ color: "#7c5c9a", fontWeight: 400, fontSize: 11, marginLeft: 8 }}>
                          {new Date(res.created_at).toLocaleString("fr-FR")}
                        </span>
                      </div>
                      <div style={{ color: "#c4a3f0", fontSize: 14, lineHeight: 1.5 }}>{res.content}</div>
                      {res.photo_url && (
                        <img src={res.photo_url} alt="résultat" style={{ marginTop: 8, maxHeight: 120, borderRadius: 8, objectFit: "cover" }} />
                      )}
                    </div>
                    {res.visible
                      ? <span style={{ color: "#10b981", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>✅ Visible</span>
                      : (
                        <button
                          className="admin-btn-primary sm"
                          onClick={async () => {
                            try {
                              await (approveResultFn as unknown as (args: { data: { resultId: string } }) => Promise<void>)({ data: { resultId: res.id } });
                              setGroupeResults((prev) => prev.map((r) => r.id === res.id ? { ...r, visible: true } : r));
                            } catch (e) {
                              flash((e as Error).message, true);
                            }
                          }}
                        >
                          ✅ Approuver
                        </button>
                      )
                    }
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "ressources-assoc" && (
        <div className="admin-body">
          <div className="admin-section-header"><h2>🤝 Ressources Associés</h2></div>
          {resLoading ? (
            <div style={{ color: "#9a7dbd", padding: 20 }}>Chargement…</div>
          ) : (
            <>
              {/* TikTok Lives */}
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ color: "#e2d4f8", marginBottom: 14 }}>📱 Rediffusions TikTok Live (communes)</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  {resResources.filter((r) => r.type === "tiktok_live").map((r) => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 14px" }}>
                      <div style={{ flex: 1, color: "#e2d4f8", fontSize: 13 }}>{r.title ? `${r.title} — ` : ""}{r.url}</div>
                      <button className="admin-btn-danger sm" onClick={() => void deleteResResource(r.id)}>✕</button>
                    </div>
                  ))}
                  {resResources.filter((r) => r.type === "tiktok_live").length === 0 && (
                    <div style={{ color: "#7c5c9a", fontSize: 13 }}>Aucune rediffusion ajoutée.</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input className="dz-url-input" placeholder="Titre (optionnel)" value={resTiktokTitle} onChange={(e) => setResTiktokTitle(e.target.value)} style={{ flex: "0 0 180px" }} />
                  <input className="dz-url-input" placeholder="https://tiktok.com/…" value={resTiktokUrl} onChange={(e) => setResTiktokUrl(e.target.value)} style={{ flex: 1 }} />
                  <button className="admin-btn-primary sm" onClick={() => void addTiktokLive()} disabled={resSaving || !resTiktokUrl.trim()}>
                    {resSaving ? "…" : "+ Ajouter"}
                  </button>
                </div>
              </div>

              {/* Miro + Tunnel per moderator */}
              <div>
                <h3 style={{ color: "#e2d4f8", marginBottom: 14 }}>🖼️ Liens personnalisés par modérateur</h3>
                <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
                  <select
                    value={resSelModo}
                    onChange={(e) => {
                      setResSelModo(e.target.value);
                      setResMiroUrl(resResources.find((r) => r.type === "miro" && r.moderator_id === e.target.value)?.url ?? "");
                      setResTunnelUrl(resResources.find((r) => r.type === "tunnel" && r.moderator_id === e.target.value)?.url ?? "");
                    }}
                    style={{ background: "rgba(15,5,30,0.8)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 8, color: "#e2d4f8", padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
                  >
                    <option value="">— Sélectionner un modérateur —</option>
                    {resModerators.map((m) => (
                      <option key={m.user_id} value={m.user_id}>{m.username ?? m.user_id}</option>
                    ))}
                  </select>
                </div>
                {resSelModo && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ color: "#9a7dbd", fontSize: 13, minWidth: 100 }}>Lien Miro :</span>
                      <input className="dz-url-input" placeholder="https://miro.com/…" value={resMiroUrl} onChange={(e) => setResMiroUrl(e.target.value)} style={{ flex: 1 }} />
                      <button className="admin-btn-primary sm" onClick={() => void upsertModoLink("miro", resSelModo, resMiroUrl)} disabled={resSaving || !resMiroUrl.trim()}>
                        {resSaving ? "…" : "Sauvegarder"}
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ color: "#9a7dbd", fontSize: 13, minWidth: 100 }}>Tunnel vente :</span>
                      <input className="dz-url-input" placeholder="https://…" value={resTunnelUrl} onChange={(e) => setResTunnelUrl(e.target.value)} style={{ flex: 1 }} />
                      <button className="admin-btn-primary sm" onClick={() => void upsertModoLink("tunnel", resSelModo, resTunnelUrl)} disabled={resSaving || !resTunnelUrl.trim()}>
                        {resSaving ? "…" : "Sauvegarder"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "content" && <div className="admin-body">
        {/* ── ACCÈS ÉLÈVES ── */}
        <div className="admin-section-header">
          <h2>👤 Accès élèves</h2>
        </div>
        <form
          className="admin-form"
          onSubmit={async (e: FormEvent) => {
            e.preventDefault();
            const email = inviteEmail.trim();
            if (!email) return;
            setInviteLoading(true);
            setInviteResult(null);
            try {
              await (inviteStudentFn as unknown as (args: { data: { email: string; origin: string } }) => Promise<void>)({ data: { email, origin: window.location.origin } });
              setInviteResult({ text: `Accès créé et email envoyé à ${email} ✓`, isErr: false });
              setInviteEmail("");
            } catch (error) {
              setInviteResult({ text: (error as Error).message, isErr: true });
            }
            setInviteLoading(false);
          }}
        >
          <h3>Créer un accès élève</h3>
          <p style={{ fontSize: 13, color: "#888", marginBottom: 16, lineHeight: 1.5 }}>
            Un email d'invitation sera envoyé à l'élève avec un lien pour créer son mot de passe et accéder à la formation DropDigital.
          </p>
          <label>
            Email de l'élève *
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="eleve@example.com"
            />
          </label>
          {inviteResult && (
            <div className={inviteResult.isErr ? "admin-err" : "admin-msg"} style={{ marginTop: 8 }}>
              {inviteResult.text}
            </div>
          )}
          <div className="admin-form-actions">
            <button type="submit" className="admin-btn-primary" disabled={inviteLoading}>
              {inviteLoading ? "Envoi en cours…" : "Envoyer l'invitation email"}
            </button>
            <button
              type="button"
              className="admin-btn-ghost"
              onClick={() => { setCreateEmail(""); setCreatePassword(generatePassword()); setCreateResult(null); setShowCreateModal(true); }}
            >
              🔐 Créer avec mot de passe
            </button>
          </div>
        </form>

        {showCreateModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ background: "#1e1132", border: "1px solid rgba(168,85,247,0.35)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 440 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ color: "#f0e8ff", margin: 0, fontWeight: 800 }}>🔐 Créer un accès avec mot de passe</h3>
                <button onClick={() => setShowCreateModal(false)} style={{ background: "none", border: "none", color: "#9a7dbd", fontSize: 20, cursor: "pointer" }}>✕</button>
              </div>
              {createResult ? (
                <div>
                  <div style={{ background: createResult.isErr ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)", border: `1px solid ${createResult.isErr ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`, borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
                    <div style={{ color: createResult.isErr ? "#fca5a5" : "#86efac", fontSize: 14, fontWeight: 700, marginBottom: createResult.isErr ? 0 : 10 }}>{createResult.isErr ? "❌ " + createResult.text : "✅ Élève créé avec succès !"}</div>
                    {!createResult.isErr && (
                      <>
                        <div style={{ fontSize: 12, color: "#9a7dbd", marginBottom: 6 }}>Mot de passe provisoire à communiquer à l'élève :</div>
                        <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 900, color: "#a855f7", background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 8, padding: "10px 16px", letterSpacing: 2, userSelect: "all" }}>{createPassword}</div>
                        <div style={{ fontSize: 11, color: "#7c5c9a", marginTop: 8 }}>Copie ce mot de passe avant de fermer la fenêtre.</div>
                      </>
                    )}
                  </div>
                  <button className="admin-btn-primary" onClick={() => { setCreateResult(null); setCreateEmail(""); setCreatePassword(generatePassword()); }}>Inviter un autre élève</button>
                  <button className="admin-btn-ghost" onClick={() => setShowCreateModal(false)} style={{ marginLeft: 8 }}>Fermer</button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#9a7dbd", fontWeight: 600 }}>Email de l'élève</span>
                    <input
                      type="email"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      placeholder="eleve@example.com"
                      style={{ background: "rgba(15,5,30,0.8)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 8, color: "#f0e8ff", padding: "10px 14px", fontSize: 14, outline: "none" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#9a7dbd", fontWeight: 600 }}>Mot de passe provisoire</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        value={createPassword}
                        onChange={(e) => setCreatePassword(e.target.value)}
                        style={{ flex: 1, fontFamily: "monospace", fontWeight: 800, fontSize: 16, background: "rgba(124,58,237,0.1)", border: "1px solid rgba(168,85,247,0.4)", borderRadius: 8, color: "#a855f7", padding: "10px 14px", outline: "none", letterSpacing: 1 }}
                      />
                      <button type="button" onClick={() => setCreatePassword(generatePassword())} style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 8, color: "#c4a3f0", padding: "0 12px", cursor: "pointer", fontSize: 18 }}>🎲</button>
                    </div>
                  </label>
                  <button
                    className="admin-btn-primary"
                    disabled={createLoading || !createEmail.trim()}
                    onClick={async () => {
                      if (!createEmail.trim() || !createPassword) return;
                      setCreateLoading(true);
                      try {
                        await (createStudentFn as unknown as (args: { data: { email: string; password: string } }) => Promise<void>)({ data: { email: createEmail.trim(), password: createPassword } });
                        setCreateResult({ text: "", isErr: false });
                      } catch (e) {
                        setCreateResult({ text: (e as Error).message, isErr: true });
                      }
                      setCreateLoading(false);
                    }}
                  >
                    {createLoading ? "Création en cours…" : "✅ Créer l'accès"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="admin-section-header" style={{ marginTop: 48 }}>
          <h2>Modules</h2>
          <button className="admin-btn-primary" onClick={openModuleCreate}>
            + Nouveau module
          </button>
        </div>

        {/* Module form */}
        {showModuleForm && (
          <form className="admin-form" onSubmit={saveModule}>
            <h3>{editingModule ? "Modifier le module" : "Nouveau module"}</h3>
            <div className="admin-form-grid">
              <label>
                Titre *
                <input
                  required
                  value={moduleForm.title}
                  onChange={(e) =>
                    setModuleForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="Titre du module"
                />
              </label>
              <label>
                Section
                <select
                  value={moduleForm.section}
                  onChange={(e) =>
                    setModuleForm((f) => ({ ...f, section: e.target.value }))
                  }
                >
                  {SECTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Position
                <input
                  type="number"
                  min={0}
                  value={moduleForm.position}
                  onChange={(e) =>
                    setModuleForm((f) => ({
                      ...f,
                      position: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label>
                Badge (ex: NEW)
                <input
                  value={moduleForm.badge}
                  onChange={(e) =>
                    setModuleForm((f) => ({ ...f, badge: e.target.value }))
                  }
                  placeholder="NEW"
                />
              </label>
              <label>
                Couleur badge (ex: #a855f7)
                <input
                  value={moduleForm.badge_color}
                  onChange={(e) =>
                    setModuleForm((f) => ({
                      ...f,
                      badge_color: e.target.value,
                    }))
                  }
                  placeholder="#a855f7"
                />
              </label>
              <label>
                Miniature
                <SimpleThumbnailPicker
                  value={moduleForm.thumbnail_url}
                  onChange={(url) => setModuleForm((f) => ({ ...f, thumbnail_url: url }))}
                  moduleId={editingModule?.id}
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                value={moduleForm.description}
                onChange={(e) =>
                  setModuleForm((f) => ({
                    ...f,
                    description: e.target.value,
                  }))
                }
                rows={4}
                placeholder="Description du module — **gras** et lignes vides pour paragraphes"
              />
              <span style={{ fontSize: 11, color: "#9a7dbd" }}>
                💡 Utilise <strong>**gras**</strong> pour mettre en gras · Laisse une ligne vide pour créer un nouveau paragraphe
              </span>
            </label>
            <div className="admin-form-actions">
              <button
                type="submit"
                className="admin-btn-primary"
                disabled={saving}
              >
                {saving ? "…" : "Sauvegarder"}
              </button>
              <button
                type="button"
                className="admin-btn-secondary"
                onClick={() => {
                  setShowModuleForm(false);
                  setEditingModule(null);
                }}
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        {modules.length === 0 && !showModuleForm && (
          <div className="admin-empty">
            Aucun module. Crée le premier avec le bouton ci-dessus.
          </div>
        )}

        {modules.map((m) => (
          <div key={m.id} className="admin-module-card">
            <div
              className="admin-module-header"
              onClick={() => toggleModule(m.id)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{ position: "relative", flexShrink: 0, cursor: "pointer" }}
                  title="Changer la miniature"
                  onClick={(e) => {
                    e.stopPropagation();
                    setThumbTargetModuleId(m.id);
                    thumbFileRef.current?.click();
                  }}
                >
                  {m.thumbnail_url ? (
                    <img src={m.thumbnail_url} alt="" style={{ width: 48, height: 32, objectFit: "cover", borderRadius: 4, display: "block", border: "1px solid rgba(168,85,247,0.2)" }} />
                  ) : (
                    <div style={{ width: 48, height: 32, borderRadius: 4, background: "rgba(124,58,237,0.15)", border: "1px dashed rgba(168,85,247,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🖼️</div>
                  )}
                  <div className="thumb-hover-overlay">📷</div>
                  {thumbUploading === m.id && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 14, height: 14, border: "2px solid rgba(168,85,247,0.3)", borderTopColor: "#a855f7", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    </div>
                  )}
                </div>
                <div>
                  <span className="admin-module-section">
                    {SECTIONS.find((s) => s.value === m.section)?.label ||
                      m.section}
                  </span>
                  <span className="admin-module-title">{m.title}</span>
                  {m.badge && (
                    <span
                      className="admin-module-badge"
                      style={{ background: m.badge_color || "#a855f7" }}
                    >
                      {m.badge}
                    </span>
                  )}
                </div>
              </div>
              <div className="admin-module-actions">
                <button
                  className="admin-btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    openModuleEdit(m);
                  }}
                >
                  Modifier
                </button>
                <button
                  className="admin-btn-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteModule(m.id);
                  }}
                >
                  Supprimer
                </button>
                <span className="admin-expand">
                  {expandedModule === m.id ? "▲" : "▼"}
                </span>
              </div>
            </div>

            {expandedModule === m.id && (
              <div className="admin-chapters">
                <div className="admin-chapters-header">
                  <span>
                    Chapitres ({(chapters[m.id] || []).length})
                  </span>
                  <button
                    className="admin-btn-primary sm"
                    onClick={() => openChapterCreate(m.id)}
                  >
                    + Ajouter un chapitre
                  </button>
                </div>

                {/* Chapter form */}
                {showChapterForm === m.id && (
                  <form
                    className="admin-form inner"
                    onSubmit={(e) => saveChapter(e, m.id)}
                  >
                    <h4>
                      {editingChapter
                        ? "Modifier le chapitre"
                        : "Nouveau chapitre"}
                    </h4>
                    <div className="admin-form-grid">
                      <label>
                        Titre *
                        <input
                          required
                          value={chapterForm.title}
                          onChange={(e) =>
                            setChapterForm((f) => ({
                              ...f,
                              title: e.target.value,
                            }))
                          }
                          placeholder="Titre du chapitre"
                        />
                      </label>
                      <label>
                        Position
                        <input
                          type="number"
                          min={0}
                          value={chapterForm.position}
                          onChange={(e) =>
                            setChapterForm((f) => ({
                              ...f,
                              position: Number(e.target.value),
                            }))
                          }
                        />
                      </label>
                      <label>
                        Durée (secondes)
                        <input
                          type="number"
                          min={0}
                          value={chapterForm.duration_seconds}
                          onChange={(e) =>
                            setChapterForm((f) => ({
                              ...f,
                              duration_seconds: Number(e.target.value),
                            }))
                          }
                        />
                      </label>
                    </div>
                    <label>
                      Vidéo
                      <VideoInput
                        moduleId={m.id}
                        value={chapterForm.video_url}
                        onChange={(url) =>
                          setChapterForm((f) => ({ ...f, video_url: url }))
                        }
                      />
                    </label>
                    <label>
                      Description
                      <textarea
                        value={chapterForm.description}
                        onChange={(e) =>
                          setChapterForm((f) => ({
                            ...f,
                            description: e.target.value,
                          }))
                        }
                        rows={4}
                        placeholder="Description du chapitre — **gras** et lignes vides pour paragraphes"
                      />
                      <span style={{ fontSize: 11, color: "#9a7dbd" }}>
                        💡 <strong>**gras**</strong> · Ligne vide = nouveau paragraphe
                      </span>
                    </label>
                    <ChapterResourcesAdmin chapterId={editingChapter?.id ?? null} />
                    <div className="admin-form-actions">
                      <button
                        type="submit"
                        className="admin-btn-primary"
                        disabled={saving}
                      >
                        {saving ? "…" : "Sauvegarder"}
                      </button>
                      <button
                        type="button"
                        className="admin-btn-secondary"
                        onClick={() => {
                          setShowChapterForm(null);
                          setEditingChapter(null);
                        }}
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                )}

                {(chapters[m.id] || []).length === 0 &&
                  showChapterForm !== m.id && (
                    <div className="admin-empty inner">
                      Aucun chapitre. Ajoute le premier.
                    </div>
                  )}

                {(chapters[m.id] || []).map((c, idx) => (
                  <div key={c.id} className="admin-chapter-row">
                    <span className="chapter-pos">{idx + 1}</span>
                    <div className="chapter-info">
                      <div className="chapter-title">{c.title}</div>
                      {c.video_url && (
                        <div className="chapter-url">
                          {c.video_url.length > 70
                            ? `${c.video_url.slice(0, 70)}…`
                            : c.video_url}
                        </div>
                      )}
                    </div>
                    <div className="chapter-actions">
                      <button
                        className="admin-btn-ghost sm"
                        onClick={() => openChapterEdit(c)}
                      >
                        Modifier
                      </button>
                      <button
                        className="admin-btn-danger sm"
                        onClick={() => void deleteChapter(c)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

      </div>}

      {/* Hidden file input for module card thumbnails */}
      <input
        ref={thumbFileRef}
        type="file"
        accept="image/*,image/webp,image/png,image/jpeg,image/jpg,image/gif,image/avif"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && thumbTargetModuleId) void uploadThumbnailDirect(thumbTargetModuleId, f);
          e.target.value = "";
          setThumbTargetModuleId(null);
        }}
      />
    </div>
  );
}
