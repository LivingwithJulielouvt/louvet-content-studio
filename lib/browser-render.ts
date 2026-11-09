import { planShots, segmentArgs, joinArgs, finishArgs, subtitleASS, autoSubtitleSRT } from "./video-render.mjs";
type Extras = {
  subtitles?: File | null;
  logo?: File | null;
  music?: File | null;
  // Sous-titres automatiques : texte à découper et à caler sur la voix off (ou sur la vidéo).
  autoSubtitleText?: string;
};
export async function renderVideo(
  job: any,
  extras: Extras,
  update: (message: string) => void,
  register: (cancel: () => void) => void,
  lang: "fr" | "es" | "en" = "fr",
) {
  const tr = (fr: string, es: string, en: string) => (lang === "es" ? es : lang === "en" ? en : fr);
  const moduleURL = "/media-engine/index.js";
  const { FFmpeg } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ moduleURL);
  const ff = new FFmpeg();
  let wasmURL = "";
  const controller = new AbortController();
  let cancelled = false;
  register(() => {
    cancelled = true;
    controller.abort();
    ff.terminate();
  });
  const get = (url: string) => fetch(url, { signal: controller.signal });
  async function execute(args: string[]) {
    const result = await ff.exec(args, 10 * 60 * 1000);
    if (result !== 0)
      throw new Error(
        tr(
          "Le moteur ne peut pas monter ce fichier. Essayez une vidéo plus courte au format MP4 ou demandez l’aide de l’agence.",
          "El editor no puede procesar este archivo. Prueba con un video más corto en formato MP4 o pide ayuda a la agencia.",
          "The editor can’t process this file. Try a shorter MP4 video or ask the agency for help.",
        ),
      );
  }
  try {
    update(tr("Chargement du moteur de montage…", "Cargando el editor de video…", "Loading the video editor…"));
    const manifest: any = await get("/media-engine/manifest.json").then((r) => {
      if (!r.ok) throw new Error(tr("Moteur indisponible.", "Editor no disponible.", "Editor unavailable."));
      return r.json();
    });
    const chunks: BlobPart[] = [];
    for (const name of manifest.chunks) {
      const r = await get("/media-engine/" + name);
      if (!r.ok)
        throw new Error(
          tr(
            "Chargement du moteur interrompu.",
            "La carga del editor se interrumpió.",
            "Loading the editor was interrupted.",
          ),
        );
      chunks.push(await r.arrayBuffer());
    }
    wasmURL = URL.createObjectURL(new Blob(chunks, { type: "application/wasm" }));
    if (cancelled) throw new Error(tr("Montage arrêté.", "Edición detenida.", "Editing stopped."));
    await ff.load({
      classWorkerURL: location.origin + "/media-engine/worker.js",
      coreURL: location.origin + "/media-engine/ffmpeg-core.js",
      wasmURL,
    });
    if (cancelled) {
      ff.terminate();
      throw new Error(tr("Montage arrêté.", "Edición detenida.", "Editing stopped."));
    }
    URL.revokeObjectURL(wasmURL);
    wasmURL = "";
    const metadata = [];
    let totalBytes = 0;
    for (let i = 0; i < job.clips.length; i++) {
      update(
        tr(
          `Vérification de la petite vidéo ${i + 1}/${job.clips.length}…`,
          `Revisando el video ${i + 1}/${job.clips.length}…`,
          `Checking clip ${i + 1}/${job.clips.length}…`,
        ),
      );
      const r = await get("/api/studio/file/" + encodeURIComponent(job.clips[i]));
      if (!r.ok)
        throw new Error(
          tr(
            "Une de vos vidéos n’est plus accessible.",
            "Uno de tus videos ya no está disponible.",
            "One of your videos is no longer available.",
          ),
        );
      const data = new Uint8Array(await r.arrayBuffer());
      totalBytes += data.byteLength;
      if (totalBytes > 120 * 1024 * 1024)
        throw new Error(
          tr(
            "Réduisez les petites vidéos à 120 Mo au total pour le montage sur cet appareil.",
            "Reduce tus videos cortos a 120 MB en total para editarlos en este dispositivo.",
            "Keep your short videos under 120 MB in total to edit them on this device.",
          ),
        );
      await ff.writeFile("source-" + i, data);
      await ff.ffprobe([
        "-v",
        "error",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        "-o",
        "metadata.json",
        "source-" + i,
      ]);
      const info = JSON.parse(await ff.readFile("metadata.json", "utf8")),
        duration = Number(info.format?.duration);
      if (!Number.isFinite(duration) || duration <= 0 || !info.streams?.some((s: any) => s.codec_type === "video"))
        throw new Error(
          tr(
            "Ce fichier ne peut pas être lu. Essayez une autre vidéo.",
            "No se puede leer este archivo. Prueba con otro video.",
            "This file can’t be read. Try another video.",
          ),
        );
      metadata.push({
        duration,
        audio: info.streams.some((s: any) => s.codec_type === "audio"),
      });
    }
    const shots = planShots(metadata, job.settings);
    for (let i = 0; i < shots.length; i++) {
      update(
        tr(
          `Préparation du passage ${i + 1}/${shots.length}…`,
          `Preparando el fragmento ${i + 1}/${shots.length}…`,
          `Preparing passage ${i + 1}/${shots.length}…`,
        ),
      );
      await execute(segmentArgs(shots[i], i, job.settings));
    }
    await ff.writeFile(
      "shots.txt",
      new TextEncoder().encode(shots.map((_: any, i: number) => `file 'shot-${i}.mp4'`).join("\n")),
    );
    update(tr("Assemblage de vos vidéos…", "Uniendo tus videos…", "Putting your videos together…"));
    await execute(joinArgs());
    const videoSeconds = Math.min(
      job.settings.duration,
      shots.reduce((n: number, s: any) => n + s.duration, 0),
    );
    let voiceSeconds = 0;
    if (job.settings.voice) {
      update(tr("Ajout de la voix off…", "Agregando la voz en off…", "Adding the voiceover…"));
      if (!job.voice)
        throw new Error(
          tr(
            "La voix off n’est plus disponible. Créez-la à nouveau.",
            "La voz en off ya no está disponible. Créala de nuevo.",
            "The voiceover is no longer available. Please create it again.",
          ),
        );
      const r = await get("/api/studio/file/" + encodeURIComponent(job.voice));
      if (!r.ok)
        throw new Error(
          tr(
            "La voix off n’est plus disponible. Créez-la à nouveau.",
            "La voz en off ya no está disponible. Créala de nuevo.",
            "The voiceover is no longer available. Please create it again.",
          ),
        );
      await ff.writeFile("voice.mp3", new Uint8Array(await r.arrayBuffer()));
      await ff.ffprobe(["-v", "error", "-show_format", "-of", "json", "-o", "voice.json", "voice.mp3"]);
      voiceSeconds = Number(JSON.parse(await ff.readFile("voice.json", "utf8")).format?.duration) || 0;
    }
    if (job.settings.subtitles) {
      let srt = "";
      if (extras.subtitles) srt = await extras.subtitles.text();
      else if (extras.autoSubtitleText)
        srt = autoSubtitleSRT(
          extras.autoSubtitleText,
          voiceSeconds > 0 ? Math.min(voiceSeconds, videoSeconds) : videoSeconds,
        );
      if (!srt)
        throw new Error(
          tr(
            "Écrivez le texte des sous-titres ou ajoutez un fichier de sous-titres.",
            "Escribe el texto de los subtítulos o añade un archivo de subtítulos.",
            "Write the subtitle text or add a subtitle file.",
          ),
        );
      update(tr("Ajout des sous-titres…", "Agregando los subtítulos…", "Adding the subtitles…"));
      await ff.writeFile("words.ass", new TextEncoder().encode(subtitleASS(srt, job.settings)));
      const font = await get("/media-engine/DejaVuSans.ttf");
      if (!font.ok)
        throw new Error(
          tr(
            "Police des sous-titres indisponible.",
            "La fuente de los subtítulos no está disponible.",
            "The subtitle font is unavailable.",
          ),
        );
      await ff.writeFile("DejaVuSans.ttf", new Uint8Array(await font.arrayBuffer()));
    }
    if (job.settings.logo) {
      if (!extras.logo || extras.logo.size > 3 * 1024 * 1024 || extras.logo.type !== "image/png")
        throw new Error(
          tr(
            "Ajoutez un logo PNG de moins de 3 Mo.",
            "Añade un logo PNG de menos de 3 MB.",
            "Add a PNG logo under 3 MB.",
          ),
        );
      await ff.writeFile("logo.png", new Uint8Array(await extras.logo.arrayBuffer()));
    }
    if (job.settings.music) {
      if (!extras.music || extras.music.size > 15 * 1024 * 1024)
        throw new Error(
          tr("Ajoutez une musique de moins de 15 Mo.", "Añade una música de menos de 15 MB.", "Add music under 15 MB."),
        );
      await ff.writeFile("music", new Uint8Array(await extras.music.arrayBuffer()));
    }
    update(tr("Création de votre fichier vidéo…", "Creando tu archivo de video…", "Creating your video file…"));
    await execute(finishArgs(job.settings));
    const bytes = await ff.readFile("final.mp4");
    return new File([bytes as BlobPart], "montage-final.mp4", {
      type: "video/mp4",
    });
  } finally {
    ff.terminate();
    if (wasmURL) URL.revokeObjectURL(wasmURL);
  }
}
