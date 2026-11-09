"use client";
import { AddToCalendarButton } from "./add-to-calendar";
import { VIDEO_MAX_BYTES, videoTooBig } from "../lib/video-limits";
// Éditeur vidéo complet (créatrices de contenu) : aperçu en direct à gauche, onglets à droite.
// Il réutilise le moteur du montage automatique (style partagé aperçu/rendu, calage des mots, coupe des silences).
// Modes : « creator » (créatrice), « brand » (réglages avancés d'une marque autorisée), « agency-style » (l'agence
// dessine le « Mon style » d'un client sur un exemple, sans toucher à ses vidéos).
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, X, Download, Undo2, Upload, Sparkles, Trash2, Check, Wand2, Save, MoreHorizontal } from "lucide-react";
import { useL, useLang } from "../lib/i18n";
import { uploadStudioMedia } from "../lib/direct-upload-client";
import { type ClipInfo } from "../lib/montage-engine";
import { prepareMontage, exportMontage, studioCall } from "../lib/montage-flow";
import { MontagePreview, type PreviewControl } from "./brand-montage";
import {
  FONTS,
  ANIMATIONS,
  WORD_STYLES,
  WORD_STYLE_CYCLE,
  SFX_KINDS,
  EMOJIS,
  MAX_STICKERS,
  MAX_TITLES,
  sanitizeStyle,
  lookStyle,
  switchLook,
  applyIntent,
  hookWords,
} from "../lib/video-style.mjs";
import {
  trimKeeps,
  remapWords,
  keptDuration,
  sourceTime,
  subtitleGroups,
  shiftWords,
  applyTaps,
  editWordText,
} from "../lib/video-timing.mjs";

type Row = Record<string, any>;
type Word = { w: string; s: number; e: number; oi?: number };
type Mode = "creator" | "brand" | "agency-style";
type Tab = "subs" | "stickers" | "hook" | "rhythm" | "sound";
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const SAMPLE: Record<string, string> = {
  fr: "Trois erreurs qui ruinent ton levain. La première : trop d’eau. La deuxième : pas assez de temps.",
  es: "Tres errores que arruinan tu masa madre. El primero: demasiada agua. El segundo: poco tiempo.",
  en: "Three mistakes that ruin your sourdough. The first one: too much water. The second: not enough time.",
};
const HIGHLIGHTS = ["#F5D76E", "#F2B8C6", "#FFFFFF", "#9FD3C7", "#FF6B4A"];

/** Bruitage d'essai joué dans le navigateur (même idée que les sources FFmpeg du rendu). */
function playSfx(kind: string, volume: number) {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC();
    const g = ctx.createGain();
    g.gain.value = volume;
    g.connect(ctx.destination);
    const now = ctx.currentTime;
    if (kind === "pop") {
      const o = ctx.createOscillator();
      o.frequency.value = 620;
      o.connect(g);
      g.gain.setValueAtTime(volume, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      o.start(now);
      o.stop(now + 0.15);
    } else {
      const len = kind === "swoosh" ? 0.4 : kind === "camera" ? 0.09 : 0.035;
      const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * len), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (kind === "swoosh" ? Math.sin((Math.PI * i) / d.length) : 1 - i / d.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = kind === "swoosh" ? "bandpass" : "highpass";
      f.frequency.value = kind === "swoosh" ? 1400 : 2200;
      src.connect(f);
      f.connect(g);
      src.start(now);
    }
    setTimeout(() => ctx.close(), 800);
  } catch {}
}

