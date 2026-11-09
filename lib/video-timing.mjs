// Calage des mots, coupe des silences et image des sous-titres à un instant donné.
// La même fonction subtitleFrame() sert à l'aperçu en direct ET à la génération des sous-titres ASS du rendu :
// ce que le client voit dans l'aperçu est ce qu'il obtient dans la vidéo finale.
import { wordLook, hookWords } from "./video-style.mjs";

const r3 = (n) => Math.round(n * 1000) / 1000;
const cleanWord = (w) =>
  String(w ?? "")
    .replace(/[\u0000-\u001f\u007f{}\\<>]/g, "")
    .trim()
    .slice(0, 40);

/** Valide une liste de mots [{w, s, e}] (secondes). */
export function sanitizeWords(list, max = 1500) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const x of list.slice(0, max)) {
    const w = cleanWord(x?.w);
    const s = Number(x?.s),
      e = Number(x?.e);
    if (!w || !Number.isFinite(s) || !Number.isFinite(e) || s < 0 || e > 3600) continue;
    out.push({ w, s: r3(s), e: r3(Math.max(e, s + 0.05)) });
  }
  return out.sort((a, b) => a.s - b.s);
}
/** Réponse « verbose_json » de la transcription → mots. */
export function wordsFromTranscript(json) {
  const words = Array.isArray(json?.words) ? json.words : [];
  return sanitizeWords(words.map((x) => ({ w: x.word, s: x.start, e: x.end })));
}
/** Sans transcription : mots répartis selon leur longueur sur la durée (calage approximatif). */
export function proportionalWords(text, duration, start = 0) {
  const list = String(text ?? "")
    .replace(/[\u0000-\u001f\u007f{}\\<>]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 1500);
  if (!list.length || !(duration > 0)) return [];
  const total = list.reduce((n, w) => n + w.length + 2, 0);
  let t = start;
  return list.map((w) => {
    const d = (duration * (w.length + 2)) / total;
    const item = { w: cleanWord(w), s: r3(t), e: r3(t + d * 0.92) };
    t += d;
    return item;
  });
}

/** Silences détectés (FFmpeg silencedetect) → passages à garder, avec une petite marge autour de la voix. */
export function silencesToKeeps(silences, total, { pad = 0.12, minKeep = 0.25 } = {}) {
  const cuts = (Array.isArray(silences) ? silences : [])
    .map((x) => [Math.max(0, Number(x[0])), Math.min(total, Number(x[1]))])
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b - a > pad * 2)
    .sort((x, y) => x[0] - y[0]);
  const keeps = [];
  let t = 0;
  for (const [a, b] of cuts) {
    const end = a + pad;
    if (end - t >= minKeep) keeps.push([r3(t), r3(end)]);
    t = Math.max(t, b - pad);
  }
  if (total - t >= minKeep) keeps.push([r3(t), r3(total)]);
  return keeps.length ? keeps : [[0, r3(total)]];
}
/** Analyse les journaux de silencedetect. */
export function parseSilences(log, total) {
  const out = [];
  let start = null;
  for (const line of String(log).split("\n")) {
    const a = line.match(/silence_start:\s*(-?[\d.]+)/);
    const b = line.match(/silence_end:\s*([\d.]+)/);
    if (a) start = Math.max(0, Number(a[1]));
    if (b && start !== null) {
      out.push([start, Number(b[1])]);
      start = null;
    }
  }
  if (start !== null && total) out.push([start, total]);
  return out;
}
/** Ne garde que les silences situés dans des rushes qui ont du son : un plan muet (B-roll) n'est jamais coupé. */
export function speechSilences(silences, clips) {
  const ranges = [];
  let t = 0;
  for (const c of clips) {
    if (c.audio) ranges.push([t, t + c.duration]);
    t += c.duration;
  }
  const out = [];
  for (const [a, b] of silences || [])
    for (const [x, y] of ranges) {
      const s = Math.max(a, x),
        e = Math.min(b, y);
      if (e - s > 0.05) out.push([r3(s), r3(e)]);
    }
  return out;
}
export const keptDuration = (keeps) => r3(keeps.reduce((n, [a, b]) => n + (b - a), 0));
/** Raccourcit la liste des passages pour tenir dans la durée cible. */
export function trimKeeps(keeps, target) {
  if (!target) return keeps;
  const out = [];
  let left = target;
  for (const [a, b] of keeps) {
    if (left <= 0.05) break;
    const d = Math.min(b - a, left);
    out.push([a, r3(a + d)]);
    left -= d;
  }
  return out;
}
/** Recale les mots (temps de la vidéo d'origine) sur la vidéo coupée. Les mots coupés disparaissent. */
export function remapWords(words, keeps) {
  const out = [];
  let offset = 0;
  for (const [a, b] of keeps) {
    for (const w of words) {
      const mid = (w.s + w.e) / 2;
      if (mid >= a && mid < b) out.push({ ...w, s: r3(offset + Math.max(0, w.s - a)), e: r3(offset + Math.min(b, w.e) - a) });
    }
    offset += b - a;
  }
  return out;
}
/** Convertit un temps de la vidéo coupée en temps de la vidéo d'origine. */
export function sourceTime(keeps, t) {
  let offset = 0;
  for (const [a, b] of keeps) {
    if (t < offset + (b - a)) return a + (t - offset);
    offset += b - a;
  }
  const last = keeps[keeps.length - 1];
  return last ? last[1] : t;
}

