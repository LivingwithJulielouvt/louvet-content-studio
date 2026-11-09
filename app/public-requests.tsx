"use client";
import { questionsForWorkspace } from "../lib/client-intake.mjs";
import { PRICING, studioPrice } from "../lib/pricing.mjs";
const languageName: Record<string, string> = { fr: "Français", es: "Espagnol", en: "Anglais" };
export default function PublicRequests({ requests }: { requests: any[] }) {
  return (
    <section className="panel">
      <h3>
        Demandes depuis l’accueil <span className="status review">{requests.length}</span>
      </h3>
      <p className="muted">
        Les demandes sont publiques, sans compte préalable. Aucune demande n’ouvre automatiquement un accès client. La
        bêta reste sur invitation.
      </p>
      {!requests.length && <p>Aucune demande reçue depuis la page publique.</p>}
      {requests.map((r) => (
        <details className="public-request" key={r.id}>
          <summary>
            <b>{r.name}</b>
            <span>
              {r.first_name} · {r.email}
            </span>
            <small>
              {r.language.toUpperCase()} ({languageName[r.language] || r.language}) ·{" "}
              {r.answers?._country && (PRICING as any)[r.answers._country]
                ? `${(PRICING as any)[r.answers._country].label.fr} · studio à ${studioPrice(r.answers._country, "fr")}/mois · `
                : "Pays non précisé · "}
              {new Date(r.created).toLocaleDateString("fr-FR")} · Demande reçue :{" "}
              {(
                {
                  held: "e-mail en attente de ton accord",
                  sent: "e-mail envoyé",
                  sending: "transmission en cours",
                  failed: "envoi à reprendre",
                  uncertain: "vérifier dans Brevo",
                } as any
              )[r.mail_status] || r.mail_status}
            </small>
          </summary>
          {r.mail_error && <p>{r.mail_error}</p>}
          {r.answers?._instagram && (
            <div className="intake-answer">
              <b>Instagram ou site</b>
              <p>{r.answers._instagram}</p>
            </div>
          )}
          {r.answers?._message && (
            <div className="intake-answer">
              <b>Message</b>
              <p>{r.answers._message}</p>
            </div>
          )}
          {/* Les demandes envoyées avec le formulaire court n'ont pas de questionnaire : il sera rempli dans le studio. */}
          {questionsForWorkspace({ workspaceType: r.workspace_type })
            .filter((q) => r.answers?.[q.key])
            .map((q) => (
              <div className="intake-answer" key={q.key}>
                <b>{q.fr[0]}</b>
                <p>{r.answers[q.key]}</p>
              </div>
            ))}
          <p className="editorial-note">
            Pour un accès bêta, attribuez une invitation disponible. Pour l’offre payante, vérifiez l’adresse e-mail
            Supabase du client avant d’autoriser son espace. Le dépôt de cette demande ne crée aucun abonnement.
          </p>
        </details>
      ))}
    </section>
  );
}
