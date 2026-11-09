// Montages photo tendance : dessin sur canvas (navigateur), sans IA ni ressource distante.
// Toutes les mises en page sont originales. Le hasard (grain, papier déchiré, code-barres) est déterministe :
// un même montage donne toujours exactement la même image.
import { FORMATS, templateById, fitText, bestTextColor, readableAccent, fontById, BODY_FONT, SCRIPT_FONT, TRENDY_FONTS, TEMPLATE_FONTS } from "./templates.mjs";

const SLIDE = FORMATS["4:5"];
/** Taille du canvas complet : un carrousel est dessiné d'un seul tenant puis découpé en slides. */
export function trendyCanvasSize(tpl) {
  const def = templateById(tpl.id);
  if (def?.carousel && (tpl.carousel || !def.formats.length)) return [SLIDE[0] * def.carousel, SLIDE[1]];
  return FORMATS[tpl.format] || FORMATS["9:16"];
}
/** Polices à charger avant de dessiner. */
export const TRENDY_FONT_LIST = [...Object.values(TRENDY_FONTS)];

// ---------- Outils ----------
const css = (f, s) => `${f.weight} ${Math.round(s)}px "${f.family}", sans-serif`;
const font = (id) => TEMPLATE_FONTS.find((f) => f.id === id) || fontById(id);
const F = {
  body: BODY_FONT,
  bold: font("poppins"),
  script: SCRIPT_FONT,
  mono: TRENDY_FONTS.mono,
  serif: font("dmserif"),
  serifLight: TRENDY_FONTS.serifLight,
  bebas: font("bebas"),
  grotesk: font("spacegrotesk"),
  lora: TRENDY_FONTS.loraLight,
};
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const hash = (str) => [...String(str)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
/** Texte ajusté à sa boîte. */
function box(ctx, raw, b) {
  const text = b.upper ? String(raw || "").toUpperCase() : String(raw || "");
  if (!text.trim()) return 0;
  const lh = b.lh ?? 1.15;
  const measureAt = (size) => {
    ctx.font = css(b.font, size);
    return (s) => ctx.measureText(s).width + (b.spacing ? s.length * b.spacing * size : 0);
  };
  const fit = fitText(text, { maxWidth: b.w, maxHeight: b.h, maxSize: b.max, minSize: b.min ?? 18, lineHeight: lh }, measureAt);
  ctx.save();
  ctx.font = css(b.font, fit.size);
  ctx.fillStyle = b.color;
  ctx.globalAlpha = b.alpha ?? 1;
  ctx.textBaseline = "alphabetic";
  if (b.spacing) ctx.letterSpacing = b.spacing * fit.size + "px";
  if (b.shadow) {
    ctx.shadowColor = b.shadow;
    ctx.shadowBlur = fit.size * 0.35;
  }
  const used = fit.lines.length * fit.size * lh;
  let y = b.y + (b.valign === "middle" ? (b.h - used) / 2 : b.valign === "bottom" ? b.h - used : 0) + fit.size * 0.9;
  for (const line of fit.lines) {
    const w = ctx.measureText(line).width;
    const x = b.align === "center" ? b.x + (b.w - w) / 2 : b.align === "right" ? b.x + b.w - w : b.x;
    ctx.fillText(line, x, y);
    y += fit.size * lh;
  }
  ctx.restore();
  return used;
}
/** Une ligne, réduite si besoin pour tenir dans la largeur. */
function line(ctx, text, x, y, f, size, color, align = "left", maxW = 2000, spacing = 0) {
  text = String(text || "");
  if (!text) return 0;
  ctx.save();
  let s = size;
  ctx.font = css(f, s);
  if (spacing) ctx.letterSpacing = spacing + "px";
  while (s > 12 && ctx.measureText(text).width > maxW) {
    s -= 2;
    ctx.font = css(f, s);
  }
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}
const PLACEHOLDER = ["#D8CFC2", "#C9BBA8", "#E3D9CC", "#BFB1A0", "#D1C6B8", "#CDBFAE"];
/** Photo dans une zone (recadrage « cover » + zoom/décalage choisis par la cliente). */
function photo(ctx, img, x, y, w, h, crop = {}, idx = 0, radius = 0) {
  ctx.save();
  if (radius) {
    rr(ctx, x, y, w, h, radius);
    ctx.clip();
  } else {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
  }
  if (!img) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, PLACEHOLDER[idx % PLACEHOLDER.length]);
    g.addColorStop(1, PLACEHOLDER[(idx + 2) % PLACEHOLDER.length]);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(255,255,255,.75)";
    ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.012);
    const s = Math.min(w, h) * 0.09;
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - s, y + h / 2);
    ctx.lineTo(x + w / 2 + s, y + h / 2);
    ctx.moveTo(x + w / 2, y + h / 2 - s);
    ctx.lineTo(x + w / 2, y + h / 2 + s);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const iw = img.naturalWidth || img.width,
    ih = img.naturalHeight || img.height;
  const z = Math.min(3, Math.max(1, crop.z || 1));
  const scale = Math.max(w / iw, h / ih) * z;
  const dw = iw * scale,
    dh = ih * scale;
  const ox = (Math.min(1, Math.max(-1, crop.x || 0)) * (dw - w)) / 2,
    oy = (Math.min(1, Math.max(-1, crop.y || 0)) * (dh - h)) / 2;
  ctx.drawImage(img, x + (w - dw) / 2 - ox, y + (h - dh) / 2 - oy, dw, dh);
  ctx.restore();
}
function grain(ctx, W, H, amount = 1, seed = 11) {
  const rnd = seeded(seed);
  ctx.save();
  const n = ((W * H) / 180) * amount;
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = 0.03 + rnd() * 0.05;
    ctx.fillStyle = rnd() > 0.5 ? "#FFFFFF" : "#000000";
    ctx.fillRect(rnd() * W, rnd() * H, 1.8, 1.8);
  }
  ctx.restore();
}
function vignette(ctx, W, H, strength = 0.35) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
/** Effet pellicule (facultatif) : teinte chaude, noirs légèrement levés, vignettage et grain. */
export function filmFilter(ctx, W, H) {
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = "rgba(255,170,90,.32)";
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "lighten";
  ctx.fillStyle = "rgba(40,28,20,.18)";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  vignette(ctx, W, H, 0.28);
  grain(ctx, W, H, 1.1, 23);
}
function shadowed(ctx, fn, blur = 30, alpha = 0.22, dy = 12) {
  ctx.save();
  ctx.shadowColor = `rgba(0,0,0,${alpha})`;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = dy;
  fn();
  ctx.restore();
}
function rotated(ctx, cx, cy, deg, fn) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((deg * Math.PI) / 180);
  fn();
  ctx.restore();
}
function starShape(ctx, cx, cy, r, points = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points,
      q = i % 2 ? r * inner : r;
    ctx.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q);
  }
  ctx.closePath();
}
function sparkle(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  starShape(ctx, cx, cy, r, 4, 0.22);
  ctx.fill();
  ctx.restore();
}
function doodleStar(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.14;
  ctx.lineJoin = "round";
  starShape(ctx, cx, cy, r);
  ctx.stroke();
  ctx.restore();
}
function squiggle(ctx, x, y, w, color, amp = 14) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    ctx.lineTo(x + t * w, y + Math.sin(t * Math.PI * 4) * amp);
  }
  ctx.stroke();
  ctx.restore();
}
function arrow(ctx, x1, y1, x2, y2, color, width = 5) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  const mx = (x1 + x2) / 2 + (y2 - y1) * 0.2,
    my = (y1 + y2) / 2 - (x2 - x1) * 0.2;
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(mx, my, x2, y2);
  ctx.stroke();
  const a = Math.atan2(y2 - my, x2 - mx),
    s = width * 4;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(a - 0.5) * s, y2 - Math.sin(a - 0.5) * s);
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(a + 0.5) * s, y2 - Math.sin(a + 0.5) * s);
  ctx.stroke();
  ctx.restore();
}
function tape(ctx, cx, cy, w, deg, color = "rgba(236,222,190,.82)") {
  rotated(ctx, cx, cy, deg, () => {
    ctx.fillStyle = color;
    const h = w * 0.3;
    ctx.beginPath();
    const rnd = seeded(hash(cx + ":" + cy));
    ctx.moveTo(-w / 2, -h / 2);
    for (let i = 1; i <= 6; i++) ctx.lineTo(-w / 2 + (w * i) / 6, -h / 2 + (rnd() - 0.5) * 4);
    for (let i = 0; i <= 4; i++) ctx.lineTo(w / 2 + (rnd() - 0.5) * 8, -h / 2 + (h * i) / 4);
    for (let i = 6; i >= 0; i--) ctx.lineTo(-w / 2 + (w * i) / 6, h / 2 + (rnd() - 0.5) * 4);
    for (let i = 4; i >= 0; i--) ctx.lineTo(-w / 2 + (rnd() - 0.5) * 8, -h / 2 + (h * i) / 4);
    ctx.closePath();
    ctx.fill();
  });
}
/** Bord de papier déchiré autour d'un rectangle. */
function tornPath(ctx, x, y, w, h, seed, jag = 10) {
  const rnd = seeded(seed);
  const step = 18;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let px = x; px <= x + w; px += step) ctx.lineTo(px, y + (rnd() - 0.5) * jag);
  for (let py = y; py <= y + h; py += step) ctx.lineTo(x + w + (rnd() - 0.5) * jag, py);
  for (let px = x + w; px >= x; px -= step) ctx.lineTo(px, y + h + (rnd() - 0.5) * jag);
  for (let py = y + h; py >= y; py -= step) ctx.lineTo(x + (rnd() - 0.5) * jag, py);
  ctx.closePath();
}
function barcode(ctx, x, y, w, h, seed, color = "#1A1A1A") {
  const rnd = seeded(seed);
  ctx.save();
  ctx.fillStyle = color;
  let px = x;
  while (px < x + w) {
    const bw = 2 + Math.floor(rnd() * 3) * 2;
    if (rnd() > 0.35) ctx.fillRect(px, y, Math.min(bw, x + w - px), h);
    px += bw + 2 + Math.floor(rnd() * 3);
  }
  ctx.restore();
}
// Afficheur 7 segments (date orange des appareils numériques des années 2000).
const SEG = { 0: "abcdef", 1: "bc", 2: "abged", 3: "abgcd", 4: "fgbc", 5: "afgcd", 6: "afgedc", 7: "abc", 8: "abcdefg", 9: "abcdfg", "-": "g" };
export function lcdText(ctx, text, x, y, h, color = "#FF8A1F") {
  const w = h * 0.52,
    t = h * 0.15,
    gap = h * 0.2;
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = h * 0.35;
  let cx = x;
  for (const ch of String(text)) {
    if (ch === " ") {
      cx += w * 0.6;
      continue;
    }
    if (ch === "'" || ch === "’") {
      ctx.fillRect(cx, y, t, h * 0.28);
      cx += t + gap * 0.8;
      continue;
    }
    if (ch === "." || ch === "/") {
      ctx.fillRect(cx, y + h - t, t, t);
      cx += t + gap * 0.8;
      continue;
    }
    const segs = SEG[ch];
    if (!segs) {
      cx += w + gap;
      continue;
    }
    const half = h / 2;
    const S = {
      a: [cx + t, y, w - 2 * t, t],
      b: [cx + w - t, y + t, t, half - 1.5 * t],
      c: [cx + w - t, y + half + t / 2, t, half - 1.5 * t],
      d: [cx + t, y + h - t, w - 2 * t, t],
      e: [cx, y + half + t / 2, t, half - 1.5 * t],
      f: [cx, y + t, t, half - 1.5 * t],
      g: [cx + t, y + half - t / 2, w - 2 * t, t],
    };
    for (const s of segs) ctx.fillRect(...S[s]);
    cx += w + gap;
  }
  ctx.restore();
  return cx - x;
}
/** Couleurs dominantes (quantification simple, 3 bits par canal). `data` = RGBA à plat. */
export function quantizeColors(data, n = 5) {
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const k = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const e = buckets.get(k) || [0, 0, 0, 0];
    e[0] += r;
    e[1] += g;
    e[2] += b;
    e[3]++;
    buckets.set(k, e);
  }
  const all = [...buckets.values()].sort((a, b) => b[3] - a[3]).map((e) => [e[0] / e[3], e[1] / e[3], e[2] / e[3]]);
  const out = [];
  for (let minDist = 60; out.length < n && minDist >= 0; minDist -= 20) {
    for (const c of all) {
      if (out.length >= n) break;
      if (out.some((o) => Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]) < minDist)) continue;
      out.push(c);
    }
  }
  return out.map((c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase());
}
function dominant(imgs, makeCanvas, n) {
  const list = imgs.filter(Boolean);
  if (!list.length || !makeCanvas) return [];
  const size = 48,
    c = makeCanvas(size * list.length, size),
    x = c.getContext("2d");
  list.forEach((img, i) => x.drawImage(img, i * size, 0, size, size));
  try {
    return quantizeColors(x.getImageData(0, 0, size * list.length, size).data, n);
  } catch {
    return [];
  }
}
/** Flou sans `ctx.filter` (non pris en charge par tous les navigateurs) : réduction puis agrandissement lissé. */
function blurred(ctx, img, x, y, w, h, crop, makeCanvas) {
  if (!img || !makeCanvas) return photo(ctx, img, x, y, w, h, crop);
  const small = makeCanvas(Math.max(8, Math.round(w / 28)), Math.max(8, Math.round(h / 28)));
  const sx = small.getContext("2d");
  sx.imageSmoothingQuality = "high";
  photo(sx, img, 0, 0, small.width, small.height, crop);
  const mid = makeCanvas(Math.round(w / 7), Math.round(h / 7));
  const mx = mid.getContext("2d");
  mx.imageSmoothingQuality = "high";
  mx.drawImage(small, 0, 0, mid.width, mid.height);
  ctx.save();
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(mid, x, y, w, h);
  ctx.restore();
}
function todayText(lang, d = new Date(), style = "short") {
  const dd = String(d.getDate()).padStart(2, "0"),
    mm = String(d.getMonth() + 1).padStart(2, "0"),
    yy = String(d.getFullYear()).slice(2);
  if (style === "lcd") return lang === "en" ? `${mm} ${dd} '${yy}` : `${dd} ${mm} '${yy}`;
  return lang === "en" ? `${mm}.${dd}.${yy}` : `${dd}.${mm}.${yy}`;
}
const pickLang = (lang, o) => (o ? o[lang] || o.fr : "");

