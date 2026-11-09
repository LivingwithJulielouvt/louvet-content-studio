// « Versions à tester » (créatrices) : une vidéo devient 3, 5 ou 10 versions qui ne diffèrent que sur ce qui compte
// dans un Reel (accroche, sous-titres, musique, durée, premier plan, titre de couverture). Module pur, partagé par
// le navigateur (aperçu, rendu) et le serveur (validation) : les recettes sont calculées de façon déterministe.

export const VERSION_COUNTS = [3, 5, 10];
export const AXES = ["hook", "subs", "music", "duration", "start", "cover"];
export const DEFAULT_AXES = ["hook", "subs", "duration", "start", "cover"];
export const LABELS = "ABCDEFGHIJ".split("");

/** Styles de sous-titres comparés (polices embarquées, voir video-style.mjs). */
export const SUB_PRESETS = {
  classic: { font: "sans", animation: "word", highlight: "#F5D76E", position: "bottom", uppercase: false, outline: true, size: "m" },
  label: { font: "heavy", animation: "label", highlight: "#FFFFFF", position: "middle", uppercase: true, outline: false, size: "l" },
  soft: { font: "serif", animation: "fade", highlight: "#F2B8C6", position: "bottom", uppercase: false, outline: false, size: "m" },
  karaoke: { font: "rounded", animation: "karaoke", highlight: "#F2B8C6", position: "middle", uppercase: false, outline: true, size: "m" },
  typewriter: { font: "mono", animation: "typewriter", highlight: "#F5D76E", position: "bottom", uppercase: false, outline: true, size: "m" },
};
const SUB_KEYS = Object.keys(SUB_PRESETS);
export const DURATIONS = ["full", "short"];
/** Premier plan : début normal, ou aperçu d'un moment fort (au milieu / vers la fin) placé en ouverture. */
export const STARTS = ["start", "teaser-mid", "teaser-end"];
export const COVERS = ["none", "top-heavy", "top-serif"];
export const SHORT_RATIO = 0.7;
export const TEASER_SECONDS = 1.4;

const T = (lang, fr, es, en) => (lang === "es" ? es : lang === "en" ? en : fr);
const clean = (v, n) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f{}\\<>"“”«»]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n);

/** Accroches de secours, sans IA, dans la langue de la créatrice. {s} = le sujet (titre de la vidéo ou premier pilier). */
export const HOOK_BANK = {
  fr: [
    "{s} : personne n’en parle",
    "{s} : 3 erreurs à éviter",
    "Restez jusqu’au bout : {s}",
    "Ce que j’aurais aimé savoir avant : {s}",
    "{s}, en 30 secondes",
    "{s} : mon avis honnête",
    "POV : {s}",
    "On teste ensemble ? {s}",
    "Arrêtez de scroller : {s}",
    "{s} : la vérité",
    "Vous faites sûrement ça autrement",
    "Le détail qui change tout",
  ],
  es: [
    "{s}: nadie habla de esto",
    "{s}: 3 errores que evitar",
    "Quédate hasta el final: {s}",
    "Lo que me hubiera gustado saber antes: {s}",
    "{s}, en 30 segundos",
    "{s}: mi opinión honesta",
    "POV: {s}",
    "¿Lo probamos juntas? {s}",
    "Deja de hacer scroll: {s}",
    "{s}: la verdad",
    "Seguro lo haces de otra forma",
    "El detalle que lo cambia todo",
  ],
  en: [
    "{s}: nobody talks about this",
    "{s}: 3 mistakes to avoid",
    "Stay till the end: {s}",
    "What I wish I knew sooner: {s}",
    "{s}, in 30 seconds",
    "{s}: my honest take",
    "POV: {s}",
    "Let’s try it together? {s}",
    "Stop scrolling: {s}",
    "{s}: the truth",
    "You’re probably doing this differently",
    "The detail that changes everything",
  ],
};

