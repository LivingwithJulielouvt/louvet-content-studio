"use client";
import { useEffect, useState } from "react";
import { CreditCard, Check, RefreshCw, ArrowRight, LockKeyhole, Receipt } from "lucide-react";
import { useL, useLang, dateLocale, pick, type Lang } from "../lib/i18n";
import { PRICING as PRICING_RAW, REGIONS, normRegion, studioPrice, formatMoney } from "../lib/pricing.mjs";
const PRICING = PRICING_RAW as Record<string, any>;
type Row = Record<string, any>;
const date = (n: number, loc = "fr-FR") =>
  n
    ? new Date(n * 1000).toLocaleDateString(loc, {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "America/Monterrey",
      })
    : "—";
async function api(path: string, b: Row) {
  const r = await fetch("/api/studio/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Studio-Request": "1" },
    body: JSON.stringify(b),
  });
  const d: any = await r.json();
  if (!r.ok) throw Error(d.error || "Cette opération n’a pas abouti.");
  return d;
}
const labels: Row = {
  paid: "À jour",
  grace: "Paiement à régulariser",
  suspended: "Créations suspendues",
  payment_required: "Premier paiement attendu",
  verification: "Vérification nécessaire",
  exempt: "Paiement géré par l’agence",
  exception: "Délai accordé par l’agence",
};
const labelsEs: Row = {
  paid: "Al día",
  grace: "Pago pendiente",
  suspended: "Creaciones suspendidas",
  payment_required: "Primer pago pendiente",
  verification: "Verificación necesaria",
  exempt: "Pago gestionado por la agencia",
  exception: "Plazo otorgado por la agencia",
};
const labelsEn: Row = {
  paid: "Up to date",
  grace: "Payment due",
  suspended: "Creations paused",
  payment_required: "First payment due",
  verification: "Check needed",
  exempt: "Payment handled by your agency",
  exception: "Extension granted by your agency",
};
const stateLabel = (state: string, lang: Lang) => pick(lang, labels, labelsEs, labelsEn)[state];
// Le serveur rédige le message d'accès en français ; on le traduit à partir de l'état pour l'espagnol et l'anglais.
function accessMessage(access: Row | undefined, lang: Lang) {
  if (!access) return "";
  if (lang === "fr") return access.message;
  const until = access.until ? date(access.until, dateLocale(lang)) : "";
  const m: Row = {
    exempt: pick(lang, "", "Tu agencia gestiona directamente este espacio.", "Your agency manages this space directly."),
    exception: pick(
      lang,
      "",
      `Tu agencia te dio un plazo hasta el ${until}.`,
      `Your agency has given you until ${until}.`,
    ),
    verification: pick(
      lang,
      "",
      "No podemos verificar tu suscripción en este momento. Tus contenidos se conservan. Inténtalo de nuevo o contacta a tu agencia.",
      "We can’t check your subscription right now. Your content is safe. Try again or contact your agency.",
    ),
    suspended: pick(
      lang,
      "",
      "Tu suscripción ya no permite crear nuevos contenidos. Tus contenidos existentes se conservan. Para retomar tus creaciones, actualiza tu pago.",
      "Your subscription no longer allows new creations. Your existing content is safe. To start creating again, please update your payment.",
    ),
    paid: pick(lang, "", "Tu suscripción está al día.", "Your subscription is up to date."),
    grace: pick(
      lang,
      "",
      `Tu renovación está pendiente. Regulariza tu pago antes del ${until}.`,
      `Your renewal is pending. Please update your payment before ${until}.`,
    ),
    payment_required: pick(
      lang,
      "",
      "Tu estudio está listo. Paga tu suscripción para empezar a crear.",
      "Your studio is ready. Pay for your subscription to start creating.",
    ),
  };
  return m[access.state] || access.message;
}
export function BillingNotice({ billing, onOpen }: { billing: Row; onOpen: () => void }) {
  const lang = useLang(),
    L = useL();
  if (!billing?.enabled || ["paid", "exempt"].includes(billing.access.state)) return null;
  return (
    <div className={"billing-notice " + (!billing.access.allowed ? "blocked" : "")} role="status">
      <LockKeyhole size={20} />
      <div>
        <b>{stateLabel(billing.access.state, lang)}</b>
        <p>{accessMessage(billing.access, lang)}</p>
      </div>
      <button className="button secondary" onClick={onOpen}>
        {L("Mon abonnement", "Mi suscripción", "My subscription")} <ArrowRight size={16} />
      </button>
    </div>
  );
}
export default function BillingPanel({
  billing,
  client,
  agency,
  refresh,
}: {
  billing: Row;
  client: Row;
  agency: boolean;
  refresh: () => Promise<any>;
}) {
  const record = billing?.record || {},
    [form, setForm] = useState<Row>({}),
    [link, setLink] = useState<Row>({ customer_id: "", subscription_id: "" }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [plan, setPlan] = useState<"month" | "year">("month");
  const L = useL(),
    lang = useLang(),
    loc = dateLocale(lang),
    region = normRegion(client.config?.country);
  useEffect(() => {
    setForm({
      enabled: !!record.enabled,
      price_id:
        record.price_id ||
        billing?.readiness?.regionalOffers?.[region]?.priceId ||
        billing?.readiness?.defaultPriceId ||
        "",
      grace_days: record.grace_days ?? 3,
      monthly_credits: record.monthly_credits ?? client.quota_limit ?? 30,
      override_until: record.override_until ? new Date(record.override_until * 1000).toISOString().slice(0, 16) : "",
      override_reason: record.override_reason || "",
      version: record.version ?? 1,
    });
    setError("");
    setMessage("");
  }, [client.id, record.version]);
  async function act(path: string, body: Row, redirect = false) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await api(path, { ...body, client_id: client.id });
      if (redirect) {
        const u = new URL(r.url);
        if (u.protocol !== "https:" || !["checkout.stripe.com", "billing.stripe.com"].includes(u.hostname))
          throw Error(L("Adresse de paiement invalide.", "Dirección de pago no válida.", "Invalid payment address."));
        window.location.assign(u.href);
      } else {
        await refresh();
        setMessage(L("Enregistré.", "Guardado.", "Saved."));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const set = (key: string, value: any) => setForm((old) => ({ ...old, [key]: value }));
  // Prix affiché : celui du tarif Stripe de l'espace s'il est connu, sinon celui du pays du client.
  const offer = billing?.offer,
    local = billing?.localPrice || { amount: PRICING[region].studio, currency: PRICING[region].currency };
  const priceLabel = offer?.amount
    ? formatMoney(offer.amount / 100, String(offer.currency || local.currency).toUpperCase(), lang)
    : formatMoney(local.amount, local.currency, lang);
  const subscribed = !!billing?.hasSubscription && !["canceled", "incomplete_expired"].includes(billing?.status);
  // Annuel : 10 mois payés, 2 mois offerts. Proposé seulement si l'agence a créé le tarif annuel du pays.
  const yearlyAmount = billing?.localPrice?.yearly ?? PRICING[region].studioYear,
    yearlyLabel = formatMoney(yearlyAmount, local.currency, lang),
    yearlyPerMonth = formatMoney(Math.floor(yearlyAmount / 12), local.currency, lang),
    onYear = subscribed ? billing?.interval === "year" : plan === "year" && !!billing?.yearlyReady,
    showToggle = !agency && !subscribed && !!billing?.yearlyReady;
  // États où le client doit agir (paiement en retard, accès coupé, vérification impossible) : message clair en haut.
  const issue = !!billing?.enabled && ["grace", "suspended", "verification"].includes(billing?.access?.state);
  if (billing?.mode === "beta")
    return (
      <section className="panel billing-panel">
        <span className="eyebrow">{L("VERSION BÊTA", "VERSIÓN BETA", "BETA VERSION")}</span>
        <h2>{L("Votre accès de test est gratuit.", "Tu acceso de prueba es gratuito.", "Your test access is free.")}</h2>
        <p>
          {L(
            "Aucun paiement, aucune carte bancaire et aucun abonnement Stripe ne sont demandés pendant cette bêta.",
            "Durante esta beta no se pide ningún pago, tarjeta ni suscripción de Stripe.",
            "No payment, card or Stripe subscription is needed during this beta.",
          )}
        </p>
        <p>
          {L(
            "Votre espace comprend 20 tentatives d’image au total, corrections et reprises comprises. Vos contenus restent privés dans votre espace.",
            "Tu espacio incluye 20 intentos de imagen en total, correcciones y repeticiones incluidas. Tus contenidos siguen siendo privados en tu espacio.",
            "Your space includes 20 image attempts in total, edits and retries included. Your content stays private in your space.",
          )}
        </p>
      </section>
    );
  return (
    <section className="billing-panel">
      <div className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {agency ? "PAIEMENTS · " + client.name : L("VOTRE FORFAIT", "TU PLAN", "YOUR PLAN")}
            </span>
            <h2>
              <CreditCard size={24} />{" "}
              {agency ? "Paiement et accès au studio" : L("Mon abonnement", "Mi suscripción", "My subscription")}
            </h2>
          </div>
          {(agency || (billing?.enabled && !issue)) && stateLabel(billing?.access?.state, lang) && (
            <span className={"status" + (issue ? " warn" : "")}>{stateLabel(billing?.access?.state, lang)}</span>
          )}
        </div>
        {error && (
          <p role="alert" className="alert error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="video-message">
            <Check size={16} />
            {message}
          </p>
        )}
        {agency && (
          <p>
            {accessMessage(billing?.access, lang) || "L’agence gère l’accès de ce client au studio."}
          </p>
        )}
        {!agency && issue && (
          <p role="status" className="alert error">
            {accessMessage(billing?.access, lang)}
          </p>
        )}
        {!agency && (
          <div className="billing-offer billing-price">
            <span className="billing-amount">
              {onYear ? (subscribed ? priceLabel : yearlyLabel) : priceLabel}{" "}
              <small>{onYear ? L("/ an", "/ año", "/ year") : L("/ mois", "/ mes", "/ month")}</small>
            </span>
            {onYear && (
              <small className="billing-lines">
                {L(`soit ${yearlyPerMonth}/mois · 2 mois offerts`, `o sea ${yearlyPerMonth}/mes · 2 meses gratis`, `just ${yearlyPerMonth}/month · 2 months free`)}
              </small>
            )}
            <small className="billing-lines">
              {[
                billing?.enabled && billing?.paidUntil && subscribed && billing?.access?.state === "paid"
                  ? L(`Payé jusqu’au ${date(billing.paidUntil, loc)}`, `Pagado hasta el ${date(billing.paidUntil, loc)}`, `Paid through ${date(billing.paidUntil, loc)}`)
                  : "",
                onYear
                  ? L("Résiliable, effet à l’échéance annuelle", "Cancelable, efectivo al vencimiento anual", "Cancel anytime, ends at the yearly renewal")
                  : L("Sans engagement", "Sin permanencia", "No commitment"),
              ]
                .filter(Boolean)
                .join(" · ")}
            </small>
          </div>
        )}
        {!agency && Number(client?.quota_limit) > 0 && (
          <p className="billing-allowance">
            {(() => {
              const limit = Number(client.quota_limit) || 0,
                left = Math.max(0, limit - (Number(client.quota_used) || 0));
              return L(
                `${limit} visuels en plus ce mois-ci · il vous en reste ${left}`,
                `${limit} imágenes extra este mes · te quedan ${left}`,
                `${limit} extra visuals this month · ${left} left`,
              );
            })()}
          </p>
        )}
        {agency && (billing?.offer || billing?.readiness?.offer) && (
          <div className="billing-offer">
            <b>{(billing.offer || billing.readiness.offer).name}</b>
            <span>
              {formatMoney(
                (billing.offer || billing.readiness.offer).amount / 100,
                String((billing.offer || billing.readiness.offer).currency || "USD").toUpperCase(),
                "fr",
              )}{" "}
              / mois
            </span>
            {agency && billing.readiness.sourcePaymentLink && (
              <a
                className="text-link"
                href={billing.readiness.sourcePaymentLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                Voir le lien Stripe d’origine
              </a>
            )}
          </div>
        )}
        {billing?.mode === "test" && (
          <div className="billing-notice">
            <b>{L("Mode test Stripe", "Modo de prueba de Stripe", "Stripe test mode")}</b>
            <p>
              {L(
                "Les paiements de cet espace sont simulés. Aucune carte réelle ne doit être utilisée pour ces essais.",
                "Los pagos de este espacio son simulados. No uses ninguna tarjeta real para estas pruebas.",
                "Payments in this space are simulated. Don’t use a real card for these tests.",
              )}
            </p>
          </div>
        )}
        {agency && billing?.enabled && (
          <div className="billing-facts">
            <div>
              <span>{L("Période payée jusqu’au", "Periodo pagado hasta el", "Paid through")}</span>
              <b>{date(billing.paidUntil, loc)}</b>
            </div>
            <div>
              <span>{L("Crédits photo par période payée", "Créditos de foto por periodo pagado", "Photo credits per paid period")}</span>
              <b>{billing.monthlyCredits}</b>
            </div>
            <div>
              <span>{L("Délai après l’échéance", "Plazo después del vencimiento", "Grace period after due date")}</span>
              <b>
                {billing.graceDays} {L("jour(s)", "día(s)", "day(s)")}
              </b>
            </div>
          </div>
        )}
        {!agency && (
          <>
            {billing?.enabled && billing.configured ? (
              <div className="edit-actions">
                {showToggle && (
                  <div className="plan-toggle" role="radiogroup" aria-label={L("Rythme de paiement", "Frecuencia de pago", "Billing period")}>
                    <button type="button" role="radio" aria-checked={plan === "month"} className={plan === "month" ? "active" : ""} onClick={() => setPlan("month")}>
                      {L("Mensuel", "Mensual", "Monthly")}
                    </button>
                    <button type="button" role="radio" aria-checked={plan === "year"} className={plan === "year" ? "active" : ""} onClick={() => setPlan("year")}>
                      {L("Annuel", "Anual", "Yearly")} <em>{L("−2 mois", "−2 meses", "2 months free")}</em>
                    </button>
                  </div>
                )}
                {!subscribed && billing.checkoutReady !== false && (
                  <button className="button primary" disabled={busy} onClick={() => act("billing-checkout", { interval: onYear ? "year" : "month" }, true)}>
                    <CreditCard size={17} />
                    {onYear
                      ? L(`S’abonner · ${yearlyLabel} / an`, `Suscribirme · ${yearlyLabel} / año`, `Subscribe · ${yearlyLabel} / year`)
                      : L(`S’abonner · ${priceLabel} / mois`, `Suscribirme · ${priceLabel} / mes`, `Subscribe · ${priceLabel} / month`)}
                  </button>
                )}
                {!subscribed && billing.checkoutReady === false && (
                  <p className="muted">
                    {L(
                      "Le paiement en ligne n’est pas encore ouvert pour votre pays. Julie vous contacte pour finaliser votre abonnement.",
                      "El pago en línea aún no está abierto para tu país. Julie te contactará para finalizar tu suscripción.",
                      "Online payment isn’t open for your country yet. Julie will contact you to finish your subscription.",
                    )}
                  </p>
                )}
                {(subscribed || billing.hasCustomer) && (
                  <button
                    className={"button " + (subscribed ? "primary" : "secondary")}
                    disabled={busy}
                    onClick={() => act("billing-portal", {}, true)}
                  >
                    <Receipt size={17} />
                    {L(
                      "Gérer mon abonnement (factures, carte, résiliation)",
                      "Gestionar mi suscripción (facturas, tarjeta, cancelación)",
                      "Manage my plan (invoices, card, cancellation)",
                    )}
                  </button>
                )}
                {(issue || (!subscribed && billing.hasCustomer)) && (
                  <button className="button secondary" disabled={busy} onClick={() => act("billing-sync", {})}>
                    <RefreshCw size={16} />
                    {L("J’ai déjà payé : actualiser", "Ya pagué: actualizar", "I’ve already paid: refresh")}
                  </button>
                )}
              </div>
            ) : (
              <p>
                {billing?.enabled
                  ? L(
                      "Le paiement en ligne sera bientôt disponible ici. Une question\u00a0? Écrivez à l’agence.",
                      "El pago en línea estará disponible aquí muy pronto. ¿Alguna pregunta? Escribe a la agencia.",
                      "Online payment will be available here soon. Any question? Message the agency.",
                    )
                  : L(
                      "Votre abonnement est géré directement avec l’agence. Une question\u00a0? Écrivez-nous.",
                      "Tu suscripción se gestiona directamente con la agencia. ¿Alguna pregunta? Escríbenos.",
                      "Your plan is handled directly with the agency. Any question? Message us.",
                    )}
              </p>
            )}
            <p className="editorial-note">
              {billing?.enabled && billing.configured
                ? L(
                    "Paiement sécurisé par Stripe. Vos factures arrivent aussi par e-mail chaque mois. Vos visuels, vidéos et votre calendrier restent conservés.",
                    "Pago seguro con Stripe. Tus facturas también llegan por correo cada mes. Tus imágenes, videos y calendario se conservan.",
                    "Secure payment by Stripe. Your invoices are also emailed every month. Your visuals, videos and calendar are kept.",
                  )
                : L(
                    "Vos visuels, vidéos et votre calendrier restent conservés.",
                    "Tus imágenes, videos y calendario se conservan.",
                    "Your visuals, videos and calendar are kept.",
                  )}
            </p>
          </>
        )}
        {agency && (
          <>
            <div className="billing-connection">
              <b>
                {billing?.configured ? "Connexion serveur Stripe configurée" : "Connexion serveur Stripe à configurer"}
              </b>
              <p>
                Renseigner dans les secrets serveur du site : <code>STRIPE_SECRET_KEY</code>. L’adresse{" "}
                <code>STUDIO_URL</code> est déjà définie. Ne collez aucune clé dans les champs ci-dessous.
              </p>
              <p>
                {billing?.readiness?.productionReady
                  ? "Réception des notifications déclarée prête."
                  : "Notifications Stripe à raccorder avant activation des paiements réels."}
              </p>
              {billing?.readiness?.taxWarning && (
                <p>
                  Le lien d’origine utilise Stripe Tax. Les immatriculations actives et le traitement des taxes doivent
                  être vérifiés avant encaissement. Aucun réglage fiscal n’est modifié par cet écran.
                </p>
              )}
              <p>
                Le site reste privé : l’état Stripe est vérifié à l’ouverture et avant chaque nouvelle création. Les
                notifications directes Stripe nécessitent une adresse accessible au fournisseur ; aucune ouverture
                publique du site n’est effectuée ici.
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act("billing-settings", {
                  ...form,
                  grace_days: Number(form.grace_days),
                  monthly_credits: Number(form.monthly_credits),
                  override_until: form.override_until ? new Date(form.override_until + "Z").toISOString() : null,
                });
              }}
            >
              <label className="optional-toggle">
                <input type="checkbox" checked={!!form.enabled} onChange={(e) => set("enabled", e.target.checked)} />
                Exiger un abonnement Stripe pour créer dans cet espace
              </label>
              <p className="editorial-note">
                Activer cette option impose un premier paiement confirmé, puis suspend les nouvelles créations après le
                délai d’impayé. Les contenus existants restent consultables. Cette option est désactivée par défaut.
              </p>
              <label className="field">
                <span>Tarif mensuel Stripe · identifiant price_…</span>
                <input
                  value={form.price_id || ""}
                  placeholder="price_…"
                  onChange={(e) => set("price_id", e.target.value)}
                />
                <small>
                  Créer le tarif dans Stripe ou utiliser un tarif mensuel fixe existant. Aucun montant n’est fixé ni
                  facturé automatiquement par cet écran.
                </small>
                <small>
                  Tarifs du studio :{" "}
                  {REGIONS.map((r) => PRICING[r].label.fr + " " + studioPrice(r, "fr")).join(" · ")} — prix Stripe :{" "}
                  <code>STRIPE_PRICE_ID_FR</code> / <code>_MX</code> / <code>_US</code>. Pays de ce client :{" "}
                  <b>{PRICING[region].label.fr}</b>.
                </small>
                <small>
                  Configurés :{" "}
                  {REGIONS.map(
                    (r) =>
                      PRICING[r].label.fr + (billing?.readiness?.regionalOffers?.[r] ? " ✓" : " — à créer"),
                  ).join(" · ")}
                </small>
              </label>
              <div className="form-row">
                <label className="field">
                  <span>Délai de régularisation · jours</span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={form.grace_days ?? 3}
                    onChange={(e) => set("grace_days", e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Crédits photo renouvelés par paiement mensuel</span>
                  <input
                    type="number"
                    min="1"
                    max="100000"
                    value={form.monthly_credits ?? 30}
                    onChange={(e) => set("monthly_credits", e.target.value)}
                  />
                </label>
              </div>
              <details className="simple-options">
                <summary>Accorder une exception temporaire</summary>
                <p>
                  Pour un virement déjà reçu ou un délai convenu. L’exception ne débite aucune carte et ne renouvelle
                  pas les crédits. Elle n’ouvre pas un studio encore en préparation.
                </p>
                <label className="field">
                  <span>Fin de l’exception · date et heure UTC</span>
                  <input
                    type="datetime-local"
                    value={form.override_until || ""}
                    onChange={(e) => set("override_until", e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Motif · obligatoire avec une date</span>
                  <textarea
                    maxLength={500}
                    value={form.override_reason || ""}
                    onChange={(e) => set("override_reason", e.target.value)}
                  />
                </label>
                <small>Laisser la date vide pour retirer l’exception.</small>
              </details>
              <button className="button primary" type="submit" disabled={busy}>
                Enregistrer les règles de paiement
              </button>
            </form>
            <div className="edit-actions">
              <button
                className="button secondary"
                disabled={busy || !record.enabled}
                onClick={() => act("billing-sync", {})}
              >
                <RefreshCw size={16} />
                Vérifier maintenant dans Stripe
              </button>
              {record.customer_id && (
                <button className="button secondary" disabled={busy} onClick={() => act("billing-portal", {}, true)}>
                  Ouvrir le portail de ce client
                </button>
              )}
            </div>
            {record.sync_error && <p className="alert error">{record.sync_error}</p>}
            <div className="billing-ids">
              <span>
                Client Stripe : <code>{record.customer_id || "Non lié"}</code>
              </span>
              <span>
                Abonnement : <code>{record.subscription_id || "Non lié"}</code>
              </span>
              <span>
                Dernière vérification :{" "}
                {record.synced_at ? new Date(record.synced_at * 1000).toLocaleString("fr-FR") : "Aucune"}
              </span>
            </div>
          </>
        )}
      </div>
      {agency && !record.customer_id && (
        <section className="panel">
          <h3>Lier un abonnement déjà existant</h3>
          <p>
            Enregistrez d’abord le tarif mensuel, puis indiquez les identifiants présents dans Stripe. Le studio vérifie
            qu’ils correspondent et qu’ils ne sont pas déjà liés à un autre espace.
          </p>
          <label className="field">
            <span>Client Stripe · cus_…</span>
            <input value={link.customer_id} onChange={(e) => setLink({ ...link, customer_id: e.target.value })} />
          </label>
          <label className="field">
            <span>Abonnement Stripe · sub_…</span>
            <input
              value={link.subscription_id}
              onChange={(e) => setLink({ ...link, subscription_id: e.target.value })}
            />
          </label>
          <button
            className="button secondary"
            disabled={busy || !record.price_id || !link.customer_id || !link.subscription_id}
            onClick={() => act("billing-link", { ...link, version: record.version })}
          >
            Vérifier et lier cet abonnement
          </button>
        </section>
      )}
    </section>
  );
}
export function AgencyBillingSummary({ rows, onSelect }: { rows: Row[]; onSelect: (id: string) => void }) {
  if (!rows?.length) return null;
  return (
    <section className="panel">
      <h3>Abonnements des clients</h3>
      {rows.map((r) => (
        <button className="todo-row" key={r.client_id} onClick={() => onSelect(r.client_id)}>
          <div>
            <b>{r.name}</b>
            <small>{r.paidUntil ? "Payé jusqu’au " + date(r.paidUntil) : "Aucune période payée enregistrée"}</small>
          </div>
          <span className="status">{labels[r.access.state]}</span>
          <ArrowRight size={17} />
        </button>
      ))}
    </section>
  );
}
