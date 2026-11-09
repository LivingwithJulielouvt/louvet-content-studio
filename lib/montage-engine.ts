"use client";
// Moteur du montage automatique des marques, dans le navigateur (FFmpeg WebAssembly) :
// analyse des rushes (piste audio légère + silences) puis rendu final avec sous-titres animés.
import { analysisAudioArgs, silenceArgs, segmentArgs, joinArgs, brandASS, brandFinishArgs, fontsFor, dimensions, sfxEvents } from "./video-render.mjs";
import { parseSilences, buildPlan, keptDuration } from "./video-timing.mjs";

type Lang = "fr" | "es" | "en";
type Ctx = { update: (m: string) => void; register: (cancel: () => void) => void; lang: Lang };
export type ClipInfo = { duration: number; audio: boolean };
export type Analysis = { clips: ClipInfo[]; total: number; silences: [number, number][]; audio: Blob | null };

const MAX_ANALYSIS_SECONDS = 180;

async function engine({ update, register, lang }: Ctx) {
  const tr = (fr: string, es: string, en: string) => (lang === "es" ? es : lang === "en" ? en : fr);
  const moduleURL = "/media-engine/index.js";
  const { FFmpeg } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ moduleURL);
  const ff = new FFmpeg();
  const controller = new AbortController();
  let cancelled = false;
  register(() => {
    cancelled = true;
    controller.abort();
    ff.terminate();
  });
  const get = (url: string) => fetch(url, { signal: controller.signal });
  const stopped = () => tr("Montage arrêté.", "Edición detenida.", "Editing stopped.");
  update(tr("Chargement du moteur de montage…", "Cargando el editor de video…", "Loading the video editor…"));
  const manifest: any = await get("/media-engine/manifest.json").then((r) => {
    if (!r.ok) throw new Error(tr("Moteur indisponible.", "Editor no disponible.", "Editor unavailable."));
    return r.json();
  });
  const chunks: BlobPart[] = [];
  for (const name of manifest.chunks) {
    const r = await get("/media-engine/" + name);
    if (!r.ok) throw new Error(tr("Chargement du moteur interrompu.", "La carga del editor se interrumpió.", "Loading the editor was interrupted."));
    chunks.push(await r.arrayBuffer());
  }
  const wasmURL = URL.createObjectURL(new Blob(chunks, { type: "application/wasm" }));
  if (cancelled) throw new Error(stopped());
  await ff.load({ classWorkerURL: location.origin + "/media-engine/worker.js", coreURL: location.origin + "/media-engine/ffmpeg-core.js", wasmURL });
  URL.revokeObjectURL(wasmURL);
  if (cancelled) throw new Error(stopped());
  let log = "";
  ff.on("log", ({ message }: { message: string }) => {
    log += message + "\n";
    if (log.length > 400000) log = log.slice(-200000);
  });
  const exec = async (args: string[]) => {
    const code = await ff.exec(args, 10 * 60 * 1000);
    if (code !== 0)
      throw new Error(
        tr(
          "Le moteur ne peut pas monter ce fichier. Essayez une vidéo plus courte au format MP4 ou demandez l’aide de l’agence.",
          "El editor no puede procesar este archivo. Prueba con un video más corto en formato MP4 o pide ayuda a la agencia.",
          "The editor can’t process this file. Try a shorter MP4 video or ask the agency for help.",
        ),
      );
  };
  async function loadClips(ids: string[]) {
    const clips: ClipInfo[] = [];
    let bytes = 0;
    for (let i = 0; i < ids.length; i++) {
      update(tr(`Lecture de la vidéo ${i + 1}/${ids.length}…`, `Leyendo el video ${i + 1}/${ids.length}…`, `Reading clip ${i + 1}/${ids.length}…`));
      const r = await get("/api/studio/file/" + encodeURIComponent(ids[i]));
      if (!r.ok) throw new Error(tr("Une de vos vidéos n’est plus accessible.", "Uno de tus videos ya no está disponible.", "One of your videos is no longer available."));
      const data = new Uint8Array(await r.arrayBuffer());
      bytes += data.byteLength;
      if (bytes > 120 * 1024 * 1024)
        throw new Error(
          tr(
            "Réduisez les petites vidéos à 120 Mo au total pour le montage sur cet appareil.",
            "Reduce tus videos cortos a 120 MB en total para editarlos en este dispositivo.",
            "Keep your short videos under 120 MB in total to edit them on this device.",
          ),
        );
      await ff.writeFile("source-" + i, data);
      await ff.ffprobe(["-v", "error", "-show_streams", "-show_format", "-of", "json", "-o", "meta.json", "source-" + i]);
      const info = JSON.parse(await ff.readFile("meta.json", "utf8"));
      const duration = Number(info.format?.duration);
      if (!Number.isFinite(duration) || duration <= 0 || !info.streams?.some((s: any) => s.codec_type === "video"))
        throw new Error(tr("Ce fichier ne peut pas être lu. Essayez une autre vidéo.", "No se puede leer este archivo. Prueba con otro video.", "This file can’t be read. Try another video."));
      clips.push({ duration, audio: info.streams.some((s: any) => s.codec_type === "audio") });
    }
    return clips;
  }
  return { ff, exec, get, tr, loadClips, takeLog: () => ((log = ""), undefined), readLog: () => log, cancelled: () => cancelled };
}

