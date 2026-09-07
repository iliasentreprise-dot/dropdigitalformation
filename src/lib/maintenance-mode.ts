/**
 * Écran de transformation Ferrucci Système.
 * Mettre à `false` pour rendre la plateforme de nouveau accessible.
 */
export const MAINTENANCE_MODE = true;

/** Chemins toujours accessibles même pendant la transformation. */
export const MAINTENANCE_ALLOWLIST = ["/maintenance"];

/**
 * Date d'ouverture de Ferrucci Système (UTC).
 * Identique pour tous les utilisateurs : le compte à rebours ne se réinitialise
 * jamais au rafraîchissement. Modifier uniquement cette ligne pour décaler le lancement.
 */
export const FERRUCCI_LAUNCH_DATE = new Date("2026-09-14T14:00:00Z");

/** Clé localStorage : l'utilisateur a choisi de reprendre le programme DropDigital. */
export const MAINTENANCE_BYPASS_KEY = "dd-bypass-maintenance";

export function hasMaintenanceBypass(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MAINTENANCE_BYPASS_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMaintenanceBypass(): void {
  try {
    window.localStorage.setItem(MAINTENANCE_BYPASS_KEY, "1");
  } catch {
    /* ignore */
  }
}
