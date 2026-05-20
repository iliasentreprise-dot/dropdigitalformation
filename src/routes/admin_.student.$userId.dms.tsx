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
      .select("id, sender_id, recipient_id, content, created_at, deleted_at")
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

  return (
    <div style={{ minHeight: "100dvh", background: "oklch(0.129 0.042 264.695)", color: "#f0e8ff" }}>
      <div className="admin-topbar" style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", gap: 12 }}>
        <Link to="/admin/student/$userId" params={{ userId }} className="admin-back" style={{ flexShrink: 0 }}>← Profil</Link>
        <h1 className="admin-title" style={{ fontSize: 15, flex: 1, margin: 0 }}>💬 Messages privés — {data.studentName}</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, padding: 16, maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ background: "rgba(25,10,48,0.7)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 12, padding: 8, maxHeight: "75vh", overflowY: "auto" }}>
          {data.partners.length === 0 && (
            <div style={{ color: "#6b4fa0", fontSize: 13, padding: 16, textAlign: "center" }}>Aucune conversation.</div>
          )}
          {data.partners.map((p) => (
            <button
              key={p.id}
              onClick={() => setActive(p.id)}
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

        <div style={{ background: "rgba(25,10,48,0.7)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 12, padding: 16, maxHeight: "75vh", overflowY: "auto" }}>
          {!activePartner && <div style={{ color: "#6b4fa0", fontSize: 13, textAlign: "center", padding: 40 }}>Sélectionne une conversation.</div>}
          {activePartner && (
            <>
              <div style={{ fontSize: 13, color: "#c4a3f0", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid rgba(168,85,247,0.15)" }}>
                Conversation entre <strong>{data.studentName}</strong> et <strong>{partnerName(activePartner)}</strong>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {activeMsgs.map((m) => {
                  const fromStudent = m.sender_id === userId;
                  const isDeleted = !!m.deleted_at;
                  return (
                    <div key={m.id} style={{ alignSelf: fromStudent ? "flex-end" : "flex-start", maxWidth: "78%" }}>
                      <div style={{
                        background: isDeleted ? "rgba(220,38,38,0.22)" : fromStudent ? "linear-gradient(135deg, #7c3aed, #a855f7)" : "rgba(30,15,55,0.85)",
                        border: isDeleted ? "1px solid rgba(239,68,68,0.55)" : "1px solid rgba(168,85,247,0.18)",
                        color: isDeleted ? "#fecaca" : "#fff",
                        borderRadius: 12, padding: "8px 12px", fontSize: 13, lineHeight: 1.45, wordBreak: "break-word",
                      }}>
                        {m.content}
                        {isDeleted && (
                          <div style={{ fontSize: 10, marginTop: 4, color: "#fca5a5", fontStyle: "italic" }}>
                            (message supprimé à {new Date(m.deleted_at!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })})
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: "#6b4fa0", marginTop: 2, textAlign: fromStudent ? "right" : "left" }}>
                        {new Date(m.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
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
