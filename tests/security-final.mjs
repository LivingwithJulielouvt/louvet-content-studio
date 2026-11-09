// Régressions de la relecture de sécurité finale (novembre 2026).
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { harness, readyHarness } from "./harness.mjs";
import { handleStudio } from "../lib/studio.mjs";
import { normalizeReelUrl } from "../lib/collabs.mjs";
import { subnetOf } from "../lib/public-subscriptions.mjs";

async function form(h, email, ip, extra = {}) {
  const g = await handleStudio(
    new Request("https://studio.test/api/studio/subscription-request", { headers: { "x-forwarded-for": ip } }),
    h.env,
  );
  if (g.status !== 200) return g.status;
  const nonce = (await g.json()).nonce,
    cookie = g.headers.get("set-cookie").split(";")[0];
  const r = await handleStudio(
    new Request("https://studio.test/api/studio/subscription-request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://studio.test",
        "X-Studio-Request": "1",
        "x-forwarded-for": ip,
        Cookie: cookie,
      },
      body: JSON.stringify({
        nonce,
        request_key: crypto.randomUUID(),
        first_name: "X",
        name: "X",
        email,
        workspaceType: "brand",
        language: "fr",
        consent: true,
        ...extra,
      }),
    }),
    h.env,
  );
  return r.status;
}
async function seedTwo(h) {
  const call = h.call;
  await call("state");
  const [a, b] = (await call("seed", {})).data.clients;
  for (const [c, e] of [
    [a, "alice@test.local"],
    [b, "mallory@test.local"],
  ]) {
    const cc = (await call("state?client=" + c.id)).data.clients.find((x) => x.id === c.id);
    await call("settings", {
      client_id: c.id,
      name: cc.name,
      quota_limit: cc.quota_limit,
      active: true,
      config: { ...cc.config, allowedEmails: [e] },
    });
  }
  await call("join", { code: a.code }, "alice", "alice@test.local");
  await call("join", { code: b.code }, "mallory", "mallory@test.local");
  return [a, b];
}

// H1 — un tiers ne peut ni détourner un parrainage ni fixer le pays d'un prospect via le formulaire anonyme.
{
  const h = readyHarness(() => {
    throw Error("no api");
  });
  const call = h.call;
  const [a, b] = await seedTwo(h);
  const aliceCode = (await call("state", undefined, "alice", "alice@test.local")).data.referral.code;
  const malCode = (await call("state", undefined, "mallory", "mallory@test.local")).data.referral.code;
  assert.equal(await form(h, "victim@test.local", "198.51.100.1", { referral_code: aliceCode }), 200);
  // Le formulaire anonyme n'écrit plus rien dans referral_claims.
  assert.equal(h.sqlite.prepare("SELECT COUNT(*) n FROM referral_claims").get().n, 0);
  await form(h, "victim@test.local", "203.0.113.9", { referral_code: malCode, country: "US" });
  const v = (await call("clients", { name: "Victim brand", config: { allowedEmails: ["victim@test.local"] } })).data;
  await call("join", { code: v.code }, "victim", "victim@test.local");
  const ref = h.sqlite.prepare("SELECT client_id FROM referrals WHERE referred_client_id=?").get(v.id);
  assert.equal(ref?.client_id, a.id, "le premier code (celui du vrai prospect) l'emporte");
  assert.notEqual(ref?.client_id, b.id);
}
// H1 (suite) — à l'inscription, le pays choisi par la personne connectée l'emporte sur une demande anonyme.
{
  const h = harness(() => {
    throw Error("no api");
  });
  await h.call("state");
  await form(h, "newbie@test.local", "198.51.100.20", { country: "US" });
  const r = await h.call(
    "register",
    { name: "Atelier", first_name: "N", workspaceType: "brand", language: "fr", country: "FR" },
    "newbie",
    "newbie@test.local",
  );
  assert.equal(r.status, 200);
  const cfg = JSON.parse(
    h.sqlite.prepare("SELECT c.config FROM clients c JOIN accounts a ON a.client_id=c.id WHERE a.id='newbie'").get().config,
  );
  assert.equal(cfg.country, "FR");
}

