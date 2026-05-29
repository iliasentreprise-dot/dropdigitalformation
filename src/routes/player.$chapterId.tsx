import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Component, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import "../styles/player.css";

export const Route = createFileRoute("/player/$chapterId")({
  loader: async ({ params }) => {
    try {
      const { data: ch } = await supabase.from("chapters").select("*").eq("id", params.chapterId).maybeSingle();
      if (!ch) return { chapter: null, module: null, allChapters: [] as Chapter[] };
      const [{ data: mod }, { data: chapList }] = await Promise.all([
        supabase.from("modules").select("id, title, section").eq("id", (ch as Chapter).module_id).maybeSingle(),
        supabase.from("chapters").select("*").eq("module_id", (ch as Chapter).module_id).order("position"),
      ]);
      return { chapter: ch as Chapter, module: mod as Module | null, allChapters: (chapList as Chapter[]) ?? [] };
    } catch {
      return { chapter: null, module: null, allChapters: [] as Chapter[] };
    }
  },
  pendingComponent: () => (
    <div className="player-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", background: "oklch(0.129 0.042 264.695)" }}>
      <div style={{ color: "#9a7dbd", fontSize: 14 }}>Chargement…</div>
    </div>
  ),
  component: PlayerPageWithBoundary,
});

type Chapter = {
  id: string;
  module_id: string;
  title: string;
  description: string;
  video_url: string;
  duration_seconds: number;
  position: number;
};

type Module = {
  id: string;
  title: string;
  section: string;
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

const MAX_VIDEO_SIZE = 500 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

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
          <button onClick={() => window.location.reload()} style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", border: "none", color: "#fff", borderRadius: 10, padding: "10px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PlayerPageWithBoundary() {
  return (
    <VideoErrorBoundary>
      <PlayerPage />
    </VideoErrorBoundary>
  );
}

