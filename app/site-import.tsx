"use client";
// « Importer mon site » : la cliente donne l'adresse de son site, le studio propose ce qu'il a trouvé ;
// elle coche ce qu'elle garde. Les produits sont créés tout de suite, le reste part à l'agence pour le profil.
import "./recreate.css";
import { useState } from "react";
import { Check, Globe, Loader2, Search } from "lucide-react";
import { useL } from "../lib/i18n";
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
const socialName = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

export default function SiteImport({ data, client, refresh }: { data: Row; client: Row; refresh: () => void }) {
  const L = useL();
  const creator = client?.config?.workspaceType === "creator";
  const last: Row | null = (data.siteImports || [])[0] || null;
  const [url, setUrl] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [done, setDone] = useState(""),
    [current, setCurrent] = useState<Row | null>(last && !last.applied?.at ? last : null),
    [products, setProducts] = useState<number[]>(last && !last.applied?.at ? (last.products || []).map((_: Row, i: number) => i).slice(0, 6) : []),
    [suggest, setSuggest] = useState<Row>({ tagline: true, tone: true, pillars: true, colors: true, fonts: true, socials: true }),
    [image, setImage] = useState(false),
    [open, setOpen] = useState(false);

  async function read(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    setBusy("read");
    try {
      const r = await api("site-import", { client_id: client.id, url });
      setCurrent(r.import);
      setProducts((r.import.products || []).map((_: Row, i: number) => i).slice(0, 6));
      setImage(false);
      refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }
  async function apply() {
    if (!current) return;
    setError("");
    setBusy("apply");
    try {
      const r = await api("site-import-apply", { id: current.id, products, suggest, image });
      setDone(
        L(
          `${r.products.length} ${r.products.length > 1 ? "produits ajoutés" : "produit ajouté"}${r.suggested ? ". Le reste est envoyé à Julie, qui l’applique à votre profil." : "."}`,
          `${r.products.length} ${r.products.length > 1 ? "productos agregados" : "producto agregado"}${r.suggested ? ". Lo demás se envía a Julie, que lo aplica a tu perfil." : "."}`,
          `${r.products.length} ${r.products.length > 1 ? "products added" : "product added"}${r.suggested ? ". The rest goes to Julie, who applies it to your profile." : "."}`,
        ),
      );
      setCurrent(null);
      refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }
  const toggle = (i: number) => setProducts((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  const row = (key: string, title: string, body: React.ReactNode) => (
    <label className="site-import-row" key={key}>
      <input type="checkbox" checked={!!suggest[key]} onChange={(e) => setSuggest({ ...suggest, [key]: e.target.checked })} />
      <div>
        <b>{title}</b>
        <small>{body}</small>
      </div>
    </label>
  );
  if (!open && !current && !done)
    return (
      <button className="recreate-entry" onClick={() => setOpen(true)}>
        <div>
          <b>
            <Globe size={16} /> {creator ? L("Importer mon site ou mon lien en bio", "Importar mi sitio o mi enlace en bio", "Import my website or link in bio") : L("Importer mon site", "Importar mi sitio", "Import my website")}
          </b>
          <span>{L("Vos produits, vos couleurs et votre ton, retrouvés en quelques secondes.", "Tus productos, tus colores y tu tono, encontrados en segundos.", "Your products, colors and tone, found in seconds.")}</span>
        </div>
        <Search size={18} />
      </button>
    );
  return (
    <section className="site-import">
      <span className="step-tag">{L("IMPORTER MON SITE", "IMPORTAR MI SITIO", "IMPORT MY WEBSITE")}</span>
      <form onSubmit={read}>
        <label className="recreate-url">
          <Globe size={17} />
          <input inputMode="url" placeholder="https://www.monsite.com" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <button className="button primary" disabled={!url.trim() || !!busy}>
          {busy === "read" ? <Loader2 className="spin" size={16} /> : <Search size={16} />} {busy === "read" ? L("Lecture du site…", "Leyendo el sitio…", "Reading the site…") : L("Lire mon site", "Leer mi sitio", "Read my site")}
        </button>
      </form>
      <small className="muted">{L("Seules les pages publiques de votre site sont lues. Rien n’est changé sans votre accord.", "Solo se leen las páginas públicas de tu sitio. Nada cambia sin tu acuerdo.", "Only your site’s public pages are read. Nothing changes without your OK.")}</small>
      {error && <p className="error-text">{error}</p>}
      {done && (
        <p className="success-text">
          <Check size={15} /> {done}
        </p>
      )}
      {current && (
        <div className="site-import-result">
          <h3>{L("Voici ce que nous avons trouvé", "Esto es lo que encontramos", "Here’s what we found")}</h3>
          {(current.products || []).length > 0 && (
            <>
              <div className="site-import-group">{creator ? L("Sujets à ajouter", "Temas para agregar", "Topics to add") : L("Produits à ajouter", "Productos para agregar", "Products to add")}</div>
              {current.products.map((p: Row, i: number) => (
                <label className="site-import-row" key={"p" + i}>
                  <input type="checkbox" checked={products.includes(i)} onChange={() => toggle(i)} />
                  <div>
                    <b>{p.name}</b>
                    <small>{[p.description, p.price].filter(Boolean).join(" · ")}</small>
                  </div>
                </label>
              ))}
            </>
          )}
          {current.image && (
            <label className="site-import-row">
              <input type="checkbox" checked={image} onChange={(e) => setImage(e.target.checked)} />
              <div>
                <b>{L("Utiliser cette image", "Usar esta imagen", "Use this image")}</b>
                <small>
                  {L("L’image principale de votre site", "La imagen principal de tu sitio", "Your site’s main image")} ({String(current.image).replace(/^https:\/\//, "").slice(0, 60)}).{" "}
                  {L("Elle est copiée dans votre espace (avec le premier produit coché).", "Se copia en tu espacio (con el primer producto marcado).", "It’s copied into your space (with the first ticked product).")}
                </small>
              </div>
            </label>
          )}
          <div className="site-import-group">{L("Pour votre profil (Julie valide)", "Para tu perfil (Julie valida)", "For your profile (Julie approves)")}</div>
          {current.tagline && row("tagline", L("Votre phrase", "Tu frase", "Your tagline"), current.tagline)}
          {current.tone && row("tone", L("Votre ton", "Tu tono", "Your tone"), current.tone)}
          {(current.pillars || []).length > 0 && row("pillars", L("Vos 3 thèmes", "Tus 3 temas", "Your 3 themes"), current.pillars.join(" · "))}
          {(current.colors || []).length > 0 &&
            row(
              "colors",
              L("Vos couleurs", "Tus colores", "Your colors"),
              <span className="recreate-tags">
                {current.colors.map((c: string) => (
                  <span key={c} className="recreate-swatch" style={{ background: c }} title={c} />
                ))}
              </span>,
            )}
          {(current.fonts || []).length > 0 && row("fonts", L("Vos polices", "Tus tipografías", "Your fonts"), current.fonts.join(", "))}
          {(current.socials || []).length > 0 && row("socials", L("Vos réseaux", "Tus redes", "Your socials"), current.socials.map(socialName).join(" · "))}
          <div className="recreate-actions">
            <button className="button primary" disabled={!!busy} onClick={apply}>
              {busy === "apply" ? <Loader2 className="spin" size={16} /> : <Check size={16} />} {L("Garder ma sélection", "Guardar mi selección", "Keep my selection")}
            </button>
            <button className="button secondary" onClick={() => setCurrent(null)}>
              {L("Annuler", "Cancelar", "Cancel")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Agence : suggestions de profil envoyées par la cliente, à appliquer en un clic. */
export function SiteImportAgency({ data, refresh }: { data: Row; refresh: () => void }) {
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const rows = (data.siteImports || []).filter((r: Row) => r.applied?.suggestion);
  if (!rows.length) return null;
  return (
    <section className="site-import">
      <span className="step-tag">SITE IMPORTÉ PAR LE CLIENT</span>
      {rows.map((r: Row) => {
        const s = r.applied.suggestion;
        return (
          <div key={r.id} className="site-import-result">
            <b>{r.url}</b>
            {s.tagline && <small>Phrase : {s.tagline}</small>}
            {s.tone && <small>Ton : {s.tone}</small>}
            {s.pillars?.length > 0 && <small>Thèmes : {s.pillars.join(" · ")}</small>}
            {s.colors?.length > 0 && (
              <span className="recreate-tags">
                Couleurs :{" "}
                {s.colors.map((c: string) => (
                  <span key={c} className="recreate-swatch" style={{ background: c }} title={c} />
                ))}
              </span>
            )}
            {s.fonts?.length > 0 && <small>Polices repérées : {s.fonts.join(", ")} (à choisir dans Modèles)</small>}
            {s.socials?.length > 0 && <small>Réseaux : {s.socials.map(socialName).join(" · ")}</small>}
            {r.applied.agencyApplied ? (
              <p className="success-text">
                <Check size={14} /> Appliqué au profil.
              </p>
            ) : (
              <button
                className="button primary"
                disabled={!!busy}
                onClick={async () => {
                  setBusy(r.id);
                  setError("");
                  try {
                    await api("site-import-agency-apply", { id: r.id });
                    refresh();
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setBusy("");
                  }
                }}
              >
                Appliquer au profil (ton, couleurs, thèmes)
              </button>
            )}
          </div>
        );
      })}
      {error && <p className="error-text">{error}</p>}
    </section>
  );
}
