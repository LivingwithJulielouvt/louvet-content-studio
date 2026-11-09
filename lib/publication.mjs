import { mailInsert, releaseNewAndFlush } from "./studio-mail.mjs";
import { studioEmail } from "./studio-email-templates.mjs";
import { dayInMonterrey, monthInMonterrey } from "./editorial.mjs";
import { normalizeIntake } from "./client-intake.mjs";
const q = (db, s, ...a) => db.prepare(s).bind(...a),
  one = (db, s, ...a) => q(db, s, ...a).first(),
  all = async (db, s, ...a) => (await q(db, s, ...a).all()).results,
  run = (db, s, ...a) => q(db, s, ...a).run();
const now = () => new Date().toISOString(),
  id = () => crypto.randomUUID(),
  parse = (s) => JSON.parse(s),
  clean = (v, n) =>
    String(v ?? "")
      .trim()
      .slice(0, n);
function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
function admin(u) {
  if (u.role !== "agency") fail(403, "Cette action est réservée à l’agence.");
}
async function client(db, u, cid) {
  if (u.role !== "agency" && u.client_id !== cid) fail(403, "Espace inaccessible.");
  const c = await one(db, "SELECT * FROM clients WHERE id=?", cid);
  if (!c) fail(404, "Espace introuvable.");
  return c;
}
export async function testState(db, u, cid) {
  admin(u);
  await client(db, u, cid);
  const r = await one(db, "SELECT * FROM intake_tests WHERE id=?", cid + ":" + u.id);
  return r
    ? { ...r, answers: parse(r.answers), test: true }
    : { client_id: cid, answers: {}, revision: 0, status: "not_started", test: true };
}
export async function testAction(db, u, b, clear = false) {
  admin(u);
  await client(db, u, b.client_id);
  const key = b.client_id + ":" + u.id;
  if (clear) {
    await run(db, "DELETE FROM intake_tests WHERE id=?", key);
    return testState(db, u, b.client_id);
  }
  const before = await testState(db, u, b.client_id);
  if (b.revision !== before.revision) fail(409, "Ce test a changé. Actualisez avant de continuer.");
  let answers;
  try {
    answers = normalizeIntake(b.answers, !!b.submit);
  } catch (e) {
    fail(400, e.message);
  }
  const r = await run(
    db,
    `INSERT INTO intake_tests VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET answers=excluded.answers,status=excluded.status,revision=excluded.revision,updated=excluded.updated WHERE intake_tests.revision=?`,
    key,
    b.client_id,
    u.id,
    JSON.stringify(answers),
    b.submit ? "submitted" : "draft",
    before.revision + 1,
    now(),
    before.revision,
  );
  if (!r.meta.changes) fail(409, "Ce test a changé. Actualisez.");
  return testState(db, u, b.client_id);
}
export const platforms = ["Instagram", "TikTok", "LinkedIn", "Facebook", "YouTube", "Pinterest", "X", "Autre"];
function validDate(s) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s + "T12:00:00Z")) &&
    new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s
  );
}
export async function publicationState(db, u, cid) {
  await client(db, u, cid);
  const posts = await all(
    db,
    "SELECT * FROM publication_posts WHERE client_id=? AND deleted=0 ORDER BY date,created",
    cid,
  );
  const history = await all(db, "SELECT * FROM reward_events WHERE client_id=? ORDER BY created DESC,id DESC", cid);
  const month = monthInMonterrey(),
    monthly = posts.filter((p) => p.date.startsWith(month));
  return {
    publicationPosts: posts.map((p) => ({
      ...p,
      status: p.published ? "Publié" : p.date < dayInMonterrey() ? "En retard" : "Prévu",
    })),
    rewards: {
      total: history.reduce((s, e) => s + e.delta, 0),
      history,
      month,
      published: monthly.filter((p) => p.published).length,
      planned: monthly.length,
    },
  };
}
export async function publicationSummary(db) {
  return all(
    db,
    `SELECT c.id,c.name,COALESCE((SELECT SUM(delta) FROM reward_events r WHERE r.client_id=c.id),0) AS points,(SELECT COUNT(*) FROM publication_posts p WHERE p.client_id=c.id AND p.deleted=0 AND p.date LIKE ?) AS planned,(SELECT COUNT(*) FROM publication_posts p WHERE p.client_id=c.id AND p.deleted=0 AND p.published=1 AND p.date LIKE ?) AS published FROM clients c ORDER BY c.created`,
    monthInMonterrey() + "%",
    monthInMonterrey() + "%",
  );
}
async function postRow(db, u, pid) {
  const p = await one(db, "SELECT * FROM publication_posts WHERE id=? AND deleted=0", pid);
  if (!p) fail(404, "Post introuvable.");
  await client(db, u, p.client_id);
  return p;
}
async function audit(db, u, cid, action, target) {
  await run(db, "INSERT INTO audit VALUES(?,?,?,?,?,?,?)", id(), cid, u.id, action, target, "{}", now());
}
export async function savePost(db, u, b) {
  admin(u);
  await client(db, u, b.client_id);
  const date = clean(b.date, 10),
    title = clean(b.title, 240),
    caption = clean(b.caption, 10000);
  if (!validDate(date) || !title || !platforms.includes(b.platform))
    fail(400, "Renseignez une date valide, une plateforme et un titre.");
  if (b.file_id) {
    const f = await one(db, "SELECT * FROM files WHERE id=? AND client_id=?", b.file_id, b.client_id);
    if (!f || !f.mime.startsWith("image/")) fail(400, "Choisissez un visuel de cet espace.");
  }
  const pid = b.id || id();
  if (b.id) {
    const p = await postRow(db, u, pid);
    if (p.client_id !== b.client_id) fail(403, "Post hors de cet espace.");
    if (p.version !== b.version) fail(409, "Ce post a changé. Actualisez.");
    const r = await run(
      db,
      "UPDATE publication_posts SET date=?,platform=?,title=?,caption=?,file_id=?,version=version+1,updated=? WHERE id=? AND version=? AND deleted=0",
      date,
      b.platform,
      title,
      caption,
      b.file_id || null,
      now(),
      pid,
      b.version,
    );
    if (!r.meta.changes) fail(409, "Ce post a changé. Actualisez.");
  } else
    await run(
      db,
      "INSERT INTO publication_posts VALUES(?,?,?,?,?,?,?,0,NULL,1,0,?,?)",
      pid,
      b.client_id,
      date,
      b.platform,
      title,
      caption,
      b.file_id || null,
      now(),
      now(),
    );
  await audit(db, u, b.client_id, "publication_post_saved", pid);
  return { id: pid };
}
export async function publishPost(db, u, b, remove = false) {
  if (remove) admin(u);
  const p = await postRow(db, u, b.id),
    c = await client(db, u, p.client_id);
  if (typeof b.published !== "boolean" && !remove) fail(400, "Validation invalide.");
  if (p.version !== b.version) fail(409, "Ce post a changé. Actualisez.");
  const value = remove ? 0 : Number(b.published),
    award = p.points_award ?? parse(c.config).pointsPerPost ?? 10;
  if (value === p.published && !remove) return { ok: true };
  const time = now();
  const statements = [];
  if (value !== p.published)
    statements.push(
      q(
        db,
        `INSERT INTO reward_events(id,client_id,post_id,delta,title,created) SELECT ?,client_id,id,?,title,? FROM publication_posts WHERE id=? AND version=? AND published=? AND deleted=0`,
        p.id + ":" + p.version,
        p.published ? -award : award,
        time,
        p.id,
        p.version,
        p.published,
      ),
    );
  statements.push(
    q(
      db,
      "UPDATE publication_posts SET published=?,points_award=COALESCE(points_award,?),deleted=?,version=version+1,updated=? WHERE id=? AND version=? AND deleted=0",
      value,
      award,
      remove ? 1 : 0,
      time,
      p.id,
      p.version,
    ),
  );
  const results = await db.batch(statements);
  if (!results.at(-1).meta.changes) fail(409, "Ce post a changé. Actualisez.");
  await audit(
    db,
    u,
    p.client_id,
    remove ? "publication_post_deleted" : value ? "publication_confirmed" : "publication_cancelled",
    p.id,
  );
  return { ok: true };
}
export function welcomeEmail(firstName, url, language = "fr") {
  return studioEmail("welcome", language, { firstName, studioUrl: url });
}
export async function sendWelcome(env, cid) {
  await releaseNewAndFlush(env, cid, "welcome");
  return all(env.DB, "SELECT id,recipient,status,error,updated FROM email_outbox WHERE client_id=?", cid);
}
export async function queueApproval(db, u, c, b, old) {
  const time = now(),
    profile = await one(db, "SELECT * FROM registration_profiles WHERE client_id=?", c.id),
    users = await all(db, "SELECT * FROM accounts WHERE client_id=? AND role='client' AND active=1", c.id);
  const marker = id();
  const statements = [
    q(
      db,
      `UPDATE client_intakes SET status='reviewed',revision=revision+1,reviewed_by=?,reviewed_at=?,review_note=?,updated=? WHERE client_id=? AND revision=? AND status=?`,
      u.id,
      time,
      marker,
      time,
      c.id,
      b.revision,
      old.status,
    ),
  ];
  for (const account of users) {
    const language = parse(c.config).language === "es" ? "es" : "fr";
    statements.push(
      q(db, "INSERT OR IGNORE INTO studio_mail_members VALUES(?,?,?,0,'pending',?)", account.id, c.id, language, time),
    );
    statements.push(
      mailInsert(db, {
        id: "welcome:" + c.id + ":" + account.id,
        cid: c.id,
        account: account.id,
        email: account.email,
        firstName: profile?.email === account.email ? profile.first_name : account.email.split("@")[0],
        kind: "welcome",
        language,
        condition: marker,
        time,
      }),
    );
  }
  statements.push(
    q(
      db,
      "UPDATE client_intakes SET review_note=? WHERE client_id=? AND review_note=?",
      clean(b.note, 1500) || null,
      c.id,
      marker,
    ),
  );
  const r = await db.batch(statements);
  if (!r[0].meta.changes) fail(409, "Le questionnaire a changé. Actualisez avant de le traiter.");
}
