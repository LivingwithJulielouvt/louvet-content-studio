import { FONTS, SIZES, hookWords } from "./video-style.mjs";
import { subtitleFrame, subtitleGroups, changePoints } from "./video-timing.mjs";
// Pure editing commands shared by the browser engine and real media tests.
export function renderSettings(brief) {
  const s = brief.style?.config || {};
  return {
    format: brief.format,
    duration: brief.duration,
    shotSeconds: s.shotSeconds || 3,
    transition: s.transition || "cut",
    subtitles: !!brief.subtitles,
    voice: false,
    originalAudio: s.originalAudio !== false,
    logo: s.logoMode === "client_logo",
    music: s.music === "agency_approved",
    captionStyle: s.captionStyle || "discreet",
    captionPosition: s.captionPosition || "bottom_safe",
    captionColor: s.captionColor || "#ffffff",
    captionBackground: s.captionBackground || "#19352d",
  };
}
export function checkRender(s, extras = {}) {
  if (!["9:16", "4:5", "1:1"].includes(s.format) || ![15, 30, 60].includes(s.duration))
    throw new Error("Format ou durée non pris en charge.");
  if (s.transition === "crossfade")
    throw new Error(
      "Le fondu enchaîné demande encore un montage agence. Choisissez un style à coupes franches ou fondu au noir.",
    );
  if (s.subtitles && !extras.subtitles && !extras.autoSubtitles)
    throw new Error(
      "Ajoutez des sous-titres : activez les sous-titres automatiques ou ajoutez un fichier SRT synchronisé avec le montage.",
    );
  if (s.logo && !extras.logo) throw new Error("Ce style demande le logo : ajoutez un fichier PNG.");
  if (s.music && !extras.music)
    throw new Error("Ce style demande une musique : ajoutez un fichier autorisé par l’agence.");
}
export function dimensions(format) {
  return format === "9:16" ? [540, 960] : format === "4:5" ? [600, 750] : [640, 640];
}
export function planShots(metadata, settings) {
  if (!metadata.length || metadata.length > 6) throw new Error("Choisissez entre un et six rushes.");
  const shots = [],
    positions = metadata.map(() => 0);
  let remaining = settings.duration;
  while (remaining > 0.08) {
    let changed = false;
    for (let i = 0; i < metadata.length && remaining > 0.08; i++) {
      const available = metadata[i].duration - positions[i];
      if (available < 0.08) continue;
      const duration = Math.min(available, settings.shotSeconds, remaining);
      shots.push({
        input: i,
        start: positions[i],
        duration,
        audio: metadata[i].audio,
      });
      positions[i] += duration;
      remaining -= duration;
      changed = true;
    }
    if (!changed) break;
  }
  if (!shots.length) throw new Error("Ces rushes ne contiennent aucune durée exploitable.");
  return shots;
}
const num = (n) => String(Math.round(n * 1000) / 1000);
export function segmentArgs(shot, index, settings) {
  const [w, h] = dimensions(settings.format),
    d = num(shot.duration),
    fades =
      settings.transition === "fade"
        ? `,fade=t=in:st=0:d=0.15,fade=t=out:st=${num(Math.max(0, shot.duration - 0.15))}:d=0.15`
        : "";
  return [
    "-ss",
    num(shot.start),
    "-i",
    `source-${shot.input}`,
    ...(!shot.audio || !settings.originalAudio ? ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"] : []),
    "-t",
    d,
    "-map",
    "0:v:0",
    "-map",
    shot.audio && settings.originalAudio ? "0:a:0" : "1:a:0",
    "-vf",
    shot.zoom && shot.zoom > 1
      ? // Montage des marques : la vidéo remplit le cadre (recadrage au centre) et peut être légèrement zoomée.
        `scale=${Math.round(w * shot.zoom)}:${Math.round(h * shot.zoom)}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=30${fades}`
      : shot.fill
        ? `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=30${fades}`
        : `scale=${w}:${h}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30${fades}`,
    "-af",
    "aresample=48000,asetpts=PTS-STARTPTS",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "25",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-ac",
    "2",
    "-ar",
    "48000",
    "-threads",
    "1",
    `shot-${index}.mp4`,
  ];
}
export function joinArgs() {
  return ["-f", "concat", "-safe", "0", "-i", "shots.txt", "-c", "copy", "joined.mp4"];
}
function assTime(ms) {
  const c = Math.floor(ms / 10);
  return `${Math.floor(c / 360000)}:${String(Math.floor(c / 6000) % 60).padStart(2, "0")}:${String(Math.floor(c / 100) % 60).padStart(2, "0")}.${String(c % 100).padStart(2, "0")}`;
}
export function subtitleASS(srt, settings) {
  if (srt.length > 100000) throw new Error("Fichier de sous-titres trop volumineux.");
  const [w, h] = dimensions(settings.format),
    color = (c) => `&H00${c.slice(5, 7)}${c.slice(3, 5)}${c.slice(1, 3)}`;
  const lines = [];
  const re =
    /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})[^\n]*\n([\s\S]*?)(?=\n\s*\n|$)/g;
  let m;
  while ((m = re.exec(srt.replaceAll("\r", "")))) {
    const time = (offset) =>
      (Number(m[offset]) * 3600 + Number(m[offset + 1]) * 60 + Number(m[offset + 2])) * 1000 + Number(m[offset + 3]);
    if (time(5) <= time(1) || time(1) >= settings.duration * 1000) continue;
    const t = m[9]
      .replace(/<[^>]*>/g, "")
      .replace(/[{}\\]/g, "")
      .trim()
      .replaceAll("\n", "\\N");
    lines.push(
      `Dialogue: 0,${assTime(time(1))},${assTime(Math.min(time(5), settings.duration * 1000))},Default,,0,0,0,,${t}`,
    );
  }
  if (!lines.length) throw new Error("Aucun sous-titre SRT valide dans la durée du montage.");
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: ${w}\nPlayResY: ${h}\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,DejaVu Sans,${settings.captionStyle === "bold" ? 32 : 25},${color(settings.captionColor)},&H000000FF,${color(settings.captionBackground)},${color(settings.captionBackground)},${settings.captionStyle === "bold" ? -1 : 0},0,0,0,100,100,0,0,3,2,0,${settings.captionPosition === "center" ? 5 : 2},35,35,110,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${lines.join("\n")}\n`;
}
export function finishArgs(s) {
  let input = 1,
    filters = [],
    v = "0:v",
    a = "0:a";
  const args = ["-i", "joined.mp4"];
  if (s.logo) {
    args.push("-i", "logo.png");
    filters.push(`[${input++}:v]scale=100:-1[logo]`, `[0:v][logo]overlay=W-w-24:24[branded]`);
    v = "branded";
  }
  if (s.subtitles) {
    filters.push(`[${v}]subtitles=words.ass:fontsdir=.[captioned]`);
    v = "captioned";
  }
  if (s.voice) {
    // Voix off : le son des rushes et la musique passent en fond sous la voix.
    const mix = ["[orig]"];
    filters.push(`[0:a]volume=0.3[orig]`);
    if (s.music) {
      args.push("-stream_loop", "-1", "-i", "music");
      filters.push(`[${input++}:a]volume=0.12[music]`);
      mix.push("[music]");
    }
    args.push("-i", "voice.mp3");
    filters.push(`[${input++}:a]aresample=48000,apad[voice]`);
    mix.push("[voice]");
    filters.push(`${mix.join("")}amix=inputs=${mix.length}:duration=first:dropout_transition=0:normalize=0[mixed]`);
    a = "mixed";
  } else if (s.music) {
    args.push("-stream_loop", "-1", "-i", "music");
    filters.push(
      `[${input}:a]volume=0.15[music]`,
      `[0:a][music]amix=inputs=2:duration=first:dropout_transition=0[mixed]`,
    );
    a = "mixed";
  }
  if (filters.length) args.push("-filter_complex", filters.join(";"));
  args.push(
    "-map",
    v.includes(":") ? v : `[${v}]`,
    "-map",
    a.includes(":") ? a : `[${a}]`,
    "-c:v",
    filters.length ? "libx264" : "copy",
  );
  if (filters.length) args.push("-preset", "ultrafast", "-crf", "25", "-pix_fmt", "yuv420p");
  args.push(
    "-c:a",
    s.music || s.voice ? "aac" : "copy",
    "-t",
    String(s.duration),
    "-threads",
    "1",
    "-movflags",
    "+faststart",
    "final.mp4",
  );
  return args;
}

// Voix proposées pour la voix off (voix OpenAI).
export const VOICES = { warm: "coral", calm: "ash", energetic: "nova" };
export const VOICE_SCRIPT_MAX = 600;

/** Découpe un texte en sous-titres courts (≤ max caractères), en respectant phrases et virgules. */
export function subtitleChunks(text, max = 42) {
  const clean = String(text ?? "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[{}\\<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return [];
  const chunks = [];
  const sentences = clean.match(/[^.!?…]+[.!?…]*\s*/g) || [clean];
  for (const sentence of sentences) {
    let line = "";
    for (const word of sentence.trim().split(" ").filter(Boolean)) {
      const w = word.length > max ? word.slice(0, max) : word;
      if (line && (line + " " + w).length > max) {
        chunks.push(line);
        line = w;
      } else line = line ? line + " " + w : w;
      // Coupure naturelle après une virgule quand la ligne est déjà bien remplie.
      if (/[,;:]$/.test(line) && line.length >= max * 0.55) {
        chunks.push(line);
        line = "";
      }
    }
    if (line) chunks.push(line);
  }
  return chunks.slice(0, 300);
}
const srtTime = (sec) => {
  const ms = Math.max(0, Math.round(sec * 1000)),
    p = (n, l = 2) => String(n).padStart(l, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
/** Sous-titres automatiques : chaque morceau reste à l'écran proportionnellement à sa longueur. */
export function autoSubtitleSRT(text, duration, max = 42) {
  const chunks = subtitleChunks(text, max);
  if (!chunks.length || !(duration > 0)) return "";
  const total = chunks.reduce((n, c) => n + c.length + 4, 0);
  let t = 0;
  return chunks
    .map((c, i) => {
      const start = t,
        end = i === chunks.length - 1 ? duration : t + (duration * (c.length + 4)) / total;
      t = end;
      return `${i + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${c}\n`;
    })
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* Montage des marques : sous-titres animés générés depuis subtitleFrame */
/* ------------------------------------------------------------------ */
const assColor = (hex, alpha = "00") => `&H${alpha}${hex.slice(5, 7)}${hex.slice(3, 5)}${hex.slice(1, 3)}`.toUpperCase();
const assEscape = (t) => String(t).replace(/[{}\\]/g, "").replace(/\n/g, " ");
/** Positions verticales communes à l'aperçu et au rendu (fraction de la hauteur). */
export const POSITION_Y = { top: 0.26, middle: 0.5, bottom: 0.7 };
export const HOOK_Y = 0.13;
/** Taille de police en pixels pour une hauteur de vidéo donnée. */
export const fontPx = (style, height) => Math.round((SIZES[style.size] || SIZES.m) * (style.scale || 1) * (height / 960));
/** Position verticale du sous-titre (fraction de la hauteur), avec le réglage fin de l'éditeur. */
export const subtitleY = (style) => Math.min(0.92, Math.max(0.08, (POSITION_Y[style.position] || POSITION_Y.bottom) + (style.offset || 0)));

/** Fichier ASS complet (sous-titres animés, hook, carton de fin) à partir des mots calés et du style. */
export function brandASS(words, style, { format = "9:16", duration }) {
  const [w, h] = dimensions(format);
  const size = fontPx(style, h),
    x = Math.round(w / 2),
    y = Math.round(h * subtitleY(style));
  const label = style.animation === "label";
  const base = FONTS[style.font] || FONTS.sans;
  const groups = subtitleGroups(words, style);
  const pts = changePoints(words, style, duration);
  const events = [];
  const push = (layer, s, e, styleName, text) => {
    if (e - s < 0.02 || !text) return;
    let last = null;
    for (let k = events.length - 1; k >= 0; k--)
      if (events[k].layer === layer) {
        last = events[k];
        break;
      }
    if (last && last.text === text && Math.abs(last.e - s) < 0.005) last.e = e;
    else events.push({ layer, s, e, styleName, text });
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const s = pts[i],
      e = pts[i + 1],
      f = subtitleFrame(words, style, (s + e) / 2, { duration, groups });
    if (f.group >= 0) {
      const parts = f.words
        .filter((x) => x.visible)
        .map((x) => {
          const font = FONTS[x.font] || base;
          const fs = x.script ? Math.round(size * 1.05) : size;
          return `{\\c${assColor(x.color)}\\fn${font.ass}\\fs${fs}}${assEscape(x.text)}`;
        });
      if (parts.length) push(0, s, e, label ? "Label" : "Sub", `{\\an5\\pos(${x},${y})}` + parts.join(" "));
    }
    if (f.hook) {
      const hf = FONTS[f.hook.font] || FONTS.serif;
      const mixed = Object.keys(style.hook?.wordFonts || {}).length > 0;
      const hw = mixed && f.hook.words?.length ? f.hook.words : [{ text: f.hook.text, font: f.hook.font }];
      const body = hw.map((x) => `{\\fn${(FONTS[x.font] || hf).ass}}${assEscape(x.text)}`).join(" ");
      push(1, s, e, "Hook", `{\\an8\\pos(${x},${Math.round(h * HOOK_Y)})}` + body);
    }
    for (const tt of f.titles || []) {
      const tf = FONTS[tt.font] || FONTS.heavy;
      push(
        2 + Math.max(0, (style.titles || []).indexOf(tt)),
        s,
        e,
        "Title",
        `{\\an5\\pos(${Math.round(tt.x * w)},${Math.round(tt.y * h)})\\fn${tf.ass}\\fs${Math.round(tt.size * h)}\\c${assColor(tt.color)}}${assEscape(tt.text)}`,
      );
    }
    if (f.outro) push(1, s, e, "Label", `{\\an5\\pos(${x},${Math.round(h * 0.45)})\\fn${base.ass}}${assEscape(f.outro.text)}`);
  }
  if (style.animation === "fade") for (const ev of events) if (ev.layer === 0) ev.text = ev.text.replace("{\\an5", "{\\fad(150,120)\\an5");
  const outline = style.outline ? `${assColor("#000000")},${assColor("#000000", "80")},-1,0,0,0,100,100,0,0,1,3,0` : `${assColor("#000000")},${assColor("#000000", "60")},-1,0,0,0,100,100,0,0,1,0,2`;
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${w}`,
    `PlayResY: ${h}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Sub,${base.ass},${size},${assColor(style.color)},${assColor(style.highlight)},${outline},5,40,40,40,1`,
    `Style: Label,${base.ass},${size},${assColor(style.color)},${assColor(style.highlight)},${assColor("#000000", "20")},${assColor("#000000", "20")},-1,0,0,0,100,100,0,0,3,10,0,5,40,40,40,1`,
    `Style: Title,${FONTS.heavy.ass},${Math.round(h * 0.08)},${assColor("#FFFFFF")},${assColor("#FFFFFF")},${assColor("#000000")},${assColor("#000000", "60")},0,0,0,0,100,100,0,0,1,4,2,5,40,40,40,1`,
    `Style: Hook,${(FONTS[style.hook?.font] || FONTS.serif).ass},${Math.round(size * 1.3)},${assColor("#FFFFFF")},${assColor("#FFFFFF")},${assColor("#000000")},${assColor("#000000", "80")},0,0,0,0,100,100,0,0,1,3,1,8,50,50,40,1`,
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...events.map((ev) => `Dialogue: ${ev.layer},${assTime(ev.s * 1000)},${assTime(ev.e * 1000)},${ev.styleName},,0,0,0,,${ev.text}`),
    "",
  ].join("\n");
}
/** Polices à écrire dans le système de fichiers FFmpeg pour un style donné. */
export function fontsFor(style) {
  const keys = new Set([style.font, style.hook?.font || "serif", "script"]);
  for (const x of hookWords(style.hook || {})) keys.add(x.font);
  for (const t of style.titles || []) keys.add(t.font);
  return [...keys].filter((k) => FONTS[k]).map((k) => FONTS[k].file);
}

