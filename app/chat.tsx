"use client";
// Messages client ↔ agence, aussi simples qu'iMessage : un fil par espace client.
// Client : bouton « Écrire à l'agence » (barre latérale + bouton rond sur mobile) qui ouvre le fil.
// Agence : onglet « Messages » (texte réservé à l'agence : en français).
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, ImagePlus, Loader2, MessageCircle, X } from "lucide-react";
import { useL, useLang, dateLocale } from "../lib/i18n";
import { uploadStudioMedia } from "../lib/direct-upload-client";
import { BookingButton } from "./booking-help";

type Row = Record<string, any>;
type Msg = { id: string; author: "client" | "agency"; body: string; file_id: string | null; read: boolean; created: string; pending?: boolean };
const MAX = 2000,
  PHOTO_MAX = 8 * 1024 * 1024,
  POLL = 15000;

async function call(path: string, body: any) {
  const r = await fetch("/api/studio/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Studio-Request": "1" },
    body: JSON.stringify(body),
  });
  const d: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Erreur");
  return d;
}

/** Bouton de la barre latérale (ordinateur et menu mobile). */
export function ChatSidebarButton({ unread, onOpen }: { unread: number; onOpen: () => void }) {
  const L = useL();
  return (
    <button type="button" className="chat-sidebar" onClick={onOpen}>
      <MessageCircle size={16} />
      <span>{L("Écrire à l’agence", "Escribir a la agencia", "Message the agency")}</span>
      {unread > 0 && (
        <b className="chat-badge" aria-label={L(`${unread} non lu(s)`, `${unread} sin leer`, `${unread} unread`)}>
          {unread}
        </b>
      )}
    </button>
  );
}

/** Fil du client : bouton rond (mobile) + panneau de conversation. Rendu au niveau de la page. */
export function ClientChat({
  client,
  unread,
  open,
  setOpen,
  onUnread,
  alwaysShowButton,
  bookingLink = true,
}: {
  /** Lien de réservation disponible (sinon, demande de rendez-vous dans le studio). */
  bookingLink?: boolean;
  client: Row | null | undefined;
  unread: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  onUnread: (n: number) => void;
  /** Page sans barre latérale (questionnaire) : le bouton rond reste visible sur ordinateur. */
  alwaysShowButton?: boolean;
}) {
  const L = useL();
  const cid = client?.id;
  // Fil fermé : un coup d'œil discret chaque minute pour le badge (sans marquer « Lu »).
  useEffect(() => {
    if (open || !cid) return;
    const peek = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        onUnread((await call("chat-list", { client_id: cid })).unread);
      } catch {}
    };
    const t = setInterval(peek, 60000);
    return () => clearInterval(t);
  }, [open, cid, onUnread]);
  if (!client) return null;
  return (
    <>
      {!open && (
        <button
          type="button"
          className={"chat-fab" + (alwaysShowButton ? " always" : "")}
          onClick={() => setOpen(true)}
          aria-label={L("Écrire à l’agence", "Escribir a la agencia", "Message the agency")}
        >
          <MessageCircle size={24} />
          {unread > 0 && <b className="chat-badge">{unread}</b>}
        </button>
      )}
      {open && (
        <div className="chat-overlay" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <section className="chat-sheet" role="dialog" aria-modal="true" aria-labelledby="chat-title">
            <header className="chat-head">
              <div>
                <h2 id="chat-title">{L("L’agence", "La agencia", "The agency")}</h2>
                <small>Louvet &amp; Partners</small>
              </div>
              <span className="chat-book">
                <BookingButton
                  client={client}
                  hasLink={bookingLink}
                  label={L("Réserver un appel", "Reservar una llamada", "Book a call")}
                />
              </span>
              <button className="icon-button" aria-label={L("Fermer", "Cerrar", "Close")} onClick={() => setOpen(false)}>
                <X size={20} />
              </button>
            </header>
            <Conversation clientId={client.id} viewer="client" onUnread={onUnread} />
          </section>
        </div>
      )}
    </>
  );
}

