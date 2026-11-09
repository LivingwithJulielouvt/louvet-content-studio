"use client";
// Collaborations entre clients du studio, et réductions « Reels avec Julie ».
// - Marque : accepter (ou non) d'être contactée par les créatrices du studio, son offre, les propositions reçues.
// - Créatrice : les marques du studio ouvertes aux collaborations, proposer une collaboration, suivre ses propositions.
// - Tous les clients : déclarer un Reel publié en collaboration avec @withjulielouvet → réduction sur la prochaine facture.
// - Agence : file de validation des Reels, et vue des propositions (avec possibilité d'en masquer une).
import "./collabs.css";
import { useState } from "react";
import { AtSign, Check, Copy, Globe, Handshake, Loader2, Mail, Send, Sparkles, X } from "lucide-react";
import { useL, useLang, type Lang } from "../lib/i18n";
import { NICHES, OPP_COUNTRIES } from "../lib/opportunities.mjs";
import { formatCents } from "../lib/pricing.mjs";
type Row = Record<string, any>;

async function api(action: string, body: Row): Promise<Row> {
  const res = await fetch("/api/studio/" + action, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Studio-Request": "1" },
    body: JSON.stringify(body),
  });
  const d: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || "Cette action n’a pas abouti.");
  return d;
}
const nicheLabel = (key: string, lang: Lang) => {
  const n: any = NICHES.find((x: any) => x.key === key);
  return n ? n[lang] || n.fr : "";
};
const countryLabel = (c: string, lang: Lang) =>
  ({
    FR: { fr: "France", es: "Francia", en: "France" },
    MX: { fr: "Mexique", es: "México", en: "Mexico" },
    US: { fr: "États-Unis", es: "Estados Unidos", en: "United States" },
    INTL: { fr: "International", es: "Internacional", en: "International" },
  })[c]?.[lang] || c;
const OFFERS: [string, Record<Lang, string>][] = [
  ["product", { fr: "Produit offert", es: "Producto de regalo", en: "Free product" }],
  ["paid", { fr: "Rémunération", es: "Pago", en: "Paid" }],
  ["affiliate", { fr: "Code promo / affiliation", es: "Código / afiliación", en: "Promo code / affiliate" }],
  ["visibility", { fr: "Échange de visibilité", es: "Intercambio de visibilidad", en: "Visibility exchange" }],
  ["other", { fr: "Autre", es: "Otro", en: "Other" }],
];
const offerLabel = (k: string, lang: Lang) => OFFERS.find((o) => o[0] === k)?.[1][lang] || k;
const dateText = (iso: string, lang: Lang) =>
  iso ? new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : lang === "es" ? "es-MX" : "en-US", { day: "numeric", month: "short" }) : "";

