"use client";
// « Réserver un rendez-vous avec Julie » : bouton d'aide des clients (marques et créatrices).
// Avec un lien de réservation (Calendly par défaut) : nouvel onglet. Sans lien (BOOKING_URL=none) : demande dans le studio.
import { useState } from "react";
import { CalendarClock, Loader2, X, Check, ArrowUpRight } from "lucide-react";
import { useL } from "../lib/i18n";

type Row = Record<string, any>;
async function call(path: string, body: any) {
  const r = await fetch("/api/studio/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Studio-Request": "1" },
    body: JSON.stringify(body),
  });
  const d: any = await r.json();
  if (!r.ok) throw new Error(d.error);
  return d;
}

export function BookingButton({
  client,
  hasLink,
  variant = "link",
  label,
}: {
  client: Row | null | undefined;
  hasLink: boolean;
  variant?: "link" | "button" | "sidebar";
  label?: string;
}) {
  const L = useL();
  const [open, setOpen] = useState(false),
    [error, setError] = useState("");
  if (!client) return null;
  const text = label || L("Réserver un appel avec Julie", "Reservar una llamada con Julie", "Book a call with Julie");
  async function go() {
    setError("");
    if (!hasLink) return setOpen(true);
    // L'onglet est ouvert tout de suite (sinon le navigateur le bloque), puis dirigé vers le lien.
    const tab = window.open("about:blank", "_blank");
    try {
      const { url } = await call("booking-link", { client_id: client!.id });
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else window.location.href = url;
    } catch (e: any) {
      tab?.close();
      setError(e.message);
      setOpen(true);
    }
  }
  return (
    <>
      {variant === "sidebar" ? (
        <button type="button" className="booking-sidebar" onClick={go}>
          <CalendarClock size={16} />
          <span>
            <b>{text}</b>
            <br />
            <small>{L("Besoin d’aide ? On en parle.", "¿Necesitas ayuda? Lo hablamos.", "Need help? Let’s talk.")}</small>
          </span>
          {hasLink && <ArrowUpRight size={14} aria-hidden="true" />}
        </button>
      ) : (
        <button type="button" className={variant === "button" ? "button secondary" : "text-link booking-link"} onClick={go}>
          <CalendarClock size={14} /> {text}
          {hasLink && <ArrowUpRight size={13} aria-hidden="true" />}
        </button>
      )}
      {open && <BookingModal client={client} note={error} onClose={() => setOpen(false)} />}
    </>
  );
}

