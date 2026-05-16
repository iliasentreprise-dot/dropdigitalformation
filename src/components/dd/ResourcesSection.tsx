import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ChapterResource = {
  id: string;
  chapter_id: string;
  title: string;
  file_url: string;
  file_type: string;
  position: number;
};

export function ResourcesSection({ chapterId }: { chapterId: string }) {
  const [resources, setResources] = useState<ChapterResource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("chapter_resources")
        .select("*")
        .eq("chapter_id", chapterId)
        .order("position");
      if (alive) {
        setResources((data as ChapterResource[]) || []);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [chapterId]);

  if (loading || resources.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 20,
        background: "rgba(25, 10, 48, 0.6)",
        border: "1px solid rgba(168,85,247,0.25)",
        borderRadius: 12,
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 1.5,
          color: "#9a7dbd",
          marginBottom: 12,
        }}
      >
        📚 Ressources
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {resources.map((r) => (
          <a
            key={r.id}
            href={r.file_url}
            target="_blank"
            rel="noopener noreferrer"
            download
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              background: "rgba(168,85,247,0.08)",
              border: "1px solid rgba(168,85,247,0.2)",
              borderRadius: 8,
              color: "#e2d0ff",
              textDecoration: "none",
              fontSize: 14,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(168,85,247,0.16)";
              e.currentTarget.style.borderColor = "#a855f7";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(168,85,247,0.08)";
              e.currentTarget.style.borderColor = "rgba(168,85,247,0.2)";
            }}
          >
            <span style={{ fontSize: 18 }}>📎</span>
            <span style={{ flex: 1 }}>{r.title}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "3px 8px",
                background: "#7c3aed",
                color: "#fff",
                borderRadius: 4,
                textTransform: "uppercase",
              }}
            >
              {r.file_type}
            </span>
            <span style={{ color: "#a855f7", fontSize: 16 }}>↓</span>
          </a>
        ))}
      </div>
    </div>
  );
}
