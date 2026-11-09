// Éditeur à calques des créatrices : modèle de données, validation, aimantation, diapos, catalogue et classement « Pour vous ».
import assert from "node:assert/strict";
import { sanitizeLayered, sanitizeLayer, layerCanvasSize, photoSlots, fillPhotos, emptySlots, snap, setSlideCount, moveSlide, makeLayer, hitLayer, topLayerAt, MAX_LAYERS, LAYER_TYPES, STICKERS } from "../lib/layers.mjs";
import { LAYER_TEMPLATES, INTENTS, MOODS, buildLayered, rankTemplates, fitsPickFormat, nicheIntents, layerTemplateById } from "../lib/layer-templates.mjs";
import { sanitizeTemplate } from "../lib/templates.mjs";

// ---------- Validation ----------
const d0 = sanitizeLayered({ format: "4:5", slides: 3, bg: { color: "red", photo: "../etc", blur: 999 }, layers: [] });
assert.equal(d0.id, "layers");
assert.deepEqual(layerCanvasSize(d0), [3240, 1350], "seamless canvas = 3 slides wide");
assert.equal(d0.bg.color, "#F6F1E9", "invalid color refused");
assert.equal(d0.bg.photo, "", "invalid file id refused");
assert.equal(d0.bg.blur, 60, "blur clamped");
assert.equal(sanitizeLayered({ slides: 99 }).slides, 10, "max 10 slides");
assert.equal(sanitizeLayered({ format: "1:1" }).format, "9:16", "only story / post formats");
assert.throws(() => sanitizeLayered({ layers: [{ type: "script" }] }), /Élément inconnu/, "type whitelist");
assert.throws(() => sanitizeLayered({ layers: Array.from({ length: MAX_LAYERS + 1 }, () => ({ type: "shape" })) }), /au maximum/, "max layers");
const t = sanitizeLayer({ type: "text", text: "x".repeat(2000), font: "comic", size: 9999, color: "#abcdef", x: 1e9, rot: 9999, opacity: -3, evil: "<script>", bg: "nope" }, 1080, 1920);
assert.equal(t.text.length, 600);
assert.equal(t.font, "poppins");
assert.equal(t.size, 500);
assert.equal(t.color, "#ABCDEF");
assert.equal(t.x, 1620, "position clamped to the canvas margin");
assert.equal(t.rot, 360);
assert.equal(t.opacity, 0.05);
assert.equal(t.evil, undefined, "unknown keys dropped");
assert.equal(t.bg, "");
const ph = sanitizeLayer({ type: "photo", file: "photo-abc123", crop: { x: 5, y: "a", z: 0 } }, 1080, 1350);
assert.deepEqual(ph.crop, { x: 1, y: 0, z: 1 });
const st = sanitizeLayer({ type: "sticker", glyph: "skull" }, 1080, 1350);
assert.equal(st.glyph, "star", "unknown glyph → star");
assert.equal(sanitizeLayer({ type: "sticker", emoji: "🎀" }, 1080, 1350).emoji, "🎀", "emoji stickers kept");
assert.equal(sanitizeLayer({ type: "ui", variant: "bank" }, 1080, 1350).variant, "selectbar");
const dup = sanitizeLayered({ layers: [{ type: "shape", id: "a" }, { type: "shape", id: "a" }] });
assert.notEqual(dup.layers[0].id, dup.layers[1].id, "unique layer ids");
const withPhotos = sanitizeLayered({ bg: { photo: "photo-bg0001" }, layers: [{ type: "photo", file: "photo-aaa111" }, { type: "photo", file: "photo-aaa111" }, { type: "photo", file: "" }] });
assert.deepEqual(withPhotos.photos, ["photo-bg0001", "photo-aaa111"], "photos used, unique (checked for tenant ownership)");
assert.equal(sanitizeTemplate({ id: "layers", layers: [] }).id, "layers", "designs route accepts layered visuals");
assert.equal(sanitizeLayered({ slides: 3, slide: 7 }).slide, 2);

// ---------- Outils de l'éditeur ----------
const L = { type: "shape", x: 100, y: 100, w: 100, h: 50, rot: 90 };
assert.ok(hitLayer(L, 100, 140), "rotated hit test");
assert.ok(!hitLayer(L, 140, 100));
const doc = { format: "4:5", slides: 3, layers: [makeLayer("text", 540, 600), makeLayer("photo", 1080, 600)] };
assert.equal(topLayerAt(doc, 1080, 600), 1, "topmost layer wins");
let sn = snap(doc, { w: 200, h: 100, rot: 0 }, 1072, 300);
assert.equal(sn.x, 1080, "snaps to the slide divider");
assert.ok(sn.guides.some((g) => g.axis === "x" && g.at === 1080));
sn = snap(doc, { w: 200, h: 100, rot: 0 }, 800, 300);
assert.equal(sn.x, 800, "no snap far from guides");
assert.equal(snap(doc, { w: 200, h: 100, rot: 0 }, 300, 670).y, 675, "snaps to the vertical center");
const moved = moveSlide({ ...doc, layers: [{ ...makeLayer("text", 540, 100) }, { ...makeLayer("text", 2700, 100) }] }, 0, 2);
assert.deepEqual(moved.layers.map((l) => l.x), [2700, 1620], "layers follow their slide when reordering");
const fewer = setSlideCount({ ...doc, layers: [makeLayer("text", 540, 100), makeLayer("text", 2700, 100)] }, 2);
assert.equal(fewer.slides, 2);
assert.equal(fewer.layers.length, 1, "layers of removed slides are removed");
for (const k of ["text", "script", "bubble", "label", "sticker", "arrow", "photo", "doodle"]) assert.ok(LAYER_TYPES.includes(makeLayer(k, 0, 0).type), k);

