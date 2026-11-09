// Notifications : traduction ES/EN, mois lisibles, écran à ouvrir.
import assert from "node:assert/strict";
import { noticeI18n, monthLabel } from "../lib/notice-i18n.mjs";

assert.equal(monthLabel("2026-11", "fr"), "novembre 2026");
assert.equal(monthLabel("2026-11", "es"), "noviembre de 2026");
assert.equal(monthLabel("2026-11", "en"), "November 2026");

const ideas = noticeI18n("Vos 30 idées vidéo pour novembre 2026 sont disponibles.");
assert.equal(ideas.target, "videos");
assert.equal(ideas.i18n.es, "Tus 30 ideas de video para noviembre de 2026 están disponibles.");
assert.equal(ideas.i18n.en, "Your 30 video ideas for November 2026 are ready.");

const delivery = noticeI18n("Vos 5 contenus du mois sont prêts : retrouvez-les dans « Mes visuels ».");
assert.equal(delivery.target, "creations");
assert.match(delivery.i18n.en, /^Your 5 posts/);
// L'ancien texte (« Mes photos ») reste lisible.
assert.equal(noticeI18n("Vos 6 contenus du mois sont prêts : retrouvez-les dans « Mes photos ».").target, "creations");

const review = noticeI18n("L’agence a relu votre vidéo : Super, on publie !");
assert.equal(review.i18n.es, "La agencia revisó tu video: Super, on publie !");
assert.equal(review.target, "montage");

assert.equal(noticeI18n("L’agence vous a répondu dans vos messages.").target, "chat");
assert.equal(noticeI18n("Votre offre de collaboration est validée : elle est visible par les créatrices.").target, "collabs");
assert.equal(noticeI18n("Une marque a répondu à votre proposition de collaboration.").target, "opportunities");
assert.equal(noticeI18n("Votre Reel avec @withjulielouvet est validé : la réduction sera déduite de votre prochaine facture.").target, "referral");
assert.equal(noticeI18n("Une vidéo finale est disponible pour validation.").i18n.en, "A final video is ready for review.");
// Notification agence : reste en français, mais ouvre la boîte « À traiter ».
const agency = noticeI18n("Nouvelle offre de collaboration à valider : Maison Exemple");
assert.equal(agency.target, "todo");
assert.equal(agency.i18n.es, agency.i18n.fr);
// Texte inconnu : repris tel quel, sans écran.
assert.deepEqual(noticeI18n("Bonjour"), { i18n: { fr: "Bonjour", es: "Bonjour", en: "Bonjour" }, target: null });

// Toutes les notifications envoyées par le code ont une traduction (aucun texte client oublié).
import fs from "node:fs";
const src = ["lib/studio.mjs", "lib/collabs.mjs"].map((f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8")).join("\n");
const literals = [...src.matchAll(/notice\([^;]*?"((?:Votre|Vos|Une|Le |L’|Tous|Cette|Montage)[^"]+)"/gs)].map((m) => m[1]);
assert.ok(literals.length >= 15, "notifications found: " + literals.length);
for (const t of literals) {
  if (/\$\{/.test(t) || /: $/.test(t)) continue; // texte complété à l’exécution
  const r = noticeI18n(t);
  assert.notEqual(r.i18n.en, t, "missing English for: " + t);
}
console.log("notice-i18n OK — " + literals.length + " notifications traduites, mois lisibles, écrans ciblés");
// Anciennes notifications avec le mois brut : affichées lisiblement.
const old = noticeI18n("Vos 30 idées vidéo pour 2026-10 sont disponibles.");
assert.equal(old.i18n.fr, "Vos 30 idées vidéo pour octobre 2026 sont disponibles.");
assert.equal(old.i18n.es, "Tus 30 ideas de video para octubre de 2026 están disponibles.");
console.log("notice-i18n OK — anciens mois bruts convertis");
