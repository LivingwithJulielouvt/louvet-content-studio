"use client";
import { AddToCalendarButton } from "./add-to-calendar";
import { LayerPicker, LayerEditor, layeredName } from "./layer-studio";
// Atelier « Modèles » : visuels prêts à publier, composés dans le navigateur (canvas).
// Aucun appel à l'IA d'image : le texte est écrit exactement comme saisi, et les photos du client ne sont jamais retouchées.
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, Trash2, Pencil, Sparkles, Upload, Loader2, Check, Film, Shapes, Type, ImagePlus, AlertCircle, LayoutGrid, Shuffle, X, Move } from "lucide-react";
import { useL, useLang, pick, type Lang } from "../lib/i18n";
import { uploadStudioMedia } from "../lib/direct-upload-client";
import {
  FORMATS,
  TEMPLATE_FONTS,
  BODY_FONT,
  SCRIPT_FONT,
  fontById,
  templateById,
  orderedTemplates,
  paletteFrom,
  bestTextColor,
  contrastRatio,
  readableAccent,
  fitText,
  splitCarousel,
  beforeAfterSize,
} from "../lib/templates.mjs";
import { drawTrendy, trendyCanvasSize, TRENDY_FONT_LIST, sliceCarousel } from "../lib/trendy-draw.mjs";

type Row = Record<string, any>;
type Tpl = {
  id: string;
  fields: Record<string, string>;
  photos: string[];
  format: "4:5" | "1:1" | "9:16";
  font: string;
  bg: string;
  fg: string | null;
  accent: string | null;
  align: "left" | "center";
  scale: number;
  texture: boolean;
  showHandle: boolean;
  handle: string;
  layout: "side" | "diagonal" | "stack";
  fit: "cover" | "contain";
  slide: number;
  reviewConfirmed: boolean;
  // Montages photo tendance
  carousel?: boolean;
  filter?: "none" | "film";
  crops?: Crop[];
};
type Crop = { x: number; y: number; z: number };
type Slot = { i: number; x: number; y: number; w: number; h: number };
const isTrendyTpl = (t: { id: string }) => templateById(t.id)?.group === "trendy";
const canvasSize = (t: Tpl): [number, number] => (isTrendyTpl(t) ? (trendyCanvasSize(t) as [number, number]) : (FORMATS[t.format] as [number, number]));
const makeCanvas = (w: number, h: number) => Object.assign(document.createElement("canvas"), { width: w, height: h });
type Img = HTMLImageElement;
type Assets = { photos: (Img | null)[]; logo: Img | null };

// ---------- Chargement des polices (libres, servies par le studio) et des photos ----------
const fontLoads = new Map<string, Promise<void>>();
function loadFont(f: { family: string; file: string; weight: number }) {
  if (typeof window === "undefined" || !("FontFace" in window)) return Promise.resolve();
  if (!fontLoads.has(f.family)) {
    const face = new FontFace(f.family, `url(/media-engine/fonts/${f.file})`, { weight: String(f.weight) });
    fontLoads.set(
      f.family,
      face
        .load()
        .then((ff) => {
          (document.fonts as any).add(ff);
        })
        .catch(() => {}),
    );
  }
  return fontLoads.get(f.family)!;
}
const allFonts = () => Promise.all([...TEMPLATE_FONTS, BODY_FONT, ...TRENDY_FONT_LIST].map(loadFont));
const imageCache = new Map<string, Promise<Img | null>>();
function loadPhoto(id: string): Promise<Img | null> {
  if (!id) return Promise.resolve(null);
  if (!imageCache.has(id))
    imageCache.set(
      id,
      fetch("/api/studio/file/" + encodeURIComponent(id))
        .then((r) => (r.ok ? r.blob() : Promise.reject()))
        .then(
          (blob) =>
            new Promise<Img | null>((resolve) => {
              // Image chargée depuis un blob local : le canvas reste exportable.
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = () => resolve(null);
              img.src = URL.createObjectURL(blob);
            }),
        )
        .catch(() => null),
    );
  return imageCache.get(id)!;
}

// Exemples remplis pour les aperçus du catalogue (jamais utilisés comme texte final).
const EXAMPLES: Record<string, Record<string, [string, string, string]>> = {
  quote: { text: ["Le plus important, c’est de commencer.", "Lo más importante es empezar.", "The most important thing is to start."] },
  announce: { title: ["Ouverture samedi", "Abrimos el sábado", "Opening Saturday"], body: ["Venez nous voir dès 10 h.", "Ven a vernos desde las 10.", "Come see us from 10 am."] },
  tip: { title: ["Notre astuce du jour", "Nuestro consejo del día", "Our tip of the day"], body: ["Un geste simple qui change tout.", "Un gesto simple que lo cambia todo.", "One simple step that changes everything."] },
  list: { title: ["3 conseils pour bien commencer", "3 consejos para empezar bien", "3 tips to start well"], item1: ["Prenez votre temps", "Tómate tu tiempo", "Take your time"], item2: ["Restez simple", "Hazlo simple", "Keep it simple"], item3: ["Soyez régulière", "Sé constante", "Be consistent"] },
  question: { text: ["Plutôt matin ou plutôt soir ?", "¿Más de mañana o de noche?", "Morning person or night owl?"] },
  number: { number: ["250", "250", "250"], label: ["clientes accompagnées", "clientas acompañadas", "clients supported"] },
  carousel: { title: ["5 idées à tester", "5 ideas para probar", "5 ideas to try"] },
  steps: { title: ["Comment ça se passe", "Cómo funciona", "How it works"] },
  offer: { title: ["-20 % cette semaine", "-20 % esta semana", "20% off this week"] },
  review: { quote: ["Votre avis client ici.", "La opinión de tu cliente aquí.", "Your customer review here."], name: ["Prénom", "Nombre", "Name"] },
  behind: { note: ["Ce matin à l’atelier…", "Esta mañana en el taller…", "This morning at the studio…"] },
};
/** Modèle d'aperçu du catalogue, rempli avec un exemple dans la langue de l'écran. */
export function exampleTemplate(id: string, config: Row, lang: Lang) {
  const t = newTemplate(id, config);
  const ex = EXAMPLES[id];
  if (ex) {
    const i = lang === "es" ? 1 : lang === "en" ? 2 : 0;
    t.fields = { ...t.fields, ...Object.fromEntries(Object.entries(ex).map(([k, v]) => [k, v[i]])) };
  }
  return t;
}

