"use client";
// Créatrices de contenu : choix facile d'un modèle (intention, format, « Pour vous », partir de ses photos)
// et éditeur à calques tactile (déplacer, agrandir, tourner, verrouiller, dupliquer, calques, diapos, carrousel continu).
// Tout est dessiné dans le navigateur (canvas) : aucune IA d'image, les photos ne sont jamais retouchées.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Undo2, Redo2, Download, Heart, Shuffle, Images, Layers, Plus, PaintBucket, GalleryHorizontal, Lock, Unlock, Copy, Trash2, Eye, EyeOff,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Type, MessageCircle, Tag, Sticker, MoveUpRight, ImagePlus, Smartphone, Check, X, Loader2, Sparkles, Crop, Pencil, Upload, BringToFront, SendToBack,
} from "lucide-react";
import { useL, useLang, type Lang } from "../lib/i18n";
import { uploadStudioMedia } from "../lib/direct-upload-client";
import { AddToCalendarButton } from "./add-to-calendar";
import { paletteFrom } from "../lib/templates.mjs";
import { layerCanvasSize, photoSlots, fillPhotos, emptySlots, makeLayer, topLayerAt, snap, setSlideCount, moveSlide, newLayerId, SLIDE_W, STICKERS, EMOJIS, LAYER_FONTS, MAX_LAYERS, MAX_SLIDES } from "../lib/layers.mjs";
import { LAYER_TEMPLATES, MOODS, PICK_FORMATS, buildLayered, layerTemplateById } from "../lib/layer-templates.mjs";
import { catalogue, BRAND_INTENTS, CREATOR_INTENTS } from "../lib/catalogue.mjs";
import { drawLayered, sliceLayered, LAYER_FONT_FILES, layerFont } from "../lib/layer-draw.mjs";
import "./layer-studio.css";

type Row = Record<string, any>;
type Doc = Row;
type Img = HTMLImageElement;
const makeCanvas = (w: number, h: number) => Object.assign(document.createElement("canvas"), { width: w, height: h });

// ---------- Polices et photos ----------
const fontLoads = new Map<string, Promise<void>>();
function loadFont(f: { family: string; file: string; weight: number }) {
  if (typeof window === "undefined" || !("FontFace" in window)) return Promise.resolve();
  if (!fontLoads.has(f.family)) {
    const face = new FontFace(f.family, `url(/media-engine/fonts/${f.file})`, { weight: String(f.weight) });
    fontLoads.set(f.family, face.load().then((ff) => void (document.fonts as any).add(ff)).catch(() => {}));
  }
  return fontLoads.get(f.family)!;
}
const allFonts = () => Promise.all(LAYER_FONT_FILES.map(loadFont));
const imageCache = new Map<string, Promise<Img | null>>();
function loadPhoto(id: string): Promise<Img | null> {
  if (!id) return Promise.resolve(null);
  if (!imageCache.has(id))
    imageCache.set(
      id,
      fetch("/api/studio/file/" + encodeURIComponent(id))
        .then((r) => (r.ok ? r.blob() : Promise.reject()))
        .then((b) => new Promise<Img | null>((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = URL.createObjectURL(b); }))
        .catch(() => null),
    );
  return imageCache.get(id)!;
}
async function photoMap(doc: Doc) {
  const ids = [doc.bg?.photo, ...doc.layers.filter((l: Row) => l.type === "photo").map((l: Row) => l.file)].filter(Boolean) as string[];
  const m = new Map<string, Img>();
  await Promise.all([...new Set(ids)].map(async (id) => { const i = await loadPhoto(id); if (i) m.set(id, i); }));
  return m;
}
async function post(action: string, body: Row) {
  const r = await fetch("/api/studio/" + action, { method: "POST", headers: { "Content-Type": "application/json", "X-Studio-Request": "1" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Erreur");
  return d;
}
const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(Error("export"))), "image/png"));
const imagesOf = (data: Row) => (data.files || []).filter((f: Row) => f.mime?.startsWith("image/") && f.purpose !== "chat");
const creatorName = (client: Row) => client?.config?.creatorStrategy?.displayName || client?.name || "";
const creatorHandle = (client: Row) => client?.config?.templateHandle || "";
const DRAFT = (cid: string) => "louvet-layer-draft:" + cid;
function readDraft(cid: string): Doc | null {
  try { const v = window.localStorage.getItem(DRAFT(cid)); return v ? JSON.parse(v) : null; } catch { return null; }
}
function writeDraft(cid: string, d: Doc | null) {
  try { if (d) window.localStorage.setItem(DRAFT(cid), JSON.stringify(d)); else window.localStorage.removeItem(DRAFT(cid)); } catch {}
}
const pickName = (t: Row, L: any) => L(t.name.fr, t.name.es, t.name.en);
const formatOf = (f: string) => (f === "post" || f === "carousel" ? "4:5" : "9:16");

// ---------- Aperçus de la galerie (petits, mis en cache, dessinés à l'affichage) ----------
const thumbCache = new Map<string, string>();
export function Thumb({ tid, format, lang, photos, name, handle }: { tid: string; format: string; lang: Lang; photos: string[]; name: string; handle: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = [tid, format, lang, photos.join(","), name, handle].join("|");
  const [src, setSrc] = useState(thumbCache.get(key) || "");
  useEffect(() => {
    if (thumbCache.has(key)) return setSrc(thumbCache.get(key)!);
    let alive = true;
    const el = ref.current;
    if (!el) return;
    const go = async () => {
      await allFonts();
      let d = buildLayered(tid, { lang, format, name, handle });
      if (photos.length) d = fillPhotos(d, photos);
      const m = await photoMap(d);
      const [W, H] = layerCanvasSize(d) as [number, number];
      const s = 270 / Math.min(W, SLIDE_W * Math.min(Number(d.slides) || 1, 2));
      const c = makeCanvas(Math.round(Math.min(W, SLIDE_W * 2) * s), Math.round(H * s));
      drawLayered(c.getContext("2d")!, d, { photos: m, scale: s, makeCanvas });
      const url = c.toDataURL("image/jpeg", 0.82);
      thumbCache.set(key, url);
      if (alive) setSrc(url);
    };
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: "200px" });
    io.observe(el);
    return () => { alive = false; io.disconnect(); };
  }, [key]);
  return <div ref={ref} className={"lp-thumb" + (format === "4:5" ? " post" : "")}>{src ? <img src={src} alt="" /> : <span className="lp-thumb-wait" />}</div>;
}

// ---------- Choix de photos (plusieurs d'un coup, numérotées dans l'ordre) ----------
export function PhotoSheet({ data, client, need, title, onDone, onClose, refresh }: { data: Row; client: Row; need: number; title?: string; onDone: (ids: string[]) => void; onClose: () => void; refresh: () => void }) {
  const L = useL();
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [extra, setExtra] = useState<Row[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const files = [...extra, ...imagesOf(data).filter((f: Row) => f.purpose !== "design" && !extra.some((x) => x.id === f.id))].slice(0, 120);
  const max = need > 0 ? need : 10;
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : max === 1 ? [id] : c.length >= max ? c : [...c, id]));
  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    setError("");
    try {
      const added: Row[] = [];
      for (const f of Array.from(list).slice(0, 10)) {
        const d = await uploadStudioMedia(f, { kind: "photo", client_id: client.id });
        added.push({ id: d.id, mime: f.type });
      }
      setExtra((e) => [...added, ...e]);
      setChosen((c) => [...c, ...added.map((a) => a.id)].slice(0, max));
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  return (
    <Sheet title={title || (need > 1 ? L(`Choisissez ${need} photos`, `Elige ${need} fotos`, `Choose ${need} photos`) : need === 1 ? L("Choisissez une photo", "Elige una foto", "Choose a photo") : L("Choisissez vos photos", "Elige tus fotos", "Choose your photos"))} onClose={onClose}>
      <p className="lp-sheet-hint">
        {need === 1
          ? L("Touchez une photo.", "Toca una foto.", "Tap a photo.")
          : L("Touchez les photos dans l’ordre où vous voulez les voir.", "Toca las fotos en el orden en que quieres verlas.", "Tap photos in the order you want them.")}
      </p>
      {error && <p className="lp-error">{error}</p>}
      <div className="lp-photo-grid">
        <button className="lp-photo-add" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="spin" size={22} /> : <Upload size={22} />}
          <span>{L("Depuis mon téléphone", "Desde mi teléfono", "From my phone")}</span>
        </button>
        {files.map((f: Row) => {
          const i = chosen.indexOf(f.id);
          return (
            <button key={f.id} className={"lp-photo" + (i >= 0 ? " on" : "")} onClick={() => toggle(f.id)} aria-pressed={i >= 0}>
              <img src={"/api/studio/file/" + f.id} alt="" loading="lazy" />
              {i >= 0 && <b>{i + 1}</b>}
            </button>
          );
        })}
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      <div className="lp-sheet-bar">
        <span>{need > 0 ? `${chosen.length}/${need}` : chosen.length}</span>
        <button className="button primary" disabled={!chosen.length} onClick={() => onDone(chosen)}>
          <Check size={16} /> {L("Utiliser", "Usar", "Use")}
        </button>
      </div>
    </Sheet>
  );
}
function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: any; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="lp-sheet-back" onClick={onClose}>
      <div className={"lp-sheet" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="lp-sheet-head">
          <b>{title}</b>
          <button className="icon-button" onClick={onClose} aria-label="×"><X size={18} /></button>
        </div>
        <div className="lp-sheet-body">{children}</div>
      </div>
    </div>
  );
}

