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
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [newChapterVideoUrl, setNewChapterVideoUrl] = useState("");
  const [addingChapter, setAddingChapter] = useState(false);
  const [addingChapterUploading, setAddingChapterUploading] = useState(false);
  const [addChapterDragging, setAddChapterDragging] = useState(false);
  const addChapterFileRef = useRef<HTMLInputElement>(null);

  const resetAddChapter = () => {
    setShowAddChapter(false);
    setNewChapterTitle("");
    setNewChapterVideoUrl("");
  };

  const uploadChapterVideo = async (file: File) => {
    if (!file || addingChapterUploading) return;
    setAddingChapterUploading(true);
    const ext = file.name.split(".").pop() || "mp4";
    const path = `${moduleId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("course-videos")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (!error) {
      const { data } = supabase.storage.from("course-videos").getPublicUrl(path);
      setNewChapterVideoUrl(data.publicUrl);
    }
    setAddingChapterUploading(false);
  };

  const createChapter = async () => {
    if (!newChapterTitle.trim() || addingChapter) return;
    setAddingChapter(true);
    const { error } = await supabase.from("chapters").insert({
      module_id: moduleId,
      title: newChapterTitle.trim(),
      description: "",
      video_url: newChapterVideoUrl,
      position: chapters.length,
      duration_seconds: 0,
    });
    if (!error) {
      await reloadChapters();
      resetAddChapter();
    }
    setAddingChapter(false);
  };

  const deleteChapter = async (id: string) => {
    if (!confirm("Supprimer ce chapitre ? Cette action est irréversible.")) return;
    const { error } = await supabase.from("chapters").delete().eq("id", id);
    if (error) return;
    const remaining = chapters.filter((c) => c.id !== id);
    setChapters(remaining);
    if (selectedId === id) {
      setSelectedId(remaining[0]?.id ?? null);
    }
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    const syncSidebar = () => setSidebarOpen(window.innerWidth >= 768);
    syncSidebar();
    window.addEventListener("resize", syncSidebar);
    return () => window.removeEventListener("resize", syncSidebar);
  }, []);

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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 20px 10px",
              }}
            >
              <div className="player-sidebar-title" style={{ padding: 0 }}>Chapitres</div>
              {isAdmin && (
                <button
                  onClick={() => setShowAddChapter(true)}
                  style={{
                    width: 28,
                    height: 28,
                    background: "rgba(168,85,247,0.15)",
                    border: "1px solid rgba(168,85,247,0.3)",
                    borderRadius: 8,
                    color: "#c4a3f0",
                    fontSize: 18,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                  title="Ajouter un chapitre"
                >
                  +
                </button>
              )}
            </div>
            {isAdmin && showAddChapter && (
              <div
                style={{
                  margin: "0 8px 12px",
                  background: "rgba(15,5,30,0.8)",
                  border: "1px solid rgba(168,85,247,0.25)",
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <input
                  placeholder="Titre du chapitre"
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") resetAddChapter();
                  }}
                  autoFocus
                  style={{
                    background: "rgba(10,3,20,0.8)",
                    border: "1px solid rgba(168,85,247,0.2)",
                    borderRadius: 7,
                    padding: "7px 10px",
                    color: "#e2d4f8",
                    fontSize: 13,
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                />
                <input
                  ref={addChapterFileRef}
                  type="file"
                  accept="video/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadChapterVideo(f);
                    e.target.value = "";
                  }}
                />
                {newChapterVideoUrl ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "8px 10px",
                      borderRadius: 7,
                      background: "rgba(34,197,94,0.12)",
                      border: "1px solid rgba(34,197,94,0.3)",
                      color: "#b9f3cf",
                      fontSize: 12,
                    }}
                  >
                    <span>✅ Vidéo prête</span>
                    <button
                      onClick={() => {
                        setNewChapterVideoUrl("");
                        addChapterFileRef.current?.click();
                      }}
                      style={{
                        background: "none",
                        border: "1px solid rgba(168,85,247,0.3)",
                        borderRadius: 6,
                        color: "#c4a3f0",
                        fontSize: 11,
                        padding: "4px 8px",
                        cursor: "pointer",
                      }}
                    >
                      Changer
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => !addingChapterUploading && addChapterFileRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setAddChapterDragging(true);
                    }}
                    onDragLeave={() => setAddChapterDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setAddChapterDragging(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) void uploadChapterVideo(f);
                    }}
                    style={{
                      padding: "14px 10px",
                      borderRadius: 7,
                      border: `1px dashed ${addChapterDragging ? "#a855f7" : "rgba(168,85,247,0.3)"}`,
                      background: addChapterDragging ? "rgba(168,85,247,0.12)" : "rgba(10,3,20,0.4)",
                      color: "#9a7dbd",
                      fontSize: 12,
                      textAlign: "center",
                      cursor: addingChapterUploading ? "wait" : "pointer",
                    }}
                  >
                    {addingChapterUploading ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span
                          style={{
                            width: 12,
                            height: 12,
                            border: "2px solid rgba(168,85,247,0.3)",
                            borderTopColor: "#a855f7",
                            borderRadius: "50%",
                            display: "inline-block",
                            animation: "spin 0.8s linear infinite",
                          }}
                        />
                        Envoi en cours…
                      </span>
                    ) : (
                      <>Glisser une vidéo ici ou cliquer</>
                    )}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => void createChapter()}
                    disabled={!newChapterTitle.trim() || addingChapter || addingChapterUploading}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      background: "linear-gradient(135deg,#7c3aed,#a855f7)",
                      border: "none",
                      borderRadius: 7,
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      opacity: !newChapterTitle.trim() || addingChapterUploading ? 0.5 : 1,
                    }}
                  >
                    {addingChapter ? "…" : "Créer le chapitre"}
                  </button>
                  <button
                    onClick={resetAddChapter}
                    style={{
                      padding: "8px 12px",
                      background: "none",
                      border: "1px solid rgba(168,85,247,0.2)",
                      borderRadius: 7,
                      color: "#9a7dbd",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            <div className="player-chapters-list">
              {chapters.map((c, idx) => (
                <div key={c.id} style={{ position: "relative" }}>
                  <button
                    className={[
                      "player-chapter-item",
                      c.id === selectedId ? "active" : "",
                      completed.has(c.id) ? "done" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={isAdmin ? { paddingRight: 36, width: "100%" } : undefined}
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
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteChapter(c.id);
                      }}
                      title="Supprimer le chapitre"
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 22,
                        height: 22,
                        background: "rgba(239,68,68,0.15)",
                        border: "1px solid rgba(239,68,68,0.3)",
                        borderRadius: 6,
                        color: "#fca5a5",
                        fontSize: 12,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
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