// ---------- Catalogue ----------
assert.ok(LAYER_TEMPLATES.length >= 30, "about 24 layouts + 6 seamless starters");
assert.ok(LAYER_TEMPLATES.filter((t) => t.seamless).length >= 6);
assert.equal(INTENTS.length, 10);
assert.equal(MOODS.length, 4);
const banned = /ella[ _]?content|content club|\bnola\b|starbucks|louis vuitton|\brhode\b|\bsims\b/i;
for (const tpl of LAYER_TEMPLATES) {
  for (const v of Object.values(tpl.name)) assert.ok(v && !banned.test(v), tpl.id + " name");
  assert.ok(tpl.name.fr && tpl.name.es && tpl.name.en, tpl.id + " trilingual");
  assert.ok(tpl.intents.every((i) => INTENTS.some((x) => x.id === i)), tpl.id + " intents");
  assert.ok(MOODS.some((m) => m.id === tpl.mood), tpl.id + " mood");
  for (const format of ["9:16", "4:5"])
    for (const lang of ["fr", "es", "en"]) {
      const d = buildLayered(tpl.id, { lang, format, name: "Léa", handle: "@lea" });
      const s = sanitizeLayered(d);
      assert.equal(s.layers.length, d.layers.length, `${tpl.id} ${format} ${lang} survives validation`);
      assert.equal(photoSlots(s).length, tpl.photos, `${tpl.id} photo slots`);
      assert.ok(!banned.test(JSON.stringify(s)), tpl.id + " no third-party brand text");
      for (const l of s.layers) if (l.type === "sticker") assert.ok(l.glyph === "" || STICKERS.includes(l.glyph));
    }
}
assert.equal(buildLayered("e-sl-blank", { slides: 6 }).slides, 6, "seamless carousels can grow");
assert.equal(buildLayered("e-five", { slides: 6 }).slides, 1, "single visuals stay single");
// Remplissage dans l'ordre de lecture (diapo par diapo, de haut en bas).
const day = buildLayered("e-dayinlife", { format: "4:5" });
const filled = fillPhotos(day, ["p1aaaa", "p2aaaa", "p3aaaa", "p4aaaa"]);
assert.deepEqual(photoSlots(filled).map((i) => filled.layers[i].file), ["p1aaaa", "p2aaaa", "p3aaaa", "p4aaaa"]);
assert.ok(photoSlots(filled).map((i) => filled.layers[i].x).every((x, k, a) => !k || x > a[k - 1]), "slide order");
assert.equal(emptySlots(filled), 0);
assert.equal(emptySlots(fillPhotos(day, ["p1aaaa"])), 3);

// ---------- Sélection facile ----------
assert.ok(fitsPickFormat(layerTemplateById("e-dayinlife"), "carousel") && !fitsPickFormat(layerTemplateById("e-dayinlife"), "story"));
assert.ok(fitsPickFormat(layerTemplateById("e-five"), "reel") && !fitsPickFormat(layerTemplateById("e-thoughts"), "reel"));
assert.deepEqual(nicheIntents({ creatorStrategy: { pillars: ["Recettes faciles"] } }).slice(0, 1), ["recipe"]);
const cfg = { creatorStrategy: { pillars: ["Cuisine maison", "Voyage"] } };
const r1 = rankTemplates(cfg, { format: "story" }).map((t) => t.id);
assert.deepEqual(r1, rankTemplates(cfg, { format: "story" }).map((t) => t.id), "deterministic");
assert.equal(r1[0], "e-recipe", "niche first");
const r2 = rankTemplates(cfg, { format: "story", favorites: ["e-thread"], recent: ["e-notes"] }).map((t) => t.id);
assert.deepEqual(r2.slice(0, 2), ["e-thread", "e-notes"], "favorites, then recently used");
assert.ok(rankTemplates({}, { format: "carousel" }).every((t) => t.slides > 1));
assert.ok(rankTemplates({}, { format: "story", intent: "recipe" }).every((t) => t.intents.includes("recipe")));
const four = rankTemplates({}, { format: "story", photoCount: 4 });
assert.ok(four.length && four[0].photos === 4, "photo-first: exact photo count first");
console.log(`layers OK — ${LAYER_TEMPLATES.length} modèles × 2 formats × 3 langues validés, calques (types, bornes, ${MAX_LAYERS} max), aimantation, diapos, remplissage, classement « Pour vous »`);
