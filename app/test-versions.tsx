"use client";
// « Versions à tester » (créatrices) : une vidéo devient 3, 5 ou 10 versions (accroche, sous-titres, musique,
// durée, premier plan, titre de couverture). Chaque version se publie en Reel d'essai ; la créatrice note les vues
// et le studio désigne la gagnante, qu'elle peut décliner à nouveau.
import "./test-versions.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, FlaskConical, Loader2, Trophy, Trash2, Sparkles, X, ArrowRight, Info } from "lucide-react";
import { useL, useLang, dateLocale, type Lang } from "../lib/i18n";
import { AddToCalendarButton } from "./add-to-calendar";
import { plainText } from "../lib/client-experience.mjs";
import {
  VERSION_COUNTS,
  AXES,
  DEFAULT_AXES,
  buildRecipes,
  describeRecipe,
  fillHooks,
  maxVersions,
  sanitizeAxes,
} from "../lib/test-versions.mjs";
import { prepareSource, moreHooks, renderVersion, type Source } from "../lib/version-render";
type Row = Record<string, any>;

async function call(path: string, body: Row) {
  const r = await fetch("/api/studio/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Studio-Request": "1" },
    body: JSON.stringify(body),
  });
  const d: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Erreur");
  return d;
}
const axisLabel = (lang: Lang, a: string) =>
  ({
    hook: ["L’accroche (3 premières secondes)", "El gancho (3 primeros segundos)", "The hook (first 3 seconds)"],
    subs: ["Le style des sous-titres", "El estilo de los subtítulos", "The subtitle style"],
    music: ["La musique", "La música", "The music"],
    duration: ["La durée (complète ou courte)", "La duración (completa o corta)", "The length (full or short)"],
    start: ["Le premier plan", "El primer plano", "The opening shot"],
    cover: ["Le titre de couverture", "El título de portada", "The cover title"],
  })[a]?.[lang === "es" ? 1 : lang === "en" ? 2 : 0] || a;

