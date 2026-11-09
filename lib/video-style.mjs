// Style de montage vidéo : un seul objet partagé par l'aperçu en direct, le rendu FFmpeg (sous-titres ASS)
// et le serveur (validation). Module pur, sans dépendance au navigateur.

/** Polices embarquées (licence SIL OFL, fichiers dans public/media-engine/fonts/). */
export const FONTS = {
  sans: { label: "Inter", ass: "Inter ExtraBold", css: "'LouvetInter', 'Helvetica Neue', Arial, sans-serif", file: "Inter_800ExtraBold.ttf" },
  rounded: { label: "Montserrat", ass: "Montserrat ExtraBold", css: "'LouvetMontserrat', 'Arial Rounded MT Bold', sans-serif", file: "Montserrat_800ExtraBold.ttf" },
  serif: { label: "DM Serif", ass: "DM Serif Display", css: "'LouvetDMSerif', Georgia, serif", file: "DMSerifDisplay_400Regular.ttf" },
  script: { label: "Caveat", ass: "Caveat", css: "'LouvetCaveat', 'Brush Script MT', cursive", file: "Caveat_700Bold.ttf" },
  heavy: { label: "Anton", ass: "Anton", css: "'LouvetAnton', 'Arial Black', sans-serif", file: "Anton_400Regular.ttf" },
  mono: { label: "Courier Prime", ass: "Courier Prime", css: "'LouvetCourier', 'Courier New', monospace", file: "CourierPrime_700Bold.ttf" },
};
export const ANIMATIONS = ["word", "stack", "typewriter", "fade", "highlight", "karaoke", "label", "none"];
export const POSITIONS = ["top", "middle", "bottom"];
export const SIZES = { s: 34, m: 42, l: 52 };
/** Couleurs proposées pour un mot (un clic : jaune, deux : rose, trois : manuscrit, quatre : normal). */
export const WORD_STYLES = { yellow: "#F5D76E", pink: "#F2B8C6", script: null, normal: null };
export const WORD_STYLE_CYCLE = ["normal", "yellow", "pink", "script"];
export const HEX = /^#[0-9a-fA-F]{6}$/;
/** Bruitages synthétisés par le moteur (aucun fichier audio tiers). */
export const SFX_KINDS = ["click", "pop", "swoosh", "camera"];
/** Emojis proposés dans l'éditeur (rendus en PNG transparent dans le navigateur). */
export const EMOJIS = ["🔥", "❤️", "🚩", "✨", "😂", "👀", "🥖", "✅", "💡", "📍", "⭐", "🙌", "😍", "🎉", "👇", "💬"];
export const MAX_STICKERS = 12;
export const MAX_TITLES = 6;

export const DEFAULT_STYLE = Object.freeze({
  font: "sans",
  size: "m",
  position: "bottom",
  color: "#FFFFFF",
  highlight: "#F5D76E",
  outline: true,
  uppercase: false,
  animation: "word",
  wordStyles: {},
  hook: { text: "", font: "serif" },
  outro: { text: "", logo: true },
  music: { id: null, volume: 0.35, duck: true },
  rhythm: { cutSilences: true, zooms: false, jumpCuts: false, target: null },
  sfx: false,
  sfxKind: "pop",
  sfxVolume: 0.6,
  scale: 1,
  offset: 0,
  shift: 0,
  stickers: [],
  titles: [],
});

/** Les trois looks proposés aux marques. « mine » = le style enregistré par l'agence pour ce client. */
export const LOOKS = {
  soft: { font: "serif", animation: "fade", highlight: "#F2B8C6", outline: false, uppercase: false, position: "bottom", size: "m" },
  bold: { font: "heavy", animation: "label", highlight: "#FFFFFF", outline: false, uppercase: true, position: "middle", size: "l" },
};

