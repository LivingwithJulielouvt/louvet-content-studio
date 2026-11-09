"use client";
// Nouvelles fonctionnalités (octobre 2026) : livraison mensuelle, parrainage, offre complète, publication Instagram.
import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Gift,
  Link2,
  Loader2,
  PackageCheck,
  Send,
  Share2,
  Sparkles,
  CalendarCheck,
  X,
  ArrowRight,
} from "lucide-react";
import { useL, useLang, dateLocale, pick, type Lang } from "../lib/i18n";
import { offerPrice, formatCents } from "../lib/pricing.mjs";
type Row = Record<string, any>;

async function api(action: string, body?: any): Promise<Row> {
  const res = await fetch("/api/studio/" + action, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json", "X-Studio-Request": "1" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const d: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || "Cette action n’a pas abouti.");
  return d;
}
function useAction(refresh: () => Promise<any> | void) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function run(name: string, body: Row, success = "Enregistré.") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await api(name, body);
      await refresh();
      if (success) setMessage(success);
      return r;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, message, setError, setMessage, run };
}
function Feedback({ error, message, onClose }: { error: string; message: string; onClose: () => void }) {
  const L = useL();
  if (!error && !message) return null;
  return (
    <div className={"alert " + (error ? "error" : "ext-success")} role={error ? "alert" : "status"}>
      <span>{error || message}</span>
      <button className="icon-button" onClick={onClose} aria-label={L("Fermer", "Cerrar", "Close")}>
        <X size={15} />
      </button>
    </div>
  );
}
const monthLabel = (m: string, lang: Lang = "fr") => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, 15)).toLocaleDateString(dateLocale(lang), { month: "long", year: "numeric" });
};
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ---------------- Livraison mensuelle ---------------- */
export function DeliveryPanel({
  data,
  client,
  agency,
  refresh,
}: {
  data: Row;
  client: Row;
  agency: boolean;
  refresh: () => Promise<any>;
}) {
  const { busy, error, message, setError, setMessage, run } = useAction(refresh);
  const L = useL(),
    lang = useLang();
  const size = data.deliverySize || 6,
    day = data.deliveryDay || 3,
    deliveries: Row[] = data.deliveries || [];
  if (!agency) {
    if (!deliveries.length) return null;
    return (
      <section className="delivery-client">
        {deliveries.map((d) => (
          <div className="panel" key={d.id}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  {L("LIVRAISON DU", "ENTREGA DEL", "DELIVERY OF THE")} {day} · {monthLabel(d.month, lang).toUpperCase()}
                </span>
                <h3>
                  {L(
                    `Vos ${d.items.length} contenus du mois, prêts à publier.`,
                    `Tus ${d.items.length} contenidos del mes, listos para publicar.`,
                    `Your ${d.items.length} posts for the month, ready to share.`,
                  )}
                </h3>
              </div>
              <PackageCheck size={20} />
            </div>
            <div className="delivery-grid">
              {d.items.map((i: Row) => (
                <article className="delivery-item" key={i.task_id}>
                  <img src={"/api/studio/file/" + i.file_id} alt={i.product || L("Contenu", "Contenido", "Content")} />
                  <p className="caption">{i.caption}</p>
                  <div className="row-actions">
                    <a className="button secondary" href={"/api/studio/file/" + i.file_id + "?download=1"}>
                      <Download size={14} /> {L("Télécharger", "Descargar", "Download")}
                    </a>
                    <button
                      className="button secondary"
                      onClick={async () =>
                        setMessage(
                          (await copy(i.caption))
                            ? L("Texte copié.", "Texto copiado.", "Text copied.")
                            : L("Copiez le texte à la main.", "Copia el texto a mano.", "Please copy the text by hand."),
                        )
                      }
                    >
                      <Copy size={14} /> {L("Copier le texte", "Copiar el texto", "Copy text")}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
        <Feedback error={error} message={message} onClose={() => (setError(""), setMessage(""))} />
      </section>
    );
  }
  const next = data.nextDelivery,
    current = deliveries.find((d) => d.month === next);
  return (
    <section className="delivery-agency">
      <Feedback error={error} message={message} onClose={() => (setError(""), setMessage(""))} />
      <div className="panel delivery-intro">
        <div>
          <span className="eyebrow">PROCHAINE LIVRAISON · {client.name.toUpperCase()}</span>
          <h3>
            {size} contenus pour {monthLabel(next)}, envoyés le {day} après votre validation.
          </h3>
          <p className="muted">
            Le studio prépare {size} visuels et leurs textes à partir des photos produit (offerts : aucun crédit client
            utilisé). Vous choisissez les {size} à envoyer, vous validez, et ils arrivent dans l’espace du client le {day}{" "}
            à 9 h, avec un e-mail si les envois sont activés. Avant cette date, le client ne voit rien.
          </p>
        </div>
        {(!current || ["preparing", "to_validate"].includes(current.status)) && (
          <button
            className="button primary"
            disabled={busy || !data.generationReady}
            onClick={() =>
              run(
                "delivery-prepare",
                { client_id: client.id, month: next },
                "Préparation lancée. Les visuels apparaissent ici d’ici quelques minutes.",
              )
            }
          >
            {busy ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
            {current?.candidates?.length ? `Préparer ${size} contenus de plus` : `Préparer les ${size} contenus`}
          </button>
        )}
      </div>
      {!data.generationReady && (
        <p className="editorial-note">La génération d’images est désactivée : activez-la pour préparer les contenus.</p>
      )}
      {deliveries.map((d) => {
        const approved = d.items.length,
          locked = ["validated", "sent"].includes(d.status);
        const toggle = (i: Row) =>
          run(
            "delivery-approve",
            { client_id: client.id, month: d.month, task_id: i.task_id, approved: !i.approved },
            i.approved ? "Contenu retiré de la livraison." : "Contenu ajouté à la livraison.",
          );
        return (
          <div className="panel" key={d.id}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">{monthLabel(d.month).toUpperCase()}</span>
                <h3>
                  {d.status === "sent"
                    ? `Envoyée le ${new Date(d.sent_at).toLocaleDateString("fr-FR")}`
                    : d.status === "validated"
                      ? `Validée · envoi automatique le ${day} ${monthLabel(d.month)}`
                      : `${approved}/${size} contenus choisis`}
                </h3>
              </div>
              <span className={"status " + (d.status === "sent" ? "ready" : d.status === "validated" ? "approved" : "review")}>
                {{ preparing: "En préparation", to_validate: "À valider", validated: "Validée", sent: "Envoyée" }[
                  d.status as string
                ] || d.status}
              </span>
            </div>
            <div className="delivery-grid">
              {(d.candidates || []).map((i: Row) => (
                <article className={"delivery-item " + (i.approved ? "chosen" : "")} key={i.task_id}>
                  <img src={"/api/studio/file/" + i.file_id} alt={i.product || "Contenu"} />
                  <small className="muted">{i.product}</small>
                  <p className="caption">{i.caption || "Texte en préparation…"}</p>
                  {!locked && (
                    <button className={"button " + (i.approved ? "primary" : "secondary")} disabled={busy} onClick={() => toggle(i)}>
                      {i.approved ? <Check size={14} /> : null}
                      {i.approved ? "Choisi" : "Choisir"}
                    </button>
                  )}
                </article>
              ))}
            </div>
            {!locked && d.library?.length > 0 && (
              <details className="delivery-library">
                <summary>Ajouter une autre création de ce client</summary>
                <div className="delivery-grid compact">
                  {d.library.map((i: Row) => (
                    <button key={i.task_id} className="delivery-thumb" disabled={busy} onClick={() => toggle(i)} title={i.caption}>
                      <img src={"/api/studio/file/" + i.file_id} alt={i.product || "Création"} />
                    </button>
                  ))}
                </div>
              </details>
            )}
            <div className="row-actions">
              {!locked && (
                <button
                  className="button primary"
                  disabled={busy || approved !== size}
                  onClick={() =>
                    run(
                      "delivery-validate",
                      { client_id: client.id, month: d.month },
                      `Livraison validée. Envoi automatique le ${day} ${monthLabel(d.month)} à 9 h.`,
                    )
                  }
                >
                  <CalendarCheck size={15} /> Valider les {size} contenus
                </button>
              )}
              {d.status === "validated" && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => run("delivery-validate", { client_id: client.id, month: d.month, undo: true }, "Validation annulée.")}
                >
                  Modifier la sélection
                </button>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

/* ---------------- Parrainage ---------------- */
// « 10 € », « $200 MXN », « $10 USD » : même format que les prix du studio.
const money = (cents: number, currency = "usd", lang: Lang = "fr") => formatCents(cents, currency, lang);
const referralStatus: Row = {
  pending: "Inscrite · en attente du 1er paiement",
  qualified: "Remise acquise · appliquée à votre prochaine facture",
  crediting: "Remise en cours d’application",
  credited: "Remise appliquée",
};
const referralStatusEs: Row = {
  pending: "Registrada · esperando su 1er pago",
  qualified: "Descuento ganado · se aplicará a tu próxima factura",
  crediting: "Descuento en proceso",
  credited: "Descuento aplicado",
};
const referralStatusEn: Row = {
  pending: "Signed up · waiting for first payment",
  qualified: "Discount earned · applied to your next invoice",
  crediting: "Discount being applied",
  credited: "Discount applied",
};
export function ReferralPanel({
  data,
  client,
  agency,
  refresh,
}: {
  data: Row;
  client: Row;
  agency: boolean;
  refresh: () => Promise<any>;
}) {
  const { busy, error, message, setError, setMessage, run } = useAction(refresh);
  const [code, setCode] = useState("");
  const L = useL(),
    lang = useLang(),
    m = (cents: number, cur?: string) => money(cents, cur, lang),
    statusText = pick(lang, referralStatus, referralStatusEs, referralStatusEn);
  const r = data.referral;
  return (
    <section className="referral">
      <Feedback error={error} message={message} onClose={() => (setError(""), setMessage(""))} />
      {r && (
        <div className="panel referral-hero">
          <div>
            <span className="eyebrow">
              {agency
                ? `CODE DE ${client.name.toUpperCase()}`
                : L("VOTRE CODE DE PARRAINAGE", "TU CÓDIGO DE RECOMENDACIÓN", "YOUR REFERRAL CODE")}
            </span>
            <h3>
              {L(
                `${m(r.reward_cents, r.currency)} de réduction pour chaque marque ou créatrice que vous faites entrer.`,
                `${m(r.reward_cents, r.currency)} de descuento por cada marca o creadora que recomiendes.`,
                `${m(r.reward_cents, r.currency)} off for every brand or creator you refer.`,
              )}
            </h3>
            <p className="muted">
              {L(
                `Partagez votre code. Quand la marque ou la créatrice parrainée paie son premier mois, ${m(r.reward_cents, r.currency)} sont déduits automatiquement de votre prochaine facture. Cumulable, sans limite.`,
                `Comparte tu código. Cuando la marca o creadora recomendada paga su primer mes, se descuentan automáticamente ${m(r.reward_cents, r.currency)} de tu próxima factura. Acumulable, sin límite.`,
                `Share your code. When a brand or creator you referred pays their first month, ${m(r.reward_cents, r.currency)} is automatically taken off your next invoice. No limit — it adds up.`,
              )}
            </p>
          </div>
          <div className="referral-code">
            <code>{r.code}</code>
            <div className="row-actions">
              <button
                className="button secondary"
                onClick={async () => setMessage((await copy(r.code)) ? L("Code copié.", "Código copiado.", "Code copied.") : r.code)}
              >
                <Copy size={14} /> {L("Copier le code", "Copiar el código", "Copy code")}
              </button>
              {r.link && (
                <button
                  className="button primary"
                  onClick={async () =>
                    setMessage(
                      (await copy(r.link))
                        ? L(
                            "Lien d’inscription copié : il contient déjà votre code.",
                            "Enlace de registro copiado: ya incluye tu código.",
                            "Sign-up link copied — your code is already in it.",
                          )
                        : r.link,
                    )
                  }
                >
                  <Share2 size={14} /> {L("Copier mon lien", "Copiar mi enlace", "Copy my link")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {r && (
        <div className="panel">
          <div className="section-heading">
            <h3>{L("Vos marques parrainées", "Tus marcas recomendadas", "Brands you referred")}</h3>
            <span className="status ready">
              {m(r.earned_cents, r.currency)} {L("obtenus", "obtenidos", "earned")}
              {r.waiting_cents ? ` · ${m(r.waiting_cents, r.currency)} ${L("à venir", "por venir", "coming")}` : ""}
            </span>
          </div>
          {!r.referrals.length && (
            <p className="muted">
              {L("Aucune marque parrainée pour l’instant.", "Aún no has recomendado ninguna marca.", "No referred brands yet.")}
            </p>
          )}
          {r.referrals.map((x: Row) => (
            <div className="access-row" key={x.referred_name + x.created}>
              <span>
                <b>{x.referred_name}</b>
                <small className="muted"> · {new Date(x.created).toLocaleDateString(dateLocale(lang))}</small>
              </span>
              <span className={"status " + (x.status === "credited" ? "ready" : "review")}>{statusText[x.status]}</span>
              {agency && x.credit_error && x.status !== "credited" && (
                <small className="credit-error">Crédit Stripe non appliqué : {x.credit_error} — réessai automatique</small>
              )}
            </div>
          ))}
        </div>
      )}
      {agency && (
        <div className="panel">
          <h3>Rattacher un parrainage à {client.name}</h3>
          <p className="muted">
            Si la marque n’a pas saisi le code dans le formulaire, entrez ici le code de sa marraine. La remise sera
            appliquée après son premier paiement.
          </p>
          <div className="select-add">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CODE-XXXX" />
            <button
              className="button primary"
              disabled={busy || !code.trim()}
              onClick={async () => {
                if (await run("referral-link", { client_id: client.id, code }, "Parrainage rattaché.")) setCode("");
              }}
            >
              <Link2 size={14} /> Rattacher
            </button>
          </div>
          {data.referralOverview?.length > 0 && (
            <>
              <h3 className="ext-subtitle">Tous les parrainages</h3>
              {data.referralOverview.map((x: Row) => (
                <div className="access-row" key={x.id}>
                  <span>
                    <b>{x.referrer_name}</b> → {x.referred_name}
                  </span>
                  <span className={"status " + (x.status === "credited" ? "ready" : "review")}>{referralStatus[x.status]}</span>
                  {x.credit_error && x.status !== "credited" && (
                    <small className="credit-error">Crédit Stripe non appliqué : {x.credit_error} — réessai automatique</small>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------------- Offre complète (page facturation) ---------------- */
const offerCopy = {
  es: {
    forWho: "PARA QUIÉN",
    title: "Marcas que quieren que su presencia genere ventas",
    lead: "Tu contenido, tus oportunidades y tu publicidad trabajan juntos para generar clientes.",
    price: "PRECIO",
    amount: "{AMOUNT}",
    priceNote: "al mes, de los cuales {ADS} se invierten en campaña publicitaria",
    includes: "QUÉ INCLUYE",
    items: [
      ["Creación de contenido con Sofia", "Visuales y publicaciones alineados con tu estrategia, con visitas para fotos y videos."],
      ["Tus oportunidades con Veronica", "Influencers, prensa, medios y eventos: Veronica Ortiz identifica las oportunidades, hace el contacto y da seguimiento."],
      ["Posicionamiento en Google e IA", "Tu marca aparece en los resultados de Google y en las respuestas de los asistentes de inteligencia artificial."],
      ["Tus campañas publicitarias", "{ADS} de presupuesto publicitario al mes, incluidos en el precio, en Google y Meta, a cargo de Baptiste Weickert."],
    ],
    alsoTitle: "TAMBIÉN INCLUIDO · COMMUNITY MANAGEMENT Y FOTÓGRAFO",
    also: "Respuestas a mensajes y comentarios, y sesiones con fotógrafo profesional para tus contenidos.",
    free: "Sin costo adicional",
    gains: "LO QUE GANAS",
    gainItems: [
      ["ADQUISICIÓN", "Clientes que te encuentran", "En Google, en los asistentes de IA y en redes sociales."],
      ["NOTORIEDAD", "Colaboraciones y presencia en prensa", "Las que no tendrías tiempo de buscar."],
      ["PRESUPUESTO", "Publicidad ya incluida", "Tu presupuesto de medios forma parte de tu mensualidad."],
    ],
    team: "TU EQUIPO",
    teamText: [
      ["Sofia Ochoa", " en contenido, "],
      ["Veronica Ortiz", " en oportunidades, "],
      ["Baptiste Weickert", " en campañas de Google y Meta, bajo la dirección estratégica de "],
      ["Julie Louvet", "."],
    ],
    further: "PARA IR MÁS LEJOS",
    furtherText: ["El plan ", "Excelencia", " suma una persona del equipo dedicada a tu cuenta, sin límite, y un fotógrafo cada mes."],
    teaser: "¿Quieres que nos encarguemos de todo?",
    teaserSub: "Estrategia, publicaciones, anuncios y reportes: el equipo lo hace por ti. {AMOUNT} al mes.",
    teaserCta: "Descubrir el acompañamiento completo",
    close: "Ocultar",
    cta: "Quiero saber más",
    sent: "¡Gracias! Tu solicitud llegó a la agencia: te contactamos muy pronto.",
    already: "Solicitud enviada: la agencia te contactará muy pronto.",
    placeholder: "Un mensaje para la agencia (opcional)",
  },
  fr: {
    forWho: "POUR QUI",
    title: "Les marques qui veulent que leur présence génère des ventes",
    lead: "Votre contenu, vos opportunités et votre publicité travaillent ensemble pour attirer des clients.",
    price: "PRIX",
    amount: "{AMOUNT}",
    priceNote: "par mois, dont {ADS} investis en campagne publicitaire",
    includes: "CE QUI EST INCLUS",
    items: [
      ["Création de contenu avec Sofia", "Visuels et publications alignés sur votre stratégie, avec des visites pour les photos et vidéos."],
      ["Vos opportunités avec Veronica", "Influenceurs, presse, médias et événements : Veronica Ortiz repère les opportunités, prend contact et assure le suivi."],
      ["Référencement sur Google et l’IA", "Votre marque apparaît dans les résultats Google et dans les réponses des assistants d’intelligence artificielle."],
      ["Vos campagnes publicitaires", "{ADS} de budget publicitaire par mois, inclus dans le prix, sur Google et Meta, gérés par Baptiste Weickert."],
    ],
    alsoTitle: "ÉGALEMENT INCLUS · COMMUNITY MANAGEMENT ET PHOTOGRAPHE",
    also: "Réponses aux messages et commentaires, et séances avec un photographe professionnel pour vos contenus.",
    free: "Sans coût supplémentaire",
    gains: "CE QUE VOUS Y GAGNEZ",
    gainItems: [
      ["ACQUISITION", "Des clients qui vous trouvent", "Sur Google, dans les assistants IA et sur les réseaux sociaux."],
      ["NOTORIÉTÉ", "Collaborations et présence dans la presse", "Celles que vous n’auriez pas le temps de chercher."],
      ["BUDGET", "Publicité déjà incluse", "Votre budget média fait partie de votre mensualité."],
    ],
    team: "VOTRE ÉQUIPE",
    teamText: [
      ["Sofia Ochoa", " au contenu, "],
      ["Veronica Ortiz", " aux opportunités, "],
      ["Baptiste Weickert", " aux campagnes Google et Meta, sous la direction stratégique de "],
      ["Julie Louvet", "."],
    ],
    further: "POUR ALLER PLUS LOIN",
    furtherText: ["La formule ", "Excellence", " ajoute une personne de l’équipe dédiée à votre compte, sans limite, et un photographe chaque mois."],
    teaser: "Envie qu’on s’occupe de tout\u00a0?",
    teaserSub: "Stratégie, publications, publicités et bilans\u00a0: l’équipe le fait pour vous. {AMOUNT} par mois.",
    teaserCta: "Découvrir l’accompagnement complet",
    close: "Masquer",
    cta: "Je veux en savoir plus",
    sent: "Merci ! Votre demande est arrivée à l’agence : nous vous contactons très vite.",
    already: "Demande envoyée : l’agence vous contactera très vite.",
    placeholder: "Un message pour l’agence (facultatif)",
  },
  en: {
    forWho: "WHO IT’S FOR",
    title: "Brands that want their presence to drive sales",
    lead: "Your content, your opportunities and your advertising work together to bring in customers.",
    price: "PRICE",
    amount: "{AMOUNT}",
    priceNote: "per month, including {ADS} invested in advertising",
    includes: "WHAT’S INCLUDED",
    items: [
      ["Content creation with Sofia", "Visuals and posts aligned with your strategy, with visits for photos and videos."],
      ["Your opportunities with Veronica", "Influencers, press, media and events: Veronica Ortiz finds the opportunities, reaches out and follows up."],
      ["Visibility on Google and AI", "Your brand shows up in Google results and in the answers of AI assistants."],
      ["Your ad campaigns", "{ADS} of ad budget per month, included in the price, on Google and Meta, run by Baptiste Weickert."],
    ],
    alsoTitle: "ALSO INCLUDED · COMMUNITY MANAGEMENT AND PHOTOGRAPHER",
    also: "Replies to messages and comments, plus sessions with a professional photographer for your content.",
    free: "At no extra cost",
    gains: "WHAT YOU GAIN",
    gainItems: [
      ["ACQUISITION", "Customers who find you", "On Google, in AI assistants and on social media."],
      ["AWARENESS", "Collaborations and press coverage", "The ones you wouldn’t have time to chase."],
      ["BUDGET", "Advertising already included", "Your media budget is part of your monthly fee."],
    ],
    team: "YOUR TEAM",
    teamText: [
      ["Sofia Ochoa", " on content, "],
      ["Veronica Ortiz", " on opportunities, "],
      ["Baptiste Weickert", " on Google and Meta campaigns, under the strategic direction of "],
      ["Julie Louvet", "."],
    ],
    further: "TO GO FURTHER",
    furtherText: ["The ", "Excellence", " plan adds a dedicated team member for your account, with no limit, and a photographer every month."],
    teaser: "Want us to handle everything?",
    teaserSub: "Strategy, posts, ads and reports: the team does it for you. {AMOUNT} a month.",
    teaserCta: "Discover the full-service plan",
    close: "Hide",
    cta: "I want to know more",
    sent: "Thank you! Your request has reached the agency — we’ll be in touch very soon.",
    already: "Request sent: the agency will contact you very soon.",
    placeholder: "A message for the agency (optional)",
  },
};

export function OfferBlock({ data, client, refresh }: { data: Row; client: Row; refresh: () => Promise<any> }) {
  const lang = useLang();
  // Prix selon le pays du client : 1 400 USD aux États-Unis, 900 USD en France et au Mexique (lib/pricing.mjs).
  // Une seule marque de devise : « 900 USD », jamais « 900 $ USD ».
  const raw = offerPrice(client.config?.country, lang),
    oneMark = (x: string) => x.replace(/[\s\u00a0\u202f]*\$[\s\u00a0\u202f]*/g, "").replace(/(\d)USD/, "$1\u00a0USD"),
    prices = { amount: oneMark(raw.amount), ads: oneMark(raw.ads) },
    fill = (x: string) => x.replaceAll("{AMOUNT}", prices.amount).replaceAll("{ADS}", prices.ads);
  const base = offerCopy[lang],
    t = {
      ...base,
      amount: fill(base.amount),
      priceNote: fill(base.priceNote),
      teaserSub: fill(base.teaserSub),
      items: base.items.map(([a, b]) => [fill(a), fill(b)]),
    };
  const { busy, error, message, setError, setMessage, run } = useAction(refresh);
  const [note, setNote] = useState("");
  const pending = data.offerRequest && ["new", "contacted"].includes(data.offerRequest.status);
  const [open, setOpen] = useState(false);
  // Replié par défaut : une seule carte discrète sous l'abonnement ; le détail s'ouvre au clic.
  if (!open)
    return (
      <section className="offer-teaser" lang={lang}>
        <div>
          <h3>{t.teaser}</h3>
          <p>{t.teaserSub}</p>
          {pending && (
            <p className="offer-done">
              <Check size={16} /> {t.already}
            </p>
          )}
        </div>
        <button className="button secondary" onClick={() => setOpen(true)} aria-expanded={false}>
          {t.teaserCta} <ArrowRight size={15} />
        </button>
      </section>
    );
  return (
    <section className="offer" lang={lang}>
      <button className="link-button offer-close" onClick={() => setOpen(false)} aria-expanded={true}>
        {t.close}
      </button>
      <div className="offer-top">
        <div className="offer-who">
          <span className="offer-label">{t.forWho}</span>
          <h3>{t.title}</h3>
          <p>{t.lead}</p>
        </div>
        <div className="offer-price">
          <span className="offer-label">{t.price}</span>
          <b>{t.amount}</b>
          <p>{t.priceNote}</p>
        </div>
      </div>
      <span className="offer-section">{t.includes}</span>
      <div className="offer-items">
        {t.items.map(([title, text], i) => (
          <div className={"offer-item " + (i === 1 || i === 2 ? "alt" : "")} key={title}>
            <span className="offer-number">{i + 1}</span>
            <b>{title}</b>
            <p>{text}</p>
          </div>
        ))}
      </div>
      <div className="offer-also">
        <div>
          <span className="offer-label">{t.alsoTitle}</span>
          <p>{t.also}</p>
        </div>
        <b>{t.free}</b>
      </div>
      <span className="offer-section">{t.gains}</span>
      <div className="offer-gains">
        {t.gainItems.map(([label, title, text]) => (
          <div key={label}>
            <span className="offer-label">{label}</span>
            <h4>{title}</h4>
            <p>{text}</p>
          </div>
        ))}
      </div>
      <div className="offer-bottom">
        <div>
          <span className="offer-label">{t.team}</span>
          <p>
            {t.teamText.map(([name, rest]) => (
              <span key={name}>
                <b>{name}</b>
                {rest}
              </span>
            ))}
          </p>
        </div>
        <div className="offer-further">
          <span className="offer-label">{t.further}</span>
          <p>
            {t.furtherText[0]}
            <b>{t.furtherText[1]}</b>
            {t.furtherText[2]}
          </p>
        </div>
      </div>
      <div className="offer-cta">
        {pending ? (
          <p className="offer-done">
            <Check size={16} /> {t.already}
          </p>
        ) : (
          <>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1500} placeholder={t.placeholder} />
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                if (await run("offer-request", { client_id: client.id, plan: "complete", message: note }, t.sent)) setNote("");
              }}
            >
              {busy ? <Loader2 className="spin" size={16} /> : <Send size={16} />} {t.cta}
            </button>
          </>
        )}
        <Feedback error={error} message={message} onClose={() => (setError(""), setMessage(""))} />
      </div>
    </section>
  );
}
export function OfferRequests({ data, refresh }: { data: Row; refresh: () => Promise<any> }) {
  const { busy, error, message, setError, setMessage, run } = useAction(refresh);
  const rows: Row[] = data.offerRequests || [];
  if (!rows.length) return null;
  return (
    <section className="panel">
      <div className="section-heading">
        <h3>Demandes pour l’offre complète</h3>
        <Gift size={18} />
      </div>
      <Feedback error={error} message={message} onClose={() => (setError(""), setMessage(""))} />
      {rows.map((r) => (
        <div className="access-row" key={r.id}>
          <span>
            <b>{r.client_name}</b>
            <small className="muted">
              {" "}
              · {r.email} · {new Date(r.created).toLocaleDateString("fr-FR")}
            </small>
            {r.message && <small>« {r.message} »</small>}
          </span>
          <div className="row-actions">
            {r.status === "new" && (
              <button className="button secondary" disabled={busy} onClick={() => run("offer-request-status", { id: r.id, status: "contacted" }, "Marquée comme contactée.")}>
                Contactée
              </button>
            )}
            <button className="button primary" disabled={busy} onClick={() => run("offer-request-status", { id: r.id, status: "won" }, "Bravo ! Client signé.")}>
              Signée
            </button>
            <button className="button secondary" disabled={busy} onClick={() => run("offer-request-status", { id: r.id, status: "lost" }, "Demande classée.")}>
              Classer
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

/* ---------------- Publication Instagram ---------------- */
export function MetaPanel({ data, client, refresh }: { data: Row; client: Row; refresh: () => Promise<any> }) {
  const { busy, error, message, setError, setMessage, run } = useAction(refresh);
  const meta = data.meta || {};
  const L = useL();
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("meta") === "connected") setMessage(L("Compte Instagram connecté.", "Cuenta de Instagram conectada.", "Instagram account connected."));
    if (p.get("meta") === "error")
      setError(
        p.get("message") ||
          L("La connexion Instagram n’a pas abouti.", "No se pudo conectar Instagram.", "The Instagram connection didn’t go through."),
      );
  }, []);
  const published = new Map<string, Row>((meta.publications || []).filter((x: Row) => x.status === "published").map((x: Row) => [x.post_id, x] as [string, Row]));
  const posts: Row[] = (data.publicationPosts || []).filter((p: Row) => p.file_id && !p.published).slice(0, 12);
  // Tant que la publication Instagram n'est pas active, le client ne voit pas ce bloc (il éloignait le calendrier).
  if (!meta.enabled && data.user?.role !== "agency") return null;
  return (
    <section className="panel meta-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{L("PUBLICATION INSTAGRAM", "PUBLICACIÓN EN INSTAGRAM", "INSTAGRAM PUBLISHING")}</span>
          <h3>
            {meta.connection
              ? L(
                  `Connecté à @${meta.connection.username || "votre compte"}`,
                  `Conectado a @${meta.connection.username || "tu cuenta"}`,
                  `Connected to @${meta.connection.username || "your account"}`,
                )
              : L(
                  "Publiez directement sur Instagram depuis le studio.",
                  "Publica directamente en Instagram desde el estudio.",
                  "Post straight to Instagram from the studio.",
                )}
          </h3>
        </div>
        <Send size={18} />
      </div>
      <Feedback error={error} message={message} onClose={() => (setError(""), setMessage(""))} />
      {!meta.enabled ? (
        <p className="muted">
          {meta.configured
            ? L(
                "La publication est prête mais pas encore activée : elle attend la validation de l’application par Meta.",
                "La publicación está lista pero aún no activada: espera la aprobación de la app por parte de Meta.",
                "Publishing is ready but not switched on yet: it’s waiting for Meta to approve the app.",
              )
            : L(
                "Bientôt disponible : la connexion à Instagram est en cours de configuration par l’agence.",
                "Muy pronto: la agencia está configurando la conexión con Instagram.",
                "Coming soon: the agency is setting up the Instagram connection.",
              )}
        </p>
      ) : !meta.connection ? (
        <>
          <p className="muted">
            {L(
              "Il faut un compte Instagram professionnel (Business ou Créateur). Vous autorisez le studio une seule fois ; vous pouvez le déconnecter à tout moment.",
              "Necesitas una cuenta profesional de Instagram (Empresa o Creador). Autorizas el estudio una sola vez y puedes desconectarlo cuando quieras.",
              "You need a professional Instagram account (Business or Creator). You authorize the studio once and can disconnect it anytime.",
            )}
          </p>
          <a className="button primary" href={"/api/studio/meta-connect?client=" + encodeURIComponent(client.id)}>
            {L("Connecter Instagram", "Conectar Instagram", "Connect Instagram")}
          </a>
        </>
      ) : (
        <>
          {!posts.length && <p className="muted">
              {L(
                "Aucun post avec visuel à publier pour le moment.",
                "Por ahora no hay publicaciones con imagen para publicar.",
                "No posts with a visual to publish right now.",
              )}
            </p>}
          <div className="meta-posts">
            {posts.map((p) => (
              <article key={p.id} className="meta-post">
                <img src={"/api/studio/file/" + p.file_id} alt={p.title} />
                <div>
                  <b>{p.title}</b>
                  <small className="muted">
                    {p.date} · {p.platform}
                  </small>
                  <p className="caption">{p.caption}</p>
                  {published.get(p.id) ? (
                    <a className="text-link" href={published.get(p.id)?.permalink} target="_blank" rel="noreferrer">
                      {L("Voir sur Instagram", "Ver en Instagram", "View on Instagram")}
                    </a>
                  ) : (
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() => {
                        if (
                          confirm(
                            L(
                              "Publier ce post maintenant sur Instagram ? Il sera visible par tous vos abonnés.",
                              "¿Publicar esto ahora en Instagram? Lo verán todos tus seguidores.",
                              "Post this to Instagram now? All your followers will see it.",
                            ),
                          )
                        )
                          run(
                            "meta-publish",
                            { post_id: p.id, request_key: crypto.randomUUID() },
                            L("Publié sur Instagram.", "Publicado en Instagram.", "Posted to Instagram."),
                          );
                      }}
                    >
                      {busy ? <Loader2 className="spin" size={14} /> : <Send size={14} />}{" "}
                      {L("Publier maintenant", "Publicar ahora", "Post now")}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          <button
            className="text-link"
            disabled={busy}
            onClick={() => {
              if (
                confirm(
                  L(
                    "Déconnecter Instagram ? Plus aucune publication ne sera possible jusqu’à une nouvelle connexion.",
                    "¿Desconectar Instagram? No podrás publicar hasta que lo vuelvas a conectar.",
                    "Disconnect Instagram? You won’t be able to post until you connect it again.",
                  ),
                )
              )
                run("meta-disconnect", { client_id: client.id }, L("Instagram déconnecté.", "Instagram desconectado.", "Instagram disconnected."));
            }}
          >
            {L("Déconnecter Instagram", "Desconectar Instagram", "Disconnect Instagram")}
          </button>
        </>
      )}
    </section>
  );
}
