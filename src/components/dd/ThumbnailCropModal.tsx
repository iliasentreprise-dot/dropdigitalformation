import { useEffect, useRef, useState } from "react";

const CROP_W = 320;
const CROP_H = 180; // 16:9
const OUT_W = 800;
const OUT_H = 450;

type Props = {
  file: File;
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
};

export function ThumbnailCropModal({ file, onCrop, onCancel }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgSrc, setImgSrc] = useState("");
  const [imgNat, setImgNat] = useState({ w: 0, h: 0 });
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const lastDist = useRef<number | null>(null);

  const renderBase = { w: 0, h: 0 };
  if (imgNat.w && imgNat.h) {
    const imgAsp = imgNat.w / imgNat.h;
    const cropAsp = CROP_W / CROP_H;
    if (imgAsp > cropAsp) { renderBase.h = CROP_H; renderBase.w = CROP_H * imgAsp; }
    else { renderBase.w = CROP_W; renderBase.h = CROP_W / imgAsp; }
  }
  const rw = renderBase.w * scale;
  const rh = renderBase.h * scale;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgNat({ w: img.naturalWidth, h: img.naturalHeight });
      const imgAsp = img.naturalWidth / img.naturalHeight;
      const cropAsp = CROP_W / CROP_H;
      let bw, bh;
      if (imgAsp > cropAsp) { bh = CROP_H; bw = CROP_H * imgAsp; }
      else { bw = CROP_W; bh = CROP_W / imgAsp; }
      setPos({ x: -(bw - CROP_W) / 2, y: -(bh - CROP_H) / 2 });
      setScale(1);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const { mx, my, px, py } = dragOrigin.current;
    setPos({ x: px + e.clientX - mx, y: py + e.clientY - my });
  };
  const onMouseUp = () => setDragging(false);
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.max(0.3, Math.min(8, s * (e.deltaY > 0 ? 0.92 : 1.08))));
  };
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setDragging(true);
      dragOrigin.current = { mx: e.touches[0].clientX, my: e.touches[0].clientY, px: pos.x, py: pos.y };
    } else if (e.touches.length === 2) {
      lastDist.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && dragging) {
      const { mx, my, px, py } = dragOrigin.current;
      setPos({ x: px + e.touches[0].clientX - mx, y: py + e.touches[0].clientY - my });
    } else if (e.touches.length === 2 && lastDist.current !== null) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      setScale((s) => Math.max(0.3, Math.min(8, s * (dist / lastDist.current!))));
      lastDist.current = dist;
    }
  };
  const onTouchEnd = () => { setDragging(false); lastDist.current = null; };

  const confirm = () => {
    const img = imgRef.current;
    if (!img || !rw || !rh || !renderBase.w || !renderBase.h) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sx = (-pos.x / scale) * (imgNat.w / renderBase.w);
    const sy = (-pos.y / scale) * (imgNat.h / renderBase.h);
    const sw = (CROP_W / scale) * (imgNat.w / renderBase.w);
    const sh = (CROP_H / scale) * (imgNat.h / renderBase.h);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);
    canvas.toBlob((b) => { if (b) onCrop(b); }, "image/jpeg", 0.92);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "rgba(16,6,36,0.99)", border: "1px solid rgba(168,85,247,0.35)", borderRadius: 18, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, maxWidth: 380, width: "100%" }}>
        <h3 style={{ color: "#f0e8ff", margin: 0, fontSize: 16, fontWeight: 800 }}>Recadrer la miniature</h3>
        <div
          style={{ position: "relative", width: CROP_W, height: CROP_H, overflow: "hidden", borderRadius: 8, border: "2px solid #a855f7", cursor: dragging ? "grabbing" : "grab", userSelect: "none", touchAction: "none", background: "#0f0520", flexShrink: 0 }}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          onWheel={onWheel} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        >
          {imgSrc && rw > 0 && (
            <img src={imgSrc} alt="" draggable={false} style={{ position: "absolute", left: pos.x, top: pos.y, width: rw, height: rh, pointerEvents: "none" }} />
          )}
        </div>
        <p style={{ color: "#9a7dbd", fontSize: 12, margin: 0, textAlign: "center" }}>Format 16:9 · Déplace · Zoom (molette / pincer)</p>
        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          <button onClick={onCancel} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(168,85,247,0.3)", color: "#c4a3f0", borderRadius: 10, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Annuler</button>
          <button onClick={confirm} style={{ flex: 1, background: "linear-gradient(135deg,#7c3aed,#a855f7)", border: "none", color: "#fff", borderRadius: 10, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>✓ Confirmer</button>
        </div>
      </div>
    </div>
  );
}
