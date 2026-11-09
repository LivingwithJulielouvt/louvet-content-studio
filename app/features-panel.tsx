"use client";
// Agence › Fonctions visibles : allumer ou éteindre une fonction pour toutes les clientes, sans toucher au code.
import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
type Row = Record<string, any>;

const ITEMS: { key: string; title: string; text: string }[] = [
  {
    key: "opportunities",
    title: "Opportunités & Marques du studio",
    text: "Créatrices : la sélection de marques à contacter et les marques du studio ouvertes aux collaborations. À allumer quand la liste est remplie.",
  },
  {
    key: "testVersions",
    title: "Versions à tester",
    text: "Créatrices : 1 vidéo, plusieurs versions à tester en Reels d’essai. À allumer après un essai sur iPhone.",
  },
  { key: "brandCollabs", title: "Collaborations côté marques", text: "Marques : accepter des propositions de créatrices et décrire leur offre." },
  { key: "reels", title: "Réductions « Un Reel avec Julie »", text: "Toutes les clientes : déclarer un Reel fait avec @withjulielouvet pour une réduction." },
  { key: "recreate", title: "Recréer ce post", text: "Toutes les clientes : envoyer un Reel ou un post Instagram pour le recréer avec leurs contenus." },
  { key: "siteImport", title: "Importer mon site", text: "Toutes les clientes : préremplir leur marque à partir de leur site web." },
];

export default function FeaturesPanel({ data, refresh }: { data: Row; refresh: () => unknown }) {
  const [features, setFeatures] = useState<Row>(data.features || {});
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [saved, setSaved] = useState("");
  async function save(patch: Row, ok: string) {
    setBusy(Object.keys(patch)[0] || "x");
    setError("");
    setSaved("");
    try {
      const r = await fetch("/api/studio/features-save", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Studio-Request": "1" },
        body: JSON.stringify({ features: patch }),
      });
      const d: Row = await r.json();
      if (!r.ok) throw Error(d.error || "Le réglage n’a pas été enregistré.");
      setFeatures(d.features);
      setSaved(ok);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  const mode = features.opportunitiesMode || "countdown",
    openAt = features.opportunitiesOpenAt ? new Date(features.opportunitiesOpenAt) : null,
    localDate = openAt
      ? new Date(openAt.getTime() - openAt.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      : "",
    daysLeft = openAt ? Math.ceil((openAt.getTime() - Date.now()) / 86400000) : null;
  async function toggle(key: string, value: boolean) {
    setBusy(key);
    setError("");
    setSaved("");
    try {
      const r = await fetch("/api/studio/features-save", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Studio-Request": "1" },
        body: JSON.stringify({ features: { [key]: value } }),
      });
      const d: Row = await r.json();
      if (!r.ok) throw Error(d.error || "Le réglage n’a pas été enregistré.");
      setFeatures(d.features);
      setSaved(value ? "Fonction visible par les clientes." : "Fonction masquée pour les clientes.");
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="panel features-panel">
      <span className="eyebrow">AGENCE</span>
      <h2>
        <SlidersHorizontal size={22} /> Fonctions visibles par les clientes
      </h2>
      <p className="muted">
        Une fonction éteinte disparaît des menus de toutes les clientes et ses actions sont refusées. Vous gardez l’accès pour
        la préparer et la tester.
      </p>
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="video-message">
          {saved}
        </p>
      )}
      <ul className="features-list">
        <li className="features-opp">
          <div>
            <b>Opportunités & Marques du studio</b>
            <p>
              Créatrices : la sélection de marques à contacter. En compte à rebours, elles voient la date d’ouverture
              (badge « J-{daysLeft !== null && daysLeft > 0 ? daysLeft : 0} » dans leur menu) et peuvent demander à être prévenues ; les
              marques voient un encart « Bientôt » dans Collaborations. À la date choisie, Opportunités s’ouvre toute
              seule.
            </p>
            {mode === "countdown" && (
              <label className="features-date">
                Ouverture le
                <input
                  type="datetime-local"
                  value={localDate}
                  disabled={!!busy}
                  onChange={(e) =>
                    e.target.value &&
                    save({ opportunitiesOpenAt: new Date(e.target.value).toISOString() }, "Date d’ouverture enregistrée.")
                  }
                />
              </label>
            )}
            {mode === "countdown" && features.opportunities && <p className="video-message">La date est passée : Opportunités est ouvert.</p>}
          </div>
          <div className="seg" role="radiogroup" aria-label="Opportunités">
            {(
              [
                ["hidden", "Masqué"],
                ["countdown", "Compte à rebours"],
                ["open", "Ouvert"],
              ] as [string, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                className={mode === m ? "active" : ""}
                disabled={!!busy}
                onClick={() => save({ opportunitiesMode: m }, m === "open" ? "Opportunités est ouvert." : m === "hidden" ? "Opportunités est masqué." : "Compte à rebours activé.")}
              >
                {label}
              </button>
            ))}
          </div>
        </li>
        {ITEMS.filter((it) => it.key !== "opportunities").map((it) => (
          <li key={it.key}>
            <div>
              <b>{it.title}</b>
              <p>{it.text}</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                role="switch"
                aria-label={it.title}
                checked={!!features[it.key]}
                disabled={!!busy}
                onChange={(e) => toggle(it.key, e.target.checked)}
              />
              <span>{features[it.key] ? "Visible" : "Masquée"}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
