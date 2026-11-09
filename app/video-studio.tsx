"use client";
import { VIDEO_MAX_BYTES, videoTooBig } from "../lib/video-limits";
import FilmingGuide from "./filming-guide";
import { ShotButton, shotProgress } from "./shot-bank";
import { AddToCalendarButton } from "./add-to-calendar";
import { plainText, filmingGuide } from "../lib/client-experience.mjs";
import { isCreator } from "../lib/workspaces.mjs";
import { renderVideo } from "../lib/browser-render";
import { VOICE_SCRIPT_MAX } from "../lib/video-render.mjs";
import { uploadStudioMedia } from "../lib/direct-upload-client";
import BrandMontage from "./brand-montage";
import CreatorEditor from "./creator-editor";
import { useEffect, useRef, useState } from "react";
import { useL, useLang, pick, dateLocale, type Lang } from "../lib/i18n";
import {
  Video,
  CalendarDays,
  ArrowRight,
  Check,
  Upload,
  Scissors,
  Loader2,
  Download,
  Plus,
  Copy,
  X,
  Film,
  Clock,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
type Row = Record<string, any>;
const statusLabels: Record<string, [string, string, string]> = {
  planned: ["À tourner", "Por grabar", "To film"],
  filmed: ["Tournée", "Grabada", "Filmed"],
  editing: ["Montage demandé", "Edición solicitada", "Edit requested"],
  published: ["Publiée", "Publicada", "Published"],
  requested: ["Demande reçue", "Solicitud recibida", "Request received"],
  rendering: ["Montage en cours", "Edición en curso", "Editing in progress"],
  render_failed: ["Montage à reprendre", "Edición por repetir", "Edit needs a retry"],
  review: ["Vérification par l’agence", "Revisión de la agencia", "Agency check"],
  completed: ["Prête", "Listo", "Ready"],
};
const statusName = (lang: Lang, s: string) => (statusLabels[s] ? pick(lang, ...statusLabels[s]) : s);
async function call(path: string, body?: any) {
  const response = await fetch("/api/studio/" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json", "X-Studio-Request": "1" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const d: any = await response.json();
  if (!response.ok) throw new Error(d.error);
  return d;
}
const monthName = (m: string, lang: Lang = "fr") =>
  new Date(m + "-15T12:00:00").toLocaleDateString(dateLocale(lang), {
    month: "long",
    year: "numeric",
  });
const dateLabel = (d: string, lang: Lang = "fr") =>
  new Date(d + "T12:00:00").toLocaleDateString(dateLocale(lang), {
    day: "numeric",
    month: "short",
  });
export function OccasionPicker({
  events,
  chosen,
  onChoose,
  admin,
  onAdd,
}: {
  events: Row[];
  chosen: string;
  onChoose: (id: string) => void;
  admin: boolean;
  onAdd: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const L = useL(),
    lang = useLang();
  const selected = events?.find((x) => x.id === chosen);
  const Wrapper = admin ? "section" : "details";
  return (
    <Wrapper className="occasion-box">
      {!admin && (
        <summary>
          {L(
            "Une fête ou une date à utiliser ? (facultatif)",
            "¿Una fiesta o fecha para usar? (opcional)",
            "A holiday or date to use? (optional)",
          )}
        </summary>
      )}
      <div className="section-heading">
        <span className="mini-label">
          <CalendarDays size={14} />
          {L("LES DATES À FÊTER", "FECHAS PARA CELEBRAR", "DATES TO CELEBRATE")}
        </span>
        {admin && (
          <button className="text-link" onClick={onAdd}>
            <Plus size={13} />
            Une date
          </button>
        )}
      </div>
      <p>
        {L(
          "Vous pouvez choisir une fête pour inspirer votre photo. Ce n’est pas obligatoire.",
          "Puedes elegir una fiesta para inspirar tu foto. No es obligatorio.",
          "You can pick a holiday to inspire your photo. It’s optional.",
        )}
      </p>
      <div className="occasion-options">
        <button className={!chosen ? "selected" : ""} onClick={() => onChoose("")}>
          {L("Sans occasion", "Sin ocasión", "No occasion")}
        </button>
        {(expanded ? events : events?.slice(0, 5))?.map((e) => (
          <button key={e.id} className={e.id === chosen ? "selected" : ""} onClick={() => onChoose(e.id)}>
            <span>{dateLabel(e.date, lang)}</span>
            {e.title}
          </button>
        ))}
      </div>
      {events?.length > 5 && (
        <button className="text-link" onClick={() => setExpanded(!expanded)}>
          {expanded
            ? L("Réduire", "Ver menos", "Show less")
            : L(
                "Voir les " + events.length + " occasions à venir",
                "Ver las " + events.length + " próximas ocasiones",
                "See all " + events.length + " upcoming occasions",
              )}
          <ChevronDown size={13} />
        </button>
      )}
      {selected && (
        <div className="occasion-angle">
          <b>{selected.title}</b>
          <p>{plainText(selected.angle)}</p>
          <small>
            {L(
              "Le studio utilisera cette fête pour préparer votre image.",
              "El estudio usará esta fiesta para preparar tu imagen.",
              "The studio will use this occasion to prepare your image.",
            )}
          </small>
        </div>
      )}
    </Wrapper>
  );
}
export default function VideoStudio({
  data,
  client,
  agency,
  mode,
  onMode,
  refresh,
  canCreate = true,
}: {
  data: Row;
  client: Row;
  agency: boolean;
  mode: string;
  onMode: (m: string) => void;
  refresh: () => Promise<any>;
  canCreate?: boolean;
}) {
  const creator = isCreator(client.config);
  // Marques : montage automatique guidé (aperçu, 4 retouches, téléchargement). Créatrices : éditeur complet.
  const brandFlow = !creator;
  const [brandEdit, setBrandEdit] = useState<Row | null>(null);
  // Éditeur complet : créatrices, ou marque dont l'agence a activé les « Réglages avancés ».
  const [fullEdit, setFullEdit] = useState<Row | null>(null);
  const autoSeen = useRef<Set<string>>(new Set());
  const openEdit = (e: Row) => (brandFlow ? setBrandEdit(e) : setFullEdit(e));
  const L = useL(),
    lang = useLang();
  const [month, setMonth] = useState(data.editorialMonth),
    [ideas, setIdeas] = useState<Row[]>(data.videoIdeas || []),
    [filter, setFilter] = useState("all"),
    [focus, setFocus] = useState<Row | null>(null),
    [editForm, setEditForm] = useState<Row | null>(null);
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [request, setRequest] = useState<Row | null>(null),
    [clips, setClips] = useState<string[]>([]),
    [uploading, setUploading] = useState(false);
  const [renderEdit, setRenderEdit] = useState<Row | null>(null),
    [renderBusy, setRenderBusy] = useState(false),
    [renderProgress, setRenderProgress] = useState(""),
    [renderExtras, setRenderExtras] = useState<{
      subtitles?: File | null;
      logo?: File | null;
      music?: File | null;
    }>({}),
    [rendered, setRendered] = useState<{
      job: string;
      file: File;
      url: string;
    } | null>(null),
    // Voix off générée et sous-titres automatiques.
    [voiceScript, setVoiceScript] = useState(""),
    [voiceChoice, setVoiceChoice] = useState("warm"),
    [voiceBusy, setVoiceBusy] = useState(false),
    [useVoice, setUseVoice] = useState(false),
    [autoSubs, setAutoSubs] = useState(false),
    [subText, setSubText] = useState(""),
    voiceKey = useRef(crypto.randomUUID());
  const cancelRender = useRef<() => void>(() => {});
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("studio-render-busy", {
        detail: renderBusy || !!rendered,
      }),
    );
    return () => {
      window.dispatchEvent(new CustomEvent("studio-render-busy", { detail: false }));
    };
  }, [renderBusy, rendered]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (renderBusy || rendered) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [renderBusy, rendered]);
  const requestKey = useRef(crypto.randomUUID());
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setMonth(data.editorialMonth);
    setIdeas(data.videoIdeas || []);
    setClips([]);
    setFocus(null);
    setRequest(null);
    // À partir du 20, le client voit directement les idées du mois suivant.
    if (!agency && data.upcomingMonth) loadMonth(data.upcomingMonth);
  }, [client.id]);
  useEffect(() => {
    if (month === data.editorialMonth) setIdeas(data.videoIdeas || []);
  }, [data, month]);
  const activeClips = data.files.filter((f: Row) => f.purpose === "video_original");
  async function loadMonth(m: string) {
    setBusy(true);
    setError("");
    try {
      const d = await call("ideas?client=" + encodeURIComponent(client.id) + "&month=" + m);
      setIdeas(d.videoIdeas);
      setMonth(m);
      setFocus(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function act(path: string, body: Row, success: string) {
    setBusy(true);
    setError("");
    try {
      const d = await call(path, body);
      await refresh();
      if (month !== data.editorialMonth) await loadMonth(month);
      setMessage(success);
      return d;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  function startRequest(idea?: Row) {
    if (!canCreate) {
      setError(
        L(
          "Pour créer une nouvelle vidéo, régularisez votre abonnement. Vos vidéos existantes sont conservées.",
          "Para crear un nuevo video, regulariza tu suscripción. Tus videos existentes se conservan.",
          "To create a new video, please bring your subscription up to date. Your existing videos are kept.",
        ),
      );
      return;
    }
    setRequest({
      style_id: "",
      idea_id: idea?.id || "",
      title:
        idea?.content.title ||
        L("Ma vidéo du ", "Mi video del ", "My video from ") +
          new Date().toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short" }),
      instructions: idea?.content.scenes.join("\n") || "",
      format: "9:16",
      duration: 30,
      subtitles: false,
      language: idea?.content.language || client.config.language || "es",
    });
    setClips([]);
    requestKey.current = crypto.randomUUID();
  }
  async function upload(files: FileList | null, outputId?: string) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files).slice(0, outputId ? 1 : 6)) {
        if (file.size > VIDEO_MAX_BYTES) throw new Error(videoTooBig(lang));
        const d = await uploadStudioMedia(file, {
          kind: outputId ? "video-output" : "video",
          client_id: client.id,
          edit_id: outputId,
        });
        if (!outputId) setClips((old) => [...old, d.id].slice(-6));
      }
      await refresh();
      setMessage(
        outputId
          ? L(
              "Vidéo montée enregistrée. La version précédente est conservée.",
              "Video editado guardado. La versión anterior se conserva.",
              "Edited video saved. The previous version is kept.",
            )
          : L(
              "Vos petites vidéos sont enregistrées dans votre espace privé.",
              "Tus videos cortos están guardados en tu espacio privado.",
              "Your short videos are saved in your private space.",
            ),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }
  async function saveRendered(output: { job: string; file: File; url: string }) {
    setRenderBusy(true);
    setError("");
    try {
      setRenderProgress(
        L("Enregistrement de la vidéo finale…", "Guardando el video final…", "Saving your final video…"),
      );
      const d = await uploadStudioMedia(output.file, {
        kind: "render-output",
        client_id: client.id,
        render_id: output.job,
      });
      await refresh();
      URL.revokeObjectURL(output.url);
      setRendered(null);
      setRenderEdit(null);
      setMessage(
        d.status === "completed"
          ? L(
              "Votre vidéo finale est enregistrée et disponible.",
              "Tu video final está guardado y disponible.",
              "Your final video is saved and ready.",
            )
          : L(
              "Votre vidéo est enregistrée, en attente de validation par l’agence.",
              "Tu video está guardado, en espera de validación de la agencia.",
              "Your video is saved and waiting for the agency’s approval.",
            ),
      );
    } catch (e: any) {
      setError(
        e.message +
          " " +
          L(
            "Le MP4 reste téléchargeable ici. Vous pouvez reprendre son enregistrement.",
            "Puedes descargar el MP4 aquí y volver a intentar guardarlo.",
            "You can still download the MP4 here and try saving it again.",
          ),
      );
    } finally {
      setRenderBusy(false);
    }
  }
  async function launchRender() {
    if (!renderEdit || !canCreate) return;
    setRenderBusy(true);
    setError("");
    let job: Row | null = null;
    try {
      job = await call("video-render-start", {
        edit_id: renderEdit.id,
        new_version: !!renderEdit.output_file,
        extras: {
          subtitles: !!renderExtras.subtitles,
          autoSubtitles: autoSubs && !renderExtras.subtitles && !!subtitleSource().trim(),
          voice: useVoice && !!renderEdit.brief.voice?.file_id,
          logo: !!renderExtras.logo,
          music: !!renderExtras.music,
        },
      });
      const timer = window.setInterval(() => {
        call("video-render-heartbeat", { render_id: job!.id }).catch(() => {});
      }, 60000);
      let file: File;
      try {
        file = await renderVideo(
          job,
          {
            ...renderExtras,
            autoSubtitleText: autoSubs && !renderExtras.subtitles ? subtitleSource() : "",
          },
          setRenderProgress,
          (cancel) => {
            cancelRender.current = cancel;
          },
          lang,
        );
      } finally {
        window.clearInterval(timer);
      }
      const output = { job: job!.id, file, url: URL.createObjectURL(file) };
      setRendered(output);
      await saveRendered(output);
    } catch (e: any) {
      setError(
        e.message || L("Le montage a été interrompu.", "La edición se interrumpió.", "The edit was interrupted."),
      );
      if (job)
        await call("video-render-fail", {
          render_id: job.id,
          error: e.message || "Montage interrompu.",
        }).catch(() => {});
      await refresh();
    } finally {
      setRenderBusy(false);
    }
  }
  // Texte des sous-titres automatiques : celui de la voix off si elle est utilisée, sinon le texte saisi.
  function subtitleSource() {
    return useVoice && renderEdit?.brief.voice?.script ? renderEdit.brief.voice.script : subText;
  }
  async function createVoice() {
    if (!renderEdit) return;
    setVoiceBusy(true);
    setError("");
    try {
      const d = await call("video-voice", {
        edit_id: renderEdit.id,
        script: voiceScript,
        voice: voiceChoice,
        request_key: voiceKey.current,
      });
      voiceKey.current = crypto.randomUUID();
      setRenderEdit({
        ...renderEdit,
        brief: { ...renderEdit.brief, voice: d.voice },
      });
      setUseVoice(true);
      setMessage(
        L(
          "Votre voix off est prête. Écoutez-la avant de créer la vidéo.",
          "Tu voz en off está lista. Escúchala antes de crear el video.",
          "Your voiceover is ready. Listen to it before creating the video.",
        ),
      );
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setVoiceBusy(false);
    }
  }
  function openRender(e: Row) {
    setRenderEdit(e);
    setRenderExtras({});
    const script = e?.brief?.voice?.script || e?.brief?.script || "";
    setVoiceScript(script.slice(0, VOICE_SCRIPT_MAX));
    setVoiceChoice(e?.brief?.voice?.voice || "warm");
    setUseVoice(!!e?.brief?.voice?.file_id);
    setAutoSubs(!!e?.brief?.renderRequirements?.subtitles);
    setSubText((e?.brief?.script || "").slice(0, VOICE_SCRIPT_MAX));
    voiceKey.current = crypto.randomUUID();
    setError("");
    setRendered(null);
    setRenderProgress("");
  }
  async function submit(automatic = false) {
    if (!request) return;
    const result = await act(
      "video-request",
      {
        ...request,
        client_id: client.id,
        title:
          request.title?.trim() ||
          L("Ma vidéo du ", "Mi video del ", "My video from ") +
            new Date().toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short" }),
        clips,
        request_key: requestKey.current,
      },
      L(
        "Votre demande de montage est enregistrée.",
        "Tu solicitud de edición está registrada.",
        "Your edit request is saved.",
      ),
    );
    if (result) {
      setRequest(null);
      setClips([]);
      onMode("montage");
      if (automatic) {
        const latest = await call("state?client=" + encodeURIComponent(client.id));
        openEdit(latest.videoEdits.find((e: Row) => e.id === result.id));
      }
    }
  }
  // Montage automatique : les vidéos dont tous les plans sont filmés se montent dès que l’onglet Montage est ouvert.
  const [autoRun, setAutoRun] = useState<string | null>(null);
  const autoQueue: Row[] =
    mode === "montage" && canCreate
      ? (data.videoEdits || []).filter(
          (e: Row) => e.brief?.auto_assembled && e.status === "requested" && !e.output_file,
        )
      : [];
  useEffect(() => {
    const next = autoQueue.find((e) => !autoSeen.current.has(e.id));
    if (next && !brandEdit && !fullEdit && !renderEdit) {
      autoSeen.current.add(next.id);
      if (brandFlow) setBrandEdit(next);
      else setFullEdit(next);
    }
  }, [autoQueue.map((e) => e.id).join(","), renderEdit?.id, brandEdit?.id, fullEdit?.id]);
  useEffect(() => {
    if (autoRun && renderEdit?.id === autoRun && !renderBusy) {
      setAutoRun(null);
      launchRender();
    }
  }, [autoRun, renderEdit?.id]);
  const selectedIdea = focus ? ideas.find((x) => x.id === focus.id) || focus : null;
  return (
    <section className="video-hub">
      {brandEdit && (
        <BrandMontage
          key={brandEdit.id}
          edit={brandEdit}
          client={client}
          data={data}
          refresh={refresh}
          onClose={() => {
            setBrandEdit(null);
            refresh();
          }}
          onAdvanced={
            agency
              ? () => {
                  const e = brandEdit;
                  setBrandEdit(null);
                  openRender(e);
                }
              : undefined
          }
          onFullEditor={
            client.config?.advancedEditor === true
              ? () => {
                  const e = brandEdit;
                  setBrandEdit(null);
                  setFullEdit(e);
                }
              : undefined
          }
        />
      )}
      {fullEdit && (
        <CreatorEditor
          key={fullEdit.id}
          edit={fullEdit}
          client={client}
          data={data}
          mode={creator ? "creator" : "brand"}
          refresh={refresh}
          onClose={() => {
            setFullEdit(null);
            refresh();
          }}
        />
      )}
      {error && (
        <div className="alert error" role="alert">
          <span>{agency ? error : plainText(error)}</span>
          <button className="icon-button" onClick={() => setError("")} aria-label={L("Fermer", "Cerrar", "Close")}>
            <X size={16} />
          </button>
        </div>
      )}
      {message && (
        <div className="video-message" role="status">
          <Check size={15} />
          <span>{message}</span>
          <button className="icon-button" onClick={() => setMessage("")} aria-label={L("Fermer", "Cerrar", "Close")}>
            <X size={14} />
          </button>
        </div>
      )}
      {mode === "videos" ? (
        <>
          <div className="video-hero">
            <div>
              <span className="eyebrow">
                {L(
                  "UN MOIS D’IDÉES. VOTRE FAÇON DE LES RACONTER.",
                  "UN MES DE IDEAS. TU FORMA DE CONTARLAS.",
                  "A MONTH OF IDEAS. YOUR WAY OF TELLING THEM.",
                )}
              </span>
              <h2>
                {L("30 idées à tourner,", "30 ideas para grabar,", "30 ideas to film,")}
                <br />
                {L("à votre rythme.", "a tu ritmo.", "at your own pace.")}
              </h2>
              <p>
                {creator
                  ? L(
                      "Des idées adaptées aux sujets dont vous aimez parler. Ouvrez une idée : nous vous expliquons quoi filmer et comment.",
                      "Ideas adaptadas a los temas de los que te gusta hablar. Abre una idea: te explicamos qué grabar y cómo.",
                      "Ideas tailored to the topics you love talking about. Open an idea and we’ll explain what to film and how.",
                    )
                  : L(
                      "Des idées adaptées à vos produits. Ouvrez une idée : nous vous expliquons quoi filmer et comment.",
                      "Ideas adaptadas a tus productos. Abre una idea: te explicamos qué grabar y cómo.",
                      "Ideas tailored to your products. Open an idea and we’ll explain what to film and how.",
                    )}
              </p>
              {(client.config.language || "fr") !== lang && (
                <p className="muted idea-lang-note">
                  {L(
                    `Les idées sont écrites dans la langue de votre compte (${({ fr: "français", es: "espagnol", en: "anglais" } as Row)[client.config.language] || client.config.language}).`,
                    `Las ideas están escritas en el idioma de tu cuenta (${({ fr: "francés", es: "español", en: "inglés" } as Row)[client.config.language] || client.config.language}).`,
                    `Ideas are written in your account language (${({ fr: "French", es: "Spanish", en: "English" } as Row)[client.config.language] || client.config.language}).`,
                  )}
                </p>
              )}
              <div className="recipe-summary">
                <span>
                  {L(
                    "Vidéos pour Instagram, TikTok ou YouTube",
                    "Videos para Instagram, TikTok o YouTube",
                    "Videos for Instagram, TikTok or YouTube",
                  )}
                </span>
                <span>{L("15–30 secondes", "15–30 segundos", "15–30 seconds")}</span>
                <span>
                  {L("Gratuit : n’utilise pas vos crédits", "Gratis: no usa tus créditos", "Free: doesn’t use your credits")}
                </span>
              </div>
            </div>
            <div className="video-hero-counter">
              <b>{ideas.length || "—"}</b>
              <span>
                {L("idées pour", "ideas para", "ideas for")}
                <br />
                {monthName(month, lang)}
              </span>
            </div>
          </div>
          <div className="ideas-toolbar">
            <label>
              {L("Votre mois", "Tu mes", "Your month")}
              <input
                type="month"
                value={month}
                max={data.upcomingMonth || data.editorialMonth}
                onChange={(e) => {
                  if (e.target.value) loadMonth(e.target.value);
                }}
              />
            </label>
            <div className="idea-filters">
              {[
                ["all", L("Toutes", "Todas", "All")],
                ["planned", L("À tourner", "Por grabar", "To film")],
                ["filmed", L("Tournées", "Grabadas", "Filmed")],
                ["editing", L("Montage", "Edición", "Editing")],
                ["published", L("Publiées", "Publicadas", "Published")],
              ].map(([key, label]) => (
                <button key={key} className={filter === key ? "selected" : ""} onClick={() => setFilter(key)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="editorial-note">
            {L(
              "Choisissez une idée qui vous plaît, puis cliquez sur « Comment filmer ? ». Rien ne se publie automatiquement.",
              "Elige una idea que te guste y haz clic en “¿Cómo grabar?”. Nada se publica automáticamente.",
              "Pick an idea you like, then click “How to film?”. Nothing is posted automatically.",
            )}
          </p>
          {agency && month === data.editorialMonth && (
            <button
              className="text-link"
              disabled={busy}
              onClick={() =>
                act(
                  "refresh-ideas",
                  { client_id: client.id },
                  "Les idées à tourner ont été adaptées aux produits actuels. Les idées déjà tournées ou affinées sont conservées.",
                )
              }
            >
              <Video size={14} />
              {creator
                ? "Adapter les idées à votre ligne éditoriale"
                : "Adapter les idées à tourner aux produits actuels"}
            </button>
          )}
          <div className="ideas-grid">
            {ideas
              .filter((x) => filter === "all" || x.status === filter)
              .map((i) => (
                <article className="idea-card" key={i.id}>
                  <div className="section-heading">
                    <span className="idea-number">{String(i.slot).padStart(2, "0")}</span>
                    <span className={"status " + i.status}>{statusName(lang, i.status)}</span>
                  </div>
                  {(() => {
                    const p = shotProgress(i, data.shotClips);
                    return p.total && i.status !== "published" && i.status !== "editing" ? (
                      <div className={"shot-badge " + (p.ready ? "ready" : "")}>
                        {p.ready
                          ? L("Tous les plans sont filmés", "Todas las tomas están grabadas", "All shots are filmed")
                          : L(
                              `${p.done}/${p.total} plans déjà filmés`,
                              `${p.done}/${p.total} tomas ya grabadas`,
                              `${p.done}/${p.total} shots already filmed`,
                            )}
                      </div>
                    ) : null;
                  })()}
                  <div className="eyebrow">
                    {plainText(i.content.category, i.content.language)} · {dateLabel(i.content.suggested_date, lang)}
                  </div>
                  <h3>{plainText(i.content.title, i.content.language)}</h3>
                  <p className="idea-hook">« {plainText(i.content.hook, i.content.language)} »</p>
                  <div className="idea-card-bottom">
                    <span>
                      <Video size={13} />
                      {i.content.duration}
                    </span>
                    <button className="text-link" onClick={() => setFocus(i)}>
                      {L("Comment filmer ?", "¿Cómo grabar?", "How to film?")} <ArrowRight size={14} />
                    </button>
                  </div>
                </article>
              ))}
          </div>
          {!ideas.length && (
            <div className="welcome-empty">
              <CalendarDays size={30} />
              <h3>
                {L(
                  "Pas encore d’idées pour ce mois.",
                  "Aún no hay ideas para este mes.",
                  "No ideas for this month yet.",
                )}
              </h3>
              <p>
                {L(
                  "Vos idées apparaîtront à partir du mois où votre studio a été ouvert.",
                  "Tus ideas aparecerán a partir del mes en que se abrió tu estudio.",
                  "Your ideas will appear starting from the month your studio opened.",
                )}
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="montage-intro">
            <div className="empty-icon">
              <Scissors size={26} />
            </div>
            <div>
              <h2>
                {L(
                  "Vos petites vidéos, réunies en une.",
                  "Tus videos cortos, reunidos en uno.",
                  "Your short clips, combined into one.",
                )}
              </h2>
              <p>
                {L(
                  "Ajoutez les vidéos de votre téléphone. Le studio les coupe et les assemble pour vous.",
                  "Agrega los videos de tu teléfono. El estudio los corta y los une por ti.",
                  "Add the videos from your phone. The studio trims and puts them together for you.",
                )}
              </p>
            </div>
            <button className="button primary" disabled={!canCreate} onClick={() => startRequest()}>
              <Plus size={16} />
              {L("Ajouter mes vidéos", "Agregar mis videos", "Add my videos")}
            </button>
          </div>
          {autoQueue.length > 0 && (
            <div className="montage-service-note auto-montage-note">
              <Loader2 className="spin" size={18} />
              <div>
                <b>
                  {L(
                    `${autoQueue.length} vidéo${autoQueue.length > 1 ? "s" : ""} prête${autoQueue.length > 1 ? "s" : ""} : montage automatique en cours`,
                    `${autoQueue.length} video${autoQueue.length > 1 ? "s" : ""} list${autoQueue.length > 1 ? "os" : "o"}: edición automática en curso`,
                    `${autoQueue.length} video${autoQueue.length > 1 ? "s" : ""} ready: automatic editing in progress`,
                  )}
                </b>
                <p>
                  {L(
                    "Tous les plans sont filmés. Gardez cette page ouverte, chaque vidéo se monte l’une après l’autre.",
                    "Todas las tomas están grabadas. Deja esta página abierta: cada video se edita uno tras otro.",
                    "All shots are filmed. Keep this page open — each video is edited one after the other.",
                  )}
                </p>
              </div>
            </div>
          )}
          {renderBusy && (
          <div className="montage-service-note">
            <ShieldCheck size={18} />
            <div>
              <b>
                {L(
                  "Laissez cette page ouverte pendant la création",
                  "Deja esta página abierta durante la creación",
                  "Keep this page open while your video is created",
                )}
              </b>
              <p>
                {L(
                  "Le studio réunit vos petites vidéos en un seul fichier à télécharger. Cela peut prendre quelques minutes. Vos vidéos restent dans votre espace privé.",
                  "El estudio une tus videos cortos en un solo archivo para descargar. Puede tardar unos minutos. Tus videos se quedan en tu espacio privado.",
                  "The studio combines your short clips into a single file to download. This can take a few minutes. Your videos stay in your private space.",
                )}
              </p>
            </div>
          </div>
          )}
          <div className="edit-list">
            {data.videoEdits?.map((e: Row) => (
              <article className="panel edit-card" key={e.id}>
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">{new Date(e.created).toLocaleDateString(dateLocale(lang))}</span>
                    <h3>{e.brief.title}</h3>
                  </div>
                  <span className={"status " + e.status}>{statusName(lang, e.status)}</span>
                </div>
                <div className="recipe-summary">
                  <span>
                    {e.clips.length} {L("petites vidéos", "videos cortos", "short clips")}
                  </span>
                  <span>
                    {(
                      {
                        "9:16": L("Téléphone debout", "Teléfono vertical", "Phone upright"),
                        "4:5": L("Image haute", "Imagen vertical", "Tall image"),
                        "1:1": L("Image carrée", "Imagen cuadrada", "Square image"),
                      } as Row
                    )[e.brief.format] || e.brief.format}
                  </span>
                  <span>
                    {e.brief.duration} {L("secondes souhaitées", "segundos deseados", "seconds requested")}
                  </span>
                  <span>
                    {e.brief.subtitles
                      ? L("Sous-titres demandés", "Subtítulos solicitados", "Subtitles requested")
                      : L("Sans sous-titres", "Sin subtítulos", "No subtitles")}
                  </span>
                </div>
                {e.brief.style && (
                  <div className="recipe-summary">
                    <span>
                      <Scissors size={11} />
                      {L("Style :", "Estilo:", "Style:")} {e.brief.style.name}
                    </span>
                    <span>
                      {L(
                        "Choix conservé pour cette vidéo",
                        "Elección guardada para este video",
                        "Choice kept for this video",
                      )}
                    </span>
                  </div>
                )}
                {data.videoRenders
                  ?.filter((r: Row) => r.edit_id === e.id && r.error)
                  .slice(0, 1)
                  .map((r: Row) => (
                    <p className="error-inline" key={r.id}>
                      {r.error}
                    </p>
                  ))}
                <p className="muted">
                  {plainText(e.brief.instructions) ||
                    L(
                      "Suivre les étapes de l’idée choisie.",
                      "Seguir los pasos de la idea elegida.",
                      "Follow the steps of the chosen idea.",
                    )}
                </p>
                <details>
                  <summary>
                    {L(
                      "Revoir les petites vidéos envoyées",
                      "Ver los videos cortos enviados",
                      "Review the clips you sent",
                    )}
                  </summary>
                  <div className="clip-grid">
                    {e.clips.map((id: string) => {
                      const f = data.files.find((f: Row) => f.id === id);
                      return (
                        <div key={id}>
                          <video controls preload="metadata" playsInline src={"/api/studio/file/" + id} />
                          <a className="text-link" href={"/api/studio/file/" + id + "?download=1"}>
                            <Download size={13} />
                            {f?.name ||
                              L("Télécharger cette petite vidéo", "Descargar este video corto", "Download this clip")}
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </details>
                {e.output_file && (
                  <div className="video-output">
                    <h4>{L("Vidéo finale", "Video final", "Final video")}</h4>
                    <video controls preload="metadata" playsInline src={"/api/studio/file/" + e.output_file} />
                    <div className="edit-actions">
                      <a className="button primary" href={"/api/studio/file/" + e.output_file + "?download=1"}>
                        <Download size={15} />
                        {L("Télécharger ma vidéo", "Descargar mi video", "Download my video")}
                      </a>
                      {!agency && <AddToCalendarButton kind="video" id={e.id} />}
                    </div>
                  </div>
                )}
                <div className="edit-actions">
                  <button
                    className={"button " + (e.output_file ? "secondary" : "primary")}
                    disabled={renderBusy || !canCreate}
                    onClick={() => openEdit(e)}
                  >
                    <Scissors size={15} />
                    {e.output_file
                      ? L("Refaire le montage", "Rehacer la edición", "Redo the edit")
                      : e.status === "rendering"
                        ? L(
                            "Vérifier la création en cours",
                            "Revisar la creación en curso",
                            "Check the video in progress",
                          )
                        : L("Créer la vidéo finale", "Crear el video final", "Create the final video")}
                  </button>
                </div>
                {data.videoRenders
                  ?.filter((r: Row) => r.edit_id === e.id && r.output_file && r.output_file !== e.output_file)
                  .map((r: Row) => (
                    <a key={r.id} className="text-link" href={"/api/studio/file/" + r.output_file + "?download=1"}>
                      <Download size={13} />
                      {L("Version du", "Versión del", "Version from")}{" "}
                      {new Date(r.created).toLocaleString(dateLocale(lang))}
                    </a>
                  ))}
                {agency && (
                  <div className="edit-actions">
                    {e.status === "requested" && (
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() =>
                          act(
                            "video-status",
                            { edit_id: e.id, status: "editing" },
                            "Montage pris en charge par l’agence.",
                          )
                        }
                      >
                        Prendre en charge
                      </button>
                    )}
                    <label className="button secondary">
                      <Upload size={15} />
                      {uploading ? "Enregistrement…" : "Ajouter la vidéo finale"}
                      <input
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm,.mov"
                        hidden
                        disabled={uploading}
                        onChange={(event) => upload(event.target.files, e.id)}
                      />
                    </label>
                    {e.output_file && e.status !== "completed" && (
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() =>
                          act(
                            "video-status",
                            { edit_id: e.id, status: "completed" },
                            "Montage validé et disponible pour le client.",
                          )
                        }
                      >
                        <Check size={15} />
                        Valider le montage
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
          {!data.videoEdits?.length && (
            <div className="welcome-empty">
              <Film size={32} />
              <h3>
                {L(
                  "Commencez avec les vidéos de votre téléphone.",
                  "Empieza con los videos de tu teléfono.",
                  "Start with the videos on your phone.",
                )}
              </h3>
              <p>
                {L(
                  "Choisissez une idée, suivez ses étapes pour filmer, puis ajoutez vos vidéos ici.",
                  "Elige una idea, sigue sus pasos para grabar y luego agrega tus videos aquí.",
                  "Choose an idea, follow its filming steps, then add your videos here.",
                )}
              </p>
              <button className="button secondary" onClick={() => onMode("videos")}>
                {L("Voir les idées vidéo", "Ver las ideas de video", "See video ideas")} <ArrowRight size={15} />
              </button>
            </div>
          )}
        </>
      )}
      {selectedIdea && (
        <div className="overlay" onClick={() => setFocus(null)}>
          <section
            className="modal idea-detail"
            role="dialog"
            aria-modal="true"
            aria-label={L("Fiche de tournage", "Ficha de grabación", "Filming guide")}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button modal-x"
              onClick={() => setFocus(null)}
              aria-label={L("Fermer", "Cerrar", "Close")}
            >
              <X size={19} />
            </button>
            <span className="eyebrow">
              {L("IDÉE", "IDEA", "IDEA")} {String(selectedIdea.slot).padStart(2, "0")} · {monthName(month, lang)}
            </span>
            <h2>{plainText(selectedIdea.content.title, selectedIdea.content.language)}</h2>
            <p className="idea-hook">« {plainText(selectedIdea.content.hook, selectedIdea.content.language)} »</p>
            <div className="recipe-summary">
              <span>{selectedIdea.content.duration}</span>
              <span>{L("Téléphone debout", "Teléfono vertical", "Phone upright")}</span>
              {selectedIdea.content.product_name &&
                selectedIdea.content.product_name !== (client.config?.brand || client.name) && (
                  <span>{selectedIdea.content.product_name}</span>
                )}
            </div>
            <FilmingGuide
              key={selectedIdea.id}
              content={selectedIdea.content}
              config={client.config}
              stepAction={(index) => (
                <ShotButton
                  idea={selectedIdea}
                  client={client}
                  shots={data.shotClips || []}
                  canCreate={canCreate}
                  index={index}
                  onSaved={async (text) => {
                    await refresh();
                    if (month !== data.editorialMonth) await loadMonth(month);
                    setMessage(text);
                  }}
                />
              )}
            />
            {selectedIdea.content.pillar && (
              <div className="recipe-summary">
                <span>
                  {L("Sujet :", "Tema:", "Topic:")} {selectedIdea.content.pillar}
                </span>
                <span>{selectedIdea.content.platform}</span>
              </div>
            )}
            {selectedIdea.content.coverTitle && (
              <>
                <h4>
                  {L(
                    "Titre à afficher sur la première image",
                    "Título para mostrar en la primera imagen",
                    "Title to show on the first frame",
                  )}
                </h4>
                <p>{plainText(selectedIdea.content.coverTitle, selectedIdea.content.language)}</p>
              </>
            )}
            <details className="spoken-text">
              <summary>{L("Les mots que vous pouvez dire", "Lo que puedes decir", "Words you can say")}</summary>
              <p className="editorial-note">
                {L(
                  "Adaptez ces phrases à votre façon de parler. Si un exemple est demandé, choisissez quelque chose que vous avez vraiment vécu.",
                  "Adapta estas frases a tu forma de hablar. Si se pide un ejemplo, elige algo que realmente hayas vivido.",
                  "Adapt these lines to the way you talk. If an example is needed, choose something you’ve really experienced.",
                )}
              </p>
              <p className="caption">{plainText(selectedIdea.content.narration, selectedIdea.content.language)}</p>
              <h4>{L("La phrase pour terminer", "La frase para cerrar", "Your closing line")}</h4>
              <p>{plainText(selectedIdea.content.cta, selectedIdea.content.language)}</p>
            </details>
            {agency && (
              <details className="agency-original">
                <summary>Notes et consignes d’origine · agence</summary>
                <ol className="scene-list">
                  {selectedIdea.content.scenes.map((s: string, n: number) => (
                    <li key={n}>{s}</li>
                  ))}
                </ol>
                <p className="editorial-note">{selectedIdea.content.notes}</p>
              </details>
            )}
            {agency && (
            <label className="field">
              <span>Avancement</span>
              <select
                value={selectedIdea.status}
                onChange={async (e) => {
                  await act(
                    "idea-update",
                    { idea_id: selectedIdea.id, status: e.target.value },
                    L("Avancement enregistré.", "Avance guardado.", "Progress saved."),
                  );
                  setFocus({ ...selectedIdea, status: e.target.value });
                }}
              >
                {["planned", "filmed", "editing", "published"].map((s) => (
                  <option value={s} key={s}>
                    {statusName(lang, s)}
                  </option>
                ))}
              </select>
            </label>
            )}
            <div className="edit-actions idea-footer">
              <button
                className="button secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      [
                        plainText(selectedIdea.content.title, selectedIdea.content.language),
                        ...filmingGuide(selectedIdea.content, client.config).setup,
                        ...filmingGuide(selectedIdea.content, client.config).steps.map(
                          (s: Row) =>
                            `${s.number}. ${s.action}\n${s.say || ""}\n${s.position}\n${s.seconds} ${L("secondes", "segundos", "seconds")}`,
                        ),
                        plainText(selectedIdea.content.narration, selectedIdea.content.language),
                      ].join("\n\n"),
                    );
                    setMessage(L("Fiche de tournage copiée.", "Ficha de grabación copiada.", "Filming guide copied."));
                  } catch {
                    setError(
                      L(
                        "Copiez le texte depuis la fiche.",
                        "Copia el texto desde la ficha.",
                        "Copy the text from the guide.",
                      ),
                    );
                  }
                }}
              >
                <Copy size={14} />
                {L("Copier la fiche", "Copiar la ficha", "Copy the guide")}
              </button>
              {agency && (
                <button
                  className="button secondary"
                  onClick={() =>
                    setEditForm({
                      ...selectedIdea,
                      content: { ...selectedIdea.content },
                      scenes: selectedIdea.content.scenes.join("\n"),
                    })
                  }
                >
                  Affiner l’idée
                </button>
              )}
              {(() => {
                const p = shotProgress(selectedIdea, data.shotClips);
                return p.ready ? (
                  <button
                    className="button primary"
                    disabled={!canCreate}
                    onClick={() => {
                      setFocus(null);
                      onMode("montage");
                    }}
                  >
                    <Scissors size={15} />
                    {L("Monter ma vidéo", "Editar mi video", "Edit my video")}
                  </button>
                ) : (
                  <>
                    {p.total > 0 && (
                      <span className="idea-progress">
                        {L(
                          `${p.done}/${p.total} vidéos ajoutées`,
                          `${p.done}/${p.total} videos agregados`,
                          `${p.done}/${p.total} videos added`,
                        )}
                      </span>
                    )}
                    <button
                      className="text-link"
                      disabled={!canCreate}
                      onClick={() => {
                        startRequest(selectedIdea);
                        setFocus(null);
                      }}
                    >
                      {L(
                        "Déjà filmé ? Ajouter toutes mes vidéos",
                        "¿Ya grabaste? Agregar todos mis videos",
                        "Already filmed? Add all my videos",
                      )}
                    </button>
                  </>
                );
              })()}
            </div>
          </section>
        </div>
      )}
      {editForm && (
        <div className="overlay">
          <section className="modal" role="dialog" aria-modal="true" aria-label="Modifier une idée">
            <button className="icon-button modal-x" onClick={() => setEditForm(null)} aria-label="Fermer">
              <X size={19} />
            </button>
            <h2>Affiner cette idée.</h2>
            {[
              ["title", "Titre"],
              ["hook", "Accroche"],
              ["narration", "Voix off"],
              ["cta", "Appel à l’action"],
            ].map(([key, label]) => (
              <label className="field" key={key}>
                <span>{label}</span>
                <textarea
                  value={editForm.content[key]}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      content: { ...editForm.content, [key]: e.target.value },
                    })
                  }
                />
              </label>
            ))}
            <label className="field">
              <span>Plans à tourner · un par ligne</span>
              <textarea
                value={editForm.scenes}
                onChange={(e) => setEditForm({ ...editForm, scenes: e.target.value })}
              />
            </label>
            <button
              className="button primary full"
              disabled={busy}
              onClick={async () => {
                const r = await act(
                  "idea-update",
                  {
                    idea_id: editForm.id,
                    content: {
                      ...editForm.content,
                      scenes: editForm.scenes.split("\n").filter(Boolean),
                    },
                  },
                  "Idée mise à jour.",
                );
                if (r) {
                  setEditForm(null);
                  setFocus(null);
                }
              }}
            >
              Enregistrer l’idée
            </button>
          </section>
        </div>
      )}
      {request && (
        <div className="overlay" onClick={() => setRequest(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={L("Demander un montage", "Solicitar una edición", "Request an edit")}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button modal-x"
              onClick={() => setRequest(null)}
              aria-label={L("Fermer", "Cerrar", "Close")}
            >
              <X size={19} />
            </button>
            <div className="eyebrow">
              {L("DU TOURNAGE AU MONTAGE", "DE LA GRABACIÓN A LA EDICIÓN", "FROM FILMING TO EDITING")}
            </div>
            <h2>{L("Ajoutez vos petites vidéos.", "Agrega tus videos cortos.", "Add your short clips.")}</h2>
            <p className="muted">
              {L(
                "Choisissez les vidéos de votre téléphone. Vous pourrez changer leur ordre avec les flèches.",
                "Elige los videos de tu teléfono. Podrás cambiar su orden con las flechas.",
                "Choose the videos from your phone. You can change their order with the arrows.",
              )}
            </p>
            {error && <div className="alert error">{agency ? error : plainText(error)}</div>}
            <label className="field">
              <span>
                {L("1. Nom de votre vidéo · facultatif", "1. Nombre de tu video · opcional", "1. Video name · optional")}
              </span>
              <input value={request.title} onChange={(e) => setRequest({ ...request, title: e.target.value })} />
            </label>
            <label className="field">
              <span>
                {L(
                  "2. Choisissez le style de votre vidéo",
                  "2. Elige el estilo de tu video",
                  "2. Choose your video style",
                )}
              </span>
              <select
                value={request.style_id || ""}
                onChange={(e) => {
                  const style = (data.videoStyles || []).find((s: Row) => s.id === e.target.value),
                    preset = style?.defaults || style?.config;
                  setRequest({
                    ...request,
                    style_id: e.target.value,
                    ...(preset
                      ? {
                          format: preset.format,
                          duration: preset.duration,
                          subtitles: preset.subtitles,
                        }
                      : {}),
                  });
                }}
              >
                <option value="">
                  {L(
                    "Simple · couper et réunir mes vidéos",
                    "Simple · cortar y unir mis videos",
                    "Simple · trim and combine my videos",
                  )}
                </option>
                {(data.videoStyles || [])
                  .filter((s: Row) => s.active && s.assigned)
                  .map((s: Row) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
              {request.style_id && (
                <small>
                  {L(
                    "Votre agence a préparé ce style. Les mêmes choix seront utilisés pour cette vidéo.",
                    "Tu agencia preparó este estilo. Se usarán las mismas opciones para este video.",
                    "Your agency prepared this style. The same choices will be used for this video.",
                  )}
                </small>
              )}
            </label>
            <h3 className="photo-step-title">
              {L("3. Ajoutez vos petites vidéos", "3. Agrega tus videos cortos", "3. Add your short clips")}
            </h3>
            <div className="video-drop">
              <input
                ref={input}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.mov"
                multiple
                hidden
                onChange={(e) => upload(e.target.files)}
              />
              <button className="button secondary" disabled={uploading} onClick={() => input.current?.click()}>
                {uploading ? <Loader2 size={17} className="spin" /> : <Upload size={17} />}
                {L("Choisir mes vidéos", "Elegir mis videos", "Choose my videos")}
              </button>
              <small>
                {L(
                  "MP4, MOV, WebM · 50 Mo par fichier · 6 vidéos maximum",
                  "MP4, MOV, WebM · 50 MB por archivo · 6 videos máximo",
                  "MP4, MOV, WebM · 50 MB per file · up to 6 videos",
                )}
              </small>
            </div>
            {clips.length > 0 && (
              <ol className="clip-order" aria-label={L("Ordre de vos vidéos", "Orden de tus videos", "Order of your videos")}>
                {clips.map((id, n) => {
                  const f = activeClips.find((x: Row) => x.id === id);
                  const move = (to: number) => {
                    const next = [...clips];
                    next.splice(n, 1);
                    next.splice(to, 0, id);
                    setClips(next);
                  };
                  return (
                    <li key={id}>
                      <span className="clip-rank">{n + 1}</span>
                      <video preload="metadata" playsInline muted src={"/api/studio/file/" + id + "#t=0.5"} />
                      <span className="clip-name">{f?.name || L("Vidéo", "Video", "Video")}</span>
                      <span className="clip-moves">
                        <button
                          type="button"
                          className="icon-button"
                          disabled={n === 0}
                          aria-label={L("Monter", "Subir", "Move up")}
                          onClick={() => move(n - 1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          disabled={n === clips.length - 1}
                          aria-label={L("Descendre", "Bajar", "Move down")}
                          onClick={() => move(n + 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={L("Retirer", "Quitar", "Remove")}
                          onClick={() => setClips(clips.filter((x) => x !== id))}
                        >
                          <X size={14} />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            {activeClips.some((f: Row) => !clips.includes(f.id)) && (
              <details className="clip-saved" open={!clips.length}>
                <summary>{L("Vidéos déjà envoyées", "Videos ya enviados", "Videos already sent")}</summary>
                <div className="clip-choice">
                  {activeClips
                    .filter((f: Row) => !clips.includes(f.id))
                    .map((f: Row) => (
                      <button
                        type="button"
                        key={f.id}
                        className="clip-pick"
                        disabled={clips.length >= 6}
                        onClick={() => setClips([...clips, f.id].slice(0, 6))}
                      >
                        <video preload="metadata" playsInline muted src={"/api/studio/file/" + f.id + "#t=0.5"} />
                        <span>{f.name}</span>
                        <Plus size={14} />
                      </button>
                    ))}
                </div>
              </details>
            )}
            <details className="simple-options">
              <summary>
                {L("Autres choix (facultatif)", "Otras opciones (opcional)", "More options (optional)")}
              </summary>
              <div className="form-row">
                <label className="field">
                  <span>{L("Forme de la vidéo", "Formato del video", "Video shape")}</span>
                  <select value={request.format} onChange={(e) => setRequest({ ...request, format: e.target.value })}>
                    {["9:16", "4:5", "1:1"].map((f) => (
                      <option key={f} value={f}>
                        {
                          (
                            {
                              "9:16": L(
                                "Téléphone debout · conseillé",
                                "Teléfono vertical · recomendado",
                                "Phone upright · recommended",
                              ),
                              "4:5": L(
                                "Image haute pour Instagram",
                                "Imagen vertical para Instagram",
                                "Tall image for Instagram",
                              ),
                              "1:1": L("Image carrée", "Imagen cuadrada", "Square image"),
                            } as Row
                          )[f]
                        }
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{L("Durée souhaitée", "Duración deseada", "Desired length")}</span>
                  <select
                    value={request.duration}
                    onChange={(e) =>
                      setRequest({
                        ...request,
                        duration: Number(e.target.value),
                      })
                    }
                  >
                    {[15, 30, 60].map((n) => (
                      <option value={n} key={n}>
                        {n} {L("secondes", "segundos", "seconds")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{L("Langue", "Idioma", "Language")}</span>
                  <select
                    value={request.language}
                    onChange={(e) => setRequest({ ...request, language: e.target.value })}
                  >
                    <option value="es">{L("Espagnol", "Español", "Spanish")}</option>
                    <option value="fr">{L("Français", "Francés", "French")}</option>
                    <option value="en">{L("Anglais", "Inglés", "English")}</option>
                  </select>
                </label>
              </div>
              <label className="optional-toggle">
                <input
                  type="checkbox"
                  checked={request.subtitles}
                  onChange={(e) => setRequest({ ...request, subtitles: e.target.checked })}
                />
                {L("Afficher des sous-titres à l’écran", "Mostrar subtítulos en pantalla", "Show subtitles on screen")}
              </label>
              <label className="field">
                <span>
                  {L(
                    "Une demande particulière ? (facultatif)",
                    "¿Alguna petición especial? (opcional)",
                    "Any special request? (optional)",
                  )}
                </span>
                <textarea
                  value={request.instructions}
                  onChange={(e) => setRequest({ ...request, instructions: e.target.value })}
                />
              </label>
            </details>
            <p className="editorial-note">
              {L(
                "À l’étape suivante, vous pourrez ajouter une voix off créée par le studio et des sous-titres automatiques. Le montage ne compte pas dans vos visuels ; seule la voix off en utilise un. Aucun paiement ici.",
                "En el siguiente paso podrás agregar una voz en off creada por el estudio y subtítulos automáticos. La edición no cuenta en tus imágenes; solo la voz en off usa una. Aquí no se paga nada.",
                "In the next step, you can add a voiceover created by the studio and automatic subtitles. Editing doesn’t count toward your visuals; only a voiceover uses one. No payment here.",
              )}
            </p>
            <button
              className="button primary full"
              disabled={busy || uploading || !clips.length}
              onClick={() => submit(true)}
            >
              {busy ? <Loader2 className="spin" size={16} /> : <Scissors size={16} />}
              {L("Assembler mes vidéos", "Unir mis videos", "Combine my videos")}
            </button>
            <button className="text-link" disabled={busy || uploading || !clips.length} onClick={() => submit(false)}>
              {L(
                "Demander à l’agence de s’en occuper",
                "Pedir a la agencia que se encargue",
                "Ask the agency to handle it",
              )}
            </button>
          </section>
        </div>
      )}
      {renderEdit && (
        <div className="overlay">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={L("Créer la vidéo finale", "Crear el video final", "Create the final video")}
          >
            <button
              className="icon-button modal-x"
              disabled={renderBusy}
              onClick={() => {
                if (rendered) URL.revokeObjectURL(rendered.url);
                setRendered(null);
                setRenderEdit(null);
              }}
              aria-label={L("Fermer", "Cerrar", "Close")}
            >
              <X size={19} />
            </button>
            <span className="eyebrow">
              {L("VOTRE VIDÉO À TÉLÉCHARGER", "TU VIDEO PARA DESCARGAR", "YOUR VIDEO TO DOWNLOAD")}
            </span>
            <h2>
              {renderEdit.output_file
                ? L("Une nouvelle version.", "Una nueva versión.", "A new version.")
                : L("Votre vidéo finale.", "Tu video final.", "Your final video.")}
            </h2>
            <p>
              {L(
                `Le studio prend des passages dans vos petites vidéos, dans l’ordre où vous les avez ajoutées. Il les réunit en une vidéo de ${renderEdit.brief.duration} secondes maximum. Si vos vidéos sont plus courtes, le résultat le sera aussi. L’image reste entière : des bandes peuvent apparaître sur les côtés.`,
                `El estudio toma fragmentos de tus videos cortos, en el orden en que los agregaste, y los une en un video de ${renderEdit.brief.duration} segundos como máximo. Si tus videos son más cortos, el resultado también lo será. La imagen se muestra completa: pueden aparecer bandas a los lados.`,
                `The studio takes passages from your short clips, in the order you added them, and combines them into a video of up to ${renderEdit.brief.duration} seconds. If your clips are shorter, the result will be too. The whole image is kept, so bars may appear on the sides.`,
              )}
            </p>
            <p className="editorial-note">
              {L(
                "Gardez cette page ouverte pendant la création. Le studio ne choisit pas les meilleurs moments et ne comprend pas vos consignes écrites. Pour un montage précis ou des paroles bien placées, demandez l’aide de votre agence.",
                "Deja esta página abierta durante la creación. El estudio no elige los mejores momentos ni entiende tus instrucciones escritas. Para una edición precisa o subtítulos bien sincronizados, pide ayuda a tu agencia.",
                "Keep this page open while the video is created. The studio doesn’t pick the best moments or understand written instructions. For precise editing or well-timed words, ask your agency for help.",
              )}
            </p>
            {error && (
              <div className="alert error" role="alert">
                {agency ? error : plainText(error)}
              </div>
            )}
            {renderEdit.brief.renderRequirements?.supported === false && (
              <div className="alert error">
                {L(
                  "Ce style doit être réalisé par votre agence. Vous pouvez aussi recommencer avec un autre style.",
                  "Este estilo debe hacerlo tu agencia. También puedes empezar de nuevo con otro estilo.",
                  "This style has to be made by your agency. You can also start over with another style.",
                )}
              </div>
            )}
            <section className="voice-panel">
              <h3>{L("Voix off", "Voz en off", "Voiceover")}</h3>
              <p className="muted">
                {L(
                  "Écrivez ce que la voix doit dire, choisissez une voix : le studio la crée pour votre vidéo.",
                  "Escribe lo que debe decir la voz y elige una voz: el estudio la crea para tu video.",
                  "Write what the voice should say and pick a voice: the studio creates it for your video.",
                )}
              </p>
              <textarea
                value={voiceScript}
                maxLength={VOICE_SCRIPT_MAX}
                rows={4}
                disabled={voiceBusy || renderBusy || !!rendered}
                onChange={(e) => setVoiceScript(e.target.value)}
                placeholder={L(
                  "Ex. : Notre bougie ambrée est coulée à la main à Monterrey. Commandez-la dès aujourd’hui.",
                  "Ej.: Nuestra vela ámbar está hecha a mano en Monterrey. Pídela hoy mismo.",
                  "E.g. Our amber candle is hand-poured in Monterrey. Order yours today.",
                )}
                aria-label={L("Texte de la voix off", "Texto de la voz en off", "Voiceover text")}
              />
              <small className="muted">
                {voiceScript.length}/{VOICE_SCRIPT_MAX} ·{" "}
                {L(
                  "environ 15 mots pour 5 secondes. Vérifiez la prononciation des noms de marque.",
                  "unas 15 palabras por cada 5 segundos. Revisa la pronunciación de los nombres de marca.",
                  "about 15 words per 5 seconds. Check how brand names are pronounced.",
                )}
              </small>
              <div
                className="voice-choices"
                role="group"
                aria-label={L("Choix de la voix", "Elección de voz", "Voice choice")}
              >
                {(
                  [
                    ["warm", L("Chaleureuse", "Cálida", "Warm")],
                    ["calm", L("Posée", "Serena", "Calm")],
                    ["energetic", L("Énergique", "Enérgica", "Energetic")],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={voiceChoice === value}
                    disabled={voiceBusy || renderBusy || !!rendered}
                    onClick={() => setVoiceChoice(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="button secondary"
                disabled={voiceBusy || renderBusy || !!rendered || !voiceScript.trim() || !canCreate || !data.generationReady}
                title={
                  data.generationReady
                    ? undefined
                    : L("La voix off par IA est en pause pour le moment.", "La voz en off con IA está en pausa por ahora.", "AI voiceover is paused for now.")
                }
                onClick={createVoice}
              >
                {voiceBusy ? <Loader2 size={15} className="spin" /> : <Film size={15} />}{" "}
                {voiceBusy
                  ? L("Création de la voix…", "Creando la voz…", "Creating the voice…")
                  : renderEdit.brief.voice?.file_id
                    ? L("Régénérer la voix", "Volver a generar la voz", "Regenerate the voice")
                    : L("Créer la voix off", "Crear la voz en off", "Create the voiceover")}
              </button>
              <small className="muted">
                {agency
                  ? "Gratuit quand l’agence la crée pour le client."
                  : L(
                      `Compte pour ${client.config.voiceCost ?? 1} visuel par voix créée.`,
                      `Cuenta como ${client.config.voiceCost ?? 1} imagen por voz creada.`,
                      `Counts as ${client.config.voiceCost ?? 1} visual per voice created.`,
                    )}
              </small>
              {renderEdit.brief.voice?.file_id && (
                <div className="voice-ready">
                  <audio
                    controls
                    preload="none"
                    src={"/api/studio/file/" + encodeURIComponent(renderEdit.brief.voice.file_id)}
                  />
                  <label className="optional-toggle">
                    <input
                      type="checkbox"
                      checked={useVoice}
                      disabled={renderBusy || !!rendered}
                      onChange={(e) => setUseVoice(e.target.checked)}
                    />
                    {L("Utiliser cette voix dans la vidéo", "Usar esta voz en el video", "Use this voice in the video")}
                  </label>
                  <small className="muted">
                    {L(
                      "Voix créée par intelligence artificielle. Certaines plateformes demandent de le signaler dans la publication.",
                      "Voz creada con inteligencia artificial. Algunas plataformas piden indicarlo en la publicación.",
                      "AI-generated voice. Some platforms ask you to disclose this in the post.",
                    )}
                  </small>
                </div>
              )}
            </section>
            <section className="voice-panel">
              <label className="optional-toggle">
                <input
                  type="checkbox"
                  checked={autoSubs}
                  disabled={renderBusy || !!rendered}
                  onChange={(e) => setAutoSubs(e.target.checked)}
                />
                <b>{L("Ajouter des sous-titres", "Agregar subtítulos", "Add subtitles")}</b>
              </label>
              {autoSubs && !renderExtras.subtitles && (
                <>
                  {useVoice && renderEdit.brief.voice?.script ? (
                    <p className="muted">
                      {L(
                        "Les sous-titres reprennent le texte de la voix off, calés sur sa durée.",
                        "Los subtítulos usan el texto de la voz en off, ajustados a su duración.",
                        "Subtitles use the voiceover text, timed to its length.",
                      )}
                    </p>
                  ) : (
                    <>
                      <textarea
                        value={subText}
                        maxLength={VOICE_SCRIPT_MAX}
                        rows={3}
                        disabled={renderBusy || !!rendered}
                        onChange={(e) => setSubText(e.target.value)}
                        aria-label={L("Texte des sous-titres", "Texto de los subtítulos", "Subtitle text")}
                        placeholder={L(
                          "Le texte à afficher à l’écran",
                          "El texto que se muestra en pantalla",
                          "The text to show on screen",
                        )}
                      />
                      <small className="muted">
                        {L(
                          "Le texte est découpé en lignes courtes et réparti sur toute la vidéo.",
                          "El texto se divide en líneas cortas y se reparte en todo el video.",
                          "The text is split into short lines spread across the whole video.",
                        )}
                      </small>
                    </>
                  )}
                </>
              )}
              {autoSubs && (
                <details className="voice-srt">
                  <summary>
                    {L(
                      "J’ai déjà un fichier de sous-titres (.srt)",
                      "Ya tengo un archivo de subtítulos (.srt)",
                      "I already have a subtitle file (.srt)",
                    )}
                  </summary>
                  <input
                    disabled={renderBusy || !!rendered}
                    type="file"
                    accept=".srt"
                    onChange={(e) =>
                      setRenderExtras({
                        ...renderExtras,
                        subtitles: e.target.files?.[0],
                      })
                    }
                  />
                </details>
              )}
            </section>
            {renderEdit.brief.renderRequirements?.logo && (
              <label className="field">
                <span>
                  {L(
                    "Votre logo · fichier PNG obligatoire",
                    "Tu logo · archivo PNG obligatorio",
                    "Your logo · PNG file required",
                  )}
                </span>
                <input
                  disabled={renderBusy || !!rendered}
                  type="file"
                  accept="image/png"
                  onChange={(e) =>
                    setRenderExtras({
                      ...renderExtras,
                      logo: e.target.files?.[0],
                    })
                  }
                />
              </label>
            )}
            {renderEdit.brief.renderRequirements?.music && (
              <label className="field">
                <span>
                  {L(
                    "Musique fournie ou autorisée par l’agence · obligatoire",
                    "Música proporcionada o autorizada por la agencia · obligatoria",
                    "Music provided or approved by the agency · required",
                  )}
                </span>
                <input
                  disabled={renderBusy || !!rendered}
                  type="file"
                  accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg"
                  onChange={(e) =>
                    setRenderExtras({
                      ...renderExtras,
                      music: e.target.files?.[0],
                    })
                  }
                />
                <small>
                  {L(
                    "La musique reste en fond pour que l’on entende encore les sons de vos vidéos.",
                    "La música queda de fondo para que se sigan escuchando los sonidos de tus videos.",
                    "The music stays in the background so the sound of your clips can still be heard.",
                  )}
                </small>
              </label>
            )}
            <p className="editorial-note">
              {L(
                "Ces fichiers servent à créer cette vidéo. Vous pourrez télécharger le résultat ensuite.",
                "Estos archivos sirven para crear este video. Después podrás descargar el resultado.",
                "These files are used to create this video. You can download the result afterward.",
              )}{" "}
              {client.config.validation === "agency"
                ? L(
                    "L’agence valide la vidéo avant son statut final.",
                    "La agencia valida el video antes de su estado final.",
                    "The agency approves the video before it’s final.",
                  )
                : L(
                    "La vidéo sera disponible dès son enregistrement.",
                    "El video estará disponible en cuanto se guarde.",
                    "The video will be available as soon as it’s saved.",
                  )}
            </p>
            {renderBusy && (
              <p role="status">
                <Loader2 size={18} className="spin" /> {renderProgress}
              </p>
            )}
            {rendered ? (
              <>
                <a className="button secondary full" href={rendered.url} download="montage-final.mp4">
                  <Download size={15} />
                  {L("Télécharger ma vidéo", "Descargar mi video", "Download my video")}
                </a>
                <button className="button primary full" disabled={renderBusy} onClick={() => saveRendered(rendered)}>
                  {L("Reprendre l’enregistrement", "Volver a guardar", "Try saving again")}
                </button>
              </>
            ) : (
              <button
                className="button primary full"
                disabled={renderBusy || !canCreate || renderEdit.brief.renderRequirements?.supported === false}
                onClick={launchRender}
              >
                <Film size={16} />
                {renderBusy
                  ? L("Montage en cours…", "Edición en curso…", "Editing…")
                  : renderEdit.output_file
                    ? L("Créer une nouvelle version", "Crear una nueva versión", "Create a new version")
                    : L("Créer ma vidéo", "Crear mi video", "Create my video")}
              </button>
            )}
            {renderBusy && !rendered && (
              <button className="text-link" onClick={() => cancelRender.current()}>
                {L("Arrêter le montage", "Detener la edición", "Stop editing")}
              </button>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
export function VideoStyles({ data, client, refresh }: { data: Row; client: Row; refresh: () => Promise<any> }) {
  const [form, setForm] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const defaults = {
    pace: "balanced",
    shotSeconds: 3,
    transition: "cut",
    format: "9:16",
    duration: 30,
    subtitles: true,
    captionStyle: "discreet",
    captionColor: "#ffffff",
    captionBackground: "#19352d",
    captionPosition: "bottom_safe",
    logoMode: "none",
    music: "none",
    originalAudio: true,
    opening: "Une accroche dans les trois premières secondes.",
    ending: "Un appel à l’action factuel.",
    instructions: "Respecter les caractéristiques réelles du produit et la marque.",
  };
  async function action(path: string, b: Row) {
    setBusy(true);
    setError("");
    try {
      const r = await call(path, b);
      await refresh();
      return r;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  const cfg = (key: string, value: any) =>
    setForm((old) => (old ? { ...old, config: { ...old.config, [key]: value } } : old));
  return (
    <section>
      <div className="section-heading">
        <p className="muted">Enregistrez vos directions de montage, puis autorisez-les pour chaque client.</p>
        <button
          className="button primary"
          onClick={() =>
            setForm({
              name: "",
              description: "",
              active: 1,
              config: { ...defaults },
            })
          }
        >
          <Plus size={16} />
          Créer un style
        </button>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="montage-service-note">
        <Scissors size={18} />
        <div>
          <b>Vos styles pilotent le montage automatique.</b>
          <p>
            Le montage sur cet appareil applique coupes, fondus au noir, format, son et ressources fournies. Le fondu
            enchaîné et l’interprétation des consignes écrites demandent l’agence. Chaque demande conserve ses réglages.
          </p>
        </div>
      </div>
      <div className="product-grid">
        {(data.videoStyles || []).map((s: Row) => (
          <article className="product-card style-card" key={s.id}>
            <div
              className="style-preview"
              style={{
                backgroundColor: s.config.captionBackground,
                color: s.config.captionColor,
              }}
            >
              <span>{s.config.captionStyle === "bold" ? "VOTRE ACCROCHE" : "Votre histoire, en images."}</span>
              <small>
                {s.config.format} · {s.config.duration} s
              </small>
            </div>
            <h3>{s.name}</h3>
            <p>{s.description}</p>
            <div className="recipe-summary">
              <span>
                {
                  { calm: "Posé", balanced: "Équilibré", dynamic: "Dynamique" }[
                    s.config.pace as "calm" | "balanced" | "dynamic"
                  ]
                }
              </span>
              <span>{s.config.shotSeconds} s / plan</span>
              <span>{s.config.subtitles ? "Sous-titres" : "Sans sous-titres"}</span>
            </div>
            <p className="editorial-note">
              {s.config.logoMode === "client_logo" ? "Logo du client demandé · " : ""}
              {s.config.music === "none" ? "Sans musique ajoutée" : "Musique à valider par l’agence"}
            </p>
            <div className="style-actions">
              <button className="button secondary" onClick={() => setForm({ ...s, config: { ...s.config } })}>
                Modifier le style
              </button>
              <button
                className={"button " + (s.assigned ? "secondary" : "primary")}
                disabled={busy || !s.active}
                onClick={() =>
                  action("assign-style", {
                    client_id: client.id,
                    style_id: s.id,
                    enabled: !s.assigned,
                  })
                }
              >
                {s.assigned ? <Check size={14} /> : <Plus size={14} />}{" "}
                {s.assigned ? "Autorisé · retirer" : "Autoriser pour ce client"}
              </button>
            </div>
            <small className="muted">{s.active ? "Style actif" : "Style suspendu"}</small>
          </article>
        ))}
      </div>
      {!data.videoStyles?.length && (
        <div className="welcome-empty">
          <Scissors size={30} />
          <h3>Votre signature de montage commence ici.</h3>
          <p>Créez un style ou partez de trois bases : Minimal & élégant, Dynamique social, Produit & texture.</p>
          <button className="button secondary" disabled={busy} onClick={() => action("seed-styles", {})}>
            Ajouter les trois styles de départ
          </button>
        </div>
      )}
      {form && (
        <div className="overlay" onClick={() => setForm(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Configurer un style de montage"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="icon-button modal-x" onClick={() => setForm(null)} aria-label="Fermer">
              <X size={19} />
            </button>
            <div className="eyebrow">DIRECTION DE MONTAGE · AGENCE</div>
            <h2>Votre recette de montage.</h2>
            {error && <div className="alert error">{error}</div>}
            <label className="field">
              <span>Nom visible par le client</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="field">
              <span>Description simple</span>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <div className="form-row">
              <label className="field">
                <span>Rythme</span>
                <select value={form.config.pace} onChange={(e) => cfg("pace", e.target.value)}>
                  <option value="calm">Posé</option>
                  <option value="balanced">Équilibré</option>
                  <option value="dynamic">Dynamique</option>
                </select>
              </label>
              <label className="field">
                <span>Secondes par plan</span>
                <input
                  type="number"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={form.config.shotSeconds}
                  onChange={(e) => cfg("shotSeconds", Number(e.target.value))}
                />
              </label>
              <label className="field">
                <span>Transitions</span>
                <select value={form.config.transition} onChange={(e) => cfg("transition", e.target.value)}>
                  <option value="cut">Coupes franches</option>
                  <option value="fade">Fondu</option>
                  <option value="crossfade">Fondu enchaîné</option>
                </select>
              </label>
            </div>
            <div className="form-row">
              <label className="field">
                <span>Format</span>
                <select value={form.config.format} onChange={(e) => cfg("format", e.target.value)}>
                  {["9:16", "4:5", "1:1"].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Durée cible</span>
                <select value={form.config.duration} onChange={(e) => cfg("duration", Number(e.target.value))}>
                  {[15, 30, 60].map((n) => (
                    <option key={n} value={n}>
                      {n} secondes
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="optional-toggle">
              <input
                type="checkbox"
                checked={form.config.subtitles}
                onChange={(e) => cfg("subtitles", e.target.checked)}
              />
              Sous-titres
            </label>
            <div className="form-row">
              <label className="field">
                <span>Style des sous-titres</span>
                <select value={form.config.captionStyle} onChange={(e) => cfg("captionStyle", e.target.value)}>
                  <option value="discreet">Discret</option>
                  <option value="bold">Impactant</option>
                </select>
              </label>
              <label className="field">
                <span>Position</span>
                <select value={form.config.captionPosition} onChange={(e) => cfg("captionPosition", e.target.value)}>
                  <option value="bottom_safe">Bas · zone sûre</option>
                  <option value="center">Centre</option>
                </select>
              </label>
            </div>
            <div className="form-row">
              <label className="field">
                <span>Couleur du texte</span>
                <input
                  type="color"
                  value={form.config.captionColor}
                  onChange={(e) => cfg("captionColor", e.target.value)}
                />
              </label>
              <label className="field">
                <span>Fond des sous-titres</span>
                <input
                  type="color"
                  value={form.config.captionBackground}
                  onChange={(e) => cfg("captionBackground", e.target.value)}
                />
              </label>
            </div>
            <div className="form-row">
              <label className="field">
                <span>Logo</span>
                <select value={form.config.logoMode} onChange={(e) => cfg("logoMode", e.target.value)}>
                  <option value="none">Aucun</option>
                  <option value="client_logo">Logo fourni par le client</option>
                </select>
              </label>
              <label className="field">
                <span>Musique</span>
                <select value={form.config.music} onChange={(e) => cfg("music", e.target.value)}>
                  <option value="none">Aucune musique ajoutée</option>
                  <option value="agency_approved">À valider par l’agence</option>
                </select>
              </label>
            </div>
            <label className="optional-toggle">
              <input
                type="checkbox"
                checked={form.config.originalAudio}
                onChange={(e) => cfg("originalAudio", e.target.checked)}
              />
              Conserver le son original
            </label>
            {[
              ["opening", "Ouverture"],
              ["ending", "Fin et appel à l’action"],
              ["instructions", "Consignes de montage"],
            ].map(([key, label]) => (
              <label className="field" key={key}>
                <span>{label}</span>
                <textarea value={form.config[key]} onChange={(e) => cfg(key, e.target.value)} />
              </label>
            ))}
            <label className="optional-toggle">
              <input
                type="checkbox"
                checked={!!form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked ? 1 : 0 })}
              />
              Style actif
            </label>
            <button
              className="button primary full"
              disabled={busy}
              onClick={async () => {
                const r = await action("video-style", form);
                if (r) setForm(null);
              }}
            >
              {busy ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
              Enregistrer le style
            </button>
          </section>
        </div>
      )}
    </section>
  );
}
