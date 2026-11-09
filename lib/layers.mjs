// Éditeur à calques des créatrices : un visuel = un fond + une liste de calques (photo, texte, bulle,
// étiquette, autocollant, flèche, interface de téléphone, texte en cercle, forme, gribouillis).
// Les modèles ne sont que des points de départ dans ce format. Module pur : écran, serveur et tests.
// Coordonnées en pixels du canvas final : largeur = 1080 × nombre de diapos, hauteur = 1920 (story) ou 1350 (publication).
// Un carrousel continu est un seul grand canvas découpé ensuite en diapos.

export const LAYER_FORMATS = { "9:16": [1080, 1920], "4:5": [1080, 1350] };
export const SLIDE_W = 1080;
export const MAX_LAYERS = 60;
export const MAX_SLIDES = 10;
export const LAYER_TYPES = ["photo", "text", "bubble", "label", "sticker", "arrow", "ui", "circletext", "shape", "doodle"];
// Autocollants dessinés en vecteurs (ne dépendent d'aucune police emoji).
export const STICKERS = ["star", "sparkle", "heart", "bow", "coffee", "flower", "doodlestar", "diamond", "sun", "cloud", "moon", "check"];
// Emojis proposés en plus (police emoji du téléphone).
export const EMOJIS = ["⭐", "💖", "🎀", "☕", "✨", "🌸", "🔥", "📸", "🍋", "🌿", "🤍", "🛍️"];
export const UI_VARIANTS = ["selectbar", "sharesheet", "notif", "profile", "comment", "follow", "notes", "folder", "album", "checklist", "readcaption"];
export const DOODLES = ["squiggle", "underline", "scribble", "circle", "stars"];
export const SHAPES = ["rect", "circle", "line", "dots"];
// Polices utilisables par les calques de texte (fichiers OFL locaux, voir templates.mjs).
export const LAYER_FONTS = ["poppins", "inter", "montserrat", "spacegrotesk", "bebas", "anton", "playfair", "dmserif", "lora", "caveat", "dancing", "body", "serif", "loralight", "mono"];

export const layerCanvasSize = (d) => {
  const [w, h] = LAYER_FORMATS[d?.format] || LAYER_FORMATS["9:16"];
  return [w * clampInt(d?.slides, 1, MAX_SLIDES, 1), h];
};

