"use client";
import { useEffect, useState } from "react";
import { Check, Loader2, Plus, Sparkles } from "lucide-react";
import { creatorStrategyReady } from "../lib/workspaces.mjs";
import { useL } from "../lib/i18n";
type Row = Record<string, any>;
export default function CreatorStrategy({
  client,
  agency,
  refresh,
}: {
  client: Row;
  agency: boolean;
  refresh: () => Promise<any>;
}) {
  const strategy = client.config.creatorStrategy || {};
  const L = useL();
  const [form, setForm] = useState<Row>({ ...strategy, pillars: (strategy.pillars || []).join("\n") }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    const s = client.config.creatorStrategy || {};
    setForm({ ...s, pillars: (s.pillars || []).join("\n") });
    setDirty(false);
    setError("");
    setMessage("");
  }, [client.id]);
  const fields = [
    ["displayName", L("Nom de créatrice / signature", "Nombre de creadora / firma", "Creator name / signature"), "Le nom à utiliser pour vos contenus."],
    ["bio", L("Présentation courte validée", "Presentación corta validada", "Approved short bio"), "Votre parcours réel et votre activité."],
    ["audience", L("À qui vous parlez", "A quién le hablas", "Who you’re talking to"), "Les personnes à qui vous souhaitez parler."],
    ["positioning", L("Ce que vous souhaitez apporter", "Lo que quieres aportar", "What you want to bring"), "Votre angle singulier et ce que vous souhaitez apporter."],
    ["voice", L("Ton et personnalité", "Tono y personalidad", "Tone and personality"), "Votre façon de parler, vos valeurs et expressions."],
    ["visualWorld", L("Les couleurs et les images qui vous ressemblent", "Los colores y las imágenes que se parecen a ti", "The colors and images that feel like you"), "Couleurs, lumière, décors, cadrages."],
    ["boundaries", L("Limites et éléments à préserver", "Límites y elementos a cuidar", "Boundaries and things to protect"), "Vie privée, identité, sujets et catégories à éviter."],
    ["action", L("Ce que les personnes peuvent faire ensuite", "Lo que las personas pueden hacer después", "What people can do next"), "L’action souhaitée après avoir vu le contenu."],
    ["filmingResources", L("Ce que vous avez pour filmer", "Lo que tienes para grabar", "What you have to film with"), "Temps, lieux, matériel, aisance face caméra."],
  ];
  const set = (key: string, value: any) => {
    setForm({ ...form, [key]: value });
    setDirty(true);
    setMessage("");
  };
  async function save() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/studio/creator-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Studio-Request": "1" },
        body: JSON.stringify({
          client_id: client.id,
          strategy: {
            ...form,
            pillars: form.pillars
              .split("\n")
              .map((x: string) => x.trim())
              .filter(Boolean),
          },
        }),
      });
      const d: any = await res.json();
      if (!res.ok) throw new Error(d.error);
      await refresh();
      setDirty(false);
      setMessage(
        "Stratégie enregistrée. Les idées à tourner ont été adaptées ; les idées déjà personnalisées ou tournées sont conservées.",
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel creator-strategy">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            {L("STUDIO CRÉATRICE · IDENTITÉ PERSONNELLE", "ESTUDIO CREADORA · IDENTIDAD PERSONAL", "CREATOR STUDIO · PERSONAL IDENTITY")}
          </span>
          <h3>
            <Sparkles size={18} /> {L("Vos repères pour créer.", "Tus referencias para crear.", "Your guide for creating.")}
          </h3>
        </div>
        <span className={"status " + (creatorStrategyReady(strategy) ? "ready" : "review")}>
          {creatorStrategyReady(strategy)
            ? L("Direction définie", "Dirección definida", "Direction set")
            : L("À préparer avec l’agence", "Por preparar con la agencia", "To prepare with the agency")}
        </span>
      </div>
      {(agency || creatorStrategyReady(strategy)) && (
      <p className="muted">
        {agency
          ? "Organisez les réponses du questionnaire en positionnement, audience et piliers concrets. Cette fiche est visible par la créatrice et guide ses prochaines idées et créations."
          : L(
              "Votre agence a préparé cette direction pour guider vos idées, vos textes et vos images. Votre identité et vos limites restent au centre.",
              "Tu agencia preparó esta dirección para guiar tus ideas, tus textos y tus imágenes. Tu identidad y tus límites siguen al centro.",
              "Your agency prepared this direction to guide your ideas, captions and images. Your identity and your boundaries stay at the center.",
            )}
      </p>
      )}
      {agency ? (
        <>
          <div className="quality-questions">
            {fields.map(([key, label, hint]) => (
              <label className="field" key={key}>
                <span>
                  {label}
                  {["audience", "positioning"].includes(key) && (
                    <small className="quality-priority">Avant ouverture</small>
                  )}
                </span>
                <textarea
                  maxLength={key === "displayName" ? 120 : 2000}
                  rows={3}
                  placeholder={hint}
                  value={form[key] || ""}
                  onChange={(e) => set(key, e.target.value)}
                />
              </label>
            ))}
            <label className="field">
              <span>
                Piliers de contenu · un par ligne<small className="quality-priority">Avant ouverture</small>
              </span>
              <textarea
                rows={6}
                value={form.pillars}
                placeholder="Un à six piliers. Exemples : parcours, savoir-faire, coulisses."
                onChange={(e) => set("pillars", e.target.value)}
              />
              <small>Un pilier minimum. Trois à cinq permettent de varier les angles.</small>
            </label>
          </div>
          <div className="creator-platforms">
            <span>Plateformes prioritaires</span>
            {["Instagram", "TikTok", "YouTube", "LinkedIn"].map((p) => (
              <label key={p}>
                <input
                  type="checkbox"
                  checked={(form.platforms || []).includes(p)}
                  onChange={() =>
                    set(
                      "platforms",
                      (form.platforms || []).includes(p)
                        ? form.platforms.filter((x: string) => x !== p)
                        : [...(form.platforms || []), p],
                    )
                  }
                />
                {p}
              </label>
            ))}
          </div>
          <div className="edit-actions">
            <button className="button primary" disabled={busy || !dirty} onClick={save}>
              {busy ? <Loader2 size={15} className="spin" /> : <Check size={15} />}Enregistrer la stratégie créatrice
            </button>
            <small className="editorial-note">
              {dirty ? "Modifications non enregistrées" : "Les anciennes versions restent dans l’historique agence."}
            </small>
          </div>
        </>
      ) : !creatorStrategyReady(strategy) ? (
        <div className="create-waiting">
          <p>
            {L(
              "Julie prépare vos repères avec vos réponses au questionnaire. Une question, une envie ? Écrivez-lui.",
              "Julie prepara tus referencias con tus respuestas al cuestionario. ¿Una pregunta o una idea? Escríbele.",
              "Julie is preparing your guidelines from your questionnaire answers. A question or an idea? Message her.",
            )}
          </p>
          <button className="button secondary" onClick={() => window.dispatchEvent(new Event("studio-open-chat"))}>
            {L("Écrire à l’agence", "Escribir a la agencia", "Message the agency")}
          </button>
        </div>
      ) : (
        <>
          <div className="creator-pillars">
            {(strategy.pillars || []).map((p: string, i: number) => (
              <span key={i}>{p}</span>
            ))}
          </div>
          <div className="intake-review-grid">
            {fields
              .filter(([key]) => strategy[key])
              .map(([key, label]) => (
                <div className="intake-answer" key={key}>
                  <b>{label}</b>
                  <p>{strategy[key]}</p>
                </div>
              ))}
          </div>
          <div className="recipe-summary">
            {(strategy.platforms || []).map((p: string) => (
              <span key={p}>{p}</span>
            ))}
          </div>
        </>
      )}
      {error && (
        <p className="error-inline" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="editorial-note" role="status">
          {message}
        </p>
      )}
      <p className="editorial-note">
        {L(
          "Cet espace reste privé. Aucune marque ne reçoit vos réponses, vos photos ou vos créations. Les marques du studio ouvertes aux collaborations sont dans Opportunités.",
          "Este espacio es privado. Ninguna marca recibe tus respuestas, tus fotos ni tus creaciones. Las marcas del estudio abiertas a colaboraciones están en Oportunidades.",
          "This space stays private. No brand receives your answers, photos or creations. Studio brands open to collaborations are in Opportunities.",
        )}
      </p>
    </section>
  );
}