export default function CreatorEditor({
  edit,
  client,
  data,
  mode = "creator",
  onClose,
  refresh,
}: {
  edit: Row | null;
  client: Row;
  data: Row;
  mode?: Mode;
  onClose: () => void;
  refresh: () => Promise<any>;
}) {
  const L = useL(),
    lang = useLang();
  const agencyStyle = mode === "agency-style";
  const saved = edit?.brief?.brand;
  const sampleMode = agencyStyle && !(saved?.clipInfo?.length && edit?.clips?.length);
  const [phase, setPhase] = useState<"analyzing" | "edit" | "rendering" | "done" | "error">(
    sampleMode || (saved?.style && saved?.clipInfo?.length) ? "edit" : "analyzing",
  );
  const [toolsOpen, setToolsOpen] = useState(false);
  const [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const sampleWords = useMemo(() => {
    const list = SAMPLE[lang].split(/\s+/);
    return list.map((w, i) => ({ w, s: 0.4 + i * 0.42, e: 0.4 + i * 0.42 + 0.36 }));
  }, [lang]);
  const [clipInfo, setClipInfo] = useState<ClipInfo[]>(sampleMode ? [] : saved?.clipInfo || []);
  const [cutBase, setCutBase] = useState<[number, number][]>(saved?.cutBase?.length ? saved.cutBase : saved?.base || [[0, 8]]);
  const [fullBase, setFullBase] = useState<[number, number][]>(saved?.fullBase?.length ? saved.fullBase : saved?.base || [[0, 8]]);
  const [srcWords, setSrcWords] = useState<Word[]>(sampleMode ? sampleWords : saved?.words || []);
  const [voiceWords, setVoiceWords] = useState<boolean>(sampleMode ? true : !!saved?.voiceWords);
  const [style, setStyleRaw] = useState<Row>(() =>
    sanitizeStyle(agencyStyle ? lookStyle("mine", client.config?.videoStyle) : saved?.style || lookStyle("mine", client.config?.videoStyle)),
  );
  const [hooks, setHooks] = useState<string[]>(saved?.hooks || []);
  const [stats, setStats] = useState<Row>(saved?.stats || { before: 0, after: 0, silences: 0, found: 0, saved: 0 });
  const [history, setHistory] = useState<Row[]>([]);
  const [tab, setTab] = useState<Tab>("subs");
  const [sel, setSel] = useState(-1);
  const [t, setT] = useState(0);
  const [tapping, setTapping] = useState(false),
    [taps, setTaps] = useState<number[]>([]);
  const [busy, setBusy] = useState(""),
    [output, setOutput] = useState<string | null>(null),
    [voiceScript, setVoiceScript] = useState<string>(edit?.brief?.voice?.script || edit?.brief?.script || ""),
    [voiceKind, setVoiceKind] = useState("warm"),
    [titleText, setTitleText] = useState("");
  const control = useRef<PreviewControl | null>(null);
  const cancel = useRef<() => void>(() => {});
  const stickerInput = useRef<HTMLInputElement>(null),
    musicInput = useRef<HTMLInputElement>(null),
    videoInput = useRef<HTMLInputElement>(null);
  const musicFiles: Row[] = data.musicFiles || [];
  const stickerFiles: Row[] = data.stickerFiles || [];
  const voiceFile = edit?.brief?.voice?.file_id || null;
  const canSaveOwn = mode === "creator" && client.config?.creatorStyleEditable === true;

  // Chaque modification passe par ici : historique pour « Annuler ».
  function setStyle(next: Row, keepHistory = true) {
    if (keepHistory) setHistory((h) => [...h.slice(-30), { style, srcWords }]);
    setStyleRaw(sanitizeStyle(next));
  }
  function setWords(next: Word[]) {
    setHistory((h) => [...h.slice(-30), { style, srcWords }]);
    setSrcWords(next);
  }
  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setStyleRaw(last.style);
    setSrcWords(last.srcWords);
  }

  const base = style.rhythm?.cutSilences ? cutBase : fullBase;
  const target = style.rhythm?.target || 60;
  const keeps = useMemo(() => (sampleMode ? ([[0, 8]] as [number, number][]) : (trimKeeps(base, target) as [number, number][])), [base, target, sampleMode]);
  const duration = sampleMode ? 8 : Math.min(keptDuration(keeps), target);
  const indexed = useMemo(() => srcWords.map((w, i) => ({ ...w, oi: i })), [srcWords]);
  const baseWords: Word[] = useMemo(
    () => (voiceWords ? indexed.filter((w) => w.s < duration) : remapWords(indexed, keeps)),
    [indexed, keeps, voiceWords, duration],
  );
  const words: Word[] = useMemo(() => shiftWords(baseWords, style.shift || 0), [baseWords, style.shift]);
  const groups = useMemo(() => subtitleGroups(baseWords, style), [baseWords, style.animation]);

  // Préparation automatique (première ouverture, ou après l'ajout d'une vidéo ou d'une voix off).
  useEffect(() => {
    if (phase !== "analyzing" || !edit) return;
    let alive = true;
    (async () => {
      try {
        setError("");
        const p = await prepareMontage({
          edit,
          client,
          musicFiles,
          lang,
          update: (m) => alive && setProgress(m),
          register: (c) => (cancel.current = c),
        });
        if (!alive) return;
        const keepStyle = saved?.style ? sanitizeStyle({ ...p.style, ...saved.style, hook: saved.style.hook?.text ? saved.style.hook : p.style.hook }) : p.style;
        setClipInfo(p.clipInfo);
        setCutBase(p.cutBase);
        setFullBase(p.fullBase);
        setSrcWords(p.words);
        setVoiceWords(p.voiceWords);
        setHooks(p.hooks);
        setStyleRaw(keepStyle);
        setStats(p.stats);
        setPhase("edit");
      } catch (e: any) {
        if (alive) {
          setError(e.message || L("La préparation a été interrompue.", "La preparación se interrumpió.", "Preparation was interrupted."));
          setPhase("error");
        }
      }
    })();
    return () => {
      alive = false;
      cancel.current();
    };
  }, [phase]);

  // Enregistrement automatique de l'état de l'éditeur (pas en mode style agence).
  const firstSave = useRef(true);
  useEffect(() => {
    if (phase !== "edit" || !edit || agencyStyle) return;
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      studioCall("video-brand-save", {
        edit_id: edit.id,
        style,
        words: srcWords,
        keeps,
        base,
        cutBase,
        fullBase,
        clipInfo,
        voiceWords,
        hooks,
        stats,
      }).catch((e) => setError(e.message));
    }, 1200);
    return () => window.clearTimeout(id);
  }, [style, srcWords, phase]);

  // « Caler au tap » : barre d'espace pendant la lecture = début du bloc suivant.
  useEffect(() => {
    if (!tapping) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      e.preventDefault();
      setTaps((old) => (old.length < groups.length ? [...old, Math.round(t * 1000) / 1000] : old));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tapping, t, groups.length]);
  useEffect(() => {
    if (tapping && taps.length >= groups.length && groups.length) finishTaps();
  }, [taps]);
  function startTaps() {
    setTaps([]);
    setTapping(true);
    control.current?.seek(0);
    control.current?.play();
  }
  function finishTaps() {
    setTapping(false);
    control.current?.pause();
    if (!taps.length) return;
    const tapped = applyTaps(baseWords, groups, taps);
    const next = srcWords.map((w) => ({ ...w }));
    tapped.forEach((w: Word) => {
      const oi = w.oi as number;
      if (oi === undefined || !next[oi]) return;
      next[oi] = voiceWords ? { ...next[oi], s: w.s, e: w.e } : { ...next[oi], s: sourceTime(keeps, w.s), e: sourceTime(keeps, w.e) };
    });
    setWords(next);
    setNotice(L(`${taps.length} bloc(s) calé(s) au tap.`, `${taps.length} bloque(s) sincronizado(s) con toques.`, `${taps.length} block(s) synced by tapping.`));
  }

  function cycleWord(i: number) {
    const oi = words[i]?.oi;
    if (oi === undefined) return;
    const cur = style.wordStyles?.[oi] || "normal";
    const next = WORD_STYLE_CYCLE[(WORD_STYLE_CYCLE.indexOf(cur) + 1) % WORD_STYLE_CYCLE.length];
    const map = { ...(style.wordStyles || {}) };
    if (next === "normal") delete map[oi];
    else map[oi] = next;
    setSel(i);
    setStyle({ ...style, wordStyles: map });
  }
  function renameWord(i: number, text: string) {
    const oi = words[i]?.oi;
    if (oi === undefined) return;
    setSrcWords(editWordText(srcWords, oi, text));
  }
  function addSticker(st: Row) {
    if ((style.stickers || []).length >= MAX_STICKERS) {
      setNotice(L("12 autocollants maximum par vidéo.", "Máximo 12 stickers por video.", "12 stickers max per video."));
      return;
    }
    const s0 = Math.min(Math.max(0, t), Math.max(0, duration - 0.5));
    setStyle({ ...style, stickers: [...(style.stickers || []), { x: 0.72, y: 0.3, size: 0.22, s: s0, e: Math.min(duration, s0 + 2), sfx: style.sfx, ...st }] });
  }
  function patchSticker(k: number, patch: Row) {
    setStyle({ ...style, stickers: style.stickers.map((x: Row, i: number) => (i === k ? { ...x, ...patch } : x)) });
  }
  function patchTitle(k: number, patch: Row) {
    setStyle({ ...style, titles: style.titles.map((x: Row, i: number) => (i === k ? { ...x, ...patch } : x)) });
  }
  async function uploadSticker(file?: File) {
    if (!file) return;
    if (file.type !== "image/png") return setError(L("Choisissez un PNG détouré.", "Elige un PNG sin fondo.", "Choose a transparent PNG."));
    if (file.size > 3 * 1024 * 1024) return setError(L("L’autocollant doit faire moins de 3 Mo.", "El sticker debe pesar menos de 3 MB.", "The sticker must be under 3 MB."));
    setBusy("sticker");
    try {
      const d = await uploadStudioMedia(file, { kind: "sticker", client_id: client.id });
      await refresh();
      addSticker({ kind: "png", file_id: d.id });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function uploadMusic(file?: File) {
    if (!file) return;
    setBusy("music");
    try {
      const d = await uploadStudioMedia(file, { kind: "music", client_id: client.id });
      await refresh();
      setStyle({ ...style, music: { ...style.music, id: d.id } });
      setNotice(L("Musique ajoutée. Utilisez seulement des musiques libres de droits.", "Música agregada. Usa solo música libre de derechos.", "Music added. Only use royalty-free music."));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function importVideo(file?: File) {
    if (!file || !edit) return;
    setBusy("video");
    try {
      if (file.size > VIDEO_MAX_BYTES) throw new Error(videoTooBig(lang));
      const d = await uploadStudioMedia(file, { kind: "video", client_id: client.id });
      const r = await studioCall("video-edit-add-clip", { edit_id: edit.id, file_id: d.id });
      edit.clips = r.clips;
      await refresh();
      setPhase("analyzing");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function proposeHooks() {
    if (!edit) {
      setHooks([L("Ton levain ne monte pas ?", "¿Tu masa madre no sube?", "Your sourdough won’t rise?")]);
      return;
    }
    setBusy("hooks");
    try {
      const d = await studioCall("video-hooks", { edit_id: edit.id, avoid: hooks });
      if (d.hooks?.length) setHooks(d.hooks);
      else setNotice(L("Pas d’autre proposition pour le moment.", "No hay otra propuesta por ahora.", "No other suggestion right now."));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function createVoice() {
    if (!edit) return;
    setBusy("voice");
    try {
      await studioCall("video-voice", { edit_id: edit.id, script: voiceScript, voice: voiceKind, request_key: crypto.randomUUID() });
      await refresh();
      setNotice(L("Voix off créée : les sous-titres vont se caler dessus.", "Voz en off creada: los subtítulos se sincronizarán con ella.", "Voiceover created: subtitles will sync to it."));
      setPhase("analyzing");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function saveStyle() {
    setBusy("style");
    try {
      await studioCall(agencyStyle ? "video-style-save" : "video-style-save-own", { client_id: client.id, style });
      await refresh();
      setNotice(
        agencyStyle
          ? "Style enregistré. Il sera appliqué aux prochains montages de ce client."
          : L("Votre style est enregistré pour vos prochaines vidéos.", "Tu estilo quedó guardado para tus próximos videos.", "Your style is saved for your next videos."),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function exportVideo() {
    if (!edit) return;
    setPhase("rendering");
    setError("");
    try {
      await studioCall("video-brand-save", { edit_id: edit.id, style, words: srcWords, keeps, base, cutBase, fullBase, clipInfo, voiceWords, hooks, stats });
      const r = await exportMontage({ edit, client, clipInfo, keeps, words, style, lang, update: setProgress, register: (c) => (cancel.current = c) });
      setOutput(r.output);
      await refresh();
      setPhase("done");
    } catch (e: any) {
      setError(e.message || L("Le montage a été interrompu.", "La edición se interrumpió.", "The edit was interrupted."));
      setPhase("edit");
    }
  }

  // Écran tactile : pas de barre d'espace, on n'en parle pas.
  const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const tabs: [Tab, string][] = [
    ["subs", L("Sous-titres", "Subtítulos", "Subtitles")],
    ["stickers", L("Emojis et autocollants", "Emojis y stickers", "Emojis & stickers")],
    ["hook", L("Accroche et fin", "Gancho y final", "Hook & ending")],
    ["rhythm", L("Rythme", "Ritmo", "Rhythm")],
    ["sound", L("Son", "Sonido", "Sound")],
  ];
  const animLabel: Record<string, string> = {
    word: L("Mot par mot", "Palabra por palabra", "Word by word"),
    stack: L("Phrase qui s’empile", "Frase que se acumula", "Stacking line"),
    typewriter: L("Machine à écrire", "Máquina de escribir", "Typewriter"),
    fade: L("Fondu doux", "Fundido suave", "Soft fade"),
    highlight: L("Mot surligné", "Palabra resaltada", "Highlighted word"),
    karaoke: L("Karaoké", "Karaoke", "Karaoke"),
    label: L("Étiquette", "Etiqueta", "Label"),
    none: L("Sans animation", "Sin animación", "No animation"),
  };
  const sfxLabel: Record<string, string> = {
    click: L("Clic", "Clic", "Click"),
    pop: L("Pop doux", "Pop suave", "Soft pop"),
    swoosh: L("Swoosh", "Swoosh", "Swoosh"),
    camera: L("Appareil photo", "Cámara de fotos", "Camera shutter"),
  };
  const nextTapBlock = taps.length < groups.length ? groups[taps.length] : null;
  const timelineMarks = groups.map((g: Row) => ({ left: (g.s / Math.max(0.1, duration)) * 100, width: (Math.max(0.1, g.e - g.s) / Math.max(0.1, duration)) * 100 }));

  return (
    <div className="overlay creator-overlay">
      <section className="creator-editor" role="dialog" aria-modal="true" aria-label={L("Éditeur vidéo", "Editor de video", "Video editor")}>
        <header className="ce-top">
          <b className="ce-brand">
            {client.config?.brand || client.name} <span>studio</span>
          </b>
          <span className="ce-title">{agencyStyle ? "Style vidéo du client" : edit?.brief?.title || L("Ma vidéo", "Mi video", "My video")}</span>
          <span className="ce-spacer" />
          <div className={"ce-tools" + (toolsOpen ? " open" : "")} onClick={() => setToolsOpen(false)}>
          <button type="button" className="button secondary small" disabled={!history.length || phase !== "edit"} onClick={undo}>
            <Undo2 size={14} /> {L("Annuler", "Deshacer", "Undo")}
          </button>
          {!agencyStyle && (
            <button
              type="button"
              className="button secondary small ce-mine"
              disabled={phase !== "edit"}
              onClick={() => {
                setStyle(switchLook(style, "mine", client.config?.videoStyle));
                setNotice(L("« Mon style » appliqué.", "“Mi estilo” aplicado.", "“My style” applied."));
              }}
            >
              <Wand2 size={14} /> {L("Appliquer « Mon style »", "Aplicar “Mi estilo”", "Apply “My style”")}
            </button>
          )}
          {(canSaveOwn || agencyStyle) && (
            <button type="button" className="button secondary small" disabled={busy === "style" || phase !== "edit"} onClick={saveStyle}>
              <Save size={14} /> {agencyStyle ? "Enregistrer comme style du client" : L("Enregistrer comme mon style", "Guardar como mi estilo", "Save as my style")}
            </button>
          )}
          {!agencyStyle && (
            <>
              <input ref={videoInput} type="file" accept="video/mp4,video/quicktime,video/webm" hidden onChange={(e) => importVideo(e.target.files?.[0])} />
              <button type="button" className="button secondary small" disabled={busy === "video" || phase !== "edit"} onClick={() => videoInput.current?.click()}>
                {busy === "video" ? <Loader2 className="spin" size={14} /> : <Upload size={14} />} {L("Importer une vidéo", "Importar un video", "Import a video")}
              </button>
            </>
          )}
          </div>
          <button
            type="button"
            className="icon-button ce-more-btn"
            aria-label={L("Plus d’actions", "Más acciones", "More actions")}
            aria-expanded={toolsOpen}
            onClick={() => setToolsOpen(!toolsOpen)}
          >
            <MoreHorizontal size={19} />
          </button>
          {!agencyStyle && (
            <button type="button" className="button primary small" disabled={phase !== "edit"} onClick={exportVideo}>
              <Download size={14} /> {L("Exporter", "Exportar", "Export")}
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            disabled={phase === "rendering"}
            aria-label={L("Fermer", "Cerrar", "Close")}
            onClick={() => {
              cancel.current();
              onClose();
            }}
          >
            <X size={19} />
          </button>
        </header>
        {error && (
          <div className="alert error ce-alert" role="alert">
            <span>{error}</span>
            <button className="icon-button" aria-label={L("Fermer", "Cerrar", "Close")} onClick={() => setError("")}>
              <X size={14} />
            </button>
          </div>
        )}
        {(phase === "analyzing" || phase === "rendering") && (
          <div className="montage-wait" role="status">
            <Loader2 className="spin" size={28} />
            <h2>{phase === "analyzing" ? L("Le studio prépare votre vidéo…", "El estudio prepara tu video…", "The studio is preparing your video…") : L("Création de votre vidéo…", "Creando tu video…", "Creating your video…")}</h2>
            <p>{progress}</p>
            <small>{L("Gardez cette page ouverte.", "Mantén esta página abierta.", "Keep this page open.")}</small>
          </div>
        )}
        {phase === "error" && (
          <div className="montage-wait">
            <button className="button primary" onClick={() => setPhase("analyzing")}>
              {L("Réessayer", "Intentar de nuevo", "Try again")}
            </button>
          </div>
        )}
        {phase === "done" && (
          <div className="montage-step montage-done">
            <span className="montage-check">
              <Check size={28} />
            </span>
            <h2>{L("Votre vidéo est prête à publier.", "Tu video está listo para publicar.", "Your video is ready to post.")}</h2>
            <p>{L("Elle est enregistrée dans « Mes vidéos » et sur votre appareil.", "Está guardado en “Mis videos” y en tu dispositivo.", "It’s saved in “My videos” and on your device.")}</p>
            {output && (
              <a className="button secondary big" href={"/api/studio/file/" + output + "?download=1"}>
                <Download size={16} /> {L("Télécharger à nouveau", "Descargar de nuevo", "Download again")}
              </a>
            )}
            {edit?.id && <AddToCalendarButton kind="video" id={edit.id} />}
            <button className="text-link" onClick={() => setPhase("edit")}>
              {L("Retour à l’éditeur", "Volver al editor", "Back to the editor")}
            </button>
          </div>
        )}
        {phase === "edit" && (
          <div className="ce-body">
            <div className="ce-left">
              <MontagePreview
                clips={sampleMode ? [] : edit?.clips || []}
                clipInfo={clipInfo}
                keeps={keeps}
                words={words}
                style={style}
                duration={duration}
                width={300}
                controlRef={control}
                onTime={setT}
                background={sampleMode ? "/realisations/dupain-2.jpg" : undefined}
              />
              <div className="ce-timeline">
                <div className="ce-times">
                  <span>{fmt(t)}</span>
                  <span>{fmt(duration)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0.1, duration)}
                  step={0.05}
                  value={Math.round(Math.min(t, duration) * 20) / 20}
                  aria-label={L("Position dans la vidéo", "Posición en el video", "Position in the video")}
                  onChange={(e) => control.current?.seek(Number(e.target.value))}
                />
                <div className="ce-blocks" aria-hidden="true">
                  {timelineMarks.map((m: Row, k: number) => (
                    <i key={k} style={{ left: m.left + "%", width: m.width + "%" }} />
                  ))}
                  {(style.stickers || []).map((x: Row, k: number) => (
                    <b key={"s" + k} style={{ left: (x.s / Math.max(0.1, duration)) * 100 + "%" }} />
                  ))}
                </div>
              </div>
              {!sampleMode && (
                <p className="ce-stats">
                  {stats.timing === "clips" || stats.timing === "voice"
                    ? L("Sous-titres calés sur la voix.", "Subtítulos sincronizados con la voz.", "Subtitles synced to the voice.")
                    : L("Calage approximatif : vérifiez ou calez au tap.", "Sincronización aproximada: revisa o sincroniza con toques.", "Approximate timing: check it or sync by tapping.")}
                </p>
              )}
            </div>
            <div className="ce-right">
              <div className="ce-tabs" role="tablist" aria-label={L("Outils de montage", "Herramientas de edición", "Editing tools")}>
                {tabs.map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="ce-panel" role="tabpanel">
                {tab === "subs" && (
                  <>
                    <fieldset>
                      <legend>{L("Animation du texte", "Animación del texto", "Text animation")}</legend>
                      <div className="ce-chips">
                        {ANIMATIONS.map((a: string) => (
                          <button key={a} type="button" aria-pressed={style.animation === a} onClick={() => setStyle({ ...style, animation: a })}>
                            {animLabel[a]}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <div className="ce-grid">
                      <fieldset>
                        <legend>{L("Police", "Fuente", "Font")}</legend>
                        <div className="ce-chips">
                          {Object.entries(FONTS).map(([k, f]: [string, any]) => (
                            <button key={k} type="button" aria-pressed={style.font === k} style={{ fontFamily: f.css }} onClick={() => setStyle({ ...style, font: k })}>
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                      <fieldset>
                        <legend>{L("Couleur du mot prononcé", "Color de la palabra pronunciada", "Spoken word color")}</legend>
                        <div className="ce-swatches">
                          {HIGHLIGHTS.map((c) => (
                            <button key={c} type="button" aria-label={c} aria-pressed={style.highlight === c} style={{ background: c }} onClick={() => setStyle({ ...style, highlight: c })} />
                          ))}
                        </div>
                        <label className="ce-check">
                          <input type="checkbox" checked={!!style.outline} onChange={(e) => setStyle({ ...style, outline: e.target.checked })} /> {L("Contour noir", "Contorno negro", "Black outline")}
                        </label>
                        <label className="ce-check">
                          <input type="checkbox" checked={!!style.uppercase} onChange={(e) => setStyle({ ...style, uppercase: e.target.checked })} /> {L("Majuscules", "Mayúsculas", "Uppercase")}
                        </label>
                      </fieldset>
                      <fieldset>
                        <legend>{L("Position", "Posición", "Position")}</legend>
                        <div className="ce-seg">
                          {(
                            [
                              ["top", L("Haut", "Arriba", "Top")],
                              ["middle", L("Milieu", "Centro", "Middle")],
                              ["bottom", L("Bas", "Abajo", "Bottom")],
                            ] as const
                          ).map(([k, label]) => (
                            <button key={k} type="button" aria-pressed={style.position === k} onClick={() => setStyle({ ...style, position: k, offset: 0 })}>
                              {label}
                            </button>
                          ))}
                        </div>
                        <label className="ce-range">
                          {L("Ajuster la hauteur", "Ajustar la altura", "Fine-tune height")}
                          <input type="range" min={-0.25} max={0.25} step={0.01} value={style.offset || 0} onChange={(e) => setStyle({ ...style, offset: Number(e.target.value) }, false)} />
                        </label>
                      </fieldset>
                      <fieldset>
                        <legend>{L("Taille et décalage", "Tamaño y desfase", "Size and offset")}</legend>
                        <label className="ce-range">
                          {L("Taille", "Tamaño", "Size")} · {Math.round((style.scale || 1) * 100)} %
                          <input type="range" min={0.7} max={1.5} step={0.05} value={style.scale || 1} onChange={(e) => setStyle({ ...style, scale: Number(e.target.value) }, false)} />
                        </label>
                        <label className="ce-range">
                          {L("Décalage", "Desfase", "Offset")} · {(style.shift || 0) > 0 ? "+" : ""}
                          {(style.shift || 0).toFixed(2)} s
                          <input type="range" min={-1} max={1} step={0.05} value={style.shift || 0} onChange={(e) => setStyle({ ...style, shift: Number(e.target.value) }, false)} />
                        </label>
                      </fieldset>
                    </div>
                    <fieldset>
                      <legend>{L("Texte calé sur la voix", "Texto sincronizado con la voz", "Text synced to the voice")}</legend>
                      <p className="muted">
                        {L(
                          "Touchez un mot : 1 fois jaune, 2 fois rose, 3 fois manuscrit, 4 fois normal.",
                          "Toca una palabra: 1 vez amarillo, 2 veces rosa, 3 veces manuscrito, 4 veces normal.",
                          "Tap a word: once for yellow, twice for pink, three times for handwritten, four times for normal.",
                        )}
                      </p>
                      <div className="ce-transcript">
                        {groups.map((g: Row, k: number) => (
                          <div key={k} className={"ce-block" + (tapping && nextTapBlock === g ? " next" : "")}>
                            <small>{fmt(Math.max(0, g.s + (style.shift || 0)))}</small>
                            {g.idx.map((i: number) => {
                              const ws = style.wordStyles?.[baseWords[i]?.oi as number] || "normal";
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  className={"ce-word " + ws + (sel === i ? " sel" : "")}
                                  style={{ fontFamily: ws === "script" ? FONTS.script.css : undefined, borderBottomColor: (WORD_STYLES as Row)[ws] || "transparent" }}
                                  onClick={() => cycleWord(i)}
                                >
                                  {baseWords[i]?.w}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                        {!groups.length && <p className="muted">{L("Aucun texte dans cette vidéo.", "No hay texto en este video.", "No text in this video.")}</p>}
                      </div>
                      {sel >= 0 && words[sel] && (
                        <label className="ce-field">
                          {L("Corriger le mot", "Corregir la palabra", "Fix the word")}
                          <input value={words[sel].w} maxLength={40} onChange={(e) => renameWord(sel, e.target.value)} />
                        </label>
                      )}
                      <div className="ce-row">
                        {!tapping ? (
                          <button type="button" className="button secondary small" disabled={!groups.length} onClick={startTaps}>
                            {touch
                              ? L("Caler le texte en touchant", "Sincronizar con toques", "Sync by tapping")
                              : L("Caler au tap (barre d’espace)", "Sincronizar con toques (barra espaciadora)", "Sync by tapping (space bar)")}
                          </button>
                        ) : (
                          <>
                            <span className="ce-tap" role="status">
                              {touch ? L(
                                `Touchez « Tap » au début de chaque bloc · ${taps.length}/${groups.length}`,
                                `Toca “Toque” al inicio de cada bloque · ${taps.length}/${groups.length}`,
                                `Tap “Tap” at the start of each block · ${taps.length}/${groups.length}`,
                              ) : L(
                                `Appuyez sur Espace au début de chaque bloc · ${taps.length}/${groups.length}`,
                                `Presiona Espacio al inicio de cada bloque · ${taps.length}/${groups.length}`,
                                `Press Space at the start of each block · ${taps.length}/${groups.length}`,
                              )}
                            </span>
                            <button type="button" className="button primary small" onClick={() => setTaps((o) => [...o, Math.round(t * 1000) / 1000])}>
                              {L("Tap", "Toque", "Tap")}
                            </button>
                            <button type="button" className="button secondary small" onClick={finishTaps}>
                              {L("Terminer", "Terminar", "Finish")}
                            </button>
                          </>
                        )}
                      </div>
                    </fieldset>
                  </>
                )}
                {tab === "stickers" && (
                  <>
                    <fieldset>
                      <legend>{L("Emojis", "Emojis", "Emojis")}</legend>
                      <div className="ce-emojis">
                        {EMOJIS.map((c: string) => (
                          <button key={c} type="button" aria-label={L("Ajouter", "Agregar", "Add") + " " + c} onClick={() => addSticker({ kind: "emoji", char: c })}>
                            {c}
                          </button>
                        ))}
                      </div>
                      <p className="muted">{L("L’autocollant apparaît à la position actuelle de la lecture, pendant 2 secondes.", "El sticker aparece en la posición actual de la reproducción, durante 2 segundos.", "The sticker appears at the current playback position, for 2 seconds.")}</p>
                    </fieldset>
                    <fieldset>
                      <legend>{L("Mes autocollants", "Mis stickers", "My stickers")}</legend>
                      <div className="ce-emojis">
                        {stickerFiles.map((f) => (
                          <button key={f.id} type="button" aria-label={f.name} onClick={() => addSticker({ kind: "png", file_id: f.id })}>
                            <img src={"/api/studio/file/" + f.id} alt="" />
                          </button>
                        ))}
                      </div>
                      <input ref={stickerInput} type="file" accept="image/png" hidden onChange={(e) => uploadSticker(e.target.files?.[0])} />
                      {!agencyStyle && (
                        <button type="button" className="button secondary small dashed" disabled={busy === "sticker"} onClick={() => stickerInput.current?.click()}>
                          {busy === "sticker" ? <Loader2 className="spin" size={14} /> : <Upload size={14} />} {L("Ajouter mon autocollant (PNG détouré, 3 Mo max)", "Agregar mi sticker (PNG sin fondo, 3 MB máx.)", "Add my sticker (transparent PNG, 3 MB max)")}
                        </button>
                      )}
                    </fieldset>
                    {(style.stickers || []).length > 0 && (
                      <fieldset>
                        <legend>{L("Autocollants de la vidéo", "Stickers del video", "Stickers in the video")}</legend>
                        {style.stickers.map((x: Row, k: number) => (
                          <div key={k} className="ce-item">
                            <span className="ce-item-icon">{x.kind === "png" ? <img src={"/api/studio/file/" + x.file_id} alt="" /> : x.char}</span>
                            <label>
                              {L("De", "De", "From")}
                              <input type="number" min={0} max={duration} step={0.1} value={x.s} onChange={(e) => patchSticker(k, { s: Number(e.target.value) })} />
                            </label>
                            <label>
                              {L("à", "a", "to")}
                              <input type="number" min={0} max={duration} step={0.1} value={x.e} onChange={(e) => patchSticker(k, { e: Number(e.target.value) })} />
                            </label>
                            <div className="ce-pos" role="group" aria-label={L("Position", "Posición", "Position")}>
                              {[0.2, 0.5, 0.8].flatMap((yy) =>
                                [0.25, 0.5, 0.75].map((xx) => (
                                  <button key={xx + "-" + yy} type="button" aria-pressed={Math.abs(x.x - xx) < 0.05 && Math.abs(x.y - yy) < 0.05} aria-label={`${xx},${yy}`} onClick={() => patchSticker(k, { x: xx, y: yy })} />
                                )),
                              )}
                            </div>
                            <label className="ce-range">
                              {L("Taille", "Tamaño", "Size")}
                              <input type="range" min={0.08} max={0.6} step={0.02} value={x.size} onChange={(e) => patchSticker(k, { size: Number(e.target.value) })} />
                            </label>
                            <label className="ce-check">
                              <input type="checkbox" checked={!!x.sfx} onChange={(e) => patchSticker(k, { sfx: e.target.checked })} /> {L("Bruitage", "Efecto de sonido", "Sound effect")}
                            </label>
                            <button type="button" className="icon-button" aria-label={L("Retirer", "Quitar", "Remove")} onClick={() => setStyle({ ...style, stickers: style.stickers.filter((_: Row, i: number) => i !== k) })}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </fieldset>
                    )}
                    <fieldset>
                      <legend>{L("Gros titre posé sur l’image", "Título grande sobre la imagen", "Big title on the image")}</legend>
                      <div className="ce-row">
                        <input className="ce-input" value={titleText} maxLength={40} placeholder={L("Ex. : ÉPISODE 2", "Ej.: EPISODIO 2", "E.g. EPISODE 2")} onChange={(e) => setTitleText(e.target.value)} />
                        <button
                          type="button"
                          className="button secondary small"
                          disabled={!titleText.trim() || (style.titles || []).length >= MAX_TITLES}
                          onClick={() => {
                            const s0 = Math.min(Math.max(0, t), Math.max(0, duration - 0.5));
                            setStyle({ ...style, titles: [...(style.titles || []), { text: titleText, x: 0.5, y: 0.42, s: s0, e: Math.min(duration, s0 + 2.5), font: "heavy", color: "#FFFFFF", size: 0.08, sfx: style.sfx }] });
                            setTitleText("");
                          }}
                        >
                          {L("Ajouter", "Agregar", "Add")}
                        </button>
                      </div>
                      {(style.titles || []).map((x: Row, k: number) => (
                        <div key={k} className="ce-item">
                          <input className="ce-input" value={x.text} maxLength={40} onChange={(e) => patchTitle(k, { text: e.target.value })} />
                          <label>
                            {L("De", "De", "From")}
                            <input type="number" min={0} max={duration} step={0.1} value={x.s} onChange={(e) => patchTitle(k, { s: Number(e.target.value) })} />
                          </label>
                          <label>
                            {L("à", "a", "to")}
                            <input type="number" min={0} max={duration} step={0.1} value={x.e} onChange={(e) => patchTitle(k, { e: Number(e.target.value) })} />
                          </label>
                          <div className="ce-seg small">
                            {[0.2, 0.5, 0.8].map((yy, n) => (
                              <button key={yy} type="button" aria-pressed={Math.abs(x.y - yy) < 0.05} onClick={() => patchTitle(k, { y: yy })}>
                                {[L("Haut", "Arriba", "Top"), L("Milieu", "Centro", "Middle"), L("Bas", "Abajo", "Bottom")][n]}
                              </button>
                            ))}
                          </div>
                          <label className="ce-check">
                            <input type="checkbox" checked={!!x.sfx} onChange={(e) => patchTitle(k, { sfx: e.target.checked })} /> {L("Bruitage", "Efecto de sonido", "Sound effect")}
                          </label>
                          <button type="button" className="icon-button" aria-label={L("Retirer", "Quitar", "Remove")} onClick={() => setStyle({ ...style, titles: style.titles.filter((_: Row, i: number) => i !== k) })}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </fieldset>
                  </>
                )}
                {tab === "hook" && (
                  <>
                    <fieldset>
                      <legend>{L("Accroche des 3 premières secondes", "Gancho de los primeros 3 segundos", "Hook for the first 3 seconds")}</legend>
                      <input className="ce-input" value={style.hook?.text || ""} maxLength={90} onChange={(e) => setStyle({ ...style, hook: { ...style.hook, text: e.target.value, wordFonts: {} } }, false)} />
                      <div className="ce-hooks">
                        {hooks.map((h) => (
                          <button key={h} type="button" aria-pressed={style.hook?.text === h} onClick={() => setStyle({ ...style, hook: { ...style.hook, text: h, wordFonts: {} } })}>
                            {h}
                          </button>
                        ))}
                      </div>
                      <button type="button" className="text-link" disabled={busy === "hooks"} onClick={proposeHooks}>
                        {busy === "hooks" ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />} {L("Proposer 3 accroches", "Proponer 3 ganchos", "Suggest 3 hooks")}
                      </button>
                    </fieldset>
                    <fieldset>
                      <legend>{L("Police de l’accroche", "Fuente del gancho", "Hook font")}</legend>
                      <div className="ce-chips">
                        {Object.entries(FONTS).map(([k, f]: [string, any]) => (
                          <button key={k} type="button" aria-pressed={style.hook?.font === k} style={{ fontFamily: f.css }} onClick={() => setStyle({ ...style, hook: { ...style.hook, font: k } })}>
                            {f.label}
                          </button>
                        ))}
                      </div>
                      {hookWords(style.hook).length > 1 && (
                        <>
                          <p className="muted">{L("Touchez un mot pour le passer en manuscrit ou en gras.", "Toca una palabra para ponerla en manuscrito o en negrita.", "Tap a word to make it handwritten or heavy.")}</p>
                          <div className="ce-transcript">
                            {hookWords(style.hook).map((hw: Row, i: number) => (
                              <button
                                key={i}
                                type="button"
                                className="ce-word"
                                style={{ fontFamily: ((FONTS as Row)[hw.font] || FONTS.serif).css }}
                                onClick={() => {
                                  const cycle = [undefined, "script", "heavy"];
                                  const cur = style.hook?.wordFonts?.[i];
                                  const nxt = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
                                  const map = { ...(style.hook?.wordFonts || {}) };
                                  if (nxt) map[i] = nxt;
                                  else delete map[i];
                                  setStyle({ ...style, hook: { ...style.hook, wordFonts: map } });
                                }}
                              >
                                {hw.text}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </fieldset>
                    <fieldset>
                      <legend>{L("Fin de vidéo", "Final del video", "Ending")}</legend>
                      <input className="ce-input" value={style.outro?.text || ""} maxLength={80} placeholder={L("Ex. : Commandez votre pain sur dupain.mx", "Ej.: Pide tu pan en dupain.mx", "E.g. Order your bread at dupain.mx")} onChange={(e) => setStyle({ ...style, outro: { ...style.outro, text: e.target.value } }, false)} />
                      <label className="ce-check">
                        <input type="checkbox" checked={style.outro?.logo !== false} onChange={(e) => setStyle({ ...style, outro: { ...style.outro, logo: e.target.checked } })} /> {L("Logo à la fin", "Logo al final", "Logo at the end")}
                      </label>
                    </fieldset>
                  </>
                )}
                {tab === "rhythm" && (
                  <>
                    {(
                      [
                        [
                          "cutSilences",
                          L("Couper les silences", "Cortar los silencios", "Cut silences"),
                          stats.found
                            ? L(`${stats.found} silence(s) détecté(s) · −${stats.saved || 0} s`, `${stats.found} silencio(s) detectado(s) · −${stats.saved || 0} s`, `${stats.found} silence(s) found · −${stats.saved || 0} s`)
                            : L("Aucun silence détecté", "No se detectaron silencios", "No silence found"),
                        ],
                        ["zooms", L("Zooms sur les moments forts", "Zooms en los momentos clave", "Zooms on key moments"), L("Sur les mots en couleur", "En las palabras de color", "On colored words")],
                        ["jumpCuts", L("Coupes rapides", "Cortes rápidos", "Jump cuts"), L("Un plan toutes les 2 secondes environ", "Un plano cada 2 segundos aprox.", "A new shot about every 2 seconds")],
                      ] as const
                    ).map(([k, label, detail]) => (
                      <label key={k} className="ce-toggle">
                        <span>
                          <b>{label}</b>
                          <small>{detail}</small>
                        </span>
                        <input type="checkbox" checked={!!style.rhythm?.[k]} onChange={(e) => setStyle({ ...style, rhythm: { ...style.rhythm, [k]: e.target.checked } })} />
                      </label>
                    ))}
                    <fieldset>
                      <legend>{L("Durée cible", "Duración objetivo", "Target length")}</legend>
                      <div className="ce-seg">
                        {[15, 30, 60, null].map((d) => (
                          <button key={String(d)} type="button" aria-pressed={(style.rhythm?.target ?? null) === d} onClick={() => setStyle({ ...style, rhythm: { ...style.rhythm, target: d } })}>
                            {d ? `${d} s` : L("Libre", "Libre", "Free")}
                          </button>
                        ))}
                      </div>
                      <p className="muted">{L(`Durée actuelle : ${fmt(duration)}`, `Duración actual: ${fmt(duration)}`, `Current length: ${fmt(duration)}`)}</p>
                    </fieldset>
                  </>
                )}
                {tab === "sound" && (
                  <>
                    <fieldset>
                      <legend>{L("Musique", "Música", "Music")}</legend>
                      {musicFiles.map((f) => (
                        <button key={f.id} type="button" className={"montage-choice" + (style.music?.id === f.id ? " on" : "")} onClick={() => setStyle({ ...style, music: { ...style.music, id: f.id } })}>
                          {(f.name || "").replace(/\.(mp3|m4a|aac)$/i, "")}
                        </button>
                      ))}
                      <button type="button" className={"montage-choice" + (!style.music?.id ? " on" : "")} onClick={() => setStyle({ ...style, music: { ...style.music, id: null } })}>
                        {L("Sans musique", "Sin música", "No music")}
                      </button>
                      {mode === "creator" && (
                        <>
                          <input ref={musicInput} type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac" hidden onChange={(e) => uploadMusic(e.target.files?.[0])} />
                          <button type="button" className="button secondary small dashed" disabled={busy === "music"} onClick={() => musicInput.current?.click()}>
                            {busy === "music" ? <Loader2 className="spin" size={14} /> : <Upload size={14} />} {L("Ajouter une musique libre de droits", "Agregar una música libre de derechos", "Add royalty-free music")}
                          </button>
                        </>
                      )}
                      <label className="ce-range">
                        {L("Volume de la musique", "Volumen de la música", "Music volume")} · {Math.round((style.music?.volume ?? 0.35) * 100)} %
                        <input type="range" min={0} max={1} step={0.05} value={style.music?.volume ?? 0.35} onChange={(e) => setStyle({ ...style, music: { ...style.music, volume: Number(e.target.value) } }, false)} />
                      </label>
                      <label className="ce-check">
                        <input type="checkbox" checked={style.music?.duck !== false} onChange={(e) => setStyle({ ...style, music: { ...style.music, duck: e.target.checked } })} /> {L("La musique baisse quand je parle", "La música baja cuando hablo", "Music lowers when I speak")}
                      </label>
                    </fieldset>
                    <fieldset>
                      <legend>{L("Bruitages", "Efectos de sonido", "Sound effects")}</legend>
                      <div className="ce-chips">
                        {SFX_KINDS.map((k: string) => (
                          <button
                            key={k}
                            type="button"
                            aria-pressed={style.sfxKind === k}
                            onClick={() => {
                              setStyle({ ...style, sfxKind: k });
                              playSfx(k, style.sfxVolume ?? 0.6);
                            }}
                          >
                            {sfxLabel[k]}
                          </button>
                        ))}
                      </div>
                      <label className="ce-range">
                        {L("Volume des bruitages", "Volumen de los efectos", "Effects volume")} · {Math.round((style.sfxVolume ?? 0.6) * 100)} %
                        <input type="range" min={0} max={1} step={0.05} value={style.sfxVolume ?? 0.6} onChange={(e) => setStyle({ ...style, sfxVolume: Number(e.target.value) }, false)} />
                      </label>
                      <label className="ce-check">
                        <input type="checkbox" checked={!!style.sfx} onChange={(e) => setStyle({ ...style, sfx: e.target.checked })} /> {L("Bruitage par défaut sur les nouveaux autocollants et titres", "Efecto por defecto en los nuevos stickers y títulos", "Default sound on new stickers and titles")}
                      </label>
                    </fieldset>
                    {edit && !agencyStyle && (
                      <fieldset>
                        <legend>{L("Voix off", "Voz en off", "Voiceover")}</legend>
                        <textarea className="ce-input" rows={3} maxLength={600} value={voiceScript} onChange={(e) => setVoiceScript(e.target.value)} />
                        <div className="ce-chips">
                          {(
                            [
                              ["warm", L("Chaleureuse", "Cálida", "Warm")],
                              ["calm", L("Posée", "Serena", "Calm")],
                              ["energetic", L("Énergique", "Enérgica", "Energetic")],
                            ] as const
                          ).map(([k, label]) => (
                            <button key={k} type="button" aria-pressed={voiceKind === k} onClick={() => setVoiceKind(k)}>
                              {label}
                            </button>
                          ))}
                        </div>
                        {voiceFile && <audio controls src={"/api/studio/file/" + voiceFile} />}
                        <button type="button" className="button secondary small" disabled={busy === "voice" || !voiceScript.trim()} onClick={createVoice}>
                          {busy === "voice" ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />} {voiceFile ? L("Recréer la voix off", "Volver a crear la voz en off", "Recreate the voiceover") : L("Créer la voix off", "Crear la voz en off", "Create the voiceover")}
                        </button>
                        <p className="muted">{L("Voix générée par IA : signalez-le si la plateforme le demande.", "Voz generada por IA: indícalo si la plataforma lo pide.", "AI-generated voice: disclose it if the platform asks.")}</p>
                      </fieldset>
                    )}
                  </>
                )}
              </div>
              <div className="ce-intents">
                <span>{L("Assistant :", "Asistente:", "Assistant:")}</span>
                <button type="button" onClick={() => (setStyle(applyIntent(style, "dynamic")), setNotice(L("Plus percutant : zooms et coupes rapides.", "Más impactante: zooms y cortes rápidos.", "Punchier: zooms and jump cuts.")))}>
                  {L("Plus percutant", "Más impactante", "Punchier")}
                </button>
                <button type="button" onClick={() => (setStyle(applyIntent(style, "calm")), setNotice(L("Plus calme : fondu doux et musique plus légère.", "Más tranquilo: fundido suave y música más ligera.", "Calmer: soft fade and lighter music.")))}>
                  {L("Plus calme", "Más tranquilo", "Calmer")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = applyIntent(style, "shorter");
                    setStyle(next);
                    setNotice(L(`Plus court : ${next.rhythm.target} s maximum.`, `Más corto: ${next.rhythm.target} s máximo.`, `Shorter: ${next.rhythm.target} s max.`));
                  }}
                >
                  {L("Plus court", "Más corto", "Shorter")}
                </button>
                {notice && (
                  <span className="ce-notice" role="status">
                    {notice}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