/** Regroupe les mots en lignes courtes, coupées aux pauses et à la ponctuation. */
export function subtitleGroups(words, style) {
  const max = style.animation === "stack" ? 30 : style.animation === "word" || style.animation === "typewriter" ? 18 : 24;
  const groups = [];
  let cur = [];
  const flush = () => {
    if (cur.length) groups.push(cur);
    cur = [];
  };
  words.forEach((w, i) => {
    const prev = words[i - 1];
    const len = cur.reduce((n, x) => n + words[x].w.length + 1, 0);
    if (cur.length && (len + w.w.length > max || (prev && w.s - prev.e > 0.7) || cur.length >= 6)) flush();
    cur.push(i);
    if (/[.!?…]$/.test(w.w)) flush();
  });
  flush();
  return groups.map((idx) => {
    const s = words[idx[0]].s,
      e = words[idx[idx.length - 1]].e;
    return { idx, s, e };
  });
}

/**
 * Ce qu'affiche la vidéo à l'instant t (secondes) : sous-titre en cours avec l'état de chaque mot,
 * hook des premières secondes et carton de fin. Résultat identique pour l'aperçu et le rendu.
 */
export function subtitleFrame(words, style, t, { duration = 0, groups = null } = {}) {
  const gs = groups || subtitleGroups(words, style);
  const hookOn = !!style.hook?.text && t < 3;
  const outroOn = !!style.outro?.text && duration > 6 && t >= duration - 2.5;
  let gi = -1;
  for (let i = 0; i < gs.length; i++) {
    const g = gs[i],
      next = gs[i + 1];
    const end = next ? Math.min(next.s, g.e + 0.6) : g.e + 0.8;
    if (t >= g.s && t < end) {
      gi = i;
      break;
    }
  }
  const frame = {
    group: gi,
    words: [],
    opacity: 1,
    hook: hookOn ? { text: style.hook.text, font: style.hook.font, words: hookWords(style.hook) } : null,
    outro: outroOn ? { text: style.outro.text } : null,
    // Gros titres et stickers actifs à cet instant (même liste pour l'aperçu et le rendu).
    titles: (style.titles || []).filter((x) => t >= x.s && t < x.e),
    stickers: (style.stickers || []).map((x, k) => ({ ...x, k })).filter((x) => t >= x.s && t < x.e),
  };
  if (gi < 0 || outroOn) {
    frame.group = -1;
    return frame;
  }
  const g = gs[gi];
  const a = style.animation;
  if (a === "fade") {
    const fin = Math.min(1, (t - g.s) / 0.15);
    frame.opacity = Math.round(fin * 100) / 100;
  }
  frame.words = g.idx.map((i) => {
    const w = words[i],
      look = wordLook(style, w.oi ?? i),
      spoken = t >= w.s,
      active = t >= w.s && t < w.e + 0.05;
    let visible = true,
      chars = null,
      color = look.color;
    if (a === "word" || a === "stack") visible = spoken;
    if (a === "typewriter") {
      visible = spoken;
      if (spoken && t < w.e) chars = Math.max(1, Math.ceil(((t - w.s) / Math.max(0.05, w.e - w.s)) * w.w.length));
    }
    if (a === "highlight" && active && look.color === style.color) color = style.highlight;
    if (a === "karaoke" && spoken && look.color === style.color) color = style.highlight;
    if ((a === "word" || a === "stack") && active && look.color === style.color && style.highlight !== style.color) color = style.highlight;
    const text = style.uppercase ? w.w.toUpperCase() : w.w;
    return { i, text: chars ? text.slice(0, chars) : text, color, font: look.font, script: look.script, visible, active };
  });
  return frame;
}

