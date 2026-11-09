"use client";
import { useL } from "../lib/i18n";
import { useState } from "react";
const empty = { text_fr: "", text_es: "", source_title: "", source_url: "", source_date: "", approved: false };
export default function StudioMail({ mail, refresh }: { mail: any; refresh: () => Promise<any> }) {
  const [language, setLanguage] = useState("fr"),
    [form, setForm] = useState<any>(empty),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const set = (key: string, value: any) =>
    setForm((old: any) => ({ ...old, [key]: value, ...(key === "approved" ? {} : { approved: false }) }));
  async function post(action: string, body: any) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/studio/" + action, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Studio-Request": "1" },
          body: JSON.stringify(body),
        }),
        d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      await refresh();
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mail-admin">
      <section className="panel">
        <span className="eyebrow">BREVO · AVANT ACTIVATION</span>
        <h2>Les e-mails du studio</h2>
        <p>
          <b>{mail.readiness.deliveryEnabled ? "Envois autorisés et configurés" : "Aucun envoi activé"}</b>. Les textes
          sont proposés à ta validation. Une clé API seule ne déclenche aucun envoi.
        </p>
        <p>
          Liste : <b>Membres studio</b> · Rappel : <b>lundi à 9 h, heure de Monterrey</b>. Le rappel reste bloqué sans
          chiffre sourcé validé et lien de désinscription opérationnel.
        </p>
        <div className="edit-actions">
          <button
            className={"button " + (language === "fr" ? "primary" : "secondary")}
            onClick={() => setLanguage("fr")}
          >
            Français
          </button>
          <button
            className={"button " + (language === "es" ? "primary" : "secondary")}
            onClick={() => setLanguage("es")}
          >
            Español
          </button>
          <button
            className={"button " + (language === "en" ? "primary" : "secondary")}
            onClick={() => setLanguage("en")}
          >
            English
          </button>
        </div>
        {mail.previews
          .filter((m: any) => m.language === language)
          .map((m: any) => (
            <article className="mail-preview" key={m.kind}>
              <span className="eyebrow">
                {
                  (
                    {
                      received: "1 · Demande reçue",
                      welcome: "2 · Compte validé",
                      weekly: "3 · Rappel du lundi",
                    } as any
                  )[m.kind]
                }
              </span>
              <h3>{m.subject}</h3>
              <p className="mail-copy">{m.text}</p>
            </article>
          ))}
      </section>
      <section className="panel">
        <h2>La banque de chiffres</h2>
        <p>
          Ajoute les chiffres que tu souhaites utiliser, avec leur source et leur traduction. Aucun chiffre n’est
          inventé pour remplir les e-mails.
        </p>
        {!mail.facts.length && <p className="editorial-note">La banque est vide. Le rappel attendra tes chiffres.</p>}
        {mail.facts.map((f: any) => (
          <article className="mail-fact" key={f.id}>
            <b>{f.text_fr}</b>
            <p>{f.text_es}</p>
            <a className="text-link" href={f.source_url} target="_blank" rel="noreferrer">
              {f.source_title} · {f.source_date}
            </a>
            <small>{f.approved ? "Vérifié et utilisable" : "En attente de vérification"}</small>
            <button className="button secondary" onClick={() => setForm({ ...f, approved: !!f.approved })}>
              Modifier
            </button>
          </article>
        ))}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await post("mail-fact", form)) setForm(empty);
          }}
        >
          <h3>{form.id ? "Modifier un chiffre" : "Ajouter un chiffre"}</h3>
          {[
            ["text_fr", "Le chiffre, en français"],
            ["text_es", "El dato, en español"],
            ["source_title", "Nom de la source"],
          ].map(([key, label]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <textarea
                required
                maxLength={key === "source_title" ? 200 : 1500}
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            </label>
          ))}
          <label className="field">
            <span>Lien de la source · HTTPS</span>
            <input type="url" required value={form.source_url} onChange={(e) => set("source_url", e.target.value)} />
          </label>
          <label className="field">
            <span>Date de publication de la source</span>
            <input type="date" required value={form.source_date} onChange={(e) => set("source_date", e.target.value)} />
          </label>
          <label className="optional-toggle">
            <input type="checkbox" checked={form.approved} onChange={(e) => set("approved", e.target.checked)} />
            J’ai vérifié le chiffre et sa source ; il peut être utilisé.
          </label>
          <button className="button primary" disabled={busy}>
            Enregistrer ce chiffre
          </button>
          {form.id && (
            <button type="button" className="button secondary" onClick={() => setForm(empty)}>
              Annuler la modification
            </button>
          )}
        </form>
      </section>
      <section className="panel">
        <h2>Suivi des e-mails</h2>
        {!mail.outbox.length && <p>Aucun e-mail préparé pour le moment.</p>}
        {mail.outbox.map((m: any) => (
          <article className="mail-fact" key={m.id}>
            <b>{m.recipient}</b>
            <small>
              {m.kind} · {m.language.toUpperCase()} ·{" "}
              {(
                {
                  held: "En attente de ton accord",
                  queued: "À envoyer",
                  sending: "En cours de transmission",
                  sent: "Envoyé",
                  failed: "Échec confirmé",
                  uncertain: "À vérifier dans Brevo",
                  suppressed: "Non envoyé — préférence respectée",
                } as any
              )[m.status] || m.status}
            </small>
            {m.error && <p>{m.error}</p>}
            {["held", "failed"].includes(m.status) && (
              <button
                className="button secondary"
                disabled={busy || !mail.readiness.deliveryEnabled}
                onClick={() => post("mail-retry", { id: m.id, client_id: m.client_id })}
              >
                Envoyer / reprendre cet e-mail
              </button>
            )}
          </article>
        ))}
      </section>
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
    </div>
  );
}
export function MailPreference({
  mail,
  onChange,
  busy,
}: {
  mail: any;
  onChange: (enabled: boolean) => void;
  busy: boolean;
}) {
  const L = useL();
  // Rien à proposer tant que le rappel du lundi n'est pas activé par l'agence.
  if (!mail?.weeklyEnabled) return null;
  return (
    <section className="panel">
      <h3>{L("Un petit rappel le lundi ?", "¿Un pequeño recordatorio los lunes?", "A little reminder on Mondays?")}</h3>
      <p>
        {L(
          "Une invitation à publier et un chiffre utile, chaque lundi matin. Vous pouvez l’arrêter quand vous voulez.",
          "Una invitación a publicar y un dato útil, cada lunes por la mañana. Puedes dejarlo cuando quieras.",
          "A nudge to post and a useful number, every Monday morning. You can stop anytime.",
        )}
      </p>
      <label className="optional-toggle">
        <input
          type="checkbox"
          checked={!!mail?.weeklyOptIn}
          disabled={busy}
          onChange={(e) => onChange(e.target.checked)}
        />
        {L(
          "Recevoir le rappel du lundi",
          "Recibir el recordatorio del lunes",
          "Get the Monday reminder",
        )}
      </label>
    </section>
  );
}
