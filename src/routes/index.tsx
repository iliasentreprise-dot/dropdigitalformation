import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme-context";
import logo from "@/assets/logo.png";
import "../styles/dropdigital.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DropDigital — Espace formation" },
      { name: "description", content: "Accède à toutes tes formations DropDigital." },
    ],
  }),
  component: HomePage,
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

type Chapter = { id: string; module_id: string };

type TabKey = "modules" | "groupe" | "coaching" | "resultats" | "profil" | "parametres";

const SECTIONS: { key: string; label: string; sub?: string }[] = [
  { key: "mindset", label: "Mindset" },
  { key: "jour1", label: "Jour 1", sub: "Préparation" },
  { key: "jour2", label: "Jour 2", sub: "Création" },
  { key: "jour3", label: "Jour 3", sub: "Conversion" },
  { key: "bonus", label: "Bonus" },
  { key: "ultime", label: "Système Ultime" },
];

const FORMATION_TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "modules", label: "Modules", icon: "📚" },
  { key: "groupe", label: "Groupe Privé", icon: "🏴" },
  { key: "coaching", label: "Coaching", icon: "🎯" },
  { key: "resultats", label: "Résultats", icon: "🏆" },
];

const ACCOUNT_TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "profil", label: "Profil", icon: "👤" },
  { key: "parametres", label: "Paramètres", icon: "⚙️" },
];

