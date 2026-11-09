// Montages photo tendance : chaque mise en page est dessinée dans un vrai Chromium (canvas),
// dans chaque format proposé (story, publication, carrousel). On vérifie les dimensions,
// que l'image n'est pas vide, que les slides d'un carrousel se raccordent, et que le dessin est déterministe.
// TRENDY_OUT=/dossier enregistre aussi les PNG produits.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { TEMPLATES } from "../lib/templates.mjs";
import { quantizeColors } from "../lib/trendy-draw.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Fonction pure : couleurs dominantes.
const px = new Uint8ClampedArray([...Array(50)].flatMap(() => [200, 30, 30, 255]).concat([...Array(30)].flatMap(() => [20, 40, 200, 255]), [...Array(5)].flatMap(() => [0, 0, 0, 0])));
assert.deepEqual(quantizeColors(px, 2), ["#C81E1E", "#1428C8"], "dominant colors, most frequent first, transparent ignored");

let chromium;
for (const base of [root + "/", "/opt/npm-tools/node_modules/"]) {
  try {
    chromium = createRequire(base)("playwright").chromium;
    break;
  } catch {}
}
if (!chromium) {
  console.log("trendy-render SKIP — Playwright absent (rendu vérifié uniquement là où Chromium est installé)");
  process.exit(0);
}
const trendy = TEMPLATES.filter((t) => t.group === "trendy");
assert.ok(trendy.length >= 14, "at least 14 trendy layouts");
const mime = { ".mjs": "text/javascript", ".ttf": "font/ttf", ".jpg": "image/jpeg", ".png": "image/png", ".html": "text/html" };
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
const out = process.env.TRENDY_OUT;
const results = await page.evaluate(
  async ({ ids, keepAll }) => {
    const T = await import("/lib/templates.mjs");
    const D = await import("/lib/trendy-draw.mjs");
    const fonts = [...T.TEMPLATE_FONTS, T.BODY_FONT, ...D.TRENDY_FONT_LIST];
    await Promise.all(
      fonts.map(async (f) => {
        const face = new FontFace(f.family, `url(/fonts/${f.file})`, { weight: String(f.weight) });
        document.fonts.add(await face.load());
      }),
    );
    const load = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
    const photos = await Promise.all(["dupain-1.jpg", "savon-1.jpg", "mjh-1.jpg", "dupain-2.jpg", "louvet-1.jpg", "dupain-3.jpg"].map((f) => load("/img/" + f)));
    const make = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });
    const stats = (c) => {
      const x = c.getContext("2d"), d = x.getImageData(0, 0, c.width, c.height).data;
      let sum = 0, sq = 0, n = 0;
      for (let i = 0; i < d.length; i += 4 * 97) { const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; sum += l; sq += l * l; n++; }
      const mean = sum / n;
      return { std: Math.sqrt(sq / n - mean * mean) };
    };
    const today = new Date(2026, 9, 31);
    const res = [];
    for (const id of ids) {
      const def = T.templateById(id);
      const variants = [...def.formats.map((f) => ({ format: f, carousel: false })), ...(def.carousel ? [{ format: "4:5", carousel: true }] : [])];
      for (const vr of variants) {
        for (const lang of ["fr", "es", "en"]) {
          const tpl = { id, fields: {}, photos: [], crops: [], format: vr.format, carousel: vr.carousel, font: def.font, bg: def.bg, fg: null, accent: "#B8291A", showHandle: true, handle: lang === "es" ? "@louvet.test" : "", filter: id === "t-polaroid" ? "film" : "none" };
          const [W, H] = D.trendyCanvasSize(tpl);
          const c = make(W, H);
          const imgs = photos.slice(0, def.photos[1]);
          const slots = D.drawTrendy(c.getContext("2d"), tpl, { photos: imgs, lang, today, makeCanvas: make });
          const again = make(W, H);
          D.drawTrendy(again.getContext("2d"), tpl, { photos: imgs, lang, today, makeCanvas: make });
          const same = c.toDataURL() === again.toDataURL();
          const slides = vr.carousel ? D.sliceCarousel(c, make) : [c];
          // Raccord : la dernière colonne d'une slide et la première de la suivante se ressemblent.
          let seam = 0;
          for (let k = 0; k + 1 < slides.length; k++) {
            const a = slides[k].getContext("2d").getImageData(1079, 0, 1, 1350).data, b = slides[k + 1].getContext("2d").getImageData(0, 0, 1, 1350).data;
            let diff = 0;
            for (let i = 0; i < a.length; i += 4) diff += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
            seam = Math.max(seam, diff / (a.length / 4) / 3);
          }
          // Sans photo (vignette de la galerie) : ne doit pas planter.
          const empty = make(W, H);
          D.drawTrendy(empty.getContext("2d"), { ...tpl, photos: [] }, { photos: [], lang, today, makeCanvas: make });
          res.push({
            id, format: vr.carousel ? "carousel" : vr.format, lang, W, H, same, seam,
            slots: slots.length,
            slides: slides.map((s) => ({ w: s.width, h: s.height, std: stats(s).std, png: keepAll || lang === "fr" ? s.toDataURL("image/png") : null })),
          });
        }
      }
    }
    return res;
  },
  { ids: trendy.map((t) => t.id), keepAll: false },
);
await browser.close();
assert.deepEqual(errors, [], "no page error");
for (const r of results) {
  const def = TEMPLATES.find((t) => t.id === r.id);
  const label = `${r.id} ${r.format} ${r.lang}`;
  if (r.format === "carousel") {
    assert.equal(r.slides.length, def.carousel, label + " slide count");
    assert.ok(r.seam < 40, label + " slides join seamlessly (seam diff " + r.seam.toFixed(1) + ")");
  } else assert.equal(r.slides.length, 1);
  for (const s of r.slides) {
    const [w, h] = r.format === "9:16" ? [1080, 1920] : [1080, 1350];
    assert.equal(s.w, w, label + " width");
    assert.equal(s.h, h, label + " height");
    assert.ok(s.std > 12, label + " not blank (std " + s.std.toFixed(1) + ")");
  }
  assert.ok(r.same, label + " deterministic");
  assert.ok(r.slots >= def.photos[0], label + " exposes its photo slots");
  if (out && r.lang === "fr") {
    fs.mkdirSync(out, { recursive: true });
    r.slides.forEach((s, i) => fs.writeFileSync(path.join(out, `${r.id}-${r.format.replace(":", "x")}${r.slides.length > 1 ? "-" + (i + 1) : ""}.png`), Buffer.from(s.png.split(",")[1], "base64")));
  }
}
const formats = new Set(results.map((r) => r.format));
assert.ok(formats.has("9:16") && formats.has("4:5") && formats.has("carousel"));
console.log(`trendy-render OK — ${trendy.length} montages tendance, ${results.length} rendus (story 1080×1920, publication 1080×1350, carrousels découpés et raccordés), FR/ES/EN, déterministes`);
