"use client";
import { AddToCalendarButton } from "./add-to-calendar";
// Montage automatique des marques : « Votre vidéo est prête » → « Petites retouches » → « Télécharger ».
// Le studio prépare tout (calage des mots, coupe des silences, hook, style de la marque) ; le client choisit.
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Play, Pause, X, Download, ArrowLeft, Sparkles, RefreshCw } from "lucide-react";
import { useL, useLang } from "../lib/i18n";
import { uploadStudioMedia } from "../lib/direct-upload-client";
import { type ClipInfo } from "../lib/montage-engine";
import { prepareMontage, exportMontage } from "../lib/montage-flow";
import { BookingButton } from "./booking-help";
import { FONTS, WORD_STYLES, lookStyle, switchLook, applyIntent, sanitizeStyle } from "../lib/video-style.mjs";
import {
  silencesToKeeps,
  speechSilences,
  trimKeeps,
  remapWords,
  keptDuration,
  proportionalWords,
  subtitleFrame,
  subtitleGroups,
  sourceTime,
  buildPlan,
} from "../lib/video-timing.mjs";
import { POSITION_Y, HOOK_Y, fontPx, subtitleY } from "../lib/video-render.mjs";

/** Commandes de l'aperçu pour l'éditeur complet (lecture, pause, déplacement). */
export type PreviewControl = { play: () => void; pause: () => void; seek: (t: number) => void; playing: () => boolean };

