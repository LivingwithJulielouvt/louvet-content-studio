"use client";
import { useEffect, useState } from "react";
import { type Lang, pick, readStoredLang, storeLang, LanguageSwitcher } from "../lib/i18n";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "../lib/supabase/client";
type Language = Lang;
export default function LoginPanel({
  initialLanguage = "fr",
  destination = "/studio",
}: {
  initialLanguage?: Language;
  destination?: string;
}) {
  const [language, setLanguage] = useState<Language>(initialLanguage),
    [email, setEmail] = useState(""),
    [otp, setOtp] = useState(""),
    [stage, setStage] = useState<"email" | "code">("email"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [info, setInfo] = useState(""),
    [cooldown, setCooldown] = useState(0);
  const router = useRouter(),
    L = <T,>(fr: T, es: T, en: T) => pick(language, fr, es, en);
  useEffect(() => {
    // Sans langue dans l'adresse, reprendre celle choisie sur l'accueil.
    if (!new URLSearchParams(window.location.search).get("lang")) {
      const stored = readStoredLang();
      if (stored) setLanguage(stored);
    }
  }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  async function resend() {
    if (busy || cooldown > 0) return;
    setBusy(true);
    setMessage("");
    setInfo("");
    try {
      const { error } = await createSupabaseBrowser().auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setInfo(L("Nouveau code envoyé.", "Nuevo código enviado.", "New code sent."));
      setCooldown(30);
    } catch (e: any) {
      setMessage(e?.message || L("Une erreur est survenue.", "Ocurrió un error.", "Something went wrong."));
    } finally {
      setBusy(false);
    }
  }
  function changeLanguage(l: Language) {
    setLanguage(l);
    storeLang(l);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = createSupabaseBrowser();
      if (stage === "email") {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          throw Error(L("Indiquez un e-mail valide.", "Introduce un correo válido.", "Please enter a valid email."));
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
        setStage("code");
        setCooldown(30);
      } else {
        const { error } = await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: otp.trim(),
          type: "email",
        });
        if (error) throw error;
        router.replace(destination.startsWith("/studio") ? destination : "/studio");
        router.refresh();
      }
    } catch (e: any) {
      setMessage(e?.message || L("Une erreur est survenue.", "Ocurrió un error.", "Something went wrong."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="louvet-public h-site" lang={language}>
      <header className="lp-header">
        <a className="lp-logo" href={"/?lang=" + language}>
          louvet<span>& partners</span>
        </a>
        <LanguageSwitcher value={language} onChange={changeLanguage} className="lp-language" />
      </header>
      <main className="lp-login-main">
        <a className="lp-back" href={"/?lang=" + language}>
          {L("← Retour à l’accueil", "← Volver al inicio", "← Back to home")}
        </a>
        <section className="lp-login-card">
          <span className="lp-eyebrow">LOUVET & PARTNERS · CONTENT STUDIO</span>
          <h1>{L("Votre espace,\nrien qu’à vous.", "Tu espacio,\nsolo para ti.", "Your space,\njust for you.")}</h1>
          <p>
            {L(
              "Indiquez votre e-mail\u00a0: nous vous envoyons un code à 6 chiffres. Pas de mot de passe à retenir.",
              "Escribe tu correo: te enviamos un código de 6 cifras. Sin contraseña que recordar.",
              "Enter your email: we’ll send you a 6-digit code. No password to remember.",
            )}
          </p>
          <form onSubmit={submit}>
            <label className="field">
              <span>{L("Adresse e-mail", "Correo electrónico", "Email address")}</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy || stage === "code"}
                placeholder={L("vous@entreprise.com", "tu@empresa.com", "you@company.com")}
              />
            </label>
            {stage === "code" && (
              <p className="lp-code-sent" role="status">
                {L(
                  `Code envoyé à ${email.trim().toLowerCase()}. Pensez à vérifier vos spams.`,
                  `Código enviado a ${email.trim().toLowerCase()}. Revisa también tu carpeta de spam.`,
                  `Code sent to ${email.trim().toLowerCase()}. Check your spam folder too.`,
                )}
              </p>
            )}
            {stage === "code" && (
              <label className="field">
                <span>{L("Code à 6 chiffres", "Código de 6 cifras", "6-digit code")}</span>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6,8}"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                />
              </label>
            )}
            <button className="lp-button lp-primary" type="submit" disabled={busy}>
              {busy
                ? "…"
                : stage === "email"
                  ? L("Recevoir mon code", "Recibir mi código", "Get my code")
                  : L("Accéder au studio", "Entrar al estudio", "Open my studio")}{" "}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          {stage === "code" && (
            <div className="lp-code-links">
              <button className="text-link" type="button" disabled={busy || cooldown > 0} onClick={resend}>
                {cooldown > 0
                  ? L(`Renvoyer le code (${cooldown} s)`, `Reenviar el código (${cooldown} s)`, `Resend the code (${cooldown}s)`)
                  : L("Renvoyer le code", "Reenviar el código", "Resend the code")}
              </button>
              <button
                className="text-link"
                type="button"
                onClick={() => {
                  setStage("email");
                  setOtp("");
                  setMessage("");
                  setInfo("");
                }}
              >
                {L("Changer d’adresse", "Cambiar de correo", "Change email")}
              </button>
            </div>
          )}
          {info && (
            <p role="status" className="lp-small">
              {info}
            </p>
          )}
          {message && (
            <p role="alert" className="lp-small">
              {message}
            </p>
          )}
          <p className="lp-small">
            {L("Pas encore de studio\u00a0? ", "¿Aún no tienes estudio? ", "No studio yet? ")}
            <a href={"/souscrire?lang=" + language}>
              {L("Faire une demande en 2 minutes", "Haz tu solicitud en 2 minutos", "Request one in 2 minutes")}
            </a>
          </p>
        </section>
      </main>
      <footer className="lp-footer">
        <p>Louvet & Partners</p>
        <a href={"/?lang=" + language}>{L("Accueil", "Inicio", "Home")} ↗</a>
      </footer>
    </div>
  );
}
