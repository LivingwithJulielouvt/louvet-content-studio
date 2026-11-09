"use client";
// Lieux (décors de référence) : l'agence fournit les photos d'un lieu réel du client
// (restaurant, boutique, bureau, chambre…) ; le client choisit simplement le mot-clé à la création.
import { useRef, useState } from "react";
import { MapPin, Plus, Trash2, Upload, Loader2, ArrowUp, ArrowDown, Check } from "lucide-react";
import { uploadStudioMedia } from "../lib/direct-upload-client";
import { useL, useLang } from "../lib/i18n";
type Row = Record<string, any>;

async function post(action: string, body: Row) {
  const r = await fetch("/api/studio/" + action, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Studio-Request": "1" },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(d.error || "Cette action n’a pas abouti.");
  return d;
}

/** Libellé du lieu dans la langue du client (à défaut le mot-clé principal). */
export function placeLabel(p: Row, lang: string) {
  return (p.labels && p.labels[lang]) || p.label;
}

/** Étape « Où ? » de la création de photos (côté client). Masquée si le client n'a aucun lieu. */
export function PlacePicker({
  places,
  value,
  onChange,
  creator,
}: {
  places: Row[];
  value: string;
  onChange: (id: string) => void;
  creator?: boolean;
}) {
  const L = useL(),
    lang = useLang();
  const usable = (places || []).filter((p) => p.active !== false && p.files?.length);
  if (!usable.length) return null;
  return (
    <div className="place-step">
      <h3 className="photo-step-title">{L("Où ?", "¿Dónde?", "Where?")}</h3>
      <p className="photo-step-hint">
        {creator
          ? L(
              "Choisissez un de vos lieux : le visuel sera créé dans ce décor.",
              "Elige uno de tus lugares: la imagen se creará en ese espacio.",
              "Pick one of your places: the visual will be created in that setting.",
            )
          : L(
              "Choisissez un lieu de votre établissement : le visuel sera créé dans ce décor.",
              "Elige un lugar de tu negocio: la imagen se creará en ese espacio.",
              "Pick a place in your business: the visual will be created in that setting.",
            )}
      </p>
      <div className="place-chips" role="radiogroup" aria-label={L("Lieu", "Lugar", "Place")}>
        <button
          type="button"
          role="radio"
          aria-checked={!value}
          className={"place-chip none " + (!value ? "on" : "")}
          onClick={() => onChange("")}
        >
          <span className="place-thumb none" aria-hidden="true">
            <MapPin size={20} />
          </span>
          <b>{L("Sans lieu précis", "Sin lugar específico", "No specific place")}</b>
        </button>
        {usable.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={value === p.id}
            className={"place-chip " + (value === p.id ? "on" : "")}
            onClick={() => onChange(p.id)}
          >
            <img className="place-thumb" src={"/api/studio/file/" + p.files[0]} alt="" loading="lazy" />
            <b>{placeLabel(p, lang)}</b>
            {value === p.id && (
              <span className="place-check" aria-hidden="true">
                <Check size={14} />
              </span>
            )}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="text-link place-ask"
        onClick={() => window.dispatchEvent(new Event("studio-open-chat"))}
      >
        {L("Ajouter un lieu ? Écrivez-nous", "¿Agregar un lugar? Escríbenos", "Add a place? Message us")}
      </button>
    </div>
  );
}

/** Gestion des lieux d'un client (espace agence, en français). */
export function PlacesAgency({ data, client, refresh }: { data: Row; client: Row; refresh: () => Promise<any> }) {
  const places: Row[] = data.places || [];
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [draft, setDraft] = useState<Record<string, Row>>({});
  const fileRef = useRef<HTMLInputElement>(null),
    target = useRef("");
  const val = (p: Row) => draft[p.id] || { label: p.label, labels: p.labels || {}, description: p.description, active: p.active };
  const edit = (p: Row, patch: Row) => setDraft({ ...draft, [p.id]: { ...val(p), ...patch } });
  async function run(key: string, fn: () => Promise<any>, ok: string) {
    setBusy(key);
    setError("");
    setMessage("");
    try {
      await fn();
      await refresh();
      setMessage(ok);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function save(p: Row, extra: Row = {}) {
    const v = { ...val(p), ...extra };
    await run(
      p.id,
      () =>
        post("place-save", {
          client_id: client.id,
          id: p.id,
          label: v.label,
          labels: v.labels,
          description: v.description,
          active: v.active,
          position: extra.position ?? p.position,
        }),
      "Lieu enregistré.",
    );
    const next = { ...draft };
    delete next[p.id];
    setDraft(next);
  }
  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= places.length) return;
    const a = places[i],
      b = places[j];
    await run(
      a.id,
      async () => {
        await post("place-save", { client_id: client.id, id: a.id, label: a.label, labels: a.labels, description: a.description, active: a.active, position: j });
        await post("place-save", { client_id: client.id, id: b.id, label: b.label, labels: b.labels, description: b.description, active: b.active, position: i });
      },
      "Ordre mis à jour.",
    );
  }
  async function upload(files: FileList | null) {
    const id = target.current;
    if (!files?.length || !id) return;
    await run(
      id,
      async () => {
        for (const f of Array.from(files)) {
          if (!["image/jpeg", "image/png"].includes(f.type)) throw Error("JPG ou PNG uniquement.");
          await uploadStudioMedia(f, { kind: "photo", client_id: client.id, purpose: "place", place_id: id });
        }
      },
      "Photo ajoutée.",
    );
    if (fileRef.current) fileRef.current.value = "";
  }
  return (
    <section className="panel places-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">LIEUX</span>
          <h3>Décors de référence de {client.config?.brand || client.name}</h3>
          <p className="muted">
            Ajoutez les lieux réels du client (salle, terrasse, comptoir, vitrine, bureau, chambre…) avec 1 à 5 photos. Le client
            choisit ensuite simplement le mot-clé et ses visuels sont créés dans ce décor. 12 lieux maximum.
          </p>
        </div>
        <button
          className="button primary"
          disabled={!!busy || places.length >= 12}
          onClick={() =>
            run("new", () => post("place-save", { client_id: client.id, label: "Nouveau lieu", active: false }), "Lieu créé : ajoutez ses photos puis activez-le.")
          }
        >
          <Plus size={16} /> Ajouter un lieu
        </button>
      </div>
      {error && (
        <p role="alert" className="error-inline">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="muted">
          {message}
        </p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png"
        multiple
        hidden
        onChange={(e) => upload(e.target.files)}
      />
      {!places.length && <p className="muted">Aucun lieu pour l’instant.</p>}
      <div className="places-list">
        {places.map((p, i) => {
          const v = val(p),
            dirty = !!draft[p.id];
          return (
            <article key={p.id} className={"place-card " + (p.active ? "" : "inactive")}>
              <div className="place-photos">
                {p.files.map((fid: string) => (
                  <figure key={fid}>
                    <img src={"/api/studio/file/" + fid} alt={"Photo du lieu " + p.label} />
                    <button
                      className="icon-button"
                      aria-label="Retirer cette photo"
                      disabled={!!busy}
                      onClick={() => {
                        if (confirm("Retirer cette photo du lieu ?"))
                          run(p.id, () => post("place-photo-remove", { place_id: p.id, file_id: fid }), "Photo retirée.");
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </figure>
                ))}
                {p.files.length < 5 && (
                  <button
                    className="place-add-photo"
                    disabled={!!busy}
                    onClick={() => {
                      target.current = p.id;
                      fileRef.current?.click();
                    }}
                  >
                    {busy === p.id ? <Loader2 className="spin" size={18} /> : <Upload size={18} />}
                    <span>Ajouter des photos ({p.files.length}/5)</span>
                  </button>
                )}
              </div>
              <div className="place-fields">
                <label>
                  Mot-clé (français)
                  <input value={v.label} maxLength={40} onChange={(e) => edit(p, { label: e.target.value })} />
                </label>
                <div className="place-langs">
                  <label>
                    Anglais
                    <input
                      value={v.labels?.en || ""}
                      maxLength={40}
                      placeholder={v.label}
                      onChange={(e) => edit(p, { labels: { ...v.labels, en: e.target.value } })}
                    />
                  </label>
                  <label>
                    Espagnol
                    <input
                      value={v.labels?.es || ""}
                      maxLength={40}
                      placeholder={v.label}
                      onChange={(e) => edit(p, { labels: { ...v.labels, es: e.target.value } })}
                    />
                  </label>
                </div>
                <label>
                  Description pour l’IA (facultatif)
                  <textarea
                    value={v.description || ""}
                    maxLength={400}
                    rows={2}
                    placeholder="Ex. : terrasse ensoleillée, tables en bois clair, plantes vertes"
                    onChange={(e) => edit(p, { description: e.target.value })}
                  />
                </label>
                <label className="place-active">
                  <input
                    type="checkbox"
                    checked={!!v.active}
                    disabled={!p.files.length}
                    onChange={(e) => edit(p, { active: e.target.checked })}
                  />{" "}
                  Proposé au client {!p.files.length && <small className="muted">(ajoutez d’abord une photo)</small>}
                </label>
                <div className="row-actions">
                  <button className="button primary" disabled={!!busy || !dirty} onClick={() => save(p, { labels: { ...v.labels, fr: v.label } })}>
                    Enregistrer
                  </button>
                  <button className="icon-button" aria-label="Monter" disabled={!!busy || i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={15} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Descendre"
                    disabled={!!busy || i === places.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={15} />
                  </button>
                  <button
                    className="text-link danger"
                    disabled={!!busy}
                    onClick={() => {
                      if (confirm(`Supprimer le lieu « ${p.label} » et ses photos ?`))
                        run(p.id, () => post("place-delete", { id: p.id }), "Lieu supprimé.");
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
