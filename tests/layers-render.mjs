// Éditeur à calques : chaque modèle de départ est dessiné dans un vrai Chromium (canvas), en story et en publication,
// dans les trois langues, avec des photos. On vérifie dimensions, image non vide, dessin déterministe,
// et pour les carrousels que les diapos découpées reprennent exactement les pixels de la grande toile (aucun décalage au raccord).
// LAYERS_OUT=/dossier enregistre aussi les PNG (français).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { LAYER_TEMPLATES } from "../lib/layer-templates.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let chromium;
for (const base of [root + "/", "/opt/npm-tools/node_modules/"]) {
  try {
    chromium = createRequire(base)("playwright").chromium;
    break;
  } catch {}
}
if (!chromium) {
  console.log("layers-render SKIP — Playwright absent (rendu vérifié uniquement là où Chromium est installé)");
  process.exit(0);
}
const mime = { ".mjs": "text/javascript", ".ttf": "font/ttf", ".jpg": "image/jpeg", ".png": "image/png" };
const browser = await chromium.launch();
const page = await browser.newPage();
await page.route("http://studio.test/**", (route) => {
  const u = new URL(route.request().url());
  const map = u.pathname.startsWith("/lib/") ? path.join(root, u.pathname) : u.pathname.startsWith("/fonts/") ? path.join(root, "public/media-engine", u.pathname) : u.pathname.startsWith("/img/") ? path.join(root, "public/realisations", u.pathname.slice(5)) : null;
  if (u.pathname === "/") return route.fulfill({ body: "<!doctype html><html><body></body></html>", contentType: "text/html" });
  if (!map || !fs.existsSync(map)) return route.fulfill({ status: 404, body: "" });
  route.fulfill({ body: fs.readFileSync(map), contentType: mime[path.extname(map)] || "application/octet-stream" });
});
await page.goto("http://studio.test/");
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const keep = !!process.env.LAYERS_OUT;
const results = await page.evaluate(
  async ({ ids, keep }) => {
    const LT = await import("/lib/layer-templates.mjs");
    const LY = await import("/lib/layers.mjs");
    const D = await import("/lib/layer-draw.mjs");
    await Promise.all(
      D.LAYER_FONT_FILES.map(async (f) => {
        const face = new FontFace(f.family, `url(/fonts/${f.file})`, { weight: String(f.weight) });
        document.fonts.add(await face.load());
      }),
    );
    const load = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
    const files = ["dupain-1.jpg", "savon-1.jpg", "mjh-1.jpg", "dupain-2.jpg", "louvet-1.jpg", "dupain-3.jpg", "savon-1.jpg"];
    const imgs = await Promise.all(files.map((f) => load("/img/" + f)));
    const make = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });
    const std = (c) => {
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let s = 0, q = 0, n = 0;
      for (let i = 0; i < d.length; i += 4 * 131) { const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; s += l; q += l * l; n++; }
      const m = s / n;
      return Math.sqrt(q / n - m * m);
    };
    const res = [];
    for (const id of ids) {
      for (const format of ["9:16", "4:5"]) {
        for (const lang of ["fr", "es", "en"]) {
          let d = LT.buildLayered(id, { lang, format, name: "Léa Martin", handle: "@lea.cuisine" });
          const ids2 = imgs.map((_, i) => "photo" + i + "xx");
          d = LY.fillPhotos(LY.sanitizeLayered(d), ids2);
          const photos = new Map(ids2.map((k, i) => [k, imgs[i]]));
          const [W, H] = LY.layerCanvasSize(d);
          const c = make(W, H);
          D.drawLayered(c.getContext("2d"), d, { photos, makeCanvas: make });
          const again = make(W, H);
          D.drawLayered(again.getContext("2d"), d, { photos, makeCanvas: make });
          const same = c.toDataURL() === again.toDataURL();
          const slides = d.slides > 1 ? D.sliceLayered(c, d, make) : [c];
          // Raccord exact : chaque colonne de bord d'une diapo = la même colonne de la grande toile.
          let mismatch = 0;
          const full = c.getContext("2d");
          slides.forEach((s, k) => {
            for (const col of [0, 1079]) {
              const a = s.getContext("2d").getImageData(col, 0, 1, H).data, b = full.getImageData(k * 1080 + col, 0, 1, H).data;
              for (let i = 0; i < a.length; i++) mismatch += a[i] !== b[i] ? 1 : 0;
            }
          });
          // Aperçu réduit de la galerie (sans photo) : ne doit pas planter.
          const thumb = make(Math.round(W * 0.25), Math.round(H * 0.25));
          D.drawLayered(thumb.getContext("2d"), LT.buildLayered(id, { lang, format }), { scale: 0.25, showEmpty: true, makeCanvas: make });
          res.push({ id, format, lang, W, H, same, mismatch, slides: slides.map((s) => ({ w: s.width, h: s.height, std: std(s), png: keep && lang === "fr" ? s.toDataURL("image/png") : null })), thumbStd: std(thumb) });
        }
      }
    }
    return res;
  },
  { ids: LAYER_TEMPLATES.map((t) => t.id), keep },
);
await browser.close();
assert.deepEqual(errors, [], "no page error");
for (const r of results) {
  const tpl = LAYER_TEMPLATES.find((t) => t.id === r.id);
  const label = `${r.id} ${r.format} ${r.lang}`;
  const h = r.format === "9:16" ? 1920 : 1350;
  assert.equal(r.W, 1080 * tpl.slides, label + " canvas width");
  assert.equal(r.slides.length, tpl.slides, label + " slide count");
  for (const s of r.slides) {
    assert.equal(s.w, 1080, label + " slide width");
    assert.equal(s.h, h, label + " slide height");
    // Une diapo vierge de carrousel continu peut être unie.
    if (tpl.id !== "e-sl-blank") assert.ok(s.std > 8, label + " not blank (std " + s.std.toFixed(1) + ")");
  }
  assert.equal(r.mismatch, 0, label + " slices match the big canvas exactly");
  assert.ok(r.same, label + " deterministic");
  if (tpl.id !== "e-sl-blank") assert.ok(r.thumbStd > 1, label + " gallery preview drawn");
  if (keep && r.lang === "fr") {
    fs.mkdirSync(process.env.LAYERS_OUT, { recursive: true });
    r.slides.forEach((s, i) => fs.writeFileSync(path.join(process.env.LAYERS_OUT, `${r.id}-${r.format.replace(":", "x")}${r.slides.length > 1 ? "-" + (i + 1) : ""}.png`), Buffer.from(s.png.split(",")[1], "base64")));
  }
}
console.log(`layers-render OK — ${LAYER_TEMPLATES.length} modèles de départ, ${results.length} rendus (story 1080×1920, publication 1080×1350, carrousels continus découpés au pixel près), FR/ES/EN, déterministes`);
