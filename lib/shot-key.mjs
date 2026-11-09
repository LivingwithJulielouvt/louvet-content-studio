/**
 * Banque de plans : deux montages qui demandent le même plan (ex. « une bougie allumée près de la fenêtre »)
 * partagent la même clé. La clé ignore le minutage (« 0–3 s · »), les majuscules, les accents et la ponctuation.
 */
export function shotKey(scene) {
  return String(scene || "")
    .replace(/^\s*\d+(?:[.,]\d+)?\s*[–—-]\s*\d+(?:[.,]\d+)?\s*s(?:ec(?:ondes|onds|undos)?)?\s*[·:.—-]?\s*/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 300);
}
/** Les six premiers plans d'une idée, comme dans la fiche de tournage. */
export function ideaScenes(content = {}) {
  return (Array.isArray(content.scenes) ? content.scenes : []).filter(Boolean).slice(0, 6);
}
/** Durée de montage acceptée par le moteur (15, 30 ou 60 s) la plus proche de la durée de l'idée. */
export function montageDuration(value) {
  const n = Number(String(value || "").match(/\d+/)?.[0] || 30);
  return n <= 20 ? 15 : n <= 45 ? 30 : 60;
}