function clampInt(v, lo, hi, d) {
  const n = Number(v);
  return Number.isInteger(n) ? Math.min(hi, Math.max(lo, n)) : d;
}
const num = (v, lo, hi, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n * 100) / 100)) : d;
};
const clean = (s, max) =>
  String(s ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .slice(0, max);
const hexOk = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
const color = (v, d) => (hexOk(v) ? v.toUpperCase() : d);
const colorOrNone = (v) => (v === "" || v === null || v === undefined ? "" : hexOk(v) ? v.toUpperCase() : "");
const fileId = (v) => (typeof v === "string" && /^[A-Za-z0-9_-]{6,100}$/.test(v) ? v : "");
const pickOf = (v, list, d) => (list.includes(v) ? v : d);
const err = (msg, status = 400) => Object.assign(new Error(msg), { status });

/** Nettoie un calque (types et valeurs autorisés uniquement). */
export function sanitizeLayer(raw, W, H, idx = 0) {
  const l = raw && typeof raw === "object" ? raw : {};
  if (!LAYER_TYPES.includes(l.type)) throw err("Élément inconnu dans le visuel.");
  const base = {
    id: /^[A-Za-z0-9_-]{1,24}$/.test(String(l.id || "")) ? String(l.id) : "l" + idx,
    type: l.type,
    x: num(l.x, -W * 0.5, W * 1.5, W / 2),
    y: num(l.y, -H * 0.5, H * 1.5, H / 2),
    w: num(l.w, 8, W * 1.5, 300),
    h: num(l.h, 8, H * 1.5, 300),
    rot: num(l.rot, -360, 360, 0),
    opacity: num(l.opacity, 0.05, 1, 1),
    hidden: l.hidden === true,
    locked: l.locked === true,
  };
  const font = pickOf(l.font, LAYER_FONTS, "poppins");
  const txt = (max) => clean(l.text, max);
  switch (l.type) {
    case "photo":
      return {
        ...base,
        file: fileId(l.file),
        crop: { x: num(l.crop?.x, -1, 1, 0), y: num(l.crop?.y, -1, 1, 0), z: num(l.crop?.z, 1, 4, 1) },
        radius: num(l.radius, 0, 600, 0),
        border: num(l.border, 0, 80, 0),
        borderColor: color(l.borderColor, "#FFFFFF"),
        bottom: num(l.bottom, 0, 300, 0),
        shadow: l.shadow === true,
        label: clean(l.label, 40),
        labelColor: color(l.labelColor, "#FFFFFF"),
        circle: l.circle === true,
      };
    case "text":
      return {
        ...base,
        text: txt(600),
        font,
        size: num(l.size, 10, 500, 72),
        color: color(l.color, "#1A1A1A"),
        align: pickOf(l.align, ["left", "center", "right"], "center"),
        bg: colorOrNone(l.bg),
        shadow: l.shadow === true,
        outline: colorOrNone(l.outline),
        lh: num(l.lh, 0.7, 2.2, 1.1),
        spacing: num(l.spacing, -0.1, 0.6, 0),
        upper: l.upper === true,
        italic: l.italic === true,
      };
    case "bubble":
      return {
        ...base,
        text: txt(200),
        font,
        size: num(l.size, 14, 160, 46),
        color: color(l.color, "#7CC8F2"),
        textColor: color(l.textColor, "#FFFFFF"),
        tail: pickOf(l.tail, ["left", "right", "none"], "right"),
        sticker: clean(l.sticker, 12),
        shadow: l.shadow === true,
      };
    case "label":
      return {
        ...base,
        text: txt(80),
        font,
        size: num(l.size, 12, 140, 34),
        color: colorOrNone(l.color) || "#FFFFFF",
        textColor: color(l.textColor, "#1A1A1A"),
        outline: l.outline === true,
        shadow: l.shadow === true,
        upper: l.upper === true,
      };
    case "sticker": {
      const glyph = STICKERS.includes(l.glyph) ? l.glyph : "";
      const emoji = glyph ? "" : clean(l.emoji, 12);
      return { ...base, glyph: glyph || (emoji ? "" : "star"), emoji, color: color(l.color, "#F5C542") };
    }
    case "arrow":
      return { ...base, color: color(l.color, "#FFFFFF"), width: num(l.width, 1, 30, 5), curve: num(l.curve, -1, 1, 0.4), flip: l.flip === true, head: l.head !== false };
    case "ui":
      return {
        ...base,
        variant: pickOf(l.variant, UI_VARIANTS, "selectbar"),
        title: clean(l.title, 120),
        text: txt(400),
        name: clean(l.name, 60),
        handle: clean(l.handle, 40),
        items: (Array.isArray(l.items) ? l.items : []).slice(0, 8).map((x) => clean(x, 60)),
        dark: l.dark === true,
        accent: color(l.accent, "#2F80ED"),
      };
    case "circletext":
      return { ...base, text: txt(140), font, size: num(l.size, 12, 160, 44), color: color(l.color, "#FFFFFF"), start: num(l.start, -360, 360, -90) };
    case "shape":
      return {
        ...base,
        shape: pickOf(l.shape, SHAPES, "rect"),
        color: colorOrNone(l.color),
        stroke: colorOrNone(l.stroke),
        strokeWidth: num(l.strokeWidth, 0, 40, 0),
        radius: num(l.radius, 0, 600, 0),
        alpha: num(l.alpha, 0, 1, 1),
      };
    case "doodle":
      return { ...base, variant: pickOf(l.variant, DOODLES, "squiggle"), color: color(l.color, "#FFFFFF"), width: num(l.width, 1, 30, 5) };
  }
}

/** Nettoie un visuel complet. Lève une erreur (status 400/413) si la structure est invalide. */
export function sanitizeLayered(input) {
  const t = input && typeof input === "object" ? input : {};
  const format = pickOf(t.format, Object.keys(LAYER_FORMATS), "9:16");
  const slides = clampInt(t.slides, 1, MAX_SLIDES, 1);
  const [W, H] = layerCanvasSize({ format, slides });
  const list = Array.isArray(t.layers) ? t.layers : [];
  if (list.length > MAX_LAYERS) throw err(`Un visuel peut contenir ${MAX_LAYERS} éléments au maximum.`);
  const layers = list.map((l, i) => sanitizeLayer(l, W, H, i));
  // Identifiants uniques (le premier garde le sien).
  const seen = new Set();
  for (const [i, l] of layers.entries()) {
    if (seen.has(l.id)) l.id = l.id.slice(0, 18) + "_" + i;
    seen.add(l.id);
  }
  const bg = t.bg && typeof t.bg === "object" ? t.bg : {};
  const out = {
    id: "layers",
    from: /^[a-z0-9-]{1,40}$/.test(String(t.from || "")) ? String(t.from) : "blank",
    format,
    slides,
    bg: {
      color: color(bg.color, "#F6F1E9"),
      photo: fileId(bg.photo),
      blur: num(bg.blur, 0, 60, 0),
      dim: num(bg.dim, 0, 0.8, 0),
      crop: { x: num(bg.crop?.x, -1, 1, 0), y: num(bg.crop?.y, -1, 1, 0), z: num(bg.crop?.z, 1, 4, 1) },
    },
    layers,
    slide: clampInt(t.slide, 0, slides - 1, 0),
    handle: clean(t.handle, 40),
  };
  out.photos = layeredPhotos(out);
  if (out.photos.length > 30) throw err("Trop de photos dans ce visuel.");
  if (JSON.stringify(out).length > 120000) throw err("Le modèle est trop long.", 413);
  return out;
}
/** Photos utilisées (pour vérifier qu'elles appartiennent bien à l'espace). */
export function layeredPhotos(d) {
  const ids = [d?.bg?.photo, ...(d?.layers || []).filter((l) => l.type === "photo").map((l) => l.file)].filter(Boolean);
  return [...new Set(ids)];
}
/** Emplacements photo à remplir, dans l'ordre de lecture (gauche → droite, haut → bas, diapo par diapo). */
export function photoSlots(d) {
  return (d?.layers || [])
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.type === "photo")
    .sort((a, b) => Math.floor(a.l.x / SLIDE_W) - Math.floor(b.l.x / SLIDE_W) || a.l.y - a.l.h / 2 - (b.l.y - b.l.h / 2) || a.l.x - b.l.x)
    .map(({ i }) => i);
}
/** Remplit les emplacements photo dans l'ordre avec les photos choisies (les photos déjà posées sont gardées si la liste est plus courte). */
export function fillPhotos(d, ids) {
  const out = { ...d, layers: d.layers.map((l) => ({ ...l })) };
  photoSlots(out).forEach((idx, k) => {
    if (ids[k]) out.layers[idx] = { ...out.layers[idx], file: ids[k], crop: { x: 0, y: 0, z: 1 } };
  });
  return out;
}
export const emptySlots = (d) => photoSlots(d).filter((i) => !d.layers[i].file).length;