/** Complète une liste d'accroches (IA ou existantes) avec la banque, sans doublon, jusqu'à `count`. */
export function fillHooks(list, count, { lang = "fr", subject = "" } = {}) {
  const s = clean(subject, 40) || T(lang, "ma routine", "mi rutina", "my routine");
  const out = [];
  const seen = new Set();
  const add = (h) => {
    const v = clean(h, 70);
    const k = v.toLowerCase();
    if (v && !seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  };
  for (const h of Array.isArray(list) ? list : []) add(h);
  for (const h of HOOK_BANK[lang] || HOOK_BANK.fr) {
    if (out.length >= count) break;
    const v = h.replace("{s}", s);
    add(v.charAt(0).toUpperCase() + v.slice(1));
  }
  return out.slice(0, count);
}

/** Nombre d'options de chaque axe pour cette série. */
/** @param {{ hooks?: string[], music?: string[] }} [ctx] */
export function axisSizes({ hooks = [], music = [] } = {}) {
  return {
    hook: hooks.length,
    subs: SUB_KEYS.length,
    music: music.length ? music.length + 1 : 0, // + « voix seule »
    duration: DURATIONS.length,
    start: STARTS.length,
    cover: COVERS.length,
  };
}
export function sanitizeAxes(list, ctx = {}) {
  const sizes = axisSizes(ctx);
  return AXES.filter((a) => (Array.isArray(list) ? list : []).includes(a) && sizes[a] > 1);
}
/** Combien de versions vraiment différentes ces axes permettent. */
export function maxVersions(axes, ctx = {}) {
  const sizes = axisSizes(ctx);
  return sanitizeAxes(axes, ctx).reduce((n, a) => n * sizes[a], 1);
}

function optionValue(axis, i, { hooks = [], music = [] }) {
  if (axis === "hook") return hooks[i] ?? hooks[0] ?? "";
  if (axis === "subs") return SUB_KEYS[i];
  if (axis === "music") return i === 0 ? null : music[i - 1];
  if (axis === "duration") return DURATIONS[i];
  if (axis === "start") return STARTS[i];
  return COVERS[i];
}
const baseRecipe = (ctx) => ({
  hook: ctx.hooks?.[0] ?? "",
  subs: "classic",
  music: ctx.music?.length ? ctx.music[0] : null,
  duration: "full",
  start: "start",
  cover: "none",
});

/**
 * Recettes déterministes. La version A garde les réglages de base ; les suivantes changent les axes choisis
 * selon un carré latin (chaque axe tourne à son propre rythme), en écartant les doublons.
 * `seed` (une recette gagnante) : version A = la gagnante, puis un seul réglage change à chaque version.
 */
export function buildRecipes(count, axesIn, ctx = {}, seed = null) {
  const axes = sanitizeAxes(axesIn, ctx);
  const sizes = axisSizes(ctx);
  const n = Math.max(1, Math.min(Number(count) || 0, 10, Math.max(1, maxVersions(axes, ctx))));
  const key = (r) => JSON.stringify(AXES.map((a) => r[a]));
  const out = [];
  const seen = new Set();
  const push = (r) => {
    if (out.length < n && !seen.has(key(r))) {
      seen.add(key(r));
      out.push(r);
    }
  };
  if (seed) {
    const start = { ...baseRecipe(ctx), ...pickRecipe(seed, ctx) };
    push(start);
    // Un axe à la fois autour de la gagnante : on sait ce qui fait la différence.
    // L'accroche gagnante reste ; les autres réglages sont testés un par un.
    const vary = axes.filter((a) => a !== "hook").length ? axes.filter((a) => a !== "hook") : axes;
    for (let round = 1; out.length < n && round < 10; round++)
      for (const a of vary) {
        const cur = optionIndex(a, start[a], ctx);
        const v = optionValue(a, (cur + round) % sizes[a], ctx);
        push({ ...start, [a]: v });
      }
    return out.map((r, i) => ({ label: LABELS[i], ...r }));
  }
  push(baseRecipe(ctx));
  for (let i = 1; out.length < n && i < 400; i++) {
    const r = baseRecipe(ctx);
    axes.forEach((a, k) => {
      const m = sizes[a];
      // Carré latin : l'accroche change à chaque version, les autres axes tournent avec un décalage propre.
      const idx = a === "hook" ? i % m : (i + Math.floor(i / m) * (k + 1)) % m;
      r[a] = optionValue(a, idx, ctx);
    });
    push(r);
  }
  return out.map((r, i) => ({ label: LABELS[i], ...r }));
}
function optionIndex(axis, value, ctx) {
  const sizes = axisSizes(ctx);
  for (let i = 0; i < sizes[axis]; i++) if (optionValue(axis, i, ctx) === value) return i;
  return 0;
}
/** Ne garde d'une recette que des valeurs autorisées dans ce contexte. */
export function pickRecipe(r = {}, ctx = {}) {
  const out = {};
  const hook = clean(r.hook, 70);
  out.hook = hook || ctx.hooks?.[0] || "";
  out.subs = SUB_KEYS.includes(r.subs) ? r.subs : "classic";
  out.music = r.music && (ctx.music || []).includes(r.music) ? r.music : null;
  out.duration = DURATIONS.includes(r.duration) ? r.duration : "full";
  out.start = STARTS.includes(r.start) ? r.start : "start";
  out.cover = COVERS.includes(r.cover) ? r.cover : "none";
  return out;
}

/** Description courte d'une version : « Accroche « … » · sous-titres jaunes · version courte ». */
/** @param {any} r @param {string} [lang] @param {{ music?: string[], hooks?: string[] }} [opts] */
export function describeRecipe(r, lang = "fr", { music = [] } = {}) {
  const subs = {
    classic: T(lang, "sous-titres jaunes", "subtítulos amarillos", "yellow subtitles"),
    label: T(lang, "sous-titres en étiquette", "subtítulos en etiqueta", "label subtitles"),
    soft: T(lang, "sous-titres élégants", "subtítulos elegantes", "elegant subtitles"),
    karaoke: T(lang, "karaoké rose", "karaoke rosa", "pink karaoke"),
    typewriter: T(lang, "machine à écrire", "máquina de escribir", "typewriter"),
  }[r.subs];
  const parts = [];
  if (r.hook) parts.push(T(lang, `Accroche « ${r.hook} »`, `Gancho «${r.hook}»`, `Hook “${r.hook}”`));
  if (subs) parts.push(subs);
  parts.push(r.duration === "short" ? T(lang, "version courte", "versión corta", "short cut") : T(lang, "version complète", "versión completa", "full length"));
  if (r.start === "teaser-mid") parts.push(T(lang, "moment fort en ouverture", "momento fuerte al inicio", "highlight first"));
  if (r.start === "teaser-end") parts.push(T(lang, "la fin en ouverture", "el final al inicio", "ending first"));
  if (r.cover === "top-heavy") parts.push(T(lang, "titre de couverture en gras", "título de portada en negrita", "bold cover title"));
  if (r.cover === "top-serif") parts.push(T(lang, "titre de couverture élégant", "título de portada elegante", "elegant cover title"));
  if (music.length) {
    const i = music.indexOf(r.music);
    parts.push(i < 0 ? T(lang, "voix seule", "solo voz", "voice only") : T(lang, `musique ${i + 1}`, `música ${i + 1}`, `music ${i + 1}`));
  }
  return parts.join(" · ");
}

/** Passages gardés pour une version, à partir des passages de base (silences coupés). */
export function versionKeeps(base, total, r) {
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const kept = base.reduce((n, [a, b]) => n + (b - a), 0);
  const target = Math.min(60, r.duration === "short" ? Math.max(3, kept * SHORT_RATIO) : kept);
  const keeps = [];
  let left = target;
  for (const [a, b] of base) {
    if (left <= 0.05) break;
    const d = Math.min(b - a, left);
    keeps.push([a, r3(a + d)]);
    left -= d;
  }
  if (r.start !== "start" && total > TEASER_SECONDS * 3) {
    const at = r3(Math.min(total - TEASER_SECONDS, total * (r.start === "teaser-end" ? 0.8 : 0.5)));
    keeps.unshift([at, r3(at + TEASER_SECONDS)]);
  }
  return keeps;
}

/** Style d'une version : le style de base de la créatrice + les réglages de la recette. */
export function versionStyle(baseStyle, r, coverTitle = "") {
  const preset = SUB_PRESETS[r.subs] || SUB_PRESETS.classic;
  const title = clean(coverTitle, 40);
  const titles =
    r.cover !== "none" && title
      ? [{ text: title, x: 0.5, y: 0.6, s: 0, e: 1.2, font: r.cover === "top-heavy" ? "heavy" : "serif", size: r.cover === "top-heavy" ? 0.09 : 0.075, color: "#FFFFFF" }]
      : [];
  return {
    ...baseStyle,
    ...preset,
    // Accroche neuve : pas de polices par mot héritées d'une autre accroche. Les autocollants d'un montage
    // sont calés sur son propre minutage : ils ne sont pas repris dans les versions.
    hook: { ...(baseStyle?.hook || {}), text: r.hook || "", wordFonts: {} },
    stickers: [],
    music: { ...(baseStyle?.music || {}), id: r.music || null },
    rhythm: { ...(baseStyle?.rhythm || {}), target: 60 },
    titles,
  };
}

/* ------------------------------ Résultats ------------------------------ */
export const METRIC_MAX = 1_000_000_000;
export function sanitizeMetrics(b = {}) {
  const num = (v, required) => {
    if (v === "" || v === null || v === undefined) {
      if (required) throw Object.assign(new Error("Indiquez le nombre de vues."), { status: 400 });
      return null;
    }
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > METRIC_MAX) throw Object.assign(new Error("Les statistiques doivent être des nombres entiers."), { status: 400 });
    return n;
  };
  return { views: num(b.views, true), likes: num(b.likes), saves: num(b.saves), shares: num(b.shares) };
}
/** Score : vues + j'aime + 2 × partages + 3 × enregistrements, ramené sur 100 (la meilleure = 100). */
export function rawScore(v) {
  if (v.views === null || v.views === undefined) return null;
  return Number(v.views) + Number(v.likes || 0) + 2 * Number(v.shares || 0) + 3 * Number(v.saves || 0);
}
export function scoreVersions(versions) {
  const raws = versions.map(rawScore);
  const measured = raws.filter((x) => x !== null);
  const top = measured.length ? Math.max(...measured) : 0;
  const scored = versions.map((v, i) => ({ ...v, score: raws[i] === null ? null : top > 0 ? Math.round((raws[i] / top) * 100) : 0 }));
  if (measured.length < 2) return { versions: scored, winner: null, tie: false, measured: measured.length };
  const ranked = scored
    .filter((v) => v.score !== null)
    .sort((a, b) => rawScore(b) - rawScore(a) || Number(b.views) - Number(a.views) || String(a.label).localeCompare(String(b.label)));
  const best = ranked[0];
  const tie = ranked.length > 1 && rawScore(ranked[1]) === rawScore(best) && Number(ranked[1].views) === Number(best.views);
  return { versions: scored, winner: best.label, tie, measured: measured.length };
}
