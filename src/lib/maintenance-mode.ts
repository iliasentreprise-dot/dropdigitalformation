/**
 * Écran de transformation Ferrucci Système.
 * Mettre à `false` pour rendre la plateforme de nouveau accessible.
 */
export const MAINTENANCE_MODE = true;

/** Chemins toujours accessibles même pendant la transformation. */
export const MAINTENANCE_ALLOWLIST = ["/maintenance"];

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
