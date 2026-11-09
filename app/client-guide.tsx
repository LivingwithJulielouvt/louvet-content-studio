"use client";
import { BookingButton } from "./booking-help";
// Premiers pas guidés dans le studio client : une liste d'étapes simples, cochées automatiquement.
import { useEffect, useState } from "react";
import { Check, ArrowRight, X } from "lucide-react";
import { useL, useLang, dateLocale } from "../lib/i18n";
type Row = Record<string, any>;

const key = (clientId: string, k: string) => `louvet-guide:${clientId}:${k}`;
function read(k: string) {
  try {
    return window.localStorage.getItem(k) === "1";
  } catch {
    return false;
  }
}
function write(k: string) {
  try {
    window.localStorage.setItem(k, "1");
  } catch {}
}
/** À appeler quand le client ouvre un onglet, pour cocher les étapes « découvrir ». */
export function markGuideVisit(clientId: string, tab: string) {
  if (clientId) write(key(clientId, "visit-" + tab));
}

export default function ClientGuide({
  client,
  data,
  creator,
  onGo,
  onShown,
}: {
  client: Row;
  data: Row;
  creator: boolean;
  onGo: (target: "products" | "create" | "templates" | "videos" | "publication") => void;
  /** Prévient l'accueil quand le guide est visible (il s'affiche alors seul). */
  onShown?: (shown: boolean) => void;
}) {
  const L = useL(),
    lang = useLang();
  const [visits, setVisits] = useState<Record<string, boolean>>({}),
    [hidden, setHidden] = useState(true);
  useEffect(() => {
    setVisits({
      videos: read(key(client.id, "visit-videos")),
      publication: read(key(client.id, "visit-publication")),
    });
    setHidden(read(key(client.id, "hidden")));
  }, [client.id]);
  const now = new Date(),
    next3 = new Date(now.getFullYear(), now.getMonth() + (now.getDate() >= 3 ? 1 : 0), 3),
    deliveryDate = next3.toLocaleDateString(dateLocale(lang), { day: "numeric", month: "long" });
  const steps: { done: boolean; title: string; text: string; cta?: string; go?: Parameters<typeof onGo>[0] }[] = [
    {
      done: true,
      title: creator
        ? L("Parlez-nous de vous", "Cuéntanos sobre ti", "Tell us about you")
        : L("Parlez-nous de votre marque", "Cuéntanos sobre tu marca", "Tell us about your brand"),
      text: L(
        "C’est fait : l’équipe s’appuie sur vos réponses pour préparer vos contenus.",
        "Listo: el equipo usa tus respuestas para preparar tus contenidos.",
        "Done: the team uses your answers to prepare your content.",
      ),
    },
    {
      // Fait seulement quand un produit a au moins une photo enregistrée.
      done: (data.files || []).some((f: Row) => f.purpose === "original" && f.product_id),
      title: creator
        ? L("Ajoutez un sujet et ses photos", "Agrega un tema y sus fotos", "Add a topic and its photos")
        : L("Ajoutez un produit et ses photos", "Agrega un producto y sus fotos", "Add a product and its photos"),
      text: L(
        "De 1 à 5 photos claires, prises près d’une fenêtre. Elles servent pour tous vos visuels.",
        "De 1 a 5 fotos claras, tomadas junto a una ventana. Sirven para todas tus imágenes.",
        "1 to 5 clear photos, taken near a window. They’re used for all your visuals.",
      ),
      cta: creator
        ? L("Ajouter un sujet", "Agregar un tema", "Add a topic")
        : L("Ajouter un produit", "Agregar un producto", "Add a product"),
      go: "products",
    },
    // L'étape « premier visuel » n'apparaît que lorsque l'agence a préparé un type de photo.
    ...((data.recipes || []).some((r: Row) => r.active) || (data.jobs?.length || 0) > 0
      ? [
    {
      done: (data.jobs?.length || 0) > 0,
      title: L("Créez votre premier visuel", "Crea tu primera imagen", "Create your first visual"),
      text: L(
        "Choisissez ce que vous voulez montrer : le studio prépare le visuel et son texte.",
        "Elige lo que quieres mostrar: el estudio prepara la imagen y su texto.",
        "Pick what you want to show: the studio prepares the visual and its caption.",
      ),
      cta: L("Créer un visuel", "Crear una imagen", "Create a visual"),
      go: "create" as const,
    },
        ]
      : [
          {
            done: (data.designs || []).some((d: Row) => d.kind === "image"),
            title: L("Créez un visuel avec un modèle", "Crea una imagen con una plantilla", "Create a visual with a template"),
            text: L(
              "Choisissez un modèle, ajoutez vos photos et votre texte : c’est prêt à publier.",
              "Elige una plantilla, agrega tus fotos y tu texto: listo para publicar.",
              "Pick a template, add your photos and text: it’s ready to post.",
            ),
            cta: L("Ouvrir les modèles", "Abrir las plantillas", "Open templates"),
            go: "templates" as const,
          },
        ]),
    {
      done: !!visits.videos,
      title: L("Découvrez vos 30 idées de vidéos", "Descubre tus 30 ideas de videos", "Explore your 30 video ideas"),
      text: L(
        "Chaque idée explique quoi filmer, étape par étape, avec votre téléphone.",
        "Cada idea explica qué grabar, paso a paso, con tu teléfono.",
        "Each idea explains what to film, step by step, with your phone.",
      ),
      cta: L("Voir les idées", "Ver las ideas", "See the ideas"),
      go: "videos",
    },
    {
      done: !!visits.publication || (data.rewards?.total || 0) > 0,
      title: L("Ouvrez votre calendrier", "Abre tu calendario", "Open your calendar"),
      text: L(
        "Vos contenus y sont rangés par date. Après publication, cliquez sur « J’ai publié ce post ».",
        "Tus contenidos están ordenados por fecha. Después de publicar, haz clic en “Ya publiqué este post”.",
        "Your posts are sorted by date. Once you post, click “I posted this”.",
      ),
      cta: L("Voir le calendrier", "Ver el calendario", "See the calendar"),
      go: "publication",
    },
  ];
  const doneCount = steps.filter((s) => s.done).length,
    allDone = doneCount === steps.length,
    shown = !hidden && !allDone;
  useEffect(() => {
    onShown?.(shown);
  }, [shown]);
  if (!shown) return null;
  const nextIndex = steps.findIndex((s) => !s.done);
  return (
    <section className="client-guide" aria-labelledby="client-guide-title">
      <div className="client-guide-head">
        <div>
          <h2 id="client-guide-title">{L("Vos premiers pas", "Tus primeros pasos", "Your first steps")}</h2>
          <p>
            {L(
              `${doneCount} sur ${steps.length} · votre prochaine livraison arrive le ${deliveryDate}.`,
              `${doneCount} de ${steps.length} · tu próxima entrega llega el ${deliveryDate}.`,
              `${doneCount} of ${steps.length} · your next delivery arrives on ${deliveryDate}.`,
            )}
          </p>
        </div>
        <button
          className="icon-button"
          aria-label={L("Masquer le guide", "Ocultar la guía", "Hide the guide")}
          title={L("Masquer le guide", "Ocultar la guía", "Hide the guide")}
          onClick={() => {
            write(key(client.id, "hidden"));
            setHidden(true);
          }}
        >
          <X size={16} />
        </button>
      </div>
      <div
        className="client-guide-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
      >
        <span style={{ width: (doneCount / steps.length) * 100 + "%" }} />
      </div>
      <ol>
        {steps.map((s, i) => (
          <li key={s.title} className={(s.done ? "done " : "") + (i === nextIndex ? "next" : "")}>
            <span className="client-guide-mark" aria-hidden="true">
              {s.done ? <Check size={14} /> : i + 1}
            </span>
            <div>
              <b>{s.title}</b>
              <p>{s.text}</p>
            </div>
            {!s.done && s.go && (
              <button className={"button " + (i === nextIndex ? "primary" : "secondary")} onClick={() => onGo(s.go!)}>
                {s.cta} <ArrowRight size={14} />
              </button>
            )}
            <span className="sr-only">{s.done ? L("Fait", "Hecho", "Done") : L("À faire", "Pendiente", "To do")}</span>
          </li>
        ))}
      </ol>
      <div className="client-guide-help">
        <BookingButton client={client} hasLink={!!data.bookingUrl} />
      </div>
    </section>
  );
}