// M1 — appels d'IA : limite horaire par espace (plus de boucle illimitée sur le compte OpenAI de l'agence).
{
  let calls = 0;
  const h = readyHarness(async () => {
    calls++;
    return Response.json({ output_text: JSON.stringify({ text: "x", title: "y", subtitle: "z", quote: "q", cta: "c" }) });
  });
  const call = h.call;
  await call("state");
  const [a] = (await call("seed", {})).data.clients;
  const cc = (await call("state?client=" + a.id)).data.clients.find((x) => x.id === a.id);
  await call("settings", {
    client_id: a.id,
    name: cc.name,
    quota_limit: 0,
    active: true,
    config: { ...cc.config, allowedEmails: ["alice@test.local"] },
  });
  await call("join", { code: a.code }, "alice", "alice@test.local");
  const { TEMPLATES } = await import("../lib/templates.mjs");
  const id = TEMPLATES.find((t) => !t.requiresConsent).id;
  let ok = 0,
    limited = 0;
  for (let i = 0; i < 40; i++) {
    const r = await call("template-text", { client_id: a.id, template_id: id, brief: "x" }, "alice", "alice@test.local");
    if (r.status === 200) ok++;
    if (r.status === 429) limited++;
  }
  assert.ok(ok <= 30, "au plus 30 appels d'IA par heure : " + ok);
  assert.ok(limited >= 10, "les appels suivants sont refusés (429)");
  assert.ok(calls <= 30);
}

// M2 — quelques dizaines de demandes indésirables ne bloquent plus le formulaire pour tout le monde.
{
  const h = harness(() => {
    throw Error("x");
  });
  for (let ip = 0; ip < 17; ip++) for (let k = 0; k < 3; k++) await form(h, `junk${ip}-${k}@x.test`, "10.0." + ip + ".9");
  assert.equal(await form(h, "real.prospect@brand.test", "192.0.2.77"), 200);
  // Même sous-réseau /24 : limité ensemble.
  let same = 0;
  for (let k = 0; k < 8; k++) if ((await form(h, `s${k}@x.test`, "203.0.113." + (k + 1))) === 200) same++;
  assert.ok(same <= 5, "limite par sous-réseau : " + same);
  assert.equal(subnetOf("203.0.113.42, 10.0.0.1"), "203.0.113.0/24");
  assert.equal(subnetOf("2001:db8:abcd:1::5"), "2001:db8:abcd::/48");
}

// M3 — un compte tout juste créé, sans questionnaire envoyé, ne peut pas téléverser dans la messagerie.
{
  const h = harness(() => {
    throw Error("x");
  });
  const call = h.call;
  await call("state");
  assert.equal((await call("register", { name: "Spam", first_name: "S", workspaceType: "brand" }, "eve", "eve@evil.test")).status, 200);
  const cid = (await call("state", undefined, "eve", "eve@evil.test")).data.selected;
  const r = await call("chat-photo-intent", { client_id: cid, filename: "a.png", mime: "image/png", size: 2000 }, "eve", "eve@evil.test");
  assert.equal(r.status, 409);
}

// M4 — limites respectées même avec des demandes simultanées (écritures en série + conditions dans l'insertion).
{
  const h = readyHarness(() => {
    throw Error("x");
  });
  const call = h.call;
  const [a] = await seedTwo(h);
  const chat = await Promise.all(
    [...Array(45)].map(() => call("chat-send", { client_id: a.id, body: "bonjour" }, "alice", "alice@test.local")),
  );
  assert.ok(chat.filter((x) => x.status === 200).length <= 30, "chat : 30 par heure au plus");
  const intents = await Promise.all(
    [...Array(70)].map(() =>
      call("chat-photo-intent", { client_id: a.id, filename: "a.png", mime: "image/png", size: 2000 }, "alice", "alice@test.local"),
    ),
  );
  assert.ok(intents.filter((x) => x.status === 200).length <= 60, "envois : 60 par heure au plus");
}

