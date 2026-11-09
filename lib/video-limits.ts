// Limite d'une petite vidéo envoyée au studio (le stockage accepte 50 Mo par fichier).
import { pick, type Lang } from "./i18n";
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
/** Message clair quand une vidéo de téléphone est trop lourde, avec une solution concrète. */
export function videoTooBig(lang: Lang) {
  return pick(
    lang,
    "Cette vidéo est trop lourde (50 Mo max). Sur iPhone : Réglages > Appareil photo > Enregistrement vidéo > 1080p, puis refilmez. Ou envoyez-la à l’agence avec « Écrire à l’agence ».",
    "Este video pesa demasiado (máx. 50 MB). En iPhone: Ajustes > Cámara > Grabar video > 1080p, y vuelve a grabar. O envíalo a la agencia con «Escribir a la agencia».",
    "This video is too large (50 MB max). On iPhone: Settings > Camera > Record Video > 1080p, then film again. Or send it to the agency with “Message the agency”.",
  );
}
