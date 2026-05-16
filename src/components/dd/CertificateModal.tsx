import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  moduleTitle: string;
  userName: string;
  onClose: () => void;
};

export function CertificateModal({ open, moduleTitle, userName, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  if (!open) return null;
  const date = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(5, 0, 15, 0.85)",
        backdropFilter: "blur(8px)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        overflow: "auto",
      }}
      className="dd-cert-overlay"
    >
      {/* Confetti */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        {Array.from({ length: 40 }).map((_, i) => {
          const colors = ["#a855f7", "#7c3aed", "#ec4899", "#fbbf24", "#34d399"];
          const c = colors[i % colors.length];
          const left = (i * 53) % 100;
          const delay = (i % 10) * 0.2;
          const dur = 3 + ((i * 7) % 5);
          return (
            <span
              key={i}
              style={{
                position: "absolute",
                top: -20,
                left: `${left}%`,
                width: 10,
                height: 14,
                background: c,
                borderRadius: 2,
                opacity: mounted ? 1 : 0,
                animation: `dd-confetti-fall ${dur}s linear ${delay}s infinite`,
              }}
            />
          );
        })}
      </div>

      <style>{`
        @keyframes dd-confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.6; }
        }
        @media print {
          body * { visibility: hidden !important; }
          .dd-cert-print, .dd-cert-print * { visibility: visible !important; }
          .dd-cert-print { position: absolute !important; left: 0; top: 0; width: 100%; }
          .dd-cert-overlay { background: white !important; backdrop-filter: none !important; }
          .dd-cert-no-print { display: none !important; }
        }
      `}</style>

      <div
        className="dd-cert-print"
        style={{
          position: "relative",
          background: "linear-gradient(135deg, #1a0d2e, #2a1654)",
          border: "2px solid #a855f7",
          borderRadius: 20,
          padding: "48px 36px",
          maxWidth: 560,
          width: "100%",
          textAlign: "center",
          color: "#f0e8ff",
          fontFamily: "Inter, sans-serif",
          boxShadow: "0 30px 80px rgba(168,85,247,0.4)",
        }}
      >
        <div style={{ fontSize: 80, lineHeight: 1 }}>🏆</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: "16px 0 8px" }}>
          Félicitations !
        </h2>
        <p style={{ color: "#c4a3f0", fontSize: 14, margin: 0 }}>
          Tu as terminé le module
        </p>
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
            margin: "20px 0",
            color: "#fff",
            padding: "14px 16px",
            background: "rgba(168,85,247,0.12)",
            border: "1px solid rgba(168,85,247,0.3)",
            borderRadius: 12,
          }}
        >
          {moduleTitle}
        </div>
        <p style={{ fontSize: 15, color: "#e2d0ff", margin: "8px 0" }}>
          Décerné à{" "}
          <strong style={{ color: "#a855f7" }}>{userName}</strong>
        </p>
        <p style={{ fontSize: 13, color: "#9a7dbd", margin: "4px 0 28px" }}>
          le {date}
        </p>
        <div
          className="dd-cert-no-print"
          style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}
        >
          <button
            onClick={handlePrint}
            style={{
              padding: "12px 22px",
              background: "linear-gradient(90deg, #7c3aed, #a855f7)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            📥 Télécharger mon certificat
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "12px 22px",
              background: "transparent",
              color: "#c4a3f0",
              border: "1px solid #a855f7",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Continuer
          </button>
        </div>
      </div>
    </div>
  );
}
