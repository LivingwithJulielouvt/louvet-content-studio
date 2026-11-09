"use client";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowLeft, Check, ClipboardList, Clock, Loader2, LogOut, RefreshCw, Copy } from "lucide-react";
import { studioTheme } from "../lib/client-experience.mjs";
import { isCreator } from "../lib/workspaces.mjs";
import { questionsForWorkspace } from "../lib/client-intake.mjs";
import { useLang, readStoredLang, normLang, type Lang } from "../lib/i18n";
type Row = Record<string, any>;
const copy: Record<string, Row> = {
  fr: {
    eyebrow: "FAISONS CONNAISSANCE",
    title: "Votre marque commence par vous.",
    intro:
      "Dix questions pour comprendre votre activité, vos envies et vos priorités. Votre agence préparera ensuite la stratégie et les réglages de votre studio.",
    help: "Pas besoin de jargon marketing. Si vous ne savez pas encore, indiquez « À définir avec l’agence ». Ne partagez aucun mot de passe ni donnée sensible.",
    steps: ["Votre activité", "Votre identité", "Votre communication", "Vérifier mes réponses"],
    answered: "réponses renseignées",
    save: "Enregistrer mon brouillon",
    next: "Enregistrer et continuer",
    previous: "Précédent",
    send: "Envoyer ma demande d’inscription",
    saved: "Brouillon enregistré. Vous pourrez reprendre après votre prochaine connexion.",
    missing: "Répondez à chaque question de cette étape avant de continuer.",
    waitingTitle: "En attente",
    waiting: "Merci ! Votre agence prépare votre studio. Vous recevrez un email dès qu’il sera prêt.",
    changes: "Votre agence a besoin de quelques précisions.",
    note: "À compléter",
    review: "Vérifiez vos réponses avant de les transmettre. Elles serviront de base à l’échange avec votre agence.",
    edit: "Modifier",
    refresh: "Vérifier l’ouverture du studio",
    preview: "Aperçu du parcours client · les réponses doivent être saisies depuis son compte.",
    back: "Retour à l’espace agence",
    logout: "Se déconnecter",
    count: "Question",
    transmitted: "Réponses transmises",
    none: "Non renseigné",
    available: "Vos réponses ont été étudiées. Le studio est ouvert.",
  },
  es: {
    eyebrow: "CONOZCÁMONOS",
    title: "Tu marca empieza contigo.",
    intro:
      "Diez preguntas para entender tu negocio, tus ideas y tus prioridades. Después, tu agencia preparará la estrategia y la configuración de tu estudio.",
    help: "No necesitas términos de marketing. Si aún no lo sabes, escribe « Por definir con la agencia ». No compartas contraseñas ni datos sensibles.",
    steps: ["Tu negocio", "Tu identidad", "Tu comunicación", "Revisar mis respuestas"],
    answered: "respuestas completas",
    save: "Guardar mi borrador",
    next: "Guardar y continuar",
    previous: "Anterior",
    send: "Enviar a mi agencia",
    saved: "Borrador guardado. Podrás continuar cuando vuelvas a iniciar sesión.",
    missing: "Responde cada pregunta de esta etapa antes de continuar.",
    waitingTitle: "Gracias, estamos preparando lo que sigue.",
    waiting:
      "Tu agencia recibió tus respuestas. Preparará tu dirección estratégica y después abrirá tu estudio. No se inicia ninguna creación de pago durante esta etapa.",
    changes: "Tu agencia necesita algunas precisiones.",
    note: "Por completar",
    review: "Revisa tus respuestas antes de enviarlas. Serán la base de la conversación con tu agencia.",
    edit: "Modificar",
    refresh: "Consultar la apertura del estudio",
    preview: "Vista previa del recorrido del cliente · las respuestas deben completarse desde su cuenta.",
    back: "Volver al espacio agencia",
    logout: "Cerrar sesión",
    count: "Pregunta",
    transmitted: "Respuestas enviadas",
    none: "Sin respuesta",
    available: "Tus respuestas han sido revisadas. El estudio está abierto.",
  },
  en: {
    eyebrow: "LET’S GET TO KNOW YOUR BRAND",
    title: "Your brand starts with you.",
    intro:
      "Ten questions about your business, ideas and priorities. Your agency will then prepare the strategy and settings for your studio.",
    help: "No marketing jargon needed. If you are unsure, write “To discuss with the agency”. Do not share passwords or sensitive information.",
    steps: ["Your business", "Your identity", "Your communication", "Review my answers"],
    answered: "answers completed",
    save: "Save my draft",
    next: "Save and continue",
    previous: "Previous",
    send: "Send to my agency",
    saved: "Draft saved. You can continue when you next sign in.",
    missing: "Answer each question in this step before continuing.",
    waitingTitle: "Thank you. We’re preparing what comes next.",
    waiting:
      "Your agency has received your answers. It will prepare your strategic direction and then open your studio. No paid creation starts during this step.",
    changes: "Your agency needs a few more details.",
    note: "Please clarify",
    review: "Check your answers before sending. They will inform your conversation with the agency.",
    edit: "Edit",
    refresh: "Check whether my studio is open",
    preview: "Client journey preview · answers must be entered from the client’s account.",
    back: "Back to the agency space",
    logout: "Sign out",
    count: "Question",
    transmitted: "Answers submitted",
    none: "Not answered",
    available: "Your answers have been reviewed. Your studio is open.",
  },
};
async function post(path: string, body: Row) {
  const r = await fetch("/api/studio/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Studio-Request": "1" },
    body: JSON.stringify(body),
  });
  const d: any = await r.json();
  if (!r.ok) throw new Error(d.error);
  return d;
}
export default function ClientIntake({
  client,
  intake,
  refresh,
  preview = false,
  onBack,
}: {
  client: Row;
  intake: Row;
  refresh: () => Promise<any>;
  preview?: boolean;
  onBack?: () => void;
}) {
  const [testMode, setTestMode] = useState(false),
    [testIntake, setTestIntake] = useState<Row>({ answers: {}, revision: 0, status: "not_started" });
  const activeIntake = testMode ? testIntake : intake,
    readOnly = preview && !testMode;
  const questions = questionsForWorkspace(client.config),
    creator = isCreator(client.config);
  // Langue : celle choisie par le client sur cet appareil, sinon celle du studio, sinon celle réglée par l’agence.
  const ctxLang = useLang(),
    [storedLang, setStoredLang] = useState<Lang | null>(null);
  useEffect(() => setStoredLang(preview ? null : readStoredLang()), [preview]);
  const lang: Lang = storedLang || (ctxLang !== "fr" ? ctxLang : normLang(client.config.language)),
    t = creator
      ? {
          ...copy[lang],
          ...{
            fr: {
              title: "Votre voix. Votre univers.",
              intro:
                "Dix questions pour comprendre votre identité, votre audience et vos envies de création. Votre agence préparera ensuite votre ligne éditoriale et votre studio.",
              steps: ["Votre parcours", "Votre identité", "Votre communication", "Vérifier mes réponses"],
            },
            es: {
              title: "Tu voz. Tu universo.",
              intro:
                "Diez preguntas para entender tu identidad, tu audiencia y tus ideas. Después, tu agencia preparará tu línea editorial y tu estudio.",
              steps: ["Tu trayectoria", "Tu identidad", "Tu comunicación", "Revisar mis respuestas"],
            },
            en: {
              title: "Your voice. Your world.",
              intro:
                "Ten questions about your identity, audience and creative goals. Your agency will then prepare your editorial direction and your studio.",
              steps: ["Your story", "Your identity", "Your communication", "Review my answers"],
            },
          }[lang as "fr" | "es" | "en"],
        }
      : copy[lang];
  const [answers, setAnswers] = useState<Row>({ ...activeIntake.answers }),
    [revision, setRevision] = useState(activeIntake.revision || 0),
    [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) {
      setAnswers({ ...activeIntake.answers });
      setRevision(activeIntake.revision || 0);
    }
  }, [activeIntake.revision, dirty, testMode]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const complete = questions.filter((q) => (answers[q.key] || "").trim().length >= 3).length,
    waiting = activeIntake.status === "submitted" || activeIntake.status === "reviewed";
  const current = step === 0 ? questions.slice(0, 3) : step === 1 ? questions.slice(3, 6) : questions.slice(6);
  async function save(submit = false) {
    if (readOnly) return false;
    setBusy(true);
    setError("");
    try {
      const saved = await post(testMode ? "intake-test-save" : "intake-save", {
        client_id: client.id,
        answers,
        revision,
        language: lang,
        submit,
      });
      setRevision(saved.revision);
      setAnswers(saved.answers);
      setDirty(false);
      if (testMode) setTestIntake(saved);
      else await refresh();
      setMessage(submit ? t.transmitted : t.saved);
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (intake.status !== "submitted" || preview) return;
    const timer = setInterval(() => {
      refresh().catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [intake.status, preview]);
  async function next() {
    if (readOnly) {
      setStep((n) => n + 1);
      return;
    }
    if (current.some((q) => (answers[q.key] || "").trim().length < 3)) {
      setError(t.missing);
      return;
    }
    if (await save()) setStep((n) => n + 1);
  }
  return (
    <div
      className="intake-page client-space"
      data-vibe={client.config.studioVibe || "clean"}
      style={studioTheme(client.config) as React.CSSProperties}
    >
      <header className="intake-top">
        <div className="wordmark">
          louvet<span>& partners</span>
        </div>
        {preview ? (
          <button className="button secondary" onClick={onBack}>
            {t.back}
          </button>
        ) : (
          <a className="text-link" href="/auth/logout" target="_top">
            <LogOut size={15} />
            {t.logout}
          </a>
        )}
      </header>
      <main className="intake-main">
        <div className="intake-brand">{client.config.brand || client.name}</div>
        {preview && (
          <p className="preview-bar">
            {testMode ? "Mode test · réponses de test isolées du vrai client" : t.preview}
            <br />
            <button
              className="button secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  if (testMode) {
                    setTestMode(false);
                    setDirty(false);
                    setStep(0);
                  } else {
                    const r = await fetch("/api/studio/intake-test?client=" + encodeURIComponent(client.id));
                    const d: any = await r.json();
                    if (!r.ok) throw Error(d.error);
                    setTestIntake(d);
                    setTestMode(true);
                    setDirty(false);
                    setStep(0);
                  }
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {testMode ? "Quitter le mode test" : "Mode test"}
            </button>
            {testMode && (
              <button
                className="text-link"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const d = await post("intake-test-clear", { client_id: client.id });
                    setTestIntake(d);
                    setAnswers({});
                    setRevision(0);
                    setDirty(false);
                    setStep(0);
                    setMessage("Réponses de test effacées.");
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Effacer les réponses de test
              </button>
            )}
          </p>
        )}
        {preview && error && (
          <p role="alert" className="error-inline">
            {error}
          </p>
        )}
        {waiting ? (
          <section className="panel intake-waiting">
            <div className="empty-icon">{intake.status === "reviewed" ? <Check size={26} /> : <Clock size={26} />}</div>
            <span className="eyebrow">{t.transmitted}</span>
            <h1>{testMode ? "Demande de test enregistrée" : t.waitingTitle}</h1>
            <p>
              {testMode
                ? "Ces réponses sont marquées « test ». Aucun compte réel ni email n’est modifié."
                : intake.status === "reviewed"
                  ? t.available
                  : t.waiting}
            </p>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await refresh();
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCw size={15} />
              {t.refresh}
            </button>
            <details className="intake-sent">
              <summary>{t.steps[3]}</summary>
              {questions.map((q, i) => (
                <div className="intake-answer" key={q.key}>
                  <b>
                    {i + 1}. {q[lang as "fr" | "es" | "en"][0]}
                  </b>
                  <p>{activeIntake.answers?.[q.key] || t.none}</p>
                </div>
              ))}
            </details>
          </section>
        ) : (
          <>
            <span className="eyebrow">{t.eyebrow}</span>
            <h1>{t.title}</h1>
            <p className="intake-intro">{t.intro}</p>
            <p className="editorial-note">{t.help}</p>
            {intake.status === "changes_requested" && (
              <div className="alert">
                <div>
                  <b>{t.changes}</b>
                  <p>{intake.review_note}</p>
                </div>
              </div>
            )}
            <div className="intake-progress">
              <span>
                {complete} / 10 {t.answered}
              </span>
              <progress max={10} value={complete} />
            </div>
            <nav className="intake-steps" aria-label="Étapes">
              {t.steps.map((label: string, i: number) => (
                <span key={label} className={step === i ? "active" : step > i ? "done" : ""}>
                  <b>{step > i ? <Check size={12} /> : i + 1}</b>
                  {label}
                </span>
              ))}
            </nav>
            <section className="panel intake-form">
              {error && (
                <div role="alert" className="alert error">
                  {error}
                </div>
              )}
              {message && (
                <p role="status" className="video-message">
                  <Check size={14} />
                  {message}
                </p>
              )}
              {step < 3 ? (
                current.map((q) => {
                  const index = questions.findIndex((x) => x.key === q.key);
                  return (
                    <label className="field intake-field" key={q.key}>
                      <small>
                        {t.count} {String(index + 1).padStart(2, "0")} / 10
                      </small>
                      <span>{q[lang as "fr" | "es" | "en"][0]}</span>
                      <textarea
                        rows={4}
                        maxLength={2000}
                        disabled={busy || readOnly}
                        value={answers[q.key] || ""}
                        placeholder={q[lang as "fr" | "es" | "en"][1]}
                        onChange={(e) => {
                          setAnswers({ ...answers, [q.key]: e.target.value });
                          setDirty(true);
                          setMessage("");
                        }}
                      />
                      <small>{(answers[q.key] || "").length} / 2 000</small>
                    </label>
                  );
                })
              ) : (
                <>
                  <h2>{t.steps[3]}</h2>
                  <p className="muted">{t.review}</p>
                  {questions.map((q, i) => (
                    <div className="intake-answer" key={q.key}>
                      <div className="section-heading">
                        <b>
                          {i + 1}. {q[lang as "fr" | "es" | "en"][0]}
                        </b>
                        <button className="text-link" onClick={() => setStep(i < 3 ? 0 : i < 6 ? 1 : 2)}>
                          {t.edit}
                        </button>
                      </div>
                      <p>{answers[q.key] || t.none}</p>
                    </div>
                  ))}
                </>
              )}
              <div className="intake-actions">
                {step > 0 && (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => {
                      setError("");
                      setStep((n) => n - 1);
                    }}
                  >
                    <ArrowLeft size={15} />
                    {t.previous}
                  </button>
                )}
                <button className="text-link" disabled={busy || readOnly} onClick={() => save()}>
                  {t.save}
                </button>
                {step < 3 ? (
                  <button className="button primary" disabled={busy} onClick={next}>
                    {busy ? <Loader2 className="spin" size={15} /> : <ArrowRight size={15} />} {t.next}
                  </button>
                ) : (
                  <button
                    className="button primary"
                    disabled={busy || readOnly || complete < 10}
                    onClick={() => save(true)}
                  >
                    {busy ? <Loader2 className="spin" size={15} /> : <Check size={15} />} {t.send}
                  </button>
                )}
              </div>
            </section>
          </>
        )}
      </main>
      <footer className="intake-footer">LOUVET & PARTNERS · CONTENT STUDIO</footer>
    </div>
  );
}
export function IntakeReview({ client, intake, refresh }: { client: Row; intake: Row; refresh: () => Promise<any> }) {
  const questions = questionsForWorkspace(client.config),
    creator = isCreator(client.config);
  const [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const status = {
    not_started: "À remplir par le client",
    draft: "Brouillon client",
    submitted: "À organiser",
    changes_requested: "Précisions demandées",
    reviewed: "Studio ouvert",
  }[intake.status as string];
  useEffect(() => {
    setNote("");
    setError("");
    setMessage("");
  }, [client.id, intake.revision]);
  async function review(status: string) {
    setBusy(true);
    setError("");
    try {
      await post("intake-review", { client_id: client.id, revision: intake.revision, status, note });
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel intake-review">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{creator ? "LA PAROLE DE LA CRÉATRICE" : "LA PAROLE DU CLIENT"}</span>
          <h3>
            <ClipboardList size={18} />{" "}
            {creator ? "Questionnaire de découverte créatrice" : "Questionnaire de découverte de marque"}
          </h3>
        </div>
        <span className={"status " + (intake.ready ? "ready" : "review")}>{status}</span>
      </div>
      <p className="muted">
        Les dix réponses du client constituent votre matière de travail. Utilisez-les pour préparer{" "}
        {creator
          ? "la stratégie créatrice ci-dessous, les piliers et les recettes"
          : "la direction créative ci-dessous, les produits et les recettes"}
        , puis ouvrez son studio. Elles ne sont pas envoyées automatiquement au moteur et ne deviennent pas des faits ou
        règles validés.
      </p>
      {intake.updated && (
        <p className="editorial-note">
          Dernière sauvegarde : {new Date(intake.updated).toLocaleString("fr-FR")} · auteur : {intake.author} · version{" "}
          {intake.revision}
        </p>
      )}
      {questions.some((q) => intake.answers?.[q.key]) ? (
        <details open={intake.status === "submitted"}>
          <summary>Lire les dix réponses</summary>
          <div className="intake-review-grid">
            {questions.map((q, i) => (
              <div className="intake-answer" key={q.key}>
                <b>
                  {i + 1}. {q.fr[0]}
                </b>
                <p>{intake.answers[q.key] || "Non renseigné"}</p>
              </div>
            ))}
          </div>
          <button
            className="text-link"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  questions
                    .map((q, i) => `${i + 1}. ${q.fr[0]}\n${intake.answers[q.key] || "Non renseigné"}`)
                    .join("\n\n"),
                );
                setMessage("Réponses copiées.");
              } catch {
                setError("La copie est indisponible. Sélectionnez le texte des réponses.");
              }
            }}
          >
            <Copy size={14} />
            Copier les réponses
          </button>
        </details>
      ) : (
        <p className="editorial-note">
          Le questionnaire apparaîtra à la prochaine connexion du client, après son rattachement à cet espace.
        </p>
      )}
      {intake.review_note && <p className="editorial-note">Dernier message au client : {intake.review_note}</p>}
      {["submitted", "reviewed"].includes(intake.status) && (
        <>
          <label className="field">
            <span>Message visible par le client · obligatoire pour demander des précisions</span>
            <textarea
              maxLength={1500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Précisez les réponses à compléter et ce que vous souhaitez comprendre."
            />
          </label>
          <div className="edit-actions">
            {intake.status === "submitted" && (
              <button className="button primary" disabled={busy} onClick={() => review("reviewed")}>
                <Check size={15} />
                Valider et ouvrir le compte
              </button>
            )}
            <button
              className="button secondary"
              disabled={busy || !note.trim()}
              onClick={() => review("changes_requested")}
            >
              Demander des précisions au client
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="error-inline">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="editorial-note">
          {message}
        </p>
      )}
      {intake.reviewed_at && (
        <small className="editorial-note">
          Dernière décision : {new Date(intake.reviewed_at).toLocaleString("fr-FR")} · {intake.reviewed_by}
        </small>
      )}
    </section>
  );
}