// ---------- Dessin ----------
const fontCss = (f: { family: string; weight: number }, size: number) => `${f.weight} ${Math.round(size)}px "${f.family}", sans-serif`;
const isBracket = (s?: string) => !!s && /^\[.*\]$/.test(s.trim());
function valueOf(tpl: Tpl, key: string, lang: Lang, preview: boolean) {
  const def = templateById(tpl.id)! as Row;
  const f = def.fields.find((x: Row) => x.key === key) as Row | undefined;
  const v = (tpl.fields[key] || "").trim();
  if (v) return v;
  const ph = f?.placeholder ? pick(lang, f.placeholder.fr, f.placeholder.es, f.placeholder.en) : "";
  if (ph && !isBracket(ph)) return ph; // valeur par défaut (ex. « Avant », « Nouveau »)
  return preview ? ph : "";
}
/** Champs encore vides qui doivent être remplis avant d'exporter (les « [ … ] »). */
export function missingFields(tpl: Tpl) {
  const def = templateById(tpl.id);
  if (!def) return [];
  return def.fields.filter((f: Row) => f.placeholder && isBracket(f.placeholder.fr) && !(tpl.fields[f.key] || "").trim());
}
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function grain(ctx: CanvasRenderingContext2D, W: number, H: number, ink: string) {
  const rnd = seeded(7);
  ctx.save();
  ctx.fillStyle = ink;
  for (let i = 0; i < (W * H) / 260; i++) {
    ctx.globalAlpha = 0.025 + rnd() * 0.035;
    ctx.fillRect(rnd() * W, rnd() * H, 1.6, 1.6);
  }
  ctx.restore();
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
/** Photo dans une zone : « cover » remplit (recadrage), « contain » montre la photo entière. Les pixels ne sont pas retouchés. */
function drawPhoto(ctx: CanvasRenderingContext2D, img: Img | null, x: number, y: number, w: number, h: number, fit: "cover" | "contain", empty = "#D9D4CB") {
  if (!img) {
    // Emplacement vide : une petite scène douce (lumière, table, objet) plutôt qu'un gris, pour que l'aperçu donne envie.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, "#EFE6DA");
    g.addColorStop(1, empty === "#D9D4CB" ? "#D6C3AE" : empty);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.beginPath();
    ctx.arc(x + w * 0.74, y + h * 0.26, Math.min(w, h) * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(122,82,68,.16)";
    ctx.fillRect(x, y + h * 0.72, w, h * 0.28);
    ctx.fillStyle = "rgba(122,82,68,.28)";
    const bw = Math.min(w, h) * 0.18;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.42, y + h * 0.72, bw * 0.9, bw * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(122,82,68,.42)";
    ctx.fillRect(x + w * 0.42 - bw * 0.45, y + h * 0.72 - bw * 1.25, bw * 0.9, bw * 1.25);
    ctx.strokeStyle = "rgba(0,0,0,.10)";
    ctx.lineWidth = 4;
    const s = Math.min(w, h) * 0.16;
    ctx.strokeRect(x + w / 2 - s, y + h / 2 - s * 0.7, s * 2, s * 1.4);
    ctx.beginPath();
    ctx.arc(x + w / 2 - s * 0.35, y + h / 2 - s * 0.2, s * 0.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const r = img.naturalWidth / img.naturalHeight,
    zr = w / h;
  if (fit === "cover") {
    let sw = img.naturalWidth,
      sh = img.naturalHeight,
      sx = 0,
      sy = 0;
    if (r > zr) {
      sw = sh * zr;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = sw / zr;
      sy = (img.naturalHeight - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  } else {
    let dw = w,
      dh = h;
    if (r > zr) dh = w / r;
    else dw = h * r;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
}
type Block = { x: number; y: number; w: number; h: number; font: { family: string; weight: number }; max: number; min?: number; color: string; align: "left" | "center"; lh?: number; valign?: "top" | "middle" | "bottom"; alpha?: number; upper?: boolean; spacing?: number };
/** Texte ajusté à sa boîte (taille maximale qui tient). Renvoie la hauteur réellement utilisée. */
function textBlock(ctx: CanvasRenderingContext2D, raw: string, b: Block) {
  const text = b.upper ? raw.toUpperCase() : raw;
  if (!text) return 0;
  const lh = b.lh ?? 1.18;
  const measureAt = (size: number) => {
    ctx.font = fontCss(b.font, size);
    return (s: string) => ctx.measureText(s).width + (b.spacing ? s.length * b.spacing * size : 0);
  };
  const fit = fitText(text, { maxWidth: b.w, maxHeight: b.h, maxSize: b.max, minSize: b.min ?? 22, lineHeight: lh }, measureAt);
  ctx.save();
  ctx.font = fontCss(b.font, fit.size);
  ctx.fillStyle = b.color;
  ctx.globalAlpha = b.alpha ?? 1;
  ctx.textBaseline = "alphabetic";
  if (b.spacing) (ctx as any).letterSpacing = b.spacing * fit.size + "px";
  const used = fit.lines.length * fit.size * lh;
  let y = b.y + (b.valign === "middle" ? (b.h - used) / 2 : b.valign === "bottom" ? b.h - used : 0) + fit.size * 0.92;
  for (const line of fit.lines) {
    const w = ctx.measureText(line).width;
    ctx.fillText(line, b.align === "center" ? b.x + (b.w - w) / 2 : b.x, y);
    y += fit.size * lh;
  }
  ctx.restore();
  return used;
}
function pill(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, bg: string, size: number, align: "left" | "center" | "right" = "left") {
  if (!label) return;
  ctx.save();
  ctx.font = fontCss(BODY_FONT, size);
  const w = ctx.measureText(label).width + size * 1.6,
    h = size * 2;
  const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  ctx.fillStyle = bg;
  roundRect(ctx, left, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = bestTextColor(bg);
  ctx.textBaseline = "middle";
  ctx.fillText(label, left + size * 0.8, y + h / 2 + size * 0.04);
  ctx.restore();
  return w;
}
function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5,
      rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}
function signature(ctx: CanvasRenderingContext2D, tpl: Tpl, assets: Assets, W: number, H: number, color: string, y = H - 74) {
  if (!tpl.showHandle) return;
  if (assets.logo) {
    const h = 64,
      w = (assets.logo.naturalWidth / assets.logo.naturalHeight) * h;
    ctx.drawImage(assets.logo, (W - Math.min(w, 300)) / 2, y - h / 2, Math.min(w, 300), h * (Math.min(w, 300) / w));
    return;
  }
  const handle = tpl.handle.trim();
  if (!handle) return;
  ctx.save();
  ctx.font = fontCss(BODY_FONT, 30);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.78;
  const t = handle.startsWith("@") || handle.includes(".") ? handle : "@" + handle;
  ctx.textAlign = "center";
  ctx.fillText(t, W / 2, y + 10);
  ctx.restore();
}
/** Les slides d'un carrousel : couverture + contenu (2 à 6 au total). */
export function carouselSlides(tpl: Tpl, lang: Lang, preview = true) {
  const body = splitCarousel(tpl.fields.text || "");
  const content = body.length
    ? body
    : preview
      ? [pick(lang, "Écrivez le contenu de vos diapos…", "Escribe el contenido de tus diapositivas…", "Write your slides content…")]
      : [];
  return [valueOf(tpl, "title", lang, preview), ...content];
}
export function drawDesign(canvas: HTMLCanvasElement, tpl: Tpl, assets: Assets, lang: Lang, preview: boolean): Slot[] {
  if (isTrendyTpl(tpl)) {
    const [tw, th] = canvasSize(tpl);
    canvas.width = tw;
    canvas.height = th;
    return drawTrendy(canvas.getContext("2d")!, tpl, { photos: assets.photos, lang, preview, makeCanvas }) as Slot[];
  }
  const [W, H] = FORMATS[tpl.format];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const bg = tpl.bg,
    fg = tpl.fg || bestTextColor(bg),
    accent = readableAccent(tpl.accent || "", bg, fg),
    F = fontById(tpl.font),
    k = tpl.scale,
    M = 96,
    al = tpl.align,
    v = (key: string) => valueOf(tpl, key, lang, preview),
    tall = H / W;
  const ph = (key: string) => !(tpl.fields[key] || "").trim() && preview; // texte d'exemple : plus léger
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const P = assets.photos;
  const fit = tpl.fit;
  switch (tpl.id) {
    case "quote": {
      ctx.save();
      ctx.font = fontCss(fontById("playfair"), 260);
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.9;
      ctx.textAlign = al === "center" ? "center" : "left";
      ctx.fillText("“", al === "center" ? W / 2 : M - 10, H * 0.27);
      ctx.restore();
      const used = textBlock(ctx, v("text"), { x: M, y: H * 0.3, w: W - 2 * M, h: H * 0.44, font: F, max: 92 * k, min: 34, color: fg, align: al, valign: "middle", alpha: ph("text") ? 0.45 : 1 });
      const by = H * 0.3 + H * 0.44 / 2 + used / 2 + 50;
      if (v("author")) textBlock(ctx, "— " + v("author"), { x: M, y: by, w: W - 2 * M, h: 60, font: BODY_FONT, max: 34, color: fg, align: al, alpha: 0.8 });
      signature(ctx, tpl, assets, W, H, fg);
      break;
    }
    case "announce": {
      const top = H * 0.2;
      if (v("kicker")) textBlock(ctx, v("kicker"), { x: M, y: top, w: W - 2 * M, h: 50, font: BODY_FONT, max: 30, color: accent, align: al, upper: true, spacing: 0.18 });
      const used = textBlock(ctx, v("title"), { x: M, y: top + 80, w: W - 2 * M, h: H * 0.36, font: F, max: 118 * k, min: 40, color: fg, align: al, alpha: ph("title") ? 0.45 : 1, lh: 1.08 });
      let y = top + 80 + used + 40;
      if (v("body")) y += textBlock(ctx, v("body"), { x: M, y, w: W - 2 * M, h: H * 0.2, font: BODY_FONT, max: 40 * k, min: 24, color: fg, align: al, alpha: 0.85, lh: 1.4 }) + 50;
      if (v("cta")) pill(ctx, v("cta"), al === "center" ? W / 2 : M, Math.min(y, H - 230), accent, 32, al === "center" ? "center" : "left");
      signature(ctx, tpl, assets, W, H, fg);
      break;
    }
    case "tip": {
      pill(ctx, pick(lang, "ASTUCE", "CONSEJO", "TIP"), al === "center" ? W / 2 : M, H * 0.16, accent, 28, al === "center" ? "center" : "left");
      const used = textBlock(ctx, v("title"), { x: M, y: H * 0.16 + 110, w: W - 2 * M, h: H * 0.26, font: F, max: 96 * k, min: 36, color: fg, align: al, alpha: ph("title") ? 0.45 : 1, lh: 1.1 });
      ctx.save();
      ctx.fillStyle = accent;
      ctx.fillRect(al === "center" ? W / 2 - 50 : M, H * 0.16 + 140 + used, 100, 6);
      ctx.restore();
      textBlock(ctx, v("body") || (preview ? pick(lang, "Votre conseil, en deux ou trois phrases.", "Tu consejo, en dos o tres frases.", "Your tip, in two or three sentences.") : ""), {
        x: M, y: H * 0.16 + 190 + used, w: W - 2 * M, h: H * 0.78 - (H * 0.16 + 190 + used), font: BODY_FONT, max: 46 * k, min: 24, color: fg, align: al, lh: 1.45, alpha: ph("body") ? 0.45 : 0.9,
      });
      signature(ctx, tpl, assets, W, H, fg);
      break;
    }
    case "list": {
      const used = textBlock(ctx, v("title"), { x: M, y: H * 0.12, w: W - 2 * M, h: H * 0.22, font: F, max: 88 * k, min: 36, color: fg, align: al, alpha: ph("title") ? 0.45 : 1, lh: 1.1 });
      const items = ["item1", "item2", "item3"].map((key, i) => tpl.fields[key]?.trim() || (preview ? pick(lang, `Conseil ${i + 1}`, `Consejo ${i + 1}`, `Tip ${i + 1}`) : "")).filter(Boolean);
      const start = H * 0.12 + used + 70,
        avail = H - 170 - start,
        row = avail / Math.max(3, items.length);
      items.forEach((it, i) => {
        const y = start + i * row;
        ctx.save();
        ctx.font = fontCss(F, 90 * k);
        ctx.fillStyle = accent;
        ctx.fillText(String(i + 1), M, y + 86 * k);
        ctx.restore();
        textBlock(ctx, it, { x: M + 120, y: y + 6, w: W - 2 * M - 120, h: row - 30, font: BODY_FONT, max: 44 * k, min: 22, color: fg, align: "left", lh: 1.35, alpha: tpl.fields[`item${i + 1}`]?.trim() ? 1 : 0.45 });
      });
      signature(ctx, tpl, assets, W, H, fg);
      break;
    }
    case "question": {
      ctx.save();
      ctx.font = fontCss(F, 900);
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.12;
      ctx.textAlign = "center";
      ctx.fillText("?", W / 2, H * 0.78);
      ctx.restore();
      const used = textBlock(ctx, v("text"), { x: M, y: H * 0.22, w: W - 2 * M, h: H * 0.46, font: F, max: 104 * k, min: 38, color: fg, align: al, valign: "middle", alpha: ph("text") ? 0.45 : 1, lh: 1.12 });
      const y = H * 0.22 + H * 0.23 + used / 2 + 60;
      if (v("cta")) textBlock(ctx, v("cta") + "  ↓", { x: M, y, w: W - 2 * M, h: 60, font: BODY_FONT, max: 34, color: accent, align: al });
      signature(ctx, tpl, assets, W, H, fg);
      break;
    }
    case "number": {
      const used = textBlock(ctx, v("number"), { x: M, y: H * 0.18, w: W - 2 * M, h: H * 0.36, font: F, max: 420 * k, min: 80, color: accent, align: al, valign: "bottom", alpha: ph("number") ? 0.45 : 1, lh: 1 });
      textBlock(ctx, v("label") || (preview ? pick(lang, "Ce que ce chiffre représente pour vous.", "Lo que esta cifra significa para ti.", "What this number means for you.") : ""), {
        x: M, y: H * 0.56, w: W - 2 * M, h: H * 0.22, font: BODY_FONT, max: 50 * k, min: 24, color: fg, align: al, lh: 1.35, alpha: ph("label") ? 0.45 : 1,
      });
      void used;
      if (v("source")) textBlock(ctx, pick(lang, "Source : ", "Fuente: ", "Source: ") + v("source"), { x: M, y: H - 190, w: W - 2 * M, h: 40, font: BODY_FONT, max: 24, color: fg, align: al, alpha: 0.65 });
      signature(ctx, tpl, assets, W, H, fg);
      break;
    }
    case "carousel": {
      const slides = carouselSlides(tpl, lang, preview),
        i = Math.min(tpl.slide, slides.length - 1),
        n = slides.length;
      if (i === 0) {
        textBlock(ctx, slides[0], { x: M, y: H * 0.2, w: W - 2 * M, h: H * 0.5, font: F, max: 120 * k, min: 40, color: fg, align: al, valign: "middle", alpha: ph("title") ? 0.45 : 1, lh: 1.08 });
        textBlock(ctx, pick(lang, "Glissez →", "Desliza →", "Swipe →"), { x: M, y: H * 0.76, w: W - 2 * M, h: 50, font: BODY_FONT, max: 32, color: accent, align: al });
      } else {
        textBlock(ctx, `${i + 1}/${n}`, { x: M, y: 70, w: W - 2 * M, h: 40, font: BODY_FONT, max: 28, color: fg, align: "left", alpha: 0.6 });
        ctx.save();
        ctx.fillStyle = accent;
        ctx.fillRect(M, 140, 80, 6);
        ctx.restore();
        textBlock(ctx, slides[i], { x: M, y: 200, w: W - 2 * M, h: H - 420, font: BODY_FONT, max: 64 * k, min: 26, color: fg, align: al, valign: "middle", lh: 1.35 });
        if (i < n - 1) textBlock(ctx, "→", { x: M, y: H - 190, w: W - 2 * M, h: 60, font: BODY_FONT, max: 44, color: accent, align: "left" });
      }
      signature(ctx, tpl, assets, W, H, fg);
      break;
    }
    case "beforeAfter": {
      const titled = !!v("title"),
        top = titled ? 170 : 0;
      if (titled) textBlock(ctx, v("title"), { x: M / 2, y: 40, w: W - M, h: 100, font: F, max: 64 * k, min: 28, color: fg, align: "center", valign: "middle" });
      const h = H - top,
        g = 10;
      if (tpl.layout === "stack") {
        drawPhoto(ctx, P[0], 0, top, W, h / 2 - g / 2, "cover");
        drawPhoto(ctx, P[1], 0, top + h / 2 + g / 2, W, h / 2 - g / 2, "cover");
        pill(ctx, v("before"), 40, top + 36, "#FFFFFF", 30);
        pill(ctx, v("after"), 40, top + h / 2 + 46, accent === fg ? "#1A1A1A" : accent, 30);
      } else if (tpl.layout === "diagonal") {
        drawPhoto(ctx, P[0], 0, top, W, h, "cover");
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(W * 0.62, top);
        ctx.lineTo(W, top);
        ctx.lineTo(W, H);
        ctx.lineTo(W * 0.38, H);
        ctx.closePath();
        ctx.clip();
        drawPhoto(ctx, P[1], 0, top, W, h, "cover");
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(W * 0.62, top);
        ctx.lineTo(W * 0.38, H);
        ctx.stroke();
        ctx.restore();
        pill(ctx, v("before"), 40, top + 36, "#FFFFFF", 30);
        pill(ctx, v("after"), W - 40, H - 110, accent === fg ? "#1A1A1A" : accent, 30, "right");
      } else {
        drawPhoto(ctx, P[0], 0, top, W / 2 - g / 2, h, "cover");
        drawPhoto(ctx, P[1], W / 2 + g / 2, top, W / 2 - g / 2, h, "cover");
        pill(ctx, v("before"), 36, top + 36, "#FFFFFF", 30);
        pill(ctx, v("after"), W / 2 + g / 2 + 36, top + 36, accent === fg ? "#1A1A1A" : accent, 30);
      }
      break;
    }
    case "portfolio": {
      const m = 80,
        bottom = (tpl.fields.title || tpl.fields.caption || preview ? 250 : 120) * (tall > 1.5 ? 1.2 : 1);
      drawPhoto(ctx, P[0], m, m, W - 2 * m, H - m - bottom, fit, "#CFC9BF");
      ctx.save();
      ctx.strokeStyle = fg;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 2;
      ctx.strokeRect(m - 14, m - 14, W - 2 * m + 28, H - m - bottom + 28);
      ctx.restore();
      const ty = H - bottom + 46;
      const used = textBlock(ctx, v("title") || (preview ? pick(lang, "Titre de la série", "Título de la serie", "Series title") : ""), { x: m, y: ty, w: W - 2 * m, h: 80, font: F, max: 56 * k, min: 28, color: fg, align: al, alpha: ph("title") ? 0.45 : 1 });
      if (v("caption")) textBlock(ctx, v("caption"), { x: m, y: ty + used + 14, w: W - 2 * m, h: 70, font: BODY_FONT, max: 28, min: 20, color: fg, align: al, alpha: 0.75 });
      if (v("credit")) {
        ctx.save();
        ctx.font = fontCss(BODY_FONT, 22);
        ctx.fillStyle = fg;
        ctx.globalAlpha = 0.7;
        ctx.textAlign = "right";
        ctx.fillText("© " + v("credit"), W - m, H - 34);
        ctx.restore();
      }
      break;
    }
    case "collage": {
      const g = 14,
        titled = !!v("title"),
        bottom = titled ? 160 : g,
        n = Math.max(2, Math.min(4, P.length || 2)),
        x0 = g,
        y0 = g,
        w = W - 2 * g,
        h = H - g - bottom;
      const cells: [number, number, number, number][] =
        n === 2
          ? tall > 1.1
            ? [[x0, y0, w, h / 2 - g / 2], [x0, y0 + h / 2 + g / 2, w, h / 2 - g / 2]]
            : [[x0, y0, w / 2 - g / 2, h], [x0 + w / 2 + g / 2, y0, w / 2 - g / 2, h]]
          : n === 3
            ? [[x0, y0, w, h * 0.58 - g / 2], [x0, y0 + h * 0.58 + g / 2, w / 2 - g / 2, h * 0.42 - g / 2], [x0 + w / 2 + g / 2, y0 + h * 0.58 + g / 2, w / 2 - g / 2, h * 0.42 - g / 2]]
            : [[x0, y0, w / 2 - g / 2, h / 2 - g / 2], [x0 + w / 2 + g / 2, y0, w / 2 - g / 2, h / 2 - g / 2], [x0, y0 + h / 2 + g / 2, w / 2 - g / 2, h / 2 - g / 2], [x0 + w / 2 + g / 2, y0 + h / 2 + g / 2, w / 2 - g / 2, h / 2 - g / 2]];
      cells.forEach(([x, y, cw, chh], i) => drawPhoto(ctx, P[i] || null, x, y, cw, chh, "cover"));
      if (titled) textBlock(ctx, v("title"), { x: M / 2, y: H - bottom + 30, w: W - M, h: bottom - 60, font: F, max: 60 * k, min: 26, color: fg, align: "center", valign: "middle" });
      break;
    }
    case "behind": {
      drawPhoto(ctx, P[0], 0, 0, W, H, "cover");
      const note = v("note"),
        nw = W * 0.72,
        nh = Math.min(H * 0.28, 380),
        nx = (W - nw) / 2,
        ny = H - nh - 110;
      if (note) {
        ctx.save();
        ctx.translate(nx + nw / 2, ny + nh / 2);
        ctx.rotate(-0.035);
        ctx.shadowColor = "rgba(0,0,0,.28)";
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 12;
        ctx.fillStyle = "#FFF8E8";
        ctx.fillRect(-nw / 2, -nh / 2, nw, nh);
        ctx.shadowColor = "transparent";
        ctx.fillStyle = "rgba(200,170,110,.45)";
        ctx.fillRect(-70, -nh / 2 - 22, 140, 44);
        ctx.restore();
        ctx.save();
        ctx.translate(nx + nw / 2, ny + nh / 2);
        ctx.rotate(-0.035);
        ctx.translate(-(nx + nw / 2), -(ny + nh / 2));
        textBlock(ctx, note, { x: nx + 50, y: ny + 36, w: nw - 100, h: nh - 72, font: SCRIPT_FONT!, max: 78 * k, min: 30, color: "#2B2622", align: "center", valign: "middle", lh: 1.1, alpha: ph("note") ? 0.5 : 1 });
        ctx.restore();
      }
      break;
    }
    case "steps": {
      const used = textBlock(ctx, v("title"), { x: M, y: 90, w: W - 2 * M, h: H * 0.16, font: F, max: 80 * k, min: 32, color: fg, align: al, alpha: ph("title") ? 0.45 : 1, lh: 1.1 });
      const start = 90 + used + 60,
        row = (H - 150 - start) / 3,
        thumb = Math.min(row - 30, 230);
      ["step1", "step2", "step3"].forEach((key, i) => {
        const y = start + i * row;
        if (P[i]) {
          ctx.save();
          roundRect(ctx, M, y, thumb, thumb, 24);
          ctx.clip();
          drawPhoto(ctx, P[i], M, y, thumb, thumb, "cover");
          ctx.restore();
          pill(ctx, String(i + 1), M + 14, y + 14, accent, 26);
        } else {
          ctx.save();
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(M + thumb / 2, y + thumb / 2, thumb * 0.36, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = fontCss(F, thumb * 0.36);
          ctx.fillStyle = bestTextColor(accent);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(i + 1), M + thumb / 2, y + thumb / 2 + 4);
          ctx.restore();
        }
        const t = tpl.fields[key]?.trim() || (preview ? pick(lang, `Étape ${i + 1}`, `Paso ${i + 1}`, `Step ${i + 1}`) : "");
        textBlock(ctx, t, { x: M + thumb + 40, y, w: W - 2 * M - thumb - 40, h: thumb, font: BODY_FONT, max: 42 * k, min: 22, color: fg, align: "left", valign: "middle", lh: 1.3, alpha: tpl.fields[key]?.trim() ? 1 : 0.45 });
      });
      signature(ctx, tpl, assets, W, H, fg, H - 60);
      break;
    }
    case "offer": {
      const ph2 = H * (tall > 1.5 ? 0.55 : 0.56);
      drawPhoto(ctx, P[0], 0, 0, W, ph2, "cover");
      let y = ph2 + 60;
      y += textBlock(ctx, v("title"), { x: M, y, w: W - 2 * M, h: H * 0.13, font: F, max: 76 * k, min: 30, color: fg, align: al, alpha: ph("title") ? 0.45 : 1, lh: 1.08 }) + 24;
      if (v("price")) y += textBlock(ctx, v("price"), { x: M, y, w: W - 2 * M, h: 110, font: F, max: 96 * k, min: 36, color: accent, align: al }) + 18;
      if (v("terms")) y += textBlock(ctx, v("terms"), { x: M, y, w: W - 2 * M, h: 90, font: BODY_FONT, max: 28, min: 20, color: fg, align: al, alpha: 0.75, lh: 1.35 }) + 30;
      if (v("cta")) pill(ctx, v("cta"), al === "center" ? W / 2 : M, Math.min(y, H - 120), accent, 30, al === "center" ? "center" : "left");
      break;
    }
    case "review": {
      let y = H * 0.12;
      if (P[0]) {
        const r = 120;
        ctx.save();
        ctx.beginPath();
        ctx.arc(W / 2, y + r, r, 0, Math.PI * 2);
        ctx.clip();
        drawPhoto(ctx, P[0], W / 2 - r, y, 2 * r, 2 * r, "cover");
        ctx.restore();
        y += 2 * r + 60;
      } else y += 40;
      const n = Math.max(1, Math.min(5, Number(tpl.fields.stars || 5) || 5));
      ctx.save();
      ctx.fillStyle = accent;
      for (let i = 0; i < 5; i++) {
        ctx.globalAlpha = i < n ? 1 : 0.2;
        star(ctx, W / 2 + (i - 2) * 72, y + 30, 28);
      }
      ctx.restore();
      y += 110;
      const used = textBlock(ctx, "“" + v("quote") + "”", { x: M, y, w: W - 2 * M, h: H - y - 260, font: F, max: 68 * k, min: 28, color: fg, align: "center", valign: "middle", lh: 1.25, alpha: ph("quote") ? 0.45 : 1 });
      void used;
      textBlock(ctx, "— " + v("name"), { x: M, y: H - 230, w: W - 2 * M, h: 50, font: BODY_FONT, max: 34, color: fg, align: "center", alpha: ph("name") ? 0.45 : 0.85 });
      signature(ctx, tpl, assets, W, H, fg);
      break;
    }
  }
  if (tpl.texture) grain(ctx, W, H, fg);
  return [];
}
/** Image d'une vidéo avant / après (photo entière + étiquette), préparée avant le passage dans le moteur vidéo. */
function baFrame(img: Img | null, label: string, tpl: Tpl, after: boolean) {
  const { width, height } = beforeAfterSize(tpl.format);
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = tpl.bg;
  ctx.fillRect(0, 0, width, height);
  drawPhoto(ctx, img, 0, 0, width, height, "cover");
  const accent = readableAccent(tpl.accent || "", tpl.bg, tpl.fg || bestTextColor(tpl.bg));
  pill(ctx, label, after ? width - 28 : 28, 28, after ? accent : "#FFFFFF", 24, after ? "right" : "left");
  return new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
}
const toBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((res) =>
    c.toBlob((png) => {
      if (png && png.size < 7.5 * 1024 * 1024) return res(png);
      c.toBlob((jpg) => res(jpg!), "image/jpeg", 0.92);
    }, "image/png"),
  );

// ---------- Valeurs par défaut ----------
const DEFAULT_FONT: Record<string, string> = {
  quote: "playfair",
  announce: "poppins",
  tip: "lora",
  list: "poppins",
  question: "dmserif",
  number: "bebas",
  carousel: "spacegrotesk",
  beforeAfter: "poppins",
  portfolio: "playfair",
  collage: "poppins",
  behind: "poppins",
  steps: "poppins",
  offer: "montserrat",
  review: "lora",
};
const DEFAULT_BG: Record<string, string> = {
  quote: "#F6F1E9",
  announce: "#1A1A1A",
  tip: "#EDE4D3",
  list: "#F6F1E9",
  question: "#2F4A3A",
  number: "#F3D9D1",
  carousel: "#E9EEF2",
  beforeAfter: "#FFFFFF",
  portfolio: "#F6F1E9",
  collage: "#FFFFFF",
  behind: "#1A1A1A",
  steps: "#F6F1E9",
  offer: "#FFFFFF",
  review: "#EDE4D3",
};
export function newTemplate(id: string, config: Row): Tpl {
  const palette = paletteFrom(config);
  const brand = palette.length > 8 ? palette[0] : null; // une couleur de marque existe
  const def = templateById(id) as Row | null;
  if (def?.group === "trendy")
    return {
      id,
      fields: {},
      photos: [],
      format: def.formats[0] || "4:5",
      font: def.font,
      bg: def.bg,
      fg: null,
      accent: config.templateAccent || brand || "#B8291A",
      align: "center",
      scale: 1,
      texture: false,
      showHandle: true,
      handle: config.templateHandle || "",
      layout: "side",
      fit: "cover",
      slide: 0,
      reviewConfirmed: false,
      carousel: !def.formats.length,
      filter: "none",
      crops: [],
    };
  return {
    id,
    fields: {},
    photos: [],
    format: "4:5",
    font: config.templateFont || DEFAULT_FONT[id] || "playfair",
    bg: config.templateBg || DEFAULT_BG[id] || "#F6F1E9",
    fg: null,
    accent: config.templateAccent || brand || "#B8291A",
    align: id === "list" || id === "steps" ? "left" : "center",
    scale: 1,
    texture: false,
    showHandle: true,
    handle: config.templateHandle || "",
    layout: "side",
    fit: id === "portfolio" ? "contain" : "cover",
    slide: 0,
    reviewConfirmed: false,
  };
}
const fromSaved = (t: Row, config: Row): Tpl => ({ ...newTemplate(t.id, config), ...t, fields: { ...(t.fields || {}) }, photos: [...(t.photos || [])], crops: [...(t.crops || [])], reviewConfirmed: false, slide: 0 });

async function post(action: string, body: Row) {
  const r = await fetch("/api/studio/" + action, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Studio-Request": "1" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Erreur");
  return d;
}

// ---------- Aperçu (canvas redessiné à chaque changement) ----------
export function Preview({
  tpl,
  lang,
  preview = true,
  className,
  label,
  onSlots,
}: {
  tpl: Tpl;
  lang: Lang;
  preview?: boolean;
  className?: string;
  label?: string;
  onSlots?: (s: Slot[]) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(0);
  const key = JSON.stringify(tpl);
  useEffect(() => {
    let live = true;
    (async () => {
      await allFonts();
      const photos = await Promise.all(tpl.photos.map(loadPhoto));
      const cfgLogo = (tpl as any)._logo as string | undefined;
      const logo = cfgLogo ? await loadPhoto(cfgLogo) : null;
      if (live && ref.current) {
        const slots = drawDesign(ref.current, tpl, { photos, logo }, lang, preview);
        onSlots?.(slots);
        setReady((n) => n + 1);
      }
    })();
    return () => {
      live = false;
    };
  }, [key, lang, preview]);
  const [W, H] = canvasSize(tpl);
  return <canvas ref={ref} width={W} height={H} className={className} aria-label={label} role="img" data-ready={ready > 0 ? "1" : "0"} />;
}

/** Aperçu d'un montage tendance : toucher une photo pour la choisir, puis la faire glisser (ou pincer) pour la recadrer. */
function TrendyStage({
  tpl,
  lang,
  active,
  cropping,
  onActive,
  onCrop,
  onDone,
  label,
}: {
  tpl: Tpl;
  lang: Lang;
  active: number;
  cropping: boolean;
  onActive: (i: number, hasPhoto: boolean) => void;
  onCrop: (i: number, c: Crop) => void;
  onDone: () => void;
  label: string;
}) {
  const L = useL();
  const [slots, setSlots] = useState<Slot[]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<{ i: number; sx: number; sy: number; c: Crop; slot: Slot; d0?: number } | null>(null);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const [W, H] = canvasSize(tpl);
  const toCanvas = (e: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, k: W / r.width };
  };
  const hit = (x: number, y: number) => [...slots].reverse().find((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
  const crop = (i: number): Crop => ({ x: 0, y: 0, z: 1, ...(tpl.crops?.[i] || {}) });
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const box = slots.find((s) => s.i === active);
  return (
    <div className={"trendy-stage " + (W > H ? "wide" : "fmt-" + tpl.format.replace(":", "-"))}>
      <div
        ref={wrap}
        className="trendy-canvas-wrap"
        style={{ touchAction: cropping ? "none" : "manipulation" }}
        onPointerDown={(e) => {
          const p = toCanvas(e);
          pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const s = hit(p.x, p.y);
          if (!s) return;
          const has = !!tpl.photos[s.i];
          if (!cropping || s.i !== active) {
            onActive(s.i, has);
            return;
          }
          if (!has) return;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          const [a, b] = [...pts.current.values()];
          drag.current = { i: s.i, sx: p.x, sy: p.y, c: crop(s.i), slot: s, d0: b ? Math.hypot(a.x - b.x, a.y - b.y) : undefined };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const d = drag.current;
          const list = [...pts.current.values()];
          if (list.length >= 2) {
            const dist = Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
            if (!d.d0) d.d0 = dist;
            onCrop(d.i, { ...d.c, z: clamp(d.c.z * (dist / d.d0), 1, 3) });
            return;
          }
          const p = toCanvas(e);
          onCrop(d.i, { ...d.c, x: clamp(d.c.x - (p.x - d.sx) / (d.slot.w / 2), -1, 1), y: clamp(d.c.y - (p.y - d.sy) / (d.slot.h / 2), -1, 1) });
        }}
        onPointerUp={(e) => {
          pts.current.delete(e.pointerId);
          if (!pts.current.size) drag.current = null;
        }}
        onPointerCancel={(e) => {
          pts.current.delete(e.pointerId);
          drag.current = null;
        }}
      >
        <Preview tpl={tpl} lang={lang} className="template-canvas trendy-canvas" label={label} onSlots={setSlots} />
        {box && (
          <span
            className={"trendy-slot-outline " + (cropping ? "cropping" : "")}
            style={{ left: (box.x / W) * 100 + "%", top: (box.y / H) * 100 + "%", width: (box.w / W) * 100 + "%", height: (box.h / H) * 100 + "%" }}
            aria-hidden="true"
          />
        )}
        {W > H &&
          Array.from({ length: Math.round(W / 1080) - 1 }, (_, k) => (
            <span key={k} className="trendy-seam" style={{ left: (((k + 1) * 1080) / W) * 100 + "%" }} aria-hidden="true" />
          ))}
      </div>
      {cropping ? (
        <div className="trendy-crop-bar" role="group" aria-label={L("Recadrage", "Encuadre", "Cropping")}>
          <Move size={15} />
          <span>{L("Faites glisser la photo, pincez pour zoomer.", "Desliza la foto, pellizca para hacer zoom.", "Drag the photo, pinch to zoom.")}</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={crop(active).z}
            aria-label={L("Zoom", "Zoom", "Zoom")}
            onChange={(e) => onCrop(active, { ...crop(active), z: Number(e.target.value) })}
          />
          <button className="text-link" onClick={() => onCrop(active, { x: 0, y: 0, z: 1 })}>
            {L("Recentrer", "Centrar", "Reset")}
          </button>
          <button className="button secondary" onClick={onDone}>
            <Check size={15} /> {L("OK", "OK", "Done")}
          </button>
        </div>
      ) : (
        <small className="muted trendy-tip">
          {L("Touchez une photo de l’aperçu pour la changer ou la recadrer.", "Toca una foto de la vista previa para cambiarla o encuadrarla.", "Tap a photo in the preview to change or crop it.")}
        </small>
      )}
      {W > H && (
        <small className="muted trendy-tip">
          {L(
            `${Math.round(W / 1080)} slides : publiez-les ensemble, dans l’ordre, en carrousel.`,
            `${Math.round(W / 1080)} slides: publícalas juntas, en orden, como carrusel.`,
            `${Math.round(W / 1080)} slides: post them together, in order, as a carousel.`,
          )}
        </small>
      )}
    </div>
  );
}

// ---------- Mes visuels (liste) ----------
export function DesignList({ data, kind, onEdit, refresh, compact }: { data: Row; kind: "image" | "video"; onEdit?: (d: Row) => void; refresh: () => void; compact?: boolean }) {
  const L = useL();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const list = (data.designs || []).filter((d: Row) => d.kind === kind);
  if (!list.length) return compact ? null : <p className="muted">{L("Aucun visuel pour l’instant.", "Aún no hay imágenes.", "No visuals yet.")}</p>;
  return (
    <div className="design-list">
      {error && (
        <p className="design-error" role="alert">
          <AlertCircle size={15} /> {error}
        </p>
      )}
      <div className="design-grid">
        {list.map((d: Row) => {
          const def = templateById(d.template?.id);
          return (
            <article className="design-card" key={d.id}>
              {kind === "image" ? (
                <img src={"/api/studio/file/" + d.id} alt={def ? L(def.name.fr, def.name.es, def.name.en) : ""} loading="lazy" />
              ) : (
                <video src={"/api/studio/file/" + d.id} controls playsInline preload="metadata" />
              )}
              <div className="design-card-body">
                <b>{d.template?.id === "layers" ? layeredName(d.template, L) : def ? L(def.name.fr, def.name.es, def.name.en) : "—"}</b>
                {(d.template?.id === "carousel" || d.template?.carousel || d.template?.slides > 1) && <small>{L("Diapo", "Diapositiva", "Slide")} {(d.template.slide || 0) + 1}</small>}
                <div className="design-card-actions">
                  {onEdit && (
                    <button className="icon-button" title={L("Modifier ce visuel", "Editar esta imagen", "Edit this visual")} aria-label={L("Modifier ce visuel", "Editar esta imagen", "Edit this visual")} onClick={() => onEdit(d)}>
                      <Pencil size={15} />
                    </button>
                  )}
                  <a className="icon-button" href={"/api/studio/file/" + d.id + "?download=1"} title={L("Télécharger", "Descargar", "Download")} aria-label={L("Télécharger", "Descargar", "Download")}>
                    <Download size={15} />
                  </a>
                  <button
                    className="icon-button"
                    disabled={busy === d.id}
                    title={L("Supprimer", "Eliminar", "Delete")}
                    aria-label={L("Supprimer", "Eliminar", "Delete")}
                    onClick={async () => {
                      if (!window.confirm(L("Supprimer ce visuel ?", "¿Eliminar esta imagen?", "Delete this visual?"))) return;
                      setBusy(d.id);
                      setError("");
                      try {
                        await post("design-delete", { id: d.id });
                        refresh();
                      } catch (e: any) {
                        setError(e.message);
                      } finally {
                        setBusy("");
                      }
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ---------- L'atelier ----------
export default function TemplatesStudio({
  data,
  client,
  refresh,
  canCreate = true,
  initial,
  onInitialUsed,
}: {
  data: Row;
  client: Row;
  refresh: () => void;
  canCreate?: boolean;
  initial?: Row | null;
  onInitialUsed?: () => void;
}) {
  const L = useL(),
    lang = useLang();
  const config = client?.config || {};
  const [tpl, setTpl] = useState<Tpl | null>(null);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [progress, setProgress] = useState(""),
    [brief, setBrief] = useState(""),
    [lastVideo, setLastVideo] = useState(""),
    // Réglages de style repliés par défaut (couleurs et polices de la marque d'abord).
    [moreStyle, setMoreStyle] = useState(false),
    // Dernier visuel enregistré : proposé pour le calendrier.
    [savedId, setSavedId] = useState(""),
    // Montages tendance : emplacement photo choisi, et mode recadrage.
    [activeSlot, setActiveSlot] = useState(0),
    [cropping, setCropping] = useState(false),
    // Éditeur à calques des créatrices (visuel en cours et photos à demander).
    [layerDoc, setLayerDoc] = useState<{ doc: Row; need?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<() => void>(() => {});
  const palette = useMemo(() => paletteFrom(config), [config.colors]);
  useEffect(() => {
    setSavedId("");
    setActiveSlot(0);
    setCropping(false);
  }, [tpl?.id]);
  useEffect(() => {
    if (initial?.template?.id === "layers") {
      setLayerDoc({ doc: { ...initial.template, slide: 0 } });
      onInitialUsed?.();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (initial?.template?.id) {
      setTpl(fromSaved(initial.template, config));
      onInitialUsed?.();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [initial?.id]);
  useEffect(() => {
    setNotice("");
    setError("");
  }, [tpl?.id]);
  const withLogo = (t: Tpl): Tpl => ({ ...t, ...(config.templateLogo ? { _logo: config.templateLogo } : {}) }) as Tpl;
  const trendy = !!tpl && isTrendyTpl(tpl);
  const photosAvailable = (data.files || []).filter((f: Row) => f.mime?.startsWith("image/") && (trendy || f.purpose !== "design")).slice(0, 60);
  const set = (patch: Partial<Tpl>) => setTpl((t) => (t ? { ...t, ...patch } : t));
  const setField = (key: string, value: string) => setTpl((t) => (t ? { ...t, fields: { ...t.fields, [key]: value } } : t));

  const editSaved = (d: Row) => (d.template?.id === "layers" ? setLayerDoc({ doc: { ...d.template, slide: 0 } }) : setTpl(fromSaved(d.template, config)));
  const creatorSpace = config.workspaceType === "creator";
  // ----- Éditeur à calques -----
  if (layerDoc)
    return (
      <LayerEditor
        key={JSON.stringify(layerDoc.doc).length + ":" + (layerDoc.doc.from || "")}
        data={data}
        client={client}
        initial={layerDoc.doc}
        needPhotos={layerDoc.need}
        refresh={refresh}
        onClose={() => setLayerDoc(null)}
      />
    );
  // ----- Galerie : un seul catalogue (format, intention, ambiance, « Pour vous ») -----
  const thumbPhotos: string[] = (data.files || [])
    .filter((f: Row) => f.mime?.startsWith("image/") && !["chat", "design", "place", "brand"].includes(f.purpose))
    .map((f: Row) => f.id)
    .slice(0, 6);
  if (!tpl) {
    const openClassic = (id: string, photos?: string[]) => {
      const t = newTemplate(id, config);
      const def = templateById(id) as Row | null;
      if (photos?.length && def) {
        const max = (def.photos as [number, number])[1];
        if (max > 0) t.photos = photos.slice(0, max);
      }
      setTpl(t);
      window.scrollTo({ top: 0 });
    };
    return (
      <section className="templates-studio">
        {canCreate ? (
          <LayerPicker
            data={data}
            client={client}
            refresh={refresh}
            onOpen={(doc, need) => {
              setLayerDoc({ doc, need });
              window.scrollTo({ top: 0 });
            }}
            classicThumb={(id) => {
              // Aperçu rempli avec les photos de la cliente quand elle en a (sinon une scène d'exemple douce).
              const ex = exampleTemplate(id, config, lang);
              const def = templateById(id) as Row | null;
              const max = def ? (def.photos as [number, number])[1] : 0;
              if (max > 0 && thumbPhotos.length) ex.photos = thumbPhotos.slice(0, max);
              return <Preview tpl={withLogo(ex)} lang={lang} className="template-thumb" />;
            }}
            onOpenClassic={openClassic}
          />
        ) : (
          <p className="muted">
            {L(
              "La création est en pause : votre abonnement doit être à jour. Vos visuels restent disponibles.",
              "La creación está en pausa: tu suscripción debe estar al día. Tus imágenes siguen disponibles.",
              "Creating is paused: your subscription needs to be up to date. Your visuals stay available.",
            )}
          </p>
        )}
        <div className="templates-intro">
          <Shapes size={22} />
          <p>
            {L(
              "Le texte est écrit exactement comme vous le tapez, et vos photos ne sont jamais retouchées. Gratuit : n’utilise pas vos crédits.",
              "El texto se escribe exactamente como lo escribes y tus fotos nunca se retocan. Gratis: no usa tus créditos.",
              "Text appears exactly as you type it, and your photos are never retouched. Free: doesn’t use your credits.",
            )}
          </p>
        </div>
        <div className="templates-group">
          <h3>{L("Mes visuels", "Mis imágenes", "My visuals")}</h3>
          <DesignList data={data} kind="image" refresh={refresh} onEdit={editSaved} />
          {(data.designs || []).some((d: Row) => d.kind === "video") && (
            <>
              <h3>{L("Mes vidéos avant / après", "Mis videos antes / después", "My before / after videos")}</h3>
              <DesignList data={data} kind="video" refresh={refresh} onEdit={(d) => setTpl(fromSaved(d.template, config))} />
            </>
          )}
        </div>
      </section>
    );
  }

  // ----- Éditeur -----
  const def = templateById(tpl.id)! as Row;
  const [minPhotos, maxPhotos] = def.photos as [number, number];
  const fg = tpl.fg || bestTextColor(tpl.bg);
  const ratio = contrastRatio(fg, tpl.bg);
  const missing = missingFields(tpl);
  const needPhotos = tpl.photos.length < minPhotos;
  const consentMissing = def.requiresConsent && !tpl.reviewConfirmed;
  const slides = tpl.id === "carousel" ? carouselSlides(tpl, lang, false) : [];
  const carouselEmpty = tpl.id === "carousel" && slides.length < 2;
  const blocked = missing.length > 0 || needPhotos || consentMissing || carouselEmpty;
  const aiFields = def.fields.filter((f: Row) => !["number", "price", "stars", "name", "source", "credit", "author", "quote"].includes(f.key));
  const canAi = !def.requiresConsent && aiFields.length > 0 && !trendy;
  const trendySlideCount = trendy ? Math.max(1, Math.round(canvasSize(tpl)[0] / 1080)) : 1;

  async function renderAll(): Promise<{ blobs: Blob[]; templates: Tpl[] }> {
    await allFonts();
    const photos = await Promise.all(tpl!.photos.map(loadPhoto));
    const logo = config.templateLogo ? await loadPhoto(config.templateLogo) : null;
    if (trendy) {
      const full = makeCanvas(1, 1);
      drawDesign(full, tpl!, { photos, logo }, lang, false);
      const parts = trendySlideCount > 1 ? (sliceCarousel(full, makeCanvas) as HTMLCanvasElement[]) : [full];
      const out: Blob[] = [];
      for (const c of parts) out.push(await toBlob(c));
      return { blobs: out, templates: parts.map((_, i) => ({ ...tpl!, slide: i })) };
    }
    const pages = tpl!.id === "carousel" ? slides.map((_, i) => ({ ...tpl!, slide: i })) : [tpl!];
    const blobs: Blob[] = [];
    for (const page of pages) {
      const c = document.createElement("canvas");
      drawDesign(c, page, { photos, logo }, lang, false);
      blobs.push(await toBlob(c));
    }
    return { blobs, templates: pages };
  }
  function explain() {
    if (needPhotos) return L(`Ajoutez ${minPhotos} photo(s).`, `Agrega ${minPhotos} foto(s).`, `Add ${minPhotos} photo(s).`);
    if (missing.length) return L("Remplissez : ", "Completa: ", "Fill in: ") + missing.map((f: Row) => L(f.label.fr, f.label.es, f.label.en)).join(", ");
    if (carouselEmpty) return L("Écrivez au moins une diapo de contenu.", "Escribe al menos una diapositiva de contenido.", "Write at least one content slide.");
    if (consentMissing) return L("Cochez la case de l’avis.", "Marca la casilla de la opinión.", "Tick the review box.");
    return "";
  }
  async function save() {
    setBusy("save");
    setError("");
    setNotice("");
    try {
      const { blobs, templates: pages } = await renderAll();
      let firstId = "";
      for (let i = 0; i < blobs.length; i++) {
        const ext = blobs[i].type === "image/png" ? "png" : "jpg";
        const file = new File([blobs[i]], `${tpl!.id}${blobs.length > 1 ? "-" + (i + 1) : ""}.${ext}`, { type: blobs[i].type });
        const { _logo, ...clean } = pages[i] as any;
        const up = await uploadStudioMedia(file, { kind: "design", client_id: client.id, template: clean });
        if (!firstId) firstId = up.id;
      }
      setSavedId(firstId);
      setNotice(
        blobs.length > 1
          ? L(`${blobs.length} slides enregistrées dans Mes visuels.`, `${blobs.length} slides guardadas en Mis imágenes.`, `${blobs.length} slides saved to My visuals.`)
          : L("Visuel enregistré dans Mes visuels.", "Imagen guardada en Mis imágenes.", "Visual saved to My visuals."),
      );
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function download() {
    setBusy("download");
    setError("");
    try {
      const { blobs } = await renderAll();
      blobs.forEach((b, i) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = `${tpl!.id}${blobs.length > 1 ? "-" + (i + 1) : ""}.${b.type === "image/png" ? "png" : "jpg"}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function video() {
    setBusy("video");
    setError("");
    setNotice("");
    window.dispatchEvent(new CustomEvent("studio-render-busy", { detail: true }));
    try {
      await allFonts();
      const [a, b] = await Promise.all(tpl!.photos.slice(0, 2).map(loadPhoto));
      const before = await baFrame(a, valueOf(tpl!, "before", lang, false), tpl!, false),
        after = await baFrame(b, valueOf(tpl!, "after", lang, false), tpl!, true);
      const { renderBeforeAfter } = await import("../lib/montage-engine");
      const file = await renderBeforeAfter(before, after, beforeAfterSize(tpl!.format), {
        update: setProgress,
        register: (c) => (cancelRef.current = c),
        lang,
      });
      setProgress(L("Enregistrement dans Mes vidéos…", "Guardando en Mis videos…", "Saving to My videos…"));
      const { _logo, ...clean } = tpl as any;
      const saved = await uploadStudioMedia(file, { kind: "design-video", client_id: client.id, template: clean });
      setLastVideo(saved.id);
      setNotice(L("Vidéo avant / après enregistrée dans Mes vidéos.", "Video antes / después guardado en Mis videos.", "Before / after video saved to My videos."));
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProgress("");
      setBusy("");
      window.dispatchEvent(new CustomEvent("studio-render-busy", { detail: false }));
    }
  }
  async function writeForMe() {
    setBusy("ai");
    setError("");
    setNotice("");
    try {
      const r = await post("template-text", { client_id: client.id, template_id: tpl!.id, brief, language: lang });
      if (r.generated) {
        setTpl((t) => (t ? { ...t, fields: { ...t.fields, ...r.fields } } : t));
        setNotice(L("Texte proposé : relisez-le et modifiez-le librement.", "Texto propuesto: revísalo y cámbialo como quieras.", "Suggested text: read it over and edit freely."));
      } else
        setNotice(
          L(
            "La rédaction automatique n’est pas disponible pour le moment : écrivez votre texte directement dans les champs.",
            "La redacción automática no está disponible por ahora: escribe tu texto directamente en los campos.",
            "Automatic writing isn’t available right now: type your text directly in the fields.",
          ),
        );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function addPhoto(files: FileList | null) {
    if (!files?.length) return;
    setBusy("upload");
    setError("");
    try {
      const ids: string[] = [];
      for (const f of Array.from(files).slice(0, maxPhotos - tpl!.photos.length)) {
        const d = await uploadStudioMedia(f, { kind: "photo", client_id: client.id });
        ids.push(d.id);
      }
      if (trendy && ids.length === 1) assignPhoto(ids[0]);
      else setTpl((t) => (t ? { ...t, photos: [...t.photos, ...ids].slice(0, maxPhotos) } : t));
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  // Montage tendance : la photo choisie va dans l'emplacement sélectionné (son recadrage repart de zéro).
  function assignPhoto(id: string) {
    setTpl((t) => {
      if (!t) return t;
      const photos = [...t.photos],
        crops = [...(t.crops || [])];
      const at = Math.min(activeSlot, photos.length);
      photos[at] = id;
      crops[at] = { x: 0, y: 0, z: 1 };
      return { ...t, photos: photos.slice(0, maxPhotos), crops: crops.slice(0, maxPhotos) };
    });
    setActiveSlot((a) => Math.min(maxPhotos - 1, Math.min(a, tpl!.photos.length) + 1));
  }
  function removeSlot(i: number) {
    setTpl((t) => (t ? { ...t, photos: t.photos.filter((_, k) => k !== i), crops: (t.crops || []).filter((_, k) => k !== i) } : t));
    setCropping(false);
  }
  function shuffle() {
    setTpl((t) => {
      if (!t || t.photos.length < 2) return t;
      const idx = t.photos.map((_, i) => i);
      // Un vrai mélange, différent de l'ordre actuel.
      do {
        for (let i = idx.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [idx[i], idx[j]] = [idx[j], idx[i]];
        }
      } while (idx.every((v, i) => v === i));
      return { ...t, photos: idx.map((i) => t.photos[i]), crops: idx.map((i) => (t.crops || [])[i] || { x: 0, y: 0, z: 1 }) };
    });
    setCropping(false);
  }
  const togglePhoto = (id: string) =>
    setTpl((t) => {
      if (!t) return t;
      if (t.photos.includes(id)) return { ...t, photos: t.photos.filter((x) => x !== id) };
      if (t.photos.length >= maxPhotos) return maxPhotos === 1 ? { ...t, photos: [id] } : t;
      return { ...t, photos: [...t.photos, id] };
    });

  return (
    <section className="templates-studio template-editor">
      <div className="section-heading">
        <button className="text-link" onClick={() => setTpl(null)}>
          <ArrowLeft size={15} /> {L("Tous les modèles", "Todas las plantillas", "All templates")}
        </button>
        <b>{L(def.name.fr, def.name.es, def.name.en)}</b>
      </div>
      <div className="template-workspace">
        <div className="template-stage">
          {trendy ? (
            <TrendyStage
              tpl={tpl}
              lang={lang}
              active={activeSlot}
              cropping={cropping}
              label={L("Aperçu du visuel", "Vista previa de la imagen", "Visual preview")}
              onActive={(i, has) => {
                setActiveSlot(i);
                setCropping(has);
              }}
              onCrop={(i, c) =>
                setTpl((t) => {
                  if (!t) return t;
                  const crops = [...(t.crops || [])];
                  for (let k = 0; k <= i; k++) crops[k] = crops[k] || { x: 0, y: 0, z: 1 };
                  crops[i] = c;
                  return { ...t, crops };
                })
              }
              onDone={() => setCropping(false)}
            />
          ) : (
            <Preview tpl={withLogo(tpl)} lang={lang} className={"template-canvas fmt-" + tpl.format.replace(":", "-")} label={L("Aperçu du visuel", "Vista previa de la imagen", "Visual preview")} />
          )}
          {tpl.id === "carousel" && (
            <div className="carousel-nav" role="tablist" aria-label="Slides">
              {carouselSlides(tpl, lang).map((_, i) => (
                <button key={i} role="tab" aria-selected={tpl.slide === i} className={tpl.slide === i ? "active" : ""} onClick={() => set({ slide: i })}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
          {lastVideo && tpl.id === "beforeAfter" && <video className="template-video" src={"/api/studio/file/" + lastVideo} controls playsInline autoPlay muted loop />}
        </div>
        <div className="template-controls">
          <p className="muted">{L(def.hint.fr, def.hint.es, def.hint.en)}</p>
          {trendy && (
            <fieldset className="template-fieldset trendy-photos">
              <legend>
                {L("Vos photos", "Tus fotos", "Your photos")}{" "}
                <small>
                  {tpl.photos.length}/{maxPhotos}
                </small>
              </legend>
              <div className="trendy-slots" role="list">
                {Array.from({ length: maxPhotos }, (_, i) => {
                  const id = tpl.photos[i];
                  return (
                    <div key={i} role="listitem" className={"trendy-slot " + (activeSlot === i ? "active" : "") + (id ? " filled" : "")}>
                      <button
                        onClick={() => {
                          setActiveSlot(Math.min(i, tpl.photos.length));
                          setCropping(false);
                        }}
                        aria-pressed={activeSlot === i}
                        aria-label={L(`Emplacement ${i + 1}`, `Espacio ${i + 1}`, `Slot ${i + 1}`)}
                      >
                        {id ? <img src={"/api/studio/file/" + id} alt="" loading="lazy" /> : <span>{i + 1}</span>}
                      </button>
                      {id && (
                        <button className="trendy-slot-x" onClick={() => removeSlot(i)} aria-label={L("Retirer cette photo", "Quitar esta foto", "Remove this photo")}>
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
                {tpl.photos.length > 1 && (
                  <button className="button secondary trendy-shuffle" onClick={shuffle}>
                    <Shuffle size={15} /> {L("Mélanger", "Mezclar", "Shuffle")}
                  </button>
                )}
              </div>
              <small className="muted">
                {tpl.photos.length < minPhotos
                  ? L(`Choisissez au moins ${minPhotos} photos ci-dessous.`, `Elige al menos ${minPhotos} fotos abajo.`, `Pick at least ${minPhotos} photos below.`)
                  : L("Touchez un emplacement, puis une photo pour la remplacer.", "Toca un espacio y luego una foto para cambiarla.", "Tap a slot, then a photo to replace it.")}
              </small>
              <div className="template-photos">
                {photosAvailable.map((f: Row) => (
                  <button key={f.id} className={"template-photo " + (tpl.photos.includes(f.id) ? "selected" : "")} onClick={() => assignPhoto(f.id)} title={f.name}>
                    <img src={"/api/studio/file/" + f.id} alt={f.name} loading="lazy" />
                    {tpl.photos.includes(f.id) && <span>{tpl.photos.indexOf(f.id) + 1}</span>}
                  </button>
                ))}
                <button className="template-photo add" onClick={() => fileRef.current?.click()} disabled={busy === "upload"}>
                  {busy === "upload" ? <Loader2 className="spin" size={18} /> : <Upload size={18} />}
                  <small>{L("Ajouter", "Agregar", "Add")}</small>
                </button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg" multiple hidden onChange={(e) => addPhoto(e.target.files)} />
              </div>
            </fieldset>
          )}
          {maxPhotos > 0 && !trendy && (
            <fieldset className="template-fieldset">
              <legend>
                {L("Vos photos", "Tus fotos", "Your photos")}{" "}
                <small>
                  {tpl.photos.length}/{maxPhotos}
                  {minPhotos === 0 ? L(" · facultatif", " · opcional", " · optional") : ""}
                </small>
              </legend>
              <div className="template-photos">
                {photosAvailable.map((f: Row) => (
                  <button key={f.id} className={"template-photo " + (tpl.photos.includes(f.id) ? "selected" : "")} onClick={() => togglePhoto(f.id)} aria-pressed={tpl.photos.includes(f.id)} title={f.name}>
                    <img src={"/api/studio/file/" + f.id} alt={f.name} loading="lazy" />
                    {tpl.photos.includes(f.id) && <span>{tpl.photos.indexOf(f.id) + 1}</span>}
                  </button>
                ))}
                <button className="template-photo add" onClick={() => fileRef.current?.click()} disabled={busy === "upload" || tpl.photos.length >= maxPhotos}>
                  {busy === "upload" ? <Loader2 className="spin" size={18} /> : <Upload size={18} />}
                  <small>{L("Ajouter", "Agregar", "Add")}</small>
                </button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg" multiple={maxPhotos > 1} hidden onChange={(e) => addPhoto(e.target.files)} />
              </div>
              {tpl.id === "beforeAfter" && <small className="muted">{L("Photo 1 = avant, photo 2 = après.", "Foto 1 = antes, foto 2 = después.", "Photo 1 = before, photo 2 = after.")}</small>}
              {["portfolio", "offer", "behind"].includes(tpl.id) && (
                <div className="segmented" role="group" aria-label={L("Cadrage", "Encuadre", "Framing")}>
                  <button className={tpl.fit === "contain" ? "active" : ""} onClick={() => set({ fit: "contain" })}>
                    {L("Photo entière", "Foto completa", "Whole photo")}
                  </button>
                  <button className={tpl.fit === "cover" ? "active" : ""} onClick={() => set({ fit: "cover" })}>
                    {L("Remplir le cadre", "Llenar el marco", "Fill the frame")}
                  </button>
                </div>
              )}
              {tpl.id === "beforeAfter" && (
                <div className="segmented" role="group" aria-label={L("Disposition", "Disposición", "Layout")}>
                  {(["side", "stack", "diagonal"] as const).map((l) => (
                    <button key={l} className={tpl.layout === l ? "active" : ""} onClick={() => set({ layout: l })}>
                      {l === "side" ? L("Côte à côte", "Lado a lado", "Side by side") : l === "stack" ? L("Haut / bas", "Arriba / abajo", "Top / bottom") : L("Diagonale", "Diagonal", "Diagonal")}
                    </button>
                  ))}
                </div>
              )}
            </fieldset>
          )}
          <fieldset className="template-fieldset">
            <legend>{L("Vos textes", "Tus textos", "Your text")}</legend>
            {def.fields.map((f: Row) => {
              const ph = pick(lang, f.placeholder?.fr || "", f.placeholder?.es || "", f.placeholder?.en || "");
              const label = L(f.label.fr, f.label.es, f.label.en);
              return (
                <label className="field" key={f.key}>
                  <span>{label}</span>
                  {f.key === "stars" ? (
                    <select value={tpl.fields.stars || "5"} onChange={(e) => setField("stars", e.target.value)}>
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {"★".repeat(n)}
                        </option>
                      ))}
                    </select>
                  ) : f.multiline ? (
                    <textarea rows={f.key === "text" && tpl.id === "carousel" ? 7 : 3} maxLength={f.max} value={tpl.fields[f.key] || ""} placeholder={ph} onChange={(e) => setField(f.key, e.target.value)} />
                  ) : (
                    <input maxLength={f.max} value={tpl.fields[f.key] || ""} placeholder={ph} onChange={(e) => setField(f.key, e.target.value)} />
                  )}
                </label>
              );
            })}
            {tpl.id === "carousel" && (
              <small className="muted">
                {L("Séparez les diapos par une ligne vide.", "Separa las diapositivas con una línea vacía.", "Separate slides with a blank line.")}
              </small>
            )}
            {tpl.id === "number" && <small className="muted">{L("Indiquez un vrai chiffre de votre activité : le studio n’en invente jamais.", "Indica una cifra real de tu negocio: el estudio nunca inventa cifras.", "Use a real number from your business: the studio never invents figures.")}</small>}
            {tpl.id === "offer" && <small className="muted">{L("Prix et conditions : uniquement ceux que vous proposez réellement.", "Precio y condiciones: solo los que realmente ofreces.", "Price and terms: only what you really offer.")}</small>}
            {canAi && (
              <div className="template-ai">
                <input value={brief} maxLength={300} onChange={(e) => setBrief(e.target.value)} placeholder={L("Sujet (facultatif) : ex. préparer sa peau pour l’hiver", "Tema (opcional): ej. preparar tu piel para el invierno", "Topic (optional): e.g. getting your skin ready for winter")} />
                <button className="button secondary" disabled={!!busy} onClick={writeForMe}>
                  {busy === "ai" ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />} {L("Écrire le texte pour moi", "Escribir el texto por mí", "Write it for me")}
                </button>
              </div>
            )}
          </fieldset>
          <fieldset className="template-fieldset">
            <legend>{L("Style", "Estilo", "Style")}</legend>
            <div className="field">
              <span>{L("Format", "Formato", "Format")}</span>
              {trendy ? (
                <div className="segmented" role="group">
                  {(def.formats as ("4:5" | "9:16")[]).map((f) => (
                    <button key={f} className={tpl.format === f && !tpl.carousel ? "active" : ""} onClick={() => set({ format: f, carousel: false })}>
                      {f === "4:5" ? L("Publication", "Publicación", "Post") : L("Story", "Historia", "Story")}
                    </button>
                  ))}
                  {def.carousel && (
                    <button className={tpl.carousel ? "active" : ""} onClick={() => set({ format: "4:5", carousel: true })}>
                      {L(`Carrousel · ${def.carousel} slides`, `Carrusel · ${def.carousel} slides`, `Carousel · ${def.carousel} slides`)}
                    </button>
                  )}
                </div>
              ) : (
              <div className="segmented" role="group">
                {(["4:5", "1:1", "9:16"] as const).map((f) => (
                  <button key={f} className={tpl.format === f ? "active" : ""} onClick={() => set({ format: f })}>
                    {f === "4:5" ? L("Publication 4:5", "Publicación 4:5", "Post 4:5") : f === "1:1" ? L("Carré 1:1", "Cuadrado 1:1", "Square 1:1") : L("Story 9:16", "Historia 9:16", "Story 9:16")}
                  </button>
                ))}
              </div>
              )}
            </div>
            {trendy && (
              <div className="field">
                <label className="check">
                  <input type="checkbox" checked={tpl.filter === "film"} onChange={(e) => set({ filter: e.target.checked ? "film" : "none" })} /> {L("Effet pellicule (grain, teinte chaude)", "Efecto película (grano, tono cálido)", "Film effect (grain, warm tone)")}
                </label>
              </div>
            )}
            <div className="field">
              <span>{L("Fond", "Fondo", "Background")}</span>
              <div className="swatches">
                {(moreStyle ? palette : palette.slice(0, 4)).map((c: string) => (
                  <button key={c} className={"swatch " + (tpl.bg === c ? "active" : "")} style={{ background: c }} aria-label={c} title={c} onClick={() => set({ bg: c })} />
                ))}
                {moreStyle && (
                  <>
                    <input type="color" value={tpl.bg} onChange={(e) => set({ bg: e.target.value.toUpperCase() })} aria-label={L("Autre couleur", "Otro color", "Other color")} />
                    {!trendy && (
                      <label className="check">
                        <input type="checkbox" checked={tpl.texture} onChange={(e) => set({ texture: e.target.checked })} /> {L("Texture papier", "Textura papel", "Paper texture")}
                      </label>
                    )}
                  </>
                )}
              </div>
            </div>
            {moreStyle && (
            <div className="field">
              <span>{L("Couleur du texte", "Color del texto", "Text color")}</span>
              <div className="swatches">
                <button className={"chip " + (!tpl.fg ? "active" : "")} onClick={() => set({ fg: null })}>
                  {L("Automatique", "Automático", "Automatic")}
                </button>
                <input type="color" value={fg} onChange={(e) => set({ fg: e.target.value.toUpperCase() })} aria-label={L("Couleur du texte", "Color del texto", "Text color")} />
                <span className="swatch-label">{L("Accent", "Acento", "Accent")}</span>
                <input type="color" value={tpl.accent || "#B8291A"} onChange={(e) => set({ accent: e.target.value.toUpperCase() })} aria-label={L("Couleur d’accent", "Color de acento", "Accent color")} />
              </div>
              {ratio < 4.5 && (
                <small className="contrast-warning" role="status">
                  <AlertCircle size={13} />{" "}
                  {L(
                    `Contraste faible (${ratio.toFixed(1)}:1) : le texte sera difficile à lire. Visez au moins 4,5:1, ou choisissez « Automatique ».`,
                    `Contraste bajo (${ratio.toFixed(1)}:1): el texto será difícil de leer. Busca al menos 4.5:1 o elige “Automático”.`,
                    `Low contrast (${ratio.toFixed(1)}:1): the text will be hard to read. Aim for at least 4.5:1, or choose “Automatic”.`,
                  )}
                </small>
              )}
            </div>
            )}
            <div className="field">
              <span>{L("Police", "Fuente", "Font")}</span>
              <div className="font-choices">
                {(moreStyle
                  ? TEMPLATE_FONTS
                  : TEMPLATE_FONTS.filter((f: Row) =>
                      [...new Set([config.templateFont, tpl.font, "playfair", "poppins", "dancing"].filter(Boolean))]
                        .slice(0, 3)
                        .includes(f.id),
                    )
                ).map((f: Row) => (
                  <button key={f.id} className={tpl.font === f.id ? "active" : ""} style={{ fontFamily: `"${f.family}"`, fontWeight: f.weight }} onClick={() => set({ font: f.id })}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" className="text-link more-style" onClick={() => setMoreStyle(!moreStyle)} aria-expanded={moreStyle}>
              {moreStyle ? L("Moins de choix", "Menos opciones", "Fewer choices") : L("Plus de choix", "Más opciones", "More choices")}
            </button>
            {moreStyle && !trendy && (
            <div className="field template-row">
              <label>
                <span>{L("Taille du texte", "Tamaño del texto", "Text size")}</span>
                <input type="range" min={0.7} max={1.3} step={0.05} value={tpl.scale} onChange={(e) => set({ scale: Number(e.target.value) })} />
              </label>
              <div className="segmented" role="group" aria-label={L("Alignement", "Alineación", "Alignment")}>
                <button className={tpl.align === "left" ? "active" : ""} onClick={() => set({ align: "left" })}>
                  {L("À gauche", "Izquierda", "Left")}
                </button>
                <button className={tpl.align === "center" ? "active" : ""} onClick={() => set({ align: "center" })}>
                  {L("Centré", "Centrado", "Centered")}
                </button>
              </div>
            </div>
            )}
            {!["beforeAfter", "portfolio", "collage", "behind", "offer"].includes(tpl.id) && (
              <div className="field template-row">
                <label className="check">
                  <input type="checkbox" checked={tpl.showHandle} onChange={(e) => set({ showHandle: e.target.checked })} />{" "}
                  {config.templateLogo ? L("Afficher mon logo", "Mostrar mi logo", "Show my logo") : L("Afficher mon compte", "Mostrar mi cuenta", "Show my handle")}
                </label>
                {!config.templateLogo && tpl.showHandle && <input value={tpl.handle} maxLength={40} placeholder={L("@moncompte", "@micuenta", "@myhandle")} onChange={(e) => set({ handle: e.target.value })} />}
              </div>
            )}
          </fieldset>
          {def.requiresConsent && (
            <label className="check review-consent">
              <input type="checkbox" checked={tpl.reviewConfirmed} onChange={(e) => set({ reviewConfirmed: e.target.checked })} />
              <span>{L("Ceci est un vrai avis d’un client, publié avec son accord.", "Esta es una opinión real de un cliente, publicada con su permiso.", "This is a real review from a client, posted with their consent.")}</span>
            </label>
          )}
          {error && (
            <p className="design-error" role="alert">
              <AlertCircle size={15} /> {error}
            </p>
          )}
          {notice && (
            <p className="design-notice" role="status">
              <Check size={15} /> {notice}
            </p>
          )}
          {savedId && !busy && <AddToCalendarButton kind="design" id={savedId} />}
          {progress && (
            <p className="design-notice" role="status">
              <Loader2 className="spin" size={15} /> {progress}
            </p>
          )}
          <div className="template-actions">
            {blocked && <small className="muted template-why">{explain()}</small>}
            <button className="button primary" disabled={blocked || !!busy || !canCreate} onClick={save}>
              {busy === "save" ? <Loader2 className="spin" size={16} /> : <Check size={16} />} {tpl.id === "carousel" || trendySlideCount > 1 ? L("Enregistrer les diapos", "Guardar las diapositivas", "Save the slides") : L("Enregistrer dans Mes visuels", "Guardar en Mis imágenes", "Save to My visuals")}
            </button>
            <button className="button secondary" disabled={blocked || !!busy} onClick={download}>
              <Download size={16} /> {L("Télécharger", "Descargar", "Download")}
            </button>
            {tpl.id === "beforeAfter" && (
              <button className="button secondary" disabled={blocked || !!busy || !canCreate} onClick={video}>
                {busy === "video" ? <Loader2 className="spin" size={16} /> : <Film size={16} />} {L("Créer la vidéo (7 s)", "Crear el video (7 s)", "Create the video (7 s)")}
              </button>
            )}
            {busy === "video" && (
              <button className="text-link" onClick={() => cancelRef.current()}>
                {L("Arrêter", "Detener", "Stop")}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Réglages de l'agence (fiche de la marque) ----------
export function TemplatesAgency({ data, client, refresh }: { data: Row; client: Row; refresh: () => void }) {
  const c = client.config || {};
  const [s, setS] = useState<Row>({
    serviceBusiness: !!c.serviceBusiness,
    templateFont: c.templateFont || "",
    templateBg: c.templateBg || "",
    templateAccent: c.templateAccent || "",
    templateHandle: c.templateHandle || "",
    templateLogo: c.templateLogo || "",
    hiddenTemplates: c.hiddenTemplates || [],
    templateTextCost: c.templateTextCost ?? 0,
  });
  const [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false);
  const logos = [...(data.stickerFiles || []), ...(data.files || []).filter((f: Row) => f.purpose === "brand")];
  return (
    <section className="templates-agency">
      <h3>
        <Shapes size={18} /> Modèles (créations sans IA)
      </h3>
      <p className="muted">Visuels composés dans le navigateur : texte exact, photos du client jamais retouchées. Choisissez les réglages par défaut de cette marque.</p>
      <label className="check">
        <input type="checkbox" checked={s.serviceBusiness} onChange={(e) => setS({ ...s, serviceBusiness: e.target.checked })} /> Activité de service (photographe, ménage, coiffure…) : les modèles avec photos passent en premier
      </label>
      <div className="template-agency-grid">
        <label className="field">
          <span>Police par défaut</span>
          <select value={s.templateFont} onChange={(e) => setS({ ...s, templateFont: e.target.value })}>
            <option value="">Selon le modèle</option>
            {TEMPLATE_FONTS.map((f: Row) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Fond par défaut</span>
          <input type="color" value={s.templateBg || "#F6F1E9"} onChange={(e) => setS({ ...s, templateBg: e.target.value })} />
        </label>
        <label className="field">
          <span>Couleur d’accent</span>
          <input type="color" value={s.templateAccent || "#B8291A"} onChange={(e) => setS({ ...s, templateAccent: e.target.value })} />
        </label>
        <label className="field">
          <span>Compte affiché (@)</span>
          <input value={s.templateHandle} maxLength={40} onChange={(e) => setS({ ...s, templateHandle: e.target.value })} placeholder="@marque" />
        </label>
        <label className="field">
          <span>Logo (PNG de la marque)</span>
          <select value={s.templateLogo} onChange={(e) => setS({ ...s, templateLogo: e.target.value })}>
            <option value="">Aucun : afficher le compte</option>
            {logos.map((f: Row) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Crédits pour « Écrire le texte pour moi »</span>
          <input type="number" min={0} max={20} value={s.templateTextCost} onChange={(e) => setS({ ...s, templateTextCost: Number(e.target.value) })} />
        </label>
      </div>
      <div className="field">
        <span>Modèles proposés à ce client</span>
        <div className="template-toggles">
          {orderedTemplates({}).map((t: Row) => (
            <label key={t.id} className="check">
              <input
                type="checkbox"
                checked={!s.hiddenTemplates.includes(t.id)}
                onChange={(e) => setS({ ...s, hiddenTemplates: e.target.checked ? s.hiddenTemplates.filter((x: string) => x !== t.id) : [...s.hiddenTemplates, t.id] })}
              />{" "}
              {t.name.fr}
            </label>
          ))}
        </div>
      </div>
      <button
        className="button primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg("");
          try {
            await post("template-settings", { client_id: client.id, ...s, templateFont: s.templateFont || null, templateBg: s.templateBg || null, templateAccent: s.templateAccent || null, templateLogo: s.templateLogo || null });
            setMsg("Réglages des modèles enregistrés.");
            refresh();
          } catch (e: any) {
            setMsg(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Enregistrer les réglages des modèles
      </button>
      {msg && <p className="muted">{msg}</p>}
    </section>
  );
}
