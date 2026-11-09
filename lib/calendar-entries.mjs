// Contenus que le client ajoute lui-même à son calendrier : un visuel, un modèle, une vidéo ou une simple note.
// Ils vivent à côté des posts préparés par l'agence (publication_posts), sans points : seuls les posts de l'agence en rapportent.
// Le client ne modifie et ne supprime que ses propres ajouts ; l'agence les voit et peut les retirer.
const q = (db, s, ...a) => db.prepare(s).bind(...a),
  first = (db, s, ...a) => q(db, s, ...a).first(),
  all = async (db, s, ...a) => (await q(db, s, ...a).all()).results,
  run = (db, s, ...a) => q(db, s, ...a).run();
const now = () => new Date().toISOString();
function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
const clean = (v, n) =>
  String(v ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g, "")
    .trim()
    .slice(0, n);

export const ENTRY_KINDS = ["note", "image", "design", "video"];
export const ENTRY_MAX_ACTIVE = 300;
export const ENTRY_PER_HOUR = 60;
const IMAGE_PURPOSES = ["generated", "design"];
const VIDEO_PURPOSES = ["video_result", "design_video"];

export function validEntryDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return false;
  const t = Date.parse(s + "T12:00:00Z");
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== s) return false;
  // Une fenêtre raisonnable : un an en arrière, deux ans en avant.
  return t > Date.now() - 366 * 86400000 && t < Date.now() + 2 * 366 * 86400000;
}

async function space(db, user, cid) {
  if (!cid || (user.role !== "agency" && user.client_id !== cid)) fail(403, "Cet espace ne vous est pas accessible.");
  if (await first(db, "SELECT client_id FROM client_deletions WHERE client_id=?", cid))
    fail(410, "Cet espace est en cours de suppression.");
  const c = await first(db, "SELECT id FROM clients WHERE id=?", cid);
  if (!c) fail(404, "Espace introuvable.");
  return c;
}
async function entryRow(db, user, id) {
  const e = await first(db, "SELECT * FROM calendar_entries WHERE id=?", clean(id, 100));
  if (!e) fail(404, "Contenu introuvable dans votre calendrier.");
  await space(db, user, e.client_id);
  return e;
}

/** Trouve le fichier d'un visuel, d'un modèle ou d'une vidéo de cet espace. Pour une vidéo, accepte l'id du montage ou du fichier. */
async function resolveFile(db, cid, kind, ref) {
  if (kind === "note") return null;
  const id = clean(ref, 100);
  if (!id) fail(400, "Choisissez le visuel ou la vidéo à ajouter.");
  let f = null;
  if (kind === "video") {
    const edit = await first(db, "SELECT client_id,output_file FROM video_edits WHERE id=?", id);
    if (edit) {
      if (edit.client_id !== cid) fail(403, "Ce contenu n’appartient pas à cet espace.");
      if (!edit.output_file) fail(409, "Cette vidéo n’est pas encore prête.");
      f = await first(db, "SELECT id,client_id,purpose,mime FROM files WHERE id=?", edit.output_file);
    }
  }
  if (!f) f = await first(db, "SELECT id,client_id,purpose,mime FROM files WHERE id=?", id);
  if (!f) fail(404, "Contenu introuvable.");
  if (f.client_id !== cid) fail(403, "Ce contenu n’appartient pas à cet espace.");
  const ok =
    kind === "video"
      ? VIDEO_PURPOSES.includes(f.purpose) && String(f.mime).startsWith("video/")
      : IMAGE_PURPOSES.includes(f.purpose) && String(f.mime).startsWith("image/");
  if (!ok) fail(400, "Choisissez un visuel ou une vidéo de « Mes visuels » ou « Mes vidéos ».");
  return f.id;
}

