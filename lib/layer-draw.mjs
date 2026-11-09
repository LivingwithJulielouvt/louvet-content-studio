// Dessin des visuels à calques (lib/layers.mjs) sur un canvas. Aucune ressource distante,
// aucun hasard non reproductible : un même visuel donne toujours la même image.
import { TEMPLATE_FONTS, BODY_FONT, TRENDY_FONTS, fitText } from "./templates.mjs";
import { layerCanvasSize, SLIDE_W } from "./layers.mjs";

const FONT_MAP = {
  ...Object.fromEntries(TEMPLATE_FONTS.map((f) => [f.id, f])),
  body: BODY_FONT,
  serif: TRENDY_FONTS.serifLight,
  loralight: TRENDY_FONTS.loraLight,
  mono: TRENDY_FONTS.mono,
};
/** Polices à charger avant de dessiner. */
export const LAYER_FONT_FILES = [...TEMPLATE_FONTS, BODY_FONT, ...Object.values(TRENDY_FONTS)];
export const layerFont = (id) => FONT_MAP[id] || FONT_MAP.poppins;
const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const css = (f, s, italic = false) => `${italic ? "italic " : ""}${f.weight} ${Math.max(1, Math.round(s))}px "${f.family}", ${EMOJI}`;

function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(Number(r) || 0, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
const hash = (s) => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const PLACE = [
  ["#D9CFC3", "#BFB1A2"],
  ["#CFD6D8", "#A9B5B9"],
  ["#E2D4CB", "#C7AFA3"],
  ["#D6D9CB", "#B4B9A2"],
];
/** Photo « cover » avec recadrage (ou dégradé neutre quand l'emplacement est vide). */
function drawImageCover(ctx, img, x, y, w, h, crop = {}, seed = 0, showEmpty = false) {
  if (!img) {
    const [a, b] = PLACE[seed % PLACE.length];
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // Formes douces abstraites : jamais une fausse photo.
    ctx.fillStyle = "rgba(255,255,255,.22)";
    ctx.beginPath();
    ctx.arc(x + w * 0.72, y + h * 0.3, Math.min(w, h) * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,.06)";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.35, y + h * 0.85, w * 0.5, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    if (showEmpty) {
      const r = Math.min(w, h) * 0.12;
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1A1A1A";
      ctx.lineWidth = Math.max(2, r * 0.12);
      ctx.beginPath();
      ctx.moveTo(x + w / 2 - r * 0.45, y + h / 2);
      ctx.lineTo(x + w / 2 + r * 0.45, y + h / 2);
      ctx.moveTo(x + w / 2, y + h / 2 - r * 0.45);
      ctx.lineTo(x + w / 2, y + h / 2 + r * 0.45);
      ctx.stroke();
    }
    return;
  }
  const iw = img.naturalWidth || img.width,
    ih = img.naturalHeight || img.height;
  const z = Math.min(4, Math.max(1, crop.z || 1));
  const s = Math.max(w / iw, h / ih) * z;
  const dw = iw * s,
    dh = ih * s;
  const ox = ((Math.min(1, Math.max(-1, crop.x || 0)) * (dw - w)) / 2) | 0,
    oy = ((Math.min(1, Math.max(-1, crop.y || 0)) * (dh - h)) / 2) | 0;
  ctx.drawImage(img, x + (w - dw) / 2 - ox, y + (h - dh) / 2 - oy, dw, dh);
}
/** Flou portable (iPhone : pas de ctx.filter partout) : réduction puis agrandissement. */
function blurredCover(ctx, img, W, H, crop, blur, makeCanvas) {
  if (!blur || !makeCanvas) return drawImageCover(ctx, img, 0, 0, W, H, crop);
  const f = Math.max(4, Math.round(blur / 2));
  const small = makeCanvas(Math.max(8, Math.round(W / f)), Math.max(8, Math.round(H / f)));
  const sc = small.getContext("2d");
  drawImageCover(sc, img, 0, 0, small.width, small.height, crop);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, -f, -f, W + 2 * f, H + 2 * f);
  ctx.restore();
}

