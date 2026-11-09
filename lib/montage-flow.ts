"use client";
// Étapes communes au montage des marques et à l'éditeur complet des créatrices :
// préparation automatique (analyse, calage des mots, coupe des silences, hook, style) et export de la vidéo.
import { analyzeClips, renderBrand, type ClipInfo } from "./montage-engine";
import { uploadStudioMedia } from "./direct-upload-client";
import { lookStyle, sanitizeStyle } from "./video-style.mjs";
import { silencesToKeeps, speechSilences, trimKeeps, keptDuration, proportionalWords, sourceTime } from "./video-timing.mjs";

type Lang = "fr" | "es" | "en";
type Row = Record<string, any>;
export type Word = { w: string; s: number; e: number; oi?: number };
export type Prepared = {
  clipInfo: ClipInfo[];
  base: [number, number][];
  fullBase: [number, number][];
  cutBase: [number, number][];
  words: Word[];
  voiceWords: boolean;
  hooks: string[];
  style: Row;
  stats: Row;
};

export async function studioCall(path: string, body?: any) {
  const r = await fetch("/api/studio/" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json", "X-Studio-Request": "1" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const d: any = await r.json();
  if (!r.ok) throw new Error(d.error);
  return d;
}
const tr = (lang: Lang, fr: string, es: string, en: string) => (lang === "es" ? es : lang === "en" ? en : fr);

/** Préparation automatique d'un montage. */
export async function prepareMontage({
  edit,
  client,
  musicFiles,
  lang,
  update,
  register,
}: {
  edit: Row;
  client: Row;
  musicFiles: Row[];
  lang: Lang;
  update: (m: string) => void;
  register: (c: () => void) => void;
}): Promise<Prepared> {
  const voiceFile = edit.brief?.voice?.file_id || null;
  const a = await analyzeClips(edit.clips, { update, register, lang });
  const st0 = lookStyle("mine", client.config?.videoStyle);
  const limit = Math.min(a.total, 180);
  const fullBase: [number, number][] = [[0, Math.round(a.total * 1000) / 1000]];
  let cutBase = silencesToKeeps(speechSilences(a.silences, a.clips), limit) as [number, number][];
  if (a.total > 180) cutBase = [...cutBase, [180, a.total]];
  const base = st0.rhythm.cutSilences ? cutBase : fullBase;
  const silencesCut = speechSilences(a.silences, a.clips).filter(([s, e]: number[]) => e - s > 0.3).length;
  let ws: Word[] = [],
    fromVoice = false,
    timing = "approx";
  update(tr(lang, "Calage des sous-titres sur votre voix…", "Sincronizando los subtítulos con tu voz…", "Syncing subtitles to your voice…"));
  try {
    const f = new FormData();
    f.set("edit_id", edit.id);
    f.set("request_key", crypto.randomUUID());
    if (voiceFile) f.set("source", "voice");
    else if (a.audio) {
      f.set("source", "clips");
      f.set("audio", new File([a.audio], "audio.mp3", { type: "audio/mpeg" }));
    }
    if (voiceFile || a.audio) {
      const r = await fetch("/api/studio/video-transcribe", { method: "POST", headers: { "X-Studio-Request": "1" }, body: f });
      const d = await r.json();
      if (r.ok && d.words?.length) {
        ws = d.words;
        fromVoice = !!voiceFile;
        timing = voiceFile ? "voice" : "clips";
      }
    }
  } catch {}
  if (!ws.length) {
    // Sans transcription : le texte de l'idée est réparti sur la vidéo (calage approximatif).
    const textSrc = edit.brief?.voice?.script || edit.brief?.script || "";
    ws = proportionalWords(textSrc, keptDuration(base)).map((w: Word) => ({ ...w, s: sourceTime(base, w.s), e: sourceTime(base, w.e) }));
  }
  update(tr(lang, "Écriture de votre hook…", "Escribiendo tu hook…", "Writing your hook…"));
  let hs: string[] = [];
  try {
    hs = (await studioCall("video-hooks", { edit_id: edit.id })).hooks || [];
  } catch {}
  const style = sanitizeStyle({ ...st0, hook: { ...st0.hook, text: hs[0] || "" }, music: { ...st0.music, id: musicFiles[0]?.id || null } });
  const kept = keptDuration(trimKeeps(base, style.rhythm.target || 60));
  const stats = {
    before: Math.round(a.total * 10) / 10,
    after: Math.round(Math.min(kept, 60) * 10) / 10,
    silences: st0.rhythm.cutSilences ? silencesCut : 0,
    found: silencesCut,
    saved: Math.round((a.total - keptDuration(cutBase)) * 10) / 10,
    timing,
  };
  return { clipInfo: a.clips, base, fullBase, cutBase, words: ws, voiceWords: fromVoice, hooks: hs, style, stats };
}

/** Export : rendu dans le navigateur, envoi dans « Mes vidéos » et copie sur l'appareil. */
export async function exportMontage({
  edit,
  client,
  clipInfo,
  keeps,
  words,
  style,
  lang,
  update,
  register,
}: {
  edit: Row;
  client: Row;
  clipInfo: ClipInfo[];
  keeps: [number, number][];
  words: Word[];
  style: Row;
  lang: Lang;
  update: (m: string) => void;
  register: (c: () => void) => void;
}) {
  let job: Row | null = null;
  try {
    job = await studioCall("video-render-start", { edit_id: edit.id, new_version: !!edit.output_file, extras: { brand: true } });
    const timer = window.setInterval(() => studioCall("video-render-heartbeat", { render_id: job!.id }).catch(() => {}), 60000);
    let file: File;
    try {
      file = await renderBrand(
        {
          clips: edit.clips,
          clipInfo,
          keeps,
          words,
          sourceWords: words.map((w) => ({ ...w, s: sourceTime(keeps, w.s), e: sourceTime(keeps, w.e) })),
          style,
          format: edit.brief?.format || "9:16",
          voice: edit.brief?.voice?.file_id || null,
          music: style.music?.id || null,
          target: style.rhythm?.target || 60,
        },
        { update, register, lang },
      );
    } finally {
      window.clearInterval(timer);
    }
    update(tr(lang, "Enregistrement de votre vidéo…", "Guardando tu video…", "Saving your video…"));
    const d = await uploadStudioMedia(file, { kind: "render-output", client_id: client.id, render_id: job!.id });
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = "video-" + (edit.brief?.title || "studio").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) + ".mp4";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { output: d.id as string, file };
  } catch (e: any) {
    if (job) await studioCall("video-render-fail", { render_id: job.id, error: e.message || "Montage interrompu." }).catch(() => {});
    throw e;
  }
}