export default function TestVersions({
  data,
  client,
  refresh,
  onMode,
  canCreate = true,
}: {
  data: Row;
  client: Row;
  refresh: () => Promise<any>;
  onMode: (m: string) => void;
  canCreate?: boolean;
}) {
  const L = useL(),
    lang = useLang();
  const edits: Row[] = useMemo(
    () => (data.videoEdits || []).filter((e: Row) => (e.clips?.length || 0) > 0 || e.output_file),
    [data.videoEdits],
  );
  const musicFiles: Row[] = data.musicFiles || [];
  const batches: Row[] = data.testBatches || [];
  const [open, setOpen] = useState(batches.length === 0);
  const [sourceId, setSourceId] = useState<string>(edits[0]?.id || "");
  // Sur téléphone, 3 versions par défaut (rendu plus lent) ; 5 sur ordinateur.
  const [count, setCount] = useState(5);
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const p = typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth < 700);
    setPhone(!!p);
    if (p) setCount(3);
  }, []);
  const [axes, setAxes] = useState<string[]>(musicFiles.length ? [...DEFAULT_AXES, "music"] : DEFAULT_AXES);
  const edit = edits.find((e) => e.id === sourceId) || null;
  const [cover, setCover] = useState("");
  useEffect(() => {
    setCover(edit?.brief?.title || "");
  }, [edit?.id]);
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [step, setStep] = useState<{ at: number; of: number } | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const cancel = useRef<() => void>(() => {});
  const stopped = useRef(false);
  // Garde l'écran allumé pendant le rendu (si le navigateur le permet).
  const wake = useRef<any>(null);
  useEffect(() => {
    if (!busy) {
      try {
        wake.current?.release?.();
      } catch {}
      wake.current = null;
      return;
    }
    const nav: any = typeof navigator !== "undefined" ? navigator : null;
    if (nav?.wakeLock?.request) nav.wakeLock.request("screen").then((l: any) => (wake.current = l)).catch(() => {});
  }, [busy]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (busy) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [busy]);

  const subject = edit?.brief?.title || client.config?.creatorStrategy?.pillars?.[0] || "";
  const ctx = useMemo(
    () => ({ hooks: fillHooks(edit?.brief?.brand?.hooks || [], 10, { lang, subject }), music: musicFiles.map((m) => m.id) }),
    [edit?.id, lang, musicFiles.length],
  );
  const usable = sanitizeAxes(axes, ctx);
  const possible = maxVersions(usable, ctx);
  const preview = usable.length ? buildRecipes(count, usable, ctx) : [];

  /** Crée la série puis rend chaque version, une à la fois. */
  async function launch({ fromVersion, batchSource }: { fromVersion?: Row; batchSource?: Row } = {}) {
    const srcEdit = batchSource ? edits.find((e) => e.id === batchSource.source_edit_id) || null : edit;
    const clips: string[] = batchSource?.clips?.length ? batchSource.clips : srcEdit?.clips?.length ? srcEdit.clips : srcEdit?.output_file ? [srcEdit.output_file] : [];
    if (!clips.length) return setError(L("Choisissez une vidéo.", "Elige un video.", "Choose a video."));
    const n = fromVersion ? 5 : count;
    const chosen = fromVersion ? batchSource?.axes || usable : usable;
    setBusy(true);
    setError("");
    setMessage("");
    stopped.current = false;
    let batchId = "";
    try {
      setStep(null);
      const source: Source = await prepareSource({
        edit: srcEdit && srcEdit.clips?.length ? srcEdit : null,
        clips,
        client,
        musicFiles,
        lang,
        update: setProgress,
        register: (c) => (cancel.current = c),
      });
      setProgress(L("Écriture des accroches…", "Escribiendo los ganchos…", "Writing the hooks…"));
      const hooks = chosen.includes("hook") ? await moreHooks(srcEdit?.clips?.length ? srcEdit.id : null, source.hooks, n) : source.hooks;
      const created = await call("test-batch-create", {
        client_id: client.id,
        source: srcEdit?.clips?.length ? { edit_id: srcEdit.id } : { file_id: clips[0] },
        count: n,
        axes: chosen,
        hooks,
        music: musicFiles.map((m) => m.id),
        lang,
        subject: srcEdit?.brief?.title || "",
        title: (fromVersion ? batchSource?.title : cover) || srcEdit?.brief?.title || "",
        parent_version_id: fromVersion?.id,
      });
      batchId = created.id;
      const title = (fromVersion ? batchSource?.title : cover) || "";
      for (let i = 0; i < created.versions.length; i++) {
        if (stopped.current) break;
        const v = created.versions[i];
        setStep({ at: i + 1, of: created.versions.length });
        await renderVersion({
          source,
          version: v,
          client,
          coverTitle: title,
          lang,
          update: setProgress,
          register: (c) => (cancel.current = c),
        });
      }
      setMessage(
        L(
          "Vos versions sont prêtes. Publiez-les en Reels d’essai, puis notez les vues après 48 h.",
          "Tus versiones están listas. Publícalas como Reels de prueba y anota las vistas después de 48 h.",
          "Your versions are ready. Post them as trial Reels, then enter the views after 48 h.",
        ),
      );
      setOpen(false);
    } catch (e: any) {
      if (batchId) await call("test-batch-stop", { batch_id: batchId }).catch(() => {});
      if (!stopped.current) setError(plainText(e.message || L("Le rendu a été interrompu.", "El render se interrumpió.", "Rendering was interrupted.")));
    } finally {
      if (stopped.current && batchId) await call("test-batch-stop", { batch_id: batchId }).catch(() => {});
      setBusy(false);
      setStep(null);
      setProgress("");
      await refresh();
    }
  }
  function stop() {
    stopped.current = true;
    try {
      cancel.current();
    } catch {}
    setMessage(L("Rendu arrêté. Les versions déjà prêtes sont gardées.", "Render detenido. Las versiones listas se conservan.", "Rendering stopped. Finished versions are kept."));
  }

  return (
    <section className="tv">
      <div className="tv-intro">
        <div className="tv-intro-icon" aria-hidden="true">
          <FlaskConical size={22} />
        </div>
        <div>
          <h2>{L("Une vidéo, plusieurs versions. Gardez la meilleure.", "Un video, varias versiones. Quédate con la mejor.", "One video, several versions. Keep the best one.")}</h2>
          <p>
            {L(
              "Publiez chaque version en Reel d’essai sur Instagram : elles sont montrées à des personnes qui ne vous suivent pas, sans apparaître sur votre profil. Gardez la meilleure.",
              "Publica cada versión como Reel de prueba en Instagram: se muestran a personas que no te siguen, sin aparecer en tu perfil. Quédate con la mejor.",
              "Post each version as a trial Reel on Instagram: they’re shown to people who don’t follow you, without appearing on your profile. Keep the best one.",
            )}
          </p>
        </div>
      </div>

      {error && (
        <div className="alert error" role="alert">
          <span>{error}</span>
          <button className="icon-button" onClick={() => setError("")} aria-label={L("Fermer", "Cerrar", "Close")}>
            <X size={16} />
          </button>
        </div>
      )}
      {message && !busy && (
        <div className="video-message" role="status">
          <Check size={15} />
          <span>{message}</span>
          <button className="icon-button" onClick={() => setMessage("")} aria-label={L("Fermer", "Cerrar", "Close")}>
            <X size={14} />
          </button>
        </div>
      )}

      {busy && (
        <div className="tv-progress" role="status" aria-live="polite">
          <Loader2 size={20} className="spin" />
          <div>
            <b>
              {step
                ? L(`Version ${step.at} sur ${step.of}…`, `Versión ${step.at} de ${step.of}…`, `Version ${step.at} of ${step.of}…`)
                : L("Préparation de votre vidéo…", "Preparando tu video…", "Preparing your video…")}
            </b>
            <span>{progress}</span>
            {step && (
              <div className="tv-bar" aria-hidden="true">
                <i style={{ width: ((step.at - 1) / step.of) * 100 + "%" }} />
              </div>
            )}
            <small>
              {L(
                "Laissez cette page ouverte et l’écran allumé pendant la création des versions.",
                "Deja esta página abierta y la pantalla encendida mientras se crean las versiones.",
                "Keep this page open and the screen on while the versions are being created.",
              )}
            </small>
          </div>
          <button className="button secondary" onClick={stop}>
            {L("Arrêter", "Detener", "Stop")}
          </button>
        </div>
      )}

      {!busy && (
        <div className="tv-new">
          {!open ? (
            <button className="button primary" disabled={!canCreate} onClick={() => setOpen(true)}>
              <Sparkles size={16} /> {L("Créer des versions à tester", "Crear versiones de prueba", "Create test versions")}
            </button>
          ) : !edits.length ? (
            <div className="tv-empty">
              <p>
                {L(
                  "Ajoutez d’abord une vidéo dans « Mes vidéos » : le studio en fera plusieurs versions.",
                  "Primero agrega un video en “Mis videos”: el estudio hará varias versiones.",
                  "First add a video in “My videos”: the studio will turn it into several versions.",
                )}
              </p>
              <button className="button primary" onClick={() => onMode("montage")}>
                {L("Aller à Mes vidéos", "Ir a Mis videos", "Go to My videos")} <ArrowRight size={15} />
              </button>
            </div>
          ) : (
            <div className="tv-form">
              <div className="tv-field">
                <span className="tv-step">1</span>
                <div>
                  <b>{L("Votre vidéo", "Tu video", "Your video")}</b>
                  <div className="tv-sources">
                    {edits.slice(0, 12).map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        className={"tv-source " + (e.id === sourceId ? "on" : "")}
                        aria-pressed={e.id === sourceId}
                        onClick={() => setSourceId(e.id)}
                      >
                        <video preload="metadata" muted playsInline src={"/api/studio/file/" + (e.output_file || e.clips?.[0]) + "#t=0.5"} />
                        <span>{e.brief?.title || L("Ma vidéo", "Mi video", "My video")}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="tv-field">
                <span className="tv-step">2</span>
                <div>
                  <b>{L("Combien de versions ?", "¿Cuántas versiones?", "How many versions?")}</b>
                  <div className="tv-counts" role="radiogroup">
                    {VERSION_COUNTS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={count === n}
                        className={"tv-count " + (count === n ? "on" : "")}
                        disabled={n > possible}
                        onClick={() => setCount(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <small className="muted">
                    {phone
                      ? L(
                          "Sur téléphone, comptez 2 à 3 minutes par version. Gardez le studio ouvert et l’écran allumé.",
                          "En el teléfono, calcula de 2 a 3 minutos por versión. Mantén el estudio abierto y la pantalla encendida.",
                          "On a phone, allow 2 to 3 minutes per version. Keep the studio open and the screen on.",
                        )
                      : L(
                          "5 versions suffisent souvent pour trouver la bonne accroche. Comptez environ une minute par version sur ordinateur.",
                          "Con 5 versiones suele bastar para encontrar el buen gancho. Calcula un minuto por versión en computadora.",
                          "5 versions are usually enough to find the right hook. Allow about a minute per version on a computer.",
                        )}
                  </small>
                </div>
              </div>
              <div className="tv-field">
                <span className="tv-step">3</span>
                <div>
                  <b>{L("Ce qui change d’une version à l’autre", "Lo que cambia de una versión a otra", "What changes between versions")}</b>
                  <div className="tv-axes">
                    {AXES.map((a) => {
                      const off = a === "music" && !musicFiles.length;
                      return (
                        <label key={a} className={off ? "off" : ""}>
                          <input
                            type="checkbox"
                            disabled={off}
                            checked={!off && axes.includes(a)}
                            onChange={(ev) => setAxes(ev.target.checked ? [...axes, a] : axes.filter((x) => x !== a))}
                          />
                          <span>
                            {axisLabel(lang, a)}
                            {off && <small> · {L("ajoutez une musique dans le studio", "agrega una música en el estudio", "add music in the studio")}</small>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {axes.includes("cover") && (
                    <label className="tv-cover">
                      <span>{L("Titre de couverture", "Título de portada", "Cover title")}</span>
                      <input value={cover} maxLength={40} onChange={(e) => setCover(e.target.value)} placeholder={L("Ex. : Ma routine du matin", "Ej.: Mi rutina de la mañana", "E.g. My morning routine")} />
                    </label>
                  )}
                </div>
              </div>
              {preview.length > 0 && (
                <ol className="tv-preview" aria-label={L("Aperçu des versions", "Vista previa de las versiones", "Versions preview")}>
                  {preview.map((r) => (
                    <li key={r.label}>
                      <span className="tv-label">{r.label}</span>
                      <span>{describeRecipe(r, lang, ctx)}</span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="tv-note">
                <Info size={14} />{" "}
                {data.generationReady
                  ? L("Les accroches définitives sont écrites au lancement.", "Los ganchos definitivos se escriben al iniciar.", "Final hooks are written when you start.")
                  : L("Accroches proposées par le studio : vous pourrez tester les vôtres dans l’éditeur.", "Ganchos propuestos por el estudio: podrás probar los tuyos en el editor.", "Hooks suggested by the studio: you can try your own in the editor.")}
              </p>
              <div className="tv-actions">
                <button className="button primary" disabled={!canCreate || !edit || preview.length < 2} onClick={() => launch()}>
                  <Sparkles size={16} />{" "}
                  {L(`Créer les ${preview.length} versions`, `Crear las ${preview.length} versiones`, `Create the ${preview.length} versions`)}
                </button>
                {batches.length > 0 && (
                  <button className="text-link" onClick={() => setOpen(false)}>
                    {L("Annuler", "Cancelar", "Cancel")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {batches.map((b) => (
        <Batch key={b.id} batch={b} busy={busy} onRefresh={refresh} onAgain={(v) => launch({ fromVersion: v, batchSource: b })} canCreate={canCreate} />
      ))}
      <p className="tv-soon">
        {L(
          "Bientôt : récupération automatique des statistiques quand Instagram sera connecté.",
          "Próximamente: estadísticas automáticas cuando Instagram esté conectado.",
          "Coming soon: automatic stats once Instagram is connected.",
        )}
      </p>
    </section>
  );
}

function Batch({ batch, busy, onRefresh, onAgain, canCreate }: { batch: Row; busy: boolean; onRefresh: () => Promise<any>; onAgain: (v: Row) => void; canCreate: boolean }) {
  const L = useL(),
    lang = useLang();
  const [error, setError] = useState("");
  const ready = batch.versions.filter((v: Row) => v.file_id);
  const winner = batch.versions.find((v: Row) => v.winner);
  const suggested = batch.versions.find((v: Row) => v.label === batch.suggested);
  const date = new Date(batch.created).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "long" });
  async function act(path: string, body: Row) {
    setError("");
    try {
      await call(path, body);
      await onRefresh();
    } catch (e: any) {
      setError(plainText(e.message));
    }
  }
  function downloadAll() {
    ready.forEach((v: Row, i: number) =>
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = "/api/studio/file/" + v.file_id + "?download";
        a.download = `version-${v.label}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 900),
    );
  }
  return (
    <article className="tv-batch">
      <header>
        <div>
          <h3>{batch.title || L("Mes versions", "Mis versiones", "My versions")}</h3>
          <small className="muted">
            {date} · {L(`${ready.length} versions`, `${ready.length} versiones`, `${ready.length} versions`)}
            {batch.status === "rendering" && " · " + L("création en cours", "creación en curso", "being created")}
          </small>
        </div>
        <div className="tv-batch-actions">
          {ready.length > 1 && (
            <button className="button secondary" onClick={downloadAll}>
              <Download size={15} /> {L("Tout télécharger", "Descargar todo", "Download all")}
            </button>
          )}
          <button
            className="icon-button"
            disabled={busy}
            aria-label={L("Supprimer cette série", "Eliminar esta serie", "Delete this set")}
            title={L("Supprimer cette série", "Eliminar esta serie", "Delete this set")}
            onClick={() => {
              if (window.confirm(L("Supprimer ces versions ?", "¿Eliminar estas versiones?", "Delete these versions?"))) act("test-batch-delete", { batch_id: batch.id });
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>
      {error && (
        <div className="alert error" role="alert">
          <span>{error}</span>
        </div>
      )}
      {winner ? (
        <div className="tv-winner-box">
          <Trophy size={18} />
          <div>
            <b>{L(`Version ${winner.label} gardée`, `Versión ${winner.label} elegida`, `Version ${winner.label} kept`)}</b>
            <span>{describeRecipe(winner.recipe, lang, { music: batch.music })}</span>
          </div>
          <div className="tv-winner-actions">
            <AddToCalendarButton kind="video" id={winner.file_id} />
            <button className="button primary" disabled={busy || !canCreate} onClick={() => onAgain(winner)}>
              <Sparkles size={15} /> {L("Créer 5 nouvelles versions à partir de la gagnante", "Crear 5 nuevas versiones a partir de la ganadora", "Create 5 new versions from the winner")}
            </button>
          </div>
        </div>
      ) : suggested ? (
        <div className="tv-winner-box suggest">
          <Trophy size={18} />
          <div>
            <b>
              {batch.tie
                ? L(`Égalité : la version ${suggested.label} passe devant de peu`, `Empate: la versión ${suggested.label} va apenas adelante`, `Tie: version ${suggested.label} is just ahead`)
                : L(`La version ${suggested.label} gagne`, `La versión ${suggested.label} gana`, `Version ${suggested.label} wins`)}
            </b>
            <span>
              {L(
                "Meilleur score : vues + j’aime + 2 × partages + 3 × enregistrements.",
                "Mejor puntuación: vistas + me gusta + 2 × compartidos + 3 × guardados.",
                "Best score: views + likes + 2 × shares + 3 × saves.",
              )}
            </span>
          </div>
          <button className="button primary" onClick={() => act("test-version-winner", { version_id: suggested.id })}>
            <Check size={15} /> {L("Garder la gagnante", "Quedarme con la ganadora", "Keep the winner")}
          </button>
        </div>
      ) : (
        ready.length > 1 && (
          <p className="tv-hint">
            {L(
              "Notez les vues après 48 h : dès deux versions notées, le studio vous dit laquelle garder.",
              "Anota las vistas después de 48 h: con dos versiones anotadas, el estudio te dice cuál conservar.",
              "Enter the views after 48 h: once two versions have numbers, the studio tells you which one to keep.",
            )}
          </p>
        )
      )}
      <div className="tv-grid">
        {batch.versions.map((v: Row) => (
          <VersionCard key={v.id} v={v} music={batch.music} best={v.label === (winner?.label || batch.suggested)} onSaved={onRefresh} />
        ))}
      </div>
    </article>
  );
}

function VersionCard({ v, music, best, onSaved }: { v: Row; music: string[]; best: boolean; onSaved: () => Promise<any> }) {
  const L = useL(),
    lang = useLang();
  const [m, setM] = useState({ views: v.views ?? "", likes: v.likes ?? "", saves: v.saves ?? "", shares: v.shares ?? "" });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    setM({ views: v.views ?? "", likes: v.likes ?? "", saves: v.saves ?? "", shares: v.shares ?? "" });
  }, [v.views, v.likes, v.saves, v.shares]);
  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const num = (x: any) => (x === "" ? null : Number(x));
      await call("test-version-metrics", { version_id: v.id, views: m.views === "" ? "" : Number(m.views), likes: num(m.likes), saves: num(m.saves), shares: num(m.shares) });
      setSaved(true);
      await onSaved();
    } catch (e: any) {
      setError(plainText(e.message));
    } finally {
      setBusy(false);
    }
  }
  const field = (k: "views" | "likes" | "saves" | "shares", label: string) => (
    <label>
      <span>{label}</span>
      <input inputMode="numeric" pattern="[0-9]*" value={m[k]} onChange={(e) => setM({ ...m, [k]: e.target.value.replace(/[^0-9]/g, "") })} />
    </label>
  );
  return (
    <div className={"tv-card " + (best ? "best " : "") + (v.winner ? "winner" : "")}>
      <div className="tv-card-media">
        {v.file_id ? (
          <video controls playsInline preload="metadata" src={"/api/studio/file/" + v.file_id + "#t=0.4"} />
        ) : (
          <div className="tv-card-wait">
            <Loader2 size={18} className="spin" />
          </div>
        )}
        <span className="tv-label big">{v.label}</span>
        {best && (
          <span className="tv-badge">
            <Trophy size={12} /> {v.winner ? L("Gardée", "Elegida", "Kept") : L("Gagnante", "Ganadora", "Winner")}
          </span>
        )}
      </div>
      <p className="tv-desc">{describeRecipe(v.recipe, lang, { music })}</p>
      {v.file_id && (
        <>
          <div className="tv-card-actions">
            <a className="button secondary" href={"/api/studio/file/" + v.file_id + "?download"} download={`version-${v.label}.mp4`}>
              <Download size={15} /> {L("Télécharger", "Descargar", "Download")}
            </a>
            <AddToCalendarButton kind="video" id={v.file_id} />
          </div>
          <div className="tv-metrics">
            <b>{L("Résultats (après 48 h)", "Resultados (después de 48 h)", "Results (after 48 h)")}</b>
            <div className="tv-metric-grid">
              {field("views", L("Vues *", "Vistas *", "Views *"))}
              {field("likes", L("J’aime", "Me gusta", "Likes"))}
              {field("saves", L("Enregistrements", "Guardados", "Saves"))}
              {field("shares", L("Partages", "Compartidos", "Shares"))}
            </div>
            {v.score !== null && v.score !== undefined && (
              <div className="tv-score" aria-label={L(`Score ${v.score} sur 100`, `Puntuación ${v.score} de 100`, `Score ${v.score} out of 100`)}>
                <i style={{ width: v.score + "%" }} />
                <span>{v.score}/100</span>
              </div>
            )}
            {error && <p className="field-error">{error}</p>}
            <button className="button secondary small" disabled={busy || m.views === ""} onClick={save}>
              {busy ? <Loader2 size={14} className="spin" /> : saved ? <Check size={14} /> : null}{" "}
              {saved ? L("Enregistré", "Guardado", "Saved") : L("Enregistrer", "Guardar", "Save")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
