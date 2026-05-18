import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Result = {
  id: string;
  user_id: string;
  content: string;
  amount: number | null;
  photo_url: string | null;
  visible: boolean;
  created_at: string;
};

type RProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export function ResultsWall({
  userId,
  username,
  avatarUrl,
}: {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
}) {
  const [results, setResults] = useState<Result[]>([]);
  const [profiles, setProfiles] = useState<Record<string, RProfile>>({});
  const [content, setContent] = useState("");
  const [amount, setAmount] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("results")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setResults((data as unknown as Result[]) ?? []);
    };
    void load();

    const channel = supabase
      .channel("results_channel")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "results" }, (payload) => {
        const r = payload.new as Result;
        setResults((prev) => {
          if (prev.find((x) => x.id === r.id)) return prev;
          return [r, ...prev];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "results" }, (payload) => {
        const updated = payload.new as Result;
        setResults((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    const unknownIds = [...new Set(results.map((r) => r.user_id).filter((id) => !profiles[id]))];
    if (!unknownIds.length) return;
    supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", unknownIds)
      .then(({ data }) => {
        if (data?.length) {
          setProfiles((prev) => ({
            ...prev,
            ...Object.fromEntries((data as RProfile[]).map((p) => [p.id, p])),
          }));
        }
      });
  }, [results]);

  const handlePhoto = (file: File) => {
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const submit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);

    let photo_url: string | null = null;
    if (photoFile) {
      const ext = photoFile.name.split(".").pop() || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("result-photos")
        .upload(path, photoFile, { upsert: false });
      if (!error) {
        const { data } = supabase.storage.from("result-photos").getPublicUrl(path);
        photo_url = data.publicUrl;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("results")
      .insert({
        user_id: userId,
        content: content.trim(),
        amount: amount ? parseInt(amount, 10) : null,
        photo_url,
      })
      .select()
      .single();

    if (data) {
      setResults((prev) => {
        const row = data as unknown as Result;
        if (prev.find((r) => r.id === row.id)) return prev;
        return [row, ...prev];
      });
    }

    setContent("");
    setAmount("");
    setPhotoFile(null);
    setPhotoPreview("");
    setSubmitting(false);
  };

  const nameOf = (uid: string) => {
    if (uid === userId) return username || "Moi";
    const p = profiles[uid];
    return p?.full_name || p?.username || "Élève";
  };

  const avatarOf = (uid: string) => {
    if (uid === userId) return avatarUrl;
    return profiles[uid]?.avatar_url ?? null;
  };

  return (
    <div>
      <div className="results-form">
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14, color: "#f0e8ff" }}>🚀 Partage ton résultat</h2>
        <textarea
          className="results-textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Décris ton résultat… première vente, chiffre du mois, client signé…"
          maxLength={500}
          rows={3}
        />
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="results-amount-input"
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Montant gagné (€) — optionnel"
          />
          <button
            type="button"
            className="admin-btn-ghost sm"
            onClick={() => fileRef.current?.click()}
          >
            📷 {photoFile ? "Photo ajoutée ✓" : "Ajouter une photo"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePhoto(f);
            }}
          />
        </div>
        {photoPreview && (
          <div style={{ marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <img
              src={photoPreview}
              alt="preview"
              style={{ maxHeight: 100, borderRadius: 8, objectFit: "cover" }}
            />
            <button
              onClick={() => { setPhotoFile(null); setPhotoPreview(""); }}
              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18 }}
            >
              ✕
            </button>
          </div>
        )}
        <button
          className="admin-btn-primary"
          onClick={submit}
          disabled={submitting || !content.trim()}
        >
          {submitting ? "Envoi en cours…" : "🏆 Partager mon résultat"}
        </button>
      </div>

      <div className="results-wall">
        {results.length === 0 && (
          <div style={{ textAlign: "center", color: "#6b4fa0", padding: "40px 0", fontSize: 14 }}>
            Aucun résultat partagé pour l'instant. Sois le premier !
          </div>
        )}
        {results.map((r) => {
          const name = nameOf(r.user_id);
          const avatar = avatarOf(r.user_id);
          return (
            <div key={r.id} className="result-card">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(168,85,247,0.2)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                  {avatar
                    ? <img src={avatar} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 14, color: "#c4a3f0" }}>{name[0]?.toUpperCase()}</span>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#f0e8ff" }}>{name}</div>
                  <div style={{ fontSize: 11, color: "#7c5c9a" }}>
                    {new Date(r.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                </div>
                {r.amount != null && (
                  <div style={{ background: "linear-gradient(135deg, #059669, #10b981)", color: "#fff", fontWeight: 800, fontSize: 14, padding: "4px 14px", borderRadius: 20, whiteSpace: "nowrap" }}>
                    +{r.amount.toLocaleString("fr-FR")}€
                  </div>
                )}
              </div>
              <p style={{ color: "#c4a3f0", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{r.content}</p>
              {r.photo_url && (
                <img
                  src={r.photo_url}
                  alt="résultat"
                  style={{ marginTop: 12, width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 10 }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
