import { MAIL_COPY_VERSION, studioEmail, emailPreviews } from "./studio-email-templates.mjs";
const q = (db, s, ...a) => db.prepare(s).bind(...a),
  one = (db, s, ...a) => q(db, s, ...a).first(),
  all = async (db, s, ...a) => (await q(db, s, ...a).all()).results;
const clock = (env) => env.MAIL_NOW?.() ?? Date.now(),
  stamp = (env) => new Date(clock(env)).toISOString();
const fail = (status, message) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};
const lang = (s) => (s === "es" || s === "en" ? s : "fr");
const clean = (s, n = 4000) =>
  String(s ?? "")
    .trim()
    .slice(0, n);
const admin = (u) => {
  if (u.role !== "agency") fail(403, "Cette action est réservée à l’agence.");
};
function base(env) {
  try {
    const u = new URL(env.STUDIO_URL);
    return u.protocol === "https:" ? u.origin : null;
  } catch {
    return null;
  }
}
export function mailReadiness(env) {
  const approved = env.EMAIL_COPY_APPROVED_VERSION === MAIL_COPY_VERSION,
    configured = !!env.BREVO_API_KEY && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.BREVO_SENDER_EMAIL || "") && !!base(env),
    delivery = approved && configured && env.EMAIL_DELIVERY_ENABLED === "true";
  return {
    copyVersion: MAIL_COPY_VERSION,
    approved,
    configured,
    deliveryEnabled: delivery,
    listConfigured: Number.isSafeInteger(Number(env.BREVO_STUDIO_LIST_ID)) && Number(env.BREVO_STUDIO_LIST_ID) > 0,
    weeklyEnabled:
      delivery &&
      env.MAIL_WEEKLY_ENABLED === "true" &&
      env.EMAIL_UNSUBSCRIBE_PUBLIC_READY === "true" &&
      (env.EMAIL_UNSUBSCRIBE_SECRET || "").length >= 32,
    schedule: "Lundi 9 h · America/Monterrey",
  };
}
export async function ensureMailMember(env, user, cid, { weeklyOptIn = false } = {}) {
  if (user.role !== "client") return;
  const c = await one(env.DB, "SELECT config FROM clients WHERE id=?", cid);
  if (!c) return;
  await q(
    env.DB,
    "INSERT OR IGNORE INTO studio_mail_members VALUES(?,?,?,?,'pending',?)",
    user.id,
    cid,
    lang(JSON.parse(c.config).language),
    Number(weeklyOptIn),
    stamp(env),
  ).run();
}
export function mailInsert(
  db,
  {
    id,
    cid,
    account,
    email,
    firstName,
    kind,
    language,
    week = null,
    fact = null,
    count = null,
    condition = null,
    time = new Date().toISOString(),
  },
) {
  const suffix = condition
    ? typeof condition === "string"
      ? " WHERE EXISTS(SELECT 1 FROM client_intakes WHERE client_id=? AND review_note=?)"
      : " WHERE EXISTS(SELECT 1 FROM client_intakes WHERE client_id=? AND revision=? AND author=? AND status='submitted')"
    : "";
  return q(
    db,
    "INSERT OR IGNORE INTO email_outbox(id,client_id,recipient,first_name,status,error,provider_id,created,updated,kind,language,copy_version,account_id,week_key,content) SELECT ?,?,?,?,'held',NULL,NULL,?,?,?,?,?,?,?,?" +
      suffix,
    id,
    cid,
    email,
    firstName,
    time,
    time,
    kind,
    lang(language),
    MAIL_COPY_VERSION,
    account,
    week,
    JSON.stringify(count ? { fact, count } : { fact }),
    ...(condition
      ? typeof condition === "string"
        ? [cid, condition]
        : [cid, condition.revision, condition.author]
      : []),
  );
}
export async function queueReceived(env, user, cid) {
  const p = await one(env.DB, "SELECT first_name,email FROM registration_profiles WHERE client_id=?", cid),
    c = await one(env.DB, "SELECT config FROM clients WHERE id=?", cid);
  if (!p || !c) return;
  await mailInsert(env.DB, {
    id: "received:" + cid + ":" + user.id,
    cid,
    account: user.id,
    email: user.email,
    firstName: p.first_name,
    kind: "received",
    language: JSON.parse(c.config).language,
    time: stamp(env),
  }).run();
  await releaseNewAndFlush(env, cid, "received");
}
export async function brevo(env, method, path, body, { allow404 = false } = {}) {
  if (!mailReadiness(env).deliveryEnabled) fail(503, "Les e-mails attendent votre accord et la configuration Brevo.");
  let res;
  try {
    res = await (env.BREVO_FETCH || fetch)("https://api.brevo.com/v3" + path, {
      method,
      headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    const e = new Error("Résultat Brevo incertain : vérifier les journaux avant de reprendre.");
    e.uncertain = true;
    throw e;
  }
  if (allow404 && res.status === 404) return null;
  let data = {};
  try {
    if (res.status !== 204) data = await res.json();
  } catch {
    const e = new Error("Réponse Brevo illisible : vérifier les journaux.");
    e.uncertain = true;
    throw e;
  }
  if (!res.ok) {
    const e = new Error(`Brevo a refusé cette opération (HTTP ${res.status}).`);
    e.uncertain = res.status >= 500;
    throw e;
  }
  return data;
}
async function listId(env) {
  const n = Number(env.BREVO_STUDIO_LIST_ID);
  if (!mailReadiness(env).listConfigured) fail(503, "Configurer la liste Brevo « Membres studio ».");
  const list = await brevo(env, "GET", "/contacts/lists/" + n);
  if (list.name !== "Membres studio") fail(503, "La liste Brevo configurée doit s’appeler « Membres studio ».");
  return n;
}
async function memberRecord(env, account) {
  return one(
    env.DB,
    "SELECT m.*,a.email,a.active AS account_active,c.active AS client_active,p.first_name,i.status AS intake_status FROM studio_mail_members m JOIN accounts a ON a.id=m.account_id JOIN clients c ON c.id=m.client_id LEFT JOIN registration_profiles p ON p.client_id=m.client_id LEFT JOIN client_intakes i ON i.client_id=m.client_id WHERE m.account_id=? AND NOT EXISTS(SELECT 1 FROM client_deletions d WHERE d.client_id=m.client_id)",
    account,
  );
}
export async function syncMailMember(env, account) {
  const m = await memberRecord(env, account);
  if (!m || !m.account_active || !m.client_active || m.intake_status !== "reviewed") return null;
  const list = await listId(env),
    path = "/contacts/" + encodeURIComponent(m.email) + "?identifierType=email_id",
    old = await brevo(env, "GET", path, null, { allow404: true });
  const attributes = {
    FIRSTNAME: m.first_name || m.email.split("@")[0],
    STUDIO_LANGUAGE: m.language,
    STUDIO_WEEKLY: !!m.weekly_opt_in,
  };
  if (!old)
    await brevo(env, "POST", "/contacts", { email: m.email, attributes, listIds: [list], updateEnabled: false });
  else await brevo(env, "PUT", path, { attributes, ...(m.sync_status === "pending" ? { listIds: [list] } : {}) });
  // Never clear a Brevo blocklist flag or force-merge a contact.
  await q(
    env.DB,
    "UPDATE studio_mail_members SET sync_status='synced',updated=? WHERE account_id=?",
    stamp(env),
    account,
  ).run();
  return old || { emailBlacklisted: false, listIds: [list] };
}
export async function releaseNewAndFlush(env, cid, kind = "welcome") {
  if (mailReadiness(env).deliveryEnabled) {
    await q(
      env.DB,
      "UPDATE email_outbox SET status='queued' WHERE client_id=? AND kind=? AND copy_version=? AND status='held' AND created>=?",
      cid,
      kind,
      MAIL_COPY_VERSION,
      new Date(clock(env) - 60000).toISOString(),
    ).run();
    await flushStudioMail(env, cid);
  }
}
export async function flushStudioMail(env, cid) {
  if (!mailReadiness(env).deliveryEnabled) return;
  const rows = await all(
    env.DB,
    "SELECT * FROM email_outbox WHERE client_id=? AND copy_version=? AND status='queued' ORDER BY created LIMIT 50",
    cid,
    MAIL_COPY_VERSION,
  );
  for (const row of rows) {
    const c = await one(
      env.DB,
      "SELECT a.id FROM accounts a JOIN clients c ON c.id=a.client_id WHERE a.id=? AND a.client_id=? AND a.active=1 AND c.active=1 AND NOT EXISTS(SELECT 1 FROM client_deletions d WHERE d.client_id=c.id)",
      row.account_id,
      cid,
    );
    if (!c) continue;
    const member = await memberRecord(env, row.account_id);
    if (
      row.kind === "weekly" &&
      (!mailReadiness(env).weeklyEnabled || !member?.weekly_opt_in || member.intake_status !== "reviewed")
    )
      continue;
    if (["welcome", "weekly"].includes(row.kind) && member?.intake_status !== "reviewed") continue;
    if (row.kind === "weekly") {
      try {
        const contact = await syncMailMember(env, row.account_id);
        if (!contact || contact.emailBlacklisted || !contact.listIds?.includes(Number(env.BREVO_STUDIO_LIST_ID))) {
          await q(env.DB, "UPDATE studio_mail_members SET weekly_opt_in=0 WHERE account_id=?", row.account_id).run();
          await q(
            env.DB,
            "UPDATE email_outbox SET status='suppressed',error='Préférence Brevo ou liste non abonnée.' WHERE id=?",
            row.id,
          ).run();
          continue;
        }
      } catch {
        await q(env.DB, "UPDATE email_outbox SET error='Synchronisation Brevo à vérifier.' WHERE id=?", row.id).run();
        continue;
      }
    } else if (row.kind === "welcome" && member) {
      try {
        await syncMailMember(env, row.account_id);
      } catch {
        await q(env.DB, "UPDATE studio_mail_members SET sync_status='failed' WHERE account_id=?", row.account_id).run();
      }
    }
    const claimed = await q(
      env.DB,
      "UPDATE email_outbox SET status='sending',error=NULL,updated=? WHERE id=? AND status='queued'",
      stamp(env),
      row.id,
    ).run();
    if (!claimed.meta.changes) continue;
    try {
      const content = JSON.parse(row.content || "{}"),
        fact = content.fact;
      if (
        row.kind === "weekly" &&
        (!fact || !(await one(env.DB, "SELECT approved FROM studio_mail_facts WHERE id=?", fact.id))?.approved)
      )
        throw Error("Le chiffre doit encore être validé avant l’envoi.");
      const unsub = row.kind === "weekly" ? await unsubscribeUrl(env, row.account_id) : null;
      const mail = studioEmail(row.kind, row.language, {
        firstName: row.first_name,
        studioUrl: base(env) + "/studio",
        fact,
        count: content.count,
        unsubscribeUrl: unsub,
      });
      const data = await brevo(env, "POST", "/smtp/email", {
        sender: { email: env.BREVO_SENDER_EMAIL, name: "Louvet & Partners" },
        to: [{ email: row.recipient, name: row.first_name }],
        subject: mail.subject,
        htmlContent: mail.html,
        textContent: mail.text,
        headers: { IdempotencyKey: row.id },
        tags: ["studio", row.kind, MAIL_COPY_VERSION],
      });
      if (!data.messageId) {
        const e = new Error("Brevo n’a pas confirmé l’envoi. Vérifier les journaux.");
        e.uncertain = true;
        throw e;
      }
      await q(
        env.DB,
        "UPDATE email_outbox SET status='sent',provider_id=?,updated=? WHERE id=?",
        data.messageId,
        stamp(env),
        row.id,
      ).run();
    } catch (e) {
      await q(
        env.DB,
        "UPDATE email_outbox SET status=?,error=?,updated=? WHERE id=?",
        e.uncertain ? "uncertain" : "failed",
        e.message,
        stamp(env),
        row.id,
      ).run();
    }
  }
}
export async function retryStudioMail(env, user, input) {
  admin(user);
  if (!mailReadiness(env).deliveryEnabled)
    fail(503, "Aucun envoi : les textes ou la connexion Brevo ne sont pas encore approuvés.");
  const r = await one(env.DB, "SELECT * FROM email_outbox WHERE id=? AND client_id=?", input.id, input.client_id);
  if (!r || r.copy_version !== MAIL_COPY_VERSION) fail(404, "E-mail de cette version introuvable.");
  if (r.status === "sent") return { ok: true };
  if (r.status === "uncertain" || r.status === "sending")
    fail(
      409,
      "Vérifier les journaux Brevo avant toute nouvelle action ; aucune relance automatique d’un résultat incertain.",
    );
  await q(env.DB, "UPDATE email_outbox SET status='queued' WHERE id=? AND status IN ('held','failed')", r.id).run();
  await flushStudioMail(env, r.client_id);
  return { ok: true };
}
export async function saveMailFact(env, user, input) {
  admin(user);
  const f = {
    id: input.id || crypto.randomUUID(),
    text_fr: clean(input.text_fr, 1500),
    text_es: clean(input.text_es, 1500),
    source_title: clean(input.source_title, 200),
    source_url: clean(input.source_url, 1000),
    source_date: clean(input.source_date, 10),
  };
  let u;
  try {
    u = new URL(f.source_url);
  } catch {}
  if (
    !f.text_fr ||
    !f.text_es ||
    !f.source_title ||
    u?.protocol !== "https:" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(f.source_date) ||
    !Number.isFinite(Date.parse(f.source_date + "T12:00:00Z")) ||
    new Date(f.source_date + "T12:00:00Z").toISOString().slice(0, 10) !== f.source_date
  )
    fail(400, "Renseignez le chiffre dans les deux langues, sa source HTTPS et une date valide.");
  await q(
    env.DB,
    "INSERT INTO studio_mail_facts VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET text_fr=excluded.text_fr,text_es=excluded.text_es,source_title=excluded.source_title,source_url=excluded.source_url,source_date=excluded.source_date,approved=excluded.approved,updated=excluded.updated",
    f.id,
    f.text_fr,
    f.text_es,
    f.source_title,
    f.source_url,
    f.source_date,
    input.approved === true ? 1 : 0,
    stamp(env),
    stamp(env),
  ).run();
  return { ok: true };
}
export async function mailState(env, user) {
  if (user.role === "agency")
    return {
      readiness: mailReadiness(env),
      previews: emailPreviews(),
      facts: await all(env.DB, "SELECT * FROM studio_mail_facts ORDER BY created"),
      outbox: await all(
        env.DB,
        "SELECT id,client_id,recipient,kind,language,status,error,created FROM email_outbox WHERE copy_version=? ORDER BY created DESC LIMIT 100",
        MAIL_COPY_VERSION,
      ),
    };
  const m = await one(env.DB, "SELECT weekly_opt_in,language FROM studio_mail_members WHERE account_id=?", user.id);
  return { weeklyOptIn: !!m?.weekly_opt_in, language: m?.language || "fr", weeklyEnabled: !!mailReadiness(env).weeklyEnabled };
}
export async function setWeeklyPreference(env, user, input) {
  if (user.role !== "client") fail(403, "Connectez-vous à votre espace client.");
  await ensureMailMember(env, user, user.client_id);
  if (typeof input.enabled !== "boolean") fail(400, "Choisissez recevoir ou arrêter le rappel.");
  await q(
    env.DB,
    "UPDATE studio_mail_members SET weekly_opt_in=?,sync_status='pending',updated=? WHERE account_id=?",
    Number(input.enabled),
    stamp(env),
    user.id,
  ).run();
  if (!input.enabled)
    await q(
      env.DB,
      "UPDATE email_outbox SET status='suppressed' WHERE account_id=? AND kind='weekly' AND status IN ('held','queued','failed')",
      user.id,
    ).run();
  return { ok: true };
}
function localParts(env) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Monterrey",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(clock(env)));
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}
export async function runWeeklyMail(env) {
  if (!mailReadiness(env).weeklyEnabled) fail(503, "Le rappel hebdomadaire reste désactivé.");
  const p = localParts(env);
  if (p.weekday !== "Mon" || p.hour !== "09")
    fail(409, "Le rappel se prépare le lundi entre 9 h et 10 h, heure de Monterrey.");
  const week = `${p.year}-${p.month}-${p.day}`;
  const facts = await all(env.DB, "SELECT * FROM studio_mail_facts WHERE approved=1 ORDER BY id");
  if (!facts.length) fail(409, "Ajoutez au moins un chiffre sourcé et validé avant le rappel.");
  const members = await all(
    env.DB,
    "SELECT m.*,a.email,p.first_name FROM studio_mail_members m JOIN accounts a ON a.id=m.account_id JOIN clients c ON c.id=m.client_id JOIN client_intakes i ON i.client_id=c.id LEFT JOIN registration_profiles p ON p.client_id=c.id WHERE m.weekly_opt_in=1 AND a.active=1 AND a.role='client' AND c.active=1 AND i.status='reviewed' AND NOT EXISTS(SELECT 1 FROM client_deletions d WHERE d.client_id=c.id) LIMIT 501",
  );
  if (members.length > 500) fail(503, "Le volume exige une pagination du traitement hebdomadaire.");
  const fact = facts[Math.floor(Date.parse(week + "T12:00:00Z") / (7 * 86400000)) % facts.length];
  for (const m of members) {
    await mailInsert(env.DB, {
      id: `weekly:${week}:${m.account_id}`,
      cid: m.client_id,
      account: m.account_id,
      email: m.email,
      firstName: m.first_name || m.email.split("@")[0],
      kind: "weekly",
      language: m.language,
      week,
      fact,
      time: stamp(env),
    }).run();
    await q(
      env.DB,
      "UPDATE email_outbox SET status='queued' WHERE id=? AND status='held'",
      `weekly:${week}:${m.account_id}`,
    ).run();
  }
  for (const cid of new Set(members.map((m) => m.client_id))) await flushStudioMail(env, cid);
  return { week, eligible: members.length };
}
const enc = new TextEncoder(),
  hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function signature(env, payload) {
  if ((env.EMAIL_UNSUBSCRIBE_SECRET || "").length < 32) fail(503, "La désinscription reste à configurer.");
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(env.EMAIL_UNSUBSCRIBE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}
export async function unsubscribeUrl(env, account) {
  const payload = btoa(JSON.stringify({ account, expires: Math.floor(clock(env) / 1000) + 366 * 86400 }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  return base(env) + "/mail/unsubscribe?token=" + payload + "." + (await signature(env, payload));
}
export async function unsubscribeRequest(req, env) {
  let token = new URL(req.url).searchParams.get("token") || "";
  if (req.method === "POST") token = String((await req.formData()).get("token") || token);
  if (token.length > 2000) fail(400, "Lien invalide.");
  const [payload, sig] = token.split(".");
  if (!/^[a-zA-Z0-9_-]+$/.test(payload || "") || !/^[a-f0-9]{64}$/.test(sig || "")) fail(400, "Lien invalide.");
  const expected = await signature(env, payload);
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff) fail(400, "Lien invalide.");
  let claims;
  try {
    claims = JSON.parse(atob(payload.replaceAll("-", "+").replaceAll("_", "/")));
  } catch {
    fail(400, "Lien invalide.");
  }
  if (typeof claims.account !== "string" || !Number.isFinite(claims.expires) || claims.expires < clock(env) / 1000)
    fail(400, "Ce lien a expiré. Modifiez vos préférences dans le studio.");
  const member = await one(env.DB, "SELECT * FROM studio_mail_members WHERE account_id=?", claims.account);
  if (!member) fail(404, "Ce compte n’existe plus.");
  const ml = lang(member.language),
    pick = (fr, es, en) => (ml === "es" ? es : ml === "en" ? en : fr);
  if (req.method === "POST") {
    const origin = req.headers.get("origin");
    if (origin && origin !== new URL(req.url).origin) fail(403, "Origine non autorisée.");
    await q(
      env.DB,
      "UPDATE studio_mail_members SET weekly_opt_in=0,sync_status='pending',updated=? WHERE account_id=?",
      stamp(env),
      claims.account,
    ).run();
    await q(
      env.DB,
      "UPDATE email_outbox SET status='suppressed' WHERE account_id=? AND kind='weekly' AND status IN ('held','queued','failed')",
      claims.account,
    ).run();
  }
  const done = req.method === "POST",
    title = done
      ? pick("C’est fait, le rappel est désactivé.", "Listo, ya no recibirás el recordatorio.", "Done, the reminder is turned off.")
      : pick("Arrêter le rappel du lundi ?", "¿Dejar de recibir el recordatorio del lunes?", "Stop the Monday reminder?");
  return new Response(
    `<!doctype html><html lang="${ml}"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Louvet & Partners</title><body style="font:16px Arial;background:#f5f3eb;color:#172d28;padding:10vh 20px"><main style="max-width:560px;margin:auto"><p>LOUVET &amp; PARTNERS</p><h1>${title}</h1><p>${pick("Votre compte reste actif. Les e-mails concernant votre compte ne changent pas.", "Tu cuenta sigue activa. Los correos sobre tu cuenta no cambian.", "Your account is still active. Emails about your account don’t change.")}</p>${done ? "" : `<form method="post"><input type="hidden" name="token" value="${token}"><button type="submit">${pick("Confirmer", "Confirmar", "Confirm")}</button></form>`}</main></body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
      },
    },
  );
}
export async function weeklyRequest(req, env) {
  if (req.method !== "POST") fail(405, "Méthode non autorisée.");
  const expected = env.STUDIO_MAIL_CRON_SECRET || "",
    actual = req.headers.get("authorization") || "";
  if (expected.length < 32 || actual !== "Bearer " + expected) fail(403, "Accès au traitement refusé.");
  return runWeeklyMail(env);
}
