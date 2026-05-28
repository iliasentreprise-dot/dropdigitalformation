import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const STRIPE_LINK = "https://buy.stripe.com/REMPLACE_MOI";
const STRIPE_LINK_BUMP = "https://buy.stripe.com/REMPLACE_MOI_BUMP";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "La Méthode des 3% — Protocole de Résistance Leptinique Silencieux" },
      { name: "description", content: "Le seul protocole qui réinitialise la sensibilité à la leptine en 21 jours — sans régime, sans salle de sport, sans privation." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Montserrat:wght@300;400;600&family=Bebas+Neue&display=swap",
      },
    ],
  }),
  component: Index,
});

function Ornament() {
  return <div className="ornament">── ◆ ──</div>;
}

function Tag({ text }: { text: string }) {
  return <div className="tag">{text}</div>;
}

function Countdown() {
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (typeof window === "undefined") return 15 * 60;
    const stored = sessionStorage.getItem("m3p_end");
    if (stored) {
      const left = Math.floor((parseInt(stored, 10) - Date.now()) / 1000);
      return left > 0 ? left : 0;
    }
    const end = Date.now() + 15 * 60 * 1000;
    sessionStorage.setItem("m3p_end", String(end));
    return 15 * 60;
  });

  useEffect(() => {
    if (timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft((p) => (p <= 1 ? (clearInterval(id), 0) : p - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");

  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "var(--red)", color: "var(--txt)",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
      padding: "10px 20px",
      fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 12, letterSpacing: 4,
    }}>
      ACCÈS LIMITÉ — L'OFFRE EXPIRE DANS
      <span style={{
        fontFamily: "'Bebas Neue', sans-serif", fontSize: 20,
        background: "rgba(0,0,0,0.3)", padding: "2px 12px", letterSpacing: 2,
      }}>
        {mm}:{ss}
      </span>
    </div>
  );
}

function Index() {
  return (
    <>
      <style>{css}</style>
      <div style={{ background: "var(--bg)", minHeight: "100vh" }}>

        {/* ── 1. COUNTDOWN ── */}
        <Countdown />

        {/* ── 2. HERO ── */}
        <section style={{ padding: "120px 20px 100px", textAlign: "center" }}>
          <div className="inner">
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 11, letterSpacing: 6, color: "var(--gold)", textTransform: "uppercase", marginBottom: 28 }}>
              ACCÈS RESTREINT · PROGRAMME EXCLUSIF
            </div>
            <Ornament />
            <h1 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(64px, 10vw, 110px)",
              color: "#fff", fontWeight: 600, lineHeight: 0.9,
              margin: "0 0 28px",
            }}>
              La Méthode des 3%
            </h1>
            <p style={{
              fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
              fontSize: "clamp(20px, 3vw, 30px)",
              color: "var(--gold2)", lineHeight: 1.4,
              margin: "0 auto 32px", maxWidth: 640,
            }}>
              Ce que font les femmes qui perdent du poids<br />
              sans effort — et qui n'en parlent jamais.
            </p>
            <Ornament />
            <p style={{
              fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 16,
              color: "var(--txt2)", maxWidth: 560, margin: "28px auto 44px", lineHeight: 1.9,
            }}>
              Tu ne souffres pas d'un manque de volonté.<br />
              Tu souffres d'un verrou hormonal que personne ne t'a jamais expliqué.
            </p>
            <a href={STRIPE_LINK} className="btn-cta">DÉCOUVRIR LE PROTOCOLE</a>
            <div className="btn-sub">17,80€ · Accès immédiat · Garanti 30 jours sans condition</div>
          </div>
        </section>

        <div className="divider" />

        {/* ── 3. LE VERROU CACHÉ ── */}
        <section>
          <div className="inner" style={{ textAlign: "center" }}>
            <Tag text="LE VERROU QUE PERSONNE NE T'A RÉVÉLÉ" />
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
              fontSize: "clamp(34px, 5vw, 58px)",
              color: "#fff", margin: "0 auto 32px", maxWidth: 780, lineHeight: 1.15,
            }}>
              97% des femmes qui "n'arrivent pas à perdre du ventre"<br />
              ont toutes le même problème.
            </h2>
            <p style={{
              fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 16,
              color: "var(--txt2)", lineHeight: 1.9,
              maxWidth: 640, margin: "0 auto 48px", textAlign: "left",
            }}>
              Ce n'est pas la nourriture. Ce n'est pas le sport.<br />
              C'est la leptine — l'hormone silencieuse qui décide si<br />
              ton corps brûle ou stocke la graisse abdominale.<br /><br />
              Quand la leptine est en résistance, peu importe ce que tu fais :<br />
              ton corps refuse de laisser partir cette graisse.<br />
              C'est un verrou biologique. Et il existe une clé.
            </p>

            {/* Carte mécanisme */}
            <div style={{
              background: "var(--bg2)", border: "1px solid rgba(201,168,76,0.4)",
              padding: 40, maxWidth: 640, margin: "0 auto 56px", textAlign: "center",
            }}>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 10, letterSpacing: 5, color: "var(--gold)", marginBottom: 20 }}>
                ── LE MÉCANISME ──
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 36, color: "var(--gold2)", marginBottom: 16, lineHeight: 1.2 }}>
                Protocole de Résistance<br />Leptinique Silencieux
              </div>
              <p style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 15, color: "var(--txt2)", margin: 0, lineHeight: 1.8 }}>
                Le seul protocole qui réinitialise la sensibilité à la leptine en 21 jours — sans régime, sans salle de sport, sans privation.
              </p>
            </div>

            {/* 3 piliers */}
            <div className="grid3" style={{ textAlign: "left" }}>
              {[
                { num: "01", title: "RÉINITIALISATION", desc: "Réactiver les récepteurs leptiniques dormants via une fenêtre thermogénique de 20 minutes" },
                { num: "02", title: "SYNCHRONISATION", desc: "Aligner les repas avec les pics hormonaux naturels pour maximiser le déstockage" },
                { num: "03", title: "ANCRAGE", desc: "Stabiliser le nouveau set-point métabolique pour des résultats permanents" },
              ].map((p) => (
                <div key={p.num} style={{ borderLeft: "2px solid var(--gold)", paddingLeft: 20 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, color: "var(--gold)", opacity: 0.4, lineHeight: 1 }}>{p.num}</div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 11, letterSpacing: 3, color: "var(--gold)", marginBottom: 10 }}>{p.title}</div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 14, color: "var(--txt2)", lineHeight: 1.8 }}>{p.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="divider" />

        {/* ── 4. TU TE RECONNAIS ? ── */}
        <section>
          <div className="inner">
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <Tag text="SOYONS HONNÊTES" />
              <h2 style={{
                fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
                fontSize: "clamp(30px, 4vw, 52px)",
                color: "#fff", margin: "0 auto", maxWidth: 700, lineHeight: 1.2,
              }}>
                Si tu lis ceci, c'est que tu en as assez<br />
                de chercher une réponse qui ne vient jamais.
              </h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                "→  Tu surveilles ce que tu manges depuis des mois. La balance ne bouge plus.",
                "→  Tu as essayé les ceintures chauffantes, les compléments, les abdos.\n    Résultat : pareil.",
                "→  Tu portes des vêtements larges pour cacher cette zone. Tu évites les miroirs.",
                "→  Tu commences à croire que c'est \"génétique\" ou que \"c'est ton âge\".\n    Tu as tort.",
              ].map((item, i) => (
                <div key={i} style={{
                  background: "var(--bg2)",
                  padding: "24px 28px",
                  borderLeft: "1px solid rgba(201,168,76,0.3)",
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 15,
                  color: "var(--txt)", lineHeight: 1.8, whiteSpace: "pre-line",
                }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="divider" />

        {/* ── 5. TÉMOIGNAGES ── */}
        <section>
          <div className="inner" style={{ textAlign: "center" }}>
            <Tag text="ELLES L'ONT FAIT" />
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(32px, 5vw, 56px)",
              color: "#fff", margin: "0 auto 48px", lineHeight: 1.2,
            }}>
              Des femmes ordinaires.<br />Des résultats extraordinaires.
            </h2>
            <div className="grid3">
              {[
                { result: "-9cm de tour de taille en 3 semaines", quote: "Je portais des robes larges depuis 2 ans. Aujourd'hui je remets mes jeans skinny de 2019. Je n'aurais jamais cru que c'était possible en faisant aussi peu.", name: "Sophie M., 38 ans · Lyon" },
                { result: "Taille visible dès le jour 12", quote: "Le module sur la synchronisation alimentaire a tout changé pour moi. Pas de privation, pas de sport intense. Juste les bons moments. Je comprends enfin pourquoi je n'y arrivais pas avant.", name: "Aurélie D., 31 ans · Paris" },
                { result: "-6cm sans me priver", quote: "J'étais sceptique. 17€ pour une méthode qui promet de changer ce que des centaines d'euros de coaching n'ont pas réussi à faire... Et pourtant. Semaine 2, mes vêtements flottaient.", name: "Camille R., 44 ans · Bordeaux" },
              ].map((t, i) => (
                <div key={i} style={{
                  background: "var(--bg2)",
                  border: "1px solid rgba(201,168,76,0.15)",
                  borderTop: "1px solid rgba(201,168,76,0.6)",
                  padding: 32, textAlign: "left",
                }}>
                  <div style={{ color: "var(--gold2)", fontSize: 14, marginBottom: 14 }}>⭐⭐⭐⭐⭐</div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 22, color: "var(--gold2)", marginBottom: 16, lineHeight: 1.3 }}>
                    "{t.result}"
                  </div>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 14, color: "var(--txt2)", lineHeight: 1.8, fontStyle: "italic", margin: "0 0 20px" }}>
                    "{t.quote}"
                  </p>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 12, letterSpacing: 2, color: "var(--gold)", textTransform: "uppercase" }}>
                    — {t.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="divider" />

        {/* ── 6. STATS ── */}
        <section>
          <div className="inner">
            <div className="stats-row">
              <div className="stat-block">
                <div className="stat-val">+800</div>
                <div className="stat-label">femmes ont suivi ce protocole</div>
              </div>
              <div className="stat-sep" />
              <div className="stat-block">
                <div className="stat-val">21</div>
                <div className="stat-label">jours pour voir les premiers résultats</div>
              </div>
              <div className="stat-sep" />
              <div className="stat-block">
                <div className="stat-val">97%</div>
                <div className="stat-label">des participantes rapportent une différence visible</div>
              </div>
            </div>
          </div>
        </section>

        <div className="divider" />

        {/* ── 7. CE QUE TU REÇOIS ── */}
        <section>
          <div className="inner" style={{ textAlign: "center" }}>
            <Tag text="CONTENU DU PROGRAMME" />
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(28px, 4vw, 50px)",
              color: "#fff", margin: "0 auto 48px", maxWidth: 680, lineHeight: 1.2,
            }}>
              La Méthode des 3%<br />
              <span style={{ color: "var(--gold2)" }}>— 6 modules pour lever le verrou.</span>
            </h2>
            <div className="grid2">
              {[
                { num: "01", title: "La Science du Verrou Leptinique", desc: "Comprendre pourquoi ton corps stocke à cet endroit précis et pourquoi tout ce que tu as essayé n'a pas fonctionné." },
                { num: "02", title: "Le Protocole Thermogénique (20min/jour)", desc: "Les 5 mouvements qui activent la fenêtre de déstockage leptinique. Simple. Précis. Efficace." },
                { num: "03", title: "La Synchronisation Alimentaire", desc: "Quoi manger n'est pas le sujet. QUAND manger l'est. Le guide complet des fenêtres hormonales optimales." },
                { num: "04", title: "Plan Jour par Jour — 21 jours", desc: "Chaque journée planifiée. Rien à inventer. Tu exécutes, tu vois les résultats." },
                { num: "05", title: "L'Ancrage du Nouveau Métabolisme", desc: "Comment maintenir les résultats à vie sans restriction permanente. Le secret que les coachs ne partagent pas." },
                { num: "06", title: "Tracker + Recettes Taille Fine", desc: "Le tableau de bord personnel + 18 recettes compatibles avec le protocole." },
              ].map((m) => (
                <div key={m.num} style={{
                  background: "var(--bg2)",
                  border: "1px solid rgba(201,168,76,0.12)",
                  padding: "28px 32px", textAlign: "left",
                }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 4, color: "var(--gold3)", opacity: 0.8, marginBottom: 8 }}>
                    MODULE {m.num}
                  </div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 20, color: "#fff", marginBottom: 10, lineHeight: 1.3 }}>
                    {m.title}
                  </div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 14, color: "var(--txt2)", lineHeight: 1.8 }}>
                    {m.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="divider" />

        {/* ── 8. PRIX ── */}
        <section>
          <div className="inner" style={{ textAlign: "center" }}>
            <Tag text="OFFRE DE LANCEMENT" />
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
              fontSize: "clamp(36px, 6vw, 72px)",
              color: "#fff", margin: "0 auto 48px",
            }}>
              Rejoindre le cercle des 3%
            </h2>
            <div style={{
              background: "var(--bg2)",
              border: "1px solid rgba(201,168,76,0.4)",
              padding: 48, maxWidth: 520, margin: "0 auto",
              boxShadow: "0 0 80px rgba(201,168,76,0.05)",
            }}>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 11, letterSpacing: 4, color: "var(--gold)", marginBottom: 24 }}>
                ACCÈS COMPLET AU PROGRAMME
              </div>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 20, color: "var(--txt2)", textDecoration: "line-through", marginBottom: 4 }}>
                47€
              </div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 96, color: "var(--gold2)", lineHeight: 1, marginBottom: 8 }}>
                17,80€
              </div>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 12, color: "var(--txt2)", letterSpacing: 2, marginBottom: 36 }}>
                accès à vie · PDF immédiat · garanti 30 jours
              </div>

              {/* Order bump */}
              <div style={{ border: "1px dashed rgba(201,168,76,0.5)", padding: "20px 24px", marginBottom: 36, textAlign: "left" }}>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 11, letterSpacing: 3, color: "var(--gold)", marginBottom: 10 }}>
                  ✦  PACK BONUS — AJOUTER À MA COMMANDE
                </div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 13, color: "var(--txt2)", lineHeight: 1.7, marginBottom: 12 }}>
                  12 recettes Taille Fine supplémentaires + Guide de maintien 60 jours<br />
                  + 7,80€ seulement
                </div>
                <a href={STRIPE_LINK_BUMP} style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 13, color: "var(--gold2)", textDecoration: "underline" }}>
                  Ajouter le pack bonus →
                </a>
              </div>

              <a href={STRIPE_LINK} className="btn-cta" style={{ display: "block" }}>JE REJOINS LA MÉTHODE →</a>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 11, color: "var(--txt2)", marginTop: 16, letterSpacing: 1 }}>
                Paiement 100% sécurisé · Accès en moins de 2 minutes
              </div>
            </div>
          </div>
        </section>

        <div className="divider" />

        {/* ── 9. GARANTIE ── */}
        <section style={{ background: "var(--bg3)" }}>
          <div className="inner" style={{ textAlign: "center" }}>
            <div style={{
              width: 160, height: 160, borderRadius: "50%",
              background: "conic-gradient(from 0deg, #8a6a28, #c9a84c, #e8c97a, #c9a84c, #8a6a28)",
              boxShadow: "0 0 0 8px rgba(201,168,76,0.1), 0 0 0 16px rgba(201,168,76,0.05)",
              display: "flex", flexDirection: "column" as const,
              alignItems: "center", justifyContent: "center",
              margin: "0 auto 40px",
            }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "#fff", letterSpacing: 3, lineHeight: 1.4, textAlign: "center" }}>
                GARANTI<br />30<br />JOURS
              </div>
            </div>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(28px, 4vw, 48px)",
              color: "#fff", margin: "0 auto 24px", maxWidth: 640, lineHeight: 1.25,
            }}>
              Tu essaies. Si ça ne marche pas,<br />je te rembourse intégralement.
            </h2>
            <p style={{
              fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 16,
              color: "var(--txt2)", lineHeight: 2, maxWidth: 560, margin: "0 auto",
            }}>
              30 jours. Tu appliques le protocole.<br />
              Si tu ne vois aucune différence, un seul email suffit —<br />
              remboursement complet, sans question, sans délai.<br /><br />
              Pas de conditions. Pas de justification.<br />
              Tu repars avec ton argent.
            </p>
          </div>
        </section>

        <div className="divider" />

        {/* ── 10. FAQ ── */}
        <section>
          <div className="inner">
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <Tag text="QUESTIONS" />
              <h2 style={{
                fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
                fontSize: "clamp(32px, 5vw, 60px)",
                color: "#fff", margin: 0,
              }}>
                Ce que tu te demandes.
              </h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 760, margin: "0 auto" }}>
              {[
                { q: "Est-ce vraiment différent de ce que j'ai déjà essayé ?", r: "Oui. Parce que ce protocole ne s'attaque pas à la nourriture ou au sport — il s'attaque à la résistance leptinique, la cause hormonale que les autres méthodes ignorent complètement." },
                { q: "Combien de temps ça prend par jour ?", r: "20 minutes. C'est le temps du protocole thermogénique quotidien. Le reste (synchronisation alimentaire) s'intègre dans ta vie normale — sans rien changer à tes repas." },
                { q: "Ça marche si j'ai plus de 40 ans ?", r: "Oui, et même plus efficacement — la résistance leptinique s'accentue avec l'âge, ce protocole est conçu pour y répondre directement." },
                { q: "Je reçois l'accès quand ?", r: "Immédiatement. Dès ta commande validée, tu reçois un lien de téléchargement instantané par email. Moins de 2 minutes." },
                { q: "Et si je ne suis pas satisfaite ?", r: "Garantie 30 jours. Un email suffit. Remboursement total, sans condition, sans justification." },
              ].map((f, i) => (
                <div key={i} style={{
                  background: "var(--bg2)",
                  border: "1px solid rgba(201,168,76,0.15)",
                  padding: "24px 28px",
                }}>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 18, color: "var(--gold2)", marginBottom: 12 }}>
                    Q : {f.q}
                  </div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 14, color: "var(--txt2)", lineHeight: 1.9 }}>
                    R : {f.r}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="divider" />

        {/* ── 11. CTA FINAL ── */}
        <section style={{ textAlign: "center" }}>
          <div className="inner">
            <Ornament />
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
              fontSize: "clamp(34px, 6vw, 72px)",
              color: "#fff", margin: "0 auto 20px", maxWidth: 780, lineHeight: 1.1,
            }}>
              Tu sais déjà que cette fois, c'est différent.
            </h2>
            <p style={{
              fontFamily: "'Cormorant Garamond', serif", fontSize: 22,
              color: "var(--gold2)", margin: "0 auto 44px", maxWidth: 600, lineHeight: 1.5,
            }}>
              Le Protocole de Résistance Leptinique Silencieux.<br />
              21 jours. La taille que tu mérites depuis longtemps.
            </p>
            <a href={STRIPE_LINK} className="btn-cta">DÉCOUVRIR LE PROTOCOLE</a>
            <div className="btn-sub">17,80€ · Accès immédiat · 30 jours pour changer d'avis</div>
          </div>
        </section>

        <div className="divider" />

        {/* ── 12. FOOTER ── */}
        <footer style={{
          borderTop: "1px solid rgba(201,168,76,0.08)",
          padding: "28px 20px", textAlign: "center",
          fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 11,
          color: "var(--txt2)", opacity: 0.4, letterSpacing: 1,
        }}>
          © 2025 · La Méthode des 3% · Tous droits réservés · Mentions légales · CGV
        </footer>

      </div>
    </>
  );
}