function BookingModal({ client, note, onClose }: { client: Row; note?: string; onClose: () => void }) {
  const L = useL();
  const tz = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  })();
  const [topic, setTopic] = useState("photos"),
    [slots, setSlots] = useState(["", "", ""]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  const topics: [string, string][] = [
    ["photos", L("Créer mes visuels", "Crear mis imágenes", "Creating my visuals")],
    ["videos", L("Mes vidéos", "Mis videos", "My videos")],
    ["calendar", L("Mon calendrier", "Mi calendario", "My calendar")],
    ["billing", L("Mon abonnement", "Mi suscripción", "My subscription")],
    ["other", L("Autre", "Otro", "Other")],
  ];
  const fmt = (v: string) => {
    const d = new Date(v);
    // Formaté en français : ces créneaux sont lus par l’agence.
    return isNaN(d.getTime()) ? v : d.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
  };
  async function send() {
    setBusy(true);
    setError("");
    try {
      await call("booking-request", { client_id: client.id, topic, slots: slots.filter(Boolean).map(fmt), message, timezone: tz });
      setSent(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <button className="icon-button modal-x" aria-label={L("Fermer", "Cerrar", "Close")} onClick={onClose}>
          <X size={18} />
        </button>
        <h2 id="booking-title">{L("Prendre rendez-vous avec Julie", "Agendar una cita con Julie", "Book a call with Julie")}</h2>
        {sent ? (
          <div className="booking-sent" role="status">
            <span className="montage-check">
              <Check size={24} />
            </span>
            <p>
              {L(
                "Demande envoyée. Julie vous confirme le rendez-vous dans votre studio et par e-mail.",
                "Solicitud enviada. Julie te confirmará la cita en tu estudio y por correo.",
                "Request sent. Julie will confirm the call in your studio and by email.",
              )}
            </p>
            <button className="button primary" onClick={onClose}>
              {L("Fermer", "Cerrar", "Close")}
            </button>
          </div>
        ) : (
          <>
            <p className="muted">
              {L(
                "Dites-nous le sujet et proposez jusqu’à 3 créneaux : Julie choisit et vous confirme.",
                "Cuéntanos el tema y propón hasta 3 horarios: Julie elige y te confirma.",
                "Tell us the topic and suggest up to 3 time slots: Julie picks one and confirms.",
              )}
            </p>
            {(error || note) && (
              <div className="alert error" role="alert">
                <span>{error || note}</span>
              </div>
            )}
            <label className="field">
              <span>{L("Sujet", "Tema", "Topic")}</span>
              <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                {topics.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <div className="field">
              <span>{L("Créneaux qui vous conviennent", "Horarios que te convienen", "Times that work for you")}</span>
              {slots.map((v, i) => (
                <input
                  key={i}
                  type="datetime-local"
                  aria-label={L(`Créneau ${i + 1}`, `Horario ${i + 1}`, `Time slot ${i + 1}`)}
                  value={v}
                  onChange={(e) => setSlots(slots.map((x, k) => (k === i ? e.target.value : x)))}
                />
              ))}
              <small>
                {L("Fuseau horaire : ", "Zona horaria: ", "Time zone: ")}
                {tz}
              </small>
            </div>
            <label className="field">
              <span>{L("Message (facultatif)", "Mensaje (opcional)", "Message (optional)")}</span>
              <textarea maxLength={600} value={message} onChange={(e) => setMessage(e.target.value)} />
            </label>
            <button className="button primary full" disabled={busy || !slots.some(Boolean)} onClick={send}>
              {busy && <Loader2 className="spin" size={15} />} {L("Envoyer ma demande", "Enviar mi solicitud", "Send my request")}
            </button>
          </>
        )}
      </section>
    </div>
  );
}

/** Agence : demandes de rendez-vous (onglet « À traiter »). Texte réservé à l'agence : en français. */
// Créneaux toujours lus en français par l'agence, même s'ils ont été saisis depuis un navigateur en anglais.
const agencySlot = (v: string) => {
  if (!/\d{4}/.test(v) || !/\d{1,2}:\d{2}/.test(v)) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
};
export function BookingRequests({ data, refresh }: { data: Row; refresh: () => Promise<any> }) {
  const rows: Row[] = data.bookingRequests || [];
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  if (!rows.length) return null;
  const topics: Record<string, string> = { photos: "Créer mes visuels", videos: "Mes vidéos", calendar: "Mon calendrier", billing: "Mon abonnement", other: "Autre" };
  async function done(id: string) {
    setBusy(id);
    setError("");
    try {
      await call("booking-done", { id });
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="panel booking-requests">
      <div className="section-heading">
        <h3>Demandes de rendez-vous</h3>
        <CalendarClock size={18} />
      </div>
      {error && (
        <div className="alert error" role="alert">
          <span>{error}</span>
        </div>
      )}
      {rows.map((r) => (
        <div className="access-row" key={r.id}>
          <span>
            <b>{r.client_name}</b>
            <small className="muted">
              {" "}
              · {r.email} · {topics[r.topic] || r.topic} · {new Date(r.created).toLocaleDateString("fr-FR")}
            </small>
            <small>
              Créneaux ({r.timezone}) : {(r.slots || []).map(agencySlot).join(" · ")}
            </small>
            {r.message && <small>« {r.message} »</small>}
          </span>
          <button className="button primary" disabled={busy === r.id} onClick={() => done(r.id)}>
            Marquer comme planifié
          </button>
        </div>
      ))}
    </section>
  );
}
