"use client";
import { useEffect, useRef, useState } from "react";
import { pick, readStoredLang, LANG_STORAGE_KEY, type Lang } from "../lib/i18n";
export default function BetaChrome() {
  // Ce bandeau est affiché hors du studio : il suit la langue mémorisée sur l'appareil.
  const [lang, setLang] = useState<Lang>("fr");
  useEffect(() => {
    const sync = () => setLang(readStoredLang() || "fr");
    sync();
    const onStorage = (e: StorageEvent) => e.key === LANG_STORAGE_KEY && sync();
    window.addEventListener("storage", onStorage);
    window.addEventListener("studio-lang-change", sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("studio-lang-change", sync);
    };
  }, []);
  const L = <T,>(fr: T, es: T, en: T) => pick(lang, fr, es, en);
  const [enabled, setEnabled] = useState(false),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [category, setCategory] = useState("suggestion"),
    [page, setPage] = useState("/"),
    [sent, setSent] = useState(false);
  const request = useRef(""),
    input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    fetch("/api/studio/public-info")
      .then((r) => r.json())
      .then((d: any) => {
        setEnabled(!!d.beta);
        document.body.classList.toggle("beta-active", !!d.beta);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  if (!enabled) return null;
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/studio/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Studio-Request": "1" },
        body: JSON.stringify({ message, category, page, request_key: request.current }),
      });
      const d: any = await r.json();
      if (!r.ok)
        throw Error(
          d.error ||
            L("Votre avis n’a pas pu être envoyé.", "No se pudo enviar tu opinión.", "Your feedback couldn’t be sent."),
        );
      setSent(true);
      setMessage("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="beta-banner" role="status">
        <b>{L("Version bêta", "Versión beta", "Beta version")}</b>
        <span>
          {L(
            "Espaces fictifs · aucun paiement · 20 images maximum par testeur",
            "Espacios ficticios · sin pagos · máximo 20 imágenes por persona",
            "Sample spaces · no payment · up to 20 images per tester",
          )}
        </span>
      </div>
      <button
        className="beta-feedback-button button primary"
        onClick={() => {
          request.current = crypto.randomUUID();
          setSent(false);
          setError("");
          setPage(document.querySelector("main h1")?.textContent?.slice(0, 200) || window.location.pathname);
          setOpen(true);
        }}
      >
        {L("Donner mon avis", "Dar mi opinión", "Give feedback")}
      </button>
      {open && (
        <div className="overlay" onClick={() => !busy && setOpen(false)}>
          <section
            className="modal beta-feedback-modal"
            role="dialog"
            aria-modal="true"
            aria-label={L("Donner mon avis", "Dar mi opinión", "Give feedback")}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !busy) setOpen(false);
            }}
          >
            <button className="icon-button modal-x" disabled={busy} onClick={() => setOpen(false)}
              aria-label={L("Fermer", "Cerrar", "Close")}
            >
              ×
            </button>
            <span className="eyebrow">
              {L("ENSEMBLE, AMÉLIORONS LE STUDIO", "MEJOREMOS EL ESTUDIO JUNTOS", "LET’S IMPROVE THE STUDIO TOGETHER")}
            </span>
            <h2>{L("Donner mon avis", "Dar mi opinión", "Give feedback")}</h2>
            {sent ? (
              <>
                <p role="status">
                  {L(
                    "Merci ! Votre retour est bien enregistré pour l’équipe Louvet & Partners.",
                    "¡Gracias! Tu comentario quedó registrado para el equipo de Louvet & Partners.",
                    "Thank you! Your feedback has been saved for the Louvet & Partners team.",
                  )}
                </p>
                <button className="button primary" onClick={() => setOpen(false)}>
                  {L("Revenir au studio", "Volver al estudio", "Back to the studio")}
                </button>
              </>
            ) : (
              <form onSubmit={send}>
                <p>
                  {L(
                    "Un problème, une idée, quelque chose que vous avez aimé ? Racontez-nous. Évitez les mots de passe et les informations confidentielles.",
                    "¿Un problema, una idea, algo que te gustó? Cuéntanos. Evita contraseñas e información confidencial.",
                    "A problem, an idea, something you liked? Tell us. Please don’t include passwords or confidential information.",
                  )}
                </p>
                <label className="field">
                  <span>{L("Votre retour concerne…", "Tu comentario es sobre…", "Your feedback is about…")}</span>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="suggestion">
                      {L("Une idée pour améliorer le studio", "Una idea para mejorar el estudio", "An idea to improve the studio")}
                    </option>
                    <option value="bug">
                      {L("Quelque chose qui ne fonctionne pas", "Algo que no funciona", "Something that doesn’t work")}
                    </option>
                    <option value="question">
                      {L("Une étape difficile à comprendre", "Un paso difícil de entender", "A step that’s hard to understand")}
                    </option>
                    <option value="appreciation">
                      {L("Quelque chose que j’ai aimé", "Algo que me gustó", "Something I liked")}
                    </option>
                  </select>
                </label>
                <label className="field">
                  <span>{L("Votre message", "Tu mensaje", "Your message")}</span>
                  <textarea
                    ref={input}
                    required
                    minLength={5}
                    maxLength={4000}
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </label>
                <small>
                  {L("Page", "Página", "Page")} : {page}.{" "}
                  {L(
                    "Ce retour sera visible uniquement par l’agence.",
                    "Solo la agencia verá este comentario.",
                    "Only the agency will see this feedback.",
                  )}
                </small>
                {error && (
                  <p className="error-inline" role="alert">
                    {error}
                  </p>
                )}
                <button className="button primary full" disabled={busy || message.trim().length < 5}>
                  {busy ? L("Envoi…", "Enviando…", "Sending…") : L("Envoyer mon avis", "Enviar mi opinión", "Send feedback")}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
export function BetaAgency({ beta }: { beta: any }) {
  return (
    <section className="panel">
      <span className="eyebrow">BÊTA SUR INVITATION</span>
      <h2>Les cinq espaces de test</h2>
      <p>
        Chaque invitation est liée au premier compte e-mail Supabase qui l’utilise. La limite de 20 tentatives d’image
        comprend les corrections et les reprises et ne se renouvelle pas.
      </p>
      {beta.invitations?.map((i: any) => (
        <div className="beta-invite-row" key={i.client_id}>
          <b>{i.name}</b>
          <span>{i.used ? "Invitation utilisée" : "À inviter"}</span>
          <span>{i.image_attempts} / 20 images</span>
        </div>
      ))}
      <h2>Les retours des testeurs</h2>
      {!beta.feedback?.length && (
        <p>Aucun avis pour le moment. Le bouton « Donner mon avis » est disponible sur toutes les pages.</p>
      )}
      {beta.feedback?.map((f: any) => (
        <article className="beta-feedback-entry" key={f.id}>
          <b>
            {f.client_name || "Agence"} ·{" "}
            {
              (
                { bug: "Problème", question: "Question", suggestion: "Suggestion", appreciation: "Coup de cœur" } as any
              )[f.category]
            }
          </b>
          <small>
            {f.page} · {new Date(f.created).toLocaleString("fr-FR")}
          </small>
          <p>{f.message}</p>
        </article>
      ))}
    </section>
  );
}
