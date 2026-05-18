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
    const { email, origin } = data as { email: string; origin: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });
    if (error) throw new Error(error.message);
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
  const [activeTab, setActiveTab] = useState<"content" | "dashboard">("content");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ text: string; isErr: boolean } | null>(null);

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
        </div>
        {msg && <span className="admin-msg">{msg}</span>}
        {err && <span className="admin-err">{err}</span>}
      </div>

      {activeTab === "dashboard" && (
        <div className="admin-body">
          <AdminDashboard />
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
              await inviteStudentFn({ data: { email, origin: window.location.origin } });
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