// ---------- Écran de choix ----------
export function LayerPicker({
  data,
  client,
  onOpen,
  refresh,
  classicThumb,
  onOpenClassic,
}: {
  data: Row;
  client: Row;
  onOpen: (d: Doc, needPhotos?: boolean) => void;
  refresh: () => void;
  /** Aperçu d'un modèle classique (texte, service, montage tendance). */
  classicThumb?: (id: string) => React.ReactNode;
  /** Ouvre un modèle classique dans son éditeur. */
  onOpenClassic?: (id: string, photos?: string[]) => void;
}) {
  const L = useL(),
    lang = useLang();
  const config = client?.config || {};
  const brand = config.workspaceType !== "creator";
  const [format, setFormat] = useState("story");
  const [intent, setIntent] = useState("");
  const [seed, setSeed] = useState(0);
  const [favorites, setFavorites] = useState<string[]>(Array.isArray(config.templateFavorites) ? config.templateFavorites : []);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState<Doc | null>(null);
  useEffect(() => setDraft(readDraft(client.id)), [client.id]);
  const recent = useMemo(() => {
    const out: string[] = [];
    for (const d of data.designs || []) if (d.template?.id === "layers" && d.template.from && !out.includes(d.template.from)) out.push(d.template.from);
    return out;
  }, [data.designs]);
  const myPhotos = useMemo(() => imagesOf(data).filter((f: Row) => f.purpose !== "design").map((f: Row) => f.id).slice(0, 7), [data.files]);
  const previewPhotos = picked || myPhotos;
  const name = creatorName(client),
    handle = creatorHandle(client);
  const f = formatOf(format);
  const intents = brand ? BRAND_INTENTS : CREATOR_INTENTS;
  const { forYou, rest, total } = catalogue(config, { brand, favorites, recent, format, intent, photoCount: picked?.length || 0 } as any) as {
    forYou: Row[];
    rest: Row[];
    total: number;
  };
  const shuffle = (list: Row[]) => {
    if (!seed) return list;
    let s = seed;
    const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    return [...list].map((t) => ({ t, k: r() })).sort((a, b) => a.k - b.k).map((x) => x.t);
  };
  async function fav(tid: string) {
    const on = !favorites.includes(tid);
    setFavorites((f) => (on ? [tid, ...f] : f.filter((x) => x !== tid)));
    try {
      const r = await post("template-favorite", { client_id: client.id, template_id: tid, on });
      setFavorites(r.favorites);
    } catch {}
  }
  function open(t: Row) {
    let d = buildLayered(t.id, { lang, format: f, name, handle });
    if (picked?.length) d = fillPhotos(d, picked);
    onOpen(d, t.photos > 0 && emptySlots(d) > 0);
  }
  const photoText = (n: number) =>
    n ? L(`${n} photo${n > 1 ? "s" : ""}`, `${n} foto${n > 1 ? "s" : ""}`, `${n} photo${n > 1 ? "s" : ""}`) : L("Sans photo", "Sin foto", "No photo");
  const card = (x: Row) => {
    const isLayer = x.kind === "layer";
    const t = x.t,
      e = x.e;
    const range = !isLayer ? (e.photos as [number, number]) : null;
    return (
      <div className="lp-card" key={x.kind + ":" + x.id}>
        <button className="lp-card-main" onClick={() => (isLayer ? open(t) : onOpenClassic?.(e.id, picked || undefined))}>
          {isLayer ? (
            <Thumb tid={t.id} format={f} lang={lang} photos={previewPhotos} name={name} handle={handle} />
          ) : (
            <span className="lp-classic-thumb">{classicThumb?.(e.id)}</span>
          )}
          <b>{isLayer ? pickName(t, L) : L(e.name.fr, e.name.es, e.name.en)}</b>
          <small>
            {isLayer
              ? photoText(t.photos)
              : range![1] === 0
                ? L("Sans photo", "Sin foto", "No photo")
                : range![0] === range![1]
                  ? photoText(range![0])
                  : L(`${range![0]} à ${range![1]} photos`, `${range![0]} a ${range![1]} fotos`, `${range![0]}–${range![1]} photos`)}{" "}
            ·{" "}
            {isLayer
              ? t.seamless
                ? L("carrousel continu", "carrusel continuo", "seamless carousel")
                : L(`${t.slides} diapo${t.slides > 1 ? "s" : ""}`, `${t.slides} diapositiva${t.slides > 1 ? "s" : ""}`, `${t.slides} slide${t.slides > 1 ? "s" : ""}`)
              : format === "carousel"
                ? L("carrousel", "carrusel", "carousel")
                : L("1 diapo", "1 diapositiva", "1 slide")}
          </small>
        </button>
        <button className={"lp-fav" + (favorites.includes(x.id) ? " on" : "")} onClick={() => fav(x.id)} aria-pressed={favorites.includes(x.id)} aria-label={L("Favori", "Favorito", "Favorite")}>
          <Heart size={16} />
        </button>
      </div>
    );
  };
  return (
    <section className="lp">
      <div className="lp-head">
        <h3>{L("Que voulez-vous publier ?", "¿Qué quieres publicar?", "What do you want to post?")}</h3>
        <div className="lp-formats" role="tablist">
          {PICK_FORMATS.map((p) => (
            <button key={p.id} role="tab" aria-selected={format === p.id} className={format === p.id ? "on" : ""} onClick={() => setFormat(p.id)}>
              {L(p.label.fr, p.label.es, p.label.en)}
            </button>
          ))}
        </div>
      </div>
      <div className="lp-intents">
        <button className={!intent ? "on" : ""} onClick={() => setIntent("")}>✨ {L("Tout voir", "Ver todo", "See all")}</button>
        {intents.map((i) => (
          <button key={i.id} className={intent === i.id ? "on" : ""} onClick={() => setIntent(intent === i.id ? "" : i.id)}>
            {i.emoji} {L(i.label.fr, i.label.es, i.label.en)}
          </button>
        ))}
      </div>
      <div className="lp-actions">
        <button className="button primary" onClick={() => setSheet(true)}>
          <Images size={16} /> {picked ? L(`${picked.length} photo(s) choisie(s) · changer`, `${picked.length} foto(s) elegida(s) · cambiar`, `${picked.length} photo(s) picked · change`) : L("Partir de mes photos", "Empezar con mis fotos", "Start from my photos")}
        </button>
        {picked && (
          <button className="button secondary" onClick={() => setPicked(null)}>
            <X size={15} /> {L("Retirer", "Quitar", "Clear")}
          </button>
        )}
        <button className="button secondary" onClick={() => setSeed((s) => (s + 7919) >>> 0 || 1)}>
          <Shuffle size={15} /> {L("Mélanger", "Mezclar", "Shuffle")}
        </button>
        {draft && (
          <button className="button secondary" onClick={() => onOpen(draft)}>
            <Pencil size={15} /> {L("Reprendre mon brouillon", "Retomar mi borrador", "Resume my draft")}
          </button>
        )}
      </div>
      {!total && <p className="muted">{L("Aucun modèle pour ce choix. Essayez un autre format ou « Tout voir ».", "Ninguna plantilla para esta opción. Prueba otro formato o “Ver todo”.", "No template for this choice. Try another format or “See all”.")}</p>}
      {!!forYou.length && (
        <div className="lp-section">
          <h4>{picked ? L("Pour vos photos", "Para tus fotos", "For your photos") : L("Pour vous", "Para ti", "For you")}</h4>
          <div className="lp-row">{forYou.map(card)}</div>
        </div>
      )}
      {MOODS.map((m) => {
        const list = shuffle(rest.filter((x) => x.mood === m.id));
        if (!list.length) return null;
        return (
          <div className="lp-section" key={m.id}>
            <h4>{L(m.label.fr, m.label.es, m.label.en)}</h4>
            <div className="lp-grid">{list.map(card)}</div>
          </div>
        );
      })}
      {sheet && (
        <PhotoSheet
          data={data}
          client={client}
          need={0}
          refresh={refresh}
          onClose={() => setSheet(false)}
          onDone={(ids) => {
            setPicked(ids);
            setSheet(false);
          }}
        />
      )}
    </section>
  );
}