const clone = (x) => JSON.parse(JSON.stringify(x));
const pickIn = (v, list, d) => (list.includes(v) ? v : d);
const clamp = (n, a, b, d) => (Number.isFinite(Number(n)) ? Math.min(b, Math.max(a, Number(n))) : d);
const num3 = (n) => Math.round(n * 1000) / 1000;
const ID = /^[a-zA-Z0-9_-]{1,64}$/;
const PICTO = /\p{Extended_Pictographic}/u;
/** Stickers : emoji (rendu en PNG dans le navigateur) ou PNG envoyé par la créatrice, avec position et durée. */
export function sanitizeStickers(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const x of list.slice(0, MAX_STICKERS)) {
    if (!x || typeof x !== "object") continue;
    const kind = x.kind === "png" ? "png" : "emoji";
    const char = String(x.char ?? "").slice(0, 16);
    if (kind === "emoji" && (!PICTO.test(char) || /[\u0000-\u001f{}\\<>]/.test(char))) continue;
    if (kind === "png" && !ID.test(String(x.file_id || ""))) continue;
    const st = clamp(x.s, 0, 600, 0),
      en = clamp(x.e, 0, 600, st + 2);
    out.push({
      kind,
      ...(kind === "emoji" ? { char } : { file_id: String(x.file_id) }),
      x: num3(clamp(x.x, 0, 1, 0.5)),
      y: num3(clamp(x.y, 0, 1, 0.4)),
      size: num3(clamp(x.size, 0.08, 0.6, 0.22)),
      s: num3(st),
      e: num3(Math.max(en, st + 0.2)),
      sfx: !!x.sfx,
    });
  }
  return out;
}
/** Gros titres posés sur l'image (texte, position, durée, police, couleur, taille en fraction de la hauteur). */
export function sanitizeTitles(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const x of list.slice(0, MAX_TITLES)) {
    if (!x || typeof x !== "object") continue;
    const text = cleanText(x.text, 40);
    if (!text) continue;
    const st = clamp(x.s, 0, 600, 0),
      en = clamp(x.e, 0, 600, st + 2.5);
    out.push({
      text,
      x: num3(clamp(x.x, 0.05, 0.95, 0.5)),
      y: num3(clamp(x.y, 0.05, 0.95, 0.2)),
      s: num3(st),
      e: num3(Math.max(en, st + 0.3)),
      font: Object.hasOwn(FONTS, x.font) ? x.font : "heavy",
      color: HEX.test(x.color || "") ? x.color.toUpperCase() : "#FFFFFF",
      size: num3(clamp(x.size, 0.04, 0.16, 0.08)),
      sfx: !!x.sfx,
    });
  }
  return out;
}
function cleanWordFonts(map, text = "") {
  const out = {},
    count = String(text || "").split(/\s+/).filter(Boolean).length;
  if (map && typeof map === "object")
    for (const [k, v] of Object.entries(map).slice(0, 30)) if (/^\d{1,2}$/.test(k) && Number(k) < count && Object.hasOwn(FONTS, v)) out[k] = v;
  return out;
}
const cleanText = (s, max) =>
  String(s ?? "")
    .replace(/[\u0000-\u001f\u007f{}\\<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/** Valide un style venu du navigateur ou de la configuration client. Toute valeur inconnue revient au défaut. */
export function sanitizeStyle(input, base = DEFAULT_STYLE) {
  const s = input && typeof input === "object" ? input : {};
  const b = clone(base);
  const wordStyles = {};
  if (s.wordStyles && typeof s.wordStyles === "object")
    for (const [k, v] of Object.entries(s.wordStyles).slice(0, 400))
      if (/^\d{1,4}$/.test(k) && Object.hasOwn(WORD_STYLES, v) && v !== "normal") wordStyles[k] = v;
  const hook = s.hook && typeof s.hook === "object" ? s.hook : {};
  const outro = s.outro && typeof s.outro === "object" ? s.outro : {};
  const music = s.music && typeof s.music === "object" ? s.music : {};
  const rhythm = s.rhythm && typeof s.rhythm === "object" ? s.rhythm : {};
  return {
    font: Object.hasOwn(FONTS, s.font) ? s.font : b.font,
    size: Object.hasOwn(SIZES, s.size) ? s.size : b.size,
    position: pickIn(s.position, POSITIONS, b.position),
    color: HEX.test(s.color || "") ? s.color.toUpperCase() : b.color,
    highlight: HEX.test(s.highlight || "") ? s.highlight.toUpperCase() : b.highlight,
    outline: typeof s.outline === "boolean" ? s.outline : b.outline,
    uppercase: typeof s.uppercase === "boolean" ? s.uppercase : b.uppercase,
    animation: pickIn(s.animation, ANIMATIONS, b.animation),
    wordStyles,
    hook: (() => {
      const text = hook.text !== undefined ? cleanText(hook.text, 90) : b.hook.text;
      return {
        text,
        font: Object.hasOwn(FONTS, hook.font) ? hook.font : b.hook.font,
        wordFonts: cleanWordFonts(hook.wordFonts !== undefined ? hook.wordFonts : b.hook.wordFonts, text),
      };
    })(),
    outro: {
      text: outro.text !== undefined ? cleanText(outro.text, 80) : b.outro.text,
      logo: typeof outro.logo === "boolean" ? outro.logo : b.outro.logo,
    },
    music: {
      id: typeof music.id === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(music.id) ? music.id : music.id === null ? null : b.music.id,
      volume: clamp(music.volume, 0, 1, b.music.volume),
      duck: typeof music.duck === "boolean" ? music.duck : b.music.duck,
    },
    rhythm: {
      cutSilences: typeof rhythm.cutSilences === "boolean" ? rhythm.cutSilences : b.rhythm.cutSilences,
      zooms: typeof rhythm.zooms === "boolean" ? rhythm.zooms : b.rhythm.zooms,
      jumpCuts: typeof rhythm.jumpCuts === "boolean" ? rhythm.jumpCuts : b.rhythm.jumpCuts,
      target: [15, 30, 60].includes(Number(rhythm.target)) ? Number(rhythm.target) : rhythm.target === null ? null : b.rhythm.target,
    },
    sfx: typeof s.sfx === "boolean" ? s.sfx : b.sfx,
    sfxKind: pickIn(s.sfxKind, SFX_KINDS, b.sfxKind || "pop"),
    sfxVolume: clamp(s.sfxVolume, 0, 1, b.sfxVolume ?? 0.6),
    scale: num3(clamp(s.scale, 0.7, 1.5, b.scale ?? 1)),
    offset: num3(clamp(s.offset, -0.25, 0.25, b.offset ?? 0)),
    shift: num3(clamp(s.shift, -2, 2, b.shift ?? 0)),
    stickers: s.stickers !== undefined ? sanitizeStickers(s.stickers) : sanitizeStickers(b.stickers),
    titles: s.titles !== undefined ? sanitizeTitles(s.titles) : sanitizeTitles(b.titles),
  };
}

/** Style de départ d'un look. « mine » reprend le style enregistré par l'agence (config.videoStyle). */
export function lookStyle(look, clientStyle) {
  const mine = sanitizeStyle(clientStyle || {});
  if (look === "soft" || look === "bold") return sanitizeStyle({ ...mine, ...LOOKS[look] });
  return mine;
}
/** Change de look en gardant ce que le client a choisi (hook, mots colorés, musique, rythme). */
export function switchLook(style, look, clientStyle) {
  const base = lookStyle(look, clientStyle);
  return sanitizeStyle({
    ...base,
    wordStyles: style.wordStyles,
    hook: style.hook,
    outro: style.outro,
    music: style.music,
    rhythm: style.rhythm,
    stickers: style.stickers,
    titles: style.titles,
    shift: style.shift,
  });
}

/** Boutons d'intention : le studio ajuste lui-même plusieurs réglages. */
export function applyIntent(style, intent) {
  const s = sanitizeStyle(style);
  if (intent === "dynamic")
    return sanitizeStyle({
      ...s,
      animation: s.animation === "fade" || s.animation === "none" ? "word" : s.animation,
      rhythm: { ...s.rhythm, cutSilences: true, zooms: true, jumpCuts: true },
      music: { ...s.music, volume: Math.min(0.5, s.music.volume + 0.1) },
    });
  if (intent === "calm")
    return sanitizeStyle({
      ...s,
      animation: "fade",
      rhythm: { ...s.rhythm, zooms: false, jumpCuts: false },
      music: { ...s.music, volume: Math.max(0.15, s.music.volume - 0.1) },
    });
  if (intent === "shorter") {
    const current = s.rhythm.target || 60;
    const target = current > 30 ? 30 : 15;
    return sanitizeStyle({ ...s, rhythm: { ...s.rhythm, cutSilences: true, target } });
  }
  return s;
}

/** Style d'un mot (couleur et police) selon les choix du client. */
export function wordLook(style, index) {
  const w = style.wordStyles?.[index];
  if (w === "yellow" || w === "pink") return { color: WORD_STYLES[w], font: style.font, script: false };
  if (w === "script") return { color: style.color, font: "script", script: true };
  return { color: style.color, font: style.font, script: false };
}

/** Polices du hook mot par mot : un mot peut passer en manuscrit ou en gras, les autres gardent la police du hook. */
export function hookWords(hook) {
  const text = String(hook?.text || "");
  if (!text) return [];
  return text.split(/\s+/).filter(Boolean).map((w, i) => ({ text: w, font: hook.wordFonts?.[i] || hook.font || "serif" }));
}
/** Style à enregistrer comme « Mon style » : le look seulement, sans ce qui est propre à une vidéo. */
export function styleTemplate(style) {
  const s = sanitizeStyle(style);
  return sanitizeStyle({ ...s, wordStyles: {}, hook: { ...s.hook, text: "", wordFonts: {} }, stickers: [], titles: [], shift: 0 });
}