/** Instants où l'image des sous-titres change (pour découper le fichier ASS au plus juste). */
export function changePoints(words, style, duration) {
  const pts = new Set([0, r3(duration)]);
  const gs = subtitleGroups(words, style);
  gs.forEach((g, i) => {
    const next = gs[i + 1];
    pts.add(r3(g.s));
    pts.add(r3(next ? Math.min(next.s, g.e + 0.6) : g.e + 0.8));
    for (const k of g.idx) {
      const w = words[k];
      pts.add(r3(w.s));
      pts.add(r3(w.e + 0.05));
      if (style.animation === "typewriter")
        for (let c = 1; c < Math.min(w.w.length, 24); c++) pts.add(r3(w.s + ((w.e - w.s) * c) / w.w.length));
    }
  });
  if (style.hook?.text) pts.add(3);
  for (const x of style.titles || []) {
    pts.add(r3(x.s));
    pts.add(r3(x.e));
  }
  if (style.outro?.text && duration > 6) pts.add(r3(duration - 2.5));
  return [...pts].filter((x) => x >= 0 && x <= duration).sort((a, b) => a - b);
}

/**
 * Plan de rendu : les passages gardés (temps de la vidéo d'origine, rushes mis bout à bout) deviennent
 * des morceaux de rushes, avec un léger zoom sur les moments forts et des coupes rapides si demandé.
 */
export function buildPlan(keeps, clipDurations, clipAudio, style, words = []) {
  const offsets = [];
  let acc = 0;
  for (const d of clipDurations) {
    offsets.push(acc);
    acc += d;
  }
  const pieces = [];
  for (const [a, b] of keeps)
    clipDurations.forEach((d, i) => {
      const s = Math.max(a, offsets[i]),
        e = Math.min(b, offsets[i] + d);
      if (e - s > 0.08) pieces.push({ input: i, start: r3(s - offsets[i]), duration: r3(e - s), audio: !!clipAudio[i], from: s });
    });
  const out = [];
  for (const p of pieces) {
    if (style.rhythm?.jumpCuts && p.duration > 2.6) {
      let t = 0,
        k = 0;
      while (p.duration - t > 0.08) {
        const d = Math.min(2.2, p.duration - t);
        out.push({ ...p, start: r3(p.start + t), duration: r3(d), from: p.from + t, zoom: k % 2 ? 1.08 : 1 });
        t += d;
        k++;
      }
    } else out.push({ ...p, zoom: 1 });
  }
  if (style.rhythm?.zooms) {
    const strong = words.filter((w, i) => ["yellow", "pink"].includes(style.wordStyles?.[w.oi ?? i]));
    out.forEach((p, i) => {
      const hasStrong = strong.some((w) => w.s >= p.from && w.s < p.from + p.duration);
      if (hasStrong || (!strong.length && i % 3 === 2)) p.zoom = 1.15;
    });
  }
  return out.map(({ from, ...p }) => p);
}

/** Corrige le texte d'un mot sans toucher à son calage. */
export function editWordText(words, index, text) {
  const clean = cleanWord(text);
  return words.map((w, i) => (i === index && clean ? { ...w, w: clean } : w));
}
/** Décalage global des sous-titres (secondes, positif = plus tard). */
export function shiftWords(words, shift) {
  if (!shift) return words;
  return words.map((w) => ({ ...w, s: r3(Math.max(0, w.s + shift)), e: r3(Math.max(0.05, w.e + shift)) }));
}
/**
 * « Caler au tap » : taps[k] = instant où le bloc k doit commencer (barre d'espace pendant la lecture).
 * Les mots du bloc sont déplacés ensemble ; si le bloc déborde sur le suivant, ses mots sont resserrés.
 */
export function applyTaps(words, groups, taps) {
  const out = words.map((w) => ({ ...w }));
  const starts = groups.map((g, k) => (Number.isFinite(taps?.[k]) ? Math.max(0, Number(taps[k])) : g.s));
  groups.forEach((g, k) => {
    const start = starts[k],
      next = starts[k + 1],
      span = g.e - g.s;
    const room = next !== undefined ? Math.max(0.1, next - start - 0.02) : Infinity;
    const ratio = span > room ? room / span : 1;
    for (const i of g.idx) {
      const w = words[i];
      out[i].s = r3(start + (w.s - g.s) * ratio);
      out[i].e = r3(Math.max(out[i].s + 0.05, start + (w.e - g.s) * ratio));
    }
  });
  return out;
}
