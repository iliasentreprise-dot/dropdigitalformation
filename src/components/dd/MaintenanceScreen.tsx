import { useEffect, useState } from "react";
import statue from "@/assets/maintenance-statue.jpg";
import { FERRUCCI_LAUNCH_DATE } from "@/lib/maintenance-mode";
import "../../styles/maintenance.css";

const STEPS = [
  {
    n: "01",
    k: "Programme",
    t: "Les vidéos sont entièrement recréées pour aller droit à l’essentiel. Des étapes plus simples. Une progression plus logique. Plus d’application. Moins de théorie inutile.",
  },
  {
    n: "02",
    k: "Logiciel",
    t: "Les différents outils Ferrucci sont regroupés dans une seule interface. Plus besoin de passer d’un logiciel à l’autre pour construire votre business.",
  },
  {
    n: "03",
    k: "Automatisation",
    t: "Les systèmes existants sont améliorés et de nouvelles automatisations sont intégrées pour supprimer toujours plus de tâches manuelles.",
  },
];

const HUB_FEATURES = [
  "Création de produits digitaux",
  "Génération d’E-books",
  "Création de sites",
  "Génération de contenu",
  "Carrousels TikTok",
  "Automatisation",
  "Outils IA",
  "Systèmes de vente",
  "Analytics",
];

type Remaining = { d: number; h: number; m: number; s: number; done: boolean };

