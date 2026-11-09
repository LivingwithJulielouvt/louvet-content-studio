// « Versions à tester » côté serveur : séries de versions d'une vidéo (créatrices uniquement), résultats saisis
// par la créatrice et choix de la gagnante. Le rendu se fait dans le navigateur ; chaque version rendue est
// envoyée par le transfert direct (type « test-version ») et rattachée ici.
import { isCreator } from "./workspaces.mjs";
import {
  VERSION_COUNTS,
  buildRecipes,
  sanitizeAxes,
  pickRecipe,
  sanitizeMetrics,
  scoreVersions,
  fillHooks,
} from "./test-versions.mjs";

const q = (db, s, ...a) => db.prepare(s).bind(...a),
  first = (db, s, ...a) => q(db, s, ...a).first(),
  all = async (db, s, ...a) => (await q(db, s, ...a).all()).results,
  run = (db, s, ...a) => q(db, s, ...a).run();
const now = () => new Date().toISOString();
const parse = (v, d = {}) => {
  try {
    return v ? JSON.parse(v) : d;
  } catch {
    return d;
  }
};
function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
const clean = (v, n) =>
  String(v ?? "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .trim()
    .slice(0, n);

export const BATCHES_PER_DAY = 5;
export const BATCHES_MAX = 60;

async function creatorSpace(db, user, cid) {
  const id = clean(cid, 100);
  if (!id || (user.role !== "agency" && user.client_id !== id)) fail(403, "Cet espace ne vous est pas accessible.");
  if (await first(db, "SELECT client_id FROM client_deletions WHERE client_id=?", id)) fail(410, "Cet espace est en cours de suppression.");
  const c = await first(db, "SELECT id,config,active FROM clients WHERE id=?", id);
  if (!c) fail(404, "Espace introuvable.");
  if (!isCreator(parse(c.config))) fail(403, "Les versions à tester sont réservées aux créatrices de contenu.");
  if (!Number(c.active)) fail(403, "Cet espace est suspendu.");
  return c;
}
async function batchRow(db, user, id) {
  const b = await first(db, "SELECT * FROM test_batches WHERE id=?", clean(id, 100));
  if (!b) fail(404, "Série de versions introuvable.");
  await creatorSpace(db, user, b.client_id);
  return b;
}
async function versionRow(db, user, id) {
  const v = await first(db, "SELECT * FROM test_versions WHERE id=?", clean(id, 100));
  if (!v) fail(404, "Version introuvable.");
  const b = await batchRow(db, user, v.batch_id);
  return { v, b };
}

/** Source de la série : une vidéo de « Mes vidéos » (ses rushes) ou une vidéo envoyée, de cet espace. */
async function resolveSource(db, cid, src = {}) {
  if (src.edit_id) {
    const e = await first(db, "SELECT id,client_id,clips FROM video_edits WHERE id=?", clean(src.edit_id, 100));
    if (!e) fail(404, "Vidéo introuvable.");
    if (e.client_id !== cid) fail(403, "Cette vidéo n’appartient pas à cet espace.");
    const clips = parse(e.clips, []);
    if (!clips.length) fail(400, "Cette vidéo n’a pas encore de rushes.");
    for (const id of clips) {
      const f = await first(db, "SELECT client_id,purpose FROM files WHERE id=?", id);
      if (!f || f.client_id !== cid || f.purpose !== "video_original") fail(400, "Un rush de cette vidéo n’est plus disponible.");
    }
    return { edit_id: e.id, file_id: null, clips };
  }
  const fid = clean(src.file_id, 100);
  if (!fid) fail(400, "Choisissez la vidéo à décliner.");
  const f = await first(db, "SELECT id,client_id,purpose,mime FROM files WHERE id=?", fid);
  if (!f) fail(404, "Vidéo introuvable.");
  if (f.client_id !== cid) fail(403, "Cette vidéo n’appartient pas à cet espace.");
  if (!["video_original", "video_result"].includes(f.purpose) || !String(f.mime).startsWith("video/"))
    fail(400, "Choisissez une vidéo de « Mes vidéos ».");
  return { edit_id: null, file_id: f.id, clips: [f.id] };
}

export async function testBatchCreate(db, user, b) {
  const c = await creatorSpace(db, user, b.client_id);
  const cfg = parse(c.config);
  const count = VERSION_COUNTS.includes(Number(b.count)) ? Number(b.count) : fail(400, "Choisissez 3, 5 ou 10 versions.");
  const source = await resolveSource(db, c.id, b.source || {});
  // Musiques : seulement celles de cet espace.
  const music = [];
  for (const id of (Array.isArray(b.music) ? b.music : []).slice(0, 4)) {
    const f = await first(db, "SELECT client_id,purpose FROM files WHERE id=?", clean(id, 100));
    if (!f || f.client_id !== c.id || f.purpose !== "video_music") fail(403, "Cette musique n’appartient pas à cet espace.");
    music.push(clean(id, 100));
  }
  const lang = ["fr", "es", "en"].includes(b.lang) ? b.lang : cfg.language || "fr";
  const subject = clean(b.subject, 60) || clean(cfg.creatorStrategy?.pillars?.[0], 60);
  const hooks = fillHooks(Array.isArray(b.hooks) ? b.hooks.slice(0, 20) : [], Math.max(count, 3), { lang, subject });
  const ctx = { hooks, music };
  let seed = null,
    parent = null;
  if (b.parent_version_id) {
    const { v, b: pb } = await versionRow(db, user, b.parent_version_id);
    if (pb.client_id !== c.id) fail(403, "Cette version n’appartient pas à cet espace.");
    seed = parse(v.recipe);
    parent = pb.id;
    if (seed.hook && !hooks.includes(seed.hook)) hooks.unshift(seed.hook);
  }
  const axes = sanitizeAxes(b.axes, ctx);
  if (!axes.length) fail(400, "Choisissez au moins un réglage à faire varier.");
  const recipes = buildRecipes(count, axes, ctx, seed);
  if (recipes.length < 2) fail(400, "Ces réglages ne permettent pas plusieurs versions différentes. Cochez un autre réglage.");
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const id = crypto.randomUUID(),
    t = now(),
    title = clean(b.title, 80);
  const stmts = [
    q(
      db,
      // Limites (par jour et au total) vérifiées dans l’insertion : atomique même en parallèle.
      "INSERT INTO test_batches(id,client_id,user_id,source_edit_id,source_file_id,count,axes,context,title,status,parent_batch_id,created,updated) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM test_batches WHERE client_id=? AND created>?)<? AND (SELECT COUNT(*) FROM test_batches WHERE client_id=?)<?",
      id,
      c.id,
      user.id,
      source.edit_id,
      source.file_id,
      recipes.length,
      JSON.stringify(axes),
      JSON.stringify({ hooks, music, lang, subject, clips: source.clips }),
      title,
      "rendering",
      parent,
      t,
      t,
      c.id,
      dayAgo,
      BATCHES_PER_DAY,
      c.id,
      BATCHES_MAX,
    ),
  ];
  const versions = recipes.map((r) => ({ id: crypto.randomUUID(), label: r.label, recipe: pickRecipe(r, ctx) }));
  for (const v of versions)
    stmts.push(
      q(
        db,
        "INSERT INTO test_versions(id,batch_id,client_id,label,recipe,file_id,posted_at,views,likes,saves,shares,note,winner,created,updated) SELECT ?,?,?,?,?,NULL,NULL,NULL,NULL,NULL,NULL,'',0,?,? WHERE EXISTS(SELECT 1 FROM test_batches WHERE id=?)",
        v.id,
        id,
        c.id,
        v.label,
        JSON.stringify(v.recipe),
        t,
        t,
        id,
      ),
    );
  const done = await db.batch(stmts);
  if (!done[0].meta.changes) {
    const today = await first(db, "SELECT COUNT(*) AS n FROM test_batches WHERE client_id=? AND created>?", c.id, dayAgo);
    if (Number(today?.n || 0) >= BATCHES_PER_DAY)
      fail(429, "Vous avez créé 5 séries aujourd’hui. Revenez demain pour en créer une nouvelle.");
    fail(409, "Vous avez beaucoup de séries enregistrées. Supprimez les plus anciennes avant d’en créer une nouvelle.");
  }
  return { ok: true, id, versions, axes, hooks, music, clips: source.clips };
}

/** Avant l'envoi d'une version rendue : la version doit appartenir à cet espace et attendre son fichier. */
export async function assertVersionUpload(db, user, cid, versionId) {
  const { v, b } = await versionRow(db, user, versionId);
  if (b.client_id !== cid || v.client_id !== cid) fail(403, "Espace incorrect.");
  if (b.status !== "rendering") fail(409, "Cette série est terminée.");
  if (v.file_id) fail(409, "Cette version est déjà enregistrée.");
  return { v, b };
}
/** Après l'envoi : rattache le fichier ; la série est « prête » quand toutes ses versions ont un fichier. */
export async function attachVersionFile(db, versionId, fileId) {
  const t = now();
  const changed = await run(db, "UPDATE test_versions SET file_id=?,updated=? WHERE id=? AND file_id IS NULL", fileId, t, versionId);
  if (!changed.meta.changes) fail(409, "Cette version est déjà enregistrée.");
  const v = await first(db, "SELECT batch_id FROM test_versions WHERE id=?", versionId);
  const left = await first(db, "SELECT COUNT(*) AS n FROM test_versions WHERE batch_id=? AND file_id IS NULL", v.batch_id);
  if (!Number(left?.n || 0)) await run(db, "UPDATE test_batches SET status='ready',updated=? WHERE id=? AND status='rendering'", t, v.batch_id);
  else await run(db, "UPDATE test_batches SET updated=? WHERE id=?", t, v.batch_id);
}

/** Arrêt du rendu : les versions déjà rendues restent ; les autres sont retirées. */
export async function testBatchStop(db, user, b) {
  const batch = await batchRow(db, user, b.batch_id);
  if (batch.status !== "rendering") return { ok: true, status: batch.status };
  const t = now();
  await run(db, "DELETE FROM test_versions WHERE batch_id=? AND file_id IS NULL", batch.id);
  const left = await first(db, "SELECT COUNT(*) AS n FROM test_versions WHERE batch_id=?", batch.id);
  const status = Number(left?.n || 0) ? "ready" : "cancelled";
  if (status === "cancelled") await run(db, "DELETE FROM test_batches WHERE id=?", batch.id);
  else await run(db, "UPDATE test_batches SET status=?,count=?,updated=? WHERE id=?", status, Number(left.n), t, batch.id);
  return { ok: true, status };
}

export async function testVersionMetrics(db, user, b) {
  const { v, b: batch } = await versionRow(db, user, b.version_id);
  if (user.role === "agency") fail(403, "Seule la créatrice saisit ses statistiques.");
  if (!v.file_id) fail(409, "Cette version n’est pas encore prête.");
  let m;
  try {
    m = sanitizeMetrics(b);
  } catch (e) {
    fail(e.status || 400, e.message);
  }
  const t = now();
  await run(
    db,
    "UPDATE test_versions SET views=?,likes=?,saves=?,shares=?,note=?,posted_at=COALESCE(posted_at,?),updated=? WHERE id=?",
    m.views,
    m.likes,
    m.saves,
    m.shares,
    clean(b.note, 300),
    t,
    t,
    v.id,
  );
  await run(db, "UPDATE test_batches SET updated=? WHERE id=?", t, batch.id);
  return { ok: true };
}

export async function testVersionWinner(db, user, b) {
  const { v, b: batch } = await versionRow(db, user, b.version_id);
  if (user.role === "agency") fail(403, "Seule la créatrice choisit sa version gagnante.");
  if (!v.file_id) fail(409, "Cette version n’est pas encore prête.");
  const measured = await first(db, "SELECT COUNT(*) AS n FROM test_versions WHERE batch_id=? AND views IS NOT NULL", batch.id);
  if (Number(measured?.n || 0) < 2) fail(400, "Notez les vues d’au moins deux versions pour choisir la gagnante.");
  const t = now();
  await db.batch([
    q(db, "UPDATE test_versions SET winner=0,updated=? WHERE batch_id=?", t, batch.id),
    q(db, "UPDATE test_versions SET winner=1,updated=? WHERE id=?", t, v.id),
    q(db, "UPDATE test_batches SET updated=? WHERE id=?", t, batch.id),
  ]);
  return { ok: true };
}

/** Supprime une série et ses fichiers (sauf si une version est prévue dans le calendrier). */
export async function testBatchDelete(env, user, b) {
  const db = env.DB,
    batch = await batchRow(db, user, b.batch_id);
  const files = (await all(db, "SELECT file_id FROM test_versions WHERE batch_id=? AND file_id IS NOT NULL", batch.id)).map((r) => r.file_id);
  for (const id of files) {
    const used = await first(db, "SELECT COUNT(*) AS n FROM calendar_entries WHERE file_id=?", id);
    if (Number(used?.n || 0)) fail(409, "Une version de cette série est prévue dans votre calendrier. Retirez-la du calendrier d’abord.");
  }
  const keys = [];
  for (const id of files) {
    const f = await first(db, "SELECT key FROM files WHERE id=? AND client_id=?", id, batch.client_id);
    if (f?.key) keys.push(f.key);
  }
  await db.batch([
    q(db, "DELETE FROM test_versions WHERE batch_id=?", batch.id),
    q(db, "DELETE FROM test_batches WHERE id=?", batch.id),
    ...files.map((id) => q(db, "DELETE FROM files WHERE id=? AND client_id=?", id, batch.client_id)),
  ]);
  for (const k of keys) await env.BUCKET.delete(k).catch(() => {});
  return { ok: true };
}

/** État : séries de l'espace sélectionné (créatrice), avec score et gagnante calculés. */
export async function testBatchesState(db, user, client) {
  if (!client || !isCreator(parse(client.config))) return { testBatches: [] };
  if (user.role !== "agency" && user.client_id !== client.id) return { testBatches: [] };
  // Un rendu abandonné (page fermée) depuis plus de 2 heures est clos avec les versions déjà rendues.
  const stale = await all(
    db,
    "SELECT id FROM test_batches WHERE client_id=? AND status='rendering' AND updated<?",
    client.id,
    new Date(Date.now() - 2 * 3600000).toISOString(),
  );
  for (const s of stale) await testBatchStop(db, { role: "agency" }, { batch_id: s.id }).catch(() => {});
  const batches = await all(db, "SELECT * FROM test_batches WHERE client_id=? ORDER BY created DESC LIMIT 30", client.id);
  const out = [];
  for (const bt of batches) {
    const vs = await all(db, "SELECT * FROM test_versions WHERE batch_id=? ORDER BY label", bt.id);
    const list = vs.map((v) => ({
      id: v.id,
      label: v.label,
      recipe: parse(v.recipe),
      file_id: v.file_id,
      views: v.views === null ? null : Number(v.views),
      likes: v.likes === null ? null : Number(v.likes),
      saves: v.saves === null ? null : Number(v.saves),
      shares: v.shares === null ? null : Number(v.shares),
      note: v.note || "",
      winner: !!Number(v.winner),
      posted_at: v.posted_at,
    }));
    const scored = scoreVersions(list);
    const ctx = parse(bt.context);
    out.push({
      id: bt.id,
      title: bt.title,
      status: bt.status,
      axes: parse(bt.axes, []),
      music: ctx.music || [],
      clips: ctx.clips || [],
      source_edit_id: bt.source_edit_id,
      source_file_id: bt.source_file_id,
      parent_batch_id: bt.parent_batch_id,
      created: bt.created,
      versions: scored.versions,
      suggested: scored.winner,
      tie: scored.tie,
      measured: scored.measured,
    });
  }
  return { testBatches: out };
}
