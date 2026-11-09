"use client";
// « Recréer ce post » : la cliente colle le lien d'un post ou d'un Reel Instagram qu'elle aime et ajoute des captures
// d'écran (ou un enregistrement d'écran, dont le studio extrait quelques images dans le navigateur).
// Le studio en décrit la recette et propose 3 modèles remplis avec ses photos et ses textes ; pour un Reel, un plan de tournage.
import "./recreate.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, AtSign, Camera, Check, Clipboard, Film, ImagePlus, Loader2, Smartphone, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { useL, useLang } from "../lib/i18n";
import { uploadStudioMedia } from "../lib/direct-upload-client";
import { buildLayered, layerTemplateById } from "../lib/layer-templates.mjs";
import { fillPhotos } from "../lib/layers.mjs";
import { templateById } from "../lib/templates.mjs";
import { CREATOR_INTENTS, BRAND_INTENTS } from "../lib/catalogue.mjs";
import { canonicalInstagram } from "../lib/recreate.mjs";
import { Thumb } from "./layer-studio";
import { newTemplate, exampleTemplate, Preview } from "./templates-studio";
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
const MAX_SIDE = 1600;
/** Image redimensionnée (JPEG, 1600 px au plus) : plus légère à envoyer et à analyser. */
async function shrink(file: File | Blob, name: string): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = ko;
      i.src = url;
    });
    const s = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const c = Object.assign(document.createElement("canvas"), { width: Math.round(img.naturalWidth * s), height: Math.round(img.naturalHeight * s) });
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(Error("image"))), "image/jpeg", 0.85));
    return new File([blob], name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}
/** 5 images réparties dans un enregistrement d'écran (dans le navigateur, rien n'est envoyé d'autre). */
async function framesFromVideo(file: File, count = 5): Promise<File[]> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = url;
  try {
    await new Promise<void>((ok, ko) => {
      v.onloadedmetadata = () => ok();
      v.onerror = () => ko(Error("video"));
    });
    const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 5;
    const out: File[] = [];
    for (let i = 0; i < count; i++) {
      v.currentTime = Math.min(d - 0.05, (d * (i + 0.5)) / count);
      await new Promise<void>((ok) => {
        const t = setTimeout(ok, 2500);
        v.onseeked = () => {
          clearTimeout(t);
          ok();
        };
      });
      const s = Math.min(1, 1080 / Math.max(v.videoWidth || 1, v.videoHeight || 1));
      const c = Object.assign(document.createElement("canvas"), { width: Math.max(2, Math.round((v.videoWidth || 540) * s)), height: Math.max(2, Math.round((v.videoHeight || 960) * s)) });
      c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.85));
      if (blob) out.push(new File([blob], `image-${i + 1}.jpg`, { type: "image/jpeg" }));
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
/** Textes réécrits par le studio, posés sur le modèle : le plus gros texte reçoit le titre, le suivant le sous-titre. */
function withTexts(doc: Row, texts: Row) {
  const layers = (doc.layers || []).map((l: Row) => ({ ...l }));
  const textual = layers.filter((l: Row) => ["text", "bubble", "label", "circletext"].includes(l.type) && typeof l.text === "string");
  const bySize = [...textual].sort((a, b) => (Number(b.size) || 0) - (Number(a.size) || 0));
  if (texts?.title && bySize[0]) bySize[0].text = texts.title;
  if (texts?.subtitle && bySize[1]) bySize[1].text = texts.subtitle;
  (texts?.items || []).forEach((it: string, i: number) => {
    const target = bySize[2 + i];
    if (target && it) target.text = it;
  });
  return { ...doc, layers };
}
const myPhotos = (data: Row) =>
  (data.files || [])
    .filter((f: Row) => f.mime?.startsWith("image/") && ["original", "brand", "generated"].includes(f.purpose))
    .map((f: Row) => f.id);

