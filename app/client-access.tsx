"use client";
// Agence : options ouvertes client par client (montage vidéo, opportunités, collaborations…) et création d'invitations bêta.
// Texte réservé à l'agence : en français.
import { useState } from "react";
import { Check, Copy, KeyRound, Loader2, SlidersHorizontal } from "lucide-react";
import { CLIENT_OPTIONS } from "../lib/features.mjs";

type Row = Record<string, any>;
async function call(path: string, body: any) {
  const r = await fetch("/api/studio/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Studio-Request": "1" },
    body: JSON.stringify(body),
  });
  const d: any = await r.json();
  if (!r.ok) throw new Error(d.error);
  return d;
}

/** Valeur affichée : le réglage propre à l'espace, sinon le réglage global (Fonctions visibles), sinon le défaut. */
function effective(key: string, access: Row, globalFeatures: Row) {
  if (typeof access?.[key] === "boolean") return access[key];
  if (key === "video") return false;
  if (key === "opportunities") return globalFeatures?.opportunitiesMode === "open";
  if (typeof globalFeatures?.[key] === "boolean") return globalFeatures[key];
  return !!CLIENT_OPTIONS.find((o: Row) => o.key === key)?.default;
}

function Toggles({ value, onChange, disabled }: { value: Row; onChange: (key: string, on: boolean) => void; disabled?: boolean }) {
  return (
    <div className="client-access-list">
      {CLIENT_OPTIONS.map((o: Row) => (
        <label className="optional-toggle" key={o.key}>
          <input type="checkbox" disabled={disabled} checked={!!value[o.key]} onChange={(e) => onChange(o.key, e.target.checked)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

/** Marque & accès : options de cet espace, modifiables à tout moment. */
export function ClientAccessPanel({ client, data, refresh }: { client: Row; data: Row; refresh: () => Promise<any> }) {
  const access = client.config?.access || {};
  const current = Object.fromEntries(CLIENT_OPTIONS.map((o: Row) => [o.key, effective(o.key, access, data.features || {})]));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ok, setOk] = useState("");
  async function change(key: string, on: boolean) {
    setBusy(true);
    setError("");
    setOk("");
    try {
      // On enregistre toutes les options affichées, pour que l'espace ne dépende plus des réglages globaux.
      await call("client-access-save", { client_id: client.id, access: { ...current, [key]: on } });
      await refresh();
      setOk("Options mises à jour. La cliente les voit dès son prochain chargement.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel client-access">
      <h3>
        <SlidersHorizontal size={18} /> Options ouvertes à cet espace
      </h3>
      <p className="muted">Cochez ce que ce client peut utiliser. Vous pouvez changer à tout moment ; l’agence garde toujours l’accès à tout.</p>
      <Toggles value={current} onChange={change} disabled={busy} />
      {busy && <Loader2 className="spin" size={16} />}
      {ok && (
        <p className="muted">
          <Check size={14} /> {ok}
        </p>
      )}
      {error && (
        <div className="alert error" role="alert">
          <span>{error}</span>
        </div>
      )}
    </section>
  );
}

/** Bêta : créer un espace de test et son code d'invitation, avec ses options choisies dès le départ. */
export function BetaInviteCreator({ data, refresh }: { data: Row; refresh: () => Promise<any> }) {
  const defaults = Object.fromEntries(CLIENT_OPTIONS.map((o: Row) => [o.key, effective(o.key, {}, data.features || {})]));
  const [name, setName] = useState(""),
    [type, setType] = useState("brand"),
    [language, setLanguage] = useState("fr"),
    [opts, setOpts] = useState<Row>(defaults),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [created, setCreated] = useState<Row[]>([]),
    [copied, setCopied] = useState("");
  async function create() {
    setBusy(true);
    setError("");
    try {
      const d = await call("beta-invite-create", { name, workspaceType: type, language, access: opts });
      setCreated([{ ...d, type }, ...created]);
      setName("");
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel beta-invite-creator">
      <span className="eyebrow">NOUVEL ESPACE DE TEST</span>
      <h2>
        <KeyRound size={20} /> Créer une invitation
      </h2>
      <p className="muted">Le code n’est affiché qu’une fois : copiez-le et envoyez-le au testeur. Valable 60 jours, pour un seul compte.</p>
      <div className="form-grid">
        <label>
          Nom de l’espace
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Boulangerie Rosa" maxLength={120} />
        </label>
        <label>
          Type (définitif)
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="brand">Marque</option>
            <option value="creator">Créatrice de contenu</option>
          </select>
        </label>
        <label>
          Langue
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="fr">Français</option>
            <option value="es">Espagnol</option>
            <option value="en">Anglais</option>
          </select>
        </label>
      </div>
      <h3>Options ouvertes dès le départ</h3>
      <Toggles value={opts} onChange={(k, on) => setOpts({ ...opts, [k]: on })} disabled={busy} />
      <button className="button primary" disabled={busy || !name.trim()} onClick={create}>
        {busy ? <Loader2 className="spin" size={15} /> : <KeyRound size={15} />} Créer l’espace et le code
      </button>
      {error && (
        <div className="alert error" role="alert">
          <span>{error}</span>
        </div>
      )}
      {created.map((c) => (
        <div className="beta-invite-row" key={c.id}>
          <b>{c.name}</b>
          <code>{c.code}</code>
          <button
            className="button secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(c.code);
                setCopied(c.id);
              } catch {}
            }}
          >
            {copied === c.id ? <Check size={14} /> : <Copy size={14} />} {copied === c.id ? "Copié" : "Copier"}
          </button>
        </div>
      ))}
    </section>
  );
}