function HomePage() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [modules, setModules] = useState<Module[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [activeSection, setActiveSection] = useState("mindset");
  const [tab, setTab] = useState<TabKey>("modules");
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth > 768,
  );
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: mods } = await supabase
        .from("modules")
        .select("*")
        .order("section")
        .order("position");
      setModules(mods ?? []);

      const { data: chs } = await supabase.from("chapters").select("id, module_id");
      setChapters(chs ?? []);

      const { data: prog } = await supabase
        .from("user_chapter_progress")
        .select("chapter_id")
        .eq("user_id", user.id);
      setCompleted(new Set((prog ?? []).map((p) => p.chapter_id)));

      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!role);
    })();
  }, [user]);

  const moduleProgress = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of modules) {
      const mChs = chapters.filter((c) => c.module_id === m.id);
      if (!mChs.length) {
        map.set(m.id, 0);
        continue;
      }
      const done = mChs.filter((c) => completed.has(c.id)).length;
      map.set(m.id, Math.round((done / mChs.length) * 100));
    }
    return map;
  }, [modules, chapters, completed]);

  const globalPct = useMemo(() => {
    if (!chapters.length) return 0;
    return Math.round((completed.size / chapters.length) * 100);
  }, [chapters, completed]);

  const visibleModules = modules.filter((m) => m.section === activeSection);

  if (loading || !user) {
    return <div className="dd-root" style={{ alignItems: "center", justifyContent: "center" }} />;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const handleTabClick = (k: TabKey) => {
    setTab(k);
    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="dd-root">
      <div className="topbar">
        <div className="logo-wrap">
          <button className="menu-toggle" onClick={() => setSidebarOpen((s) => !s)} aria-label="Menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="logo-icon">
            <img src={logo} alt="DropDigital" width={36} height={36} />
          </div>
          <div className="logo-text">
            Drop<span>Digital</span>
          </div>
        </div>
        <div className="topbar-right">
          <div className="price-pill">
            <span className="live-dot" />
            <span className="old-price">997€</span>
            <span className="new-price">297€</span>
            <span className="badge-red">-70%</span>
          </div>
        </div>
      </div>

      <div className="layout">
        <div
          className={`sidebar-backdrop ${sidebarOpen ? "visible" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />
        <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
          <div className="sidebar-section-label">MA FORMATION</div>
          {FORMATION_TABS.map((t) => (
            <div
              key={t.key}
              className={`sidebar-item ${tab === t.key ? "active" : ""}`}
              onClick={() => handleTabClick(t.key)}
            >
              <span className="si-icon">{t.icon}</span>
              <span>{t.label}</span>
            </div>
          ))}

          <div className="sidebar-section-label">COMPTE</div>
          {ACCOUNT_TABS.map((t) => (
            <div
              key={t.key}
              className={`sidebar-item ${tab === t.key ? "active" : ""}`}
              onClick={() => handleTabClick(t.key)}
            >
              <span className="si-icon">{t.icon}</span>
              <span>{t.label}</span>
            </div>
          ))}
          {isAdmin && (
            <Link
              to="/admin"
              className="sidebar-item"
              style={{ textDecoration: "none" }}
            >
              <span className="si-icon">🛠️</span>
              <span>Admin</span>
            </Link>
          )}
          <div className="sidebar-item" onClick={handleSignOut}>
            <span className="si-icon">🚪</span>
            <span>Déconnexion</span>
          </div>
        </aside>

        <main className="main">
          <div className="tab-content">
            {tab === "modules" && (
              <>
                <div className="section-header">
                  <h1>
                    {SECTIONS.find((s) => s.key === activeSection)?.label} —{" "}
                    {SECTIONS.find((s) => s.key === activeSection)?.sub ?? "DropDigital"}
                  </h1>
                  <p>Vendre des produits digitaux sur TikTok en automatique — sans visage, sans audience, sans montage.</p>
                </div>

                <div className="section-pills">
                  {SECTIONS.map((s) => (
                    <button
                      key={s.key}
                      className={`section-pill ${activeSection === s.key ? "active" : ""}`}
                      onClick={() => setActiveSection(s.key)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <div className="progress-global">
                  <span className="pg-label">Progression globale</span>
                  <div className="pg-bar-wrap">
                    <div className="pg-bar" style={{ width: `${globalPct}%` }} />
                  </div>
                  <span className="pg-pct">{globalPct}%</span>
                </div>

                <div className="modules-grid">
                  {visibleModules.map((m, i) => {
                    const pct = moduleProgress.get(m.id) ?? 0;
                    return (
                      <Link
                        key={m.id}
                        to="/module/$moduleId"
                        params={{ moduleId: m.id }}
                        className="module-card"
                        style={{ textDecoration: "none", color: "inherit" }}
                      >
                        <div className="module-thumb">
                          {m.thumbnail_url ? (
                            <img src={m.thumbnail_url} alt={m.title} />
                          ) : (
                            <div style={{ fontSize: 48, opacity: 0.4 }}>🎬</div>
                          )}
                          <div className="play-btn" />
                          {m.badge && (
                            <span
                              style={{
                                position: "absolute",
                                top: 10,
                                left: 10,
                                background: m.badge_color ?? "#7c3aed",
                                color: "#fff",
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: 4,
                              }}
                            >
                              {m.badge}
                            </span>
                          )}
                        </div>
                        <div className="module-info">
                          <div className="module-num">Module {String(i + 1).padStart(2, "0")}</div>
                          <div className="module-title">{m.title}</div>
                          <div className="prog-wrap">
                            <div className="prog-bar-bg">
                              <div className="prog-bar-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="prog-pct">{pct}%</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                  {!visibleModules.length && (
                    <div style={{ gridColumn: "1/-1", color: "#9a7dbd", padding: 40, textAlign: "center" }}>
                      Aucun module dans cette section pour le moment.
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === "groupe" && (
              <div className="tab-placeholder">
                <div className="tab-ph-icon">🏴</div>
                <h1>Groupe Privé</h1>
                <p>Accède à la communauté privée DropDigital. Bientôt disponible ici.</p>
              </div>
            )}

            {tab === "coaching" && (
              <div className="tab-placeholder">
                <div className="tab-ph-icon">🎯</div>
                <h1>Coaching</h1>
                <p>Réserve une session de coaching personnalisée avec l'équipe.</p>
              </div>
            )}

            {tab === "resultats" && (
              <div className="tab-placeholder">
                <div className="tab-ph-icon">🏆</div>
                <h1>Résultats Élèves</h1>
                <p>Les meilleurs résultats de la communauté DropDigital.</p>
              </div>
            )}

            {tab === "profil" && (
              <div className="tab-placeholder">
                <div className="tab-ph-icon">👤</div>
                <h1>Profil</h1>
                <p>{user.email}</p>
              </div>
            )}

            {tab === "parametres" && (
              <div className="tab-placeholder">
                <div className="tab-ph-icon">⚙️</div>
                <h1>Paramètres</h1>
                <p style={{ marginBottom: 20 }}>Personnalise ton expérience.</p>
                <button className="cta-btn" onClick={toggle} style={{ padding: "10px 20px" }}>
                  Thème : {theme === "dark" ? "🌙 Sombre" : "☀️ Clair"} — Changer
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
