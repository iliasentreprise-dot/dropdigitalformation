import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ChapterResource } from "./ResourcesSection";

export function ChapterResourcesAdmin({ chapterId }: { chapterId: string | null }) {
  const [resources, setResources] = useState<ChapterResource[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    if (!chapterId) {
      setResources([]);
      return;
    }
    const { data } = await supabase
      .from("chapter_resources")
      .select("*")
      .eq("chapter_id", chapterId)
      .order("position");
    setResources((data as ChapterResource[]) || []);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  const upload = async (file: File) => {
    if (!chapterId) {
      alert("Sauvegarde d'abord le chapitre avant d'ajouter des ressources.");
      return;
    }
    setUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${chapterId}/${Date.now()}_${safeName}`;
    const { error } = await supabase.storage
      .from("chapter-resources")
      .upload(path, file, { upsert: false });
    if (!error) {
      const { data } = supabase.storage.from("chapter-resources").getPublicUrl(path);
      const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
      const title = file.name.replace(/\.[^.]+$/, "");
      await supabase.from("chapter_resources").insert({
        chapter_id: chapterId,
        title,
        file_url: data.publicUrl,
        file_type: ext,
        position: resources.length,
      });
      await reload();
    }
    setUploading(false);
  };

  const updateTitle = async (id: string, title: string) => {
    setResources((rs) => rs.map((r) => (r.id === id ? { ...r, title } : r)));
    await supabase.from("chapter_resources").update({ title }).eq("id", id);
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette ressource ?")) return;
    await supabase.from("chapter_resources").delete().eq("id", id);
    await reload();
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#c4a3f0",
          marginBottom: 8,
        }}
      >
        📚 Ressources téléchargeables
      </div>

      {!chapterId && (
        <div
          style={{
            fontSize: 12,
            color: "#9a7dbd",
            background: "rgba(168,85,247,0.08)",
            padding: 10,
            borderRadius: 6,
            marginBottom: 8,
          }}
        >
          Sauvegarde d'abord le chapitre, puis ajoute des ressources.
        </div>
      )}

      <div
        className={`admin-dropzone${dragging ? " dragging" : ""}`}
        style={{ padding: 14, cursor: chapterId ? "pointer" : "not-allowed", opacity: chapterId ? 1 : 0.5 }}
        onClick={() => chapterId && fileRef.current?.click()}
        onDragOver={(e) => {
          if (!chapterId) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          if (!chapterId) return;
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) void upload(f);
        }}
      >
        {uploading ? (
          <div className="dz-uploading">
            <div className="dz-spinner" /> Envoi…
          </div>
        ) : (
          <>
            <div className="dz-icon">📎</div>
            <div className="dz-label">Glisser un fichier (PDF, ZIP, …)</div>
            <div className="dz-sub">Cliquer pour parcourir</div>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.zip,.doc,.docx,.xlsx,.csv,.txt,image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
      </div>

      {resources.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {resources.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                background: "rgba(25,10,48,0.5)",
                border: "1px solid rgba(168,85,247,0.2)",
                borderRadius: 6,
              }}
            >
              <span style={{ fontSize: 14 }}>📎</span>
              <input
                value={r.title}
                onChange={(e) => updateTitle(r.id, e.target.value)}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  color: "#e2d0ff",
                  fontSize: 13,
                  outline: "none",
                  padding: 4,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 6px",
                  background: "#7c3aed",
                  color: "#fff",
                  borderRadius: 4,
                  textTransform: "uppercase",
                }}
              >
                {r.file_type}
              </span>
              <button
                type="button"
                className="admin-btn-danger sm"
                onClick={() => void remove(r.id)}
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
