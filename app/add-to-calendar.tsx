"use client";
// Ajout d'un contenu au calendrier du client : bouton réutilisable (après un modèle, une vidéo…) et fenêtre complète du calendrier.
import { useEffect, useState } from "react";
import { CalendarPlus, Check, FileText, Image as ImageIcon, Video, X } from "lucide-react";
import { useL, useLang, dateLocale } from "../lib/i18n";
type Row = Record<string, any>;

/** Date du jour dans le fuseau du navigateur (AAAA-MM-JJ). */
export function localToday(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export async function calendarApi(path: string, b: Row) {
  const r = await fetch("/api/studio/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Studio-Request": "1" },
    body: JSON.stringify(b),
  });
  const d: any = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(d.error || "Erreur");
  return d;
}
/** Signal envoyé après chaque ajout : le studio peut s'y abonner pour rafraîchir le calendrier. */
export const CALENDAR_CHANGED = "louvet:calendar-changed";
const notify = () => {
  try {
    window.dispatchEvent(new Event(CALENDAR_CHANGED));
  } catch {}
};

/**
 * Bouton « Ajouter à mon calendrier ».
 * kind "image" ou "design" : id du fichier (ou du modèle enregistré, même id) ;
 * kind "video" : id du montage (video_edits) ou de son fichier final.
 */
