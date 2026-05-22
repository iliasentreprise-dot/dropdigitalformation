import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import "../styles/admin.css";
import "../styles/dropdigital.css";

type DMRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  edited: boolean;
  edited_at: string | null;
};

type PartnerInfo = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  lastAt: string;
  count: number;
};

type Payload = {
  studentName: string;
  partners: PartnerInfo[];
  messagesByPartner: Record<string, DMRow[]>;
};

const getDmsFn = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const { userId } = (data as unknown) as { userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sa = supabaseAdmin as any;
    const { data: msgs } = await sa
      .from("private_messages")
      .select("id, sender_id, recipient_id, content, created_at, deleted_at, deleted_by, edited, edited_at")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: true })
      .limit(2000);
    const rows = (msgs ?? []) as DMRow[];

    const map: Record<string, DMRow[]> = {};
    for (const r of rows) {
      const partner = r.sender_id === userId ? r.recipient_id : r.sender_id;
      (map[partner] = map[partner] || []).push(r);
    }
    const partnerIds = Object.keys(map);
    const { data: profs } = partnerIds.length
      ? await sa.from("profiles").select("id, username, full_name, avatar_url").in("id", partnerIds)
      : { data: [] };
    const profMap: Record<string, { username: string | null; full_name: string | null; avatar_url: string | null }> =
      Object.fromEntries(((profs ?? []) as Array<{ id: string; username: string | null; full_name: string | null; avatar_url: string | null }>).map((p) => [p.id, p]));

    const partners: PartnerInfo[] = partnerIds.map((pid) => {
      const list = map[pid];
      const p = profMap[pid] ?? { username: null, full_name: null, avatar_url: null };
      return {
        id: pid,
        username: p.username,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        lastAt: list[list.length - 1]?.created_at ?? "",
        count: list.length,
      };
    }).sort((a, b) => (b.lastAt > a.lastAt ? 1 : -1));

    const { data: stu } = await sa.from("profiles").select("username, full_name").eq("id", userId).maybeSingle();
    const studentName =
      (stu as { username: string | null; full_name: string | null } | null)?.full_name ||
      (stu as { username: string | null; full_name: string | null } | null)?.username ||
      "Élève";

    return { studentName, partners, messagesByPartner: map } as Payload;
  });

const deleteDmFn = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const { messageId, adminId } = (data as unknown) as { messageId: string; adminId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from("private_messages")
      .update({ deleted_at: new Date().toISOString(), deleted_by: adminId })
      .eq("id", messageId);
    if (error) throw new Error((error as { message: string }).message);
    return { success: true };
  });

const editDmFn = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const { messageId, content } = (data as unknown) as { messageId: string; content: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from("private_messages")
      .update({ content, edited: true, edited_at: new Date().toISOString() })
      .eq("id", messageId);
    if (error) throw new Error((error as { message: string }).message);
    return { success: true };
  });

export const Route = createFileRoute("/admin_/student/$userId/dms")({
  component: StudentDmsPage,
});

function StudentDmsPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { userId } = Route.useParams();
  const [data, setData] = useState<Payload | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) { void navigate({ to: "/login" }); return; }
    if (!user) return;
    (async () => {
      const { data: adminCheck } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!adminCheck) { void navigate({ to: "/" }); return; }
      try {
        const result = await (getDmsFn as unknown as (a: { data: { userId: string } }) => Promise<Payload>)({ data: { userId } });
        setData(result);
        if (result.partners.length) setActive(result.partners[0].id);
      } catch (e) {
        console.error(e);
      }
      setDataLoading(false);
    })();
  }, [user, loading, userId]);

  if (loading || dataLoading) {
    return <div style={{ minHeight: "100dvh", background: "oklch(0.129 0.042 264.695)", display: "flex", alignItems: "center", justifyContent: "center", color: "#9a7dbd" }}>Chargement…</div>;
  }
  if (!data) return null;

  const activeMsgs = active ? (data.messagesByPartner[active] ?? []) : [];
  const activePartner = data.partners.find((p) => p.id === active);
  const partnerName = (p: PartnerInfo) => p.full_name || p.username || "Élève";

  const handleDelete = async (m: DMRow) => {
    if (!user) return;
    setActionLoading(m.id);
    try {
      await (deleteDmFn as unknown as (a: { data: { messageId: string; adminId: string } }) => Promise<void>)({
        data: { messageId: m.id, adminId: user.id },
      });
      // Mettre à jour le state local immédiatement
      setData((prev) => {
        if (!prev || !active) return prev;
        return {
          ...prev,
          messagesByPartner: {
            ...prev.messagesByPartner,
            [active]: prev.messagesByPartner[active].map((msg) =>
              msg.id === m.id ? { ...msg, deleted_at: new Date().toISOString(), deleted_by: user.id } : msg
            ),
          },
        };
      });
    } catch (e) {
      console.error(e);
    }
    setActionLoading(null);
  };

  const handleEdit = async (m: DMRow) => {
    if (!editContent.trim()) return;
    setActionLoading(m.id);
    try {
      await (editDmFn as unknown as (a: { data: { messageId: string; content: string } }) => Promise<void>)({
        data: { messageId: m.id, content: editContent.trim() },
      });
      setData((prev) => {
        if (!prev || !active) return prev;
        return {
          ...prev,
          messagesByPartner: {
            ...prev.messagesByPartner,
            [active]: prev.messagesByPartner[active].map((msg) =>
              msg.id === m.id ? { ...msg, content: editContent.trim(), edited: true, edited_at: new Date().toISOString() } : msg
            ),
          },
        };
      });
      setEditingId(null);
      setEditContent("");
    } catch (e) {
      console.error(e);
    }
    setActionLoading(null);
  };

  return (
    <div style={{ minHeight: "100dvh", background: "oklch(0.129 0.042 264.695)", color: "#f0e8ff" }}>
      <div className="admin-topbar" style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", gap: 12 }}>
        <Link to="/admin/student/$userId" params={{ userId }} className="admin-back" style={{ flexShrink: 0 }}>← Profil</Link>
        <h1 className="admin-title" style={{ fontSize: 15, flex: 1, margin: 0 }}>💬 Messages privés — {data.studentName}</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, padding: 16, maxWidth: 1100, margin: "0 auto" }}>
        {/* Liste des conversations */}
        <div style={{ background: "rgba(25,10,48,0.7)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 12, padding: 8, maxHeight: "75vh", overflowY: "auto" }}>
          {data.partners.length === 0 && (
            <div style={{ color: "#6b4fa0", fontSize: 13, padding: 16, textAlign: "center" }}>Aucune conversation.</div>
          )}
          {data.partners.map((p) => (
            <button
              key={p.id}
              onClick={() => { setActive(p.id); setEditingId(null); }}
              style={{
                width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", background: active === p.id ? "rgba(124,58,237,0.25)" : "transparent",
                border: "none", borderRadius: 8, cursor: "pointer", marginBottom: 4, color: "#f0e8ff",
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(124,58,237,0.2)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#c4a3f0", fontWeight: 700 }}>{partnerName(p)[0]?.toUpperCase()}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{partnerName(p)}</div>
                <div style={{ fontSize: 11, color: "#9a7dbd" }}>{p.count} message{p.count > 1 ? "s" : ""}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Fenêtre de messages */}
        <div style={{ background: "rgba(25,10,48,0.7)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 12, padding: 16, maxHeight: "75vh", overflowY: "auto" }}>
          {!activePartner && <div style={{ color: "#6b4fa0", fontSize: 13, textAlign: "center", padding: 40 }}>Sélectionne une conversation.</div>}
          {activePartner && (
            <>
              <div style={{ fontSize: 13, color: "#c4a3f0", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid rgba(168,85,247,0.15)" }}>
                Conversation entre <strong>{data.studentName}</strong> et <strong>{partnerName(activePartner)}</strong>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activeMsgs.map((m) => {
                  const fromStudent = m.sender_id === userId;
                  const isDeleted = !!m.deleted_at;
                  const isEditing = editingId === m.id;
                  const isActing = actionLoading === m.id;

                  return (
                    <div key={m.id} style={{ alignSelf: fromStudent ? "flex-end" : "flex-start", maxWidth: "80%", minWidth: 160 }}>
                      {/* Bulle du message */}
                      <div style={{
                        background: isDeleted ? "rgba(127,29,29,0.35)" : fromStudent ? "linear-gradient(135deg, #7c3aed, #a855f7)" : "rgba(30,15,55,0.85)",
                        border: isDeleted ? "1px solid rgba(239,68,68,0.45)" : "1px solid rgba(168,85,247,0.18)",
                        color: isDeleted ? "#fca5a5" : "#fff",
                        borderRadius: 12, padding: "8px 12px", fontSize: 13, lineHeight: 1.5, wordBreak: "break-word",
                        opacity: isDeleted ? 0.75 : 1,
                      }}>
                        {isEditing ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              rows={3}
                              style={{ width: "100%", background: "rgba(15,5,30,0.8)", border: "1px solid rgba(168,85,247,0.4)", borderRadius: 8, color: "#f0e8ff", fontSize: 13, padding: "6px 8px", resize: "vertical", outline: "none" }}
                              autoFocus
                            />
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                onClick={() => void handleEdit(m)}
                                disabled={isActing || !editContent.trim()}
                                style={{ flex: 1, background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.4)", color: "#6ee7b7", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                              >
                                {isActing ? "…" : "✓ Sauvegarder"}
                              </button>
                              <button
                                onClick={() => { setEditingId(null); setEditContent(""); }}
                                style={{ background: "rgba(100,100,120,0.2)", border: "1px solid rgba(100,100,120,0.35)", color: "#9a7dbd", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer" }}
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span style={{ textDecoration: isDeleted ? "line-through" : "none" }}>{m.content}</span>
                            {isDeleted && (
                              <div style={{ fontSize: 10, marginTop: 4, color: "#fca5a5", fontStyle: "italic" }}>
                                (supprimé par admin à {new Date(m.deleted_at!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })})
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Métadonnées + boutons admin */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, justifyContent: fromStudent ? "flex-end" : "flex-start", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, color: "#6b4fa0" }}>
                          {new Date(m.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {m.edited && !isDeleted && (
                          <span style={{ fontSize: 10, color: "#6b4fa0", fontStyle: "italic" }}>(modifié)</span>
                        )}
                        {/* ── Boutons admin — visibles uniquement ici ── */}
                        {!isDeleted && !isEditing && (
                          <button
                            onClick={() => { setEditingId(m.id); setEditContent(m.content); }}
                            disabled={isActing}
                            title="Modifier le message"
                            style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)", color: "#c4a3f0", borderRadius: 5, padding: "2px 6px", fontSize: 10, cursor: "pointer", lineHeight: 1.4 }}
                          >
                            ✏️
                          </button>
                        )}
                        {!isDeleted && (
                          <button
                            onClick={() => void handleDelete(m)}
                            disabled={isActing}
                            title="Supprimer le message"
                            style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", borderRadius: 5, padding: "2px 6px", fontSize: 10, cursor: "pointer", lineHeight: 1.4 }}
                          >
                            {isActing ? "…" : "🗑"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