function LinkOut({ link }: { link: string }) {
  if (!link) return null;
  const ig = link.startsWith("@");
  return (
    <a
      className="collab-link"
      href={ig ? "https://www.instagram.com/" + link.slice(1) + "/" : link}
      target="_blank"
      rel="noopener noreferrer"
    >
      {ig ? <AtSign size={14} /> : <Globe size={14} />}{" "}
      {ig ? link : link.replace(/^https:\/\//, "").replace(/\/$/, "")}
    </a>
  );
}
function CopyMail({ email }: { email: string }) {
  const L = useL();
  const [ok, setOk] = useState(false);
  return (
    <div className="collab-mail">
      <a href={"mailto:" + email}>
        <Mail size={14} /> {email}
      </a>
      <button
        type="button"
        className="button secondary small"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(email);
            setOk(true);
            setTimeout(() => setOk(false), 1600);
          } catch {}
        }}
      >
        {ok ? <Check size={14} /> : <Copy size={14} />} {ok ? L("Copiée", "Copiado", "Copied") : L("Copier l’adresse", "Copiar el correo", "Copy address")}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Marque : Mon compte › Collaborations                                */
/* ------------------------------------------------------------------ */
/** Où en est l'offre de la marque : en relecture, visible, refusée. */
function ReviewStatus({ p }: { p: Row }) {
  const L = useL();
  if (p.review_status === "approved")
    return (
      <p className="collab-review ok" role="status">
        <Check size={15} /> {L("Visible par les créatrices", "Visible para las creadoras", "Visible to creators")}
      </p>
    );
  if (p.review_status === "refused")
    return (
      <p className="collab-review refused" role="status">
        <X size={15} />{" "}
        {L("Refusée", "Rechazada", "Not approved")}
        {p.review_reason ? " : " + p.review_reason : ""}
        {L(" — modifiez votre offre pour la renvoyer.", " — modifica tu oferta para enviarla de nuevo.", " — edit your offer to send it again.")}
        {p.has_approved && (
          <span className="collab-small">
            {" "}
            {L("Votre version précédente reste visible.", "Tu versión anterior sigue visible.", "Your previous version stays visible.")}
          </span>
        )}
      </p>
    );
  return (
    <p className="collab-review pending" role="status">
      <Loader2 size={15} />{" "}
      {p.has_approved
        ? L(
            "Votre nouvelle version est en cours de validation ; l’ancienne reste visible.",
            "Tu nueva versión está en revisión; la anterior sigue visible.",
            "Your new version is being reviewed; the previous one stays visible.",
          )
        : L("En attente de validation par l’agence", "Pendiente de aprobación por la agencia", "Waiting for the agency’s approval")}
    </p>
  );
}

export function BrandCollabs({ data, client, refresh }: { data: Row; client: Row; refresh: () => Promise<any> }) {
  const accountEmail: string = data.user?.email || "";
  const L = useL(),
    lang = useLang();
  const p = data.collabProfile || {};
  const [form, setForm] = useState<Row>({
    enabled: !!p.enabled,
    offer_types: p.offer_types || [],
    offer: p.offer || "",
    niche: p.niche || "",
    countries: p.countries?.length ? p.countries : [client?.config?.country || "MX"].filter((c: string) => OPP_COUNTRIES.includes(c)),
    looking_for: p.looking_for || "",
    link: p.link || "",
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState("");
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const toggleIn = (k: string, v: string) =>
    set(k, form[k].includes(v) ? form[k].filter((x: string) => x !== v) : [...form[k], v]);
  async function save(next: Row) {
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const r = await api("collab-profile-save", { client_id: client.id, ...next });
      setForm(next);
      setSaved(
        !next.enabled
          ? L("C’est enregistré : votre marque n’apparaît plus auprès des créatrices.", "Guardado: tu marca ya no aparece para las creadoras.", "Saved: your brand no longer appears to creators.")
          : r.profile?.review_status === "approved"
            ? L("C’est enregistré : les créatrices du studio voient votre offre.", "Guardado: las creadoras del estudio ven tu oferta.", "Saved: studio creators can see your offer.")
            : L(
                "C’est envoyé : l’agence relit votre offre avant de la montrer aux créatrices.",
                "Enviado: la agencia revisa tu oferta antes de mostrarla a las creadoras.",
                "Sent: the agency reviews your offer before showing it to creators.",
              ),
      );
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const received: Row[] = data.collabReceived || [];
  const open = received.filter((r) => r.status === "open");
  return (
    <section className="collabs">
      <div className="collab-card">
        <div className="collab-switch-row">
          <div>
            <h3>{L("Collaborations avec des créatrices", "Colaboraciones con creadoras", "Collaborations with creators")}</h3>
            <p className="muted">
              {L(
                "Des créatrices de contenu utilisent aussi le studio. Si vous le souhaitez, elles peuvent vous proposer une collaboration. Votre adresse e-mail n’est jamais affichée : vous choisissez à qui la transmettre.",
                "Creadoras de contenido también usan el estudio. Si quieres, pueden proponerte una colaboración. Tu correo nunca se muestra: tú eliges a quién dárselo.",
                "Content creators also use the studio. If you’d like, they can propose a collaboration to you. Your email is never shown: you choose who gets it.",
              )}
            </p>
          </div>
        </div>
        <label className="collab-consent">
          <input
            type="checkbox"
            checked={form.enabled}
            disabled={busy}
            onChange={(e) => {
              const next = { ...form, enabled: e.target.checked };
              // Désactiver s'enregistre tout de suite ; activer demande d'abord l'offre.
              if (!e.target.checked) save(next);
              else set("enabled", true);
            }}
          />
          <span>{L("Les créatrices du studio peuvent me proposer une collaboration", "Las creadoras del estudio pueden proponerme una colaboración", "Studio creators can propose a collaboration to me")}</span>
        </label>
        {p.enabled && <ReviewStatus p={p} />}
        {p.enabled && p.consent_at && (
          <p className="collab-small">
            {L("Activé le", "Activado el", "Turned on")} {new Date(p.consent_at).toLocaleDateString(lang === "fr" ? "fr-FR" : lang === "es" ? "es-MX" : "en-US")}
          </p>
        )}
        {form.enabled && (
          <form
            className="collab-form"
            onSubmit={(e) => {
              e.preventDefault();
              save({ ...form, enabled: true });
            }}
          >
            <fieldset className="collab-chips">
              <legend>{L("Ce que vous proposez", "Lo que ofreces", "What you offer")}</legend>
              {OFFERS.map(([k, label]) => (
                <label key={k} className={"collab-chip " + (form.offer_types.includes(k) ? "on" : "")}>
                  <input type="checkbox" checked={form.offer_types.includes(k)} onChange={() => toggleIn("offer_types", k)} />
                  {label[lang]}
                </label>
              ))}
            </fieldset>
            <label>
              <span>{L("Votre offre, en une ou deux phrases", "Tu oferta, en una o dos frases", "Your offer, in a sentence or two")} *</span>
              <textarea
                rows={3}
                maxLength={280}
                value={form.offer}
                onChange={(e) => set("offer", e.target.value)}
                placeholder={L(
                  "Ex. : un coffret offert et un code promo de 15 % pour votre communauté.",
                  "Ej.: un set de regalo y un código del 15 % para tu comunidad.",
                  "E.g. a free gift box and a 15% promo code for your community.",
                )}
              />
              <small>{form.offer.length}/280</small>
            </label>
            <div className="collab-two">
              <label>
                <span>{L("Votre univers", "Tu sector", "Your field")} *</span>
                <select value={form.niche} onChange={(e) => set("niche", e.target.value)}>
                  <option value="">{L("Choisir…", "Elegir…", "Choose…")}</option>
                  {NICHES.map((n: any) => (
                    <option key={n.key} value={n.key}>
                      {n[lang]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>{L("Votre Instagram ou site · facultatif", "Tu Instagram o sitio · opcional", "Your Instagram or site · optional")}</span>
                <input value={form.link} onChange={(e) => set("link", e.target.value)} placeholder="@votremarque" />
              </label>
            </div>
            <fieldset className="collab-chips">
              <legend>{L("Créatrices de quels pays ?", "¿Creadoras de qué países?", "Creators from which countries?")}</legend>
              {OPP_COUNTRIES.map((c: string) => (
                <label key={c} className={"collab-chip " + (form.countries.includes(c) ? "on" : "")}>
                  <input type="checkbox" checked={form.countries.includes(c)} onChange={() => toggleIn("countries", c)} />
                  {countryLabel(c, lang)}
                </label>
              ))}
            </fieldset>
            <label>
              <span>{L("Ce que vous recherchez · facultatif", "Lo que buscas · opcional", "What you’re looking for · optional")}</span>
              <input
                maxLength={200}
                value={form.looking_for}
                onChange={(e) => set("looking_for", e.target.value)}
                placeholder={L("Ex. : des Reels recettes, une créatrice à Monterrey…", "Ej.: Reels de recetas, una creadora en Monterrey…", "E.g. recipe Reels, a creator in your city…")}
              />
            </label>
            <div className="collab-actions">
              <button className="button primary" disabled={busy}>
                {busy ? <Loader2 size={15} className="spin" /> : <Check size={15} />}{" "}
                {p.enabled ? L("Enregistrer", "Guardar", "Save") : L("Envoyer mon offre", "Enviar mi oferta", "Send my offer")}
              </button>
              {!p.enabled && (
                <button type="button" className="text-link" onClick={() => set("enabled", false)}>
                  {L("Annuler", "Cancelar", "Cancel")}
                </button>
              )}
            </div>
            <p className="collab-small">
              {L(
                "Julie relit votre offre avant qu’elle soit visible (sous 48\u00a0h).",
                "Julie revisa tu oferta antes de que sea visible (en 48 h).",
                "Julie reviews your offer before it goes live (within 48 h).",
              )}{" "}
              {L(
                "Vous pouvez mettre en pause à tout moment : votre marque disparaît aussitôt de la liste.",
                "Puedes pausar en cualquier momento: tu marca desaparece de inmediato de la lista.",
                "You can pause anytime: your brand disappears from the list right away.",
              )}
            </p>
          </form>
        )}
        {saved && <p className="collab-ok">{saved}</p>}
        {error && (
          <p role="alert" className="error-inline">
            {error}
          </p>
        )}
      </div>

      <div className="collab-card">
        <h3>
          {L("Propositions reçues", "Propuestas recibidas", "Proposals received")}
          {open.length > 0 && <span className="collab-count">{open.length}</span>}
        </h3>
        {!received.length ? (
          <p className="muted">
            {p.enabled || form.enabled
              ? L("Aucune proposition pour l’instant. Elles arriveront ici, et vous serez prévenue.", "Aún no hay propuestas. Llegarán aquí y te avisaremos.", "No proposals yet. They’ll arrive here and you’ll be notified.")
              : L("Activez les collaborations pour recevoir des propositions.", "Activa las colaboraciones para recibir propuestas.", "Turn on collaborations to receive proposals.")}
          </p>
        ) : (
          <div className="collab-list">
            {received.map((r) => (
              <ReceivedCard key={r.id} r={r} client={client} accountEmail={accountEmail} refresh={refresh} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
function ReceivedCard({ r, client, accountEmail, refresh }: { r: Row; client: Row; accountEmail: string; refresh: () => Promise<any> }) {
  const L = useL(),
    lang = useLang();
  const [mode, setMode] = useState<"" | "accept" | "decline">(""),
    [reply, setReply] = useState(""),
    [email, setEmail] = useState<string>(client?.config?.contactEmail || accountEmail),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function send() {
    setBusy(true);
    setError("");
    try {
      await api("collab-respond", { client_id: client.id, id: r.id, decision: mode, reply, contact_email: email });
      setMode("");
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={"collab-item st-" + r.status}>
      <header>
        <div>
          <b>{r.creator_name}</b>
          <small>
            {r.creator_topic ? r.creator_topic + " · " : ""}
            {dateText(r.created, lang)}
          </small>
        </div>
        <StatusBadge status={r.status} />
      </header>
      <p className="collab-msg">{r.message}</p>
      <div className="collab-links">
        <LinkOut link={"@" + r.instagram} />
        {r.portfolio && <LinkOut link={r.portfolio} />}
      </div>
      {r.status === "open" && !mode && (
        <div className="collab-actions">
          <button className="button primary small" onClick={() => setMode("accept")}>
            <Check size={14} /> {L("Intéressée", "Me interesa", "Interested")}
          </button>
          <button className="button secondary small" onClick={() => setMode("decline")}>
            {L("Pas pour le moment", "Por ahora no", "Not right now")}
          </button>
        </div>
      )}
      {mode && (
        <div className="collab-reply">
          {mode === "accept" && (
            <label>
              <span>{L("Adresse e-mail à lui transmettre", "Correo que le compartes", "Email address to share")} *</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@votremarque.com" />
            </label>
          )}
          <label>
            <span>{L("Votre réponse · facultatif", "Tu respuesta · opcional", "Your reply · optional")}</span>
            <textarea
              rows={2}
              maxLength={400}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={
                mode === "accept"
                  ? L("Ex. : Avec plaisir ! Écrivez-nous pour en parler.", "Ej.: ¡Con gusto! Escríbenos para hablarlo.", "E.g. We’d love to! Email us to discuss.")
                  : L("Ex. : Merci, pas cette saison.", "Ej.: Gracias, esta temporada no.", "E.g. Thank you, not this season.")
              }
            />
          </label>
          <div className="collab-actions">
            <button className="button primary small" disabled={busy} onClick={send}>
              {busy ? <Loader2 size={14} className="spin" /> : <Send size={14} />}{" "}
              {mode === "accept" ? L("Envoyer mon contact", "Enviar mi contacto", "Send my contact") : L("Envoyer la réponse", "Enviar la respuesta", "Send reply")}
            </button>
            <button className="text-link" onClick={() => setMode("")}>
              {L("Annuler", "Cancelar", "Cancel")}
            </button>
          </div>
        </div>
      )}
      {r.status !== "open" && (r.reply || r.contact_email) && (
        <p className="collab-small">
          {L("Votre réponse\u00a0:", "Tu respuesta:", "Your reply:")} {r.reply || "—"}
          {r.contact_email ? " · " + r.contact_email : ""}
        </p>
      )}
      {error && (
        <p role="alert" className="error-inline">
          {error}
        </p>
      )}
    </article>
  );
}
function StatusBadge({ status }: { status: string }) {
  const L = useL();
  const label =
    status === "accepted"
      ? L("Intéressée", "Le interesa", "Interested")
      : status === "declined"
        ? L("Pas pour le moment", "Por ahora no", "Not right now")
        : L("En attente", "Pendiente", "Pending");
  return <span className={"collab-badge st-" + status}>{label}</span>;
}

/* ------------------------------------------------------------------ */
/* Créatrice : Opportunités › Marques du studio                        */
/* ------------------------------------------------------------------ */
export function StudioBrands({ data, client, refresh }: { data: Row; client: Row; refresh: () => Promise<any> }) {
  const L = useL(),
    lang = useLang();
  const brands: Row[] = data.collabBrands || [];
  const sent: Row[] = data.collabSent || [];
  const [proposing, setProposing] = useState<string>("");
  if (!brands.length && !sent.length) return null;
  const last = (id: string) => sent.find((s) => s.brand_client_id === id);
  return (
    <section className="collab-studio" aria-labelledby="studio-brands-title">
      <div className="collab-studio-head">
        <Handshake size={18} aria-hidden="true" />
        <div>
          <h3 id="studio-brands-title">{L("Marques du studio", "Marcas del estudio", "Studio brands")}</h3>
          <p className="muted">
            {L(
              "Ces marques utilisent le studio et acceptent les propositions de collaboration. Leur contact s’affiche quand elles répondent « Intéressée ».",
              "Estas marcas usan el estudio y aceptan propuestas de colaboración. Su contacto aparece cuando responden “Me interesa”.",
              "These brands use the studio and welcome collaboration proposals. Their contact appears once they reply “Interested”.",
            )}
          </p>
        </div>
      </div>
      {brands.length > 0 && (
        <div className="collab-grid">
          {brands.map((b) => {
            const s = last(b.brand_client_id);
            return (
              <article key={b.brand_client_id} className="collab-brand">
                <header>
                  <div>
                    <h4>{b.name}</h4>
                    <small>
                      {nicheLabel(b.niche, lang)}
                      {b.countries?.length ? " · " + b.countries.map((c: string) => countryLabel(c, lang)).join(", ") : ""}
                    </small>
                  </div>
                  <span className="collab-badge studio">{L("Studio", "Estudio", "Studio")}</span>
                </header>
                <div className="collab-offer-tags">
                  {(b.offer_types || []).map((k: string) => (
                    <span key={k}>{offerLabel(k, lang)}</span>
                  ))}
                </div>
                <p className="collab-msg">{b.offer}</p>
                {b.looking_for && (
                  <p className="collab-small">
                    <b>{L("Recherche\u00a0:", "Busca:", "Looking for:")}</b> {b.looking_for}
                  </p>
                )}
                <LinkOut link={b.link} />
                {s?.status === "accepted" ? (
                  <AcceptedBox s={s} />
                ) : s?.status === "open" ? (
                  <p className="collab-small">
                    <StatusBadge status="open" /> {L("Proposition envoyée le", "Propuesta enviada el", "Proposal sent on")} {dateText(s.created, lang)}
                  </p>
                ) : proposing === b.brand_client_id ? (
                  <ProposeForm brand={b} client={client} onDone={async () => (setProposing(""), await refresh())} onCancel={() => setProposing("")} />
                ) : (
                  <>
                    {s?.status === "declined" && (
                      <p className="collab-small">
                        <StatusBadge status="declined" /> {s.reply}
                      </p>
                    )}
                    <button className="button primary small" onClick={() => setProposing(b.brand_client_id)}>
                      <Sparkles size={14} /> {L("Proposer une collaboration", "Proponer una colaboración", "Propose a collaboration")}
                    </button>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
      {sent.some((s) => !brands.find((b) => b.brand_client_id === s.brand_client_id)) && (
        <details className="collab-history">
          <summary>{L("Mes autres propositions", "Mis otras propuestas", "My other proposals")}</summary>
          {sent
            .filter((s) => !brands.find((b) => b.brand_client_id === s.brand_client_id))
            .map((s) => (
              <div key={s.id} className="collab-item">
                <header>
                  <b>{s.brand_name}</b>
                  <StatusBadge status={s.status} />
                </header>
                {s.status === "accepted" ? <AcceptedBox s={s} /> : s.reply ? <p className="collab-small">{s.reply}</p> : null}
              </div>
            ))}
        </details>
      )}
    </section>
  );
}
function AcceptedBox({ s }: { s: Row }) {
  const L = useL();
  return (
    <div className="collab-accepted">
      <p>
        <b>{L("La marque est intéressée !", "¡A la marca le interesa!", "The brand is interested!")}</b>
        {s.reply ? " " + L("«\u00a0" + s.reply + "\u00a0»", "«" + s.reply + "»", "“" + s.reply + "”") : ""}
      </p>
      {s.contact_email && <CopyMail email={s.contact_email} />}
    </div>
  );
}
function ProposeForm({ brand, client, onDone, onCancel }: { brand: Row; client: Row; onDone: () => any; onCancel: () => void }) {
  const L = useL();
  const strategy = client?.config?.creatorStrategy || {};
  const [message, setMessage] = useState(""),
    [instagram, setInstagram] = useState<string>(client?.config?.instagram || strategy.instagram || ""),
    [portfolio, setPortfolio] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="collab-reply"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api("collab-request", { client_id: client.id, brand_client_id: brand.brand_client_id, message, instagram, portfolio });
          await onDone();
        } catch (err: any) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        <span>{L("Votre idée", "Tu idea", "Your idea")} *</span>
        <textarea
          rows={4}
          maxLength={600}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={L(
            "Présentez-vous en deux phrases et proposez une idée concrète : un Reel, des stories…",
            "Preséntate en dos frases y propone una idea concreta: un Reel, historias…",
            "Introduce yourself in two sentences and suggest a concrete idea: a Reel, stories…",
          )}
        />
        <small>{message.length}/600</small>
      </label>
      <div className="collab-two">
        <label>
          <span>{L("Votre Instagram", "Tu Instagram", "Your Instagram")} *</span>
          <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@votrecompte" />
        </label>
        <label>
          <span>{L("Portfolio · facultatif", "Portafolio · opcional", "Portfolio · optional")}</span>
          <input value={portfolio} onChange={(e) => setPortfolio(e.target.value)} placeholder="https://" />
        </label>
      </div>
      <div className="collab-actions">
        <button className="button primary small" disabled={busy}>
          {busy ? <Loader2 size={14} className="spin" /> : <Send size={14} />} {L("Envoyer ma proposition", "Enviar mi propuesta", "Send my proposal")}
        </button>
        <button type="button" className="text-link" onClick={onCancel}>
          {L("Annuler", "Cancelar", "Cancel")}
        </button>
      </div>
      {error && (
        <p role="alert" className="error-inline">
          {error}
        </p>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Tous les clients : Reels avec Julie                                 */
/* ------------------------------------------------------------------ */
export function ReelCollabPanel({ data, client, refresh }: { data: Row; client: Row; refresh: () => Promise<any> }) {
  const L = useL(),
    lang = useLang();
  const rc = data.reelCollab;
  const [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ok, setOk] = useState(false);
  if (!rc) return null;
  const amount = formatCents(rc.reward_cents, rc.currency, lang);
  const account = "@" + rc.account;
  return (
    <section className="collab-card reel-card" aria-labelledby="reel-title">
      <h3 id="reel-title">
        {L("Un Reel avec Julie", "Un Reel con Julie", "A Reel with Julie")} · {amount} {L("de réduction", "de descuento", "off")}
      </h3>
      <p>
        {L(
          `Créez un Reel en collaboration avec ${account}, la fondatrice de l’agence : ${amount} de réduction par Reel sur votre prochaine facture.`,
          `Crea un Reel en colaboración con ${account}, la fundadora de la agencia: ${amount} de descuento por Reel en tu próxima factura.`,
          `Create a Reel in collaboration with ${account}, the agency’s founder: ${amount} off your next invoice for each Reel.`,
        )}
      </p>
      <ol className="reel-steps">
        <li>{L("Préparez votre Reel.", "Prepara tu Reel.", "Get your Reel ready.")}</li>
        <li>
          {L(
            `Avant de publier, touchez « Taguer des personnes » › « Inviter un collaborateur » et choisissez ${account}.`,
            `Antes de publicar, toca “Etiquetar personas” › “Invitar a un colaborador” y elige ${account}.`,
            `Before posting, tap “Tag people” › “Invite collaborator” and pick ${account}.`,
          )}
        </li>
        <li>{L("Publiez, puis collez ici le lien du Reel.", "Publica y luego pega aquí el enlace del Reel.", "Post it, then paste the Reel link here.")}</li>
      </ol>
      <form
        className="reel-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setOk(false);
          try {
            await api("reel-claim", { client_id: client.id, url });
            setUrl("");
            setOk(true);
            await refresh();
          } catch (err: any) {
            setError(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.instagram.com/reel/…"
          aria-label={L("Lien du Reel", "Enlace del Reel", "Reel link")}
        />
        <button className="button primary" disabled={busy || !url.trim()}>
          {busy ? <Loader2 size={15} className="spin" /> : <Send size={15} />} {L("Envoyer", "Enviar", "Submit")}
        </button>
      </form>
      {ok && (
        <p className="collab-ok">
          {L("Merci ! L’agence vérifie votre Reel, en général sous quelques jours.", "¡Gracias! La agencia revisa tu Reel, normalmente en unos días.", "Thank you! The agency checks your Reel, usually within a few days.")}
        </p>
      )}
      {error && (
        <p role="alert" className="error-inline">
          {error}
        </p>
      )}
      {rc.claims?.length > 0 && (
        <ul className="reel-claims">
          {rc.claims.map((c: Row) => (
            <li key={c.id}>
              <a href={c.url} target="_blank" rel="noopener noreferrer">
                {c.url.replace("https://www.instagram.com/", "instagram.com/")}
              </a>
              <span className={"reel-status st-" + c.status}>
                {c.status === "pending"
                  ? L("En attente de vérification", "En revisión", "Awaiting review")
                  : c.status === "refused"
                    ? L("Refusé", "Rechazado", "Not approved") + (c.reason ? " · " + c.reason : "")
                    : L(
                        `Validé · ${formatCents(c.amount_cents, c.currency, lang)} ${c.status === "credited" ? "déduits de votre prochaine facture" : "seront déduits de votre prochaine facture"}`,
                        `Validado · ${formatCents(c.amount_cents, c.currency, lang)} ${c.status === "credited" ? "descontados de tu próxima factura" : "se descontarán de tu próxima factura"}`,
                        `Approved · ${formatCents(c.amount_cents, c.currency, lang)} ${c.status === "credited" ? "off your next invoice" : "will come off your next invoice"}`,
                      )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="collab-small">
        {L(
          `Jusqu’à ${rc.cap} Reels par mois (${rc.month_count}/${rc.cap} ce mois-ci). Le Reel doit rester public, avec la collaboration acceptée.`,
          `Hasta ${rc.cap} Reels por mes (${rc.month_count}/${rc.cap} este mes). El Reel debe seguir público, con la colaboración aceptada.`,
          `Up to ${rc.cap} Reels a month (${rc.month_count}/${rc.cap} this month). The Reel must stay public, with the collaboration accepted.`,
        )}
      </p>
    </section>
  );
}
/** Une ligne sur l'accueil, une fois le guide terminé. */
export function ReelTeaser({ data, onOpen }: { data: Row; onOpen: () => void }) {
  const L = useL(),
    lang = useLang();
  const rc = data.reelCollab;
  if (!rc) return null;
  const amount = formatCents(rc.reward_cents, rc.currency, lang);
  return (
    <button className="reel-teaser" onClick={onOpen}>
      <Sparkles size={16} aria-hidden="true" />
      <span>
        {L(
          `Un Reel avec @${rc.account} = ${amount} de réduction sur votre abonnement.`,
          `Un Reel con @${rc.account} = ${amount} de descuento en tu suscripción.`,
          `A Reel with @${rc.account} = ${amount} off your plan.`,
        )}
      </span>
      <b>{L("En savoir plus", "Saber más", "Learn more")}</b>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Agence (en français)                                                */
/* ------------------------------------------------------------------ */
export function AgencyCollabs({ data, refresh }: { data: Row; refresh: () => Promise<any> }) {
  const queue: Row[] = data.reelQueue || [];
  const reqs: Row[] = data.collabOverview || [];
  const pending = queue.filter((c) => c.status === "pending");
  const offers: Row[] = data.collabPendingOffers || [];
  return (
    <section className="collabs">
      <div className={"collab-card" + (offers.length ? " collab-card-alert" : "")} id="offres-a-valider">
        <h3>
          Offres à valider {offers.length > 0 && <span className="collab-count">{offers.length}</span>}
        </h3>
        <p className="muted">
          Une marque qui active les collaborations ou modifie son offre attend votre accord. Tant que vous n’avez pas validé, les
          créatrices ne voient rien de nouveau (la dernière version validée reste en ligne).
        </p>
        {!offers.length ? (
          <p className="muted">Aucune offre en attente.</p>
        ) : (
          <div className="offer-review-list">
            {offers.map((o) => (
              <OfferReview key={o.client_id + o.updated} o={o} refresh={refresh} />
            ))}
          </div>
        )}
      </div>
      <div className="collab-card">
        <h3>
          Reels avec @withjulielouvet {pending.length > 0 && <span className="collab-count">{pending.length}</span>}
        </h3>
        <p className="muted">
          Vérifiez sur Instagram que le Reel est public et que la collaboration avec @withjulielouvet est acceptée, puis validez. La
          remise est déduite de la prochaine facture du client (plafond : {data.reelCap || 10} Reels par client et par mois).
        </p>
        {!queue.length ? (
          <p className="muted">Aucun Reel déclaré pour l’instant.</p>
        ) : (
          <div className="opps-table-wrap">
            <table className="opps-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Reel</th>
                  <th>Déclaré le</th>
                  <th>Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {queue.map((c) => (
                  <ReelRow key={c.id} c={c} refresh={refresh} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="collab-card">
        <h3>Collaborations marques ↔ créatrices</h3>
        <p className="muted">
          {data.collabOpenBrands || 0} marque(s) ouverte(s) aux propositions. Vous pouvez masquer une proposition déplacée : la marque ne la
          voit plus.
        </p>
        {!reqs.length ? (
          <p className="muted">Aucune proposition pour l’instant.</p>
        ) : (
          <div className="opps-table-wrap">
            <table className="opps-table">
              <thead>
                <tr>
                  <th>Créatrice</th>
                  <th>Marque</th>
                  <th>Message</th>
                  <th>Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {reqs.map((r) => (
                  <tr key={r.id} className={r.hidden ? "off" : ""}>
                    <td>
                      {r.creator_name}
                      <small>@{r.instagram}</small>
                    </td>
                    <td>{r.brand_name}</td>
                    <td>
                      <small>{r.message}</small>
                    </td>
                    <td>{r.hidden ? "Masquée" : r.status === "accepted" ? "Intéressée" : r.status === "declined" ? "Pas pour le moment" : "En attente"}</td>
                    <td className="opps-row-actions">
                      <button
                        className="text-link"
                        onClick={async () => {
                          await api("collab-hide", { id: r.id, hidden: !r.hidden });
                          await refresh();
                        }}
                      >
                        {r.hidden ? "Réafficher" : "Masquer"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
const OFFER_FIELD_LABELS: [string, string][] = [
  ["offer", "Offre"],
  ["offer_types", "Type d’offre"],
  ["niche", "Univers"],
  ["countries", "Pays"],
  ["looking_for", "Recherche"],
  ["link", "Lien"],
];
function offerFieldText(k: string, v: any) {
  if (k === "offer_types") return (v || []).map((x: string) => offerLabel(x, "fr")).join(", ");
  if (k === "countries") return (v || []).map((x: string) => countryLabel(x, "fr")).join(", ");
  if (k === "niche") return nicheLabel(v, "fr");
  return v || "";
}
/** Une offre en attente : version soumise, et ce qui change par rapport à la version validée. */
function OfferReview({ o, refresh }: { o: Row; refresh: () => Promise<any> }) {
  const [reason, setReason] = useState(""),
    [refusing, setRefusing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function review(decision: string) {
    setBusy(true);
    setError("");
    try {
      await api("collab-offer-review", { client_id: o.client_id, decision, reason });
      await refresh();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <article className="offer-review">
      <header>
        <b>{o.brand_name}</b>
        <span className="opps-status">{o.approved ? "Modification" : "Nouvelle offre"}</span>
        <small>Envoyée le {new Date(o.updated).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</small>
      </header>
      <dl>
        {OFFER_FIELD_LABELS.map(([k, label]) => {
          const now = offerFieldText(k, o.submitted?.[k]),
            before = o.approved ? offerFieldText(k, o.approved[k]) : null;
          const changed = before !== null && before !== now;
          if (!now && !changed) return null;
          return (
            <div key={k} className={changed ? "changed" : ""}>
              <dt>{label}</dt>
              <dd>
                {now || <i>(vide)</i>}
                {changed && <del>Avant : {before || "(vide)"}</del>}
              </dd>
            </div>
          );
        })}
      </dl>
      {refusing && (
        <label className="offer-review-reason">
          <span>Motif pour la marque · facultatif</span>
          <input maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. : précisez le montant de la rémunération." />
        </label>
      )}
      <div className="collab-actions">
        {!refusing ? (
          <>
            <button className="button primary" disabled={busy} onClick={() => review("approve")}>
              {busy ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Approuver
            </button>
            <button className="button secondary" disabled={busy} onClick={() => setRefusing(true)}>
              <X size={15} /> Refuser
            </button>
          </>
        ) : (
          <>
            <button className="button danger-outline" disabled={busy} onClick={() => review("refuse")}>
              {busy ? <Loader2 size={15} className="spin" /> : <X size={15} />} Confirmer le refus
            </button>
            <button className="text-link" disabled={busy} onClick={() => setRefusing(false)}>
              Annuler
            </button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="error-inline">
          {error}
        </p>
      )}
    </article>
  );
}
function ReelRow({ c, refresh }: { c: Row; refresh: () => Promise<any> }) {
  const [reason, setReason] = useState(""),
    [refusing, setRefusing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function review(decision: string) {
    setBusy(true);
    setError("");
    try {
      await api("reel-review", { id: c.id, decision, reason });
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <tr className={c.status === "refused" ? "off" : ""}>
      <td>{c.client_name}</td>
      <td>
        <a href={c.url} target="_blank" rel="noopener noreferrer">
          {c.url.replace("https://www.instagram.com/", "")}
        </a>
      </td>
      <td>{new Date(c.created).toLocaleDateString("fr-FR")}</td>
      <td>
        {c.status === "pending"
          ? "À vérifier"
          : c.status === "refused"
            ? "Refusé" + (c.reason ? " · " + c.reason : "")
            : (c.status === "credited" ? "Crédité · " : "Validé · ") + formatCents(c.amount_cents, c.currency, "fr")}
        {c.credit_error && c.status !== "credited" && (
          <small className="credit-error">Crédit Stripe non appliqué : {c.credit_error} — réessai automatique</small>
        )}
        {error && <small className="error-inline">{error}</small>}
      </td>
      <td className="opps-row-actions">
        {c.status === "pending" && (
          <div>
            {refusing ? (
              <>
                <input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="Motif (facultatif)" />
                <button className="button secondary small" disabled={busy} onClick={() => review("refuse")}>
                  Refuser
                </button>
                <button className="icon-button" aria-label="Annuler" onClick={() => setRefusing(false)}>
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <button className="button primary small" disabled={busy} onClick={() => review("approve")}>
                  <Check size={14} /> Valider
                </button>
                <button className="text-link" onClick={() => setRefusing(true)}>
                  Refuser
                </button>
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
