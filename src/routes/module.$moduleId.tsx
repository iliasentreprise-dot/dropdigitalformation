import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Component, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { ResourcesSection } from "@/components/dd/ResourcesSection";
import { ReactionsRow } from "@/components/dd/ReactionsRow";
import { NextChapterCountdown } from "@/components/dd/NextChapterCountdown";
import { CertificateModal } from "@/components/dd/CertificateModal";
import { notifyProgressChanged } from "@/components/dd/GlobalProgressBar";
import { RichText } from "@/lib/rich-text";
import "../styles/player.css";

export const Route = createFileRoute("/module/$moduleId")({
  loader: async ({ params }) => {
    try {
      const [{ data: mod }, { data: chs }] = await Promise.all([
        supabase.from("modules").select("*").eq("id", params.moduleId).maybeSingle(),
        supabase.from("chapters").select("*").eq("module_id", params.moduleId).order("position"),
      ]);
      return { module: (mod as Module | null), chapters: ((chs as Chapter[]) ?? []) };
    } catch {
      return { module: null, chapters: [] as Chapter[] };
    }
  },
  pendingComponent: () => (
    <div className="dd-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", background: "oklch(0.129 0.042 264.695)" }}>
      <div style={{ color: "#9a7dbd", fontSize: 14 }}>Chargement…</div>
    </div>
  ),
  component: ModulePageWithBoundary,
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

const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500 MB
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

