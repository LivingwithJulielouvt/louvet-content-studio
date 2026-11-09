"use client";
import "./calendar.css";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Check, Star, X, Copy, Download, Video } from "lucide-react";
import { useL, useLang, dateLocale, pick, type Lang } from "../lib/i18n";
import { AddContentModal, CALENDAR_CHANGED, localToday } from "./add-to-calendar";
const platforms = ["Instagram", "TikTok", "LinkedIn", "Facebook", "YouTube", "Pinterest", "X", "Autre"];
type Row = Record<string, any>;
/** Un élément du calendrier : post préparé par l'agence ou contenu ajouté par le client. */
type Item = {
  src: "agency" | "own";
  id: string;
  date: string;
  title: string;
  caption: string;
  file_id: string | null;
  media: "image" | "video" | null;
  done: boolean;
  late: boolean;
  platform?: string;
  raw: Row;
};
const statusLabel = (it: Item, lang: Lang) =>
  it.done
    ? pick(lang, "Publié", "Publicado", "Posted")
    : it.late
      ? pick(lang, "À publier", "Por publicar", "To post")
      : pick(lang, "Prévu", "Programado", "Scheduled");
const dateKey = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
function add(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function monday(d: Date) {
  return add(d, -((d.getUTCDay() + 6) % 7));
}
const shiftKey = (k: string, n: number) => dateKey(add(new Date(k + "T12:00:00Z"), n));
async function api(path: string, b: Row) {
  const r = await fetch("/api/studio/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Studio-Request": "1" },
    body: JSON.stringify(b),
  });
  const d: any = await r.json();
  if (!r.ok) throw Error(d.error);
  return d;
}
/** « de » ou « d’ » devant le mois en français (avril, août, octobre). */
export function monthWithDe(month: string, lang: Lang) {
  if (lang !== "fr") return month;
  return /^[aeiouyéèâêîôûh]/i.test(month) ? "d’" + month : "de " + month;
}
async function copyText(t: string) {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    try {
      const a = document.createElement("textarea");
      a.value = t;
      a.setAttribute("readonly", "");
      a.style.position = "fixed";
      a.style.opacity = "0";
      document.body.appendChild(a);
      a.select();
      const ok = document.execCommand("copy");
      a.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
function CopyButton({ text, primary = false, small = false }: { text: string; primary?: boolean; small?: boolean }) {
  const L = useL();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={(small ? "cal-copy-small " : "button full ") + (primary ? "primary" : "secondary")}
      onClick={async (e) => {
        e.stopPropagation();
        if (await copyText(text)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {copied ? L("Texte copié", "Texto copiado", "Text copied") : small ? L("Copier", "Copiar", "Copy") : L("Copier le texte", "Copiar el texto", "Copy the text")}
    </button>
  );
}
export function Rewards({ rewards }: { rewards: Row }) {
  const [open, setOpen] = useState(false);
  const L = useL(),
    lang = useLang(),
    loc = dateLocale(lang);
  if (!rewards) return null;
  const month = new Date(rewards.month + "-01T12:00:00Z").toLocaleDateString(loc, { month: "long", timeZone: "UTC" });
  return (
    <section className="panel reward-panel reward-line">
      <div className="reward-line-row">
        <Star size={18} />
        <b>
          {rewards.total} {L("points", "puntos", "points")}
        </b>
        <span>·</span>
        <span>
          {rewards.published}/{rewards.planned}{" "}
          {L("publiés ce mois-ci", "publicados este mes", "posted this month")}
        </span>
        <button className="text-link" onClick={() => setOpen(!open)}>
          {open ? L("Masquer l’historique", "Ocultar el historial", "Hide history") : L("Historique", "Historial", "History")}
        </button>
      </div>
      <progress
        max={rewards.planned || 1}
        value={rewards.published}
        aria-label={L(`Progression ${monthWithDe(month, lang)}`, `Progreso de ${month}`, `Progress for ${month}`)}
      />
      {open && (
        <div className="reward-history">
          {rewards.history.length ? (
            rewards.history.map((e: Row) => (
              <div key={e.id}>
                <span>
                  <b>{e.title}</b>
                  <small>
                    {new Date(e.created).toLocaleString(loc, { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                    {e.delta < 0
                      ? L("Validation annulée", "Confirmación cancelada", "Confirmation undone")
                      : L("Publication confirmée", "Publicación confirmada", "Post confirmed")}
                  </small>
                </span>
                <b>
                  {e.delta > 0 ? "+" : ""}
                  {e.delta}
                </b>
              </div>
            ))
          ) : (
            <p className="muted">
              {L(
                "Vos points apparaîtront après votre première publication confirmée.",
                "Tus puntos aparecerán después de tu primera publicación confirmada.",
                "Your points will show up after your first confirmed post.",
              )}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(max-width: 599px)");
    const f = () => setNarrow(m.matches);
    f();
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return narrow;
}
function Thumb({ it }: { it: Item }) {
  if (!it.file_id || !it.media) return null;
  return it.media === "video" ? (
    <span className="cal-thumb video">
      <video src={"/api/studio/file/" + it.file_id + "#t=0.5"} muted playsInline preload="metadata" />
      <Video size={14} />
    </span>
  ) : (
    <span className="cal-thumb">
      <img loading="lazy" src={"/api/studio/file/" + it.file_id} alt="" />
    </span>
  );
}
export default function PublicationCalendar({
  data,
  client,
  agency,
  refresh,
}: {
  data: Row;
  client: Row;
  agency: boolean;
  refresh: () => Promise<any>;
}) {
  const narrow = useNarrow();
  const [chosenView, setView] = useState<"month" | "week">("month"),
    [anchor, setAnchor] = useState(localToday()),
    [editing, setEditing] = useState<Row | null>(null),
    [adding, setAdding] = useState<{ date?: string; entry?: Row } | null>(null),
    [detail, setDetail] = useState<{ src: string; id: string } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState(false);
  const L = useL(),
    lang = useLang(),
    loc = dateLocale(lang);
  const today = localToday();
  const view = narrow ? "list" : chosenView;
  useEffect(() => {
    const f = () => refresh();
    window.addEventListener(CALENDAR_CHANGED, f);
    return () => window.removeEventListener(CALENDAR_CHANGED, f);
  }, [refresh]);
  const ownLabel = (e: Row) =>
    e.title ||
    (e.kind === "note"
      ? L("Note", "Nota", "Note")
      : e.media === "video"
        ? L("Ma vidéo", "Mi video", "My video")
        : L("Mon visuel", "Mi imagen", "My visual"));
  const items: Item[] = [
    ...(data.publicationPosts || []).map(
      (p: Row): Item => ({
        src: "agency",
        id: p.id,
        date: p.date,
        title: p.title,
        caption: p.caption || "",
        file_id: p.file_id || null,
        media: p.file_id ? "image" : null,
        done: !!p.published,
        late: !p.published && p.date < today,
        platform: p.platform,
        raw: p,
      }),
    ),
    ...(data.calendarEntries || []).map(
      (e: Row): Item => ({
        src: "own",
        id: e.id,
        date: e.date,
        title: ownLabel(e),
        caption: e.caption || "",
        file_id: e.media ? e.file_id : null,
        media: e.media || null,
        done: !!e.done,
        late: !e.done && e.date < today,
        raw: e,
      }),
    ),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const d = new Date(anchor + "T12:00:00Z"),
    start = view === "week" ? monday(d) : monday(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12))),
    last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)),
    count =
      view === "week"
        ? 7
        : Math.ceil(
            (((new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).getUTCDay() + 6) % 7) + last.getUTCDate()) /
              7,
          ) * 7,
    days = Array.from({ length: count }, (_, i) => add(start, i));
  async function act(action: string, body: Row) {
    setBusy(true);
    setError("");
    try {
      await api(action, body);
      await refresh();
      setEditing(null);
      setDetail(null);
      setDeleting(false);
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function newPost(date = today) {
    setError("");
    setEditing({ client_id: client.id, date, platform: "Instagram", title: "", caption: "", file_id: "" });
    setDetail(null);
  }
  function addOn(date?: string) {
    setError("");
    if (agency) newPost(date);
    else setAdding({ date: date && date >= today ? date : undefined });
  }
  function shift(n: number) {
    if (view === "week") setAnchor(dateKey(add(d, 7 * n)));
    else setAnchor(dateKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 12))));
  }
  const current = detail ? items.find((i) => i.src === detail.src && i.id === detail.id) || null : null;
  const open = (it: Item) => {
    setDetail({ src: it.src, id: it.id });
    setDeleting(false);
    setError("");
  };
  const longDate = (k: string) =>
    new Date(k + "T12:00:00Z").toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const shortDate = (k: string) =>
    new Date(k + "T12:00:00Z").toLocaleDateString(loc, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  // Prochaine livraison : le 3 du mois (ce mois-ci si on est avant le 3, sinon le mois suivant).
  const now = new Date(),
    next3 = new Date(now.getFullYear(), now.getMonth() + (now.getDate() >= 3 ? 1 : 0), 3),
    deliveryDate = next3.toLocaleDateString(loc, { day: "numeric", month: "long" });
  const empty = !items.length;
  // Vue liste (téléphone) : à publier, cette semaine, à venir.
  const weekEnd = shiftKey(today, 6);
  const sections: [string, Item[]][] = [
    [L("À publier", "Por publicar", "To post"), items.filter((i) => i.late && i.date >= shiftKey(today, -30))],
    [L("Cette semaine", "Esta semana", "This week"), items.filter((i) => i.date >= today && i.date <= weekEnd)],
    [L("À venir", "Próximamente", "Coming up"), items.filter((i) => i.date > weekEnd).slice(0, 40)],
  ];
  const card = (it: Item) => (
    <button
      key={it.src + it.id}
      className={"publication-card " + (it.done ? "published " : it.late ? "late " : "") + (it.src === "own" ? "own" : "")}
      onClick={() => open(it)}
    >
      {it.file_id && it.media === "image" && <img loading="lazy" src={"/api/studio/file/" + it.file_id} alt={it.title} />}
      {it.file_id && it.media === "video" && (
        <span className="cal-card-video">
          <video src={"/api/studio/file/" + it.file_id + "#t=0.5"} muted playsInline preload="metadata" />
          <Video size={14} />
        </span>
      )}
      <small>{it.src === "own" ? L("Ajouté par vous", "Agregado por ti", "Added by you") : it.platform}</small>
      <b>{it.title}</b>
      {it.caption && <span>{it.caption}</span>}
      <em className={"cal-badge " + (it.done ? "done" : it.late ? "late" : "")}>{statusLabel(it, lang)}</em>
    </button>
  );
  return (
    <>
      {(data.rewards?.planned > 0 || data.rewards?.total > 0) && <Rewards rewards={data.rewards} />}
      <section className={"panel publication-calendar view-" + view}>
        <div className="calendar-toolbar">
          <h3>
            <CalendarDays size={20} /> {L("Mon calendrier", "Mi calendario", "My calendar")}
          </h3>
          {view !== "list" && (
            <div className="calendar-controls">
              <button
                className="button secondary"
                onClick={() => {
                  setAnchor(today);
                  setError("");
                }}
              >
                {L("Aujourd’hui", "Hoy", "Today")}
              </button>
              <div className="calendar-nav">
                <button className="icon-button" onClick={() => shift(-1)} aria-label={L("Période précédente", "Periodo anterior", "Previous")}>
                  <ChevronLeft />
                </button>
                <b>
                  {view === "month"
                    ? d.toLocaleDateString(loc, { month: "long", year: "numeric", timeZone: "UTC" })
                    : `${days[0].toLocaleDateString(loc, { day: "numeric", month: "short", timeZone: "UTC" })} – ${days[6].toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`}
                </b>
                <button className="icon-button" onClick={() => shift(1)} aria-label={L("Période suivante", "Periodo siguiente", "Next")}>
                  <ChevronRight />
                </button>
              </div>
              <div className="calendar-switch">
                {(
                  [
                    ["month", L("Mois", "Mes", "Month")],
                    ["week", L("Semaine", "Semana", "Week")],
                  ] as ["month" | "week", string][]
                ).map(([key, label]) => (
                  <button key={key} aria-pressed={view === key} className={view === key ? "active" : ""} onClick={() => setView(key)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button className="button primary cal-add-main" onClick={() => addOn()}>
            <Plus size={16} />
            {agency ? "Nouveau post" : narrow ? L("Ajouter", "Agregar", "Add") : L("Ajouter un contenu", "Agregar un contenido", "Add content")}
          </button>
        </div>
        {error && !current && !editing && (
          <p role="alert" className="alert error">
            {error}
          </p>
        )}
        {empty ? (
          <p className="cal-empty">
            {agency
              ? "Aucun post pour l’instant. Cliquez sur « Nouveau post » ou sur le + d’une date."
              : L(
                  `Vos 6 contenus arrivent le ${deliveryDate}. Vous pouvez aussi ajouter les vôtres avec le bouton +.`,
                  `Tus 6 contenidos llegan el ${deliveryDate}. También puedes agregar los tuyos con el botón +.`,
                  `Your 6 posts arrive on ${deliveryDate}. You can also add your own with the + button.`,
                )}
          </p>
        ) : (
          <p className="editorial-note">
            {agency
              ? "Cliquez sur une date pour ajouter un post, ou sur un post pour le modifier et le déplacer. Les ajouts du client sont marqués « Ajouté par vous » côté client."
              : L(
                  "Ouvrez un contenu pour copier son texte et télécharger son visuel.",
                  "Abre un contenido para copiar su texto y descargar su imagen.",
                  "Open an item to copy its text and download its visual.",
                )}
          </p>
        )}
        {view === "list" ? (
          <div className="cal-list">
            {sections.map(([title, list]) =>
              list.length ? (
                <div key={title} className="cal-list-section">
                  <h4>{title}</h4>
                  {list.map((it) => (
                    <div key={it.src + it.id} className={"cal-row " + (it.done ? "done" : it.late ? "late" : "")}>
                      <button className="cal-row-main" onClick={() => open(it)}>
                        <span className="cal-row-date">{shortDate(it.date)}</span>
                        <Thumb it={it} />
                        <span className="cal-row-text">
                          <b>{it.title}</b>
                          <em className={"cal-badge " + (it.done ? "done" : it.late ? "late" : "")}>{statusLabel(it, lang)}</em>
                        </span>
                      </button>
                      {it.caption && <CopyButton text={it.caption} small />}
                    </div>
                  ))}
                </div>
              ) : null,
            )}
            {!empty && sections.every(([, l]) => !l.length) && (
              <p className="cal-empty">
                {L("Rien de prévu ces prochains jours.", "Nada programado en los próximos días.", "Nothing planned for the next few days.")}
              </p>
            )}
          </div>
        ) : (
          <div className="calendar-scroll">
            <div className={"publication-grid " + view}>
              {pick(
                lang,
                ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
                ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
                ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
              ).map((x) => (
                <div key={x} className="calendar-weekday">
                  {x}
                </div>
              ))}
              {days.map((day) => {
                const key = dateKey(day),
                  list = items.filter((p) => p.date === key);
                return (
                  <div
                    key={key}
                    className={
                      "publication-day " +
                      (day.getUTCMonth() !== d.getUTCMonth() && view === "month" ? "outside " : "") +
                      (key === today ? "today" : "")
                    }
                  >
                    <div className="day-heading">
                      <span>
                        {view === "week"
                          ? day.toLocaleDateString(loc, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
                          : day.getUTCDate()}
                      </span>
                      {(agency || key >= today) && (
                        <button
                          aria-label={L("Ajouter un contenu le ", "Agregar un contenido el ", "Add content on ") + longDate(key)}
                          title={L("Ajouter", "Agregar", "Add")}
                          className="icon-button cal-day-add"
                          onClick={() => addOn(key)}
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>
                    {list.map(card)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
      {adding && (
        <AddContentModal
          data={data}
          clientId={client.id}
          date={adding.date}
          entry={adding.entry}
          onClose={() => setAdding(null)}
          onSaved={async () => {
            await refresh();
            setAdding(null);
            setDetail(null);
          }}
        />
      )}
      {(editing || current) && (
        <div
          className="overlay"
          onClick={() => {
            if (!busy) {
              setEditing(null);
              setDetail(null);
            }
          }}
        >
          <section
            className="modal calendar-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editing ? "Préparer un post" : L("Détail du contenu", "Detalle del contenido", "Item details")}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button modal-x"
              disabled={busy}
              aria-label={L("Fermer", "Cerrar", "Close")}
              onClick={() => {
                setEditing(null);
                setDetail(null);
              }}
            >
              <X />
            </button>
            {error && (
              <p className="alert error" role="alert">
                {error}
              </p>
            )}
            {editing ? (
              <>
                <span className="eyebrow">CALENDRIER DE {client.name}</span>
                <h2>{editing.id ? "Modifier ce post" : "Préparer un post"}</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    act("publication-save", editing);
                  }}
                >
                  <div className="form-row">
                    <label className="field">
                      <span>Date de publication</span>
                      <input required type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
                    </label>
                    <label className="field">
                      <span>Plateforme</span>
                      <select value={editing.platform} onChange={(e) => setEditing({ ...editing, platform: e.target.value })}>
                        {platforms.map((p: string) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="field">
                    <span>Titre ou idée</span>
                    <input required maxLength={240} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                  </label>
                  <label className="field">
                    <span>Légende · facultative</span>
                    <textarea rows={5} maxLength={10000} value={editing.caption} onChange={(e) => setEditing({ ...editing, caption: e.target.value })} />
                  </label>
                  <label className="field">
                    <span>Visuel de cet espace · facultatif</span>
                    <select value={editing.file_id || ""} onChange={(e) => setEditing({ ...editing, file_id: e.target.value })}>
                      <option value="">Sans visuel pour l’instant</option>
                      {(data.files || [])
                        .filter((f: Row) => f.mime.startsWith("image/"))
                        .map((f: Row) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  {editing.file_id && <img className="post-detail-image" src={"/api/studio/file/" + editing.file_id} alt="Visuel sélectionné" />}
                  <button className="button primary full" disabled={busy} type="submit">
                    {busy ? "Enregistrement…" : "Enregistrer le post"}
                  </button>
                </form>
              </>
            ) : (
              current && (
                <>
                  <span className="eyebrow">
                    {current.src === "own" ? L("AJOUTÉ PAR VOUS", "AGREGADO POR TI", "ADDED BY YOU") : current.platform} ·{" "}
                    {longDate(current.date)}
                  </span>
                  <h2>{current.title}</h2>
                  <span className={"cal-badge " + (current.done ? "done" : current.late ? "late" : "")}>{statusLabel(current, lang)}</span>
                  {current.file_id &&
                    (current.media === "video" ? (
                      <video className="post-detail-image" src={"/api/studio/file/" + current.file_id} controls playsInline preload="metadata" />
                    ) : (
                      <img className="post-detail-image" src={"/api/studio/file/" + current.file_id} alt={current.title} />
                    ))}
                  {current.caption ? (
                    <p className="post-caption">{current.caption}</p>
                  ) : (
                    current.src === "agency" && (
                      <p className="post-caption muted">
                        {L(
                          "Le texte à publier sera ajouté prochainement.",
                          "El texto para publicar se añadirá pronto.",
                          "The text to post will be added soon.",
                        )}
                      </p>
                    )
                  )}
                  <div className="cal-detail-actions">
                    {current.caption && <CopyButton text={current.caption} primary />}
                    {current.file_id && (
                      <a
                        className={"button full " + (current.caption ? "secondary" : "primary")}
                        href={"/api/studio/file/" + current.file_id + "?download=1"}
                      >
                        <Download size={16} />
                        {current.media === "video"
                          ? L("Télécharger la vidéo", "Descargar el video", "Download the video")
                          : L("Télécharger l’image", "Descargar la imagen", "Download the image")}
                      </a>
                    )}
                    {(current.src === "agency" || !agency) && (
                      <button
                        className="button full ghost"
                        disabled={busy}
                        onClick={() =>
                          current.src === "agency"
                            ? act("publication-confirm", { id: current.id, version: current.raw.version, published: !current.done })
                            : act("calendar-entry-done", { id: current.id, done: !current.done })
                        }
                      >
                        <Check size={16} />
                        {current.done
                          ? L("Annuler ma validation", "Cancelar mi confirmación", "Undo my confirmation")
                          : L("J’ai publié ce post", "Ya publiqué esto", "I posted this")}
                      </button>
                    )}
                  </div>
                  {current.src === "agency" && (
                    <p className="editorial-note">
                      {current.done
                        ? L(
                            `${current.raw.points_award} points attribués. Annuler retire ces points.`,
                            `${current.raw.points_award} puntos otorgados. Si cancelas, se retiran.`,
                            `${current.raw.points_award} points awarded. Undoing removes them.`,
                          )
                        : L(
                            `Cette publication rapporte ${current.raw.points_award ?? client.config?.pointsPerPost ?? 10} points, une seule fois.`,
                            `Esta publicación te da ${current.raw.points_award ?? client.config?.pointsPerPost ?? 10} puntos, una sola vez.`,
                            `This post earns ${current.raw.points_award ?? client.config?.pointsPerPost ?? 10} points, one time only.`,
                          )}
                    </p>
                  )}
                  {((current.src === "agency" && agency) || (current.src === "own" && !agency)) && (
                    <div className="edit-actions">
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => {
                          if (current.src === "agency") setEditing({ ...current.raw, client_id: client.id });
                          else setAdding({ entry: current.raw });
                          setDetail(null);
                        }}
                      >
                        {L("Modifier / déplacer", "Editar / mover", "Edit / move")}
                      </button>
                      <button className="text-link" disabled={busy} onClick={() => setDeleting(true)}>
                        {current.src === "own" ? L("Retirer du calendrier", "Quitar del calendario", "Remove from calendar") : "Supprimer"}
                      </button>
                    </div>
                  )}
                  {current.src === "own" && agency && (
                    <div className="edit-actions">
                      <button className="text-link" disabled={busy} onClick={() => setDeleting(true)}>
                        Retirer cet ajout du client
                      </button>
                    </div>
                  )}
                  {deleting && (
                    <div className="alert">
                      <p>
                        {current.src === "own"
                          ? L(
                              "Retirer ce contenu du calendrier ? Le visuel reste dans votre galerie.",
                              "¿Quitar este contenido del calendario? La imagen sigue en tu galería.",
                              "Remove this from the calendar? The visual stays in your gallery.",
                            )
                          : "Supprimer ce post ? Ses points éventuels seront retirés."}
                      </p>
                      <button className="button secondary" disabled={busy} onClick={() => setDeleting(false)}>
                        {L("Conserver", "Conservar", "Keep")}
                      </button>
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() =>
                          current.src === "own"
                            ? act("calendar-entry-delete", { id: current.id })
                            : act("publication-delete", { id: current.id, version: current.raw.version })
                        }
                      >
                        {current.src === "own" ? L("Retirer", "Quitar", "Remove") : "Confirmer la suppression"}
                      </button>
                    </div>
                  )}
                </>
              )
            )}
          </section>
        </div>
      )}
    </>
  );
}
export function AgencyPublicationSummary({ rows, onSelect }: { rows: Row[]; onSelect: (id: string) => void }) {
  return (
    <section className="panel">
      <span className="eyebrow">PUBLICATIONS DU MOIS</span>
      <h3>Points & régularité des clients</h3>
      <div className="publication-summary">
        <div>
          <b>Client</b>
          <b>Points</b>
          <b>Publiés / prévus</b>
          <b>Régularité</b>
        </div>
        {rows.map((r) => (
          <button key={r.id} onClick={() => onSelect(r.id)}>
            <b>{r.name}</b>
            <span>{r.points}</span>
            <span>
              {r.published} / {r.planned}
            </span>
            <span>{r.planned ? Math.round((100 * r.published) / r.planned) + " %" : "Aucun post prévu"}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
export function EmailDelivery({
  rows,
  clientId,
  refresh,
}: {
  rows: Row[];
  clientId: string;
  refresh: () => Promise<any>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!rows?.length) return null;
  return (
    <section className="panel">
      <h3>Email d’ouverture du studio</h3>
      {rows.map((e) => (
        <div key={e.id} className="access-row">
          <span>{e.recipient}</span>
          <b>
            {
              {
                queued: "En attente d’envoi",
                sent: "Accepté par Resend",
                sending: "Envoi en cours",
                failed: "Échec d’envoi",
                uncertain: "À vérifier dans Resend",
              }[e.status as string]
            }
          </b>
          {e.error && <small>{e.error}</small>}
        </div>
      ))}
      <p className="editorial-note">
        L’ouverture du compte reste effective si l’email ne part pas. Après configuration de Resend, utilisez le bouton
        ci-dessous pour reprendre les envois en attente. Le statut « Accepté » ne confirme pas la réception dans la
        boîte du client.
      </p>
      {rows.some((e) => ["queued", "failed"].includes(e.status)) && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await api("email-retry", { client_id: clientId });
              await refresh();
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Reprendre les emails en attente
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