/** Étape « Votre vidéo est prête » : piste audio d'analyse et silences. */
export async function analyzeClips(ids: string[], ctx: Ctx): Promise<Analysis> {
  const e = await engine(ctx);
  try {
    const clips = await e.loadClips(ids);
    const total = clips.reduce((n, c) => n + c.duration, 0);
    if (!clips.some((c) => c.audio)) return { clips, total, silences: [], audio: null };
    ctx.update(e.tr("Écoute de votre voix…", "Escuchando tu voz…", "Listening to your voice…"));
    const limited = clips.map((c) => ({ ...c }));
    let left = MAX_ANALYSIS_SECONDS;
    for (const c of limited) {
      c.duration = Math.max(0.1, Math.min(c.duration, left));
      left = Math.max(0.1, left - c.duration);
    }
    await e.exec(analysisAudioArgs(limited));
    e.takeLog();
    await e.exec(silenceArgs());
    const silences = parseSilences(e.readLog(), Math.min(total, MAX_ANALYSIS_SECONDS)) as [number, number][];
    const mp3 = await e.ff.readFile("analysis.mp3");
    return { clips, total, silences, audio: new Blob([mp3 as BlobPart], { type: "audio/mpeg" }) };
  } finally {
    e.ff.terminate();
  }
}

/** Rend un emoji en PNG transparent (taille en pixels) avec le canvas du navigateur. */
export async function emojiPng(char: string, px = 256): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("canvas");
  g.clearRect(0, 0, px, px);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `${Math.round(px * 0.8)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  g.fillText(char, px / 2, px / 2 + px * 0.04);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

export type BrandJob = {
  clips: string[];
  clipInfo: ClipInfo[];
  keeps: [number, number][];
  words: { w: string; s: number; e: number }[]; // temps de la vidéo finale
  sourceWords: { w: string; s: number; e: number }[]; // temps des rushes (pour les zooms)
  style: any;
  format: string;
  voice?: string | null;
  music?: string | null;
  target?: number | null;
};
/** Rendu final du montage des marques. */
export async function renderBrand(job: BrandJob, ctx: Ctx): Promise<File> {
  const e = await engine(ctx);
  try {
    await e.loadClips(job.clips);
    const plan = buildPlan(job.keeps, job.clipInfo.map((c) => c.duration), job.clipInfo.map((c) => c.audio), job.style, job.sourceWords);
    const settings = { format: job.format, transition: "cut", originalAudio: true };
    for (let i = 0; i < plan.length; i++) {
      ctx.update(e.tr(`Préparation du passage ${i + 1}/${plan.length}…`, `Preparando el fragmento ${i + 1}/${plan.length}…`, `Preparing passage ${i + 1}/${plan.length}…`));
      await e.exec(segmentArgs({ ...plan[i], fill: true }, i, settings));
    }
    await e.ff.writeFile("shots.txt", new TextEncoder().encode(plan.map((_: any, i: number) => `file 'shot-${i}.mp4'`).join("\n")));
    ctx.update(e.tr("Assemblage de vos vidéos…", "Uniendo tus videos…", "Putting your videos together…"));
    await e.exec(joinArgs());
    const duration = Math.min(keptDuration(job.keeps), job.target || 60);
    const subtitles = job.words.length > 0 || !!job.style.hook?.text || !!job.style.outro?.text || !!job.style.titles?.length;
    if (subtitles) {
      ctx.update(e.tr("Ajout des sous-titres…", "Agregando los subtítulos…", "Adding the subtitles…"));
      await e.ff.writeFile("words.ass", new TextEncoder().encode(brandASS(job.words, job.style, { format: job.format, duration })));
      await e.ff.createDir("fonts");
      for (const f of fontsFor(job.style)) {
        const r = await e.get("/media-engine/fonts/" + f);
        if (!r.ok) throw new Error(e.tr("Police des sous-titres indisponible.", "La fuente de los subtítulos no está disponible.", "The subtitle font is unavailable."));
        await e.ff.writeFile("fonts/" + f, new Uint8Array(await r.arrayBuffer()));
      }
    }
    if (job.voice) {
      ctx.update(e.tr("Ajout de la voix off…", "Agregando la voz en off…", "Adding the voiceover…"));
      const r = await e.get("/api/studio/file/" + encodeURIComponent(job.voice));
      if (!r.ok) throw new Error(e.tr("La voix off n’est plus disponible. Créez-la à nouveau.", "La voz en off ya no está disponible. Créala de nuevo.", "The voiceover is no longer available. Please create it again."));
      await e.ff.writeFile("voice.mp3", new Uint8Array(await r.arrayBuffer()));
    }
    if (job.music) {
      const r = await e.get("/api/studio/file/" + encodeURIComponent(job.music));
      if (!r.ok) throw new Error(e.tr("La musique n’est plus disponible.", "La música ya no está disponible.", "The music is no longer available."));
      await e.ff.writeFile("music", new Uint8Array(await r.arrayBuffer()));
    }
    // Stickers : emoji rendu en PNG ou PNG de la créatrice, écrits dans le moteur.
    const stickers = (job.style.stickers || []).filter((x: any) => x.s < duration);
    if (stickers.length) ctx.update(e.tr("Ajout des stickers…", "Agregando los stickers…", "Adding the stickers…"));
    for (let k = 0; k < stickers.length; k++) {
      const st = stickers[k];
      let png: Uint8Array;
      if (st.kind === "png") {
        const r = await e.get("/api/studio/file/" + encodeURIComponent(st.file_id));
        if (!r.ok) throw new Error(e.tr("Un sticker n’est plus disponible.", "Un sticker ya no está disponible.", "A sticker is no longer available."));
        png = new Uint8Array(await r.arrayBuffer());
      } else png = await emojiPng(st.char, 256);
      await e.ff.writeFile(`sticker-${k}.png`, png);
    }
    const events = sfxEvents({ ...job.style, stickers }).filter((t: number) => t < duration);
    ctx.update(e.tr("Création de votre fichier vidéo…", "Creando tu archivo de video…", "Creating your video file…"));
    await e.exec(
      brandFinishArgs({
        subtitles,
        voice: !!job.voice,
        music: !!job.music,
        duck: job.style.music?.duck !== false,
        musicVolume: job.style.music?.volume ?? 0.35,
        duration,
        stickers,
        dims: dimensions(job.format),
        sfx: events.length ? { events, kind: job.style.sfxKind, volume: job.style.sfxVolume ?? 0.6 } : null,
      }),
    );
    const bytes = await e.ff.readFile("final.mp4");
    return new File([bytes as BlobPart], "ma-video.mp4", { type: "video/mp4" });
  } finally {
    e.ff.terminate();
  }
}

/** Atelier « Modèles » : vidéo avant / après (dévoilement de gauche à droite), à partir de deux images préparées dans le canvas. */
export async function renderBeforeAfter(before: Blob, after: Blob, size: { width: number; height: number }, ctx: Ctx): Promise<File> {
  const { beforeAfterArgs } = await import("./templates.mjs");
  const e = await engine(ctx);
  try {
    await e.ff.writeFile("before.png", new Uint8Array(await before.arrayBuffer()));
    await e.ff.writeFile("after.png", new Uint8Array(await after.arrayBuffer()));
    ctx.update(e.tr("Création de la vidéo avant / après…", "Creando el video antes / después…", "Creating the before / after video…"));
    await e.exec(beforeAfterArgs(size));
    const bytes = await e.ff.readFile("beforeafter.mp4");
    return new File([bytes as BlobPart], "avant-apres.mp4", { type: "video/mp4" });
  } finally {
    e.ff.terminate();
  }
}
