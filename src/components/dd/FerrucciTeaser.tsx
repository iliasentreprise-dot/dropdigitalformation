import { Link } from "@tanstack/react-router";

/**
 * Teaser « Ferrucci Système arrive » affiché dans la plateforme.
 * Bannière cinématique noir/rouge, sans date ni pourcentage.
 */
export function FerrucciTeaser() {
  return (
    <Link to="/maintenance" className="frx-banner" aria-label="Découvrir la transformation Ferrucci Système">
      <span className="frx-banner-dot" aria-hidden="true" />
      <span className="frx-banner-text">
        <strong>FERRUCCI SYSTÈME</strong>
        <em>La nouvelle génération de la plateforme est en construction — programme, logiciel et automatisation réunis.</em>
      </span>
      <span className="frx-banner-cta">Découvrir →</span>
      <span className="frx-banner-glow" aria-hidden="true" />
    </Link>
  );
}

export default FerrucciTeaser;