/**
 * Dessine un montage tendance. `opt` : { photos, lang, preview, today, makeCanvas }.
 * Renvoie la position des emplacements photo (pour le recadrage au doigt dans l'éditeur).
 */
export function drawTrendy(ctx, tpl, opt = {}) {
  const def = templateById(tpl.id);
  const [W, H] = trendyCanvasSize(tpl);
  const lang = opt.lang || "fr";
  const imgs = opt.photos || [];
  const crops = tpl.crops || [];
  const slots = [];
  const v = (key) => {
    const raw = (tpl.fields?.[key] || "").trim();
    if (raw) return raw;
    const f = def.fields.find((x) => x.key === key);
    return f?.placeholder ? pickLang(lang, f.placeholder) : "";
  };
  const today = opt.today instanceof Date ? opt.today : new Date();
  const bg = tpl.bg || def.bg;
  const fg = tpl.fg || bestTextColor(bg);
  const accent = readableAccent(tpl.accent || "", bg, fg);
  const title = fontById(tpl.font || def.font);
  const [minP, maxP] = def.photos;
  const n = Math.max(minP, Math.min(maxP, imgs.length || maxP));
  const P = (i, x, y, w, h, radius = 0) => {
    slots.push({ i, x, y, w, h });
    photo(ctx, imgs[i] || null, x, y, w, h, crops[i], i, radius);
  };
  const wide = W > H * 1.2;
  const story = !wide && H / W > 1.5;
  const M = 72;
  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  switch (tpl.id) {
    case "t-film": {
      const strip = "#0E0D0B",
        hole = "#EDE6D9",
        mark = "#E8A33D";
      if (wide) {
        const sh = 780,
          sy = (H - sh) / 2;
        ctx.fillStyle = strip;
        ctx.fillRect(0, sy, W, sh);
        for (let x = 20; x < W; x += 64) {
          ctx.fillStyle = hole;
          rr(ctx, x, sy + 22, 34, 46, 7);
          ctx.fill();
          rr(ctx, x, sy + sh - 68, 34, 46, 7);
          ctx.fill();
        }
        const gap = 36,
          fh = sh - 200,
          fw = (W - gap * (n + 1)) / n;
        for (let i = 0; i < n; i++) {
          const x = gap + i * (fw + gap);
          P(i, x, sy + 100, fw, fh);
          line(ctx, `${12 + i * 2}A`, x + 8, sy + sh - 78, F.mono, 24, mark);
        }
        line(ctx, v("roll"), W - 40, sy + 92, F.mono, 24, mark, "right");
        box(ctx, v("caption"), { x: 70, y: 40, w: W * 0.45, h: sy - 50, font: F.script, max: 110, color: fg, align: "left", valign: "bottom" });
      } else {
        const sw = story ? 720 : 600,
          sx = (W - sw) / 2;
        ctx.fillStyle = strip;
        ctx.fillRect(sx, 0, sw, H);
        for (let y = 18; y < H; y += 62) {
          ctx.fillStyle = hole;
          rr(ctx, sx + 20, y, 40, 30, 6);
          ctx.fill();
          rr(ctx, sx + sw - 60, y, 40, 30, 6);
          ctx.fill();
        }
        const gap = 34,
          fw = sw - 160,
          fh = Math.min((H - gap * (n + 1)) / n, fw * 1.05),
          top = (H - (fh * n + gap * (n - 1))) / 2;
        for (let i = 0; i < n; i++) {
          const y = top + i * (fh + gap);
          P(i, sx + 80, y, fw, fh);
          rotated(ctx, sx + sw - 70, y + fh - 10, -90, () => line(ctx, `${12 + i * 2}A`, 0, 0, F.mono, 22, mark));
        }
        rotated(ctx, sx + 14, H / 2, -90, () => line(ctx, v("roll"), 0, 26, F.mono, 22, mark, "center"));
        const cap = v("caption");
        if (cap) {
          rotated(ctx, W / 2 + (story ? 120 : 110), H - (story ? 230 : 170), -4, () => {
            ctx.font = css(F.script, story ? 76 : 64);
            const tw = Math.min(ctx.measureText(cap).width, W - 200) + 70;
            shadowed(ctx, () => {
              ctx.fillStyle = "#FBF7EF";
              ctx.fillRect(-tw / 2, -62, tw, 112);
            }, 18, 0.35, 8);
            box(ctx, cap, { x: -tw / 2 + 30, y: -54, w: tw - 60, h: 100, font: F.script, max: story ? 76 : 64, color: "#1A1A1A", align: "center", valign: "middle" });
          });
        }
      }
      break;
    }
    case "t-polaroid": {
      const pw = story ? 640 : 500;
      const pos = story
        ? n === 3
          ? [[0.4, 0.27, -6], [0.6, 0.52, 5], [0.42, 0.76, -3]]
          : [[0.42, 0.33, -5], [0.58, 0.66, 4]]
        : n === 3
          ? [[0.3, 0.36, -7], [0.7, 0.4, 6], [0.5, 0.66, -2]]
          : [[0.35, 0.42, -6], [0.64, 0.56, 5]];
      const border = pw * 0.055,
        ph = pw - 2 * border,
        bottom = pw * 0.24,
        H2 = border + ph + bottom;
      pos.slice(0, n).forEach(([fx, fy, deg], i) => {
        const cx = W * fx,
          cy = H * fy;
        rotated(ctx, cx, cy, deg, () => {
          shadowed(ctx, () => {
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(-pw / 2, -H2 / 2, pw, H2);
          }, 34, 0.26, 14);
          photo(ctx, imgs[i] || null, -pw / 2 + border, -H2 / 2 + border, ph, ph, crops[i], i);
          if (i === n - 1) box(ctx, v("caption"), { x: -pw / 2 + border, y: H2 / 2 - bottom + 6, w: ph, h: bottom - 18, font: F.script, max: pw * 0.11, color: "#2A2622", align: "center", valign: "middle" });
          if (i === 0 && v("date")) line(ctx, v("date"), pw / 2 - border, H2 / 2 - bottom * 0.4, F.script, pw * 0.07, "#6B625A", "right");
        });
        slots.push({ i, x: cx - ph / 2, y: cy - H2 / 2 + border, w: ph, h: ph });
      });
      sparkle(ctx, W * 0.84, H * (story ? 0.14 : 0.16), 34, accent);
      sparkle(ctx, W * 0.15, H * 0.88, 24, accent);
      break;
    }
    case "t-scrap": {
      grain(ctx, W, H, 0.8, 5);
      const layouts = wide
        ? [[90, 250, 640, 760, -3], [760, 330, 640, 700, 4], [1460, 260, 600, 720, -5]]
        : story
          ? n === 3
            ? [[90, 330, 620, 740, -3], [430, 900, 560, 620, 4], [110, 1340, 440, 440, -6]]
            : [[110, 360, 640, 800, -3], [380, 1060, 600, 640, 4]]
          : n === 3
            ? [[70, 230, 520, 600, -4], [540, 300, 470, 520, 5], [300, 820, 440, 420, -2]]
            : [[80, 240, 560, 680, -4], [500, 540, 500, 600, 5]];
      layouts.slice(0, n).forEach(([x, y, w, h, deg], i) => {
        rotated(ctx, x + w / 2, y + h / 2, deg, () => {
          shadowed(ctx, () => {
            ctx.fillStyle = "#FFFFFF";
            tornPath(ctx, -w / 2 - 22, -h / 2 - 22, w + 44, h + 44, 31 + i * 7, 12);
            ctx.fill();
          }, 22, 0.2, 8);
          photo(ctx, imgs[i] || null, -w / 2, -h / 2, w, h, crops[i], i);
        });
        tape(ctx, x + w / 2, y - 6, 190, deg - 6);
        slots.push({ i, x, y, w, h });
      });
      const ink = fg;
      box(ctx, v("title"), { x: wide ? 90 : 80, y: wide ? 60 : story ? 110 : 50, w: wide ? 900 : W - 300, h: story ? 180 : 150, font: F.script, max: story ? 150 : 120, color: ink, align: "left", valign: "middle" });
      doodleStar(ctx, wide ? 1010 : W - 150, story ? 190 : 120, 46, accent);
      sparkle(ctx, wide ? 1090 : W - 90, story ? 270 : 190, 22, accent);
      const note = v("note");
      if (note) {
        const nx = wide ? W - 760 : story ? 560 : n === 3 ? 770 : 90,
          ny = wide ? H - 190 : story ? H - 260 : n === 3 ? H - 300 : H - 230;
        box(ctx, note, { x: nx, y: ny, w: wide ? 680 : !story && n === 2 ? 380 : W - nx - 60, h: 130, font: F.script, max: 70, color: ink, align: "left", valign: "middle" });
        squiggle(ctx, nx, ny + 150, Math.min(360, W - nx - 80), accent, 10);
        if (nx > 300) arrow(ctx, nx - 20, ny + 50, nx - 130, ny - 70, ink, 5);
      }
      break;
    }
    case "t-mag": {
      P(0, 0, 0, W, H);
      const ink = tpl.fg || "#FFFFFF";
      const g = ctx.createLinearGradient(0, H * 0.45, 0, H);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,.55)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const g2 = ctx.createLinearGradient(0, 0, 0, H * 0.25);
      g2.addColorStop(0, "rgba(0,0,0,.35)");
      g2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H * 0.25);
      box(ctx, v("masthead"), { x: 50, y: story ? 70 : 40, w: W - 100, h: story ? 260 : 220, font: title, max: 300, min: 60, color: ink, align: "center", valign: "middle", lh: 1, upper: true, spacing: 0.02 });
      line(ctx, v("issue"), W - 60, story ? 380 : 300, F.grotesk, 30, ink, "right", 400, 3);
      const baseY = story ? H - 620 : H - 470;
      ctx.fillStyle = accent;
      ctx.fillRect(60, baseY, 90, 10);
      box(ctx, v("line1"), { x: 60, y: baseY + 30, w: W * 0.66, h: story ? 260 : 200, font: F.bold, max: story ? 84 : 70, color: ink, align: "left", valign: "top", lh: 1.05 });
      box(ctx, v("line2"), { x: 60, y: baseY + (story ? 320 : 250), w: W * 0.6, h: 70, font: F.body, max: 40, color: ink, align: "left", upper: true, spacing: 0.08 });
      box(ctx, v("line3"), { x: 60, y: baseY + (story ? 400 : 320), w: W * 0.6, h: 70, font: F.body, max: 40, color: ink, align: "left", upper: true, spacing: 0.08 });
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(W - 230, H - 170, 170, 110);
      barcode(ctx, W - 218, H - 160, 146, 72, hash(v("masthead")));
      line(ctx, v("issue"), W - 145, H - 72, F.mono, 16, "#1A1A1A", "center", 150);
      break;
    }
    case "t-dump": {
      const gap = 14;
      let top, bottom;
      if (wide) {
        top = 150;
        bottom = H - 70;
        const cols = 3,
          rows = 2,
          cw = (W - gap * (cols + 1)) / cols,
          ch = (bottom - top - gap * (rows - 1)) / rows;
        for (let i = 0; i < 6; i++) P(i, gap + (i % cols) * (cw + gap), top + Math.floor(i / cols) * (ch + gap), cw, ch);
        line(ctx, v("title"), 50, 100, title, 72, fg, "left", 1000);
      } else {
        top = story ? 250 : 150;
        bottom = H - (story ? 170 : 110);
        const rows = Math.ceil(n / 2),
          cw = (W - gap * 3) / 2,
          ch = (bottom - top - gap * (rows - 1)) / rows;
        for (let i = 0; i < n; i++) {
          const r = Math.floor(i / 2),
            lastOdd = n % 2 === 1 && i === n - 1;
          P(i, lastOdd ? gap : gap + (i % 2) * (cw + gap), top + r * (ch + gap), lastOdd ? W - 2 * gap : cw, ch);
        }
        line(ctx, v("title"), M - 30, top - (story ? 60 : 40), title, story ? 92 : 70, fg, "left", W - 200);
      }
      const date = v("date") || todayText(lang, today);
      line(ctx, date, W - 40, H - (wide ? 22 : story ? 70 : 40), F.mono, story ? 40 : 32, accent, "right");
      if (!wide) sparkle(ctx, W - 80, top - (story ? 90 : 70), 26, accent);
      break;
    }
    case "t-mood": {
      const rest = Array.from({ length: n - 1 }, (_, i) => i + 1);
      const tTop = story ? 120 : 60;
      box(ctx, v("title"), { x: M, y: tTop, w: W - 2 * M, h: story ? 130 : 100, font: title, max: story ? 104 : 80, color: fg, align: "left", valign: "middle" });
      const gy = tTop + (story ? 170 : 125),
        gh = story ? 960 : 640,
        lw = (W - 2 * M) * 0.56;
      P(0, M, gy, lw, gh, 10);
      const rh = (gh - 18 * (rest.length - 1)) / rest.length;
      rest.forEach((idx, k) => P(idx, M + lw + 18, gy + k * (rh + 18), W - 2 * M - lw - 18, rh, 10));
      let colors = dominant(imgs.slice(0, n), opt.makeCanvas, 5);
      if (colors.length < 5) colors = [...colors, ...["#D9C7B0", "#A68A6D", "#5E6B57", "#E8DED1", "#2F2A26"]].slice(0, 5);
      const sy = gy + gh + (story ? 90 : 50),
        d = story ? 150 : 118,
        sg = (W - 2 * M - 5 * d) / 4;
      colors.forEach((c, i) => {
        const cx = M + d / 2 + i * (d + sg);
        shadowed(ctx, () => {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(cx, sy + d / 2, d / 2, 0, Math.PI * 2);
          ctx.fill();
        }, 14, 0.16, 6);
        line(ctx, c, cx, sy + d + 44, F.mono, story ? 26 : 22, fg, "center");
      });
      box(ctx, v("words"), { x: M, y: sy + d + (story ? 90 : 66), w: W - 2 * M, h: story ? 90 : 70, font: F.serifLight, max: story ? 52 : 40, color: fg, align: "center", valign: "middle" });
      break;
    }
    case "t-minimal": {
      const tTop = story ? 170 : 70,
        th = story ? 260 : 190;
      box(ctx, v("title"), { x: M, y: tTop, w: W - 2 * M, h: th, font: title, max: story ? 150 : 120, color: fg, align: "center", valign: "bottom", lh: 1.02 });
      const py = tTop + th + (story ? 70 : 44),
        phh = story ? 1050 : 780;
      P(0, M + 20, py, W - 2 * M - 40, phh);
      box(ctx, v("caption"), { x: M, y: py + phh + (story ? 60 : 36), w: W - 2 * M, h: 60, font: F.body, max: 30, color: fg, align: "center", valign: "middle", upper: true, spacing: 0.25, alpha: 0.8 });
      break;
    }
    case "t-split": {
      const a = W * 0.62,
        b = W * 0.38;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(a, 0);
      ctx.lineTo(b, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.clip();
      photo(ctx, imgs[0] || null, 0, 0, W, H, crops[0], 0);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(a, 0);
      ctx.lineTo(W, 0);
      ctx.lineTo(W, H);
      ctx.lineTo(b, H);
      ctx.closePath();
      ctx.clip();
      photo(ctx, imgs[1] || null, 0, 0, W, H, crops[1], 1);
      ctx.restore();
      slots.push({ i: 0, x: 0, y: 0, w: W / 2, h: H }, { i: 1, x: W / 2, y: 0, w: W / 2, h: H });
      ctx.save();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(a, -10);
      ctx.lineTo(b, H + 10);
      ctx.stroke();
      ctx.restore();
      const tag = (txt, x, y, al, fill) => {
        if (!txt) return;
        ctx.save();
        ctx.font = css(F.bold, 40);
        const w = ctx.measureText(txt).width + 56;
        const left = al === "right" ? x - w : x;
        ctx.fillStyle = fill;
        rr(ctx, left, y, w, 78, 39);
        ctx.fill();
        ctx.fillStyle = bestTextColor(fill);
        ctx.textBaseline = "middle";
        ctx.fillText(txt, left + 28, y + 41);
        ctx.restore();
      };
      tag(v("label1"), 50, 60, "left", "#FFFFFF");
      tag(v("label2"), W - 50, H - 140, "right", accent);
      break;
    }
    case "t-digicam": {
      P(0, 0, 0, W, H);
      ctx.save();
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = "rgba(255,190,120,.22)";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      vignette(ctx, W, H, 0.3);
      grain(ctx, W, H, 1.4, 41);
      const raw = (tpl.fields?.date || "").trim() || todayText(lang, today, "lcd");
      const hh = story ? 92 : 78;
      ctx.save();
      ctx.font = css(F.mono, 10);
      const est = [...raw].reduce((s, c) => s + (c === " " ? hh * 0.31 : c === "'" || c === "." ? hh * 0.27 : hh * 0.72), 0);
      ctx.restore();
      lcdText(ctx, raw, W - 70 - est, H - (story ? 170 : 120), hh);
      const cap = v("caption");
      if (cap) line(ctx, cap, 70, H - (story ? 118 : 70), F.mono, 34, "#FFFFFF", "left", W - 500);
      break;
    }
    case "t-day": {
      box(ctx, v("title"), { x: M, y: story ? 110 : 56, w: W - 2 * M, h: story ? 150 : 110, font: title, max: story ? 120 : 96, color: fg, align: "left", valign: "middle", lh: 1 });
      if (story) {
        const top = 330,
          rh = (H - top - 90) / n,
          lineX = 210;
        ctx.save();
        ctx.strokeStyle = fg;
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(lineX, top);
        ctx.lineTo(lineX, top + rh * n - 60);
        ctx.stroke();
        ctx.restore();
        for (let i = 0; i < n; i++) {
          const y = top + i * rh;
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(lineX, y + 30, 16, 0, Math.PI * 2);
          ctx.fill();
          line(ctx, v("t" + (i + 1)), lineX - 40, y + 56, F.bebas, 58, fg, "right", 150);
          P(i, lineX + 50, y, W - lineX - 50 - M, rh - 100, 22);
          line(ctx, v("l" + (i + 1)), lineX + 50, y + rh - 46, F.body, 36, fg, "left", W - lineX - 120);
        }
      } else {
        const top = 200,
          gap = 30,
          cw = (W - 2 * M - gap) / 2,
          ch = (H - top - 60 - gap) / 2;
        for (let i = 0; i < n; i++) {
          const x = M + (i % 2) * (cw + gap),
            y = top + Math.floor(i / 2) * (ch + gap);
          P(i, x, y, cw, ch - 80, 20);
          line(ctx, v("t" + (i + 1)), x, y + ch - 22, F.bebas, 52, accent, "left", 170);
          line(ctx, v("l" + (i + 1)), x + 150, y + ch - 26, F.body, 32, fg, "left", cw - 160);
        }
      }
      break;
    }
    case "t-ootd": {
      const px = M,
        py = story ? 330 : 210,
        pw = story ? 600 : 540,
        ph = story ? 1460 : 1080;
      box(ctx, v("title"), { x: M, y: story ? 120 : 50, w: W - 2 * M, h: story ? 160 : 130, font: title, max: story ? 120 : 96, color: fg, align: "left", valign: "middle", lh: 1 });
      P(0, px, py, pw, ph, 18);
      const lx = px + pw + 70;
      [0.24, 0.52, 0.82].forEach((f, k) => {
        const txt = v("i" + (k + 1));
        if (!txt) return;
        const ty = py + ph * f;
        const dx = px + pw * (k === 1 ? 0.75 : 0.62),
          dy = ty + (k - 1) * 30;
        ctx.save();
        ctx.strokeStyle = fg;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(lx - 20, ty);
        ctx.stroke();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(dx, dy, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = fg;
        ctx.stroke();
        ctx.restore();
        box(ctx, txt, { x: lx, y: ty - 50, w: W - lx - 40, h: 110, font: F.script, max: story ? 64 : 56, color: fg, align: "left", valign: "middle", lh: 1 });
      });
      break;
    }
    case "t-recipe": {
      const ph = story ? 900 : 560;
      P(0, 0, 0, W, ph);
      const cx = 56,
        cy = ph - 90,
        cw = W - 112,
        chh = H - cy - 56;
      shadowed(ctx, () => {
        ctx.fillStyle = "#FFFDF8";
        rr(ctx, cx, cy, cw, chh, 34);
        ctx.fill();
      }, 30, 0.18, 10);
      const ink = "#2A2622";
      box(ctx, v("title"), { x: cx + 56, y: cy + 50, w: cw - 112, h: story ? 170 : 130, font: title, max: story ? 92 : 76, color: ink, align: "left", valign: "middle", lh: 1.02 });
      const my = cy + (story ? 250 : 200);
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx + 76, my - 12, 20, 0, Math.PI * 2);
      ctx.moveTo(cx + 76, my - 24);
      ctx.lineTo(cx + 76, my - 12);
      ctx.lineTo(cx + 86, my - 6);
      ctx.stroke();
      ctx.restore();
      const tw = line(ctx, v("time"), cx + 110, my, F.bold, 34, ink);
      line(ctx, "·  " + v("serves"), cx + 130 + tw, my, F.body, 34, ink, "left", cw - tw - 200);
      ctx.fillStyle = "rgba(0,0,0,.1)";
      ctx.fillRect(cx + 56, my + 40, cw - 112, 2);
      line(ctx, pickLang(lang, { fr: "INGRÉDIENTS", es: "INGREDIENTES", en: "INGREDIENTS" }), cx + 56, my + 110, F.bold, 26, accent, "left", 600, 5);
      const items = v("ingredients").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 8);
      const rowH = Math.min(story ? 74 : 58, (cy + chh - (my + 150) - 30) / Math.max(1, items.length));
      items.forEach((it, i) => {
        const y = my + 150 + i * rowH + rowH * 0.6;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(cx + 70, y - 11, 7, 0, Math.PI * 2);
        ctx.fill();
        line(ctx, it, cx + 96, y, F.lora, Math.min(story ? 42 : 34, rowH * 0.62), ink, "left", cw - 160);
      });
      break;
    }
    case "t-ticket": {
      const tx = M,
        ty = story ? 260 : 110,
        tw = W - 2 * M,
        th = story ? 1380 : 1130,
        phh = story ? 620 : 470,
        ink = "#1F1C19";
      shadowed(ctx, () => {
        ctx.fillStyle = "#FFFDF8";
        rr(ctx, tx, ty, tw, th, 36);
        ctx.fill();
      }, 40, 0.22, 16);
      ctx.save();
      rr(ctx, tx, ty, tw, th, 36);
      ctx.clip();
      P(0, tx, ty, tw, phh);
      ctx.restore();
      const perfY = ty + phh + (story ? 470 : 400);
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(tx, perfY, 34, 0, Math.PI * 2);
      ctx.arc(tx + tw, perfY, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(tx, perfY, 34, 0, Math.PI * 2);
      ctx.arc(tx + tw, perfY, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.strokeStyle = "rgba(0,0,0,.25)";
      ctx.setLineDash([14, 12]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(tx + 50, perfY);
      ctx.lineTo(tx + tw - 50, perfY);
      ctx.stroke();
      ctx.restore();
      const by = ty + phh + 60;
      line(ctx, v("title").toUpperCase(), tx + 56, by + 20, F.bold, 28, accent, "left", tw - 112, 5);
      line(ctx, v("from").toUpperCase(), tx + 56, by + (story ? 210 : 180), title, story ? 200 : 170, ink, "left", tw * 0.4);
      line(ctx, v("to").toUpperCase(), tx + tw - 56, by + (story ? 210 : 180), title, story ? 200 : 170, ink, "right", tw * 0.4);
      // avion stylisé
      rotated(ctx, tx + tw / 2, by + (story ? 140 : 120), 90, () => {
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(0, -46);
        ctx.quadraticCurveTo(10, -40, 10, -10);
        ctx.lineTo(52, 14);
        ctx.lineTo(52, 26);
        ctx.lineTo(10, 14);
        ctx.lineTo(8, 36);
        ctx.lineTo(22, 46);
        ctx.lineTo(22, 54);
        ctx.lineTo(0, 48);
        ctx.lineTo(-22, 54);
        ctx.lineTo(-22, 46);
        ctx.lineTo(-8, 36);
        ctx.lineTo(-10, 14);
        ctx.lineTo(-52, 26);
        ctx.lineTo(-52, 14);
        ctx.lineTo(-10, -10);
        ctx.quadraticCurveTo(-10, -40, 0, -46);
        ctx.fill();
      });
      line(ctx, v("fromCity"), tx + 60, by + (story ? 270 : 232), F.body, 32, ink, "left", tw * 0.42);
      line(ctx, v("toCity"), tx + tw - 60, by + (story ? 270 : 232), F.body, 32, ink, "right", tw * 0.42);
      const lab = (txt, val, x, y) => {
        line(ctx, txt, x, y, F.body, 22, "#8A8178", "left", 300, 3);
        line(ctx, val, x, y + 46, F.mono, 36, ink, "left", 320);
      };
      lab(pickLang(lang, { fr: "DATE", es: "FECHA", en: "DATE" }), v("date") || todayText(lang, today), tx + 56, by + (story ? 360 : 300));
      lab(pickLang(lang, { fr: "PORTE", es: "PUERTA", en: "GATE" }), "A" + ((hash(v("to")) % 40) + 1), tx + tw / 2 - 40, by + (story ? 360 : 300));
      lab(pickLang(lang, { fr: "SIÈGE", es: "ASIENTO", en: "SEAT" }), String((hash(v("from")) % 30) + 1) + "A", tx + tw - 200, by + (story ? 360 : 300));
      barcode(ctx, tx + 70, perfY + 60, tw - 140, story ? 150 : 110, hash(v("from") + v("to")), ink);
      if (n > 1) {
        const r = story ? 150 : 120,
          cx = tx + tw - r * 0.8,
          cy = ty + phh - r * 0.3;
        shadowed(ctx, () => {
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.arc(cx, cy, r + 12, 0, Math.PI * 2);
          ctx.fill();
        }, 20, 0.25, 6);
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        photo(ctx, imgs[1] || null, cx - r, cy - r, 2 * r, 2 * r, crops[1], 1);
        ctx.restore();
        slots.push({ i: 1, x: cx - r, y: cy - r, w: 2 * r, h: 2 * r });
      }
      break;
    }
    case "t-blurquote": {
      slots.push({ i: 0, x: 0, y: 0, w: W, h: H });
      if (imgs[0]) blurred(ctx, imgs[0], 0, 0, W, H, crops[0], opt.makeCanvas);
      else photo(ctx, null, 0, 0, W, H, {}, 0);
      ctx.fillStyle = "rgba(0,0,0,.38)";
      ctx.fillRect(0, 0, W, H);
      const iw = story ? 560 : 440,
        ih = story ? 720 : 520,
        ix = (W - iw) / 2,
        iy = story ? 250 : 110;
      shadowed(ctx, () => {
        ctx.fillStyle = "#FFFFFF";
        rr(ctx, ix - 14, iy - 14, iw + 28, ih + 28, 28);
        ctx.fill();
      }, 40, 0.35, 16);
      photo(ctx, imgs[0] || null, ix, iy, iw, ih, crops[0], 0, 18);
      const ink = tpl.fg || "#FFFFFF";
      const qy = iy + ih + (story ? 110 : 70);
      const q = v("quote").replace(/^[«"“\s\u00a0]+|[»"”\s\u00a0]+$/g, "");
      box(ctx, lang === "en" ? "“" + q + "”" : lang === "es" ? "«" + q + "»" : "«\u00a0" + q + "\u00a0»", { x: M + 20, y: qy, w: W - 2 * M - 40, h: story ? 520 : 380, font: title, max: story ? 92 : 74, color: ink, align: "center", valign: "top", lh: 1.12 });
      if (v("author")) line(ctx, "— " + v("author"), W / 2, H - (story ? 150 : 70), F.body, 34, ink, "center", W - 200);
      break;
    }
    case "t-pano": {
      if (n === 1) P(0, 0, 0, W, H);
      else if (n === 2) {
        P(0, 0, 0, 1800, H);
        P(1, 1800, 0, W - 1800, H);
      } else {
        P(0, 80, 150, 1500, 1050);
        P(1, 1640, 150, 760, 510);
        P(2, 1640, 690, 760, 510);
      }
      const onPhoto = n < 3;
      const ink = onPhoto ? tpl.fg || "#FFFFFF" : fg;
      if (onPhoto) {
        const g = ctx.createLinearGradient(0, H * 0.5, 0, H);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,.45)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      if (onPhoto) box(ctx, v("title"), { x: 80, y: H - 420, w: 900, h: 260, font: title, max: 120, color: ink, align: "left", valign: "bottom", lh: 1.02, shadow: "rgba(0,0,0,.35)" });
      else box(ctx, v("title"), { x: 80, y: 20, w: 1400, h: 120, font: title, max: 84, color: fg, align: "left", valign: "middle", lh: 1 });
      line(ctx, "→", 1000, H - 90, F.bold, 70, onPhoto ? ink : fg, "right");
      const cap = v("caption");
      if (cap) {
        const x0 = onPhoto ? 2160 + 100 : 2440,
          w0 = onPhoto ? 880 : W - 2440 - 60;
        box(ctx, cap, { x: x0, y: onPhoto ? H - 420 : 380, w: w0, h: onPhoto ? 280 : 560, font: onPhoto ? title : F.script, max: onPhoto ? 84 : 76, color: ink, align: "left", valign: onPhoto ? "bottom" : "middle", lh: 1.1, shadow: onPhoto ? "rgba(0,0,0,.35)" : undefined });
      }
      break;
    }
  }
  // Signature (compte) discrète, si elle est renseignée.
  const handle = (tpl.handle || "").trim();
  if (tpl.showHandle !== false && handle && !["t-mag", "t-pano", "t-digicam", "t-dump"].includes(tpl.id)) {
    const t = handle.startsWith("@") || handle.includes(".") ? handle : "@" + handle;
    const dark = ["t-film", "t-blurquote"].includes(tpl.id);
    line(ctx, t, wide ? W - SLIDE[0] / 2 : W / 2, H - 28, F.body, 26, dark ? "rgba(255,255,255,.75)" : fg, "center", W - 200);
  }
  if (tpl.filter === "film") filmFilter(ctx, W, H);
  ctx.restore();
  return slots;
}
/** Découpe un canvas de carrousel en slides 1080×1350 (une image par slide, dans l'ordre). */
export function sliceCarousel(source, makeCanvas) {
  const [sw, sh] = SLIDE;
  const count = Math.round(source.width / sw);
  return Array.from({ length: count }, (_, i) => {
    const c = makeCanvas(sw, sh);
    c.getContext("2d").drawImage(source, i * sw, 0, sw, sh, 0, 0, sw, sh);
    return c;
  });
}