function PlayerPage() {
  const { chapterId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const loaderData = Route.useLoaderData();

  const [chapter, setChapter] = useState<Chapter | null>(loaderData.chapter);
  const [module, setModule] = useState<Module | null>(loaderData.module);
  const [allChapters, setAllChapters] = useState<Chapter[]>(loaderData.allChapters);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [validating, setValidating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dataLoading, setDataLoading] = useState(!loaderData.chapter);
  const [isAdmin, setIsAdmin] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(-1);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
  const videoUploadRef = useRef<HTMLInputElement>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState("");
  const [videoPlayError, setVideoPlayError] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    const syncSidebar = () => setSidebarOpen(window.innerWidth > 768);
    syncSidebar();
    window.addEventListener("resize", syncSidebar);
    return () => window.removeEventListener("resize", syncSidebar);
  }, []);

  useEffect(() => {
    if (!user || !chapterId) return;
    (async () => {
      try {
        let currentChapter = chapter;
        let currentAllChapters = allChapters;

        if (!currentChapter) {
          setDataLoading(true);
          const { data: ch } = await supabase.from("chapters").select("*").eq("id", chapterId).maybeSingle();
          if (!ch) { navigate({ to: "/" }); return; }
          currentChapter = ch as Chapter;
          setChapter(currentChapter);

          const [{ data: mod }, { data: chapList }] = await Promise.all([
            supabase.from("modules").select("id, title, section").eq("id", currentChapter.module_id).maybeSingle(),
            supabase.from("chapters").select("*").eq("module_id", currentChapter.module_id).order("position"),
          ]);
          setModule(mod as Module);
          currentAllChapters = (chapList as Chapter[]) || [];
          setAllChapters(currentAllChapters);
        }

        const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
        const rolePriority: Record<string, number> = { admin: 3, moderator: 2, user: 1 };
        const topRole = (roleRows ?? []).reduce<string>((best, r: { role: string }) => (rolePriority[r.role] ?? 0) > (rolePriority[best] ?? 0) ? r.role : best, "user");
        setIsAdmin(topRole === "admin" || topRole === "moderator");

        if (currentAllChapters.length > 0) {
          const ids = currentAllChapters.map((c) => c.id);
          const { data: progress } = await supabase.from("user_chapter_progress").select("chapter_id").eq("user_id", user.id).in("chapter_id", ids);
          setCompleted(new Set((progress || []).map((p) => p.chapter_id)));
        }
      } catch { /* ignore load errors */ }
      setDataLoading(false);
    })();
  }, [user, chapterId]);

  const deleteChapterVideo = async () => {
    if (!chapter || !confirm("Supprimer la vidéo de ce chapitre ? Cette action est irréversible.")) return;
    try {
      await supabase.from("chapters").update({ video_url: "" }).eq("id", chapter.id);
      setChapter((c) => c ? { ...c, video_url: "" } : c);
      setVideoPlayError(false);
    } catch { /* ignore */ }
  };

  const uploadVideoForChapter = async (file: File) => {
    if (!chapter || videoUploading) return;
    if (file.size > MAX_VIDEO_SIZE) {
      setVideoUploadError(`Fichier trop lourd : ${(file.size / 1024 / 1024).toFixed(0)} MB (max 500 MB)`);
      return;
    }
    if (!file.type.startsWith("video/")) {
      setVideoUploadError(`Format non supporté : ${file.type || "inconnu"} — utilisez MP4, WebM ou MOV`);
      return;
    }
    setVideoUploading(true);
    setVideoUploadError(null);
    setVideoUploadProgress(0);
    setVideoPlayError(false);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${chapter.module_id}/${chapter.id}/${Date.now()}.${ext}`;
      const publicUrl = await uploadWithProgress(file, path, "course-videos", setVideoUploadProgress, controller.signal);
      await supabase.from("chapters").update({ video_url: publicUrl }).eq("id", chapter.id);
      setChapter((c) => c ? { ...c, video_url: publicUrl } : c);
    } catch (e) {
      setVideoUploadError(e instanceof Error ? e.message : "Erreur inconnue pendant l'upload");
    } finally {
      window.clearTimeout(timer);
      setVideoUploading(false);
      setVideoUploadProgress(-1);
    }
  };

  const saveUrl = async (url: string) => {
    if (!chapter || !url.trim()) return;
    try {
      await supabase.from("chapters").update({ video_url: url.trim() }).eq("id", chapter.id);
      setChapter((c) => c ? { ...c, video_url: url.trim() } : c);
      setShowUrlInput(false);
      setUrlInputValue("");
      setVideoPlayError(false);
    } catch { /* ignore */ }
  };

  const validateChapter = async () => {
    if (!user || !chapter || completed.has(chapter.id) || validating) return;
    setValidating(true);
    try {
      await supabase.from("user_chapter_progress").insert({ user_id: user.id, chapter_id: chapter.id });
      setCompleted((prev) => new Set([...prev, chapter.id]));
    } catch { /* ignore */ }
    setValidating(false);
  };

  const currentIdx = allChapters.findIndex((c) => c.id === chapterId);
  const prevChapter = currentIdx > 0 ? allChapters[currentIdx - 1] : null;
  const nextChapter = currentIdx < allChapters.length - 1 ? allChapters[currentIdx + 1] : null;
  const isDone = chapter ? completed.has(chapter.id) : false;
  const progressPct = allChapters.length ? Math.round((completed.size / allChapters.length) * 100) : 0;

  if (loading || !user || dataLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e0418", color: "#c4a3f0", fontFamily: "-apple-system, sans-serif" }}>
        Chargement…
      </div>
    );
  }

  const embedUrl = chapter ? toEmbedUrl(chapter.video_url) : "";
  const direct = embedUrl ? isDirectVideo(embedUrl) : false;

  return (
    <div className="player-root">
      <div className="player-topbar">
        <Link to="/" className="player-back">← Formation</Link>
        {module && <div className="player-module-name">{module.title}</div>}
        <button className="player-sidebar-toggle" onClick={() => setSidebarOpen((v) => !v)}>☰ Chapitres</button>
      </div>

      <div className="player-layout">
        <div className="player-main">
          <div className="player-title-row" style={{ marginBottom: 12 }}>
            <h1 className="player-title" style={{ margin: 0 }}>{chapter?.title}</h1>
            {isAdmin && chapter?.video_url && (
              <button className="player-edit-ghost" onClick={() => void deleteChapterVideo()} style={{ color: "#fca5a5", borderColor: "rgba(239,68,68,0.3)" }} title="Supprimer la vidéo">🗑 Vidéo</button>
            )}
          </div>

          <div className="player-video-wrap">
            {embedUrl ? (
              direct ? (
                videoPlayError ? (
                  <div className="player-no-video">
                    <span>⚠️</span>
                    <p>La vidéo n'a pas pu se charger sur cet appareil.</p>
                    <a href={embedUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#a855f7", fontSize: 13 }}>Ouvrir la vidéo directement →</a>
                    {isAdmin && (
                      <button onClick={() => { setVideoPlayError(false); setShowUrlInput(true); }} style={{ marginTop: 8, background: "none", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 8, color: "#c4a3f0", padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>
                        Changer l'URL
                      </button>
                    )}
                  </div>
                ) : (
                  <video
                    key={embedUrl}
                    src={embedUrl}
                    controls
                    className="player-iframe"
                    onError={() => setVideoPlayError(true)}
                  />
                )
              ) : (
                <iframe
                  src={embedUrl}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="player-iframe"
                  title={chapter?.title}
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
                          onKeyDown={(e) => { if (e.key === "Enter") void saveUrl(urlInputValue); if (e.key === "Escape") { setShowUrlInput(false); setUrlInputValue(""); } }}
                        />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => void saveUrl(urlInputValue)} disabled={!urlInputValue.trim()} style={{ flex: 1, padding: "8px 0", background: "linear-gradient(135deg,#7c3aed,#a855f7)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: urlInputValue.trim() ? 1 : 0.5 }}>
                            Utiliser cette URL
                          </button>
                          <button onClick={() => { setShowUrlInput(false); setUrlInputValue(""); }} style={{ padding: "8px 12px", background: "none", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 8, color: "#9a7dbd", fontSize: 13, cursor: "pointer" }}>✕</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <button onClick={() => videoUploadRef.current?.click()} style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", border: "none", color: "#fff", borderRadius: 10, padding: "10px 22px", fontWeight: 700, fontSize: 14, cursor: "pointer", marginTop: 4 }}>
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
          </div>

          <div className="player-info">
            {chapter?.description && <p className="player-desc">{chapter.description}</p>}
            <div className="player-actions">
              <button className={`player-validate${isDone ? " done" : ""}`} onClick={validateChapter} disabled={validating || isDone}>
                {isDone ? "✓ Chapitre validé" : validating ? "Validation…" : "✓ Valider ce chapitre"}
              </button>
              <div className="player-nav">
                {prevChapter && (
                  <button className="player-nav-btn" onClick={() => navigate({ to: "/player/$chapterId", params: { chapterId: prevChapter.id } })}>
                    ← Précédent
                  </button>
                )}
                {nextChapter && (
                  <button className="player-nav-btn primary" onClick={() => navigate({ to: "/player/$chapterId", params: { chapterId: nextChapter.id } })}>
                    Suivant →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {sidebarOpen && <div className="player-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
        <div className={`player-sidebar${sidebarOpen ? " open" : " closed"}`}>
          <div className="player-sidebar-title">Chapitres du module</div>
          <div className="player-chapters-list">
            {allChapters.map((c, idx) => (
              <button
                key={c.id}
                className={["player-chapter-item", c.id === chapterId ? "active" : "", completed.has(c.id) ? "done" : ""].filter(Boolean).join(" ")}
                onClick={() => { navigate({ to: "/player/$chapterId", params: { chapterId: c.id } }); if (typeof window !== "undefined" && window.innerWidth <= 768) setSidebarOpen(false); }}
              >
                <span className="chapter-num">{idx + 1}</span>
                <span className="chapter-title">{c.title}</span>
                {completed.has(c.id) && <span className="chapter-check">✓</span>}
              </button>
            ))}
          </div>
          <div className="player-sidebar-progress">
            <div className="pg-label">{completed.size} / {allChapters.length} chapitres — {progressPct}%</div>
            <div className="pg-bar-wrap">
              <div className="pg-bar" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
