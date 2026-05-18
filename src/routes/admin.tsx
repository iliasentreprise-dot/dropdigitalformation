import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { createServerFn } from "@tanstack/react-start";
import { ThumbnailUploader } from "@/components/dd/ThumbnailUploader";
import { ChapterResourcesAdmin } from "@/components/dd/ChapterResourcesAdmin";
import { AdminDashboard } from "@/components/dd/AdminDashboard";
import "../styles/admin.css";

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
    ] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any).from("profiles").select("id, username, full_name, avatar_url, bio, has_software_access"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("user_chapter_progress").select("user_id"),
      supabaseAdmin.from("chapters").select("id", { count: "exact", head: true }),
    ]);

    const profileMap = Object.fromEntries(((profiles ?? []) as { id: string }[]).map((p) => [p.id, p]));

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
        profile: (profileMap[u.id] as unknown as { username: string | null; full_name: string | null; avatar_url: string | null; bio: string | null } | undefined) ?? null,
        role: roleMap[u.id] ?? "user",
        completedChapters: completionMap[u.id] ?? 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        has_software_access: ((profileMap[u.id] as any)?.has_software_access) ?? false,
      })),
      totalChapters: totalChapters ?? 0,
    };
  });

const updateRoleFn = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const { userId, role } = (data as unknown) as { userId: string; role: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .update({ role: role as "admin" | "user" })
      .eq("user_id", userId)
      .neq("role", "admin");
    if (error) throw new Error(error.message);
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
  } | null;
  role: string;
  completedChapters: number;
  has_software_access: boolean;
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
  { value: "mindset", label: "🧠 Mindset" },
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
        background: "linear-gradient(135deg, #b45309, #f59e0b, #fbbf24)",
        color: "#1a0800", fontWeight: 800, fontSize: 11,
        padding: "3px 10px", borderRadius: 6,
        animation: "adminGlow 2s ease-in-out infinite",
        letterSpacing: 0.5,
      }}>✨ Admin</span>
    );
  }
  if (role === "moderator") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        background: "#7f1d1d", color: "#fca5a5",
        fontWeight: 800, fontSize: 11,
        padding: "3px 10px", borderRadius: 6,
        border: "1px solid #ef4444",
        animation: "modGlow 2s ease-in-out infinite",
        letterSpacing: 0.5,
      }}>🔴 Modérateur</span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      background: "rgba(55, 65, 81, 0.6)", color: "#9ca3af",
      fontWeight: 600, fontSize: 11,
      padding: "3px 10px", borderRadius: 6,
      letterSpacing: 0.5,
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
  const pct = isAdminUser ? 100 : totalChapters > 0
    ? Math.round((student.completedChapters / totalChapters) * 100)
    : 0;

  const handleRoleChange = async () => {
    const newRole = isMod ? "user" : "moderator";
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
          <div className="s-modal-prog-label">Progression — {pct}%</div>
          <div className="s-modal-prog-bg">
            {isAdminUser
              ? <div className="fire-progress" style={{ borderRadius: 6 }} />
              : <div className="s-modal-prog-fill" style={{ width: `${pct}%` }} />
            }
          </div>
        </div>

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
            <button className="admin-btn-ghost" onClick={handleRoleChange} disabled={changing} style={{ width: "100%" }}>
              {changing ? "…" : isMod ? "↩ Repasser élève" : "⬆ Passer modérateur"}
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
  const [activeTab, setActiveTab] = useState<"content" | "dashboard" | "students" | "groupe">("content");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ text: string; isErr: boolean } | null>(null);

  const [students, setStudents] = useState<StudentUser[]>([]);
  const [totalChapters, setTotalChapters] = useState(0);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentUser | null>(null);

  const [groupeMessages, setGroupeMessages] = useState<GroupMsgWithProfile[]>([]);
  const [groupeResults, setGroupeResults] = useState<ResultWithProfile[]>([]);
  const [groupeLoading, setGroupeLoading] = useState(false);
  const [groupeSubTab, setGroupeSubTab] = useState<"messages" | "resultats">("messages");

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
        </div>
        {msg && <span className="admin-msg">{msg}</span>}
        {err && <span className="admin-err">{err}</span>}
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
                const pct = isAdminUser ? 100 : totalChapters > 0
                  ? Math.round((s.completedChapters / totalChapters) * 100)
                  : 0;
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
                        <div className="s-name">{name}</div>
                        <div className="s-email">{s.email}</div>
                      </div>
                      <RoleBadge role={s.role} />
                    </div>
                    <div className="s-prog-row">
                      <div className="s-prog-bg">
                        {isAdminUser
                          ? <div className="fire-progress" />
                          : <div className="s-prog-fill" style={{ width: `${pct}%` }} />
                        }
                      </div>
                      <span className="s-prog-pct">{pct}%</span>
                    </div>
                    <button
                      className="admin-btn-ghost sm"
                      onClick={() => setSelectedStudent(s)}
                    >
                      Voir le profil
                    </button>
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
                  await (updateRoleFn as unknown as (args: { data: { userId: string; role: string } }) => Promise<void>)({ data: { userId, role } });
                  setStudents((prev) =>
                    prev.map((s) => s.id === userId ? { ...s, role } : s)
                  );
                  setSelectedStudent((prev) => prev ? { ...prev, role } : null);
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
              {inviteLoading ? "Envoi en cours…" : "Créer l'accès"}
            </button>
          </div>
        </form>

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
                <ThumbnailUploader
                  value={moduleForm.thumbnail_url}
                  onChange={(url) => setModuleForm((f) => ({ ...f, thumbnail_url: url }))}
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
                rows={2}
                placeholder="Description courte du module"
              />
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
                        rows={2}
                        placeholder="Description du chapitre (optionnel)"
                      />
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
    </div>
  );
}
