"use client";
// Opportunités : marques à contacter, triées par niche.
// - Créatrice : lecture du carnet, copie de l'adresse, suivi privé (statut + note), modèle de premier message.
// - Agence : ajout, modification, désactivation, import CSV avec aperçu.
import "./opportunities.css";
import { useMemo, useRef, useState } from "react";
import {
  Copy,
  Check,
  Mail,
  AtSign,
  Globe,
  Search,
  Upload,
  Plus,
  Loader2,
  MessageCircle,
  Pencil,
  X,
} from "lucide-react";
import { useL, useLang, type Lang } from "../lib/i18n";
import { NICHES, OPP_COUNTRIES, OPP_STATUSES } from "../lib/opportunities.mjs";
import { StudioBrands } from "./collabs";
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
  const n = NICHES.find((x) => x.key === key) || NICHES[NICHES.length - 1];
  return n[lang] || n.fr;
};
const countryLabel = (c: string, lang: Lang) =>
  ({
    FR: { fr: "France", es: "Francia", en: "France" },
    MX: { fr: "Mexique", es: "México", en: "Mexico" },
    US: { fr: "États-Unis", es: "Estados Unidos", en: "United States" },
    INTL: { fr: "International", es: "Internacional", en: "International" },
  })[c]?.[lang] || c;
const statusLabel = (s: string, lang: Lang) =>
  ({
    todo: { fr: "À contacter", es: "Por contactar", en: "To contact" },
    contacted: { fr: "Contactée", es: "Contactada", en: "Contacted" },
    replied: { fr: "Réponse reçue", es: "Respondió", en: "Replied" },
    partner: { fr: "Partenariat", es: "Colaboración", en: "Partnership" },
    declined: {
      fr: "Pas intéressée",
      es: "No interesada",
      en: "Not interested",
    },
  })[s]?.[lang] || s;

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement("textarea");
    t.value = text;
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand("copy");
    t.remove();
    return ok;
  }
}
function CopyButton({
  text,
  label,
  done,
}: {
  text: string;
  label: string;
  done: string;
}) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="button secondary small"
      onClick={async () => {
        if (await copyText(text)) {
          setOk(true);
          setTimeout(() => setOk(false), 1800);
        }
      }}
    >
      {ok ? <Check size={14} /> : <Copy size={14} />} {ok ? done : label}
    </button>
  );
}

/** Premier message, dans la langue de la créatrice, rempli avec son profil. */
function pitchText(client: Row, lang: Lang) {
  const s = client?.config?.creatorStrategy || {};
  const name = s.displayName || client?.config?.brand || client?.name || "";
  const topic = (s.pillars || [])[0] || "";
  const audience = s.audience || "";
  const fill = (v: string, ph: string) => v || ph;
  if (lang === "es")
    return `Hola equipo de [MARCA]:\n\nSoy ${fill(name, "[TU NOMBRE]")}, creadora de contenido sobre ${fill(topic, "[TU TEMA]")}. Mi comunidad${audience ? ` (${audience})` : ""} confía en mis recomendaciones, y su marca encaja de forma natural con lo que comparto.\n\nMe encantaría proponerles una colaboración: un reel y tres historias mostrando [PRODUCTO] en mi día a día. Puedo enviarles mis estadísticas y ejemplos de trabajos anteriores.\n\n¿Con quién puedo hablar de esto?\n\nGracias y hasta pronto,\n${fill(name, "[TU NOMBRE]")}`;
  if (lang === "en")
    return `Hi [BRAND] team,\n\nI’m ${fill(name, "[YOUR NAME]")}, a content creator sharing ${fill(topic, "[YOUR TOPIC]")}. My community${audience ? ` (${audience})` : ""} trusts my recommendations, and your brand fits naturally with what I share.\n\nI’d love to suggest a collaboration: one reel and three stories featuring [PRODUCT] in my everyday life. Happy to send my stats and examples of past work.\n\nWho would be the right person to talk to?\n\nThank you,\n${fill(name, "[YOUR NAME]")}`;
  return `Bonjour l’équipe [MARQUE],\n\nJe suis ${fill(name, "[VOTRE NOM]")}, créatrice de contenu autour de ${fill(topic, "[VOTRE THÈME]")}. Ma communauté${audience ? ` (${audience})` : ""} fait confiance à mes recommandations, et votre marque correspond naturellement à ce que je partage.\n\nJ’aimerais vous proposer une collaboration : un reel et trois stories autour de [PRODUIT] dans mon quotidien. Je peux vous envoyer mes statistiques et des exemples de collaborations.\n\nÀ qui puis-je en parler ?\n\nMerci et à bientôt,\n${fill(name, "[VOTRE NOM]")}`;
}