export default function Recreate({
  data,
  client,
  refresh,
  initialUrl,
  onOpenDesign,
  onGo,
}: {
  data: Row;
  client: Row;
  refresh: () => void;
  initialUrl?: string;
  onOpenDesign: (d: Row) => void;
  onGo: (tab: string) => void;
}) {
  const L = useL(),
    lang = useLang();
  const config = client?.config || {};
  const creator = config.workspaceType === "creator";
  const intents = creator ? CREATOR_INTENTS : BRAND_INTENTS;
  const [url, setUrl] = useState(initialUrl || ""),
    [shots, setShots] = useState<{ id: string; preview: string }[]>([]),
    [kind, setKind] = useState(""),
    [intent, setIntent] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [result, setResult] = useState<Row | null>(null),
    [help, setHelp] = useState(false),
    [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (initialUrl) setUrl(initialUrl);
  }, [initialUrl]);
  const aiOn = !!data.generationReady;
  const photos = useMemo(() => myPhotos(data), [data.files]);
  const name = config.creatorStrategy?.displayName || client?.name || "";
  const handle = config.templateHandle || "";
  const urlOk = !url.trim() || !!canonicalInstagram(url);

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setError("");
    setBusy("upload");
    try {
      const files: File[] = [];
      for (const f of Array.from(list)) {
        if (f.type.startsWith("video/")) {
          if (f.size > 50 * 1024 * 1024) throw Error(L("L’enregistrement dépasse 50 Mo.", "La grabación supera 50 MB.", "The recording is over 50 MB."));
          files.push(...(await framesFromVideo(f)));
        } else if (f.type.startsWith("image/")) files.push(await shrink(f, f.name));
      }
      const room = 6 - shots.length;
      if (!files.length) throw Error(L("Ajoutez des captures d’écran ou un enregistrement d’écran.", "Agrega capturas o una grabación de pantalla.", "Add screenshots or a screen recording."));
      const added: { id: string; preview: string }[] = [];
      for (const f of files.slice(0, room)) {
        const r = await uploadStudioMedia(f, { kind: "inspiration", client_id: client.id });
        added.push({ id: r.id, preview: URL.createObjectURL(f) });
      }
      setShots((s) => [...s, ...added]);
      if (!kind && files.length > 1 && Array.from(list).some((f) => f.type.startsWith("video/"))) setKind("reel");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  async function analyze() {
    setError("");
    setBusy("analyze");
    try {
      const r = await api("recreate-analyze", { client_id: client.id, url: url.trim(), file_ids: shots.map((s) => s.id), kind, intent });
      setResult(r.inspiration);
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  function openSuggestion(s: Row, recipe: Row) {
    if (s.kind === "layer") {
      let doc: Row = buildLayered(s.id, { lang, format: s.format, name, handle });
      if (photos.length) doc = fillPhotos(doc, photos);
      onOpenDesign({ id: "recreate-" + Date.now(), template: withTexts(doc, recipe.texts) });
    } else {
      const t: Row = newTemplate(s.id, config);
      const def: Row | null = templateById(s.id) as Row | null;
      const keys = new Set((def?.fields || []).map((f: Row) => f.key));
      const fields = { ...(t.fields || {}) };
      if (recipe.texts?.title && keys.has("title")) fields.title = recipe.texts.title;
      if (recipe.texts?.subtitle && keys.has("text")) fields.text = recipe.texts.subtitle;
      const max = def ? (def.photos as [number, number])[1] : 0;
      onOpenDesign({ id: "recreate-" + Date.now(), template: { ...t, fields, photos: max ? photos.slice(0, max) : [] } });
    }
  }
  const reset = () => {
    setResult(null);
    setShots([]);
    setUrl("");
    setKind("");
    setIntent("");
  };
  const intentLabel = (id: string) => {
    const i: Row | undefined = intents.find((x: Row) => x.id === id);
    return i ? `${i.emoji} ${L(i.label.fr, i.label.es, i.label.en)}` : "";
  };
  const kindLabel = (k: string) => (k === "reel" ? "Reel" : k === "carousel" ? L("Carrousel", "Carrusel", "Carousel") : L("Publication", "Publicación", "Post"));
  const note = L(
    "On reprend l’idée et la mise en page, jamais les images, la musique ou le texte d’un autre compte.",
    "Retomamos la idea y el diseño, nunca las imágenes, la música ni el texto de otra cuenta.",
    "We reuse the idea and the layout, never another account’s images, music or text.",
  );

  // ---------- Résultat ----------
  if (result) {
    const recipe = result.recipe || {};
    const sugg: Row[] = (result.suggestions || []).filter((s: Row) => (s.kind === "layer" ? layerTemplateById(s.id) : templateById(s.id)));
    const plan = (recipe.shots || []).map((s: Row, i: number) => `${i + 1}. ${s.action}${s.framing ? ` (${s.framing})` : ""} · ${s.duration} s`).join("\n");
    return (
      <section className="recreate">
        <div className="recreate-head">
          <div>
            <span className="step-tag">{L("RECRÉER CE POST", "RECREAR ESTE POST", "RECREATE THIS POST")}</span>
            <h2>{L("Voici la recette de ce post", "Esta es la receta de este post", "Here’s the recipe for this post")}</h2>
          </div>
          <button className="button secondary" onClick={reset}>
            {L("Un autre post", "Otro post", "Another post")}
          </button>
        </div>
        <div className="recreate-recipe">
          <div className="recreate-tags">
            <span className="pill">{kindLabel(recipe.kind)}</span>
            {recipe.kind === "carousel" && <span className="pill">{L(`${recipe.slides} diapos`, `${recipe.slides} diapositivas`, `${recipe.slides} slides`)}</span>}
            <span className="pill">{intentLabel(recipe.intent)}</span>
            {(recipe.colors || []).map((c: string) => (
              <span key={c} className="recreate-swatch" style={{ background: c }} title={c} />
            ))}
          </div>
          {result.ai ? (
            <>
              {recipe.summary && <p className="recreate-summary">{recipe.summary}</p>}
              <dl>
                {recipe.layout && (
                  <>
                    <dt>{L("Mise en page", "Diseño", "Layout")}</dt>
                    <dd>{recipe.layout}</dd>
                  </>
                )}
                {recipe.hook && (
                  <>
                    <dt>{L("Accroche", "Gancho", "Hook")}</dt>
                    <dd>{recipe.hook}</dd>
                  </>
                )}
                {recipe.texts?.title && (
                  <>
                    <dt>{L("Votre texte", "Tu texto", "Your text")}</dt>
                    <dd>
                      <b>{recipe.texts.title}</b>
                      {recipe.texts.subtitle ? ` — ${recipe.texts.subtitle}` : ""}
                    </dd>
                  </>
                )}
              </dl>
            </>
          ) : (
            <p className="recreate-summary">
              {L(
                "L’analyse automatique arrive bientôt. Voici les modèles qui correspondent au format et à l’envie choisis.",
                "El análisis automático llega pronto. Estas son las plantillas que corresponden al formato y la intención elegidos.",
                "Automatic analysis is coming soon. Here are the templates that match the format and goal you chose.",
              )}
            </p>
          )}
        </div>
        {recipe.kind === "reel" && (
          <div className="recreate-plan">
            <h3>
              <Film size={18} /> {L("Votre plan de tournage", "Tu plan de grabación", "Your filming plan")}
            </h3>
            {(recipe.shots || []).length ? (
              <ol>
                {recipe.shots.map((s: Row, i: number) => (
                  <li key={i}>
                    <b>{s.action}</b>
                    <span>
                      {s.framing ? s.framing + " · " : ""}
                      {s.duration} s
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">
                {L(
                  "Filmez 3 à 5 plans courts dans le même esprit, puis laissez le studio monter la vidéo.",
                  "Graba de 3 a 5 tomas cortas con el mismo estilo y deja que el estudio edite el video.",
                  "Film 3 to 5 short shots in the same spirit, then let the studio edit the video.",
                )}
              </p>
            )}
            <div className="recreate-actions">
              <button className="button primary" onClick={() => onGo("montage")}>
                {L("Ajouter mes vidéos et monter", "Agregar mis videos y editar", "Add my videos and edit")} <ArrowRight size={15} />
              </button>
              {plan && (
                <button
                  className="button secondary"
                  onClick={() => {
                    navigator.clipboard?.writeText(plan).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    });
                  }}
                >
                  {copied ? <Check size={15} /> : <Clipboard size={15} />} {copied ? L("Plan copié", "Plan copiado", "Plan copied") : L("Copier le plan", "Copiar el plan", "Copy the plan")}
                </button>
              )}
            </div>
          </div>
        )}
        <h3 className="recreate-sub">
          {recipe.kind === "reel"
            ? L("Une couverture pour votre Reel", "Una portada para tu Reel", "A cover for your Reel")
            : L("Vos 3 versions, prêtes à remplir", "Tus 3 versiones, listas para llenar", "Your 3 versions, ready to fill")}
        </h3>
        <div className="recreate-suggestions">
          {sugg.map((s) => {
            const def: Row | null = s.kind === "layer" ? layerTemplateById(s.id) : (templateById(s.id) as Row | null);
            return (
              <button key={s.kind + s.id} className="recreate-card" onClick={() => openSuggestion(s, recipe)}>
                {s.kind === "layer" ? (
                  <Thumb tid={s.id} format={s.format} lang={lang} photos={photos} name={name} handle={handle} />
                ) : (
                  <Preview tpl={{ ...exampleTemplate(s.id, config, lang), fields: { ...exampleTemplate(s.id, config, lang).fields, ...(recipe.texts?.title ? { title: recipe.texts.title } : {}) } } as any} lang={lang} className="template-thumb" />
                )}
                <b>{def ? L(def.name.fr, def.name.es, def.name.en) : s.id}</b>
                <span>
                  {L("Ouvrir avec mes photos", "Abrir con mis fotos", "Open with my photos")} <ArrowRight size={13} />
                </span>
              </button>
            );
          })}
        </div>
        <p className="recreate-note">{note}</p>
      </section>
    );
  }

  // ---------- Saisie ----------
  return (
    <section className="recreate">
      <div className="recreate-head">
        <div>
          <span className="step-tag">{L("RECRÉER CE POST", "RECREAR ESTE POST", "RECREATE THIS POST")}</span>
          <h2>{L("Un post vous plaît sur Instagram ? Recréez-le avec vos photos.", "¿Te gusta un post en Instagram? Recréalo con tus fotos.", "Love a post on Instagram? Recreate it with your photos.")}</h2>
        </div>
        <button className="text-link" onClick={() => setHelp(true)}>
          <Smartphone size={15} /> {L("Envoyer depuis Instagram en un geste", "Enviar desde Instagram en un gesto", "Send from Instagram in one tap")}
        </button>
      </div>
      <ol className="recreate-steps">
        <li>
          <b>{L("1. Le lien (facultatif)", "1. El enlace (opcional)", "1. The link (optional)")}</b>
          <label className="recreate-url">
            <AtSign size={17} />
            <input
              inputMode="url"
              placeholder="https://www.instagram.com/p/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-invalid={!urlOk}
            />
          </label>
          {!urlOk && <small className="error-text">{L("Collez le lien d’un post ou d’un Reel Instagram.", "Pega el enlace de un post o Reel de Instagram.", "Paste the link to an Instagram post or Reel.")}</small>}
          <small className="muted">{L("Dans Instagram : ⋯ ou « Partager » › « Copier le lien ».", "En Instagram: ⋯ o «Compartir» › «Copiar enlace».", "In Instagram: ⋯ or “Share” › “Copy link”.")}</small>
        </li>
        <li>
          <b>{L("2. Des captures d’écran du post", "2. Capturas de pantalla del post", "2. Screenshots of the post")}</b>
          <small className="muted">
            {L(
              "1 à 6 captures (une par diapo), ou l’enregistrement d’écran du Reel : le studio en garde 5 images.",
              "De 1 a 6 capturas (una por diapositiva), o la grabación de pantalla del Reel: el estudio guarda 5 imágenes.",
              "1 to 6 screenshots (one per slide), or the Reel’s screen recording: the studio keeps 5 frames.",
            )}
          </small>
          <div className="recreate-shots">
            {shots.map((s) => (
              <div key={s.id} className="recreate-shot">
                <img src={s.preview} alt="" />
                <button aria-label={L("Retirer", "Quitar", "Remove")} onClick={() => setShots((x) => x.filter((y) => y.id !== s.id))}>
                  <X size={13} />
                </button>
              </div>
            ))}
            {shots.length < 6 && (
              <button className="recreate-add" disabled={busy === "upload"} onClick={() => fileRef.current?.click()}>
                {busy === "upload" ? <Loader2 className="spin" size={20} /> : <ImagePlus size={20} />}
                <span>{L("Ajouter", "Agregar", "Add")}</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,video/mp4,video/quicktime" multiple hidden onChange={(e) => addFiles(e.target.files)} />
          </div>
        </li>
        <li>
          <b>{aiOn ? L("3. C’est plutôt… (facultatif)", "3. Es más bien… (opcional)", "3. It’s more of a… (optional)") : L("3. C’est plutôt…", "3. Es más bien…", "3. It’s more of a…")}</b>
          <div className="recreate-chips">
            {["post", "carousel", "reel"].map((k) => (
              <button key={k} className={"chip" + (kind === k ? " active" : "")} onClick={() => setKind(kind === k ? "" : k)}>
                {k === "reel" ? <Camera size={14} /> : null} {kindLabel(k)}
              </button>
            ))}
          </div>
          <div className="recreate-chips">
            {intents.map((i: Row) => (
              <button key={i.id} className={"chip" + (intent === i.id ? " active" : "")} onClick={() => setIntent(intent === i.id ? "" : i.id)}>
                {i.emoji} {L(i.label.fr, i.label.es, i.label.en)}
              </button>
            ))}
          </div>
        </li>
      </ol>
      {!aiOn && (
        <p className="soon-note">
          {L("L’analyse automatique arrive bientôt. Choisissez le format : le studio vous propose les modèles qui vont avec.", "El análisis automático llega pronto. Elige el formato: el estudio te propone las plantillas que van con él.", "Automatic analysis is coming soon. Pick the format: the studio suggests matching templates.")}
        </p>
      )}
      {error && <p className="error-text">{error}</p>}
      <div className="recreate-actions">
        <button className="button primary" disabled={!shots.length || !urlOk || !!busy} onClick={analyze}>
          {busy === "analyze" ? <Loader2 className="spin" size={16} /> : <Wand2 size={16} />}{" "}
          {busy === "analyze" ? L("Lecture du post…", "Leyendo el post…", "Reading the post…") : L("Recréer ce post", "Recrear este post", "Recreate this post")}
        </button>
      </div>
      <p className="recreate-note">{note}</p>
      {(data.inspirations || []).length > 0 && (
        <div className="recreate-history">
          <h3>{L("Vos dernières recettes", "Tus últimas recetas", "Your latest recipes")}</h3>
          {(data.inspirations || []).map((i: Row) => (
            <div key={i.id} className="recreate-history-row">
              <button className="text-link" onClick={() => setResult(i)}>
                {kindLabel(i.kind)} · {intentLabel(i.recipe?.intent)} · {new Date(i.created).toLocaleDateString(lang === "en" ? "en-US" : lang === "es" ? "es-MX" : "fr-FR")}
              </button>
              <button
                className="icon-button"
                aria-label={L("Supprimer", "Eliminar", "Delete")}
                onClick={async () => {
                  try {
                    await api("recreate-delete", { id: i.id });
                    refresh();
                  } catch (e: any) {
                    setError(e.message);
                  }
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      {help && <ShortcutHelp onClose={() => setHelp(false)} />}
    </section>
  );
}

/** Raccourci iPhone et partage Android : ouvrir le studio avec le lien déjà collé. */
export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const L = useL();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal recreate-help" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" aria-label={L("Fermer", "Cerrar", "Close")} onClick={onClose}>
          <X size={18} />
        </button>
        <h3>{L("Envoyer depuis Instagram en un geste", "Enviar desde Instagram en un gesto", "Send from Instagram in one tap")}</h3>
        <h4>iPhone</h4>
        <ol>
          <li>{L("Ouvrez l’app Raccourcis, touchez « + ».", "Abre la app Atajos y toca «+».", "Open the Shortcuts app and tap “+”.")}</li>
          <li>{L("Touchez ⓘ › activez « Afficher dans la feuille de partage », type : URL.", "Toca ⓘ › activa «Mostrar en la hoja para compartir», tipo: URL.", "Tap ⓘ › turn on “Show in Share Sheet”, type: URLs.")}</li>
          <li>
            {L("Ajoutez l’action « Ouvrir les URL » avec :", "Agrega la acción «Abrir URL» con:", "Add the “Open URLs” action with:")} <code>{origin}/studio?recreate=</code> {L("suivi de « Entrée du raccourci ».", "seguido de «Entrada del atajo».", "followed by “Shortcut Input”.")}
          </li>
          <li>{L("Nommez-le « Recréer avec Louvet ». Dans Instagram : Partager › Recréer avec Louvet.", "Nómbralo «Recrear con Louvet». En Instagram: Compartir › Recrear con Louvet.", "Name it “Recreate with Louvet”. In Instagram: Share › Recreate with Louvet.")}</li>
        </ol>
        <h4>Android</h4>
        <ol>
          <li>{L("Dans Chrome, ouvrez le studio › ⋮ › « Ajouter à l’écran d’accueil ».", "En Chrome, abre el estudio › ⋮ › «Agregar a la pantalla principal».", "In Chrome, open the studio › ⋮ › “Add to Home screen”.")}</li>
          <li>{L("Dans Instagram : Partager › Louvet Studio. Le lien est déjà collé.", "En Instagram: Compartir › Louvet Studio. El enlace ya está pegado.", "In Instagram: Share › Louvet Studio. The link is already pasted.")}</li>
        </ol>
        <p className="muted">{L("Il reste à ajouter vos captures d’écran : Instagram ne laisse pas récupérer les images d’un post.", "Solo falta agregar tus capturas: Instagram no permite obtener las imágenes de un post.", "You still add your screenshots: Instagram doesn’t let apps fetch a post’s images.")}</p>
      </div>
    </div>
  );
}
