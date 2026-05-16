import { useEffect, useState } from "react";

type Props = {
  active: boolean;
  seconds?: number;
  onGo: () => void;
  onCancel: () => void;
};

export function NextChapterCountdown({ active, seconds = 5, onGo, onCancel }: Props) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (!active) {
      setRemaining(seconds);
      return;
    }
    setRemaining(seconds);
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          onGo();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) return null;

  return (
    <div
      style={{
        position: "absolute",
        right: 16,
        bottom: 16,
        background: "rgba(10, 4, 20, 0.92)",
        border: "1px solid #a855f7",
        borderRadius: 10,
        padding: "10px 14px",
        color: "#fff",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: 10,
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        zIndex: 5,
      }}
    >
      <span>
        Chapitre suivant dans{" "}
        <strong style={{ color: "#a855f7", fontSize: 15 }}>{remaining}</strong>
        …
      </span>
      <button
        onClick={onCancel}
        style={{
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.3)",
          color: "#fff",
          padding: "4px 10px",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        Annuler
      </button>
    </div>
  );
}
