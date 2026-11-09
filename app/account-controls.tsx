"use client";
import { useState } from "react";
export default function AccountControls({
  client,
  lifecycle,
  onDone,
}: {
  client: any;
  lifecycle: any;
  onDone: () => Promise<any>;
}) {
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState("deactivate"),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [cancelSub, setCancelSub] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/studio/client-lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Studio-Request": "1" },
        body: JSON.stringify({ client_id: client.id, mode, confirm_name: name, cancel_subscription: mode === "delete" && cancelSub }),
      });
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      if (d.pending) {
        setError(d.message);
        await onDone();
        return;
      }
      setOpen(false);
      setName("");
      await onDone();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="account-controls">
        <div>
          <b>{lifecycle ? "Suppression engagée" : client.active ? "Compte actif" : "Compte désactivé"}</b>
          <small>
            {lifecycle
              ? "L’accès est fermé. Reprenez l’effacement pour terminer."
              : client.active
                ? "Vous gardez la main sur cet espace."
                : "Les données et les images sont conservées."}
          </small>
        </div>
        <button
          className="button danger-outline"
          onClick={() => {
            setMode(lifecycle ? "delete" : client.active ? "deactivate" : "reactivate");
            setName("");
            setError("");
            setOpen(true);
          }}
        >
          {lifecycle ? "Reprendre la suppression" : "Supprimer le compte"}
        </button>
      </div>
      {open && (
        <div className="overlay" onClick={() => !busy && setOpen(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Supprimer le compte"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="icon-button modal-x" disabled={busy} onClick={() => setOpen(false)} aria-label="Fermer">
              ×
            </button>
            <span className="eyebrow">GESTION DU COMPTE</span>
            <h2>{client.name}</h2>
            <form onSubmit={submit}>
              {!lifecycle && (
                <label className="field">
                  <span>Que souhaitez-vous faire ?</span>
                  <select value={mode} onChange={(e) => setMode(e.target.value)}>
                    {client.active ? (
                      <option value="deactivate">Désactiver — réversible</option>
                    ) : (
                      <option value="reactivate">Réactiver le compte</option>
                    )}
                    <option value="delete">Supprimer définitivement</option>
                  </select>
                </label>
              )}
              <p>
                {mode === "delete"
                  ? "Cette action ferme le compte et efface définitivement ses données et ses images stockées dans le studio. Elle ne peut pas être annulée."
                  : mode === "deactivate"
                    ? "Le client ne pourra plus ouvrir son espace. Ses données et images seront conservées ; vous pourrez réactiver le compte."
                    : "Le client retrouvera son espace et les données conservées."}
              </p>
              {mode === "delete" && (
                <label className="check-row">
                  <input type="checkbox" checked={cancelSub} onChange={(e) => setCancelSub(e.target.checked)} />
                  <span>
                    Résilier l’abonnement Stripe maintenant (sans remboursement). Sans cette case, la suppression est
                    refusée tant qu’un abonnement est actif.
                  </span>
                </label>
              )}
              <label className="field">
                <span>
                  Pour confirmer, tapez exactement : <b>{client.name}</b>
                </span>
                <input autoComplete="off" autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              {error && (
                <p role="alert" className="error-inline">
                  {error}
                </p>
              )}
              <div className="edit-actions">
                <button type="button" className="button secondary" disabled={busy} onClick={() => setOpen(false)}>
                  Annuler
                </button>
                <button type="submit" className="button primary" disabled={busy || name.trim() !== client.name}>
                  {busy
                    ? "Traitement…"
                    : mode === "delete"
                      ? "Confirmer la suppression définitive"
                      : mode === "reactivate"
                        ? "Réactiver le compte"
                        : "Désactiver le compte"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
