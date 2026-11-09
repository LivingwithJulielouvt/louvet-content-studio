"use client";
// Réglages agence du montage des marques : « Mon style » (look par défaut du client) et bibliothèque de musiques.
// Texte réservé à l'agence : en français.
import { useState } from "react";
import { Loader2, Upload, Check, Wand2 } from "lucide-react";
import { uploadStudioMedia } from "../lib/direct-upload-client";
import { FONTS, sanitizeStyle } from "../lib/video-style.mjs";
import CreatorEditor from "./creator-editor";
import { isCreator } from "../lib/workspaces.mjs";

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
const ANIM_LABELS: Record<string, string> = {
  word: "Mot par mot",
  stack: "Mots qui s’empilent",
  typewriter: "Machine à écrire",
  fade: "Fondu doux",
  highlight: "Mot surligné",
  karaoke: "Karaoké",
  label: "Étiquette",
  none: "Sans animation",
};

export default function BrandVideoSettings({ data, client, refresh }: { data: Row; client: Row; refresh: () => Promise<any> }) {
  const [style, setStyle] = useState<Row>(sanitizeStyle(client.config?.videoStyle || {}));
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [ok, setOk] = useState("");
  const set = (patch: Row) => {
    setOk("");
    setStyle(sanitizeStyle({ ...style, ...patch }));
  };
  async function save() {
    setBusy("style");
    setError("");
    try {
      await call("video-style-save", { client_id: client.id, style });
      await refresh();
      setOk("Style enregistré. Il sera appliqué aux prochains montages de ce client.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function addMusic(file: File | undefined) {
    if (!file) return;
    setBusy("music");
    setError("");
    try {
      await uploadStudioMedia(file, { kind: "music", client_id: client.id });
      await refresh();
      setOk("Musique ajoutée à la bibliothèque du client.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  const [visual, setVisual] = useState(false);
  const creator = isCreator(client.config);
  async function access(patch: Row) {
    setBusy("access");
    setError("");
    try {
      await call("video-editor-access", {
        client_id: client.id,
        creatorStyleEditable: client.config?.creatorStyleEditable === true,
        advancedEditor: client.config?.advancedEditor === true,
        ...patch,
      });
      await refresh();
      setOk("Accès mis à jour.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  // Exemple pour l'éditeur visuel : le dernier montage du client qui contient des vidéos.
  const sample = (data.videoEdits || []).find((e: Row) => e.clips?.length && e.brief?.brand?.clipInfo?.length) || null;
  const f = (FONTS as Row)[style.font] || FONTS.sans;
  return (
    <section className="panel brand-video-settings">
      {visual && (
        <CreatorEditor
          edit={sample}
          client={client}
          data={data}
          mode="agency-style"
          refresh={async () => {
            const r = await refresh();
            return r;
          }}
          onClose={() => setVisual(false)}
        />
      )}
      <h3>{creator ? "Éditeur vidéo · « Mon style » de la créatrice" : "Montage automatique · style de la marque"}</h3>
      <div className="editor-access">
        <button type="button" className="button primary" onClick={() => setVisual(true)}>
          <Wand2 size={15} /> Ouvrir l’éditeur visuel du style
        </button>
        <small className="muted">
          {sample ? "Aperçu sur la dernière vidéo du client." : "Aperçu sur une image d’exemple (aucune vidéo montée pour l’instant)."}
        </small>
        {creator ? (
          <label className="optional-toggle">
            <input type="checkbox" disabled={busy === "access"} checked={client.config?.creatorStyleEditable === true} onChange={(e) => access({ creatorStyleEditable: e.target.checked })} />
            La créatrice peut modifier son style
            <small>Elle verra « Enregistrer comme mon style » dans son éditeur.</small>
          </label>
        ) : (
          <label className="optional-toggle">
            <input type="checkbox" disabled={busy === "access"} checked={client.config?.advancedEditor === true} onChange={(e) => access({ advancedEditor: e.target.checked })} />
            Réglages avancés pour la marque
            <small>Ajoute un lien discret « Réglages avancés » vers l’éditeur complet. Désactivé par défaut.</small>
          </label>
        )}
      </div>
      <p className="muted">
        Ce style est le look « Mon style » proposé au client. Il peut ensuite choisir Doux ou Percutant, changer le hook, corriger un mot ou la musique.
      </p>
      {error && (
        <div className="alert error" role="alert">
          <span>{error}</span>
        </div>
      )}
      <div className="form-grid">
        <label>
          Police
          <select value={style.font} onChange={(e) => set({ font: e.target.value })}>
            {Object.entries(FONTS).map(([id, x]) => (
              <option key={id} value={id}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Animation
          <select value={style.animation} onChange={(e) => set({ animation: e.target.value })}>
            {Object.entries(ANIM_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Position
          <select value={style.position} onChange={(e) => set({ position: e.target.value })}>
            <option value="top">En haut</option>
            <option value="middle">Au centre</option>
            <option value="bottom">En bas</option>
          </select>
        </label>
        <label>
          Taille
          <select value={style.size} onChange={(e) => set({ size: e.target.value })}>
            <option value="s">Petite</option>
            <option value="m">Moyenne</option>
            <option value="l">Grande</option>
          </select>
        </label>
        <label>
          Couleur du texte
          <input type="color" value={style.color} onChange={(e) => set({ color: e.target.value })} />
        </label>
        <label>
          Couleur du mot fort
          <input type="color" value={style.highlight} onChange={(e) => set({ highlight: e.target.value })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={style.outline} onChange={(e) => set({ outline: e.target.checked })} /> Contour noir
        </label>
        <label className="check">
          <input type="checkbox" checked={style.uppercase} onChange={(e) => set({ uppercase: e.target.checked })} /> Majuscules
        </label>
        <label className="check">
          <input type="checkbox" checked={style.rhythm.cutSilences} onChange={(e) => set({ rhythm: { ...style.rhythm, cutSilences: e.target.checked } })} /> Couper les silences
        </label>
        <label>
          Carton de fin (facultatif)
          <input value={style.outro.text} maxLength={80} placeholder="Ex. : Commandez sur dupain.mx" onChange={(e) => set({ outro: { ...style.outro, text: e.target.value } })} />
        </label>
      </div>
      <div className="brand-style-sample" style={{ fontFamily: f.css, textTransform: style.uppercase ? "uppercase" : "none", color: style.color }}>
        Notre pain <span style={{ color: style.highlight }}>au levain</span>
      </div>
      <button className="button primary" disabled={busy === "style"} onClick={save}>
        {busy === "style" ? <Loader2 className="spin" size={15} /> : <Check size={15} />} Enregistrer le style
      </button>
      <h3>Musiques du client</h3>
      <p className="muted">MP3 ou M4A de moins de 15 Mo, libres de droits pour un usage commercial. La musique baisse automatiquement quand la personne parle.</p>
      <ul className="plain-list">
        {(data.musicFiles || []).map((m: Row) => (
          <li key={m.id}>
            <a className="text-link" href={"/api/studio/file/" + m.id}>
              {m.name}
            </a>
          </li>
        ))}
        {!data.musicFiles?.length && <li className="muted">Aucune musique pour le moment.</li>}
      </ul>
      <label className="button secondary">
        {busy === "music" ? <Loader2 className="spin" size={15} /> : <Upload size={15} />} Ajouter une musique
        <input type="file" hidden accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,.mp3,.m4a" onChange={(e) => addMusic(e.target.files?.[0])} />
      </label>
      {ok && (
        <p className="montage-notice" role="status">
          {ok}
        </p>
      )}
    </section>
  );
}

/** Vidéos que les marques ont demandé à l'agence de vérifier. */
export function VideoReviews({ data, refresh, openClient }: { data: Row; refresh: () => Promise<any>; openClient: (id: string) => void }) {
  const [notes, setNotes] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  if (!data.videoReviews?.length) return null;
  return (
    <section className="panel">
      <h3>Vidéos à relire · tous clients</h3>
      {error && (
        <div className="alert error" role="alert">
          <span>{error}</span>
        </div>
      )}
      {data.videoReviews.map((r: Row) => (
        <div className="video-review-item" key={r.id}>
          <b>
            {r.client_name} · {r.title || "Vidéo"}
          </b>
          {r.note && <small>« {r.note} »</small>}
          <div className="edit-actions">
            {r.file && (
              <a className="text-link" href={"/api/studio/file/" + r.file} target="_blank" rel="noreferrer">
                Voir la vidéo
              </a>
            )}
            <button className="text-link" onClick={() => openClient(r.client_id)}>
              Ouvrir l’espace du client
            </button>
          </div>
          <textarea
            placeholder="Votre retour au client (facultatif)"
            maxLength={600}
            value={notes[r.id] || ""}
            onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
          />
          <button
            className="button secondary"
            disabled={busy === r.id}
            onClick={async () => {
              setBusy(r.id);
              setError("");
              try {
                await call("video-review-done", { edit_id: r.id, comment: notes[r.id] || "" });
                await refresh();
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy("");
              }
            }}
          >
            Marquer comme relue
          </button>
        </div>
      ))}
    </section>
  );
}