const css = `
  :root{--bg:#080605;--bg2:#110e0b;--bg3:#1a1510;--gold:#c9a84c;--gold2:#e8c97a;--gold3:#8a6a28;--txt:#f0e6d3;--txt2:#a89070;--red:#8b0000}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{background:var(--bg);color:var(--txt);font-family:'Montserrat',sans-serif;font-weight:300;overflow-x:hidden;line-height:1.6;print-color-adjust:exact;-webkit-print-color-adjust:exact}
  a{color:inherit;text-decoration:none}
  .ornament{text-align:center;color:var(--gold);font-family:'Montserrat',sans-serif;font-size:14px;letter-spacing:8px;opacity:0.6;margin:16px 0}
  .tag{display:inline-block;font-family:'Montserrat',sans-serif;font-weight:300;font-size:10px;letter-spacing:5px;color:var(--gold);text-transform:uppercase;margin-bottom:20px;opacity:0.8}
  .divider{height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,0.3),transparent)}
  .btn-cta{display:inline-block;background:var(--gold);color:#080605;font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:3px;padding:18px 60px;border:none;cursor:pointer;transition:background 0.2s;animation:pulseCta 2.5s ease-in-out infinite}
  .btn-cta:hover{background:var(--gold2)}
  @keyframes pulseCta{0%,100%{box-shadow:0 0 40px rgba(201,168,76,0.2)}50%{box-shadow:0 0 60px rgba(201,168,76,0.4)}}
  .btn-sub{display:block;font-family:'Montserrat',sans-serif;font-weight:300;font-size:11px;color:var(--txt2);margin-top:12px;letter-spacing:1px}
  section{padding:100px 20px}
  .inner{max-width:900px;margin:0 auto}
  .grid3{display:grid;grid-template-columns:1fr;gap:28px}
  .grid2{display:grid;grid-template-columns:1fr;gap:16px}
  .stats-row{display:flex;flex-direction:column;align-items:center;gap:32px;text-align:center}
  .stat-val{font-family:'Bebas Neue',sans-serif;font-size:72px;color:var(--gold2);line-height:1}
  .stat-label{font-family:'Montserrat',sans-serif;font-weight:300;font-size:12px;letter-spacing:3px;color:var(--txt2);text-transform:uppercase;margin-top:8px;max-width:180px}
  .stat-sep{display:none}
  @media(min-width:700px){
    .grid3{grid-template-columns:repeat(3,1fr)}
    .grid2{grid-template-columns:repeat(2,1fr)}
    .stats-row{flex-direction:row;justify-content:center;gap:0;align-items:center}
    .stat-block{padding:0 48px}
    .stat-sep{display:block;width:1px;height:80px;background:rgba(201,168,76,0.2)}
  }
  @media(max-width:700px){
    section{padding:60px 16px}
    .btn-cta{padding:16px 32px;font-size:18px}
  }
  @media print{
    *{print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}
    html,body{background:var(--bg)!important}
  }
`;
