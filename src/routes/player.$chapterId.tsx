import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import "../styles/player.css";

export const Route = createFileRoute("/player/$chapterId")({
  component: PlayerPage,
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

function toEmbedUrl(url: string): string {
  if (!url.trim()) return "";
  if (url.includes("/embed/") || url.includes("player.vimeo.com")) return url;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
}

function PlayerPage() {
  const { chapterId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [module, setModule] = useState<Module | null>(null);
  const [allChapters, setAllChapters] = useState<Chapter[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [validating, setValidating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);

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
    setDataLoading(true);

    (async () => {
      const { data: ch } = await supabase
        .from("chapters")
        .select("*")
        .eq("id", chapterId)
        .maybeSingle();

      if (!ch) {
        navigate({ to: "/" });
        return;
      }
      setChapter(ch as Chapter);

      const [{ data: mod }, { data: chapList }] = await Promise.all([
        supabase.from("modules").select("id, title, section").eq("id", ch.module_id).maybeSingle(),
        supabase.from("chapters").select("*").eq("module_id", ch.module_id).order("position"),
      ]);

      setModule(mod as Module);
      const chapters = (chapList as Chapter[]) || [];
      setAllChapters(chapters);

      if (chapters.length > 0) {
        const ids = chapters.map((c) => c.id);
        const { data: progress } = await supabase
          .from("user_chapter_progress")
          .select("chapter_id")
          .eq("user_id", user.id)
          .in("chapter_id", ids);
        setCompleted(new Set((progress || []).map((p) => p.chapter_id)));
      }

      setDataLoading(false);
    })();
  }, [user, chapterId]);

  const validateChapter = async () => {
    if (!user || !chapter || completed.has(chapter.id) || validating) return;
    setValidating(true);
    await supabase
      .from("user_chapter_progress")
      .insert({ user_id: user.id, chapter_id: chapter.id });
    setCompleted((prev) => new Set([...prev, chapter.id]));
    setValidating(false);
  };

  const currentIdx = allChapters.findIndex((c) => c.id === chapterId);
  const prevChapter = currentIdx > 0 ? allChapters[currentIdx - 1] : null;
  const nextChapter = currentIdx < allChapters.length - 1 ? allChapters[currentIdx + 1] : null;
  const isDone = chapter ? completed.has(chapter.id) : false;
  const progressPct = allChapters.length
    ? Math.round((completed.size / allChapters.length) * 100)
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

  const embedUrl = chapter ? toEmbedUrl(chapter.video_url) : "";

  return (
    <div className="player-root">
      <div className="player-topbar">
        <Link to="/" className="player-back">
          ← Formation
        </Link>
        {module && (
          <div className="player-module-name">{module.title}</div>
        )}
        <button
          className="player-sidebar-toggle"
          onClick={() => setSidebarOpen((v) => !v)}
        >
          ☰ Chapitres
        </button>
      </div>

      <div className="player-layout">
        <div className="player-main">
          <h1 className="player-title" style={{ marginBottom: 12 }}>{chapter?.title}</h1>
          <div className="player-video-wrap">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="player-iframe"
                title={chapter?.title}
              />
            ) : (
              <div className="player-no-video">
                <span>📹</span>
                <p>Vidéo bientôt disponible</p>
              </div>
            )}
          </div>

          <div className="player-info">
            {chapter?.description && (
              <p className="player-desc">{chapter.description}</p>
            )}

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
                    onClick={() =>
                      navigate({
                        to: "/player/$chapterId",
                        params: { chapterId: prevChapter.id },
                      })
                    }
                  >
                    ← Précédent
                  </button>
                )}
                {nextChapter && (
                  <button
                    className="player-nav-btn primary"
                    onClick={() =>
                      navigate({
                        to: "/player/$chapterId",
                        params: { chapterId: nextChapter.id },
                      })
                    }
                  >
                    Suivant →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {sidebarOpen && (
          <div
            className="player-sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <div className={`player-sidebar${sidebarOpen ? " open" : " closed"}`}>
          <div className="player-sidebar-title">Chapitres du module</div>
          <div className="player-chapters-list">
            {allChapters.map((c, idx) => (
              <button
                key={c.id}
                className={[
                  "player-chapter-item",
                  c.id === chapterId ? "active" : "",
                  completed.has(c.id) ? "done" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  navigate({
                    to: "/player/$chapterId",
                    params: { chapterId: c.id },
                  });
                  if (typeof window !== "undefined" && window.innerWidth <= 768) {
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
              {completed.size} / {allChapters.length} chapitres — {progressPct}%
            </div>
            <div className="pg-bar-wrap">
              <div className="pg-bar" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
