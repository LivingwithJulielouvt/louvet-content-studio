"use client";
import { useEffect, useState } from "react";
import { Check, Loader2, ClipboardList } from "lucide-react";
import { qualitySections, qualityQuestions } from "../lib/quality-profile.mjs";
type Row = Record<string, any>;
export default function QualityProfile({ client, refresh }: { client: Row; refresh: () => Promise<any> }) {
  const [answers, setAnswers] = useState<Row>({ ...client.config.quality }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    setAnswers({ ...client.config.quality });
    setDirty(false);
    setSaved(false);
    setError("");
  }, [client.id]);
  const total = qualityQuestions.length,
    count = qualityQuestions.filter(([key]) => String(answers[key as string] || "").trim()).length,
    essential = qualityQuestions.filter((q) => q[3]),
    done = essential.filter(([key]) => String(answers[key as string] || "").trim()).length;
  async function save() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/studio/quality-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Studio-Request": "1" },
        body: JSON.stringify({ client_id: client.id, answers }),
      });
      const data: any = await res.json();
      if (!res.ok) throw new Error(data.error);
      await refresh();
      setDirty(false);
      setSaved(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel quality-profile">
      <div className="section-heading">
        <div>
          <span className="eyebrow">DIRECTION CRÉATIVE · RÉSERVÉE À L’AGENCE</span>
          <h3>
            <ClipboardList size={18} /> Les questions qui font la différence.
          </h3>
        </div>
        <span className="status">
          {count} / {total} réponses
        </span>
      </div>
      <p className="muted">
        Renseignez ce que vous savez, une fois par marque. Les réponses enregistrées guident les prochaines images,
        légendes et fiches de tournage. Les {essential.length} questions repérées « priorité » forment la base ; vous
        pouvez enregistrer progressivement.
      </p>
      <div className="quality-progress">
        <progress max={essential.length} value={done} />
        <small>
          {done} / {essential.length} priorités renseignées · cela mesure la préparation, pas la qualité garantie des
          contenus.
        </small>
      </div>
      {qualitySections.map((section, i) => (
        <details key={section.title} open={i === 0}>
          <summary>
            {section.title}
            <span>
              {section.questions.filter(([k]) => answers[k as string]?.trim()).length} / {section.questions.length}
            </span>
          </summary>
          <div className="quality-questions">
            {section.questions.map(([key, label, hint, priority]) => (
              <label className="field" key={key as string}>
                <span>
                  {label}
                  {priority && <small className="quality-priority">Priorité</small>}
                </span>
                <textarea
                  rows={3}
                  maxLength={2000}
                  placeholder={hint as string}
                  value={answers[key as string] || ""}
                  onChange={(e) => {
                    setAnswers({ ...answers, [key as string]: e.target.value });
                    setDirty(true);
                    setSaved(false);
                  }}
                />
              </label>
            ))}
          </div>
        </details>
      ))}
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <div className="edit-actions">
        <button className="button primary" disabled={busy || !dirty} onClick={save}>
          {busy ? <Loader2 className="spin" size={16} /> : <Check size={16} />}Enregistrer la direction créative
        </button>
        <span className="editorial-note" role="status">
          {dirty
            ? "Modifications non enregistrées"
            : saved
              ? "Direction enregistrée. Les contenus précédents sont conservés."
              : "Chaque modification conserve son auteur, sa date et les anciennes réponses dans l’historique."}
        </span>
      </div>
      <p className="editorial-note">
        Les faits et caractéristiques à préserver de la fiche produit restent prioritaires. Les consignes de vidéo
        guident le tournage et l’agence ; le montage automatique applique les réglages du style, sans interpréter ces
        réponses.
      </p>
    </section>
  );
}