export async function calendarEntrySave(db, user, b) {
  if (user.role !== "client") fail(403, "Ces ajouts sont réservés au client. L’agence prépare ses posts avec « Nouveau post ».");
  const date = clean(b.date, 10),
    title = clean(b.title, 160),
    caption = clean(b.caption, 5000);
  if (!validEntryDate(date)) fail(400, "Choisissez une date valide.");
  if (b.id) {
    const e = await entryRow(db, user, b.id);
    if (e.client_id !== user.client_id) fail(403, "Cet espace ne vous est pas accessible.");
    if (e.kind === "note" && !title && !caption) fail(400, "Écrivez un titre ou un texte.");
    await run(
      db,
      "UPDATE calendar_entries SET date=?,title=?,caption=?,updated=? WHERE id=?",
      date,
      title,
      caption,
      now(),
      e.id,
    );
    return { ok: true, id: e.id };
  }
  const cid = clean(b.client_id || user.client_id, 100);
  await space(db, user, cid);
  const kind = ENTRY_KINDS.includes(b.kind) ? b.kind : fail(400, "Type de contenu invalide.");
  if (kind === "note" && !title && !caption) fail(400, "Écrivez un titre ou un texte.");
  const fileId = await resolveFile(db, cid, kind, b.ref_id ?? b.file_id);
  // Limites (total et par heure) vérifiées dans l’insertion elle-même : atomique même en parallèle.
  const id = crypto.randomUUID(),
    t = now();
  const added = await run(
    db,
    "INSERT INTO calendar_entries(id,client_id,user_id,date,kind,file_id,title,caption,done,created,updated) SELECT ?,?,?,?,?,?,?,?,0,?,? WHERE (SELECT COUNT(*) FROM calendar_entries WHERE client_id=?)<? AND (SELECT COUNT(*) FROM calendar_entries WHERE client_id=? AND created>?)<?",
    id,
    cid,
    user.id,
    date,
    kind,
    fileId,
    title,
    caption,
    t,
    t,
    cid,
    ENTRY_MAX_ACTIVE,
    cid,
    new Date(Date.now() - 3600000).toISOString(),
    ENTRY_PER_HOUR,
  );
  if (!added.meta.changes) {
    const active = await first(db, "SELECT COUNT(*) AS n FROM calendar_entries WHERE client_id=?", cid);
    if (Number(active?.n || 0) >= ENTRY_MAX_ACTIVE)
      fail(409, "Votre calendrier est plein. Retirez d’anciens contenus avant d’en ajouter.");
    fail(429, "Beaucoup d’ajouts en peu de temps. Réessayez dans un moment.");
  }
  await run(
    db,
    "INSERT INTO audit VALUES(?,?,?,?,?,?,?)",
    crypto.randomUUID(),
    cid,
    user.id,
    "calendar_entry_added",
    id,
    JSON.stringify({ kind, date }),
    t,
  );
  return { ok: true, id };
}

export async function calendarEntryDone(db, user, b) {
  const e = await entryRow(db, user, b.id);
  if (user.role !== "client") fail(403, "Seul le client indique ce qu’il a publié.");
  if (typeof b.done !== "boolean") fail(400, "Validation invalide.");
  await run(db, "UPDATE calendar_entries SET done=?,updated=? WHERE id=?", b.done ? 1 : 0, now(), e.id);
  return { ok: true };
}

export async function calendarEntryDelete(db, user, b) {
  const e = await entryRow(db, user, b.id);
  await run(db, "DELETE FROM calendar_entries WHERE id=?", e.id);
  await run(
    db,
    "INSERT INTO audit VALUES(?,?,?,?,?,?,?)",
    crypto.randomUUID(),
    e.client_id,
    user.id,
    "calendar_entry_deleted",
    e.id,
    "{}",
    now(),
  );
  return { ok: true };
}

export async function calendarEntriesState(db, user, cid) {
  if (!cid || cid === "__none__") return { calendarEntries: [] };
  if (user.role !== "agency" && user.client_id !== cid) return { calendarEntries: [] };
  const rows = await all(
    db,
    "SELECT e.id,e.date,e.kind,e.file_id,e.title,e.caption,e.done,e.created,f.mime,f.name AS file_name FROM calendar_entries e LEFT JOIN files f ON f.id=e.file_id WHERE e.client_id=? ORDER BY e.date,e.created LIMIT 400",
    cid,
  );
  return {
    calendarEntries: rows.map((r) => ({
      ...r,
      done: !!r.done,
      media: r.mime ? (String(r.mime).startsWith("video/") ? "video" : "image") : null,
    })),
  };
}