/* ------------------------------------------------------------------ */
/* Créatrice                                                           */
/* ------------------------------------------------------------------ */
export default function Opportunities({
  data,
  client,
  refresh,
}: {
  data: Row;
  client: Row;
  refresh: () => Promise<any>;
}) {
  const L = useL(),
    lang = useLang();
  const list: Row[] = data.opportunities || [];
  const statusMap = useMemo(
    () =>
      Object.fromEntries(
        (data.opportunityStatus || []).map((s: Row) => [s.opportunity_id, s]),
      ),
    [data.opportunityStatus],
  );
  const [niche, setNiche] = useState(""),
    [country, setCountry] = useState(""),
    [query, setQuery] = useState(""),
    [only, setOnly] = useState(""),
    [showPitch, setShowPitch] = useState(false);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const o of list) c[o.niche] = (c[o.niche] || 0) + 1;
    return c;
  }, [list]);
  const shown = list.filter((o) => {
    if (niche && o.niche !== niche) return false;
    if (country && o.country !== country) return false;
    if (only && (statusMap[o.id]?.status || "todo") !== only) return false;
    if (query) {
      const q = query.toLowerCase();
      if (
        ![o.brand, o.instagram, o.email, o.note, ...(o.tags || [])]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
        return false;
    }
    return true;
  });
  const pitch = pitchText(client, lang);

  // Abonnement pas à jour : pas de carnet de marques, mais un chemin clair vers « Mon compte › Abonnement ».
  if (data.opportunitiesLocked)
    return (
      <section className="opps">
        <div className="opps-empty">
          <h3>{L("Abonnement à mettre à jour", "Suscripción por actualizar", "Subscription to update")}</h3>
          <p>
            {L(
              "Votre abonnement doit être à jour pour voir les marques à contacter.",
              "Tu suscripción debe estar al día para ver las marcas por contactar.",
              "Your subscription needs to be up to date to see the brands to contact.",
            )}
          </p>
          <button className="button primary" onClick={() => window.dispatchEvent(new CustomEvent("studio-open-tab", { detail: "billing" }))}>
            {L("Mon compte › Abonnement", "Mi cuenta › Suscripción", "My account › Subscription")}
          </button>
        </div>
      </section>
    );
  if (!list.length)
    return (
      <section className="opps">
        <StudioBrands data={data} client={client} refresh={refresh} />
        <div className="opps-empty">
          <h3>{L("Bientôt ici", "Muy pronto aquí", "Coming soon")}</h3>
          <p>
            {L(
              "Julie prépare votre sélection de marques à contacter. Elle arrive bientôt ici.",
              "Julie está preparando tu selección de marcas para contactar. Llegará muy pronto aquí.",
              "Julie is preparing your selection of brands to contact. It will be here soon.",
            )}
          </p>
          <button
            className="button primary"
            onClick={() => window.dispatchEvent(new Event("studio-open-chat"))}
          >
            <MessageCircle size={15} />{" "}
            {L(
              "Écrire à l’agence",
              "Escribir a la agencia",
              "Message the agency",
            )}
          </button>
        </div>
      </section>
    );

  return (
    <section className="opps">
      <StudioBrands data={data} client={client} refresh={refresh} />
      <div className="opps-tools">
        <label className="opps-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={L(
              "Rechercher une marque",
              "Buscar una marca",
              "Search a brand",
            )}
            aria-label={L(
              "Rechercher une marque",
              "Buscar una marca",
              "Search a brand",
            )}
          />
        </label>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          aria-label={L("Pays", "País", "Country")}
        >
          <option value="">
            {L("Tous les pays", "Todos los países", "All countries")}
          </option>
          {OPP_COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {countryLabel(c, lang)}
            </option>
          ))}
        </select>
        <select
          value={only}
          onChange={(e) => setOnly(e.target.value)}
          aria-label={L("Suivi", "Seguimiento", "Status")}
        >
          <option value="">
            {L("Tous les suivis", "Todos los estados", "All statuses")}
          </option>
          {OPP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s, lang)}
            </option>
          ))}
        </select>
      </div>
      <div
        className="opps-chips"
        role="tablist"
        aria-label={L("Niches", "Nichos", "Niches")}
      >
        <button
          role="tab"
          aria-selected={!niche}
          className={"opps-chip " + (!niche ? "on" : "")}
          onClick={() => setNiche("")}
        >
          {L("Toutes", "Todas", "All")} <span>{list.length}</span>
        </button>
        {NICHES.filter((n) => counts[n.key]).map((n) => (
          <button
            key={n.key}
            role="tab"
            aria-selected={niche === n.key}
            className={"opps-chip " + (niche === n.key ? "on" : "")}
            onClick={() => setNiche(n.key)}
          >
            {nicheLabel(n.key, lang)} <span>{counts[n.key]}</span>
          </button>
        ))}
      </div>
      <PitchBox pitch={pitch} open={showPitch} setOpen={setShowPitch} />
      {!shown.length && (
        <p className="opps-none">
          {L(
            "Aucune marque avec ces filtres.",
            "Ninguna marca con estos filtros.",
            "No brands match these filters.",
          )}
        </p>
      )}
      <div className="opps-grid">
        {shown.map((o) => (
          <OppCard
            key={o.id}
            o={o}
            st={statusMap[o.id]}
            client={client}
            refresh={refresh}
          />
        ))}
      </div>
      <p className="opps-legal">
        {L(
          "Contacts professionnels publiés par les marques. Écrivez à votre nom, un message personnalisé à la fois.",
          "Contactos profesionales publicados por las marcas. Escribe en tu nombre, un mensaje personalizado a la vez.",
          "Professional contacts published by the brands. Write in your own name, one personal message at a time.",
        )}
      </p>
    </section>
  );
}

