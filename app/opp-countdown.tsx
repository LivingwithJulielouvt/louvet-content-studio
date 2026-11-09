"use client";
// Opportunités en compte à rebours : jours · heures · minutes jusqu'à l'ouverture (fixée par l'agence).
import { useEffect, useState } from "react";
import { BellRing, Check, Handshake, Sparkles, Tags, ShieldCheck, ListChecks } from "lucide-react";
import { useL } from "../lib/i18n";
type Row = Record<string, any>;

/** Jours restants (arrondis vers le haut) avant l'ouverture, ou null si pas de compte à rebours. */
export function oppDaysLeft(features: Row | undefined, now = Date.now()): number | null {
  if (!features || features.opportunities || features.opportunitiesMode !== "countdown" || !features.opportunitiesOpenAt) return null;
  const ms = Date.parse(features.opportunitiesOpenAt) - now;
  return ms > 0 ? Math.ceil(ms / 86400000) : null;
}
function useRemaining(openAt: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);
  const ms = Math.max(0, Date.parse(openAt) - now);
  return { ms, days: Math.floor(ms / 86400000), hours: Math.floor((ms % 86400000) / 3600000), minutes: Math.floor((ms % 3600000) / 60000) };
}
function Clock({ openAt }: { openAt: string }) {
  const L = useL();
  const r = useRemaining(openAt);
  const cell = (n: number, label: string) => (
    <div className="opp-cd-cell">
      <b>{String(n).padStart(2, "0")}</b>
      <span>{label}</span>
    </div>
  );
  return (
    <div className="opp-cd-clock" role="timer" aria-live="off">
      {cell(r.days, L("jours", "días", "days"))}
      <i aria-hidden="true">·</i>
      {cell(r.hours, L("heures", "horas", "hours"))}
      <i aria-hidden="true">·</i>
      {cell(r.minutes, L("minutes", "minutos", "minutes"))}
    </div>
  );
}
export function OppCountdown({ data, onOpened }: { data: Row; onOpened?: () => void }) {
  const L = useL();
  const f = data.features || {};
  const [notify, setNotify] = useState<string | null>(data.opportunitiesNotify || null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const r = useRemaining(f.opportunitiesOpenAt);
  useEffect(() => {
    if (r.ms === 0 && onOpened) onOpened();
  }, [r.ms === 0]);
  async function toggle() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/studio/opportunities-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Studio-Request": "1" },
        body: JSON.stringify({ enabled: notify !== "pending" }),
      });
      const d: Row = await res.json();
      if (!res.ok) throw Error(d.error || L("Réessayez dans un instant.", "Inténtalo en un momento.", "Please try again in a moment."));
      setNotify(d.notify);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="opp-countdown" aria-labelledby="opp-cd-title">
      <span className="opp-cd-eyebrow">
        <Sparkles size={15} /> {L("Bientôt dans votre studio", "Muy pronto en tu estudio", "Coming soon to your studio")}
      </span>
      <h2 id="opp-cd-title">
        {L("Votre sélection de marques à contacter arrive dans…", "Tu selección de marcas para contactar llega en…", "Your list of brands to contact arrives in…")}
      </h2>
      <Clock openAt={f.opportunitiesOpenAt} />
      <ul className="opp-cd-benefits">
        <li>
          <Tags size={18} />
          {L("Des marques triées par niche, pour aller droit à celles qui vous ressemblent.", "Marcas ordenadas por nicho, para ir directo a las que se parecen a ti.", "Brands sorted by niche, so you go straight to the ones that fit you.")}
        </li>
        <li>
          <ShieldCheck size={18} />
          {L("Des contacts professionnels vérifiés, publiés par les marques elles-mêmes.", "Contactos profesionales verificados, publicados por las propias marcas.", "Verified professional contacts, published by the brands themselves.")}
        </li>
        <li>
          <ListChecks size={18} />
          {L("Le suivi de vos prises de contact et un modèle de premier message prêt à copier.", "El seguimiento de tus contactos y un modelo de primer mensaje listo para copiar.", "Tracking for your outreach and a first-message template ready to copy.")}
        </li>
      </ul>
      {notify === "sent" ? null : (
        <button className={"button " + (notify === "pending" ? "secondary" : "primary")} disabled={busy} onClick={toggle}>
          {notify === "pending" ? <Check size={17} /> : <BellRing size={17} />}
          {notify === "pending"
            ? L("Vous serez prévenue à l’ouverture", "Te avisaremos en la apertura", "We’ll let you know when it opens")
            : L("Me prévenir à l’ouverture", "Avisarme en la apertura", "Notify me when it opens")}
        </button>
      )}
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
    </section>
  );
}
/** Pour les marques : un encart léger dans Collaborations, avec le même compte à rebours. */
export function OppTeaser({ data }: { data: Row }) {
  const L = useL();
  const f = data.features || {};
  if (oppDaysLeft(f) === null) return null;
  return (
    <section className="opp-teaser" aria-label={L("Bientôt", "Muy pronto", "Coming soon")}>
      <Handshake size={20} />
      <div>
        <b>
          {L(
            "Bientôt : des créatrices du studio pourront vous proposer des collaborations.",
            "Muy pronto: las creadoras del estudio podrán proponerte colaboraciones.",
            "Coming soon: studio creators will be able to propose collaborations to you.",
          )}
        </b>
        <Clock openAt={f.opportunitiesOpenAt} />
      </div>
    </section>
  );
}
