import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { ResourcesSection } from "@/components/dd/ResourcesSection";
import { ReactionsRow } from "@/components/dd/ReactionsRow";
import { NextChapterCountdown } from "@/components/dd/NextChapterCountdown";
import { CertificateModal } from "@/components/dd/CertificateModal";
import { notifyProgressChanged } from "@/components/dd/GlobalProgressBar";
import "../styles/player.css";

export const Route = createFileRoute("/module/$moduleId")({
  component: ModulePage,
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

function isDirectVideo(url: string) {
  return /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(url);
}

function toEmbedUrl(url: string): string {
  if (!url.trim()) return "";
  if (isDirectVideo(url)) return url;
  if (url.includes("/embed/") || url.includes("player.vimeo.com")) return url;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
}

function ModulePage() {
  const { moduleId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [module, setModule] = useState<Module | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [validating, setValidating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 768,
  );
  const [dataLoading, setDataLoading] = useState(true);
  const [countdownActive, setCountdownActive] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [userName, setUserName] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  // Upload state (admin only)
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [showTitleForm, setShowTitleForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user || !moduleId) return;
    setDataLoading(true);
    (async () => {
      const [{ data: mod }, { data: chapList }, { data: roleData }] =
        await Promise.all([
          supabase.from("modules").select("*").eq("id", moduleId).maybeSingle(),
          supabase
            .from("chapters")
            .select("*")
            .eq("module_id", moduleId)
            .order("position"),
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .maybeSingle(),
        ]);

      if (!mod) {
        navigate({ to: "/" });
        return;
      }
      setModule(mod as Module);
      setIsAdmin(!!roleData);

      const chaps = (chapList as Chapter[]) || [];
      setChapters(chaps);

      if (chaps.length > 0) {
        setSelectedId(chaps[0].id);
        const ids = chaps.map((c) => c.id);
        const { data: progress } = await supabase
          .from("user_chapter_progress")
          .select("chapter_id")
          .eq("user_id", user.id)
          .in("chapter_id", ids);
        setCompleted(new Set((progress || []).map((p) => p.chapter_id)));
      }

      setDataLoading(false);
    })();
  }, [user, moduleId]);

  const reloadChapters = async () => {
    const { data } = await supabase
      .from("chapters")
      .select("*")
      .eq("module_id", moduleId)
      .order("position");
    const chaps = (data as Chapter[]) || [];
    setChapters(chaps);
    if (chaps.length > 0 && !selectedId) setSelectedId(chaps[0].id);
  };

  const validateChapter = async () => {
    if (!user || !selectedId || completed.has(selectedId) || validating) return;
    setValidating(true);
    await supabase
      .from("user_chapter_progress")
      .insert({ user_id: user.id, chapter_id: selectedId });
    const newCompleted = new Set([...completed, selectedId]);
    setCompleted(newCompleted);
    notifyProgressChanged();

    // Check if module is fully completed
    if (chapters.length > 0 && newCompleted.size >= chapters.length) {
      // fetch username for certificate
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", user.id)
        .maybeSingle();
      setUserName(prof?.full_name || prof?.username || user.email || "Pirate");
      await supabase
        .from("module_completions")
        .upsert(
          { user_id: user.id, module_id: moduleId },
          { onConflict: "user_id,module_id" },
        );
      setShowCertificate(true);
    } else {
      // Start countdown to next chapter if available
      const idx = chapters.findIndex((c) => c.id === selectedId);
      if (idx >= 0 && idx < chapters.length - 1) {
        setCountdownActive(true);
      }
    }
    setValidating(false);
  };

  const goToNextChapter = () => {
    setCountdownActive(false);
    const idx = chapters.findIndex((c) => c.id === selectedId);
    if (idx >= 0 && idx < chapters.length - 1) {
      setSelectedId(chapters[idx + 1].id);
    }
  };

  const flashMsg = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 2000);
  };

  const saveChapterField = async (field: "title" | "description", value: string) => {
    if (!selectedId) return;
    const v = value.trim();
    if (field === "title" && !v) return;
    const patch = field === "title" ? { title: v } : { description: v };
    await supabase.from("chapters").update(patch).eq("id", selectedId);
    setChapters((prev) =>
      prev.map((c) => (c.id === selectedId ? { ...c, [field]: v } : c)),
    );
    if (field === "title") setEditingTitle(false);
    else setEditingDesc(false);
    flashMsg("✓ Sauvegardé");
  };

  const prepareFile = (file: File) => {
    if (!file.type.startsWith("video/")) return;
    setPendingFile(file);
    setNewTitle(
      file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]/g, " ")
        .trim(),
    );
    setShowTitleForm(true);
  };

  const uploadAndCreate = async () => {
    if (!pendingFile || !newTitle.trim()) return;
    setUploading(true);
    setShowTitleForm(false);

    const ext = pendingFile.name.split(".").pop() || "mp4";
    const path = `${moduleId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("course-videos")
      .upload(path, pendingFile, { upsert: false });

    if (!error) {
      const { data: urlData } = supabase.storage
        .from("course-videos")
        .getPublicUrl(path);
      await supabase.from("chapters").insert({
        module_id: moduleId,
        title: newTitle.trim(),
        description: "",
        video_url: urlData.publicUrl,
        position: chapters.length,
        duration_seconds: 0,
      });
      await reloadChapters();
    }

    setUploading(false);
    setPendingFile(null);
    setNewTitle("");
  };

  const selected = chapters.find((c) => c.id === selectedId);
  const currentIdx = chapters.findIndex((c) => c.id === selectedId);
  const prevChapter = currentIdx > 0 ? chapters[currentIdx - 1] : null;
  const nextChapter =
    currentIdx < chapters.length - 1 ? chapters[currentIdx + 1] : null;
  const isDone = selectedId ? completed.has(selectedId) : false;
  const progressPct = chapters.length
    ? Math.round((completed.size / chapters.length) * 100)
    : 0;

  if (loading || !user || dataLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0e0418",
          color: "#c4a3f0",
          fontFamily: "-apple-system, sans-serif",
        }}
      >
        Chargement…
      </div>
    );
  }

  const hasChapters = chapters.length > 0;
  const videoUrl = selected ? toEmbedUrl(selected.video_url) : "";
  const direct = videoUrl ? isDirectVideo(videoUrl) : false;

  return (
    <div className="player-root">
      {/* Topbar */}
      <div className="player-topbar">
        <Link to="/" className="player-back">
          ← Formation
        </Link>
        {module && (
          <div className="player-module-name">{module.title}</div>
        )}
        {hasChapters && (
          <button
            className="player-sidebar-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            ☰ Chapitres
          </button>
        )}
      </div>

      <div className="player-layout">
        {/* ── Main area ── */}
        <div className="player-main">
          {hasChapters ? (
            <>
              {editingTitle ? (
                <div className="player-edit-inline" style={{ marginBottom: 12 }}>
                  <input
                    className="player-edit-input"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    autoFocus
                  />
                  <div className="player-edit-actions">
                    <button className="player-edit-save" onClick={() => void saveChapterField("title", draftTitle)}>Sauvegarder</button>
                    <button className="player-edit-cancel" onClick={() => setEditingTitle(false)}>Annuler</button>
                  </div>
                </div>
              ) : (
                <div className="player-title-row" style={{ marginBottom: 12 }}>
                  <h1 className="player-title" style={{ margin: 0 }}>{selected?.title}</h1>
                  {isAdmin && (
                    <button
                      className="player-edit-ghost"
                      onClick={() => { setDraftTitle(selected?.title || ""); setEditingTitle(true); }}
                      title="Modifier le titre"
                    >✏️</button>
                  )}
                </div>
              )}
              <div className="player-video-wrap" style={{ position: "relative" }}>
                {videoUrl ? (
                  direct ? (
                    <video key={videoUrl} src={videoUrl} controls className="player-iframe" />
                  ) : (
                    <iframe
                      src={videoUrl}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="player-iframe"
                      title={selected?.title}
                    />
                  )
                ) : (
                  <div className="player-no-video">
                    <span>📹</span>
                    <p>Vidéo bientôt disponible</p>
                  </div>
                )}
                <NextChapterCountdown
                  active={countdownActive}
                  onGo={goToNextChapter}
                  onCancel={() => setCountdownActive(false)}
                />
              </div>

              <div className="player-info">
                {editingDesc ? (
                  <div className="player-edit-inline">
                    <textarea
                      className="player-edit-textarea"
                      value={draftDesc}
                      onChange={(e) => setDraftDesc(e.target.value)}
                      rows={4}
                      autoFocus
                    />
                    <div className="player-edit-actions">
                      <button className="player-edit-save" onClick={() => void saveChapterField("description", draftDesc)}>Sauvegarder</button>
                      <button className="player-edit-cancel" onClick={() => setEditingDesc(false)}>Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div className="player-desc-row">
                    {selected?.description ? (
                      <p className="player-desc">{selected.description}</p>
                    ) : (
                      isAdmin && <p className="player-desc" style={{ opacity: 0.5 }}>Aucune description</p>
                    )}
                    {isAdmin && (
                      <button
                        className="player-edit-ghost small"
                        onClick={() => { setDraftDesc(selected?.description || ""); setEditingDesc(true); }}
                      >✏️ Modifier la description</button>
                    )}
                  </div>
                )}
                {flash && <div className="player-flash">{flash}</div>}
                {selectedId && <ResourcesSection chapterId={selectedId} />}
                {selectedId && <ReactionsRow chapterId={selectedId} />}
                <div className="player-actions">
                  <button
                    className={`player-validate${isDone ? " done" : ""}`}
                    onClick={validateChapter}
                    disabled={validating || isDone}
                  >
                    {isDone
                      ? "✓ Chapitre validé"
                      : validating
                        ? "Validation…"
                        : "✓ Valider ce chapitre"}
                  </button>
                  <div className="player-nav">
                    {prevChapter && (
                      <button
                        className="player-nav-btn"
                        onClick={() => setSelectedId(prevChapter.id)}
                      >
                        ← Précédent
                      </button>
                    )}
                    {nextChapter && (
                      <button
                        className={`player-next-chapter${isDone ? " pulse" : ""}`}
                        onClick={() => setSelectedId(nextChapter.id)}
                      >
                        Prochain chapitre <span className="arrow">→</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* ── "Bientôt disponible" ── */
            <div className="module-soon">
              <div className="module-soon-illustration" aria-hidden="true">
                <div className="ms-ring ms-ring-1" />
                <div className="ms-ring ms-ring-2" />
                <div className="ms-rocket">🚀</div>
                <div className="ms-star ms-s1">✦</div>
                <div className="ms-star ms-s2">✧</div>
                <div className="ms-star ms-s3">✦</div>
                <div className="ms-star ms-s4">✧</div>
              </div>

              <h2 className="ms-title">Ce module arrive bientôt !</h2>
              <p className="ms-desc">
                {module?.description ||
                  "Le contenu de ce module est en cours de préparation. Reviens très vite !"}
              </p>

              {/* Admin upload zone */}
              {isAdmin && (
                <div className="ms-upload-area">
                  {showTitleForm ? (
                    <div className="ms-title-form">
                      <div className="ms-file-label">📎 {pendingFile?.name}</div>
                      <input
                        className="ms-title-input"
                        placeholder="Titre du chapitre"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void uploadAndCreate();
                          if (e.key === "Escape") {
                            setShowTitleForm(false);
                            setPendingFile(null);
                          }
                        }}
                        autoFocus
                      />
                      <div className="ms-title-actions">
                        <button
                          className="ms-confirm"
                          onClick={() => void uploadAndCreate()}
                          disabled={!newTitle.trim()}
                        >
                          Créer le chapitre
                        </button>
                        <button
                          className="ms-cancel"
                          onClick={() => {
                            setShowTitleForm(false);
                            setPendingFile(null);
                          }}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : uploading ? (
                    <div className="ms-uploading">
                      <div className="ms-spinner" />
                      Envoi en cours…
                    </div>
                  ) : (
                    <div
                      className={`ms-dropzone${dragging ? " dragging" : ""}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragging(false);
                        const f = e.dataTransfer.files[0];
                        if (f) prepareFile(f);
                      }}
                    >
                      <div className="ms-dz-icon">🎬</div>
                      <div className="ms-dz-label">
                        Glissez une vidéo pour créer le premier chapitre
                      </div>
                      <div className="ms-dz-sub">MP4 · WebM · MOV</div>
                      <label className="ms-dz-browse">
                        Parcourir les fichiers
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="video/*"
                          hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) prepareFile(f);
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        {hasChapters && sidebarOpen && (
          <div
            className="player-sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {hasChapters && (
          <div
            className={`player-sidebar${sidebarOpen ? " open" : " closed"}`}
          >
            <div className="player-sidebar-title">Chapitres</div>
            <div className="player-chapters-list">
              {chapters.map((c, idx) => (
                <button
                  key={c.id}
                  className={[
                    "player-chapter-item",
                    c.id === selectedId ? "active" : "",
                    completed.has(c.id) ? "done" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    setSelectedId(c.id);
                    if (typeof window !== "undefined" && window.innerWidth < 768) {
                      setSidebarOpen(false);
                    }
                  }}
                >
                  <span className="chapter-num">{idx + 1}</span>
                  <span className="chapter-title">{c.title}</span>
                  {completed.has(c.id) && (
                    <span className="chapter-check">✓</span>
                  )}
                </button>
              ))}
            </div>
            <div className="player-sidebar-progress">
              <div className="pg-label">
                {completed.size} / {chapters.length} chapitres — {progressPct}%
              </div>
              <div className="pg-bar-wrap">
                <div className="pg-bar" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>
      <CertificateModal
        open={showCertificate}
        moduleTitle={module?.title || ""}
        userName={userName}
        onClose={() => setShowCertificate(false)}
      />
    </div>
  );
}
