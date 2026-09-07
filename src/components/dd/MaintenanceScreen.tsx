import statue from "@/assets/maintenance-statue.jpg";
import "../../styles/maintenance.css";

const STEPS = [
  { n: "01", k: "Programme", t: "Des vidéos entièrement recréées, plus simples, plus structurées et orientées action." },
  { n: "02", k: "Logiciel", t: "Tous les outils Ferrucci réunis dans une seule interface centralisée." },
  { n: "03", k: "Automatisation", t: "Des systèmes améliorés et peaufinés pour automatiser toujours plus de tâches." },
];

export function MaintenanceScreen({ onResume }: { onResume?: () => void }) {
  return (
    <div className="fr-root">
      <div className="fr-grid-lines" aria-hidden="true" />
      <div className="fr-blueprint" aria-hidden="true" />
      <div className="fr-embers" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} style={{ left: `${(i * 7.3) % 100}%`, animationDelay: `${i * 1.7}s`, animationDuration: `${11 + (i % 5) * 3}s` }} />
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
            <h1 className="fr-title">
              Nous construisons<br />quelque chose de <span className="fr-red">plus grand.</span>
            </h1>
            <p className="fr-sub">
              Ferrucci Système évolue actuellement en profondeur. Les vidéos du programme sont
              entièrement recréées, les logiciels sont améliorés et toute l’expérience est repensée
              pour devenir plus simple, plus rapide et plus puissante.
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
          <span className="fr-eyebrow">Ferrucci Système — Nouvelle génération</span>
          <p>
            Vous aurez prochainement accès à une version entièrement améliorée du programme.
            Au lieu de naviguer entre plusieurs logiciels et outils séparés, Ferrucci Système
            réunira désormais tout l’écosystème dans une seule plateforme centralisée.
          </p>
          <p>
            Création de produits digitaux, génération de contenu, automatisation, outils IA et
            systèmes de vente seront regroupés au même endroit.
          </p>
          <p className="fr-manifesto">
            Un seul logiciel.<br />
            Un seul écosystème.<br />
            Tout ce qu’il faut pour transformer une idée en véritable système digital.
          </p>
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

        <section className="fr-outro">
          <p className="fr-note">
            Les membres actuels auront automatiquement accès à toutes les améliorations dès leur déploiement.
          </p>
          <p className="fr-thanks">
            Merci pour votre patience.<br />
            Nous préférons prendre le temps de construire quelque chose d’exceptionnel plutôt que
            de simplement ajouter quelques mises à jour.
          </p>
          <p className="fr-sign">— Ferrucci Système</p>
        </section>
      </main>
    </div>
  );
}

export default MaintenanceScreen;