// ---------- Éditeur ----------
const TEXTY = ["text", "bubble", "label", "circletext"];
const SWATCHES = ["#FFFFFF", "#1A1A1A", "#F5C542", "#FF8FB8", "#86CDF5", "#3DDC5A", "#C8323F", "#7A1F2B", "#E8E2DA", "#5B8DEF", "#F4B6CF", "#2F4A3A"];
type Gesture =
  | { kind: "drag"; i: number; sx: number; sy: number; lx: number; ly: number; moved: boolean; t: number }
  | { kind: "resize" | "width"; i: number; l: Row; d0: number; ax: number }
  | { kind: "rotate"; i: number; l: Row }
  | { kind: "pinch"; i: number; l: Row; d0: number; a0: number }
  | { kind: "zoom"; z0: number; d0: number }
  | { kind: "pan"; sx: number; sl: number }
  | { kind: "crop"; i: number; sx: number; sy: number; c0: Row }
  | null;

export function LayerEditor({ data, client, initial, onClose, refresh, needPhotos }: { data: Row; client: Row; initial: Doc; onClose: () => void; refresh: () => void; needPhotos?: boolean }) {
  const L = useL(),
    lang = useLang();
  const [doc, setDoc] = useState<Doc>(initial);
  const [past, setPast] = useState<Doc[]>([]);
  const [future, setFuture] = useState<Doc[]>([]);
  const [sel, setSel] = useState(-1);
  const [sheet, setSheet] = useState<string>(needPhotos ? "fill" : "");
  const [photoTarget, setPhotoTarget] = useState<{ kind: "fill" | "layer" | "bg" | "add"; i?: number }>({ kind: "fill" });
  const [guides, setGuides] = useState<Row[]>([]);
  const [zoom, setZoom] = useState(1);
  const [crop, setCrop] = useState(false);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState("");
  const [photos, setPhotos] = useState<Map<string, Img>>(new Map());
  const [boxW, setBoxW] = useState(360);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const press = useRef<any>(null);
  const lastTap = useRef({ t: 0, i: -1 });
  const palette = useMemo(() => [...new Set([...paletteFrom(client?.config || {}), ...SWATCHES])].slice(0, 16), [client?.config?.colors]);
  const [W, H] = layerCanvasSize(doc) as [number, number];
  const wide = boxW > 700;
  const visible = doc.slides === 1 ? 1 : wide ? Math.min(2, doc.slides) : 1.15;
  const maxH = typeof window !== "undefined" ? Math.max(320, window.innerHeight - (wide ? 230 : 250)) : 700;
  const scale = Math.min(boxW / (SLIDE_W * visible), maxH / H) * zoom;
  const cur = sel >= 0 ? doc.layers[sel] : null;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // L'éditeur occupe l'écran : on remonte jusqu'à lui.
    el.parentElement?.scrollIntoView({ block: "start" });
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth - 2));
    ro.observe(el);
    setBoxW(el.clientWidth - 2);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    let alive = true;
    photoMap(doc).then((m) => alive && setPhotos(m));
    return () => { alive = false; };
  }, [JSON.stringify([doc.bg?.photo, doc.layers.map((l: Row) => l.file || "")])]);
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => { allFonts().then(() => setFontsReady(true)); }, []);
  // Dessin (une image par frame au plus).
  const raf = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const c = canvasRef.current;
      if (!c) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(W * scale * dpr),
        h = Math.round(H * scale * dpr);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      drawLayered(c.getContext("2d")!, doc, { photos, scale: scale * dpr, showEmpty: true, makeCanvas });
    });
  }, [doc, photos, scale, fontsReady]);
  // Brouillon gardé sur l'appareil.
  useEffect(() => {
    const t = setTimeout(() => writeDraft(client.id, doc), 600);
    return () => clearTimeout(t);
  }, [doc]);

  // ----- Historique -----
  const snapshot = useCallback(() => {
    setPast((p) => [...p.slice(-49), doc]);
    setFuture([]);
  }, [doc]);
  const commit = (next: Doc) => {
    setPast((p) => [...p.slice(-49), doc]);
    setFuture([]);
    setDoc(next);
  };
  const patchLayer = (i: number, patch: Row, history = true) => {
    const next = { ...doc, layers: doc.layers.map((l: Row, k: number) => (k === i ? { ...l, ...patch } : l)) };
    history ? commit(next) : setDoc(next);
  };
  const undo = () => { if (!past.length) return; setFuture((f) => [doc, ...f]); setDoc(past[past.length - 1]); setPast((p) => p.slice(0, -1)); setSel(-1); };
  const redo = () => { if (!future.length) return; setPast((p) => [...p, doc]); setDoc(future[0]); setFuture((f) => f.slice(1)); setSel(-1); };

  // ----- Repère du canvas -----
  const toCanvas = (cx: number, cy: number) => {
    const r = overlayRef.current!.getBoundingClientRect();
    return { x: (cx - r.left) / scale, y: (cy - r.top) / scale };
  };
  const visibleCenter = () => {
    const el = scrollRef.current!;
    const off = Math.max(0, (el.clientWidth - W * scale) / 2);
    return { x: Math.max(80, Math.min(W - 80, (el.scrollLeft + el.clientWidth / 2 - off) / scale)), y: H / 2 };
  };
  function local(l: Row, x: number, y: number) {
    const a = (-(l.rot || 0) * Math.PI) / 180;
    const dx = x - l.x,
      dy = y - l.y;
    return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
  }
  const two = () => {
    const [a, b] = [...pointers.current.values()];
    return { d: Math.hypot(b.x - a.x, b.y - a.y), a: Math.atan2(b.y - a.y, b.x - a.x) };
  };

  function onDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const handle = (e.target as HTMLElement).dataset?.handle;
    const p = toCanvas(e.clientX, e.clientY);
    clearTimeout(press.current);
    if (pointers.current.size === 2) {
      const t = two();
      if (sel >= 0 && !doc.layers[sel].locked) {
        snapshot();
        gesture.current = { kind: "pinch", i: sel, l: { ...doc.layers[sel] }, d0: t.d, a0: t.a };
      } else gesture.current = { kind: "zoom", z0: zoom, d0: t.d };
      return;
    }
    if (handle && sel >= 0) {
      snapshot();
      const l = { ...doc.layers[sel] };
      const q = local(l, p.x, p.y);
      if (handle === "rotate") gesture.current = { kind: "rotate", i: sel, l };
      else gesture.current = { kind: handle === "width" ? "width" : "resize", i: sel, l, d0: Math.max(1, Math.hypot(q.x, q.y)), ax: Math.max(1, Math.abs(q.x)) };
      return;
    }
    const i = topLayerAt(doc, p.x, p.y, 12 / scale);
    if (crop && sel >= 0 && i === sel) {
      snapshot();
      gesture.current = { kind: "crop", i, sx: p.x, sy: p.y, c0: { ...(doc.layers[i].crop || { x: 0, y: 0, z: 1 }) } };
      return;
    }
    if (i < 0) {
      setSel(-1);
      setCrop(false);
      setMenu(false);
      gesture.current = { kind: "pan", sx: e.clientX, sl: scrollRef.current!.scrollLeft };
      return;
    }
    if (i !== sel) { setCrop(false); setMenu(false); }
    setSel(i);
    const l = doc.layers[i];
    // Double toucher : modifier le texte ou choisir la photo.
    const now = Date.now();
    if (lastTap.current.i === i && now - lastTap.current.t < 320) {
      lastTap.current = { t: 0, i: -1 };
      if (TEXTY.includes(l.type) || l.type === "ui") setSheet("text");
      else if (l.type === "photo") { setPhotoTarget({ kind: "layer", i }); setSheet("photo"); }
      gesture.current = null;
      return;
    }
    lastTap.current = { t: now, i };
    press.current = setTimeout(() => { if (gesture.current?.kind === "drag" && !gesture.current.moved) { setMenu(true); gesture.current = null; } }, 520);
    gesture.current = { kind: "drag", i, sx: p.x, sy: p.y, lx: l.x, ly: l.y, moved: false, t: now };
  }
  function onMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    const p = toCanvas(e.clientX, e.clientY);
    if (g.kind === "zoom" && pointers.current.size === 2) return setZoom(Math.min(3, Math.max(0.6, g.z0 * (two().d / g.d0))));
    if (g.kind === "pan") { scrollRef.current!.scrollLeft = g.sl - (e.clientX - g.sx); return; }
    if (g.kind === "pinch" && pointers.current.size === 2) {
      const t = two(),
        f = Math.min(6, Math.max(0.15, t.d / g.d0));
      if (crop && g.l.type === "photo") return patchLayer(g.i, { crop: { ...(g.l.crop || {}), z: Math.min(4, Math.max(1, (g.l.crop?.z || 1) * f)) } }, false);
      const patch: Row = { w: Math.max(20, g.l.w * f), h: Math.max(20, g.l.h * f), rot: Math.round((g.l.rot || 0) + ((t.a - g.a0) * 180) / Math.PI) };
      if (g.l.size) patch.size = Math.max(10, Math.min(500, g.l.size * f));
      return patchLayer(g.i, patch, false);
    }
    if (g.kind === "drag") {
      const l = doc.layers[g.i];
      if (!l || l.locked) return;
      const dx = p.x - g.sx,
        dy = p.y - g.sy;
      if (!g.moved && Math.hypot(dx, dy) * scale < 4) return;
      g.moved = true;
      clearTimeout(press.current);
      const s = snap(doc, l, g.lx + dx, g.ly + dy, 14 / scale);
      setGuides(s.guides);
      return setDoc((d) => ({ ...d, layers: d.layers.map((x: Row, k: number) => (k === g.i ? { ...x, x: s.x, y: s.y } : x)) }));
    }
    if (g.kind === "crop") {
      const l = doc.layers[g.i],
        img = photos.get(l.file);
      if (!img) return;
      const iw = img.naturalWidth,
        ih = img.naturalHeight,
        z = g.c0.z || 1;
      const s = Math.max(l.w / iw, l.h / ih) * z;
      const ex = Math.max(1, iw * s - l.w),
        ey = Math.max(1, ih * s - l.h);
      const q0 = local(l, g.sx + l.x, g.sy + l.y),
        q1 = local(l, p.x + l.x, p.y + l.y);
      const cx = Math.max(-1, Math.min(1, g.c0.x - (2 * (q1.x - q0.x)) / ex)),
        cy = Math.max(-1, Math.min(1, g.c0.y - (2 * (q1.y - q0.y)) / ey));
      return patchLayer(g.i, { crop: { x: cx, y: cy, z } }, false);
    }
    if (g.kind === "rotate") {
      let a = (Math.atan2(p.y - g.l.y, p.x - g.l.x) * 180) / Math.PI + 90;
      for (const s of [-180, -90, 0, 90, 180]) if (Math.abs(a - s) < 4) a = s;
      return patchLayer(g.i, { rot: Math.round(a) }, false);
    }
    if (g.kind === "resize" || g.kind === "width") {
      const q = local(g.l, p.x, p.y);
      if (g.kind === "width") return patchLayer(g.i, { w: Math.max(40, (g.l.w * Math.abs(q.x)) / g.ax) }, false);
      const f = Math.min(8, Math.max(0.1, Math.hypot(q.x, q.y) / g.d0));
      const patch: Row = { w: Math.max(20, g.l.w * f), h: Math.max(20, g.l.h * f) };
      if (g.l.size) patch.size = Math.max(10, Math.min(500, g.l.size * f));
      return patchLayer(g.i, patch, false);
    }
  }
  function onUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    clearTimeout(press.current);
    const g = gesture.current;
    if (g?.kind === "drag" && g.moved) setPast((p) => [...p.slice(-49), { ...doc, layers: doc.layers.map((l: Row, k: number) => (k === g.i ? { ...l, x: g.lx, y: g.ly } : l)) }]);
    if (pointers.current.size === 0) { gesture.current = null; setGuides([]); }
    else if (g?.kind === "pinch" || g?.kind === "zoom") gesture.current = null;
  }

  // ----- Actions sur l'élément choisi -----
  const del = () => { if (sel < 0) return; commit({ ...doc, layers: doc.layers.filter((_: Row, k: number) => k !== sel) }); setSel(-1); setMenu(false); };
  const duplicate = () => {
    if (sel < 0 || doc.layers.length >= MAX_LAYERS) return;
    const c = { ...doc.layers[sel], id: newLayerId(), x: doc.layers[sel].x + 40, y: doc.layers[sel].y + 40, locked: false };
    commit({ ...doc, layers: [...doc.layers.slice(0, sel + 1), c, ...doc.layers.slice(sel + 1)] });
    setSel(sel + 1);
    setMenu(false);
  };
  const reorder = (i: number, to: number) => {
    if (to < 0 || to >= doc.layers.length) return;
    const ls = [...doc.layers];
    const [x] = ls.splice(i, 1);
    ls.splice(to, 0, x);
    commit({ ...doc, layers: ls });
    if (sel === i) setSel(to);
  };
  const add = (layer: Row) => {
    if (doc.layers.length >= MAX_LAYERS) return setError(L(`${MAX_LAYERS} éléments au maximum.`, `${MAX_LAYERS} elementos como máximo.`, `${MAX_LAYERS} elements at most.`));
    commit({ ...doc, layers: [...doc.layers, layer] });
    setSel(doc.layers.length);
    setSheet("");
  };
  const addKind = (kind: string, opts: Row = {}) => {
    const c = visibleCenter();
    add(makeLayer(kind, c.x, c.y, lang, opts) as Row);
  };
  const toggleAnnotations = () => {
    const kinds = ["sticker", "arrow", "doodle"];
    const anyVisible = doc.layers.some((l: Row) => kinds.includes(l.type) && !l.hidden);
    commit({ ...doc, layers: doc.layers.map((l: Row) => (kinds.includes(l.type) ? { ...l, hidden: anyVisible } : l)) });
  };
  function usePhotos(ids: string[]) {
    const t = photoTarget;
    if (t.kind === "bg") commit({ ...doc, bg: { ...doc.bg, photo: ids[0], crop: { x: 0, y: 0, z: 1 } } });
    else if (t.kind === "add") {
      const c = visibleCenter();
      const ls = ids.slice(0, MAX_LAYERS - doc.layers.length).map((id, k) => makeLayer("photo", c.x + k * 60, c.y + k * 60, lang, { file: id }) as Row);
      commit({ ...doc, layers: [...doc.layers, ...ls] });
      setSel(doc.layers.length);
    } else if (t.kind === "layer" && t.i !== undefined) {
      // Plusieurs photos : la première ici, les suivantes dans les emplacements vides suivants.
      const order = photoSlots(doc);
      const start = order.indexOf(t.i);
      const targets = [t.i, ...order.slice(start + 1).filter((i: number) => !doc.layers[i].file), ...order.slice(0, start).filter((i: number) => !doc.layers[i].file)];
      const ls = doc.layers.map((l: Row) => ({ ...l }));
      ids.forEach((id, k) => { if (targets[k] !== undefined) ls[targets[k]] = { ...ls[targets[k]], file: id, crop: { x: 0, y: 0, z: 1 } }; });
      commit({ ...doc, layers: ls });
    } else {
      // Remplissage des emplacements vides, dans l'ordre.
      const empties = photoSlots(doc).filter((i: number) => !doc.layers[i].file);
      const ls = doc.layers.map((l: Row) => ({ ...l }));
      ids.forEach((id, k) => { if (empties[k] !== undefined) ls[empties[k]] = { ...ls[empties[k]], file: id, crop: { x: 0, y: 0, z: 1 } }; });
      commit({ ...doc, layers: ls });
    }
    setSheet("");
  }
  const removeSlide = (s: number) => {
    if (doc.slides <= 1) return;
    const ls = doc.layers
      .filter((l: Row) => Math.min(doc.slides - 1, Math.max(0, Math.floor(l.x / SLIDE_W))) !== s)
      .map((l: Row) => (Math.floor(l.x / SLIDE_W) > s ? { ...l, x: l.x - SLIDE_W } : l));
    commit({ ...doc, slides: doc.slides - 1, layers: ls });
    setSel(-1);
  };

  // ----- Export -----
  const empties = emptySlots(doc);
  async function render() {
    await allFonts();
    const m = await photoMap(doc);
    const big = makeCanvas(W, H);
    drawLayered(big.getContext("2d")!, doc, { photos: m, makeCanvas });
    return doc.slides > 1 ? (sliceLayered(big, doc, makeCanvas) as HTMLCanvasElement[]) : [big];
  }
  async function save() {
    setBusy("save");
    setError("");
    setNotice("");
    setMenu(false);
    try {
      const parts = await render();
      let first = "";
      const base = (doc.from || "visuel").replace(/[^a-z0-9-]/g, "");
      for (let i = 0; i < parts.length; i++) {
        const file = new File([await toBlob(parts[i])], `${base}${parts.length > 1 ? "-" + (i + 1) : ""}.png`, { type: "image/png" });
        const up = await uploadStudioMedia(file, { kind: "design", client_id: client.id, template: { ...doc, slide: i } });
        if (!first) first = up.id;
      }
      setSavedId(first);
      writeDraft(client.id, null);
      setNotice(parts.length > 1 ? L(`${parts.length} diapos enregistrées dans Mes visuels.`, `${parts.length} diapositivas guardadas en Mis imágenes.`, `${parts.length} slides saved to My visuals.`) : L("Visuel enregistré dans Mes visuels.", "Imagen guardada en Mis imágenes.", "Visual saved to My visuals."));
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function download() {
    setBusy("download");
    setError("");
    try {
      const parts = await render();
      for (let i = 0; i < parts.length; i++) {
        const b = await toBlob(parts[i]);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = `${doc.from || "visuel"}${parts.length > 1 ? "-" + String(i + 1).padStart(2, "0") : ""}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  // ----- Sélection affichée -----
  const selBox = cur && !cur.hidden ? (
    <div
      className={"le-sel" + (cur.locked ? " locked" : "") + (crop ? " crop" : "")}
      style={{ left: cur.x * scale, top: cur.y * scale, width: cur.w * scale, height: cur.h * scale, transform: `translate(-50%,-50%) rotate(${cur.rot || 0}deg)` }}
    >
      {!cur.locked && !crop && (
        <>
          <span className="le-h rot" data-handle="rotate" />
          <span className="le-h br" data-handle="resize" />
          <span className="le-h tl" data-handle="resize" />
          {["text", "bubble", "label"].includes(cur.type) && <span className="le-h mr" data-handle="width" />}
        </>
      )}
    </div>
  ) : null;
  const tool = cur && (
    <div className="le-mini" style={{ left: Math.max(70, Math.min(W * scale - 70, cur.x * scale)), top: Math.max(8, (cur.y - cur.h / 2) * scale - 54) }} onPointerDown={(e) => e.stopPropagation()}>
      <button onClick={() => patchLayer(sel, { locked: !cur.locked })} aria-label={cur.locked ? L("Déverrouiller", "Desbloquear", "Unlock") : L("Verrouiller", "Bloquear", "Lock")}>{cur.locked ? <Unlock size={16} /> : <Lock size={16} />}</button>
      <button onClick={duplicate} aria-label={L("Dupliquer", "Duplicar", "Duplicate")}><Copy size={16} /></button>
      <button onClick={del} aria-label={L("Supprimer", "Eliminar", "Delete")}><Trash2 size={16} /></button>
      {menu && (
        <>
          <button onClick={() => reorder(sel, doc.layers.length - 1)} aria-label={L("Premier plan", "Al frente", "Bring to front")}><BringToFront size={16} /></button>
          <button onClick={() => reorder(sel, 0)} aria-label={L("Arrière-plan", "Al fondo", "Send to back")}><SendToBack size={16} /></button>
        </>
      )}
    </div>
  );
  const emptyButtons = doc.layers.map((l: Row, i: number) =>
    l.type === "photo" && !l.file && !l.hidden ? (
      <button key={l.id} className="le-plus" style={{ left: l.x * scale, top: l.y * scale }} onPointerDown={(e) => e.stopPropagation()} onClick={() => { setSel(i); setPhotoTarget({ kind: "layer", i }); setSheet("photo"); }} aria-label={L("Ajouter une photo", "Agregar una foto", "Add a photo")}>
        <Plus size={22} />
      </button>
    ) : null,
  );

  // ----- Barres d'outils -----
  const ctx = cur ? (
    <div className="le-ctx">
      <Tool icon={<Check size={18} />} label={L("OK", "OK", "Done")} onClick={() => { setSel(-1); setCrop(false); setMenu(false); }} />
      {(TEXTY.includes(cur.type) || cur.type === "ui") && <Tool icon={<Pencil size={18} />} label={L("Texte", "Texto", "Text")} onClick={() => setSheet("text")} />}
      {TEXTY.includes(cur.type) && <Tool icon={<Type size={18} />} label={L("Police", "Fuente", "Font")} onClick={() => setSheet("font")} />}
      {cur.type === "photo" && <Tool icon={<Images size={18} />} label={L("Remplacer", "Cambiar", "Replace")} onClick={() => { setPhotoTarget({ kind: "layer", i: sel }); setSheet("photo"); }} />}
      {cur.type === "photo" && cur.file && <Tool icon={<Crop size={18} />} on={crop} label={L("Recadrer", "Recortar", "Crop")} onClick={() => setCrop(!crop)} />}
      {cur.type === "photo" && <Tool icon={<ImagePlus size={18} />} label={L("Cadre", "Marco", "Frame")} onClick={() => setSheet("frame")} />}
      {cur.type === "sticker" && <Tool icon={<Sticker size={18} />} label={L("Changer", "Cambiar", "Change")} onClick={() => setSheet("sticker")} />}
      {cur.type !== "photo" && <Tool icon={<PaintBucket size={18} />} label={L("Couleur", "Color", "Color")} onClick={() => setSheet("color")} />}
      {["text", "bubble", "label"].includes(cur.type) && <Tool icon={<MessageCircle size={18} />} label={L("Fond", "Fondo", "Fill")} onClick={() => setSheet("textfill")} />}
      {(TEXTY.includes(cur.type) || ["arrow", "doodle", "photo"].includes(cur.type)) && <Tool icon={<Sparkles size={18} />} label={L("Réglages", "Ajustes", "Adjust")} onClick={() => setSheet("adjust")} />}
      {cur.type === "ui" && <Tool icon={<Smartphone size={18} />} on={cur.dark} label={L("Sombre", "Oscuro", "Dark")} onClick={() => patchLayer(sel, { dark: !cur.dark })} />}
    </div>
  ) : (
    <div className="le-ctx main">
      <Tool icon={<Images size={20} />} label={L("Photos", "Fotos", "Photos")} onClick={() => { setPhotoTarget({ kind: empties ? "fill" : "add" }); setSheet(empties ? "fill" : "photo"); }} badge={empties || undefined} />
      <Tool icon={<Layers size={20} />} label={L("Calques", "Capas", "Layers")} onClick={() => setSheet("layers")} />
      <button className="le-plus-main" onClick={() => setSheet("add")} aria-label={L("Ajouter", "Agregar", "Add")}><Plus size={28} /></button>
      <Tool icon={<PaintBucket size={20} />} label={L("Fond", "Fondo", "Background")} onClick={() => setSheet("bg")} />
      <Tool icon={<GalleryHorizontal size={20} />} label={L("Diapos", "Diapositivas", "Slides")} onClick={() => setSheet("slides")} badge={doc.slides > 1 ? doc.slides : undefined} />
    </div>
  );

  const tpl = layerTemplateById(doc.from);
  return (
    <section className="le">
      <div className="le-top">
        <button className="icon-button" onClick={onClose} aria-label={L("Retour aux modèles", "Volver a las plantillas", "Back to templates")}><ArrowLeft size={20} /></button>
        <b className="le-title">{tpl ? pickName(tpl, L) : L("Visuel libre", "Imagen libre", "Free visual")}</b>
        <button className="icon-button" disabled={!past.length} onClick={undo} aria-label={L("Annuler", "Deshacer", "Undo")}><Undo2 size={19} /></button>
        <button className="icon-button" disabled={!future.length} onClick={redo} aria-label={L("Rétablir", "Rehacer", "Redo")}><Redo2 size={19} /></button>
        <button className="icon-button le-annot" onClick={toggleAnnotations} title={L("Afficher / masquer les annotations", "Mostrar / ocultar anotaciones", "Show / hide annotations")} aria-label={L("Annotations", "Anotaciones", "Annotations")}><Sparkles size={18} /></button>
        <button className="button primary le-export" disabled={!!busy} onClick={() => setSheet("export")}>
          {busy ? <Loader2 className="spin" size={16} /> : <Download size={16} />} {L("Exporter", "Exportar", "Export")}
        </button>
      </div>
      {error && <p className="lp-error" role="alert">{error}</p>}
      {notice && (
        <div className="le-notice">
          <Check size={16} /> {notice} {savedId && <AddToCalendarButton kind="design" id={savedId} />}
        </div>
      )}
      <div className="le-stage-scroll" ref={scrollRef} onPointerDown={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("le-stage")) { setSel(-1); setCrop(false); setMenu(false); } }}>
        <div className="le-stage" style={{ width: W * scale, height: H * scale }}>
          <canvas ref={canvasRef} style={{ width: W * scale, height: H * scale }} />
          <div ref={overlayRef} className="le-overlay" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onContextMenu={(e) => e.preventDefault()}>
            {doc.slides > 1 &&
              [...Array(doc.slides)].map((_, s) => (
                <span key={s} className="le-slide-mark" style={{ left: s * SLIDE_W * scale }}>
                  {s > 0 && <i />}
                  <b>{s + 1}</b>
                </span>
              ))}
            {guides.map((g, k) => (g.axis === "x" ? <span key={k} className="le-guide x" style={{ left: g.at * scale }} /> : <span key={k} className="le-guide y" style={{ top: g.at * scale }} />))}
            {emptyButtons}
            {selBox}
          </div>
          {tool}
        </div>
      </div>
      <p className="le-hint">
        {cur
          ? crop
            ? L("Glissez pour recadrer, pincez pour zoomer.", "Desliza para recortar, pellizca para acercar.", "Drag to crop, pinch to zoom.")
            : L("Glissez pour déplacer · coins pour agrandir · rond du haut pour tourner · deux doigts pour tout faire.", "Desliza para mover · esquinas para agrandar · círculo de arriba para girar · dos dedos para todo.", "Drag to move · corners to resize · top dot to rotate · two fingers for everything.")
          : empties
            ? L(`Touchez « + » pour ajouter vos photos (${empties} à remplir).`, `Toca “+” para agregar tus fotos (faltan ${empties}).`, `Tap “+” to add your photos (${empties} to fill).`)
            : L("Touchez un élément pour le modifier.", "Toca un elemento para editarlo.", "Tap any element to edit it.")}
      </p>
      {ctx}

      {/* ----- Fenêtres ----- */}
      {(sheet === "fill" || sheet === "photo") && (
        <PhotoSheet
          data={data}
          client={client}
          refresh={refresh}
          need={sheet === "fill" ? empties : photoTarget.kind === "bg" ? 1 : photoTarget.kind === "add" ? 0 : Math.max(1, empties)}
          onClose={() => setSheet("")}
          onDone={usePhotos}
        />
      )}
      {sheet === "export" && (
        <Sheet title={L("Exporter", "Exportar", "Export")} onClose={() => setSheet("")}>
          {empties > 0 && (
            <div className="le-warn">
              {L(`Il reste ${empties} emplacement(s) photo vide(s).`, `Quedan ${empties} espacio(s) de foto vacío(s).`, `${empties} photo slot(s) still empty.`)}
              <div>
                <button className="button secondary" onClick={() => { setPhotoTarget({ kind: "fill" }); setSheet("fill"); }}>{L("Les remplir", "Llenarlos", "Fill them")}</button>
                <button className="button secondary" onClick={() => { commit({ ...doc, layers: doc.layers.filter((l: Row) => !(l.type === "photo" && !l.file)) }); setSel(-1); }}>{L("Les retirer", "Quitarlos", "Remove them")}</button>
              </div>
            </div>
          )}
          <div className="le-export-actions">
            <button className="button primary" disabled={!!busy || empties > 0} onClick={() => { setSheet(""); save(); }}>
              <Check size={16} /> {L("Enregistrer dans Mes visuels", "Guardar en Mis imágenes", "Save to My visuals")}
            </button>
            <button className="button secondary" disabled={!!busy || empties > 0} onClick={() => { setSheet(""); download(); }}>
              <Download size={16} /> {doc.slides > 1 ? L(`Télécharger les ${doc.slides} diapos`, `Descargar las ${doc.slides} diapositivas`, `Download the ${doc.slides} slides`) : L("Télécharger", "Descargar", "Download")}
            </button>
          </div>
          {doc.slides > 1 && <p className="lp-sheet-hint">{L("Les diapos sont numérotées dans l’ordre : publiez-les ensemble en carrousel.", "Las diapositivas están numeradas en orden: publícalas juntas en carrusel.", "Slides are numbered in order: post them together as a carousel.")}</p>}
        </Sheet>
      )}
      {sheet === "add" && (
        <Sheet title={L("Ajouter", "Agregar", "Add")} onClose={() => setSheet("")}>
          <div className="le-add-grid">
            <AddBtn icon={<Type size={22} />} label={L("Texte", "Texto", "Text")} onClick={() => addKind("text")} />
            <AddBtn icon={<span className="le-script">Aa</span>} label={L("Mot manuscrit", "Palabra a mano", "Handwritten")} onClick={() => addKind("script")} />
            <AddBtn icon={<MessageCircle size={22} />} label={L("Bulle de message", "Burbuja de mensaje", "Message bubble")} onClick={() => addKind("bubble")} />
            <AddBtn icon={<Tag size={22} />} label={L("Étiquette", "Etiqueta", "Label")} onClick={() => addKind("label")} />
            <AddBtn icon={<MoveUpRight size={22} />} label={L("Flèche", "Flecha", "Arrow")} onClick={() => addKind("arrow")} />
            <AddBtn icon={<ImagePlus size={22} />} label={L("Photo encadrée", "Foto con marco", "Framed photo")} onClick={() => { setPhotoTarget({ kind: "add" }); setSheet("photo"); }} />
            <AddBtn icon={<span className="le-script">~</span>} label={L("Gribouillis", "Garabato", "Doodle")} onClick={() => addKind("doodle")} />
          </div>
          <h5>{L("Autocollants", "Stickers", "Stickers")}</h5>
          <StickerGrid onPick={(o) => addKind("sticker", o)} />
          <h5>{L("Interface de téléphone", "Interfaz de teléfono", "Phone interface")}</h5>
          <div className="le-ui-list">
            {[
              ["selectbar", L("Barre « Copier »", "Barra “Copiar”", "“Copy” bar"), 620, 80],
              ["sharesheet", L("Fenêtre de partage", "Ventana de compartir", "Share popup"), 560, 300],
              ["notif", L("Notification", "Notificación", "Notification"), 900, 190],
              ["profile", L("Nom et pseudo", "Nombre y usuario", "Name & handle"), 760, 90],
              ["comment", L("Commentaire", "Comentario", "Comment"), 640, 120],
              ["checklist", L("Liste à cocher", "Lista para marcar", "Checklist"), 760, 560],
              ["readcaption", L("« Lire la légende »", "“Lee la descripción”", "“Read the caption”"), 420, 50],
              ["follow", L("Bouton « Suivre »", "Botón “Seguir”", "“Follow” button"), 240, 70],
            ].map(([v, label, w, h]: any) => (
              <button
                key={v}
                onClick={() => {
                  const c = visibleCenter();
                  add({
                    id: newLayerId(), type: "ui", variant: v, x: c.x, y: c.y, w, h, rot: 0, opacity: 1, accent: "#2F80ED",
                    name: creatorName(client), handle: creatorHandle(client),
                    title: v === "sharesheet" ? L("Partage", "Compartir", "Share") : v === "checklist" ? L("Ma liste", "Mi lista", "My list") : v === "follow" ? L("Suivre", "Seguir", "Follow") : v === "readcaption" ? L("Lire la légende", "Lee la descripción", "Read the caption") : "",
                    text: v === "sharesheet" ? L("Votre nom souhaite vous partager une photo.", "Tu nombre quiere compartirte una foto.", "Your name would like to share a photo.") : v === "notif" || v === "comment" ? L("Votre message ici", "Tu mensaje aquí", "Your message here") : "",
                    items: v === "selectbar" ? [L("Copier", "Copiar", "Copy"), L("Tout sélectionner", "Seleccionar todo", "Select all"), L("Partager", "Compartir", "Share")] : v === "sharesheet" ? [L("Ignorer", "Ignorar", "Ignore"), L("Accepter", "Aceptar", "Accept")] : v === "checklist" ? [L("Premier point", "Primer punto", "First item"), L("Deuxième point", "Segundo punto", "Second item"), L("Troisième point", "Tercer punto", "Third item")] : [],
                  });
                }}
              >
                <Smartphone size={16} /> {label}
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {sheet === "sticker" && cur && (
        <Sheet title={L("Autocollant", "Sticker", "Sticker")} onClose={() => setSheet("")}>
          <StickerGrid onPick={(o) => { patchLayer(sel, { glyph: o.glyph || "", emoji: o.emoji || "" }); setSheet(""); }} />
        </Sheet>
      )}
      {sheet === "layers" && (
        <Sheet title={L("Calques", "Capas", "Layers")} onClose={() => setSheet("")}>
          <p className="lp-sheet-hint">{L("En haut de la liste = au premier plan.", "Arriba de la lista = al frente.", "Top of the list = in front.")}</p>
          <ul className="le-layers">
            {[...doc.layers.keys()].reverse().map((i) => {
              const l = doc.layers[i];
              return (
                <li key={l.id} className={i === sel ? "on" : ""}>
                  <button className="le-layer-name" onClick={() => { setSel(i); setSheet(""); }}>
                    <LayerIcon type={l.type} /> <span>{layerLabel(l, L)}</span>
                  </button>
                  <button className="icon-button" onClick={() => patchLayer(i, { hidden: !l.hidden })} aria-label={l.hidden ? L("Afficher", "Mostrar", "Show") : L("Masquer", "Ocultar", "Hide")}>{l.hidden ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  <button className="icon-button" onClick={() => patchLayer(i, { locked: !l.locked })} aria-label={L("Verrouiller", "Bloquear", "Lock")}>{l.locked ? <Lock size={16} /> : <Unlock size={16} />}</button>
                  <button className="icon-button" disabled={i === doc.layers.length - 1} onClick={() => reorder(i, i + 1)} aria-label={L("Monter", "Subir", "Move up")}><ChevronUp size={16} /></button>
                  <button className="icon-button" disabled={i === 0} onClick={() => reorder(i, i - 1)} aria-label={L("Descendre", "Bajar", "Move down")}><ChevronDown size={16} /></button>
                </li>
              );
            })}
            {!doc.layers.length && <li className="muted">{L("Aucun élément : touchez « + ».", "Ningún elemento: toca “+”.", "No elements yet: tap “+”.")}</li>}
          </ul>
        </Sheet>
      )}
      {sheet === "bg" && (
        <Sheet title={L("Fond", "Fondo", "Background")} onClose={() => setSheet("")}>
          <Swatches palette={palette} value={doc.bg.color} onPick={(c) => commit({ ...doc, bg: { ...doc.bg, color: c } })} />
          <div className="le-row">
            <button className="button secondary" onClick={() => { setPhotoTarget({ kind: "bg" }); setSheet("photo"); }}><Images size={15} /> {doc.bg.photo ? L("Changer la photo de fond", "Cambiar la foto de fondo", "Change background photo") : L("Photo en fond", "Foto de fondo", "Background photo")}</button>
            {doc.bg.photo && <button className="button secondary" onClick={() => commit({ ...doc, bg: { ...doc.bg, photo: "" } })}><X size={15} /> {L("Retirer", "Quitar", "Remove")}</button>}
          </div>
          {doc.bg.photo && (
            <>
              <Slider label={L("Flou", "Desenfoque", "Blur")} min={0} max={60} value={doc.bg.blur || 0} onChange={(v) => setDoc({ ...doc, bg: { ...doc.bg, blur: v } })} onStart={snapshot} />
              <Slider label={L("Assombrir", "Oscurecer", "Darken")} min={0} max={0.8} step={0.05} value={doc.bg.dim || 0} onChange={(v) => setDoc({ ...doc, bg: { ...doc.bg, dim: v } })} onStart={snapshot} />
            </>
          )}
        </Sheet>
      )}
      {sheet === "slides" && (
        <Sheet title={L("Diapos", "Diapositivas", "Slides")} onClose={() => setSheet("")}>
          <p className="lp-sheet-hint">
            {L(
              "Une seule grande toile découpée en diapos : vos photos et textes peuvent passer d’une diapo à l’autre, le raccord est parfait.",
              "Un solo lienzo grande cortado en diapositivas: tus fotos y textos pueden pasar de una a otra con una unión perfecta.",
              "One big canvas cut into slides: photos and text can cross from one slide to the next with a perfect join.",
            )}
          </p>
          <div className="le-slides">
            {[...Array(doc.slides)].map((_, s) => (
              <div key={s} className="le-slide-chip">
                <b>{s + 1}</b>
                <button className="icon-button" disabled={s === 0} onClick={() => commit(moveSlide(doc, s, s - 1))} aria-label={L("Vers la gauche", "A la izquierda", "Move left")}><ChevronLeft size={16} /></button>
                <button className="icon-button" disabled={s === doc.slides - 1} onClick={() => commit(moveSlide(doc, s, s + 1))} aria-label={L("Vers la droite", "A la derecha", "Move right")}><ChevronRight size={16} /></button>
                <button className="icon-button" disabled={doc.slides <= 1} onClick={() => removeSlide(s)} aria-label={L("Supprimer la diapo", "Eliminar la diapositiva", "Delete slide")}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <button className="button primary" disabled={doc.slides >= MAX_SLIDES} onClick={() => commit(setSlideCount(doc, doc.slides + 1))}><Plus size={15} /> {L("Ajouter une diapo", "Agregar una diapositiva", "Add a slide")}</button>
          <div className="le-row">
            {(["9:16", "4:5"] as const).map((f) => (
              <button key={f} className={"button " + (doc.format === f ? "primary" : "secondary")} onClick={() => doc.format !== f && commit({ ...doc, format: f, layers: doc.layers.map((l: Row) => ({ ...l, y: (l.y * (f === "9:16" ? 1920 : 1350)) / (doc.format === "9:16" ? 1920 : 1350) })) })}>
                {f === "9:16" ? L("Story 9:16", "Historia 9:16", "Story 9:16") : L("Publication 4:5", "Publicación 4:5", "Post 4:5")}
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {sheet === "text" && cur && (
        <Sheet title={L("Modifier le texte", "Editar el texto", "Edit text")} onClose={() => setSheet("")}>
          {cur.type === "ui" ? (
            <div className="le-fields">
              {["title", "text", "name", "handle"].filter((k) => k !== "title" || ["sharesheet", "checklist", "notes", "follow", "readcaption", "album", "folder"].includes(cur.variant)).map((k) => (
                <label key={k} className="field">
                  <span>{{ title: L("Titre", "Título", "Title"), text: L("Texte", "Texto", "Text"), name: L("Nom", "Nombre", "Name"), handle: L("Pseudo / heure", "Usuario / hora", "Handle / time") }[k]}</span>
                  <input value={cur[k] || ""} maxLength={k === "text" ? 400 : 120} onFocus={snapshot} onChange={(e) => patchLayer(sel, { [k]: e.target.value }, false)} />
                </label>
              ))}
              {["selectbar", "sharesheet", "checklist"].includes(cur.variant) && (
                <label className="field">
                  <span>{L("Éléments (un par ligne)", "Elementos (uno por línea)", "Items (one per line)")}</span>
                  <textarea value={(cur.items || []).join("\n")} onFocus={snapshot} onChange={(e) => patchLayer(sel, { items: e.target.value.split("\n").slice(0, 8) }, false)} />
                </label>
              )}
            </div>
          ) : (
            <textarea className="le-textarea" autoFocus value={cur.text || ""} maxLength={cur.type === "text" ? 600 : cur.type === "bubble" ? 200 : 140} onFocus={snapshot} onChange={(e) => patchLayer(sel, { text: e.target.value }, false)} />
          )}
          {cur.type === "bubble" && (
            <label className="field">
              <span>{L("Petit autocollant de la bulle", "Sticker de la burbuja", "Bubble sticker")}</span>
              <div className="le-emojis">
                {["", "💖", "🎀", "☕", "✨", "🛍️", "🤍", "📸"].map((e) => (
                  <button key={e || "none"} className={cur.sticker === e ? "on" : ""} onClick={() => patchLayer(sel, { sticker: e })}>{e || "∅"}</button>
                ))}
              </div>
            </label>
          )}
          <button className="button primary full" onClick={() => setSheet("")}><Check size={16} /> {L("Terminé", "Listo", "Done")}</button>
        </Sheet>
      )}
      {sheet === "font" && cur && (
        <Sheet title={L("Police", "Fuente", "Font")} onClose={() => setSheet("")}>
          <div className="le-fonts">
            {LAYER_FONTS.map((f: string) => {
              const ff = layerFont(f);
              return (
                <button key={f} className={cur.font === f ? "on" : ""} style={{ fontFamily: `"${ff.family}"`, fontWeight: ff.weight }} onClick={() => patchLayer(sel, { font: f })}>
                  {L("Votre texte", "Tu texto", "Your text")}
                </button>
              );
            })}
          </div>
        </Sheet>
      )}
      {sheet === "color" && cur && (
        <Sheet title={L("Couleur", "Color", "Color")} onClose={() => setSheet("")}>
          <Swatches palette={palette} value={cur.type === "bubble" || cur.type === "label" ? cur.textColor : cur.color} onPick={(c) => patchLayer(sel, cur.type === "bubble" || cur.type === "label" ? { textColor: c } : { color: c })} />
        </Sheet>
      )}
      {sheet === "frame" && cur && (
        <Sheet title={L("Cadre de la photo", "Marco de la foto", "Photo frame")} onClose={() => setSheet("")}>
          <div className="le-row">
            {[
              [L("Aucun", "Ninguno", "None"), { border: 0, bottom: 0, radius: 0, circle: false }],
              [L("Fin", "Fino", "Thin"), { border: 10, bottom: 0, radius: 0, circle: false }],
              [L("Instantané", "Instantánea", "Instant"), { border: 20, bottom: Math.round(cur.h * 0.16), radius: 0, circle: false }],
              [L("Arrondi", "Redondeado", "Rounded"), { border: 0, bottom: 0, radius: 40, circle: false }],
              [L("Rond", "Redondo", "Round"), { border: 8, bottom: 0, radius: 0, circle: true }],
            ].map(([label, p]: any) => (
              <button key={label} className="button secondary" onClick={() => patchLayer(sel, p)}>{label}</button>
            ))}
          </div>
          <label className="optional-toggle"><input type="checkbox" checked={!!cur.shadow} onChange={(e) => patchLayer(sel, { shadow: e.target.checked })} /> {L("Ombre", "Sombra", "Shadow")}</label>
          <label className="field"><span>{L("Légende sous la photo", "Leyenda bajo la foto", "Caption under the photo")}</span><input value={cur.label || ""} maxLength={40} onFocus={snapshot} onChange={(e) => patchLayer(sel, { label: e.target.value }, false)} /></label>
          <Swatches palette={palette} value={cur.borderColor} onPick={(c) => patchLayer(sel, { borderColor: c })} />
        </Sheet>
      )}
      {sheet === "adjust" && cur && (
        <Sheet title={L("Réglages", "Ajustes", "Adjust")} onClose={() => setSheet("")}>
          {cur.size !== undefined && <Slider label={L("Taille", "Tamaño", "Size")} min={10} max={cur.type === "text" ? 500 : 160} value={cur.size} onChange={(v) => patchLayer(sel, { size: v }, false)} onStart={snapshot} />}
          <Slider label={L("Opacité", "Opacidad", "Opacity")} min={0.05} max={1} step={0.05} value={cur.opacity ?? 1} onChange={(v) => patchLayer(sel, { opacity: v }, false)} onStart={snapshot} />
          {["text", "label", "bubble"].includes(cur.type) && <label className="optional-toggle"><input type="checkbox" checked={!!cur.shadow} onChange={(e) => patchLayer(sel, { shadow: e.target.checked })} /> {L("Ombre", "Sombra", "Shadow")}</label>}
          {cur.type === "text" && (
            <>
              <div className="le-row">
                {(["left", "center", "right"] as const).map((a) => (
                  <button key={a} className={"button " + (cur.align === a ? "primary" : "secondary")} onClick={() => patchLayer(sel, { align: a })}>{{ left: L("Gauche", "Izquierda", "Left"), center: L("Centre", "Centro", "Center"), right: L("Droite", "Derecha", "Right") }[a]}</button>
                ))}
              </div>
              <label className="optional-toggle"><input type="checkbox" checked={!!cur.upper} onChange={(e) => patchLayer(sel, { upper: e.target.checked })} /> {L("Majuscules", "Mayúsculas", "Uppercase")}</label>
              <label className="optional-toggle"><input type="checkbox" checked={!!cur.outline} onChange={(e) => patchLayer(sel, { outline: e.target.checked ? "#FFFFFF" : "" })} /> {L("Contour blanc", "Contorno blanco", "White outline")}</label>
              <Slider label={L("Interligne", "Interlineado", "Line height")} min={0.7} max={2} step={0.05} value={cur.lh || 1.1} onChange={(v) => patchLayer(sel, { lh: v }, false)} onStart={snapshot} />
            </>
          )}
          {cur.type === "label" && <label className="optional-toggle"><input type="checkbox" checked={!!cur.outline} onChange={(e) => patchLayer(sel, { outline: e.target.checked })} /> {L("Contour seulement", "Solo contorno", "Outline only")}</label>}
          {cur.type === "bubble" && (
            <div className="le-row">
              {(["left", "right", "none"] as const).map((t) => (
                <button key={t} className={"button " + (cur.tail === t ? "primary" : "secondary")} onClick={() => patchLayer(sel, { tail: t })}>{{ left: L("Pointe à gauche", "Punta a la izquierda", "Tail left"), right: L("Pointe à droite", "Punta a la derecha", "Tail right"), none: L("Sans pointe", "Sin punta", "No tail") }[t]}</button>
              ))}
            </div>
          )}
          {cur.type === "arrow" && (
            <>
              <Slider label={L("Courbe", "Curva", "Curve")} min={-1} max={1} step={0.05} value={cur.curve ?? 0.4} onChange={(v) => patchLayer(sel, { curve: v }, false)} onStart={snapshot} />
              <Slider label={L("Épaisseur", "Grosor", "Thickness")} min={1} max={20} value={cur.width ?? 5} onChange={(v) => patchLayer(sel, { width: v }, false)} onStart={snapshot} />
              <button className="button secondary" onClick={() => patchLayer(sel, { flip: !cur.flip })}>{L("Retourner", "Voltear", "Flip")}</button>
            </>
          )}
          {cur.type === "doodle" && (
            <div className="le-row">
              {["squiggle", "underline", "scribble", "circle", "stars"].map((v) => (
                <button key={v} className={"button " + (cur.variant === v ? "primary" : "secondary")} onClick={() => patchLayer(sel, { variant: v })}>{{ squiggle: "〰", underline: "⌣", scribble: "⩘", circle: "◯", stars: "✦" }[v]}</button>
              ))}
            </div>
          )}
        </Sheet>
      )}
      {sheet === "textfill" && cur && ["text", "bubble", "label"].includes(cur.type) ? (
        <Sheet title={L("Fond du texte", "Fondo del texto", "Text background")} onClose={() => setSheet("")}>
          {cur.type === "text" && <button className="button secondary" onClick={() => patchLayer(sel, { bg: "" })}><X size={15} /> {L("Sans fond", "Sin fondo", "No background")}</button>}
          <Swatches palette={palette} value={cur.type === "text" ? cur.bg : cur.color} onPick={(c) => patchLayer(sel, cur.type === "text" ? { bg: c } : { color: c })} />
        </Sheet>
      ) : null}
    </section>
  );
}
function Tool({ icon, label, onClick, on, badge }: { icon: any; label: string; onClick: () => void; on?: boolean; badge?: number }) {
  return (
    <button className={"le-tool" + (on ? " on" : "")} onClick={onClick}>
      {icon}
      <span>{label}</span>
      {badge ? <i>{badge}</i> : null}
    </button>
  );
}
function AddBtn({ icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button className="le-add" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
function Swatches({ palette, value, onPick }: { palette: string[]; value?: string; onPick: (c: string) => void }) {
  return (
    <div className="le-swatches">
      {palette.map((c) => (
        <button key={c} className={value === c ? "on" : ""} style={{ background: c }} onClick={() => onPick(c)} aria-label={c} />
      ))}
      <label className="le-swatch-custom" aria-label="+">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value || "") ? value : "#ffffff"} onChange={(e) => onPick(e.target.value.toUpperCase())} />+
      </label>
    </div>
  );
}
function Slider({ label, min, max, step = 1, value, onChange, onStart }: { label: string; min: number; max: number; step?: number; value: number; onChange: (v: number) => void; onStart: () => void }) {
  return (
    <label className="le-slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onPointerDown={onStart} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
const STICKER_ICON: Record<string, string> = { star: "⭐", sparkle: "✨", heart: "💗", bow: "🎀", coffee: "☕", flower: "🌸", doodlestar: "☆", diamond: "💎", sun: "☀️", cloud: "☁️", moon: "🌙", check: "✅" };
function StickerGrid({ onPick }: { onPick: (o: Row) => void }) {
  return (
    <div className="le-stickers">
      {STICKERS.map((g: string) => (
        <button key={g} onClick={() => onPick({ glyph: g, color: g === "heart" || g === "bow" ? "#FF8FB8" : g === "diamond" ? "#3DDC5A" : g === "cloud" ? "#FFFFFF" : "#F5C542" })} aria-label={g}>{STICKER_ICON[g]}</button>
      ))}
      {EMOJIS.map((e: string) => (
        <button key={e} onClick={() => onPick({ emoji: e })}>{e}</button>
      ))}
    </div>
  );
}
function LayerIcon({ type }: { type: string }) {
  const m: Row = { photo: <Images size={15} />, text: <Type size={15} />, bubble: <MessageCircle size={15} />, label: <Tag size={15} />, sticker: <Sticker size={15} />, arrow: <MoveUpRight size={15} />, ui: <Smartphone size={15} />, circletext: <Type size={15} />, shape: <PaintBucket size={15} />, doodle: <Pencil size={15} /> };
  return m[type] || null;
}
function layerLabel(l: Row, L: any) {
  const name: Row = { photo: L("Photo", "Foto", "Photo"), text: L("Texte", "Texto", "Text"), bubble: L("Bulle", "Burbuja", "Bubble"), label: L("Étiquette", "Etiqueta", "Label"), sticker: L("Autocollant", "Sticker", "Sticker"), arrow: L("Flèche", "Flecha", "Arrow"), ui: L("Interface", "Interfaz", "Interface"), circletext: L("Texte en cercle", "Texto en círculo", "Circle text"), shape: L("Forme", "Forma", "Shape"), doodle: L("Gribouillis", "Garabato", "Doodle") };
  const t = (l.text || l.title || l.label || l.emoji || "").trim();
  return name[l.type] + (t ? " · " + t.slice(0, 26) : l.type === "photo" && !l.file ? " · " + L("vide", "vacía", "empty") : "");
}
/** Libellé d'un visuel enregistré (galerie « Mes visuels »). */
export function layeredName(t: Row, L: any) {
  const def = layerTemplateById(t?.from);
  return def ? L(def.name.fr, def.name.es, def.name.en) : L("Visuel libre", "Imagen libre", "Free visual");
}
export { LAYER_TEMPLATES };
