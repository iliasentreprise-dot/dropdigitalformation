import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  value: string;
  onChange: (url: string) => void;
};

export function ThumbnailUploader({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from("module-thumbnails")
      .upload(path, file, { upsert: false });
    if (!error) {
      const { data } = supabase.storage.from("module-thumbnails").getPublicUrl(path);
      onChange(data.publicUrl);
    }
    setUploading(false);
  };

  const hasImage = !!value.trim();

  if (showUrl) {
    return (
      <div className="video-input">
        <input
          className="dz-url-input"
          placeholder="https://..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="dz-url-toggle"
          onClick={() => setShowUrl(false)}
        >
          ← Retour au dropzone
        </button>
      </div>
    );
  }

  return (
    <div className="video-input">
      <div
        className={[
          "admin-dropzone",
          dragging ? "dragging" : "",
          hasImage ? "has-video" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ display: "flex", alignItems: "center", gap: 14, padding: 14 }}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) void upload(f);
        }}
      >
        {hasImage && (
          <img
            src={value}
            alt="thumbnail"
            style={{
              width: 60,
              height: 40,
              objectFit: "cover",
              borderRadius: 6,
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ flex: 1, textAlign: hasImage ? "left" : "center" }}>
          {uploading ? (
            <div className="dz-uploading">
              <div className="dz-spinner" /> Envoi…
            </div>
          ) : hasImage ? (
            <>
              <div style={{ color: "#10b981", fontWeight: 600 }}>
                ✅ Miniature uploadée
              </div>
              <div style={{ fontSize: 12, color: "#9a7dbd" }}>
                Cliquer ou glisser pour remplacer
              </div>
            </>
          ) : (
            <>
              <div className="dz-icon">🖼️</div>
              <div className="dz-label">Glisser une image</div>
              <div className="dz-sub">JPG · PNG · WebP · GIF</div>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
      </div>
      <button
        type="button"
        className="dz-url-toggle"
        onClick={(e) => {
          e.stopPropagation();
          setShowUrl(true);
        }}
      >
        ou coller une URL
      </button>
    </div>
  );
}