function computeRemaining(): Remaining {
  const diff = FERRUCCI_LAUNCH_DATE.getTime() - Date.now();
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, done: true };
  const s = Math.floor(diff / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
    done: false,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

function Countdown() {
  const [left, setLeft] = useState<Remaining | null>(null);

  useEffect(() => {
    setLeft(computeRemaining());
    const id = setInterval(() => setLeft(computeRemaining()), 1000);
    return () => clearInterval(id);
  }, []);

  if (left?.done) {
    return (
      <div className="fr-count">
        <span className="fr-count-label">Ferrucci Système est disponible.</span>
      </div>
    );
  }

  const cells: Array<[string, number | null]> = [
    ["Jours", left ? left.d : null],
    ["Heures", left ? left.h : null],
    ["Minutes", left ? left.m : null],
    ["Secondes", left ? left.s : null],
  ];

  return (
    <div className="fr-count">
      <span className="fr-count-label">Accès à Ferrucci Système dans</span>
      <div className="fr-count-grid">
        {cells.map(([label, value], i) => (
          <div className="fr-count-cell" key={label}>
            <span className="fr-count-num">{value === null ? "––" : pad(value)}</span>
            <span className="fr-count-unit">{label}</span>
            {i < cells.length - 1 && <i className="fr-count-sep" aria-hidden="true">:</i>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MaintenanceScreen({ onResume }: { onResume?: () => void }) {
  return (
    <div className="fr-root">
      <div className="fr-grid-lines" aria-hidden="true" />
      <div className="fr-blueprint" aria-hidden="true" />
      <div className="fr-embers" aria-hidden="true">
        {Array.from({ length: 16 }).map((_, i) => (
          <span key={i} style={{ left: `${(i * 6.3) % 100}%`, animationDelay: `${i * 1.5}s`, animationDuration: `${11 + (i % 5) * 3}s` }} />
        ))}
      </div>

      <header className="fr-header">
        <div className="fr-logo">
          <span className="fr-mark">F</span>
          <span className="fr-logo-text">
            <strong>FERRUCCI</strong>
            <em>SYSTÈME</em>
          </span>
        </div>
        <div className="fr-badge">
          <i className="fr-dot" />
          TRANSFORMATION EN COURS
        </div>
      </header>

      <main className="fr-main">
        <section className="fr-hero">
          <div className="fr-hero-copy">
            <span className="fr-kicker">DigiDrop Academy — Fin d’une ère</span>
            <h1 className="fr-title">
              Une page se tourne.<br />La prochaine va <span className="fr-red">tout changer.</span>
            </h1>
            <p className="fr-sub">
              DigiDrop Academy était la première étape. Elle nous a permis de poser les fondations,
              de vous accompagner dans vos premiers produits digitaux et de construire avec vous les
              premiers outils de l’écosystème.
            </p>
            <p className="fr-sub">
              Mais aujourd’hui, ces fondations ne suffisent plus à la vision que nous avons pour la
              suite. Ces dernières semaines, nous avons repris le programme presque entièrement :
              les vidéos sont recréées, les logiciels sont améliorés et l’expérience complète est
              reconstruite autour d’un seul objectif : vous permettre d’aller plus vite, avec
              beaucoup moins de friction.
            </p>
            <p className="fr-statement">
              Ce n’est pas une simple mise à jour.<br />
              C’est la naissance d’un nouveau système.
            </p>

            <div className="fr-progress">
              <span className="fr-progress-label">Reconstruction de Ferrucci Système en cours</span>
              <div className="fr-progress-track"><div className="fr-progress-bar" /></div>
            </div>
          </div>

          <figure className="fr-hero-visual">
            <img src={statue} alt="Statue romaine entourée d’échafaudages, architecture en construction" width={1280} height={1600} />
            <div className="fr-visual-scan" aria-hidden="true" />
            <div className="fr-visual-fade" aria-hidden="true" />
          </figure>
        </section>

        <section className="fr-panel">
          <span className="fr-eyebrow">Nous vous devons une meilleure expérience.</span>
          <p>
            Nous savons que certains d’entre vous ont pu rencontrer des bugs, des outils encore
            imparfaits, des changements ou des périodes pendant lesquelles le programme n’avançait
            pas aussi vite qu’il aurait dû.
          </p>
          <p>
            Plutôt que de continuer à empiler des correctifs sur une plateforme qui ne correspondait
            plus à notre vision, nous avons pris une décision : reprendre les fondations.
          </p>
          <p className="fr-manifesto">
            Refaire les contenus.<br />
            Améliorer les logiciels.<br />
            Simplifier l’expérience.<br />
            Et réunir tout l’écosystème au même endroit.
          </p>
          <p>
            Merci à ceux qui sont là depuis le début. Les membres actuels n’auront rien à racheter :
            toutes les améliorations de Ferrucci Système seront automatiquement incluses dans leur
            accès.
          </p>
        </section>

        <section className="fr-panel fr-panel-end">
          <span className="fr-eyebrow">Fin de DigiDrop Academy</span>
          <p>
            DigiDrop Academy, dans sa version actuelle, sera retirée dans 7 jours pour laisser
            définitivement place à Ferrucci Système.
          </p>
          <p>
            Pendant ces 7 prochains jours, vous pouvez toujours reprendre vos modules, revoir les
            vidéos disponibles et récupérer vos ressources.
          </p>

          {onResume && (
            <div className="fr-cta-wrap">
              <button type="button" className="fr-resume" onClick={onResume}>
                J'ai lu — Reprendre le programme
              </button>
              <span className="fr-cta-note">Disponible encore pendant 7 jours.</span>
            </div>
          )}

          <Countdown />
        </section>

        <section className="fr-eco">
          <span className="fr-kicker">Ferrucci Système — Nouvelle génération</span>
          <h2 className="fr-h2">
            Un seul logiciel.<br />Un seul <span className="fr-red">écosystème.</span>
          </h2>
          <p className="fr-sub fr-sub-wide">
            Jusqu’ici, plusieurs outils étaient séparés. Ferrucci Système va réunir tout
            l’écosystème dans une seule plateforme. Votre formation. Vos outils. Votre création de
            contenu. Vos automatisations. Vos produits digitaux. Vos données. Votre système de
            vente. Tout au même endroit.
          </p>

          <div className="fr-hub">
            <div className="fr-hub-core">
              <span className="fr-hub-core-title">FERRUCCI</span>
              <span className="fr-hub-core-sub">Dashboard</span>
              <i className="fr-hub-ring" aria-hidden="true" />
              <i className="fr-hub-ring fr-hub-ring-2" aria-hidden="true" />
            </div>
            <ul className="fr-hub-list">
              {HUB_FEATURES.map((f) => (
                <li key={f} className="fr-hub-node">
                  <i className="fr-hub-line" aria-hidden="true" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="fr-steps">
          {STEPS.map((s, i) => (
            <article className="fr-step" key={s.n} style={{ animationDelay: `${0.15 * i}s` }}>
              <span className="fr-step-n">{s.n}</span>
              <h2>{s.k}</h2>
              <p>{s.t}</p>
              <i className="fr-step-build" />
            </article>
          ))}
        </section>

        <section className="fr-statement-block">
          <p className="fr-kicker">Ton idée ne devrait pas rester une idée.</p>
          <h2 className="fr-mega">
            Transforme-la en <span className="fr-red">machine à cash.</span>
          </h2>
          <p className="fr-sub fr-sub-center">
            Ferrucci Système réunit les outils, l’IA et les automatisations nécessaires pour passer
            d’une idée à un produit, d’un produit à du contenu, et du contenu à un véritable système
            de vente.
          </p>
        </section>

        <section className="fr-members">
          <h2 className="fr-members-title">Déjà membre de DigiDrop Academy ?</h2>
          <p>
            Votre accès sera automatiquement transféré vers Ferrucci Système.<br />
            Aucun nouvel achat.<br />
            Aucun supplément.
          </p>
          <p className="fr-members-highlight">Vous faites déjà partie de la suite.</p>
        </section>

        <section className="fr-outro">
          <h2 className="fr-thanks">Merci pour votre confiance et votre patience.</h2>
          <p className="fr-note fr-note-block">
            Nous aurions pu continuer à ajouter quelques fonctionnalités à l’ancienne plateforme.
            Nous avons préféré reconstruire quelque chose à la hauteur de la vision.
            <br />
            Même équipe. Même vision. Un système beaucoup plus grand.
          </p>
          <p className="fr-sign">— Ferrucci Système</p>
          <p className="fr-tagline">Des idées d’aujourd’hui.<br />Des revenus de demain.</p>
        </section>
      </main>
    </div>
  );
}

export default MaintenanceScreen;