/** Texte ajusté (taille max = l.size), avec surlignage par ligne, contour ou ombre. */
function drawText(ctx, l) {
  const f = layerFont(l.font);
  const raw = l.upper ? String(l.text || "").toUpperCase() : String(l.text || "");
  if (!raw.trim()) return;
  const lh = l.lh || 1.1;
  const pad = l.bg ? l.size * 0.22 : 0;
  const measureAt = (size) => {
    ctx.font = css(f, size, l.italic);
    return (s) => ctx.measureText(s).width + (l.spacing ? s.length * l.spacing * size : 0);
  };
  const fit = fitText(raw, { maxWidth: Math.max(10, l.w - pad * 2), maxHeight: Math.max(10, l.h), maxSize: l.size, minSize: Math.min(12, l.size), lineHeight: lh }, measureAt);
  ctx.font = css(f, fit.size, l.italic);
  if (l.spacing) ctx.letterSpacing = l.spacing * fit.size + "px";
  ctx.textBaseline = "alphabetic";
  const total = fit.lines.length * fit.size * lh;
  let y = -total / 2 + fit.size * 0.88;
  for (const line of fit.lines) {
    const w = ctx.measureText(line).width;
    const x = l.align === "left" ? -l.w / 2 + pad : l.align === "right" ? l.w / 2 - pad - w : -w / 2;
    if (l.bg && line.trim()) {
      ctx.save();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = l.bg;
      rr(ctx, x - pad, y - fit.size * 0.86 - pad * 0.35, w + pad * 2, fit.size * lh + pad * 0.5, pad * 0.6);
      ctx.fill();
      ctx.restore();
    }
    if (l.shadow) {
      ctx.shadowColor = "rgba(0,0,0,.45)";
      ctx.shadowBlur = fit.size * 0.3;
      ctx.shadowOffsetY = fit.size * 0.05;
    }
    if (l.outline) {
      ctx.lineJoin = "round";
      ctx.strokeStyle = l.outline;
      ctx.lineWidth = Math.max(2, fit.size * 0.08);
      ctx.strokeText(line, x, y);
    }
    ctx.fillStyle = l.color;
    ctx.fillText(line, x, y);
    ctx.shadowColor = "transparent";
    y += fit.size * lh;
  }
}
function fitLine(ctx, text, f, size, maxW) {
  let s = size;
  ctx.font = css(f, s);
  while (s > 10 && ctx.measureText(text).width > maxW) {
    s -= 1;
    ctx.font = css(f, s);
  }
  return s;
}
function drawBubble(ctx, l) {
  const { w, h } = l;
  ctx.save();
  if (l.shadow) {
    ctx.shadowColor = "rgba(0,0,0,.18)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
  }
  ctx.fillStyle = l.color;
  rr(ctx, -w / 2, -h / 2, w, h, Math.min(h / 2, 70));
  ctx.fill();
  if (l.tail !== "none") {
    const dir = l.tail === "left" ? -1 : 1;
    const tx = dir * (w / 2 - Math.min(h / 2, 70) * 0.5);
    ctx.beginPath();
    ctx.moveTo(tx - dir * h * 0.28, h / 2 - h * 0.18);
    ctx.quadraticCurveTo(tx + dir * h * 0.05, h / 2 + h * 0.02, tx + dir * h * 0.32, h / 2 + h * 0.16);
    ctx.quadraticCurveTo(tx + dir * h * 0.02, h / 2 + h * 0.1, tx - dir * h * 0.02, h / 2 - h * 0.08);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const box = { ...l, type: "text", x: 0, y: 0, w: w - h * 0.6, h: h * 0.78, color: l.textColor, align: "center", lh: 1.1, bg: "", outline: "", shadow: false };
  drawText(ctx, box);
  if (l.sticker) {
    const s = h * 0.62;
    ctx.save();
    ctx.translate(w / 2 - s * 0.35, -h / 2 - s * 0.05);
    ctx.rotate(0.18);
    drawStickerGlyph(ctx, { glyph: l.sticker, emoji: l.sticker, w: s, h: s, color: "#FF7EB6", id: l.id });
    ctx.restore();
  }
}
function drawLabel(ctx, l) {
  const f = layerFont(l.font);
  const text = l.upper ? String(l.text || "").toUpperCase() : String(l.text || "");
  ctx.save();
  if (l.shadow) {
    ctx.shadowColor = "rgba(0,0,0,.2)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
  }
  rr(ctx, -l.w / 2, -l.h / 2, l.w, l.h, l.h / 2);
  if (l.outline) {
    ctx.strokeStyle = l.textColor;
    ctx.lineWidth = Math.max(2, l.h * 0.04);
    ctx.stroke();
  } else {
    ctx.fillStyle = l.color;
    ctx.fill();
  }
  ctx.restore();
  const s = fitLine(ctx, text, f, Math.min(l.size, l.h * 0.6), l.w - l.h * 0.6);
  ctx.font = css(f, s);
  if (l.upper) ctx.letterSpacing = s * 0.12 + "px";
  ctx.fillStyle = l.textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, s * 0.05);
}
function star(ctx, r, points = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i * Math.PI) / points - Math.PI / 2;
    const rad = i % 2 ? r * inner : r;
    i ? ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
}
function heart(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(0, r * 0.75);
  ctx.bezierCurveTo(-r * 1.25, -r * 0.05, -r * 0.6, -r * 0.95, 0, -r * 0.35);
  ctx.bezierCurveTo(r * 0.6, -r * 0.95, r * 1.25, -r * 0.05, 0, r * 0.75);
  ctx.closePath();
}
/** Autocollant vectoriel (ou emoji si la police du téléphone le fournit). */
function drawStickerGlyph(ctx, l) {
  const r = Math.min(l.w, l.h) / 2;
  const c = l.color || "#F5C542";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  switch (l.glyph) {
    case "star":
      ctx.fillStyle = c;
      star(ctx, r * 0.95);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.12)";
      ctx.lineWidth = r * 0.05;
      ctx.stroke();
      return;
    case "doodlestar":
      ctx.strokeStyle = c;
      ctx.lineWidth = r * 0.1;
      star(ctx, r * 0.9);
      ctx.stroke();
      return;
    case "sparkle":
      ctx.fillStyle = c;
      star(ctx, r * 0.95, 4, 0.22);
      ctx.fill();
      ctx.save();
      ctx.translate(r * 0.62, -r * 0.55);
      star(ctx, r * 0.3, 4, 0.25);
      ctx.fill();
      ctx.restore();
      return;
    case "heart":
      ctx.fillStyle = c;
      heart(ctx, r * 0.95);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.45)";
      ctx.beginPath();
      ctx.ellipse(-r * 0.38, -r * 0.28, r * 0.16, r * 0.1, -0.6, 0, Math.PI * 2);
      ctx.fill();
      return;
    case "bow": {
      ctx.fillStyle = c;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(s * r * 0.5, -r * 0.75, s * r * 1.05, -r * 0.45, s * r * 0.9, 0);
        ctx.bezierCurveTo(s * r * 1.05, r * 0.4, s * r * 0.5, r * 0.55, 0, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(s * r * 0.08, r * 0.05);
        ctx.lineTo(s * r * 0.45, r * 0.95);
        ctx.lineTo(s * r * 0.22, r * 0.85);
        ctx.lineTo(s * r * 0.02, r * 0.2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.12)";
      ctx.lineWidth = r * 0.04;
      ctx.stroke();
      return;
    }
    case "coffee":
      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = c === "#F5C542" ? "#6B4A35" : c;
      ctx.lineWidth = r * 0.08;
      rr(ctx, -r * 0.62, -r * 0.35, r * 1.0, r * 0.9, r * 0.18);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r * 0.45, r * 0.08, r * 0.24, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      for (const dx of [-0.3, 0, 0.3]) {
        ctx.moveTo(r * dx - r * 0.12, -r * 0.5);
        ctx.quadraticCurveTo(r * dx + r * 0.1, -r * 0.7, r * dx - r * 0.05, -r * 0.92);
      }
      ctx.stroke();
      return;
    case "flower":
      ctx.fillStyle = c;
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI * 2) / 5);
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.5, r * 0.3, r * 0.48, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = "#FFE08A";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.26, 0, Math.PI * 2);
      ctx.fill();
      return;
    case "diamond": {
      // Losange lumineux générique, au-dessus d'une personne.
      const g = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
      g.addColorStop(0, "rgba(120,255,140,.55)");
      g.addColorStop(1, "rgba(120,255,140,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      const pts = [
        [0, -r * 0.9],
        [r * 0.42, 0],
        [0, r * 0.9],
        [-r * 0.42, 0],
      ];
      ctx.fillStyle = c === "#F5C542" ? "#3DDC5A" : c;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.45)";
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.9);
      ctx.lineTo(-r * 0.42, 0);
      ctx.lineTo(0, -r * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,.18)";
      ctx.beginPath();
      ctx.moveTo(0, r * 0.9);
      ctx.lineTo(r * 0.42, 0);
      ctx.lineTo(0, r * 0.1);
      ctx.closePath();
      ctx.fill();
      return;
    }
    case "sun":
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = c;
      ctx.lineWidth = r * 0.1;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
        ctx.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92);
        ctx.stroke();
      }
      return;
    case "cloud":
      ctx.fillStyle = c === "#F5C542" ? "#FFFFFF" : c;
      ctx.beginPath();
      ctx.arc(-r * 0.4, r * 0.1, r * 0.35, 0, Math.PI * 2);
      ctx.arc(0, -r * 0.12, r * 0.45, 0, Math.PI * 2);
      ctx.arc(r * 0.45, r * 0.12, r * 0.33, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-r * 0.4, r * 0.1, r * 0.85, r * 0.35);
      return;
    case "moon":
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.8, 0.6, Math.PI * 2 - 0.6, false);
      ctx.arc(r * 0.35, -r * 0.1, r * 0.62, Math.PI * 2 - 0.9, 0.9, true);
      ctx.fill();
      return;
    case "check":
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = r * 0.16;
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, 0);
      ctx.lineTo(-r * 0.1, r * 0.3);
      ctx.lineTo(r * 0.45, -r * 0.35);
      ctx.stroke();
      return;
    default: {
      const e = l.emoji || l.glyph;
      if (!e) return;
      ctx.font = `${Math.round(r * 1.5)}px ${EMOJI}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = c;
      ctx.fillText(e, 0, r * 0.08);
    }
  }
}
function drawArrow(ctx, l) {
  const { w, h } = l;
  const s = l.flip ? -1 : 1;
  const x1 = (-w / 2) * s,
    y1 = h / 2,
    x2 = (w / 2) * s,
    y2 = -h / 2;
  const mx = (x1 + x2) / 2 - (y2 - y1) * l.curve * 0.5 * s,
    my = (y1 + y2) / 2 + (x2 - x1) * l.curve * 0.5 * s;
  ctx.strokeStyle = l.color;
  ctx.lineWidth = l.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(mx, my, x2, y2);
  ctx.stroke();
  if (l.head) {
    const a = Math.atan2(y2 - my, x2 - mx);
    const hs = Math.max(14, l.width * 4);
    ctx.beginPath();
    ctx.moveTo(x2 - hs * Math.cos(a - 0.5), y2 - hs * Math.sin(a - 0.5));
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2 - hs * Math.cos(a + 0.5), y2 - hs * Math.sin(a + 0.5));
    ctx.stroke();
  }
}
function textAt(ctx, text, x, y, f, size, color, align = "left", maxW = 2000) {
  if (!text) return;
  const s = fitLine(ctx, text, f, size, maxW);
  ctx.font = css(f, s);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
}
function multiline(ctx, text, x, y, w, h, f, size, color, align = "left", lh = 1.3) {
  const fit = fitText(text, { maxWidth: w, maxHeight: h, maxSize: size, minSize: 12, lineHeight: lh }, (s) => {
    ctx.font = css(f, s);
    return (t) => ctx.measureText(t).width;
  });
  ctx.font = css(f, fit.size);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  let yy = y + fit.size * 0.9;
  for (const line of fit.lines) {
    ctx.fillText(line, align === "center" ? x + w / 2 : align === "right" ? x + w : x, yy);
    yy += fit.size * lh;
  }
  return fit.lines.length * fit.size * lh;
}
function badge(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  star(ctx, r, 10, 0.84);
  ctx.fill();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = r * 0.22;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-r * 0.38, 0);
  ctx.lineTo(-r * 0.08, r * 0.3);
  ctx.lineTo(r * 0.42, -r * 0.3);
  ctx.stroke();
  ctx.restore();
}
function avatar(ctx, cx, cy, r, name, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = css(FONT_MAP.poppins, r);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((String(name || "?").trim()[0] || "?").toUpperCase(), cx, cy + r * 0.05);
}
/** Faux éléments d'interface de téléphone (génériques, aucune marque). */
function drawUi(ctx, l) {
  const { w, h } = l;
  const x = -w / 2,
    y = -h / 2;
  const body = FONT_MAP.body,
    bold = FONT_MAP.poppins;
  const dark = l.dark;
  const ink = dark ? "#FFFFFF" : "#1A1A1A",
    sub = dark ? "rgba(255,255,255,.7)" : "#8A8A8E",
    card = dark ? "rgba(28,28,30,.92)" : "rgba(255,255,255,.97)";
  const shadow = () => {
    ctx.shadowColor = "rgba(0,0,0,.18)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
  };
  const noShadow = () => (ctx.shadowColor = "transparent");
  switch (l.variant) {
    case "selectbar": {
      const items = l.items.length ? l.items : ["Copier", "Tout sélectionner", "Partager"];
      ctx.save();
      shadow();
      ctx.fillStyle = "rgba(40,40,42,.94)";
      rr(ctx, x, y, w, h, h * 0.28);
      ctx.fill();
      noShadow();
      const seg = w / (items.length + 0.35);
      const s = Math.min(h * 0.42, 40);
      items.forEach((it, i) => {
        textAt(ctx, it, x + seg * (i + 0.5), y + h * 0.62, body, s, "#FFFFFF", "center", seg - 16);
        if (i) {
          ctx.fillStyle = "rgba(255,255,255,.25)";
          ctx.fillRect(x + seg * i, y + h * 0.22, 2, h * 0.56);
        }
      });
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      const ax = x + w - seg * 0.18;
      ctx.moveTo(ax - h * 0.08, y + h * 0.36);
      ctx.lineTo(ax + h * 0.06, y + h * 0.5);
      ctx.lineTo(ax - h * 0.08, y + h * 0.64);
      ctx.fill();
      ctx.restore();
      return;
    }
    case "sharesheet": {
      ctx.save();
      shadow();
      ctx.fillStyle = card;
      rr(ctx, x, y, w, h, Math.min(w, h) * 0.08);
      ctx.fill();
      noShadow();
      textAt(ctx, l.title || "Partage", 0, y + h * 0.2, bold, h * 0.12, ink, "center", w - 40);
      multiline(ctx, l.text, x + w * 0.1, y + h * 0.27, w * 0.8, h * 0.3, body, h * 0.075, sub, "center", 1.25);
      const items = l.items.length >= 2 ? l.items : ["Ignorer", "Accepter"];
      ctx.fillStyle = dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.1)";
      ctx.fillRect(x, y + h * 0.66, w, 2);
      ctx.fillRect(-1, y + h * 0.66, 2, h * 0.34);
      textAt(ctx, items[0], -w / 4, y + h * 0.87, body, h * 0.1, l.accent, "center", w / 2 - 20);
      textAt(ctx, items[1], w / 4, y + h * 0.87, bold, h * 0.1, l.accent, "center", w / 2 - 20);
      ctx.restore();
      return;
    }
    case "notif": {
      ctx.save();
      shadow();
      ctx.fillStyle = dark ? "rgba(40,40,44,.9)" : "rgba(245,245,247,.95)";
      rr(ctx, x, y, w, h, h * 0.24);
      ctx.fill();
      noShadow();
      const r = h * 0.26;
      const g = ctx.createLinearGradient(x + h * 0.2, y + h * 0.2, x + h * 0.2 + r * 2, y + h * 0.2 + r * 2);
      g.addColorStop(0, l.accent);
      g.addColorStop(1, "#F2A0C4");
      ctx.fillStyle = g;
      rr(ctx, x + h * 0.18, y + h / 2 - r, r * 2, r * 2, r * 0.5);
      ctx.fill();
      const tx = x + h * 0.18 + r * 2 + h * 0.16;
      textAt(ctx, l.name || l.title, tx, y + h * 0.4, bold, h * 0.17, ink, "left", w * 0.55);
      textAt(ctx, l.handle || "maintenant", x + w - h * 0.2, y + h * 0.4, body, h * 0.13, sub, "right", w * 0.25);
      multiline(ctx, l.text, tx, y + h * 0.48, w - (tx - x) - h * 0.2, h * 0.42, body, h * 0.14, ink, "left", 1.2);
      ctx.restore();
      return;
    }
    case "profile": {
      const r = Math.min(h * 0.42, w * 0.08);
      avatar(ctx, x + r, 0, r, l.name, l.accent);
      const tx = x + r * 2 + r * 0.45;
      textAt(ctx, l.name || "Votre nom", tx, -r * 0.05, bold, r * 0.72, ink, "left", w * 0.55);
      ctx.font = css(bold, fitLine(ctx, l.name || "Votre nom", bold, r * 0.72, w * 0.55));
      const nameW = ctx.measureText(l.name || "Votre nom").width;
      badge(ctx, tx + nameW + r * 0.45, -r * 0.3, r * 0.3, l.accent);
      textAt(ctx, l.handle ? (l.handle.startsWith("@") ? l.handle : "@" + l.handle) : "@pseudo", tx, r * 0.72, body, r * 0.55, sub, "left", w * 0.55);
      if (l.items[0]) {
        const bw = Math.min(w * 0.28, r * 4.4),
          bh = r * 1.1;
        ctx.fillStyle = l.accent;
        rr(ctx, x + w - bw, -bh / 2, bw, bh, bh * 0.3);
        ctx.fill();
        textAt(ctx, l.items[0], x + w - bw / 2, bh * 0.2, bold, bh * 0.45, "#FFFFFF", "center", bw - 12);
      }
      return;
    }
    case "comment": {
      ctx.save();
      shadow();
      ctx.fillStyle = card;
      rr(ctx, x, y, w, h, Math.min(h * 0.3, 44));
      ctx.fill();
      noShadow();
      const r = Math.min(h * 0.22, 36);
      avatar(ctx, x + r * 1.4, y + h / 2, r, l.name, l.accent);
      const tx = x + r * 2.8;
      textAt(ctx, l.name || "pseudo", tx, y + h * 0.36, bold, h * 0.18, ink, "left", w * 0.6);
      multiline(ctx, l.text, tx, y + h * 0.42, w - (tx - x) - r * 2, h * 0.5, body, h * 0.17, ink, "left", 1.2);
      ctx.translate(x + w - r * 1.1, y + h / 2);
      ctx.strokeStyle = sub;
      ctx.lineWidth = 3;
      heart(ctx, r * 0.45);
      ctx.stroke();
      ctx.restore();
      return;
    }
    case "follow": {
      ctx.fillStyle = l.accent;
      rr(ctx, x, y, w, h, h * 0.28);
      ctx.fill();
      textAt(ctx, l.title || "Suivre", 0, h * 0.18, bold, h * 0.46, "#FFFFFF", "center", w - 16);
      return;
    }
    case "notes": {
      ctx.save();
      shadow();
      ctx.fillStyle = "#FFFFFF";
      rr(ctx, x, y, w, h, 36);
      ctx.fill();
      noShadow();
      textAt(ctx, l.title || "Nouveau", x + 52, y + 110, bold, 64, "#1A1A1A", "left", w - 100);
      textAt(ctx, l.handle || "", x + w - 52, y + 72, body, 28, "#A0A0A5", "right", w * 0.5);
      if (l.text) multiline(ctx, l.text, x + 52, y + 150, w - 104, h * 0.25, body, 40, "#3A3A3C", "left", 1.35);
      ctx.fillStyle = "#E9E9EB";
      rr(ctx, x + 40, y + h - 110, w - 80, 72, 36);
      ctx.fill();
      ctx.restore();
      return;
    }
    case "folder": {
      const fx = x,
        fy = y + h * 0.12,
        fw = w,
        fh = h * 0.78;
      ctx.save();
      shadow();
      ctx.fillStyle = "#5CB8F5";
      rr(ctx, fx, fy - h * 0.1, fw * 0.42, h * 0.2, h * 0.06);
      ctx.fill();
      ctx.fillStyle = "#78C8FA";
      rr(ctx, fx, fy, fw, fh, h * 0.08);
      ctx.fill();
      noShadow();
      ctx.fillStyle = "rgba(255,255,255,.25)";
      rr(ctx, fx, fy, fw, fh * 0.28, h * 0.08);
      ctx.fill();
      ctx.restore();
      if (l.title) textAt(ctx, l.title, 0, y + h + Math.min(48, h * 0.18), body, Math.min(40, h * 0.16), dark ? "#1A1A1A" : "#FFFFFF", "center", w + 60);
      return;
    }
    case "album": {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,.55)");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      textAt(ctx, l.title || "ces derniers temps", x + 44, y + h - 92, bold, Math.min(86, h * 0.3), "#FFFFFF", "left", w - 88);
      textAt(ctx, "▢ " + (l.text || "26 éléments"), x + 46, y + h - 40, body, Math.min(34, h * 0.12), "rgba(255,255,255,.85)", "left", w - 88);
      return;
    }
    case "checklist": {
      ctx.save();
      shadow();
      ctx.fillStyle = card;
      rr(ctx, x, y, w, h, 34);
      ctx.fill();
      noShadow();
      textAt(ctx, l.title, x + 48, y + 92, bold, 52, ink, "left", w - 96);
      const items = l.items.filter(Boolean);
      const top = y + 140,
        step = Math.min(110, (h - 170) / Math.max(1, items.length));
      items.forEach((it, i) => {
        const cy = top + step * i + step / 2;
        ctx.strokeStyle = l.accent;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x + 70, cy, Math.min(20, step * 0.25), 0, Math.PI * 2);
        ctx.stroke();
        textAt(ctx, it, x + 110, cy + 13, body, Math.min(38, step * 0.42), ink, "left", w - 150);
      });
      ctx.restore();
      return;
    }
    case "readcaption": {
      ctx.strokeStyle = dark ? "#1A1A1A" : "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.save();
      ctx.font = css(body, h * 0.42);
      ctx.letterSpacing = h * 0.12 + "px";
      ctx.fillStyle = dark ? "#1A1A1A" : "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((l.title || "LIRE LA LÉGENDE").toUpperCase(), 0, h * 0.05);
      ctx.restore();
      return;
    }
  }
}
function drawCircleText(ctx, l) {
  const f = layerFont(l.font);
  const text = String(l.text || "");
  if (!text) return;
  const r = Math.min(l.w, l.h) / 2 - l.size * 0.6;
  ctx.font = css(f, l.size);
  ctx.fillStyle = l.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const total = ctx.measureText(text).width;
  const span = Math.min(Math.PI * 1.95, total / Math.max(10, r));
  let a = (l.start * Math.PI) / 180 - span / 2;
  for (const ch of text) {
    const cw = ctx.measureText(ch).width;
    const da = (cw / total) * span;
    ctx.save();
    ctx.rotate(a + da / 2);
    ctx.translate(0, -r);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += da;
  }
}
function drawShape(ctx, l) {
  const { w, h } = l;
  ctx.globalAlpha *= l.alpha ?? 1;
  ctx.beginPath();
  if (l.shape === "circle") ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (l.shape === "line") {
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(w / 2, 0);
    ctx.strokeStyle = l.stroke || l.color || "#1A1A1A";
    ctx.lineWidth = l.strokeWidth || Math.max(2, h);
    ctx.stroke();
    return;
  } else if (l.shape === "dots") {
    ctx.fillStyle = l.color || l.stroke || "#1A1A1A";
    const step = Math.max(10, h * 2.4);
    for (let x = -w / 2 + h / 2; x <= w / 2; x += step) {
      ctx.beginPath();
      ctx.arc(x, 0, h / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  } else rr(ctx, -w / 2, -h / 2, w, h, l.radius);
  if (l.color) {
    ctx.fillStyle = l.color;
    ctx.fill();
  }
  if (l.stroke && l.strokeWidth) {
    ctx.strokeStyle = l.stroke;
    ctx.lineWidth = l.strokeWidth;
    ctx.stroke();
  }
}
function drawDoodle(ctx, l) {
  const { w, h } = l;
  const rnd = seeded(hash(l.id));
  ctx.strokeStyle = l.color;
  ctx.fillStyle = l.color;
  ctx.lineWidth = l.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  switch (l.variant) {
    case "squiggle": {
      const n = Math.max(3, Math.round(w / 70));
      ctx.moveTo(-w / 2, 0);
      for (let i = 0; i < n; i++) {
        const x0 = -w / 2 + (w / n) * i;
        ctx.quadraticCurveTo(x0 + w / n / 2, (i % 2 ? 1 : -1) * h * 0.4, x0 + w / n, 0);
      }
      ctx.stroke();
      return;
    }
    case "underline":
      ctx.moveTo(-w / 2, h * 0.1);
      ctx.quadraticCurveTo(0, -h * 0.35, w / 2, h * 0.05);
      ctx.moveTo(-w * 0.42, h * 0.38);
      ctx.quadraticCurveTo(0, h * 0.05, w * 0.4, h * 0.32);
      ctx.stroke();
      return;
    case "scribble": {
      const n = Math.max(4, Math.round(w / 40));
      ctx.moveTo(-w / 2, h * 0.3);
      for (let i = 1; i <= n; i++) ctx.lineTo(-w / 2 + (w / n) * i, (i % 2 ? -1 : 1) * h * (0.25 + rnd() * 0.15));
      ctx.stroke();
      return;
    }
    case "circle":
      ctx.ellipse(0, 0, w / 2, h / 2, -0.05, 0.3, Math.PI * 2.15);
      ctx.stroke();
      return;
    case "stars":
      for (const [dx, dy, s] of [
        [-0.3, 0.1, 0.42],
        [0.05, -0.2, 0.28],
        [0.32, 0.18, 0.34],
      ]) {
        ctx.save();
        ctx.translate(dx * w, dy * h);
        star(ctx, Math.min(w, h) * s * 0.6, 4, 0.25);
        ctx.fill();
        ctx.restore();
      }
  }
}
function drawPhotoLayer(ctx, l, img, opt) {
  const { w, h } = l;
  const b = l.border || 0,
    bottom = l.bottom || 0;
  const x = -w / 2,
    y = -h / 2;
  ctx.save();
  if (l.shadow) {
    ctx.shadowColor = "rgba(0,0,0,.28)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
  }
  if (l.circle) {
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = b ? l.borderColor || "#FFFFFF" : "#DDD";
    ctx.fill();
  } else if (b || bottom) {
    ctx.fillStyle = l.borderColor || "#FFFFFF";
    rr(ctx, x, y, w, h, l.radius ? l.radius + b : 0);
    ctx.fill();
  } else if (l.shadow) {
    ctx.fillStyle = "#000";
    rr(ctx, x, y, w, h, l.radius);
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  const ix = x + b,
    iy = y + b,
    iw = w - 2 * b,
    ih = h - 2 * b - bottom;
  if (l.circle) {
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2 - b, h / 2 - b, 0, 0, Math.PI * 2);
  } else rr(ctx, ix, iy, iw, ih, l.radius);
  ctx.clip();
  drawImageCover(ctx, img, ix, iy, iw, ih, l.crop, hash(l.id), opt.showEmpty);
  ctx.restore();
  if (l.label) {
    const f = FONT_MAP.body;
    const s = Math.min(46, Math.max(22, w * 0.11));
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = 10;
    textAt(ctx, l.label, 0, y + h + s * 1.25, f, s, l.labelColor || "#FFFFFF", "center", w * 1.4);
    ctx.restore();
  }
}

/**
 * Dessine un visuel à calques. `opt` : { photos: Map|objet id → image, scale (défaut 1), showEmpty, makeCanvas, skip (id du calque à ne pas dessiner) }.
 * Le canvas doit faire layerCanvasSize(d) × scale.
 */
export function drawLayered(ctx, d, opt = {}) {
  const [W, H] = layerCanvasSize(d);
  const s = opt.scale || 1;
  const get = (id) => (!id ? null : opt.photos instanceof Map ? opt.photos.get(id) || null : opt.photos?.[id] || null);
  ctx.save();
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.fillStyle = d.bg?.color || "#F6F1E9";
  ctx.fillRect(0, 0, W, H);
  if (d.bg?.photo) {
    const img = get(d.bg.photo);
    if (img) blurredCover(ctx, img, W, H, d.bg.crop, d.bg.blur, opt.makeCanvas);
    else drawImageCover(ctx, null, 0, 0, W, H, {}, 1, opt.showEmpty);
    if (d.bg.dim) {
      ctx.fillStyle = `rgba(0,0,0,${d.bg.dim})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
  for (const l of d.layers || []) {
    if (l.hidden || l.id === opt.skip) continue;
    ctx.save();
    ctx.translate(l.x, l.y);
    if (l.rot) ctx.rotate((l.rot * Math.PI) / 180);
    ctx.globalAlpha = l.opacity ?? 1;
    try {
      switch (l.type) {
        case "photo":
          drawPhotoLayer(ctx, l, get(l.file), opt);
          break;
        case "text":
          drawText(ctx, l);
          break;
        case "bubble":
          drawBubble(ctx, l);
          break;
        case "label":
          drawLabel(ctx, l);
          break;
        case "sticker":
          drawStickerGlyph(ctx, l);
          break;
        case "arrow":
          drawArrow(ctx, l);
          break;
        case "ui":
          drawUi(ctx, l);
          break;
        case "circletext":
          drawCircleText(ctx, l);
          break;
        case "shape":
          drawShape(ctx, l);
          break;
        case "doodle":
          drawDoodle(ctx, l);
          break;
      }
    } finally {
      ctx.restore();
    }
  }
  ctx.restore();
}
/** Découpe le grand canvas en diapos numérotées (1080 de large chacune), sans décalage au raccord. */
export function sliceLayered(source, d, makeCanvas) {
  const [, H] = layerCanvasSize(d);
  return Array.from({ length: d.slides }, (_, i) => {
    const c = makeCanvas(SLIDE_W, H);
    c.getContext("2d").drawImage(source, i * SLIDE_W, 0, SLIDE_W, H, 0, 0, SLIDE_W, H);
    return c;
  });
}