export function AddToCalendarButton({
  kind,
  id,
  label,
}: {
  kind: "image" | "design" | "video";
  id: string;
  label?: string;
}) {
  const L = useL(),
    loc = dateLocale(useLang());
  const [open, setOpen] = useState(false),
    [date, setDate] = useState(localToday(1)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    try {
      await calendarApi("calendar-entry-save", { kind, ref_id: id, date });
      setDone(date);
      setOpen(false);
      notify();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <p className="add-cal-done" role="status">
        <Check size={15} />{" "}
        {L("Ajouté à votre calendrier le", "Agregado a tu calendario el", "Added to your calendar on")}{" "}
        {new Date(done + "T12:00:00").toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" })}
      </p>
    );
  return (
    <div className="add-cal">
      {!open ? (
        <button type="button" className="button secondary" onClick={() => setOpen(true)}>
          <CalendarPlus size={16} /> {label || L("Ajouter à mon calendrier", "Agregar a mi calendario", "Add to my calendar")}
        </button>
      ) : (
        <div className="add-cal-pop">
          <label className="field">
            <span>{L("Quel jour le publier ?", "¿Qué día lo publicas?", "Which day will you post it?")}</span>
            <input type="date" value={date} min={localToday(-365)} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div className="add-cal-actions">
            <button type="button" className="button primary" disabled={busy || !date} onClick={save}>
              {busy ? L("Ajout…", "Agregando…", "Adding…") : L("Ajouter", "Agregar", "Add")}
            </button>
            <button type="button" className="text-link" disabled={busy} onClick={() => setOpen(false)}>
              {L("Annuler", "Cancelar", "Cancel")}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type Tab = "image" | "video" | "note";
/** Fenêtre « Ajouter un contenu » du calendrier : un visuel, une vidéo ou une note, puis la date. */
export function AddContentModal({
  data,
  clientId,
  date: initialDate,
  entry,
  onClose,
  onSaved,
}: {
  data: Row;
  clientId: string;
  date?: string;
  entry?: Row | null;
  onClose: () => void;
  onSaved: () => Promise<any> | void;
}) {
  const L = useL();
  const files: Row[] = data.files || [];
  const images = files.filter((f) => ["generated", "design"].includes(f.purpose) && String(f.mime).startsWith("image/")),
    videos = files.filter((f) => ["video_result", "design_video"].includes(f.purpose) && String(f.mime).startsWith("video/"));
  const editing = !!entry?.id;
  const [tab, setTab] = useState<Tab>(entry ? (entry.kind === "note" ? "note" : entry.media === "video" ? "video" : "image") : images.length ? "image" : videos.length ? "video" : "note"),
    [picked, setPicked] = useState<Row | null>(null),
    [date, setDate] = useState(entry?.date || initialDate || localToday(1)),
    [title, setTitle] = useState(entry?.title || ""),
    [caption, setCaption] = useState(entry?.caption || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [busy, onClose]);
  const list = tab === "image" ? images : tab === "video" ? videos : [];
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (editing) await calendarApi("calendar-entry-save", { id: entry!.id, date, title, caption });
      else
        await calendarApi("calendar-entry-save", {
          client_id: clientId,
          kind: tab === "note" ? "note" : picked?.purpose === "design" ? "design" : tab,
          ref_id: picked?.id,
          date,
          title,
          caption,
        });
      notify();
      await onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const canSave = !!date && (editing || (tab === "note" ? !!(title.trim() || caption.trim()) : !!picked));
  return (
    <div className="overlay" onClick={() => !busy && onClose()}>
      <section
        className="modal calendar-modal add-content-modal"
        role="dialog"
        aria-modal="true"
        aria-label={L("Ajouter un contenu", "Agregar un contenido", "Add content")}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="icon-button modal-x" disabled={busy} aria-label={L("Fermer", "Cerrar", "Close")} onClick={onClose}>
          <X />
        </button>
        <h2>
          {editing
            ? L("Modifier ou déplacer", "Editar o mover", "Edit or move")
            : L("Ajouter un contenu", "Agregar un contenido", "Add content")}
        </h2>
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        <form onSubmit={save}>
          {!editing && (
            <>
              <div className="add-tabs" role="tablist">
                {(
                  [
                    ["image", <ImageIcon key="i" size={16} />, L("Un visuel", "Una imagen", "A visual")],
                    ["video", <Video key="v" size={16} />, L("Une vidéo", "Un video", "A video")],
                    ["note", <FileText key="n" size={16} />, L("Une note", "Una nota", "A note")],
                  ] as [Tab, React.ReactNode, string][]
                ).map(([k, icon, label]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={tab === k}
                    className={tab === k ? "active" : ""}
                    onClick={() => {
                      setTab(k);
                      setPicked(null);
                    }}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
              {tab !== "note" &&
                (list.length ? (
                  <div className="add-pick-grid">
                    {list.map((f) => (
                      <button
                        type="button"
                        key={f.id}
                        className={"add-pick" + (picked?.id === f.id ? " picked" : "")}
                        aria-pressed={picked?.id === f.id}
                        aria-label={f.name}
                        onClick={() => setPicked(f)}
                      >
                        {tab === "video" ? (
                          <video src={"/api/studio/file/" + f.id + "#t=0.5"} muted playsInline preload="metadata" />
                        ) : (
                          <img loading="lazy" src={"/api/studio/file/" + f.id} alt="" />
                        )}
                        {picked?.id === f.id && (
                          <span className="add-pick-check">
                            <Check size={14} />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="empty-small">
                    {tab === "image"
                      ? L(
                          "Vous n’avez pas encore de visuel. Créez-en un, ou ajoutez une note.",
                          "Aún no tienes imágenes. Crea una o agrega una nota.",
                          "You don’t have any visuals yet. Create one, or add a note.",
                        )
                      : L(
                          "Vous n’avez pas encore de vidéo terminée. Ajoutez une note en attendant.",
                          "Aún no tienes videos terminados. Agrega una nota mientras tanto.",
                          "You don’t have a finished video yet. Add a note in the meantime.",
                        )}
                  </p>
                ))}
            </>
          )}
          <label className="field">
            <span>{L("Date de publication", "Fecha de publicación", "Posting date")}</span>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>
              {tab === "note" ? L("Titre", "Título", "Title") : L("Titre · facultatif", "Título · opcional", "Title · optional")}
            </span>
            <input
              maxLength={160}
              value={title}
              placeholder={L("ex. : Story des coulisses", "ej.: Story detrás de cámaras", "e.g. Behind-the-scenes story")}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="field">
            <span>{L("Texte à publier · facultatif", "Texto para publicar · opcional", "Text to post · optional")}</span>
            <textarea rows={4} maxLength={5000} value={caption} onChange={(e) => setCaption(e.target.value)} />
          </label>
          <button className="button primary full" type="submit" disabled={busy || !canSave}>
            {busy
              ? L("Enregistrement…", "Guardando…", "Saving…")
              : editing
                ? L("Enregistrer", "Guardar", "Save")
                : L("Ajouter au calendrier", "Agregar al calendario", "Add to calendar")}
          </button>
        </form>
      </section>
    </div>
  );
}