// M6 + L3 — plafond mensuel des Reels tenu en parallèle ; un Reel refusé peut être repris par son vrai auteur.
{
  const h = readyHarness(() => {
    throw Error("x");
  });
  const call = h.call;
  const [a, b] = await seedTwo(h);
  const ids = [];
  for (let i = 0; i < 14; i++) {
    const r = await call(
      "reel-claim",
      { client_id: a.id, url: "https://www.instagram.com/reel/RaceCode" + String(i).padStart(3, "0") + "/" },
      "alice",
      "alice@test.local",
    );
    ids.push(r.data.id);
  }
  await Promise.all(ids.map((id) => call("reel-review", { id, decision: "approve" })));
  const n = h.sqlite
    .prepare("SELECT COUNT(*) n FROM reel_collab_claims WHERE client_id=? AND status IN ('approved','crediting','credited')")
    .get(a.id).n;
  assert.ok(n <= 10, "plafond de 10 Reels par mois : " + n);
  const squat = await call("reel-claim", { client_id: b.id, url: "https://www.instagram.com/reel/OwnerReel01/" }, "mallory", "mallory@test.local");
  await call("reel-review", { id: squat.data.id, decision: "refuse", reason: "pas votre Reel" });
  const mine = await call("reel-claim", { client_id: a.id, url: "https://www.instagram.com/reel/OwnerReel01/" }, "alice", "alice@test.local");
  assert.equal(mine.status, 200, "un Reel refusé ne reste pas bloqué par un autre espace");
  assert.equal(normalizeReelUrl("https://www.instagram.com/share/reel/AbCdEf123/"), null, "liens de partage refusés");
}

// L1 — une extension ajoutée à une route d'API ne dispense jamais de session ; l'action de maintenance anonyme n'existe plus.
{
  const proxy = fs.readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
  assert.match(proxy, /!pathname\.startsWith\("\/api\/"\)/);
  assert.match(proxy, /cookieOptions/);
  const studio = fs.readFileSync(new URL("../lib/studio.mjs", import.meta.url), "utf8");
  assert.ok(!/action === "monthly-maintenance"/.test(studio));
}

// L7 — les adresses des marques ne sont plus envoyées en bloc ; chaque affichage est limité et tracé.
{
  const opp = fs.readFileSync(new URL("../lib/opportunities.mjs", import.meta.url), "utf8");
  assert.match(opp, /email: "", hasEmail/);
  assert.match(opp, /opportunity_contact_viewed/);
}

// M5 / C1 / L6 — en-têtes de sécurité, optimiseur d'images désactivé, dépendances corrigées.
{
  const out = execFileSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--no-warnings",
      "-e",
      "import('./next.config.ts').then(async m=>{const h=await m.default.headers();console.log(JSON.stringify({h:h[0].headers,img:m.default.images}))})",
    ],
    { cwd: new URL("..", import.meta.url).pathname, env: { ...process.env, NODE_ENV: "production" } },
  ).toString();
  const { h, img } = JSON.parse(out);
  const get = (k) => h.find((x) => x.key === k)?.value || "";
  assert.match(get("Content-Security-Policy"), /frame-ancestors 'none'/);
  assert.match(get("Content-Security-Policy"), /wasm-unsafe-eval/);
  assert.equal(get("X-Frame-Options"), "DENY");
  assert.match(get("Strict-Transport-Security"), /max-age=/);
  assert.equal(img?.unoptimized, true);
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const [maj, min, pat] = pkg.dependencies.next.replace(/^[^\d]*/, "").split(".").map(Number);
  assert.ok(maj > 16 || (maj === 16 && (min > 4 || (min === 4 && pat >= 3))), "next ≥ 16.4.3");
}

console.log(
  "security-final OK — parrainage non détournable, IA limitée, formulaire non bloquable, messagerie protégée, limites atomiques, plafond Reels, en-têtes de sécurité",
);