async function uploadWithProgress(
  file: File,
  path: string,
  bucket: string,
  onProgress: (pct: number) => void,
  signal: AbortSignal,
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(`${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`);
      } else {
        try {
          const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
          reject(new Error(body.message || body.error || `Erreur ${xhr.status}`));
        } catch {
          reject(new Error(`Erreur upload (${xhr.status})`));
        }
      }
    };
    xhr.onerror = () => reject(new Error("Connexion coupée pendant l'upload"));
    signal.addEventListener("abort", () => {
      xhr.abort();
      reject(new Error("Timeout : upload annulé après 5 minutes"));
    }, { once: true });
    xhr.open("POST", `${supabaseUrl}/storage/v1/object/${bucket}/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("x-upsert", "true");
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

class VideoErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0e0418", color: "#c4a3f0", fontFamily: "-apple-system, sans-serif", gap: 16, padding: 24 }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <p style={{ margin: 0, textAlign: "center" }}>Une erreur est survenue sur cette page.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", border: "none", color: "#fff", borderRadius: 10, padding: "10px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ModulePageWithBoundary() {
  return (
    <VideoErrorBoundary>
      <ModulePage />
    </VideoErrorBoundary>
  );
}

function ModulePage() {
  const { moduleId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const loaderData = Route.useLoaderData();

  const [module, setModule] = useState<Module | null>(loaderData.module);
  const [chapters, setChapters] = useState<Chapter[]>(loaderData.chapters);
  const [selectedId, setSelectedId] = useState<string | null>(loaderData.chapters[0]?.id ?? null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [validating, setValidating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dataLoading, setDataLoading] = useState(!loaderData.module);
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
  const [uploadProgress, setUploadProgress] = useState(-1);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [showTitleForm, setShowTitleForm] = useState(false);
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [newChapterVideoUrl, setNewChapterVideoUrl] = useState("");
  const [addingChapter, setAddingChapter] = useState(false);
  const [addingChapterUploading, setAddingChapterUploading] = useState(false);
  const [addChapterProgress, setAddChapterProgress] = useState(-1);
  const [addChapterError, setAddChapterError] = useState<string | null>(null);
  const [addChapterDragging, setAddChapterDragging] = useState(false);
  const addChapterFileRef = useRef<HTMLInputElement>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(-1);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
  const videoUploadRef = useRef<HTMLInputElement>(null);

  // URL alternative inputs
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState("");
  const [showAddChapterUrl, setShowAddChapterUrl] = useState(false);
  const [addChapterUrl, setAddChapterUrl] = useState("");
  const [showMainUrl, setShowMainUrl] = useState(false);
  const [mainUrlValue, setMainUrlValue] = useState("");

  // Video player error state
  const [videoPlayError, setVideoPlayError] = useState(false);

  const resetAddChapter = () => {
    setShowAddChapter(false);
    setNewChapterTitle("");
    setNewChapterVideoUrl("");
    setAddChapterProgress(-1);
    setAddChapterError(null);
    setShowAddChapterUrl(false);
    setAddChapterUrl("");
  };

  function validateFileSize(file: File): string | null {
    if (file.size > MAX_VIDEO_SIZE) {
      return `Fichier trop lourd : ${(file.size / 1024 / 1024).toFixed(0)} MB (max 500 MB)`;
    }
    if (!file.type.startsWith("video/")) {
      return `Format non supporté : ${file.type || "inconnu"} — utilisez MP4, WebM ou MOV`;
    }
    return null;
  }

  const uploadChapterVideo = async (file: File) => {
    if (!file || addingChapterUploading) return;
    const err = validateFileSize(file);
    if (err) { setAddChapterError(err); return; }
    setAddingChapterUploading(true);
    setAddChapterError(null);
    setAddChapterProgress(0);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${moduleId}/${Date.now()}.${ext}`;
      const publicUrl = await uploadWithProgress(file, path, "course-videos", setAddChapterProgress, controller.signal);
      setNewChapterVideoUrl(publicUrl);
    } catch (e) {
      setAddChapterError(e instanceof Error ? e.message : "Erreur inconnue pendant l'upload");
    } finally {
      window.clearTimeout(timer);
      setAddingChapterUploading(false);
      setAddChapterProgress(-1);
    }
  };

  const createChapter = async () => {
    if (!newChapterTitle.trim() || addingChapter) return;
    setAddingChapter(true);
    try {
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
    } catch {
      // Silently ignore network errors here; user can retry
    }
    setAddingChapter(false);
  };

  const deleteChapter = async (id: string) => {
    if (!confirm("Supprimer ce chapitre ? Cette action est irréversible.")) return;
    try {
      const { error } = await supabase.from("chapters").delete().eq("id", id);
      if (error) return;
      const remaining = chapters.filter((c) => c.id !== id);
      setChapters(remaining);
      if (selectedId === id) setSelectedId(remaining[0]?.id ?? null);
    } catch {
      // ignore
    }
  };

  const moveChapter = async (id: string, dir: "up" | "down") => {
    const idx = chapters.findIndex((c) => c.id === id);
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === chapters.length - 1) return;
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    const a = chapters[idx];
    const b = chapters[swapIdx];
    const next = [...chapters];
    next[idx] = { ...a, position: b.position };
    next[swapIdx] = { ...b, position: a.position };
    next.sort((x, y) => x.position - y.position);
    setChapters(next);
    try {
      await Promise.all([
        supabase.from("chapters").update({ position: b.position }).eq("id", a.id),
        supabase.from("chapters").update({ position: a.position }).eq("id", b.id),
      ]);
    } catch {
      setChapters(chapters);
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
    (async () => {
      try {
        if (!module) {
          setDataLoading(true);
          const [{ data: mod }, { data: chapList }] = await Promise.all([
            supabase.from("modules").select("*").eq("id", moduleId).maybeSingle(),
            supabase.from("chapters").select("*").eq("module_id", moduleId).order("position"),
          ]);
          if (!mod) { navigate({ to: "/" }); return; }
          setModule(mod as Module);
          const chaps = (chapList as Chapter[]) || [];
          setChapters(chaps);
          if (chaps.length > 0) setSelectedId(chaps[0].id);
        }

        const currentChapters = chapters.length > 0 ? chapters : [];
        const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
        const rolePriority: Record<string, number> = { admin: 3, moderator: 2, user: 1 };
        const topRole = (roleRows ?? []).reduce<string>((best, r: { role: string }) => (rolePriority[r.role] ?? 0) > (rolePriority[best] ?? 0) ? r.role : best, "user");
        setIsAdmin(topRole === "admin" || topRole === "moderator");

        if (currentChapters.length > 0) {
          const ids = currentChapters.map((c) => c.id);
          const { data: progress } = await supabase
            .from("user_chapter_progress")
            .select("chapter_id")
            .eq("user_id", user.id)
            .in("chapter_id", ids);
          setCompleted(new Set((progress || []).map((p) => p.chapter_id)));
        }
      } catch {
        // ignore load errors; page shows what it has
      }
      setDataLoading(false);
    })();
  }, [user, moduleId]);

  const reloadChapters = async () => {
    try {
      const { data } = await supabase
        .from("chapters")
        .select("*")
        .eq("module_id", moduleId)
        .order("position");
      const chaps = (data as Chapter[]) || [];
      setChapters(chaps);
      if (chaps.length > 0 && !selectedId) setSelectedId(chaps[0].id);
    } catch { /* ignore */ }
  };

  const validateChapter = async () => {
    if (!user || !selectedId || completed.has(selectedId) || validating) return;
    setValidating(true);
    try {
      await supabase.from("user_chapter_progress").insert({ user_id: user.id, chapter_id: selectedId });
      const newCompleted = new Set([...completed, selectedId]);
      setCompleted(newCompleted);
      notifyProgressChanged();

      if (chapters.length > 0 && newCompleted.size >= chapters.length) {
        const { data: prof } = await supabase.from("profiles").select("full_name, username").eq("id", user.id).maybeSingle();
        setUserName(prof?.full_name || prof?.username || user.email || "Pirate");
        await supabase.from("module_completions").upsert({ user_id: user.id, module_id: moduleId }, { onConflict: "user_id,module_id" });
        setShowCertificate(true);
      } else {
        const idx = chapters.findIndex((c) => c.id === selectedId);
        if (idx >= 0 && idx < chapters.length - 1) setCountdownActive(true);
      }
    } catch { /* ignore */ }
    setValidating(false);
  };

  const goToNextChapter = () => {
    setCountdownActive(false);
    const idx = chapters.findIndex((c) => c.id === selectedId);
    if (idx >= 0 && idx < chapters.length - 1) setSelectedId(chapters[idx + 1].id);
  };

  const flashMsg = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 2000);
  };

  const saveChapterField = async (field: "title" | "description", value: string) => {
    if (!selectedId) return;
    const v = value.trim();
    if (field === "title" && !v) return;
    try {
      const patch = field === "title" ? { title: v } : { description: v };
      await supabase.from("chapters").update(patch).eq("id", selectedId);
      setChapters((prev) => prev.map((c) => (c.id === selectedId ? { ...c, [field]: v } : c)));
      if (field === "title") setEditingTitle(false);
      else setEditingDesc(false);
      flashMsg("✓ Sauvegardé");
    } catch { /* ignore */ }
  };

  const deleteChapterVideo = async () => {
    if (!selectedId || !confirm("Supprimer la vidéo de ce chapitre ? Cette action est irréversible.")) return;
    try {
      await supabase.from("chapters").update({ video_url: "" }).eq("id", selectedId);
      setChapters((prev) => prev.map((c) => c.id === selectedId ? { ...c, video_url: "" } : c));
    } catch { /* ignore */ }
  };

  const uploadVideoForChapter = async (file: File) => {
    if (!selectedId || !moduleId || videoUploading) return;
    const err = validateFileSize(file);
    if (err) { setVideoUploadError(err); return; }
    setVideoUploading(true);
    setVideoUploadError(null);
    setVideoUploadProgress(0);
    setVideoPlayError(false);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${moduleId}/${selectedId}/${Date.now()}.${ext}`;
      const publicUrl = await uploadWithProgress(file, path, "course-videos", setVideoUploadProgress, controller.signal);
      await supabase.from("chapters").update({ video_url: publicUrl }).eq("id", selectedId);
      setChapters((prev) => prev.map((c) => c.id === selectedId ? { ...c, video_url: publicUrl } : c));
    } catch (e) {
      setVideoUploadError(e instanceof Error ? e.message : "Erreur inconnue pendant l'upload");
    } finally {
      window.clearTimeout(timer);
      setVideoUploading(false);
      setVideoUploadProgress(-1);
    }
  };

  const saveUrlForChapter = async (url: string) => {
    if (!selectedId || !url.trim()) return;
    try {
      await supabase.from("chapters").update({ video_url: url.trim() }).eq("id", selectedId);
      setChapters((prev) => prev.map((c) => c.id === selectedId ? { ...c, video_url: url.trim() } : c));
      setShowUrlInput(false);
      setUrlInputValue("");
      setVideoPlayError(false);
    } catch { /* ignore */ }
  };

  const prepareFile = (file: File) => {
    if (!file.type.startsWith("video/")) return;
    const err = validateFileSize(file);
    if (err) { setUploadError(err); return; }
    setPendingFile(file);
    setNewTitle(file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim());
    setShowTitleForm(true);
    setUploadError(null);
  };

  const uploadAndCreate = async () => {
    if (!pendingFile || !newTitle.trim()) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setShowTitleForm(false);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
    try {
      const ext = pendingFile.name.split(".").pop() || "mp4";
      const path = `${moduleId}/${Date.now()}.${ext}`;
      const publicUrl = await uploadWithProgress(pendingFile, path, "course-videos", setUploadProgress, controller.signal);
      await supabase.from("chapters").insert({
        module_id: moduleId,
        title: newTitle.trim(),
        description: "",
        video_url: publicUrl,
        position: chapters.length,
        duration_seconds: 0,
      });
      await reloadChapters();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Erreur inconnue pendant l'upload");
      setShowTitleForm(true); // re-show form so user can retry
    } finally {
      window.clearTimeout(timer);
      setUploading(false);
      setUploadProgress(-1);
      setPendingFile(null);
      setNewTitle("");
    }
  };

  const createChapterFromUrl = async (url: string) => {
    if (!url.trim()) return;
    try {
      await supabase.from("chapters").insert({
        module_id: moduleId,
        title: "Nouveau chapitre",
        description: "",
        video_url: url.trim(),
        position: chapters.length,
        duration_seconds: 0,
      });
      await reloadChapters();
      setShowMainUrl(false);
      setMainUrlValue("");
    } catch { /* ignore */ }
  };

  const selected = chapters.find((c) => c.id === selectedId);
  const currentIdx = chapters.findIndex((c) => c.id === selectedId);
  const prevChapter = currentIdx > 0 ? chapters[currentIdx - 1] : null;
  const nextChapter = currentIdx < chapters.length - 1 ? chapters[currentIdx + 1] : null;
  const isDone = selectedId ? completed.has(selectedId) : false;
  const progressPct = chapters.length ? Math.round((completed.size / chapters.length) * 100) : 0;

  if (loading || !user || dataLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e0418", color: "#c4a3f0", fontFamily: "-apple-system, sans-serif" }}>
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
        <Link to="/" className="player-back">← Formation</Link>
        {module && <div className="player-module-name">{module.title}</div>}
        {hasChapters && (
          <button className="player-sidebar-toggle" onClick={() => setSidebarOpen((v) => !v)}>
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
                  <input className="player-edit-input" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} autoFocus />
                  <div className="player-edit-actions">
                    <button className="player-edit-save" onClick={() => void saveChapterField("title", draftTitle)}>Sauvegarder</button>
                    <button className="player-edit-cancel" onClick={() => setEditingTitle(false)}>Annuler</button>
                  </div>
                </div>
              ) : (
                <div className="player-title-row" style={{ marginBottom: 12 }}>
                  <h1 className="player-title" style={{ margin: 0 }}>{selected?.title}</h1>
                  {isAdmin && (
                    <button className="player-edit-ghost" onClick={() => { setDraftTitle(selected?.title || ""); setEditingTitle(true); }} title="Modifier le titre">✏️</button>
                  )}
                  {isAdmin && selected?.video_url && (
                    <button className="player-edit-ghost" onClick={() => void deleteChapterVideo()} title="Supprimer la vidéo" style={{ color: "#fca5a5", borderColor: "rgba(239,68,68,0.3)" }}>🗑 Vidéo</button>
                  )}
                </div>
              )}

              <div className="player-video-wrap" style={{ position: "relative" }}>
                {videoUrl ? (
                  direct ? (
                    videoPlayError ? (
                      <div className="player-no-video">
                        <span>⚠️</span>
                        <p>La vidéo n'a pas pu se charger sur cet appareil.</p>
                        <a href={videoUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#a855f7", fontSize: 13 }}>Ouvrir la vidéo directement →</a>
                        {isAdmin && (
                          <button onClick={() => { setVideoPlayError(false); setShowUrlInput(true); }} style={{ marginTop: 8, background: "none", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 8, color: "#c4a3f0", padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>
                            Changer l'URL
                          </button>
                        )}
                      </div>
                    ) : (
                      <video
                        key={videoUrl}
                        src={videoUrl}
                        controls
                        className="player-iframe"
                        onError={() => setVideoPlayError(true)}
                      />
                    )
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
                    {isAdmin && (
                      <>
                        {videoUploadError && (
                          <div style={{ color: "#fca5a5", fontSize: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px 12px", maxWidth: 320, textAlign: "center" }}>
                            ❌ {videoUploadError}
                            <button onClick={() => setVideoUploadError(null)} style={{ display: "block", margin: "6px auto 0", background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 11 }}>Fermer</button>
                          </div>
                        )}
                        {videoUploading ? (
                          <div style={{ width: "100%", maxWidth: 280 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#10b981", fontSize: 13, marginBottom: 6 }}>
                              <span>Upload en cours…</span>
                              <span style={{ fontWeight: 700 }}>{videoUploadProgress >= 0 ? `${videoUploadProgress}%` : ""}</span>
                            </div>
                            <div style={{ height: 6, background: "rgba(16,185,129,0.15)", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${videoUploadProgress >= 0 ? videoUploadProgress : 0}%`, background: "linear-gradient(90deg,#10b981,#34d399)", borderRadius: 3, transition: "width 0.3s" }} />
                            </div>
                          </div>
                        ) : showUrlInput ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 340 }}>
                            <input
                              value={urlInputValue}
                              onChange={(e) => setUrlInputValue(e.target.value)}
                              placeholder="URL YouTube non listé ou Vimeo…"
                              style={{ background: "rgba(10,3,20,0.8)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 8, padding: "8px 12px", color: "#e2d4f8", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                              autoFocus
                              onKeyDown={(e) => { if (e.key === "Enter") void saveUrlForChapter(urlInputValue); if (e.key === "Escape") { setShowUrlInput(false); setUrlInputValue(""); } }}
                            />
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => void saveUrlForChapter(urlInputValue)} disabled={!urlInputValue.trim()} style={{ flex: 1, padding: "8px 0", background: "linear-gradient(135deg,#7c3aed,#a855f7)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: urlInputValue.trim() ? 1 : 0.5 }}>
                                Utiliser cette URL
                              </button>
                              <button onClick={() => { setShowUrlInput(false); setUrlInputValue(""); }} style={{ padding: "8px 12px", background: "none", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 8, color: "#9a7dbd", fontSize: 13, cursor: "pointer" }}>✕</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                            <button
                              onClick={() => videoUploadRef.current?.click()}
                              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", border: "none", color: "#fff", borderRadius: 10, padding: "10px 22px", fontWeight: 700, fontSize: 14, cursor: "pointer", marginTop: 4 }}
                            >
                              ⬆ Uploader une vidéo
                            </button>
                            <button onClick={() => setShowUrlInput(true)} style={{ background: "none", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 8, color: "#9a7dbd", padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>
                              🔗 Utiliser une URL YouTube / Vimeo
                            </button>
                          </div>
                        )}
                        <input
                          ref={videoUploadRef}
                          type="file"
                          accept="video/*"
                          hidden
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadVideoForChapter(f); e.target.value = ""; }}
                        />
                      </>
                    )}
                  </div>
                )}
                <NextChapterCountdown active={countdownActive} onGo={goToNextChapter} onCancel={() => setCountdownActive(false)} />
              </div>

              <div className="player-info">
                {editingDesc ? (
                  <div className="player-edit-inline">
                    <textarea className="player-edit-textarea" value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} rows={6} autoFocus placeholder="**texte** pour gras · Ligne vide pour nouveau paragraphe" />
                    <div style={{ fontSize: 11, color: "#9a7dbd", marginTop: 4 }}>💡 <strong>**gras**</strong> · Ligne vide = nouveau paragraphe</div>
                    <div className="player-edit-actions">
                      <button className="player-edit-save" onClick={() => void saveChapterField("description", draftDesc)}>Sauvegarder</button>
                      <button className="player-edit-cancel" onClick={() => setEditingDesc(false)}>Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div className="player-desc-row">
                    {selected?.description ? (
                      <RichText text={selected.description} className="player-desc" />
                    ) : (
                      isAdmin && <p className="player-desc" style={{ opacity: 0.5 }}>Aucune description</p>
                    )}
                    {isAdmin && (
                      <button className="player-edit-ghost small" onClick={() => { setDraftDesc(selected?.description || ""); setEditingDesc(true); }}>✏️ Modifier la description</button>
                    )}
                  </div>
                )}
                {flash && <div className="player-flash">{flash}</div>}
                {selectedId && <ResourcesSection chapterId={selectedId} />}
                {selectedId && <ReactionsRow chapterId={selectedId} />}
                <div className="player-actions">
                  <button className={`player-validate${isDone ? " done" : ""}`} onClick={validateChapter} disabled={validating || isDone}>
                    {isDone ? "✓ Chapitre validé" : validating ? "Validation…" : "✓ Valider ce chapitre"}
                  </button>
                  <div className="player-nav">
                    {prevChapter && (
                      <button className="player-nav-btn" onClick={() => setSelectedId(prevChapter.id)}>← Précédent</button>
                    )}
                    {nextChapter && (
                      <button className={`player-next-chapter${isDone ? " pulse" : ""}`} onClick={() => setSelectedId(nextChapter.id)}>
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
              {module?.description ? (
                <RichText text={module.description} className="ms-desc" />
              ) : (
                <p className="ms-desc">Le contenu de ce module est en cours de préparation. Reviens très vite !</p>
              )}

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
                          if (e.key === "Escape") { setShowTitleForm(false); setPendingFile(null); }
                        }}
                        autoFocus
                      />
                      <div className="ms-title-actions">
                        <button className="ms-confirm" onClick={() => void uploadAndCreate()} disabled={!newTitle.trim()}>Créer le chapitre</button>
                        <button className="ms-cancel" onClick={() => { setShowTitleForm(false); setPendingFile(null); }}>Annuler</button>
                      </div>
                    </div>
                  ) : uploading ? (
                    <div className="ms-uploading">
                      <div style={{ width: "100%", maxWidth: 280 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#c4a3f0", marginBottom: 6 }}>
                          <span>Envoi en cours…</span>
                          <span style={{ fontWeight: 700 }}>{uploadProgress >= 0 ? `${uploadProgress}%` : ""}</span>
                        </div>
                        <div style={{ height: 6, background: "rgba(168,85,247,0.15)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${uploadProgress >= 0 ? uploadProgress : 0}%`, background: "linear-gradient(90deg,#7c3aed,#a855f7)", borderRadius: 3, transition: "width 0.3s" }} />
                        </div>
                      </div>
                    </div>
                  ) : showMainUrl ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 360 }}>
                      <p style={{ margin: 0, fontSize: 13, color: "#9a7dbd" }}>Coller une URL YouTube non listé ou Vimeo :</p>
                      {uploadError && (
                        <div style={{ color: "#fca5a5", fontSize: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "6px 10px" }}>❌ {uploadError}</div>
                      )}
                      <input
                        value={mainUrlValue}
                        onChange={(e) => setMainUrlValue(e.target.value)}
                        placeholder="https://youtu.be/... ou https://vimeo.com/..."
                        style={{ background: "rgba(10,3,20,0.8)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 8, padding: "8px 12px", color: "#e2d4f8", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") void createChapterFromUrl(mainUrlValue); if (e.key === "Escape") { setShowMainUrl(false); setMainUrlValue(""); } }}
                      />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => void createChapterFromUrl(mainUrlValue)} disabled={!mainUrlValue.trim()} style={{ flex: 1, padding: "8px 0", background: "linear-gradient(135deg,#7c3aed,#a855f7)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: mainUrlValue.trim() ? 1 : 0.5 }}>
                          Utiliser cette URL
                        </button>
                        <button onClick={() => { setShowMainUrl(false); setMainUrlValue(""); setUploadError(null); }} style={{ padding: "8px 12px", background: "none", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 8, color: "#9a7dbd", fontSize: 13, cursor: "pointer" }}>✕</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`ms-dropzone${dragging ? " dragging" : ""}`}
                      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) prepareFile(f); }}
                    >
                      {uploadError && (
                        <div style={{ color: "#fca5a5", fontSize: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "6px 10px", marginBottom: 8, width: "100%", textAlign: "center" }}>
                          ❌ {uploadError}
                          <button onClick={() => setUploadError(null)} style={{ display: "block", margin: "4px auto 0", background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 11 }}>Fermer</button>
                        </div>
                      )}
                      <div className="ms-dz-icon">🎬</div>
                      <div className="ms-dz-label">Glissez une vidéo pour créer le premier chapitre</div>
                      <div className="ms-dz-sub">MP4 · WebM · MOV · Max 500 MB</div>
                      <label className="ms-dz-browse">
                        Parcourir les fichiers
                        <input ref={fileInputRef} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) prepareFile(f); }} />
                      </label>
                      <button onClick={() => { setUploadError(null); setShowMainUrl(true); }} style={{ marginTop: 8, background: "none", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 8, color: "#9a7dbd", padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>
                        🔗 Utiliser une URL YouTube / Vimeo
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        {hasChapters && sidebarOpen && (
          <div className="player-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
        )}
        {hasChapters && (
          <div className={`player-sidebar${sidebarOpen ? " open" : " closed"}`}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 10px" }}>
              <div className="player-sidebar-title" style={{ padding: 0 }}>Chapitres</div>
              {isAdmin && (
                <button
                  onClick={() => setShowAddChapter(true)}
                  style={{ width: 28, height: 28, background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 8, color: "#c4a3f0", fontSize: 18, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, flexShrink: 0 }}
                  title="Ajouter un chapitre"
                >
                  +
                </button>
              )}
            </div>

            {isAdmin && showAddChapter && (
              <div style={{ margin: "0 8px 12px", background: "rgba(15,5,30,0.8)", border: "1px solid rgba(168,85,247,0.25)", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  placeholder="Titre du chapitre"
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") resetAddChapter(); }}
                  autoFocus
                  style={{ background: "rgba(10,3,20,0.8)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 7, padding: "7px 10px", color: "#e2d4f8", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                />
                <input
                  ref={addChapterFileRef}
                  type="file"
                  accept="video/*"
                  hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadChapterVideo(f); e.target.value = ""; }}
                />
                {addChapterError && (
                  <div style={{ color: "#fca5a5", fontSize: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 7, padding: "6px 10px" }}>
                    ❌ {addChapterError}
                    <button onClick={() => setAddChapterError(null)} style={{ display: "block", background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 11, padding: 0, marginTop: 2 }}>Fermer</button>
                  </div>
                )}
                {newChapterVideoUrl ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderRadius: 7, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#b9f3cf", fontSize: 12 }}>
                    <span>✅ Vidéo prête</span>
                    <button onClick={() => { setNewChapterVideoUrl(""); addChapterFileRef.current?.click(); }} style={{ background: "none", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 6, color: "#c4a3f0", fontSize: 11, padding: "4px 8px", cursor: "pointer" }}>Changer</button>
                  </div>
                ) : addingChapterUploading ? (
                  <div style={{ padding: "10px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#a855f7", marginBottom: 6 }}>
                      <span>Envoi…</span>
                      <span style={{ fontWeight: 700 }}>{addChapterProgress >= 0 ? `${addChapterProgress}%` : ""}</span>
                    </div>
                    <div style={{ height: 4, background: "rgba(168,85,247,0.15)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${addChapterProgress >= 0 ? addChapterProgress : 0}%`, background: "linear-gradient(90deg,#7c3aed,#a855f7)", borderRadius: 2, transition: "width 0.3s" }} />
                    </div>
                  </div>
                ) : showAddChapterUrl ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <input
                      value={addChapterUrl}
                      onChange={(e) => setAddChapterUrl(e.target.value)}
                      placeholder="URL YouTube / Vimeo…"
                      style={{ background: "rgba(10,3,20,0.8)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 7, padding: "7px 10px", color: "#e2d4f8", fontSize: 12, fontFamily: "inherit", outline: "none" }}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && addChapterUrl.trim()) { setNewChapterVideoUrl(addChapterUrl.trim()); setShowAddChapterUrl(false); setAddChapterUrl(""); }
                        if (e.key === "Escape") { setShowAddChapterUrl(false); setAddChapterUrl(""); }
                      }}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => { if (addChapterUrl.trim()) { setNewChapterVideoUrl(addChapterUrl.trim()); setShowAddChapterUrl(false); setAddChapterUrl(""); } }}
                        disabled={!addChapterUrl.trim()}
                        style={{ flex: 1, padding: "7px 0", background: "linear-gradient(135deg,#7c3aed,#a855f7)", border: "none", borderRadius: 7, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: addChapterUrl.trim() ? 1 : 0.5 }}
                      >
                        Utiliser cette URL
                      </button>
                      <button onClick={() => { setShowAddChapterUrl(false); setAddChapterUrl(""); }} style={{ padding: "7px 10px", background: "none", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 7, color: "#9a7dbd", fontSize: 12, cursor: "pointer" }}>✕</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <div
                      onClick={() => !addingChapterUploading && addChapterFileRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setAddChapterDragging(true); }}
                      onDragLeave={() => setAddChapterDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setAddChapterDragging(false); const f = e.dataTransfer.files?.[0]; if (f) void uploadChapterVideo(f); }}
                      style={{ flex: 1, padding: "12px 10px", borderRadius: 7, border: `1px dashed ${addChapterDragging ? "#a855f7" : "rgba(168,85,247,0.3)"}`, background: addChapterDragging ? "rgba(168,85,247,0.12)" : "rgba(10,3,20,0.4)", color: "#9a7dbd", fontSize: 11, textAlign: "center", cursor: "pointer" }}
                    >
                      ⬆ Vidéo
                    </div>
                    <button onClick={() => setShowAddChapterUrl(true)} style={{ padding: "12px 10px", borderRadius: 7, border: "1px dashed rgba(168,85,247,0.3)", background: "rgba(10,3,20,0.4)", color: "#9a7dbd", fontSize: 11, cursor: "pointer" }} title="URL YouTube / Vimeo">
                      🔗 URL
                    </button>
                  </div>
                )}

                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => void createChapter()}
                    disabled={!newChapterTitle.trim() || addingChapter || addingChapterUploading}
                    style={{ flex: 1, padding: "8px 0", background: "linear-gradient(135deg,#7c3aed,#a855f7)", border: "none", borderRadius: 7, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: !newChapterTitle.trim() || addingChapterUploading ? 0.5 : 1 }}
                  >
                    {addingChapter ? "…" : "Créer le chapitre"}
                  </button>
                  <button onClick={resetAddChapter} style={{ padding: "8px 12px", background: "none", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 7, color: "#9a7dbd", fontSize: 12, cursor: "pointer" }}>✕</button>
                </div>
              </div>
            )}

            <div className="player-chapters-list">
              {chapters.map((c, idx) => (
                <div key={c.id} style={{ position: "relative" }}>
                  <button
                    className={["player-chapter-item", c.id === selectedId ? "active" : "", completed.has(c.id) ? "done" : ""].filter(Boolean).join(" ")}
                    style={isAdmin ? { paddingLeft: 38, paddingRight: 36, width: "100%" } : undefined}
                    onClick={() => { setSelectedId(c.id); if (typeof window !== "undefined" && window.innerWidth < 768) setSidebarOpen(false); }}
                  >
                    <span className="chapter-num">{idx + 1}</span>
                    <span className="chapter-title">{c.title}</span>
                    {completed.has(c.id) && <span className="chapter-check">✓</span>}
                  </button>
                  {isAdmin && (
                    <>
                      <div style={{ position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 1 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); void moveChapter(c.id, "up"); }}
                          disabled={idx === 0}
                          title="Monter"
                          style={{ background: "none", border: "none", color: "rgba(196,160,255,0.5)", fontSize: 9, cursor: idx === 0 ? "default" : "pointer", padding: "1px 3px", lineHeight: 1, opacity: idx === 0 ? 0.2 : 0.6 }}
                        >▲</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); void moveChapter(c.id, "down"); }}
                          disabled={idx === chapters.length - 1}
                          title="Descendre"
                          style={{ background: "none", border: "none", color: "rgba(196,160,255,0.5)", fontSize: 9, cursor: idx === chapters.length - 1 ? "default" : "pointer", padding: "1px 3px", lineHeight: 1, opacity: idx === chapters.length - 1 ? 0.2 : 0.6 }}
                        >▼</button>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); void deleteChapter(c.id); }}
                        title="Supprimer le chapitre"
                        style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 22, height: 22, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, color: "#fca5a5", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0 }}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="player-sidebar-progress">
              <div className="pg-label">{completed.size} / {chapters.length} chapitres — {progressPct}%</div>
              <div className="pg-bar-wrap">
                <div className="pg-bar" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>
      <CertificateModal open={showCertificate} moduleTitle={module?.title || ""} userName={userName} onClose={() => setShowCertificate(false)} />
    </div>
  );
}
