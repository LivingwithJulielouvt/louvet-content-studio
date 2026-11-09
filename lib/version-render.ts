"use client";
// « Versions à tester » : préparation unique de la vidéo source (analyse, silences, mots), puis rendu des versions
// une par une dans le navigateur (FFmpeg WebAssembly), chacune envoyée dans l'espace privé dès qu'elle est prête.
import { prepareMontage, studioCall, type Word } from "./montage-flow";
import { renderBrand, type ClipInfo } from "./montage-engine";
import { uploadStudioMedia } from "./direct-upload-client";
import { sanitizeStyle, lookStyle } from "./video-style.mjs";
import { remapWords, sourceTime, keptDuration } from "./video-timing.mjs";
import { versionKeeps, versionStyle } from "./test-versions.mjs";

type Lang = "fr" | "es" | "en";
type Row = Record<string, any>;
const tr = (lang: Lang, fr: string, es: string, en: string) => (lang === "es" ? es : lang === "en" ? en : fr);

export type Source = {
  clips: string[];
  base: [number, number][];
  total: number;
  clipInfo: ClipInfo[];
  words: Word[];
  style: Row;
  hooks: string[];
};

/** Prépare la source une seule fois : réutilise la préparation déjà enregistrée d'un montage quand elle existe. */
export async function prepareSource({
  edit,
  clips,
  client,
  musicFiles,
  lang,
  update,
  register,
}: {
  edit: Row | null;
  clips: string[];
  client: Row;
  musicFiles: Row[];
  lang: Lang;
  update: (m: string) => void;
  register: (c: () => void) => void;
}): Promise<Source> {
  const saved = edit?.brief?.brand;
  if (saved?.clipInfo?.length && (saved.cutBase?.length || saved.base?.length) && !saved.voiceWords) {
    const total = saved.clipInfo.reduce((n: number, c: ClipInfo) => n + c.duration, 0);
    return {
      clips,
      base: saved.cutBase?.length ? saved.cutBase : saved.base,
      total,
      clipInfo: saved.clipInfo,
      words: saved.words || [],
      style: saved.style || lookStyle("mine", client.config?.videoStyle),
      hooks: saved.hooks || [],
    };
  }
  const pseudo = edit ? { ...edit, clips } : { id: "", clips, brief: {} };
  const p = await prepareMontage({ edit: pseudo, client, musicFiles, lang, update, register });
  const total = p.clipInfo.reduce((n, c) => n + c.duration, 0);
  // Une voix off enregistrée suit son propre calage : les versions gardent le son des rushes et des sous-titres approximatifs.
  return { clips, base: p.cutBase, total, clipInfo: p.clipInfo, words: p.voiceWords ? [] : p.words, style: p.style, hooks: p.hooks };
}

/** Accroches supplémentaires (IA si elle est activée, sinon celles déjà proposées) pour une vidéo de « Mes vidéos ». */
export async function moreHooks(editId: string | null, have: string[], count: number) {
  const out = [...have];
  if (!editId) return out;
  for (let i = 0; i < 4 && out.length < count; i++) {
    try {
      const d = await studioCall("video-hooks", { edit_id: editId, avoid: out.slice(-9) });
      const fresh = (d.hooks || []).filter((h: string) => !out.includes(h));
      if (!fresh.length) break;
      out.push(...fresh);
    } catch {
      break;
    }
  }
  return out;
}

/** Rendu et envoi d'une version. */
export async function renderVersion({
  source,
  version,
  client,
  coverTitle,
  lang,
  update,
  register,
}: {
  source: Source;
  version: Row;
  client: Row;
  coverTitle: string;
  lang: Lang;
  update: (m: string) => void;
  register: (c: () => void) => void;
}) {
  const r = version.recipe;
  const keeps = versionKeeps(source.base, source.total, r) as [number, number][];
  const indexed = source.words.map((w, i) => ({ ...w, oi: i }));
  const words = remapWords(indexed, keeps) as Word[];
  const style = sanitizeStyle(versionStyle(source.style, r, coverTitle));
  const file = await renderBrand(
    {
      clips: source.clips,
      clipInfo: source.clipInfo,
      keeps,
      words,
      sourceWords: words.map((w) => ({ ...w, s: sourceTime(keeps, w.s), e: sourceTime(keeps, w.e) })),
      style,
      format: "9:16",
      voice: null,
      music: r.music || null,
      target: Math.min(60, keptDuration(keeps)),
    },
    { update, register, lang },
  );
  update(tr(lang, `Enregistrement de la version ${version.label}…`, `Guardando la versión ${version.label}…`, `Saving version ${version.label}…`));
  const named = new File([file], `version-${version.label}.mp4`, { type: "video/mp4" });
  const d = await uploadStudioMedia(named, { kind: "test-version", client_id: client.id, version_id: version.id });
  return { id: d.id as string, file: named };
}
