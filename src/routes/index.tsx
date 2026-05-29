import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme-context";
import logo from "@/assets/logo.png";
import { GroupChat } from "@/components/dd/GroupChat";
import { ResultsWall } from "@/components/dd/ResultsWall";
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

type UserProfile = {
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  has_software_access: boolean;
};

type TabKey = "modules" | "groupe" | "coaching" | "resultats" | "profil" | "parametres";

const SECTIONS: { key: string; label: string; sub?: string }[] = [
  { key: "mindset", label: "Mindset" },
  { key: "jour1", label: "Jour 1", sub: "Préparation" },
  { key: "jour2", label: "Jour 2", sub: "Création" },
  { key: "jour3", label: "Jour 3", sub: "Conversion" },
  { key: "bonus", label: "Bonus" },
  { key: "ultime", label: "Logiciel d'automatisation TikTok" },
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
  const [completedAt, setCompletedAt] = useState<Map<string, Date>>(new Map());
  const [activeSection, setActiveSection] = useState("mindset");
  const [tab, setTab] = useState<TabKey>("modules");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState("user");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hasSoftwareAccess, setHasSoftwareAccess] = useState(false);

  // Profile editing
  const [editingField, setEditingField] = useState<null | "username" | "bio">(null);
  const [editValue, setEditValue] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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
    if (!user) return;
    (async () => {
      const [
        { data: mods },
        { data: chs },
        { data: prog },
        { data: roleRows },
        { data: profileData },
      ] = await Promise.all([
        supabase.from("modules").select("*").order("section").order("position"),
        supabase.from("chapters").select("id, module_id"),
        supabase.from("user_chapter_progress").select("chapter_id, completed_at").eq("user_id", user.id),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("username, full_name, avatar_url, bio, has_software_access").eq("id", user.id).maybeSingle(),
      ]);

      setModules(mods ?? []);
      setChapters(chs ?? []);
      setCompleted(new Set((prog ?? []).map((p) => p.chapter_id)));
      setCompletedAt(new Map((prog ?? []).map((p) => [p.chapter_id, new Date(p.completed_at)])));

      const rolePriority: Record<string, number> = { admin: 3, moderator: 2, user: 1 };
      const topRole = (roleRows ?? []).reduce<string>((best, r) => {
        return (rolePriority[r.role] ?? 0) > (rolePriority[best] ?? 0) ? r.role : best;
      }, "user");
      setUserRole(topRole);
      setIsAdmin(topRole === "admin");

      const pd = profileData as UserProfile | null;
      setProfile(pd);
      setHasSoftwareAccess(pd?.has_software_access ?? false);
    })();
  }, [user]);

  const moduleProgress = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of modules) {
      const mChs = chapters.filter((c) => c.module_id === m.id);
      if (!mChs.length) { map.set(m.id, 0); continue; }
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

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dripUnlock = useMemo(() => {
    const jour1ModIds = new Set(modules.filter((m) => m.section === "jour1").map((m) => m.id));
    const jour2ModIds = new Set(modules.filter((m) => m.section === "jour2").map((m) => m.id));
    const jour1Chs = chapters.filter((c) => jour1ModIds.has(c.module_id));
    const jour2Chs = chapters.filter((c) => jour2ModIds.has(c.module_id));
    const allJour1Done = jour1Chs.length > 0 && jour1Chs.every((c) => completed.has(c.id));
    const allJour2Done = jour2Chs.length > 0 && jour2Chs.every((c) => completed.has(c.id));
    let jour2UnlocksAt: Date | null = null;
    let jour3UnlocksAt: Date | null = null;
    if (allJour1Done) {
      const maxAt = Math.max(...jour1Chs.map((c) => completedAt.get(c.id)?.getTime() ?? 0));
      jour2UnlocksAt = new Date(maxAt + 24 * 60 * 60 * 1000);
    }
    if (allJour2Done) {
      const maxAt = Math.max(...jour2Chs.map((c) => completedAt.get(c.id)?.getTime() ?? 0));
      jour3UnlocksAt = new Date(maxAt + 24 * 60 * 60 * 1000);
    }
    return { jour2UnlocksAt, jour3UnlocksAt };
  }, [modules, chapters, completed, completedAt]);

  if (loading || !user) {
    return <div className="dd-root" style={{ alignItems: "center", justifyContent: "center" }} />;
  }

  const formatCountdown = (unlockAt: Date): string => {
    const diff = unlockAt.getTime() - now.getTime();
    if (diff <= 0) return "";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h}h ${String(m).padStart(2, "0")}min ${String(s).padStart(2, "0")}s`;
  };

  const getSectionLock = (section: string): { locked: boolean; message: string } => {
    if (section === "jour2") {
      const { jour2UnlocksAt } = dripUnlock;
      if (!jour2UnlocksAt) return { locked: true, message: "Termine tous les chapitres du Jour 1 pour débloquer le Jour 2." };
      if (jour2UnlocksAt > now) return { locked: true, message: `Disponible dans ${formatCountdown(jour2UnlocksAt)}` };
    }
    if (section === "jour3") {
      const { jour3UnlocksAt } = dripUnlock;
      if (!jour3UnlocksAt) return { locked: true, message: "Termine tous les chapitres du Jour 2 pour débloquer le Jour 3." };
      if (jour3UnlocksAt > now) return { locked: true, message: `Disponible dans ${formatCountdown(jour3UnlocksAt)}` };
    }
    return { locked: false, message: "" };
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const handleTabClick = (k: TabKey) => {
    setTab(k);
    if (typeof window !== "undefined" && window.innerWidth <= 768) setSidebarOpen(false);
  };

  const saveProfileField = async (field: "username" | "bio", value: string) => {
    if (!user) return;
    setProfileSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("profiles").update({ [field]: value.trim() || null }).eq("id", user.id);
    setProfile((prev) => (prev ? { ...prev, [field]: value.trim() || null } : null));
    setEditingField(null);
    setProfileSaving(false);
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setAvatarUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
      setProfile((prev) => (prev ? { ...prev, avatar_url: data.publicUrl } : null));
    }
    setAvatarUploading(false);
  };

  const displayName = profile?.full_name || profile?.username || user.email?.split("@")[0] || "Élève";

  const ModulesGrid = ({ mods }: { mods: Module[] }) => (
    <div className="modules-grid">
      {mods.map((m, i) => {
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
                <span style={{ position: "absolute", top: 10, left: 10, background: m.badge_color ?? "#7c3aed", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 4 }}>
                  {m.badge}
                </span>
              )}
            </div>
            <div className="module-info">
              <div className="module-num">Module {String(i + 1).padStart(2, "0")}</div>
              <div className="module-title">{m.title}</div>
              <div className="prog-wrap">
                <div className="prog-bar-bg"><div className="prog-bar-fill" style={{ width: `${pct}%` }} /></div>
                <span className="prog-pct">{pct}%</span>
              </div>
            </div>
          </Link>
        );
      })}
      {!mods.length && (
        <div style={{ gridColumn: "1/-1", color: "#9a7dbd", padding: 40, textAlign: "center" }}>
          Aucun module dans cette section pour le moment.
        </div>
      )}
    </div>
  );

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
          <div className="logo-icon"><img src={logo} alt="DropDigital" width={36} height={36} /></div>
          <div className="logo-text">Drop<span>Digital</span></div>
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
        <div className={`sidebar-backdrop ${sidebarOpen ? "visible" : ""}`} onClick={() => setSidebarOpen(false)} />
        <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
          <div className="sidebar-section-label">MA FORMATION</div>
          {FORMATION_TABS.map((t) => (
            <div key={t.key} className={`sidebar-item ${tab === t.key ? "active" : ""}`} onClick={() => handleTabClick(t.key)}>
              <span className="si-icon">{t.icon}</span>
              <span>{t.label}</span>
            </div>
          ))}
          <div className="sidebar-section-label">COMPTE</div>
          {ACCOUNT_TABS.map((t) => (
            <div key={t.key} className={`sidebar-item ${tab === t.key ? "active" : ""}`} onClick={() => handleTabClick(t.key)}>
              <span className="si-icon">{t.icon}</span>
              <span>{t.label}</span>
            </div>
          ))}
          {isAdmin && (
            <Link to="/admin" className="sidebar-item" style={{ textDecoration: "none" }}>
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

            {/* ── MODULES ── */}
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
                  {SECTIONS.map((s) => {
                    const isLocked = getSectionLock(s.key).locked;
                    const isGold = s.key === "ultime";
                    return (
                      <button
                        key={s.key}
                        className={`section-pill ${activeSection === s.key ? "active" : ""} ${isGold ? "section-pill-gold" : ""}`}
                        onClick={() => setActiveSection(s.key)}
                      >
                        {isLocked && <span style={{ marginRight: 4, fontSize: 12 }}>🔒</span>}
                        {s.label}
                      </button>
                    );
                  })}
                </div>

                <div className="progress-global">
                  <span className="pg-label">Progression globale</span>
                  <div className="pg-bar-wrap">
                    <div className="pg-bar" style={{ width: `${globalPct}%` }} />
                  </div>
                  <span className="pg-pct">{globalPct}%</span>
                </div>

                {(() => {
                  const lock = getSectionLock(activeSection);
                  if (lock.locked) {
                    return (
                      <div style={{ textAlign: "center", padding: "60px 20px" }}>
                        <div style={{ fontSize: 64, marginBottom: 20 }}>🔒</div>
                        <p style={{ color: "#c4a3f0", fontSize: 18, fontWeight: 600, lineHeight: 1.7, margin: 0 }}>{lock.message}</p>
                      </div>
                    );
                  }

                  if (activeSection === "ultime") {
                    if (!hasSoftwareAccess) {
                      return (
                        <div style={{ position: "relative", minHeight: 320 }}>
                          <div className="modules-grid" style={{ filter: "blur(5px)", pointerEvents: "none", userSelect: "none", opacity: 0.5 }}>
                            {visibleModules.map((m, i) => (
                              <div key={m.id} className="module-card">
                                <div className="module-thumb">
                                  {m.thumbnail_url ? <img src={m.thumbnail_url} alt={m.title} /> : <div style={{ fontSize: 48, opacity: 0.4 }}>🎬</div>}
                                  <div className="play-btn" />
                                </div>
                                <div className="module-info">
                                  <div className="module-num">Module {String(i + 1).padStart(2, "0")}</div>
                                  <div className="module-title">{m.title}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="software-lock-overlay">
                            <div style={{ fontSize: 52, marginBottom: 16 }}>🔒</div>
                            <p style={{ color: "#e2d4f8", fontSize: 15, lineHeight: 1.7, marginBottom: 28, textAlign: "center", maxWidth: 400 }}>
                              Tu n'as pas accès au logiciel d'automatisation car tu as pris l'offre Formation à 97€
                            </p>
                            <a
                              href="https://revolut.me/ilias_business?currency=EUR&amount=4700&note=Logiciel%20d%27automatisation%20TikTok"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="software-cta-btn"
                            >
                              ⚡ Accéder à l'ensemble des logiciels pour automatiser ton système
                            </a>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div>
                        <div className="software-coming-soon">
                          <span className="hourglass-spin">⏳</span>
                          <span>Tu auras accès aux logiciels d'automatisation bientôt…</span>
                        </div>
                        <ModulesGrid mods={visibleModules} />
                      </div>
                    );
                  }

                  return <ModulesGrid mods={visibleModules} />;
                })()}
              </>
            )}

            {/* ── GROUPE PRIVÉ ── */}
            {tab === "groupe" && (
              <div>
                <div className="section-header">
                  <h1>🏴 Groupe Privé</h1>
                  <p>La communauté privée DropDigital — échanges, questions, victoires.</p>
                </div>
                <GroupChat
                  userId={user.id}
                  username={profile?.username ?? null}
                  avatarUrl={profile?.avatar_url ?? null}
                  isAdmin={isAdmin}
                />
              </div>
            )}

            {/* ── COACHING ── */}
            {tab === "coaching" && (
              <div>
                <div className="section-header">
                  <h1>🎯 Coaching</h1>
                  <p>Rejoins les sessions live et accède aux replays.</p>
                </div>
                <div className="coaching-cards">
                  <div className="coaching-card">
                    <div className="coaching-card-icon">📡</div>
                    <div className="coaching-card-info">
                      <div className="coaching-card-label">Live de groupe</div>
                      <div className="coaching-card-day">Mardi 20h</div>
                      <div className="coaching-card-desc">Session live hebdomadaire — Q&A, analyse de compte, feedback en direct.</div>
                    </div>
                    <a href="#" className="coaching-join-btn">Rejoindre le live</a>
                  </div>
                  <div className="coaching-card">
                    <div className="coaching-card-icon">📡</div>
                    <div className="coaching-card-info">
                      <div className="coaching-card-label">Live de groupe</div>
                      <div className="coaching-card-day">Jeudi 20h</div>
                      <div className="coaching-card-desc">Session live hebdomadaire — Q&A, analyse de compte, feedback en direct.</div>
                    </div>
                    <a href="#" className="coaching-join-btn">Rejoindre le live</a>
                  </div>
                </div>
                <div className="coaching-replays">
                  <h2>📼 Replays</h2>
                  <p style={{ color: "#9a7dbd", fontSize: 14, margin: 0 }}>Aucun replay disponible pour l'instant.</p>
                </div>
              </div>
            )}

            {/* ── RÉSULTATS ── */}
            {tab === "resultats" && (
              <div>
                <div className="section-header">
                  <h1>🏆 Résultats Élèves</h1>
                  <p>Partage tes victoires et inspire la communauté.</p>
                </div>
                <ResultsWall
                  userId={user.id}
                  username={profile?.username ?? null}
                  avatarUrl={profile?.avatar_url ?? null}
                />
              </div>
            )}

            {/* ── PROFIL ── */}
            {tab === "profil" && (
              <div style={{ maxWidth: 480, margin: "0 auto" }}>
                <div className="section-header"><h1>👤 Mon Profil</h1></div>

                {/* Avatar */}
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                  <div className="profile-avatar-wrap" onClick={() => avatarInputRef.current?.click()} title="Changer la photo">
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                      : <span style={{ fontSize: 36, color: "#c4a3f0" }}>{displayName[0]?.toUpperCase()}</span>
                    }
                    <div className="profile-avatar-overlay">{avatarUploading ? "…" : "📷"}</div>
                  </div>
                  <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAvatar(f); }} />
                  <div style={{ marginTop: 8, fontSize: 12, color: "#7c5c9a" }}>Clique pour changer la photo</div>
                </div>

                {/* Role badge */}
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  {userRole === "admin" && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #b45309, #f59e0b, #fbbf24)", color: "#1a0800", fontWeight: 800, fontSize: 14, padding: "6px 16px", borderRadius: 8, animation: "adminGlow 2s ease-in-out infinite" }}>✨ Admin</span>
                  )}
                  {userRole === "moderator" && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#7f1d1d", color: "#fca5a5", fontWeight: 800, fontSize: 14, padding: "6px 16px", borderRadius: 8, border: "1px solid #ef4444", animation: "modGlow 2s ease-in-out infinite" }}>🔴 Modérateur</span>
                  )}
                  {userRole === "user" && (
                    <span style={{ display: "inline-flex", alignItems: "center", background: "rgba(55,65,81,0.6)", color: "#9ca3af", fontWeight: 600, fontSize: 14, padding: "6px 16px", borderRadius: 8 }}>Élève</span>
                  )}
                </div>

                {/* Email */}
                <div className="profile-field-row">
                  <div className="profile-field-label">Email</div>
                  <div className="profile-field-value">{user.email}</div>
                </div>

                {/* Username */}
                <div className="profile-field-row">
                  <div className="profile-field-label">Pseudo</div>
                  {editingField === "username" ? (
                    <div style={{ display: "flex", gap: 8, flex: 1 }}>
                      <input className="profile-edit-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="ton_pseudo" autoFocus />
                      <button className="admin-btn-primary sm" onClick={() => void saveProfileField("username", editValue)} disabled={profileSaving}>{profileSaving ? "…" : "✓"}</button>
                      <button className="admin-btn-ghost sm" onClick={() => setEditingField(null)}>✕</button>
                    </div>
                  ) : (
                    <>
                      <div className="profile-field-value">{profile?.username || <span style={{ color: "#7c5c9a", fontStyle: "italic" }}>Non défini</span>}</div>
                      <button className="admin-btn-ghost sm" onClick={() => { setEditingField("username"); setEditValue(profile?.username || ""); }}>Modifier</button>
                    </>
                  )}
                </div>

                {/* Bio */}
                <div className="profile-field-row" style={{ alignItems: editingField === "bio" ? "flex-start" : "center" }}>
                  <div className="profile-field-label">Bio</div>
                  {editingField === "bio" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                      <textarea className="profile-edit-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="Dis quelque chose sur toi…" rows={3} autoFocus style={{ resize: "vertical" }} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="admin-btn-primary sm" onClick={() => void saveProfileField("bio", editValue)} disabled={profileSaving}>{profileSaving ? "…" : "✓ Sauvegarder"}</button>
                        <button className="admin-btn-ghost sm" onClick={() => setEditingField(null)}>Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="profile-field-value" style={{ flex: 1 }}>{profile?.bio || <span style={{ color: "#7c5c9a", fontStyle: "italic" }}>Non défini</span>}</div>
                      <button className="admin-btn-ghost sm" onClick={() => { setEditingField("bio"); setEditValue(profile?.bio || ""); }}>Modifier</button>
                    </>
                  )}
                </div>

                {/* Progress */}
                <div className="profile-field-row" style={{ flexDirection: "column", gap: 10, alignItems: "stretch" }}>
                  <div className="profile-field-label">Progression globale</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, height: 10, background: "rgba(168,85,247,0.12)", borderRadius: 6, overflow: "hidden" }}>
                      {isAdmin
                        ? <div className="fire-progress" style={{ borderRadius: 6 }} />
                        : <div style={{ height: "100%", width: `${globalPct}%`, background: "linear-gradient(90deg, #7c3aed, #a855f7)", borderRadius: 6, transition: "width 0.4s" }} />
                      }
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#9a7dbd" }}>{isAdmin ? 100 : globalPct}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── PARAMÈTRES ── */}
            {tab === "parametres" && (
              <div style={{ maxWidth: 420, margin: "0 auto" }}>
                <div className="section-header"><h1>⚙️ Paramètres</h1></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    className="admin-btn-ghost"
                    onClick={toggle}
                    style={{ textAlign: "left", padding: "14px 18px", fontSize: 14, display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <span>{theme === "dark" ? "🌙" : "☀️"}</span>
                    <span>Thème : <strong>{theme === "dark" ? "Sombre" : "Clair"}</strong> — Changer</span>
                  </button>
                  <button
                    className="admin-btn-ghost"
                    onClick={() => navigate({ to: "/forgot-password" })}
                    style={{ textAlign: "left", padding: "14px 18px", fontSize: 14, display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <span>🔐</span>
                    <span>Changer mon mot de passe</span>
                  </button>
                  <button
                    className="admin-btn-danger"
                    onClick={handleSignOut}
                    style={{ textAlign: "left", padding: "14px 18px", fontSize: 14, display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <span>🚪</span>
                    <span>Se déconnecter</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