// ---------- Outils de l'éditeur (purs) ----------
let counter = 0;
export const newLayerId = () => "l" + Date.now().toString(36).slice(-5) + (counter++).toString(36);
/** Calque à ajouter depuis le bouton « + », centré sur la diapo visible. */
export function makeLayer(kind, cx, cy, lang = "fr", opts = {}) {
  return sanitizeLayer(rawLayer(kind, cx, cy, lang, opts), 1e6, 1e6);
}
function rawLayer(kind, cx, cy, lang, opts) {
  const T = (fr, es, en) => (lang === "es" ? es : lang === "en" ? en : fr);
  const id = newLayerId();
  const b = { id, x: cx, y: cy, rot: 0, opacity: 1 };
  switch (kind) {
    case "text":
      return { ...b, type: "text", w: 760, h: 200, text: T("Votre texte ici", "Tu texto aquí", "Your text here"), font: "playfair", size: 96, color: opts.color || "#1A1A1A", align: "center", lh: 1.05 };
    case "script":
      return { ...b, type: "text", w: 700, h: 160, text: T("un mot doux", "una palabra bonita", "a sweet word"), font: "caveat", size: 110, color: opts.color || "#1A1A1A", align: "center", lh: 1 };
    case "bubble":
      return { ...b, type: "bubble", w: 520, h: 120, text: T("Mon matin", "Mi mañana", "My morning"), font: "body", size: 46, color: "#7CC8F2", textColor: "#FFFFFF", tail: "right", sticker: "💖" };
    case "label":
      return { ...b, type: "label", w: 300, h: 76, text: T("Mot-clé", "Palabra clave", "Keyword"), font: "body", size: 34, color: "#FFFFFF", textColor: "#1A1A1A" };
    case "sticker":
      return { ...b, type: "sticker", w: 140, h: 140, glyph: opts.glyph && STICKERS.includes(opts.glyph) ? opts.glyph : opts.emoji ? "" : "star", emoji: opts.emoji || "", color: opts.color || "#F5C542" };
    case "arrow":
      return { ...b, type: "arrow", w: 240, h: 160, color: opts.color || "#FFFFFF", width: 6, curve: 0.5 };
    case "photo":
      return { ...b, type: "photo", w: 380, h: 460, file: opts.file || "", crop: { x: 0, y: 0, z: 1 }, border: 18, bottom: 0, borderColor: "#FFFFFF", shadow: true, rot: -4 };
    case "doodle":
      return { ...b, type: "doodle", w: 360, h: 60, variant: "squiggle", color: opts.color || "#FFFFFF", width: 6 };
    default:
      throw Error("kind");
  }
}
/** Point (px) dans le repère d'un calque tourné ? */
export function hitLayer(l, px, py, pad = 0) {
  const a = (-(l.rot || 0) * Math.PI) / 180;
  const dx = px - l.x,
    dy = py - l.y;
  const rx = dx * Math.cos(a) - dy * Math.sin(a),
    ry = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(rx) <= l.w / 2 + pad && Math.abs(ry) <= l.h / 2 + pad;
}
/** Calque visible le plus haut sous le doigt (les calques verrouillés sont sélectionnables mais pas déplaçables). */
export function topLayerAt(d, px, py, pad = 0) {
  for (let i = d.layers.length - 1; i >= 0; i--) {
    const l = d.layers[i];
    if (!l.hidden && hitLayer(l, px, py, pad)) return i;
  }
  return -1;
}
/** Aimantation : centre de la page, centre de chaque diapo, séparations et bords. Renvoie la position corrigée et les repères à afficher. */
export function snap(d, l, x, y, tol = 18) {
  const [W, H] = layerCanvasSize(d);
  const xs = [W / 2];
  for (let s = 0; s < d.slides; s++) xs.push(s * SLIDE_W + SLIDE_W / 2);
  for (let s = 1; s < d.slides; s++) xs.push(s * SLIDE_W);
  const ys = [H / 2];
  const guides = [];
  let nx = x,
    ny = y;
  const hw = l.rot ? 0 : l.w / 2,
    hh = l.rot ? 0 : l.h / 2;
  let best = tol + 1;
  for (const g of xs)
    for (const [off, kind] of [
      [0, "c"],
      [-hw, "l"],
      [hw, "r"],
    ]) {
      const dist = Math.abs(x + off - g);
      if (dist < best && (kind === "c" || hw)) {
        best = dist;
        nx = g - off;
      }
    }
  if (best <= tol) guides.push({ axis: "x", at: xs.find((g) => Math.abs(nx - g) < 0.5 || Math.abs(nx - hw - g) < 0.5 || Math.abs(nx + hw - g) < 0.5) });
  else nx = x;
  best = tol + 1;
  for (const g of [...ys, 0, H])
    for (const off of [0, -hh, hh]) {
      const dist = Math.abs(y + off - g);
      if (dist < best) {
        best = dist;
        ny = g - off;
      }
    }
  if (best <= tol) guides.push({ axis: "y", at: [...ys, 0, H].find((g) => Math.abs(ny - g) < 0.5 || Math.abs(ny - hh - g) < 0.5 || Math.abs(ny + hh - g) < 0.5) });
  else ny = y;
  return { x: nx, y: ny, guides: guides.filter((g) => g.at !== undefined) };
}
/** Ajoute / retire une diapo (les calques des diapos supprimées sont retirés, pas déplacés). */
export function setSlideCount(d, n) {
  const slides = Math.min(MAX_SLIDES, Math.max(1, n));
  const W = slides * SLIDE_W;
  return { ...d, slides, slide: Math.min(d.slide || 0, slides - 1), layers: d.layers.filter((l) => l.x - l.w / 2 < W) };
}
/** Déplace la diapo `from` à la place `to` (tous ses calques suivent, selon leur centre). */
export function moveSlide(d, from, to) {
  if (from === to || from < 0 || to < 0 || from >= d.slides || to >= d.slides) return d;
  const order = [...Array(d.slides).keys()];
  order.splice(to, 0, ...order.splice(from, 1));
  const newIndex = order.map((_, i) => order.indexOf(i));
  return {
    ...d,
    layers: d.layers.map((l) => {
      const s = Math.min(d.slides - 1, Math.max(0, Math.floor(l.x / SLIDE_W)));
      return { ...l, x: l.x + (newIndex[s] - s) * SLIDE_W };
    }),
  };
}
