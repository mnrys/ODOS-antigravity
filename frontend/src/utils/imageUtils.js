/**
 * Utilitaires pour le traitement et l'affichage des images/photos dans ODOS.
 * Supporte aussi bien les URLs web (ex: Unsplash, Pexels) que les fichiers stockés en local (/uploads/...).
 */

export function getPhotoUrl(path) {
  if (!path || typeof path !== 'string') return null;
  const trimmed = path.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return trimmed;
  }
  return `/${trimmed}`;
}