/** Conversation (bulles + champ d'envoi). Interroge le serveur toutes les 15 s tant qu'elle est ouverte. */
function Conversation({
  clientId,
  viewer,
  onUnread,
  onSent,
}: {
  clientId: string;
  viewer: "client" | "agency";
  onUnread?: (n: number) => void;
  onSent?: () => void;
}) {
  const L = useL(),
    lang = useLang();
  const [messages, setMessages] = useState<Msg[] | null>(null),
    [draft, setDraft] = useState(""),
    [photo, setPhoto] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const list = useRef<HTMLDivElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    stick = useRef(true);
  const load = useCallback(async () => {
    try {
      const d = await call("chat-list", { client_id: clientId, read: document.visibilityState === "visible" });
      setMessages(d.messages);
      onUnread?.(d.unread);
    } catch (e: any) {
      setError(e.message);
    }
  }, [clientId, onUnread]);
  useEffect(() => {
    setMessages(null);
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), POLL);
    const focus = () => load();
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [load]);
  useEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);
  useEffect(() => {
    if (!photo) return setPreview("");
    const u = URL.createObjectURL(photo);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);

  function choose(f?: File | null) {
    setError("");
    if (!f) return;
    if (!["image/jpeg", "image/png"].includes(f.type))
      return setError(L("Choisissez une photo JPG ou PNG.", "Elige una foto JPG o PNG.", "Choose a JPG or PNG photo."));
    if (f.size > PHOTO_MAX)
      return setError(L("La photo dépasse 8 Mo.", "La foto supera los 8 MB.", "The photo is larger than 8 MB."));
    setPhoto(f);
  }
  async function send() {
    const body = draft.trim();
    if ((!body && !photo) || busy) return;
    setBusy(true);
    setError("");
    stick.current = true;
    try {
      let file_id: string | undefined;
      if (photo) file_id = (await uploadStudioMedia(photo, { kind: "chat", client_id: clientId })).id;
      const d = await call("chat-send", { client_id: clientId, body, file_id });
      setMessages((m) => [...(m || []), d.message]);
      setDraft("");
      setPhoto(null);
      onSent?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const mine = (m: Msg) => m.author === viewer;
  const locale = dateLocale(lang);
  const day = (iso: string) => {
    const d = new Date(iso),
      today = new Date();
    const y = new Date();
    y.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return L("Aujourd’hui", "Hoy", "Today");
    if (d.toDateString() === y.toDateString()) return L("Hier", "Ayer", "Yesterday");
    return d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  };
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const lastMine = messages ? [...messages].reverse().find(mine)?.id : undefined;
  const left = MAX - draft.length;
  return (
    <div className="chat-body">
      <div
        className="chat-list"
        ref={list}
        aria-live="polite"
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {messages === null ? (
          <div className="chat-empty">
            <Loader2 className="spin" size={20} />
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <span className="chat-empty-icon">
              <MessageCircle size={26} />
            </span>
            <p>
              {viewer === "client"
                ? L("L’équipe vous répond ici.", "El equipo te responde aquí.", "The team replies to you here.")
                : "Aucun message pour l’instant."}
            </p>
            {viewer === "client" && (
              <small>
                {L(
                  "Posez votre question, ajoutez une photo si besoin.",
                  "Haz tu pregunta y agrega una foto si hace falta.",
                  "Ask your question and add a photo if needed.",
                )}
              </small>
            )}
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const newDay = !prev || new Date(prev.created).toDateString() !== new Date(m.created).toDateString();
            return (
              <div key={m.id}>
                {newDay && <div className="chat-day">{day(m.created)}</div>}
                <div className={"chat-row " + (mine(m) ? "mine" : "theirs")}>
                  <div className="chat-bubble">
                    {m.file_id && (
                      <a href={"/api/studio/file/" + m.file_id} target="_blank" rel="noreferrer" className="chat-photo">
                        <img src={"/api/studio/file/" + m.file_id} alt={L("Photo envoyée", "Foto enviada", "Photo sent")} loading="lazy" />
                      </a>
                    )}
                    {m.body && <p>{m.body}</p>}
                  </div>
                  <small className="chat-meta">
                    {time(m.created)}
                    {m.id === lastMine && (
                      <> · {m.read ? L("Lu", "Leído", "Read") : L("Envoyé", "Enviado", "Sent")}</>
                    )}
                  </small>
                </div>
              </div>
            );
          })
        )}
      </div>
      {error && (
        <div className="alert error chat-error" role="alert">
          <span>{error}</span>
        </div>
      )}
      {preview && (
        <div className="chat-attach">
          <img src={preview} alt="" />
          <span>{photo?.name}</span>
          <button className="icon-button" aria-label={L("Retirer la photo", "Quitar la foto", "Remove photo")} onClick={() => setPhoto(null)}>
            <X size={16} />
          </button>
        </div>
      )}
      <div className="chat-compose">
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png"
          hidden
          onChange={(e) => {
            choose(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="icon-button chat-photo-button"
          aria-label={L("Ajouter une photo", "Agregar una foto", "Add a photo")}
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          <ImagePlus size={20} />
        </button>
        <textarea
          rows={1}
          maxLength={MAX}
          value={draft}
          placeholder={viewer === "client" ? L("Votre message…", "Tu mensaje…", "Your message…") : "Votre réponse…"}
          aria-label={L("Message", "Mensaje", "Message")}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          type="button"
          className="chat-send"
          aria-label={L("Envoyer", "Enviar", "Send")}
          disabled={busy || (!draft.trim() && !photo)}
          onClick={send}
        >
          {busy ? <Loader2 className="spin" size={18} /> : <ArrowUp size={20} />}
        </button>
      </div>
      {left < 200 && <small className="chat-left">{left}</small>}
    </div>
  );
}

/** Agence : boîte de réception (fils triés par dernier message) et conversation. */
export function AgencyInbox({ data, refresh: refreshProp }: { data: Row; refresh: () => Promise<any> }) {
  const threads: Row[] = data.chatThreads || [];
  // La fonction de rafraîchissement change à chaque affichage : on garde la dernière dans une référence.
  const refreshRef = useRef(refreshProp);
  refreshRef.current = refreshProp;
  const refresh = useCallback(() => refreshRef.current(), []);
  const [openId, setOpenId] = useState<string>(""),
    [q, setQ] = useState(""),
    [newClient, setNewClient] = useState("");
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), 60000);
    return () => clearInterval(t);
  }, [refresh]);
  const known = new Set(threads.map((t) => t.client_id));
  const others = (data.clients || []).filter((c: Row) => !known.has(c.id) && c.config?.workspaceType !== "agency");
  const shown = threads.filter((t) => !q || String(t.client_name).toLowerCase().includes(q.toLowerCase()));
  const current =
    threads.find((t) => t.client_id === openId) ||
    (openId ? { client_id: openId, client_name: (data.clients || []).find((c: Row) => c.id === openId)?.name, language: "fr" } : null);
  const flags: Record<string, string> = { fr: "Français", es: "Español", en: "English" };
  const when = (iso: string) => {
    const d = new Date(iso);
    return d.toDateString() === new Date().toDateString()
      ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };
  const onUnread = useCallback(() => {}, []);
  // Ouvrir un fil le marque « Lu » : la liste et le badge sont rafraîchis juste après.
  useEffect(() => {
    if (!openId) return;
    const t = setTimeout(() => refresh(), 1200);
    return () => clearTimeout(t);
  }, [openId, refresh]);
  return (
    <section className={"panel chat-inbox " + (current ? "has-open" : "")}>
      <aside className="chat-threads">
        <input className="chat-search" placeholder="Rechercher un client" value={q} onChange={(e) => setQ(e.target.value)} />
        {shown.length === 0 && <p className="muted chat-none">Aucune conversation pour l’instant.</p>}
        {shown.map((t) => (
          <button
            key={t.client_id}
            className={"chat-thread " + (t.client_id === openId ? "active " : "") + (t.unread ? "unread" : "")}
            onClick={() => setOpenId(t.client_id)}
          >
            <span className="avatar">{String(t.client_name || "?").slice(0, 2).toUpperCase()}</span>
            <span className="chat-thread-text">
              <b>{t.client_name}</b>
              <small>
                {t.last_author === "agency" ? "Vous : " : ""}
                {t.last_body || (t.last_photo ? "📷 Photo" : "")}
              </small>
            </span>
            <span className="chat-thread-side">
              <small>{when(t.last_created)}</small>
              {t.unread > 0 && <b className="chat-badge">{t.unread}</b>}
            </span>
          </button>
        ))}
        {others.length > 0 && (
          <label className="field chat-start">
            <span>Écrire à un client</span>
            <select
              value={newClient}
              onChange={(e) => {
                setNewClient("");
                if (e.target.value) setOpenId(e.target.value);
              }}
            >
              <option value="">Choisir…</option>
              {others.map((c: Row) => (
                <option key={c.id} value={c.id}>
                  {c.config?.brand || c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </aside>
      <div className="chat-pane">
        {current ? (
          <>
            <header className="chat-head">
              <button className="icon-button chat-back" aria-label="Retour aux conversations" onClick={() => setOpenId("")}>
                <ArrowLeft size={18} />
              </button>
              <div>
                <h2>{current.client_name}</h2>
                <small>Langue du client : {flags[current.language] || current.language}</small>
              </div>
            </header>
            <Conversation key={current.client_id} clientId={current.client_id} viewer="agency" onUnread={onUnread} onSent={() => refresh()} />
          </>
        ) : (
          <div className="chat-empty">
            <span className="chat-empty-icon">
              <MessageCircle size={26} />
            </span>
            <p>Choisissez une conversation.</p>
          </div>
        )}
      </div>
    </section>
  );
}
