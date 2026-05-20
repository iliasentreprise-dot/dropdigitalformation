import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import "../styles/admin.css";

// ── Server functions ──

const getStudentFn = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const { userId } = (data as unknown) as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sa = supabaseAdmin as any;

    const [
      authResult,
      { data: profile },
      { data: roles },
      { data: messages },
    ] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(userId),
      sa.from("profiles").select("username, full_name, avatar_url, bio, admin_notes, has_software_access").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
      sa.from("group_messages").select("id, content, created_at, visible").eq("user_id", userId).order("created_at", { ascending: true }),
    ]);

    const rolePriority: Record<string, number> = { admin: 3, moderator: 2, user: 1 };
    const topRole = ((roles ?? []) as { role: string }[]).reduce<string>((best, r) => {
      return (rolePriority[r.role] ?? 0) > (rolePriority[best] ?? 0) ? r.role : best;
    }, "user");

    return {
      email: authResult.data.user?.email ?? "",
      profile: (profile as {
        username: string | null;
        full_name: string | null;
        avatar_url: string | null;
        bio: string | null;
        admin_notes: string | null;
        has_software_access: boolean;
      } | null),
      role: topRole,
      messages: ((messages ?? []) as { id: string; content: string; created_at: string; visible: boolean }[]),
    };
  });

const saveNotesFn = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const { userId, notes } = (data as unknown) as { userId: string; notes: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from("profiles")
      .update({ admin_notes: notes || null })
      .eq("id", userId);
    if (error) throw new Error((error as { message: string }).message);
    return { success: true };
  });

const setRoleFn = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const { userId, role } = (data as unknown) as { userId: string; role: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sa = supabaseAdmin as any;

    if (role === "moderator") {
      const { error } = await sa
        .from("user_roles")
        .upsert({ user_id: userId, role: "moderator" }, { onConflict: "user_id,role", ignoreDuplicates: true });
      if (error) throw new Error((error as { message: string }).message);
    } else {
      const { error } = await sa
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "moderator");
      if (error) throw new Error((error as { message: string }).message);
    }
    return { success: true };
  });

// ── Route ──

export const Route = createFileRoute("/admin/student/$userId")({
  component: StudentProfilePage,
});

type StudentData = {
  email: string;
  profile: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    admin_notes: string | null;
    has_software_access: boolean;
  } | null;
  role: string;
  messages: { id: string; content: string; created_at: string; visible: boolean }[];
};

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "linear-gradient(135deg,#b45309,#f59e0b,#fbbf24)", color: "#1a0800", fontWeight: 800, fontSize: 12, padding: "4px 12px", borderRadius: 8, animation: "adminGlow 2s ease-in-out infinite" }}>
        ✨ Admin
      </span>
    );
  }
  if (role === "moderator") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#7f1d1d", color: "#fca5a5", fontWeight: 800, fontSize: 12, padding: "4px 12px", borderRadius: 8, border: "1px solid #ef4444", animation: "modGlow 2s ease-in-out infinite" }}>
        🔴 Modérateur
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", background: "rgba(55,65,81,0.6)", color: "#9ca3af", fontWeight: 600, fontSize: 12, padding: "4px 12px", borderRadius: 8 }}>
      Élève
    </span>
  );
}

function StudentProfilePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { userId } = Route.useParams();

  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesMsg, setNotesMsg] = useState<string | null>(null);
  const [roleChanging, setRoleChanging] = useState(false);
  const [roleMsg, setRoleMsg] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState("user");

  useEffect(() => {
    if (!loading && !user) { navigate({ to: "/login" }); return; }
    if (!user) return;

    (async () => {
      const { data: adminCheck } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!adminCheck) { navigate({ to: "/" }); return; }

      try {
        const result = await (getStudentFn as unknown as (args: { data: { userId: string } }) => Promise<StudentData>)({ data: { userId } });
        setStudentData(result);
        setCurrentRole(result.role);
        setNotes(result.profile?.admin_notes ?? "");
      } catch (e) {
        console.error(e);
      }
      setDataLoading(false);
    })();
  }, [user, loading, userId]);

  const handleSaveNotes = async () => {
    setNotesSaving(true);
    setNotesMsg(null);
    try {
      await (saveNotesFn as unknown as (args: { data: { userId: string; notes: string } }) => Promise<void>)({ data: { userId, notes } });
      setNotesMsg("Notes sauvegardées ✓");
      setTimeout(() => setNotesMsg(null), 2500);
    } catch (e) {
      setNotesMsg((e as Error).message);
    }
    setNotesSaving(false);
  };

  const handleRoleToggle = async () => {
    const newRole = currentRole === "moderator" ? "user" : "moderator";
    setRoleChanging(true);
    setRoleMsg(null);
    try {
      await (setRoleFn as unknown as (args: { data: { userId: string; role: string } }) => Promise<void>)({ data: { userId, role: newRole } });
      setCurrentRole(newRole);
      setRoleMsg(newRole === "moderator" ? "Promu modérateur ✓" : "Rétrogradé élève ✓");
      setTimeout(() => setRoleMsg(null), 2500);
    } catch (e) {
      setRoleMsg((e as Error).message);
    }
    setRoleChanging(false);
  };

  if (loading || dataLoading) {
    return <div className="admin-loading">Chargement…</div>;
  }

  if (!studentData) {
    return (
      <div className="admin-root">
        <div className="admin-topbar">
          <Link to="/admin" className="admin-back">← Admin</Link>
          <h1 className="admin-title">Profil élève</h1>
        </div>
        <div className="admin-body">
          <div className="admin-empty">Élève introuvable.</div>
        </div>
      </div>
    );
  }

  const { profile, email, messages } = studentData;
  const displayName = profile?.full_name || profile?.username || email.split("@")[0];
  const isAdminStudent = currentRole === "admin";

  return (
    <div className="admin-root">
      <div className="admin-topbar">
        <Link to="/admin" className="admin-back">← Admin</Link>
        <h1 className="admin-title">👤 Profil élève</h1>
      </div>

      <div className="admin-body" style={{ maxWidth: 700, margin: "0 auto" }}>

        {/* ── Section haut : identité ── */}
        <div style={{ background: "rgba(25,10,48,0.7)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 16, padding: "28px 24px", marginBottom: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
          <div style={{ width: 100, height: 100, borderRadius: "50%", background: "rgba(124,58,237,0.2)", border: "3px solid rgba(168,85,247,0.4)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 40, color: "#c4a3f0" }}>{displayName[0]?.toUpperCase()}</span>
            }
          </div>

          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#f0e8ff", marginBottom: 4 }}>{displayName}</div>
            {profile?.username && profile.full_name && (
              <div style={{ fontSize: 13, color: "#9a7dbd", marginBottom: 4 }}>@{profile.username}</div>
            )}
            <div style={{ fontSize: 13, color: "#7c5c9a", marginBottom: 10 }}>{email}</div>
            <RoleBadge role={currentRole} />
          </div>

          {!isAdminStudent && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <button
                className={currentRole === "moderator" ? "admin-btn-danger" : "admin-btn-primary"}
                onClick={() => void handleRoleToggle()}
                disabled={roleChanging}
                style={{ minWidth: 200 }}
              >
                {roleChanging ? "…" : currentRole === "moderator" ? "↩ Rétrograder élève" : "⬆ Promouvoir modérateur"}
              </button>
              {roleMsg && <div style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>{roleMsg}</div>}
            </div>
          )}
        </div>

        {/* ── Section milieu : notes admin ── */}
        <div style={{ background: "rgba(25,10,48,0.7)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 16, padding: "22px 24px", marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#c4a3f0", marginBottom: 14 }}>📝 Notes internes (visibles admin uniquement)</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Ajouter des notes sur cet élève…"
            style={{ width: "100%", background: "rgba(15,9,32,0.8)", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 8, padding: "10px 12px", color: "#f0e8ff", fontSize: 14, resize: "vertical", fontFamily: "inherit" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <button
              className="admin-btn-primary"
              onClick={() => void handleSaveNotes()}
              disabled={notesSaving}
            >
              {notesSaving ? "…" : "Sauvegarder"}
            </button>
            {notesMsg && <span style={{ fontSize: 13, color: "#10b981", fontWeight: 600 }}>{notesMsg}</span>}
          </div>
        </div>

        {/* ── Section bas : messages du groupe ── */}
        <div style={{ background: "rgba(25,10,48,0.7)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 16, padding: "22px 24px" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#c4a3f0", marginBottom: 14 }}>
            💬 Messages dans le groupe ({messages.length})
          </h2>

          {messages.length === 0 ? (
            <div style={{ color: "#6b4fa0", textAlign: "center", padding: "30px 0", fontSize: 14 }}>
              Cet élève n'a envoyé aucun message.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 480, overflowY: "auto" }}>
              {messages.map((msg) => (
                <div key={msg.id} style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 12, padding: "10px 14px" }}>
                  <div style={{ color: "#f0e8ff", fontSize: 14, lineHeight: 1.55, marginBottom: 4 }}>{msg.content}</div>
                  <div style={{ fontSize: 11, color: "#6b4fa0" }}>
                    {new Date(msg.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {!msg.visible && <span style={{ marginLeft: 8, color: "#f59e0b", fontSize: 10, fontWeight: 700 }}>EN ATTENTE</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