function PitchBox({
  pitch,
  open,
  setOpen,
}: {
  pitch: string;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const L = useL();
  return (
    <details
      className="opps-pitch"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary>
        {L(
          "Modèle de premier message",
          "Plantilla de primer mensaje",
          "First message template",
        )}
      </summary>
      <p className="muted">
        {L(
          "Remplacez les [crochets], ajoutez une phrase sur la marque, puis envoyez depuis votre boîte mail ou Instagram.",
          "Reemplaza los [corchetes], agrega una frase sobre la marca y envíalo desde tu correo o Instagram.",
          "Replace the [brackets], add a line about the brand, then send it from your email or Instagram.",
        )}
      </p>
      <pre>{pitch}</pre>
      <CopyButton
        text={pitch}
        label={L("Copier le message", "Copiar el mensaje", "Copy the message")}
        done={L("Message copié", "Mensaje copiado", "Message copied")}
      />
    </details>
  );
}

function OppCard({
  o,
  st,
  client,
  refresh,
}: {
  o: Row;
  st?: Row;
  client: Row;
  refresh: () => Promise<any>;
}) {
  const L = useL(),
    lang = useLang();
  const [status, setStatus] = useState(st?.status || "todo"),
    [note, setNote] = useState(st?.note || ""),
    [noteOpen, setNoteOpen] = useState(!!st?.note),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  const [shownEmail, setShownEmail] = useState(""),
    [revealing, setRevealing] = useState(false);
  async function save(next: string, nextNote = note) {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api("opportunity-status", {
        client_id: client.id,
        opportunity_id: o.id,
        status: next,
        note: nextNote,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <article className={"opp-card st-" + status}>
      <header>
        <div>
          <h4>{o.brand}</h4>
          <small>
            {nicheLabel(o.niche, lang)} · {countryLabel(o.country, lang)}
            {o.languages?.length
              ? " · " +
                o.languages.map((x: string) => x.toUpperCase()).join(" / ")
              : ""}
          </small>
        </div>
        <span className={"opp-status-badge st-" + status}>
          {statusLabel(status, lang)}
        </span>
      </header>
      {o.note && <p className="opp-note">{o.note}</p>}
      <div className="opp-links">
        {o.instagram && (
          <a
            href={"https://www.instagram.com/" + o.instagram + "/"}
            target="_blank"
            rel="noopener noreferrer"
          >
            <AtSign size={15} /> @{o.instagram}
          </a>
        )}
        {o.site && (
          <a href={o.site} target="_blank" rel="noopener noreferrer">
            <Globe size={15} />{" "}
            {o.site.replace(/^https:\/\//, "").replace(/\/$/, "")}
          </a>
        )}
      </div>
      {(o.email || shownEmail) && (
        <div className="opp-email">
          <a href={"mailto:" + (o.email || shownEmail)}>
            <Mail size={15} /> {o.email || shownEmail}
          </a>
          <CopyButton
            text={o.email || shownEmail}
            label={L("Copier l’adresse", "Copiar el correo", "Copy address")}
            done={L("Copiée", "Copiado", "Copied")}
          />
        </div>
      )}
      {!o.email && !shownEmail && o.hasEmail && (
        <div className="opp-email">
          <button
            type="button"
            className="button secondary small"
            disabled={revealing}
            onClick={async () => {
              setRevealing(true);
              setError("");
              try {
                const d: any = await api("opportunity-contact", { client_id: client.id, opportunity_id: o.id });
                setShownEmail(d.email || "");
              } catch (e: any) {
                setError(e.message);
              } finally {
                setRevealing(false);
              }
            }}
          >
            <Mail size={15} /> {L("Afficher l’adresse e-mail", "Mostrar el correo", "Show email address")}
          </button>
        </div>
      )}
      <div className="opp-track">
        <label>
          <span>{L("Mon suivi", "Mi seguimiento", "My status")}</span>
          <select
            value={status}
            disabled={saving}
            onChange={(e) => {
              setStatus(e.target.value);
              save(e.target.value);
            }}
          >
            {OPP_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s, lang)}
              </option>
            ))}
          </select>
        </label>
        {saving ? (
          <Loader2 size={15} className="spin" />
        ) : saved ? (
          <Check size={15} aria-label={L("Enregistré", "Guardado", "Saved")} />
        ) : null}
        {!noteOpen && (
          <button
            type="button"
            className="text-link"
            onClick={() => setNoteOpen(true)}
          >
            {L("Ajouter une note", "Agregar una nota", "Add a note")}
          </button>
        )}
      </div>
      {noteOpen && (
        <div className="opp-private-note">
          <textarea
            value={note}
            maxLength={300}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
            placeholder={L(
              "Note privée : date d’envoi, contact, réponse…",
              "Nota privada: fecha de envío, contacto, respuesta…",
              "Private note: date sent, contact, reply…",
            )}
            aria-label={L("Note privée", "Nota privada", "Private note")}
          />
          <button
            type="button"
            className="button secondary small"
            disabled={saving || note === (st?.note || "")}
            onClick={() => save(status, note)}
          >
            {L("Enregistrer la note", "Guardar la nota", "Save note")}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="error-inline">
          {error}
        </p>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Agence (en français)                                                */
/* ------------------------------------------------------------------ */
const empty = {
  brand: "",
  niche: "beauty",
  instagram: "",
  email: "",
  site: "",
  country: "FR",
  languages: ["fr"],
  note: "",
  tags: "",
};
export function OpportunitiesAgency({
  data,
  refresh,
}: {
  data: Row;
  refresh: () => Promise<any>;
}) {
  const list: Row[] = data.opportunities || [];
  const [form, setForm] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [query, setQuery] = useState(""),
    [niche, setNiche] = useState(""),
    [csv, setCsv] = useState(""),
    [preview, setPreview] = useState<Row | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  async function run(fn: () => Promise<any>, ok: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await refresh();
      setMessage(ok);
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const shown = list.filter(
    (o) =>
      (!niche || o.niche === niche) &&
      (!query ||
        [o.brand, o.instagram, o.email]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  return (
    <section className="opps opps-agency">
      <div className="opps-reminder">
        N’ajoutez que des contacts professionnels publiés par la marque
        elle-même (site, bio Instagram). Pas d’adresse personnelle.
      </div>
      <div className="opps-agency-actions">
        <button
          className="button primary"
          onClick={() => setForm({ ...empty })}
        >
          <Plus size={15} /> Ajouter une marque
        </button>
        <button
          className="button secondary"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={15} /> Importer un CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            const text = await f.text();
            setCsv(text);
            setPreview(null);
            await run(
              async () =>
                setPreview(await api("opportunity-import", { csv: text })),
              "",
            );
          }}
        />
        <span className="muted">
          {list.length} fiche(s) · {list.filter((o) => o.active).length}{" "}
          visible(s) par les créatrices
        </span>
      </div>
      <details className="opps-csv-help">
        <summary>Format du fichier CSV</summary>
        <p>
          Colonnes, dans cet ordre ou avec ces en-têtes :{" "}
          <code>niche,marque,instagram,email,site,pays,langues,note</code>.
          Séparateur virgule ou point-virgule. Niches :{" "}
          {NICHES.map((n) => n.fr).join(", ")}. Pays : FR, MX, US ou
          International. Langues : fr, es, en.
        </p>
        <textarea
          rows={4}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder="Ou collez le contenu du CSV ici"
        />
        <button
          className="button secondary small"
          disabled={busy || !csv.trim()}
          onClick={() =>
            run(
              async () => setPreview(await api("opportunity-import", { csv })),
              "",
            )
          }
        >
          Voir l’aperçu
        </button>
      </details>
      {preview && (
        <div className="opps-preview">
          <h4>
            Aperçu : {preview.summary.add} à ajouter · {preview.summary.update}{" "}
            à mettre à jour · {preview.summary.errors} ligne(s) en erreur
          </h4>
          <div className="opps-table-wrap">
            <table className="opps-table">
              <thead>
                <tr>
                  <th>Ligne</th>
                  <th>Marque</th>
                  <th>Niche</th>
                  <th>Instagram</th>
                  <th>E-mail</th>
                  <th>Résultat</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((p: Row) => (
                  <tr key={p.line} className={p.error ? "bad" : ""}>
                    <td>{p.line}</td>
                    <td>{p.brand}</td>
                    <td>{p.niche ? nicheLabel(p.niche, "fr") : ""}</td>
                    <td>{p.instagram ? "@" + p.instagram : ""}</td>
                    <td>{p.email}</td>
                    <td>
                      {p.error
                        ? p.error
                        : p.action === "update"
                          ? "Mise à jour"
                          : "Ajout"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row-actions">
            <button
              className="button primary"
              disabled={busy || !(preview.summary.add + preview.summary.update)}
              onClick={async () => {
                let r: Row = {};
                const ok = await run(async () => {
                  r = await api("opportunity-import", { csv, commit: true });
                }, "");
                if (ok) {
                  setMessage(
                    `${r.added} ajoutée(s), ${r.updated} mise(s) à jour${r.errors ? `, ${r.errors} ligne(s) ignorée(s)` : ""}.`,
                  );
                  setPreview(null);
                  setCsv("");
                }
              }}
            >
              Importer les lignes valides
            </button>
            <button className="button ghost" onClick={() => setPreview(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}
      {form && (
        <form
          className="opps-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(
              () => api("opportunity-save", form),
              form.id ? "Fiche mise à jour." : "Marque ajoutée.",
            );
            if (ok) setForm(null);
          }}
        >
          <div className="opps-form-head">
            <h4>{form.id ? "Modifier la fiche" : "Nouvelle marque"}</h4>
            <button
              type="button"
              className="icon-button"
              aria-label="Fermer"
              onClick={() => setForm(null)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="opps-fields">
            <label>
              Marque *
              <input
                required
                maxLength={120}
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
            </label>
            <label>
              Niche *
              <select
                value={form.niche}
                onChange={(e) => setForm({ ...form, niche: e.target.value })}
              >
                {NICHES.map((n) => (
                  <option key={n.key} value={n.key}>
                    {n.fr}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Compte Instagram
              <input
                value={form.instagram}
                placeholder="@marque"
                onChange={(e) =>
                  setForm({ ...form, instagram: e.target.value })
                }
              />
            </label>
            <label>
              E-mail professionnel public
              <input
                type="email"
                value={form.email}
                placeholder="contact@…"
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label>
              Site
              <input
                value={form.site}
                placeholder="https://"
                onChange={(e) => setForm({ ...form, site: e.target.value })}
              />
            </label>
            <label>
              Pays
              <select
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              >
                {OPP_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {countryLabel(c, "fr")}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="opps-langs">
              <legend>Langues</legend>
              {["fr", "es", "en"].map((l) => (
                <label key={l}>
                  <input
                    type="checkbox"
                    checked={(form.languages || []).includes(l)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        languages: e.target.checked
                          ? [...(form.languages || []), l]
                          : (form.languages || []).filter(
                              (x: string) => x !== l,
                            ),
                      })
                    }
                  />
                  {l.toUpperCase()}
                </label>
              ))}
            </fieldset>
            <label>
              Mots-clés (séparés par des virgules)
              <input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
            </label>
            <label className="wide">
              Pourquoi les contacter ({240 - (form.note || "").length}{" "}
              caractères restants)
              <textarea
                maxLength={240}
                rows={2}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </label>
          </div>
          <div className="row-actions">
            <button className="button primary" disabled={busy}>
              {busy ? (
                <Loader2 size={15} className="spin" />
              ) : (
                <Check size={15} />
              )}{" "}
              Enregistrer
            </button>
          </div>
        </form>
      )}
      {message && (
        <p role="status" className="opps-ok">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="error-inline">
          {error}
        </p>
      )}
      <div className="opps-tools">
        <label className="opps-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher"
            aria-label="Rechercher"
          />
        </label>
        <select
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          aria-label="Niche"
        >
          <option value="">Toutes les niches</option>
          {NICHES.map((n) => (
            <option key={n.key} value={n.key}>
              {n.fr}
            </option>
          ))}
        </select>
      </div>
      {!list.length ? (
        <p className="opps-none">
          Aucune marque pour l’instant. Ajoutez-en une ou importez un CSV : les
          créatrices les verront dans leur onglet « Opportunités ».
        </p>
      ) : (
        <div className="opps-table-wrap">
          <table className="opps-table">
            <thead>
              <tr>
                <th>Marque</th>
                <th>Niche</th>
                <th>Pays</th>
                <th>Instagram</th>
                <th>E-mail</th>
                <th>Visible</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.id} className={o.active ? "" : "off"}>
                  <td>
                    <b>{o.brand}</b>
                    {o.note && <small>{o.note}</small>}
                  </td>
                  <td>{nicheLabel(o.niche, "fr")}</td>
                  <td>{o.country}</td>
                  <td>{o.instagram ? "@" + o.instagram : ""}</td>
                  <td>{o.email}</td>
                  <td>
                    <label className="opps-toggle">
                      <input
                        type="checkbox"
                        checked={o.active}
                        disabled={busy}
                        onChange={(e) =>
                          run(
                            () =>
                              api("opportunity-active", {
                                id: o.id,
                                active: e.target.checked,
                              }),
                            e.target.checked
                              ? "Fiche visible."
                              : "Fiche masquée.",
                          )
                        }
                      />
                      {o.active ? "Oui" : "Non"}
                    </label>
                  </td>
                  <td className="opps-row-actions">
                    <div>
                      <button
                        className="icon-button"
                        aria-label={"Modifier " + o.brand}
                        onClick={() =>
                          setForm({ ...o, tags: (o.tags || []).join(", ") })
                        }
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="text-link danger"
                        disabled={busy}
                        onClick={() => {
                          if (!confirmDelete(o.brand)) return;
                          run(
                            () => api("opportunity-delete", { id: o.id }),
                            "Fiche supprimée.",
                          );
                        }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
// Suppression définitive : une confirmation simple, la désactivation restant le choix conseillé.
function confirmDelete(brand: string) {
  return window.confirm(
    `Supprimer définitivement « ${brand} » ? Le suivi des créatrices pour cette marque sera aussi effacé. Pour la cacher seulement, décochez « Visible ».`,
  );
}