type Row = Record<string, any>;
type Word = { w: string; s: number; e: number; oi?: number };
async function call(path: string, body?: any) {
  const r = await fetch("/api/studio/" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json", "X-Studio-Request": "1" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const d: any = await r.json();
  if (!r.ok) throw new Error(d.error);
  return d;
}
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Aperçu en direct : les passages gardés défilent dans une seule vidéo, avec les sous-titres du rendu. */
export function MontagePreview({
  clips,
  clipInfo,
  keeps,
  words,
  style,
  duration,
  width = 220,
  autoPlay = false,
  controlRef,
  onTime,
  background,
  stickerUrl,
}: {
  controlRef?: { current: PreviewControl | null };
  onTime?: (t: number) => void;
  background?: string;
  stickerUrl?: (id: string) => string;
  clips: string[];
  clipInfo: ClipInfo[];
  keeps: [number, number][];
  words: Word[];
  style: any;
  duration: number;
  width?: number;
  autoPlay?: boolean;
}) {
  const L = useL();
  const video = useRef<HTMLVideoElement>(null);
  const [t, setT] = useState(0),
    [playing, setPlaying] = useState(false),
    [piece, setPiece] = useState(0);
  const height = Math.round((width * 16) / 9);
  const plan = useMemo(
    () =>
      buildPlan(
        keeps,
        clipInfo.map((c) => c.duration),
        clipInfo.map((c) => c.audio),
        style,
        words.map((w) => ({ ...w, s: sourceTime(keeps, w.s), e: sourceTime(keeps, w.e) })),
      ),
    [JSON.stringify(keeps), JSON.stringify(clipInfo), style.rhythm?.zooms, style.rhythm?.jumpCuts, JSON.stringify(style.wordStyles)],
  );
  const starts = useMemo(() => {
    let acc = 0;
    return plan.map((p: Row) => {
      const s = acc;
      acc += p.duration;
      return s;
    });
  }, [plan]);
  const groups = useMemo(() => subtitleGroups(words, style), [words, style]);
  const frame: Row = subtitleFrame(words, style, t, { duration, groups: groups as any });
  const empty = !clips.length || !plan.length;
  const clock = useRef<{ start: number; from: number } | null>(null);
  useEffect(() => onTime?.(t), [t]);
  function seekPiece(i: number, play: boolean) {
    const v = video.current,
      p = plan[i];
    if (!v || !p) return;
    const src = "/api/studio/file/" + encodeURIComponent(clips[p.input]);
    const go = () => {
      v.currentTime = p.start;
      if (play) v.play().catch(() => setPlaying(false));
    };
    setPiece(i);
    if (v.dataset.src !== src) {
      v.dataset.src = src;
      v.src = src;
      v.onloadedmetadata = go;
    } else go();
  }
  useEffect(() => {
    if (empty) return;
    seekPiece(0, autoPlay);
    setT(0);
    setPlaying(autoPlay);
  }, [plan]);
  // Sans rushes (aperçu de style côté agence) : une horloge simple fait défiler les sous-titres d'exemple.
  useEffect(() => {
    if (!empty) return;
    let raf = 0;
    const tick = () => {
      if (clock.current) {
        const now = clock.current.from + (performance.now() - clock.current.start) / 1000;
        if (now >= duration) {
          clock.current = null;
          setPlaying(false);
          setT(0);
        } else setT(now);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [empty, duration]);
  function seekTo(target: number) {
    const tt = Math.max(0, Math.min(duration, target));
    if (empty) {
      if (clock.current) clock.current = { start: performance.now(), from: tt };
      setT(tt);
      return;
    }
    let i = starts.findIndex((s0: number, k: number) => tt >= s0 && tt < s0 + plan[k].duration);
    if (i < 0) i = plan.length - 1;
    const v = video.current,
      p = plan[i];
    if (!v || !p) return;
    const src = "/api/studio/file/" + encodeURIComponent(clips[p.input]);
    const local = Math.max(0, tt - starts[i]);
    const go = () => {
      v.currentTime = p.start + local;
    };
    setPiece(i);
    setT(tt);
    if (v.dataset.src !== src) {
      v.dataset.src = src;
      v.src = src;
      v.onloadedmetadata = go;
    } else go();
  }
  useEffect(() => {
    if (empty) return;
    let raf = 0;
    const tick = () => {
      const v = video.current,
        p = plan[piece];
      if (v && p) {
        const local = v.currentTime - p.start;
        if (local >= p.duration - 0.03 && !v.paused) {
          if (piece + 1 < plan.length) seekPiece(piece + 1, true);
          else {
            v.pause();
            setPlaying(false);
            setT(0);
            seekPiece(0, false);
          }
        } else setT(Math.min(duration, starts[piece] + Math.max(0, local)));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [piece, plan, starts, duration]);
  const toggle = () => {
    if (empty) {
      if (clock.current) {
        clock.current = null;
        setPlaying(false);
      } else {
        clock.current = { start: performance.now(), from: t };
        setPlaying(true);
      }
      return;
    }
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };
  if (controlRef)
    controlRef.current = {
      play: () => {
        if (!playing) toggle();
      },
      pause: () => {
        if (playing) toggle();
      },
      seek: seekTo,
      playing: () => playing,
    };
  const size = fontPx(style, height);
  const base = (FONTS as Row)[style.font] || FONTS.sans;
  const label = style.animation === "label";
  const textShadow = style.outline
    ? "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 2px 0 #000"
    : "0 2px 6px rgba(0,0,0,.65)";
  return (
    <div className="montage-preview" style={{ width, height, backgroundImage: empty && background ? `url(${background})` : undefined }}>
      {!empty && <video ref={video} playsInline muted={false} preload="metadata" style={{ transform: `scale(${plan[piece]?.zoom || 1})` }} />}
      {(frame.stickers || []).map((st: Row) => (
        <div
          key={"st" + st.k}
          className="montage-sticker"
          style={{ left: st.x * width, top: st.y * height, width: st.size * width, height: st.size * width, fontSize: st.size * width * 0.8 }}
          aria-hidden="true"
        >
          {st.kind === "png" ? <img src={stickerUrl ? stickerUrl(st.file_id) : "/api/studio/file/" + st.file_id} alt="" /> : st.char}
        </div>
      ))}
      {(frame.titles || []).map((tt: Row, k: number) => (
        <div
          key={"tt" + k}
          className="montage-title"
          style={{
            left: tt.x * width,
            top: tt.y * height,
            fontSize: tt.size * height,
            color: tt.color,
            fontFamily: ((FONTS as Row)[tt.font] || FONTS.heavy).css,
          }}
        >
          {tt.text}
        </div>
      ))}
      {frame.hook && (
        <div
          className="montage-hook"
          style={{
            top: height * HOOK_Y,
            fontFamily: ((FONTS as Row)[frame.hook.font] || FONTS.serif).css,
            fontSize: Math.round(size * 1.3),
          }}
        >
          {Object.keys(style.hook?.wordFonts || {}).length
            ? frame.hook.words.map((hw: Row, k: number) => (
                <span key={k} style={{ fontFamily: ((FONTS as Row)[hw.font] || FONTS.serif).css }}>
                  {hw.text}{" "}
                </span>
              ))
            : frame.hook.text}
        </div>
      )}
      {frame.group >= 0 && (
        <div
          className={"montage-sub" + (label ? " label" : "")}
          style={{
            top: height * subtitleY(style),
            fontFamily: base.css,
            fontSize: size,
            opacity: frame.opacity,
            textShadow: label ? "none" : textShadow,
          }}
        >
          {frame.words
            .filter((w: Row) => w.visible)
            .map((w: Row) => (
              <span
                key={w.i}
                style={{
                  color: w.color,
                  fontFamily: ((FONTS as Row)[w.font] || base).css,
                  fontSize: w.script ? Math.round(size * 1.05) : size,
                }}
              >
                {w.text}{" "}
              </span>
            ))}
        </div>
      )}
      {frame.outro && (
        <div className="montage-sub label" style={{ top: height * 0.45, fontFamily: base.css, fontSize: size }}>
          {frame.outro.text}
        </div>
      )}
      <button type="button" className="montage-play" onClick={toggle} aria-label={playing ? L("Pause", "Pausa", "Pause") : L("Lire la vidéo", "Reproducir el video", "Play the video")}>
        {playing ? <Pause size={20} /> : <Play size={20} />}
      </button>
      <span className="montage-time">{fmt(duration)}</span>
    </div>
  );
}

type Phase = "analyzing" | "ready" | "retouch" | "rendering" | "done" | "error";

export default function BrandMontage({
  edit,
  client,
  data,
  onClose,
  refresh,
  onAdvanced,
  onFullEditor,
}: {
  edit: Row;
  client: Row;
  data: Row;
  onClose: () => void;
  refresh: () => Promise<any>;
  onAdvanced?: () => void;
  onFullEditor?: () => void;
}) {
  const L = useL(),
    lang = useLang();
  const saved = edit.brief?.brand;
  const [phase, setPhase] = useState<Phase>(saved?.style && saved?.clipInfo?.length ? "ready" : "analyzing");
  const [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [clipInfo, setClipInfo] = useState<ClipInfo[]>(saved?.clipInfo || []),
    [base, setBase] = useState<[number, number][]>(saved?.base?.length ? saved.base : saved?.keeps || []),
    [srcWords, setSrcWords] = useState<Word[]>(saved?.words || []),
    [voiceWords, setVoiceWords] = useState<boolean>(!!saved?.voiceWords),
    [style, setStyle] = useState<any>(saved?.style || lookStyle("mine", client.config?.videoStyle)),
    [look, setLook] = useState<"mine" | "soft" | "bold">("mine"),
    [hooks, setHooks] = useState<string[]>(saved?.hooks || []),
    [stats, setStats] = useState<Row>(saved?.stats || { before: 0, after: 0, silences: 0 }),
    [panel, setPanel] = useState<"hook" | "look" | "word" | "music">("hook"),
    [sel, setSel] = useState(-1),
    [output, setOutput] = useState<string | null>(null),
    [reviewSent, setReviewSent] = useState(!!edit.brief?.reviewRequested),
    [hookBusy, setHookBusy] = useState(false);
  const cancel = useRef<() => void>(() => {});
  const keeps = useMemo(() => trimKeeps(base, style.rhythm?.target || 60) as [number, number][], [base, style.rhythm?.target]);
  const duration = Math.min(keptDuration(keeps), style.rhythm?.target || 60);
  const indexed = useMemo(() => srcWords.map((w, i) => ({ ...w, oi: i })), [srcWords]);
  const words: Word[] = useMemo(() => (voiceWords ? indexed.filter((w) => w.s < duration) : remapWords(indexed, keeps)), [indexed, keeps, voiceWords, duration]);
  const musicFiles: Row[] = data.musicFiles || [];
  const voiceFile = edit.brief?.voice?.file_id || null;

  async function save(next: Row = {}) {
    const st = next.style || style;
    await call("video-brand-save", {
      edit_id: edit.id,
      style: st,
      words: next.words || srcWords,
      keeps: next.keeps || keeps,
      base: next.base || base,
      clipInfo: next.clipInfo || clipInfo,
      voiceWords: next.voiceWords ?? voiceWords,
      hooks: next.hooks || hooks,
      stats: next.stats || stats,
      fullBase: next.fullBase || saved?.fullBase,
      cutBase: next.cutBase || saved?.cutBase,
    });
  }
  // Préparation automatique : analyse, calage des mots, coupe des silences, hook, style de la marque.
  useEffect(() => {
    if (phase !== "analyzing") return;
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
        setClipInfo(p.clipInfo);
        setBase(p.base);
        setSrcWords(p.words);
        setVoiceWords(p.voiceWords);
        setHooks(p.hooks);
        setStyle(p.style);
        setStats(p.stats);
        await save({
          style: p.style,
          words: p.words,
          base: p.base,
          keeps: trimKeeps(p.base, p.style.rhythm.target || 60),
          clipInfo: p.clipInfo,
          voiceWords: p.voiceWords,
          hooks: p.hooks,
          stats: p.stats,
          fullBase: p.fullBase,
          cutBase: p.cutBase,
        });
        setPhase("ready");
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

  async function moreHooks() {
    setHookBusy(true);
    try {
      const d = await call("video-hooks", { edit_id: edit.id, avoid: hooks });
      const hs = (d.hooks || []).filter((h: string) => !hooks.includes(h));
      if (hs.length) {
        setHooks(hs);
        setStyle({ ...style, hook: { ...style.hook, text: hs[0] } });
      } else setNotice(L("Pas d’autre proposition pour le moment.", "No hay otra propuesta por ahora.", "No other suggestion right now."));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setHookBusy(false);
    }
  }
  function intent(kind: "dynamic" | "calm" | "shorter") {
    const next = applyIntent(style, kind);
    setStyle(next);
    setNotice(
      kind === "dynamic"
        ? L("C’est fait : zooms et coupes plus rapides.", "Listo: zooms y cortes más rápidos.", "Done: zooms and faster cuts.")
        : kind === "calm"
          ? L("C’est fait : fondus doux et musique plus légère.", "Listo: fundidos suaves y música más ligera.", "Done: soft fades and lighter music.")
          : L(
              `C’est fait : la vidéo dure maintenant ${next.rhythm.target} secondes maximum.`,
              `Listo: el video dura ahora ${next.rhythm.target} segundos como máximo.`,
              `Done: the video now lasts ${next.rhythm.target} seconds max.`,
            ),
    );
  }
  function setWordText(i: number, text: string) {
    const oi = words[i]?.oi;
    if (oi === undefined) return;
    const next = srcWords.map((w, k) => (k === oi ? { ...w, w: text.replace(/[{}\\<>]/g, "").slice(0, 40) } : w));
    setSrcWords(next);
  }
  function setWordStyle(i: number, ws: string) {
    const oi = words[i]?.oi;
    if (oi === undefined) return;
    const map = { ...(style.wordStyles || {}) };
    if (ws === "normal") delete map[oi];
    else map[oi] = ws;
    setStyle({ ...style, wordStyles: map });
  }
  async function download() {
    setPhase("rendering");
    setError("");
    try {
      await save();
      const r = await exportMontage({
        edit,
        client,
        clipInfo,
        keeps,
        words,
        style,
        lang,
        update: setProgress,
        register: (c) => (cancel.current = c),
      });
      setOutput(r.output);
      await refresh();
      setPhase("done");
    } catch (e: any) {
      setError(e.message || L("Le montage a été interrompu.", "La edición se interrumpió.", "The edit was interrupted."));
      setPhase("retouch");
    }
  }
  async function askReview() {
    try {
      await call("video-review-request", { edit_id: edit.id });
      setReviewSent(true);
    } catch (e: any) {
      setError(e.message);
    }
  }
  const did = [
    words.length > 0 && stats.timing === "clips" && L("Sous-titres calés sur votre voix", "Subtítulos sincronizados con tu voz", "Subtitles synced to your voice"),
    words.length > 0 && stats.timing === "voice" && L("Sous-titres calés sur la voix off", "Subtítulos sincronizados con la voz en off", "Subtitles synced to the voiceover"),
    words.length > 0 && stats.timing !== "clips" && stats.timing !== "voice" && L("Sous-titres tirés de votre texte (vérifiez le calage)", "Subtítulos tomados de tu texto (revisa la sincronización)", "Subtitles from your script (check the timing)"),
    stats.silences > 0 &&
      Math.round(stats.before) - Math.round(duration) >= 1 &&
      L(
        `${stats.silences} silence${stats.silences > 1 ? "s" : ""} coupé${stats.silences > 1 ? "s" : ""}, la vidéo passe de ${Math.round(stats.before)} à ${Math.round(duration)} s`,
        `${stats.silences} silencio${stats.silences > 1 ? "s" : ""} cortado${stats.silences > 1 ? "s" : ""}, el video pasa de ${Math.round(stats.before)} a ${Math.round(duration)} s`,
        `${stats.silences} silence${stats.silences > 1 ? "s" : ""} cut, the video goes from ${Math.round(stats.before)} to ${Math.round(duration)} s`,
      ),
    style.hook?.text && L("Une accroche pour les 3 premières secondes", "Un gancho para los primeros 3 segundos", "A hook for the first 3 seconds"),
    style.music?.id && L("Une musique qui baisse quand vous parlez", "Una música que baja cuando hablas", "Music that lowers when you speak"),
    L("Le style de votre marque", "El estilo de tu marca", "Your brand’s style"),
  ].filter(Boolean) as string[];
  const preview = (w = 220) => (
    <MontagePreview clips={edit.clips} clipInfo={clipInfo} keeps={keeps} words={words} style={style} duration={duration} width={w} />
  );
  const tabs: [typeof panel, string, string][] = [
    ["hook", L("Changer l’accroche", "Cambiar el gancho", "Change the hook"), L("3 propositions", "3 propuestas", "3 options")],
    ["look", L("Changer le style", "Cambiar el estilo", "Change the style"), L("Mon style · Doux · Percutant", "Mi estilo · Suave · Impactante", "My style · Soft · Bold")],
    ["word", L("Corriger un mot", "Corregir una palabra", "Fix a word"), L("Touchez le mot", "Toca la palabra", "Tap the word")],
    ["music", L("Musique", "Música", "Music"), L("Changer ou couper", "Cambiar o quitar", "Change or remove")],
  ];
  return (
    <div className="overlay">
      <section className="modal brand-montage" role="dialog" aria-modal="true" aria-label={L("Votre vidéo", "Tu video", "Your video")}>
        <button
          className="icon-button modal-x"
          disabled={phase === "rendering"}
          onClick={() => {
            cancel.current();
            onClose();
          }}
          aria-label={L("Fermer", "Cerrar", "Close")}
        >
          <X size={19} />
        </button>
        {error && (
          <div className="alert error" role="alert">
            <span>{error}</span>
          </div>
        )}
        {(phase === "analyzing" || phase === "rendering") && (
          <div className="montage-wait" role="status">
            <Loader2 className="spin" size={28} />
            <h2>{phase === "analyzing" ? L("Le studio prépare votre vidéo…", "El estudio prepara tu video…", "The studio is preparing your video…") : L("Création de votre vidéo…", "Creando tu video…", "Creating your video…")}</h2>
            <p>{progress}</p>
            <small>{L("Gardez cette page ouverte, cela prend environ une minute.", "Mantén esta página abierta, tarda alrededor de un minuto.", "Keep this page open, it takes about a minute.")}</small>
          </div>
        )}
        {phase === "error" && (
          <div className="montage-wait">
            <button className="button primary" onClick={() => setPhase("analyzing")}>
              <RefreshCw size={15} /> {L("Réessayer", "Intentar de nuevo", "Try again")}
            </button>
            {onAdvanced && (
              <button className="text-link" onClick={onAdvanced}>
                {L("Montage avancé", "Edición avanzada", "Advanced editing")}
              </button>
            )}
          </div>
        )}
        {phase === "ready" && (
          <div className="montage-step">
            <h2>{L("Votre vidéo est prête.", "Tu video está listo.", "Your video is ready.")}</h2>
            <div className="montage-center">{preview(240)}</div>
            <div className="montage-did">
              <b>{L("Le studio a fait pour vous", "El estudio hizo por ti", "The studio did this for you")}</b>
              <ul>
                {did.map((x) => (
                  <li key={x}>
                    <Check size={14} /> {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="montage-actions">
              <button className="button primary big" onClick={download}>
                <Download size={16} /> {L("Télécharger ma vidéo", "Descargar mi video", "Download my video")}
              </button>
              <button className="button secondary big" onClick={() => setPhase("retouch")}>
                {L("Faire une petite retouche", "Hacer un pequeño ajuste", "Make a small change")}
              </button>
              {onFullEditor && (
                <button className="text-link montage-advanced" onClick={onFullEditor}>
                  {L("Réglages avancés", "Ajustes avanzados", "Advanced settings")}
                </button>
              )}
              {onAdvanced && (
                <button className="text-link" onClick={onAdvanced}>
                  {L("Montage avancé (agence)", "Edición avanzada (agencia)", "Advanced editing (agency)")}
                </button>
              )}
            </div>
          </div>
        )}
        {phase === "retouch" && (
          <div className="montage-step">
            <div className="montage-topline">
              <button className="text-link" onClick={() => setPhase("ready")}>
                <ArrowLeft size={14} /> {L("Retour", "Volver", "Back")}
              </button>
              <h2>{L("Petites retouches", "Pequeños ajustes", "Small changes")}</h2>
            </div>
            <div className="montage-retouch">
              {preview(170)}
              <div className="montage-tabs">
                {tabs.map(([id, label, hint]) => (
                  <button key={id} type="button" className={panel === id ? "on" : ""} aria-pressed={panel === id} onClick={() => setPanel(id)}>
                    <b>{label}</b>
                    <span>{hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="montage-panel">
              {panel === "hook" && (
                <>
                  <b>{L("Choisissez votre accroche", "Elige tu gancho", "Pick your hook")}</b>
                  {hooks.map((h) => (
                    <button key={h} type="button" className={"montage-choice serif" + (style.hook?.text === h ? " on" : "")} onClick={() => setStyle({ ...style, hook: { ...style.hook, text: h } })}>
                      {h}
                    </button>
                  ))}
                  <button type="button" className={"montage-choice" + (!style.hook?.text ? " on" : "")} onClick={() => setStyle({ ...style, hook: { ...style.hook, text: "" } })}>
                    {L("Sans accroche", "Sin gancho", "No hook")}
                  </button>
                  <button
                    type="button"
                    className="text-link"
                    disabled={hookBusy || !data.generationReady}
                    title={data.generationReady ? undefined : L("Les propositions d’accroches par IA sont en pause pour le moment.", "Las propuestas de ganchos con IA están en pausa por ahora.", "AI hook suggestions are paused for now.")}
                    onClick={moreHooks}
                  >
                    {hookBusy ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />} {L("Proposer 3 autres accroches", "Proponer 3 ganchos más", "Suggest 3 other hooks")}
                  </button>
                </>
              )}
              {panel === "look" && (
                <>
                  <b>{L("Choisissez le style des sous-titres", "Elige el estilo de los subtítulos", "Pick the subtitle style")}</b>
                  <div className="montage-looks">
                    {(
                      [
                        ["mine", L("Mon style", "Mi estilo", "My style")],
                        ["soft", L("Doux", "Suave", "Soft")],
                        ["bold", L("Percutant", "Impactante", "Bold")],
                      ] as const
                    ).map(([id, label]) => {
                      const ls = lookStyle(id, client.config?.videoStyle);
                      const f = (FONTS as Row)[ls.font] || FONTS.sans;
                      return (
                        <button
                          key={id}
                          type="button"
                          className={look === id ? "on" : ""}
                          aria-pressed={look === id}
                          onClick={() => {
                            setLook(id);
                            setStyle(switchLook(style, id, client.config?.videoStyle));
                          }}
                        >
                          <span style={{ fontFamily: f.css, textTransform: ls.uppercase ? "uppercase" : "none", background: ls.animation === "label" ? "rgba(0,0,0,.85)" : "transparent" }}>
                            Aa <span style={{ color: ls.highlight }}>{L("mot", "palabra", "word")}</span>
                          </span>
                          <small>{label}</small>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {panel === "word" && (
                <>
                  <b>{L("Touchez un mot pour le corriger ou le colorer", "Toca una palabra para corregirla o darle color", "Tap a word to fix it or color it")}</b>
                  {!words.length && <p className="muted">{L("Aucun texte dans cette vidéo.", "No hay texto en este video.", "No text in this video.")}</p>}
                  <div className="montage-words">
                    {words.slice(0, 200).map((w, i) => (
                      <button key={i} type="button" className={sel === i ? "on" : ""} onClick={() => setSel(i)}>
                        {w.w}
                      </button>
                    ))}
                  </div>
                  {sel >= 0 && words[sel] && (
                    <div className="montage-word-edit">
                      <label>
                        {L("Corriger le mot", "Corregir la palabra", "Fix the word")}
                        <input value={words[sel].w} maxLength={40} onChange={(e) => setWordText(sel, e.target.value)} />
                      </label>
                      <div className="montage-swatches" role="group" aria-label={L("Couleur du mot", "Color de la palabra", "Word color")}>
                        {(
                          [
                            ["normal", L("Normal", "Normal", "Normal"), style.color],
                            ["yellow", L("Jaune", "Amarillo", "Yellow"), WORD_STYLES.yellow],
                            ["pink", L("Rose", "Rosa", "Pink"), WORD_STYLES.pink],
                            ["script", L("Manuscrit", "Manuscrito", "Handwritten"), null],
                          ] as const
                        ).map(([id, label, color]) => (
                          <button key={id} type="button" aria-label={label} title={label} onClick={() => setWordStyle(sel, id)} style={{ background: color || "#fff", fontFamily: id === "script" ? FONTS.script.css : undefined }}>
                            {id === "script" ? "Aa" : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              {panel === "music" && (
                <>
                  <b>{L("Musique", "Música", "Music")}</b>
                  {musicFiles.map((f) => (
                    <button key={f.id} type="button" className={"montage-choice" + (style.music?.id === f.id ? " on" : "")} onClick={() => setStyle({ ...style, music: { ...style.music, id: f.id } })}>
                      {(f.name || "").replace(/\.(mp3|m4a|aac)$/i, "")}
                    </button>
                  ))}
                  <button type="button" className={"montage-choice" + (!style.music?.id ? " on" : "")} onClick={() => setStyle({ ...style, music: { ...style.music, id: null } })}>
                    {L("Sans musique", "Sin música", "No music")}
                  </button>
                  {!musicFiles.length && (
                    <p className="muted">{L("Votre agence n’a pas encore ajouté de musiques pour votre marque.", "Tu agencia aún no ha agregado música para tu marca.", "Your agency hasn’t added music for your brand yet.")}</p>
                  )}
                </>
              )}
            </div>
            <div className="montage-intents">
              <button type="button" onClick={() => intent("dynamic")}>{L("Plus dynamique", "Más dinámico", "More dynamic")}</button>
              <button type="button" onClick={() => intent("calm")}>{L("Plus calme", "Más tranquilo", "Calmer")}</button>
              <button type="button" onClick={() => intent("shorter")}>{L("Plus court", "Más corto", "Shorter")}</button>
            </div>
            {notice && (
              <p className="montage-notice" role="status">
                {notice}
              </p>
            )}
            <button className="button primary big" onClick={download}>
              <Download size={16} /> {L("Télécharger ma vidéo", "Descargar mi video", "Download my video")}
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
            <div className="montage-review">
              <b>{L("Un doute avant de publier ?", "¿Una duda antes de publicar?", "Not sure before posting?")}</b>
              <p>{L("L’équipe Louvet & Partners relit votre vidéo et vous répond dans votre studio.", "El equipo de Louvet & Partners revisa tu video y te responde en tu estudio.", "The Louvet & Partners team reviews your video and replies in your studio.")}</p>
              {reviewSent ? (
                <p className="montage-notice" role="status">
                  {L("Demande envoyée à l’équipe.", "Solicitud enviada al equipo.", "Request sent to the team.")}
                </p>
              ) : (
                <button className="button secondary" onClick={askReview}>
                  {L("Demander à l’agence de vérifier", "Pedir a la agencia que lo revise", "Ask the agency to check it")}
                </button>
              )}
              <BookingButton client={client} hasLink={!!data.bookingUrl} />
            </div>
            <button className="text-link" onClick={onClose}>
              {L("Fermer", "Cerrar", "Close")}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