/** Commande finale du montage des marques : sous-titres, musique baissée sous la voix, voix off, durée. */
export function brandFinishArgs(s) {
  const args = ["-i", "joined.mp4"];
  const filters = [];
  let v = "0:v",
    input = 1;
  if (s.subtitles) {
    filters.push(`[0:v]subtitles=words.ass:fontsdir=fonts[captioned]`);
    v = "captioned";
  }
  // Stickers (PNG transparents) posés sur l'image pendant leur durée.
  const stickerInputs = [];
  for (const st of s.stickers || []) stickerInputs.push(st);
  const speech = s.voice ? "voice" : "orig";
  if (s.voice) {
    args.push("-i", "voice.mp3");
    filters.push(`[0:a]volume=0.3[orig]`, `[${input++}:a]aresample=48000,apad[voice]`);
  } else filters.push(`[0:a]anull[orig]`);
  if (s.music) {
    args.push("-stream_loop", "-1", "-i", "music");
    const vol = Math.max(0, Math.min(1, s.musicVolume ?? 0.35));
    filters.push(`[${input++}:a]aresample=48000,volume=${vol}[music]`);
    if (s.duck) {
      filters.push(`[${speech}]asplit=2[sp][key]`, `[music][key]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=350[bed]`);
      filters.push(s.voice ? `[orig][sp][bed]amix=inputs=3:duration=first:dropout_transition=0:normalize=0[mixed]` : `[sp][bed]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mixed]`);
    } else filters.push(s.voice ? `[orig][voice][music]amix=inputs=3:duration=first:dropout_transition=0:normalize=0[mixed]` : `[orig][music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mixed]`);
  } else if (s.voice) filters.push(`[orig][voice]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mixed]`);
  else filters.push(`[orig]anull[mixed]`);
  if (stickerInputs.length) {
    const [W] = s.dims || [540, 960];
    const ov = stickerOverlay(stickerInputs, { first: input, width: W, video: v });
    stickerInputs.forEach((_, k) => args.push("-i", `sticker-${k}.png`));
    input += stickerInputs.length;
    filters.push(...ov.filters);
    v = ov.label;
  }
  let audioOut = "mixed";
  if (s.sfx?.events?.length) {
    const fx = sfxSources(s.sfx.events, s.sfx.kind, s.sfx.volume, input);
    args.push(...fx.args);
    input += fx.count;
    filters.push(...fx.filters, `[mixed]${fx.labels.map((l) => `[${l}]`).join("")}amix=inputs=${fx.labels.length + 1}:duration=first:dropout_transition=0:normalize=0[withfx]`);
    audioOut = "withfx";
  }
  args.push("-filter_complex", filters.join(";"), "-map", v.includes(":") ? v : `[${v}]`, "-map", `[${audioOut}]`);
  args.push("-c:v", "libx264", "-preset", "ultrafast", "-crf", "24", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k");
  args.push("-t", String(Math.round(s.duration * 1000) / 1000), "-threads", "1", "-movflags", "+faststart", "final.mp4");
  return args;
}
/** Extraction de la piste audio d'analyse (mono, 16 kHz, MP3 léger) depuis les rushes mis bout à bout. */
export function analysisAudioArgs(clips) {
  const args = [];
  clips.forEach((c, i) => args.push("-i", `source-${i}`));
  const parts = clips.map((c, i) =>
    c.audio
      ? `[${i}:a]aresample=16000,aformat=sample_fmts=fltp:channel_layouts=mono,atrim=0:${c.duration},asetpts=PTS-STARTPTS[a${i}]`
      : `anullsrc=r=16000:cl=mono,atrim=0:${c.duration}[a${i}]`,
  );
  const filter = parts.join(";") + ";" + clips.map((c, i) => `[a${i}]`).join("") + `concat=n=${clips.length}:v=0:a=1[a]`;
  return [...args, "-filter_complex", filter, "-map", "[a]", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "32k", "analysis.mp3"];
}
/** Détection des silences sur la piste d'analyse. */
// « -loglevel info » : un ffprobe « -v error » précédent abaisse le niveau de journal pour tout le moteur.
export const silenceArgs = (noise = -35, d = 0.45) => ["-loglevel", "info", "-i", "analysis.mp3", "-af", `silencedetect=noise=${noise}dB:d=${d}`, "-f", "null", "-"];

/**
 * Graphe FFmpeg des stickers : chaque PNG est mis à l'échelle (fraction de la largeur), centré sur (x, y)
 * et affiché seulement entre s et e. Les entrées sticker-k.png suivent les autres entrées (index « first »).
 */
export function stickerOverlay(stickers, { first, width, video }) {
  const filters = [];
  let label = video;
  stickers.forEach((st, k) => {
    const px = Math.max(16, Math.round(st.size * width / 2) * 2);
    filters.push(`[${first + k}:v]scale=${px}:-1,format=rgba[stk${k}]`);
    filters.push(
      `[${label}][stk${k}]overlay=x='${Math.round(st.x * 1000) / 1000}*main_w-overlay_w/2':y='${Math.round(st.y * 1000) / 1000}*main_h-overlay_h/2':enable='between(t,${num(st.s)},${num(st.e)})'[ov${k}]`,
    );
    label = `ov${k}`;
  });
  return { filters, label };
}
/** Sources des bruitages synthétisés (aucun fichier tiers) : clic, pop, swoosh, appareil photo. */
export const SFX_SOURCES = {
  click: "anoisesrc=d=0.035:c=white:a=0.9,highpass=f=2500,afade=t=out:st=0.01:d=0.025",
  pop: "sine=f=620:d=0.14,afade=t=in:d=0.005,afade=t=out:st=0.03:d=0.11",
  swoosh: "anoisesrc=d=0.4:c=pink:a=0.7,bandpass=f=1400:width_type=o:w=2,afade=t=in:d=0.18,afade=t=out:st=0.2:d=0.2",
  camera: "anoisesrc=d=0.09:c=white:a=1,highpass=f=1800,afade=t=out:st=0.02:d=0.07",
};
/** Arguments et filtres pour placer un bruitage à chaque instant de « events » (secondes). */
export function sfxSources(events, kind = "pop", volume = 0.6, first = 1) {
  const src = SFX_SOURCES[kind] || SFX_SOURCES.pop;
  const list = (events || []).filter((t) => Number.isFinite(t) && t >= 0).slice(0, 24);
  const args = [],
    filters = [],
    labels = [];
  list.forEach((t, k) => {
    args.push("-f", "lavfi", "-i", src);
    const ms = Math.round(t * 1000);
    filters.push(`[${first + k}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${Math.max(0, Math.min(1, volume))},adelay=${ms}|${ms}[sfx${k}]`);
    labels.push(`sfx${k}`);
  });
  return { args, filters, labels, count: list.length };
}
/** Instants des bruitages : apparition des stickers et des titres qui en demandent un. */
export function sfxEvents(style) {
  return [...(style.stickers || []), ...(style.titles || [])].filter((x) => x.sfx).map((x) => x.s).sort((a, b) => a - b);
}
