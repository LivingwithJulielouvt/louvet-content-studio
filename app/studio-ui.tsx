"use client";
import { useEffect, useRef, useState } from "react";
import { uploadStudioMedia } from "../lib/direct-upload-client";
import { studioTheme, plainText } from "../lib/client-experience.mjs";
import PublicRequests from "./public-requests";
import AccountControls from "./account-controls";
import FeaturesPanel from "./features-panel";
import { OppCountdown, OppTeaser, oppDaysLeft } from "./opp-countdown";
import StudioMail, { MailPreference } from "./studio-mail";
import { BetaAgency } from "./beta-chrome";
import { ClientAccessPanel, BetaInviteCreator } from "./client-access";
import BillingPanel, { BillingNotice, AgencyBillingSummary } from "./billing-panel";
import PublicationCalendar, { Rewards, AgencyPublicationSummary, EmailDelivery } from "./publication-calendar";
import CreatorStrategy from "./creator-strategy";
import ClientGuide, { markGuideVisit } from "./client-guide";
import { PlacePicker, PlacesAgency } from "./places-panel";
import TemplatesStudio, { DesignList, TemplatesAgency } from "./templates-studio";
import { isCreator, creatorRecipe } from "../lib/workspaces.mjs";
import ClientIntake, { IntakeReview } from "./client-intake";
import QualityProfile from "./quality-profile";
import VideoStudio, { OccasionPicker, VideoStyles } from "./video-studio";
import BrandVideoSettings, { VideoReviews } from "./brand-video-settings";
import { DeliveryPanel, ReferralPanel, OfferBlock, OfferRequests, MetaPanel } from "./extensions";
import { BookingButton, BookingRequests } from "./booking-help";
import { AgencyInbox, ChatSidebarButton, ClientChat } from "./chat";
import Opportunities, { OpportunitiesAgency } from "./opportunities";
import TestVersions from "./test-versions";
import { BrandCollabs, ReelCollabPanel, ReelTeaser, AgencyCollabs } from "./collabs";
import Recreate from "./recreate";
import SiteImport, { SiteImportAgency } from "./site-import";
import { recreateParam } from "../lib/recreate.mjs";
import { PackageCheck, Gift, MessageCircle, Handshake, Wand2 } from "lucide-react";
import {
  type Lang,
  LangProvider,
  LanguageSwitcher,
  useLang,
  dateLocale,
  normLang,
  pick,
  readStoredLang,
  storeLang,
} from "../lib/i18n";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Check,
  X,
  Sparkles,
  LayoutGrid,
  Image as ImageIcon,
  Package,
  SlidersHorizontal,
  Bell,
  Upload,
  Download,
  RefreshCw,
  ShieldCheck,
  LogOut,
  ChevronDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  WandSparkles,
  Palette,
  History,
  Copy,
  ExternalLink,
  Menu,
  Loader2,
  Video,
  Scissors,
  CalendarDays,
  CreditCard,
  Shapes,
} from "lucide-react";
type Row = Record<string, any>;
const statusLabels: Record<string, [string, string, string]> = {
  submitting: ["Transmission", "Enviando", "Sending"],
  processing: ["En création", "En creación", "In progress"],
  review: ["À valider", "Por validar", "To review"],
  ready: ["Disponible", "Disponible", "Ready"],
  approved: ["Validé", "Validado", "Approved"],
  partial: ["Partiellement terminé", "Terminado en parte", "Partly done"],
  failed: ["Échec confirmé", "No se pudo completar", "Couldn’t be completed"],
  attention: ["À vérifier", "Por revisar", "Needs a check"],
  correction: ["Correction demandée", "Corrección solicitada", "Correction requested"],
};
const statusesFor = (lang: Lang): Row =>
  Object.fromEntries(Object.entries(statusLabels).map(([k, v]) => [k, pick(lang, ...v)]));
const datesFor = (s: string, lang: Lang = "fr") =>
  new Date(s).toLocaleDateString(dateLocale(lang), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const formatLabels: Record<string, [string, string, string]> = {
  "1024x1280": ["Photo pour Instagram", "Foto para Instagram", "Instagram photo"],
  "1152x2048": ["Image verticale pour une story", "Imagen vertical para historia", "Vertical image for a story"],
  "1024x1024": ["Image carrée", "Imagen cuadrada", "Square image"],
};
const formatsFor = (lang: Lang): Row =>
  Object.fromEntries(Object.entries(formatLabels).map(([k, v]) => [k, pick(lang, ...v)]));
const uid = () => crypto.randomUUID();
const extraTitles: Record<string, [string, string]> = {
  features: ["Ce que voient vos clientes.", "Allumez une fonction quand elle est prête : elle apparaît chez toutes les clientes."],
  delivery: [
    "Les 6 contenus du mois.",
    "Préparez, choisissez et validez : le client les reçoit le 3, prêts à publier.",
  ],
  referral: ["Le parrainage.", "Une réduction pour chaque marque parrainée qui rejoint le studio."],
  messages: ["Les messages des clients.", "Chaque client a son fil. Répondez ici : il est prévenu dans son studio."],
};
// Titres de l'onglet Opportunités (agence en français, créatrices dans leur langue).
const oppTitles: Record<Lang, [string, string]> = {
  fr: ["Des marques à contacter.", "Une sélection de marques triées par niche, avec leurs contacts professionnels publics. Suivez vos prises de contact ici."],
  es: ["Marcas para contactar.", "Una selección de marcas por nicho, con sus contactos profesionales públicos. Sigue aquí tus acercamientos."],
  en: ["Brands worth reaching out to.", "A selection of brands sorted by niche, with their public business contacts. Track your outreach here."],
};
// Langue de l'interface en cours (mise à jour à chaque affichage du studio), pour les messages hors composants.
let currentLang: Lang = "fr";
async function api(action: string, body?: any): Promise<Row> {
  const res = await fetch("/api/studio/" + action, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json", "X-Studio-Request": "1" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const d: any = await res.json();
  if (!res.ok)
    throw new Error(
      d.error ||
        pick(currentLang, "Cette action n’a pas abouti.", "No se pudo completar la acción.", "That didn’t work."),
    );
  return d;
}
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Modal({
  title,
  subtitle,
  children,
  close,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  close: () => void;
}) {
  return (
    <div className="overlay" onClick={close}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="icon-button modal-x"
          onClick={close}
          aria-label={pick(useLang(), "Fermer", "Cerrar", "Close")}
        >
          <X size={20} />
        </button>
        <div className="eyebrow">LOUVET CONTENT STUDIO</div>
        <h2>{title}</h2>
        {subtitle && <p className="muted">{subtitle}</p>}
        {children}
      </section>
    </div>
  );
}
export default function Studio() {
  const [data, setData] = useState<Row | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const [intakePreview, setIntakePreview] = useState(false),
    [publicBeta, setPublicBeta] = useState(false);
  const [videoRendering, setVideoRendering] = useState(false);
  useEffect(() => {
    const handle = (e: Event) => setVideoRendering(!!(e as CustomEvent).detail);
    window.addEventListener("studio-render-busy", handle);
    return () => window.removeEventListener("studio-render-busy", handle);
  }, []);
  const [tab, setTab] = useState("overview"),
    [selected, setSelected] = useState(""),
    [clientView, setClientView] = useState(false),
    [mobileMenu, setMobileMenu] = useState(false),
    // Groupes du menu agence repliés (le groupe « Agence » l'est au départ).
    [navClosed, setNavClosed] = useState<Record<string, boolean>>({ agency: true });
  // Messages avec l'agence : panneau ouvert et compteur de non-lus tenu à jour pendant la conversation.
  const [chatOpen, setChatOpen] = useState(false),
    [chatUnreadLive, setChatUnreadLive] = useState<number | null>(null);
  // Chaque rechargement du studio apporte le compteur du serveur : il reprend la main.
  useEffect(() => setChatUnreadLive(null), [data]);
  // N'importe quel écran peut ouvrir le fil avec l'agence (ex. « Ajouter un lieu ? Écrivez-nous »).
  useEffect(() => {
    const open = () => setChatOpen(true);
    window.addEventListener("studio-open-chat", open);
    return () => window.removeEventListener("studio-open-chat", open);
  }, []);
  // N'importe quel écran peut ouvrir un onglet du studio (ex. « Mon compte › Abonnement »).
  useEffect(() => {
    const go = (e: Event) => {
      const t = (e as CustomEvent).detail;
      if (typeof t === "string" && t) {
        setTab(t);
        setDetail(null);
        window.scrollTo({ top: 0 });
      }
    };
    window.addEventListener("studio-open-tab", go);
    return () => window.removeEventListener("studio-open-tab", go);
  }, []);
  const [modal, setModal] = useState(""),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState<Row>({}),
    [codes, setCodes] = useState<Row[]>([]);
  const [occasion, setOccasion] = useState("");
  const [product, setProduct] = useState(""),
    [recipe, setRecipe] = useState(""),
    [photos, setPhotos] = useState<string[]>([]),
    [personal, setPersonal] = useState(false),
    [brief, setBrief] = useState(""),
    // Texte écrit directement sur l'image (facultatif).
    [overlayOn, setOverlayOn] = useState(false),
    [overlayText, setOverlayText] = useState(""),
    [overlayStyle, setOverlayStyle] = useState("elegant"),
    // Lieu choisi pour la création (décor de référence fourni par l'agence).
    [place, setPlace] = useState(""),
    // Atelier « Modèles » : visuel à rouvrir pour le modifier.
    [designEdit, setDesignEdit] = useState<Row | null>(null),
    // « Recréer ce post » : lien reçu depuis Instagram (?recreate=…).
    [recreateUrl, setRecreateUrl] = useState(""),
    // Fiche produit : photos choisies dans le formulaire, envoyées juste après l'enregistrement.
    [productFiles, setProductFiles] = useState<File[]>([]),
    [productSaved, setProductSaved] = useState<Row | null>(null),
    // Accueil client : tant que le guide « premiers pas » est affiché, il est seul à l'écran.
    [guideShown, setGuideShown] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null),
    [notifications, setNotifications] = useState(false),
    [uploading, setUploading] = useState(false),
    [preview, setPreview] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null),
    requestKey = useRef(uid()),
    pollLock = useRef(false);
  const admin = data?.user?.role === "agency";
  const isAgency = admin && !clientView;
  const client = data?.clients?.find((c: Row) => c.id === selected) || data?.clients?.[0];
  // Parcours guidé : retenir les onglets ouverts par le client (idées vidéo, calendrier).
  useEffect(() => {
    if (client?.id && !isAgency) markGuideVisit(client.id, tab);
    // Garder l'entrée active du menu visible, même sur un petit écran.
    document.querySelector(".sidebar .nav-item.active")?.scrollIntoView({ block: "nearest" });
  }, [tab, client?.id, isAgency]);
  const creator = isCreator(client?.config);
  // Montage vidéo : fermé par défaut, l'agence l'ouvre client par client (Marque & accès › Options de cet espace).
  const videoOn = isAgency || client?.config?.access?.video === true;
  useEffect(() => {
    if (!videoOn && ["montage", "videos", "versions"].includes(tab)) setTab("overview");
  }, [videoOn, tab]);
  // Langue de l'interface : choix mémorisé sur l'appareil, sinon langue du client. L'agence reste en français.
  const [uiLang, setUiLang] = useState<Lang | null>(null);
  useEffect(() => {
    setUiLang(readStoredLang());
  }, []);
  const lang: Lang = isAgency ? "fr" : uiLang || normLang(client?.config?.language),
    entryLang: Lang = uiLang || "fr";
  currentLang = data && client ? lang : entryLang;
  const L = <T,>(fr: T, es: T, en: T): T => pick(lang, fr, es, en),
    E = <T,>(fr: T, es: T, en: T): T => pick(entryLang, fr, es, en);
  const chooseLang = (l: Lang) => {
    setUiLang(l);
    storeLang(l);
    window.dispatchEvent(new Event("studio-lang-change"));
  };
  const statuses = statusesFor(lang),
    formats = formatsFor(lang),
    dates = (s: string) => datesFor(s, lang);
  const productRow = data?.products?.find((p: Row) => p.id === product),
    recipeRow = data?.recipes?.find((r: Row) => r.id === recipe);
  const ready = !!(
    client?.config?.brand &&
    data?.products?.length &&
    data?.recipes?.some((r: Row) => r.active) &&
    (client?.config?.allowedEmails?.length || data?.beta?.enabled)
  );
  const available = client ? Math.min(client.quota_limit - client.quota_used, data?.beta?.remaining ?? Infinity) : 0;
  const cost = recipeRow
    ? recipeRow.config.count * (client?.config.imageCost ?? 1) +
      recipeRow.config.count * (client?.config.captionCost ?? 0)
    : 0;
  // Sans type de visuel préparé par l'agence, « Créer » ouvre directement les modèles (pas de cul-de-sac).
  const noRecipe = !isAgency && !!data && !data.recipes?.some((r: Row) => r.active);
  useEffect(() => {
    if (noRecipe && tab === "create") setTab("templates");
  }, [noRecipe, tab]);
  async function load(id = selected) {
    try {
      const s = await api("state" + (id ? "?client=" + encodeURIComponent(id) : ""));
      setData(s);
      setSelected(s.selected || "");
      setLoading(false);
      return s;
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }
  useEffect(() => {
    fetch("/api/studio/public-info")
      .then((r) => r.json())
      .then((d: any) => setPublicBeta(!!d.beta))
      .catch(() => {});
    if (new URLSearchParams(window.location.search).has("billing")) setTab("billing");
    const shared = recreateParam(window.location.search);
    if (shared) {
      setRecreateUrl(shared);
      setTab("recreate");
    }
    load("");
  }, []);
  useEffect(() => {
    if (!data?.billing?.enabled || videoRendering) return;
    const timer = setInterval(() => {
      load();
    }, 60000);
    return () => clearInterval(timer);
  }, [data?.billing?.enabled, selected, videoRendering]);
  useEffect(() => {
    if (data) {
      if (!data.products?.some((p: Row) => p.id === product)) setProduct(data.products?.[0]?.id || "");
      if (!data.recipes?.some((r: Row) => r.id === recipe))
        setRecipe(data.recipes?.find((r: Row) => r.active)?.id || "");
    }
  }, [data]);
  const savedProductPhotos: string[] = (data?.files || [])
    .filter((f: Row) => f.purpose === "original" && f.product_id === product)
    .slice(0, 5)
    .map((f: Row) => f.id);
  const savedProductPhotosKey = savedProductPhotos.join(",");
  useEffect(() => {
    // Les photos enregistrées du produit sont présélectionnées : plus besoin de les reprendre à chaque fois.
    setPhotos(savedProductPhotos);
  }, [selected, product, savedProductPhotosKey]);
  useEffect(() => {
    setBrief("");
    setOccasion("");
    setDetail(null);
    requestKey.current = uid();
  }, [selected, product]);
  useEffect(() => {
    setPlace("");
  }, [selected]);
  useEffect(() => {
    if (!data) return;
    const ids = data.jobs
      ?.filter(
        (j: Row) =>
          ["processing", "submitting", "attention", "partial"].includes(j.status) &&
          data.tasks.some(
            (t: Row) => t.job_id === j.id && t.provider_id && ["processing", "uncertain"].includes(t.status),
          ),
      )
      .map((j: Row) => j.id);
    if (!ids?.length) return;
    const poll = async () => {
      if (pollLock.current) return;
      pollLock.current = true;
      try {
        await api("poll", { job_ids: ids });
        await load();
      } catch (e: any) {
        setError(e.message);
      } finally {
        pollLock.current = false;
      }
    };
    const timer = setInterval(poll, 7000);
    poll();
    return () => clearInterval(timer);
  }, [data?.jobs?.map((j: Row) => j.id + ":" + j.status).join(","), selected]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(id);
  }, [toast]);
  async function action(name: string, b: any, message = pick(currentLang, "Enregistré.", "Guardado.", "Saved.")) {
    setBusy(true);
    setError("");
    try {
      const res = await api(name, b);
      await load(b.client_id || selected);
      if (message) setToast(message);
      return res;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function changeClient(id: string) {
    setSelected(id);
    setDetail(null);
    setPhotos([]);
    await load(id);
  }
  async function upload(files: FileList | null, purpose = "original") {
    if (!files || !client) return;
    if (!product && purpose === "original") {
      setError(L("Ajoutez d’abord un produit.", "Primero agrega un producto.", "Add a product first."));
      return;
    }
    setUploading(true);
    setError("");
    try {
      const room = purpose === "original" ? 5 - savedProductPhotos.length : 3;
      if (room <= 0)
        throw Error(
          L(
            "Ce produit a déjà 5 photos. Retirez-en une pour en ajouter une nouvelle.",
            "Este producto ya tiene 5 fotos. Quita una para agregar otra.",
            "This product already has 5 photos. Remove one to add a new one.",
          ),
        );
      for (const file of Array.from(files).slice(0, room)) {
        const d = await uploadStudioMedia(file, {
          kind: "photo",
          client_id: client.id,
          product_id: purpose === "original" ? product : undefined,
          purpose,
        });
        if (purpose === "original") setPhotos((p) => [...p, d.id].slice(-5));
      }
      await load();
      setToast(
        purpose === "brand"
          ? "Références de marque enregistrées."
          : L(
              "Photos enregistrées dans votre espace.",
              "Fotos guardadas en tu espacio.",
              "Photos saved to your space.",
            ),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  async function generate() {
    const key = requestKey.current;
    const res = await action(
      "generate",
      {
        client_id: selected,
        product_id: product,
        recipe_id: recipe,
        photo_ids: photos,
        brief: personal ? brief : "",
        overlay_text: overlayOn && overlayText.trim() ? overlayText.trim() : undefined,
        overlay_style: overlayOn && overlayText.trim() ? overlayStyle : undefined,
        occasion_id: occasion || undefined,
        place_id: place && (data?.places || []).some((x: Row) => x.id === place) ? place : undefined,
        request_key: key,
      },
      L(
        "Votre demande est enregistrée. Vous pouvez quitter cette page.",
        "Tu solicitud quedó registrada. Puedes salir de esta página.",
        "Your request is saved. You can leave this page.",
      ),
    );
    if (res) {
      requestKey.current = uid();
      setTab("creations");
    }
  }
  function openProduct() {
    setForm({
      name: "",
      description: "",
      preserve: "",
      commercial: "",
      brand: client?.config.brand,
    });
    setProductFiles([]);
    setProductSaved(null);
    setModal("product");
  }
  function openSettings() {
    setForm({
      ...client,
      config: { ...client.config },
      emails: (client.config.allowedEmails || []).join("\n"),
    });
    setModal("settings");
  }
  function openRecipe(r?: Row) {
    setForm(
      r
        ? { ...r, config: { ...r.config }, scenes: r.config.scenes.join("\n") }
        : {
            name: creator ? "Décliner mon univers" : "Présenter une nouveauté",
            config: {
              ...(creator
                ? creatorRecipe
                : {
                    count: 3,
                    size: "1024x1280",
                    instructions: "Préserver strictement le produit. Aucun texte ajouté.",
                  }),
              language: client?.config.language || "es",
              tone: client?.config.tone || "Chaleureux",
            },
            scenes: creator
              ? creatorRecipe.scenes.join("\n")
              : "Studio sur fond crème, lumière naturelle\nMise en situation élégante\nGros plan sur la texture du produit",
          },
    );
    setModal("recipe");
  }
  async function save() {
    let res: any;
    if (modal === "client") {
      res = await action("clients", {
        name: form.name,
        quota_limit: Number(form.quota_limit || 30),
        config: {
          workspaceType: form.workspaceType || "brand",
          brand: form.brand || form.name,
          language: form.language || "es",
          allowedEmails: (form.emails || "")
            .split(/[\n,]/)
            .map((x: string) => x.trim())
            .filter(Boolean),
        },
      });
      if (res) {
        setCodes([res]);
        await changeClient(res.id);
        setModal("codes");
        return;
      }
    }
    if (modal === "product") {
      if (!form.name?.trim() || !form.description?.trim()) {
        setError(
          L(
            "Renseignez le nom et la description.",
            "Indica el nombre y la descripción.",
            "Enter the name and the description.",
          ),
        );
        return;
      }
      res = await action("products", { ...form, client_id: selected }, "");
      if (!res) return;
      // Les photos choisies dans le formulaire sont rattachées au nouveau produit.
      if (productFiles.length && client) {
        setUploading(true);
        try {
          for (const file of productFiles.slice(0, 5))
            await uploadStudioMedia(file, { kind: "photo", client_id: client.id, product_id: res.id, purpose: "original" });
        } catch (e: any) {
          setError(e.message);
        } finally {
          setUploading(false);
        }
        await load();
      }
      setProduct(res.id);
      setProductSaved({ id: res.id, name: form.name, photos: productFiles.length });
      setProductFiles([]);
      return;
    }
    if (modal === "recipe")
      res = await action("recipes", {
        id: form.id,
        name: form.name,
        client_id: selected,
        active: form.active !== 0,
        config: {
          ...form.config,
          count: Number(form.config.count),
          scenes: form.scenes.split("\n").filter(Boolean),
        },
      });
    if (modal === "settings")
      res = await action("settings", {
        client_id: selected,
        name: form.name,
        quota_limit: Number(form.quota_limit),
        active: !!form.active,
        config: {
          ...form.config,
          allowedEmails: form.emails
            .split(/[\n,]/)
            .map((x: string) => x.trim())
            .filter(Boolean),
        },
      });
    if (modal === "occasion")
      res = await action("occasion", { ...form, client_id: selected }, "Date ajoutée au marronnier de ce client.");
    if (modal === "correction")
      res = await action(
        "correction",
        {
          task_id: form.task_id,
          comment: form.comment,
          permanent: !!form.permanent,
        },
        L(
          "Votre demande de correction a été transmise à l’agence.",
          "Tu solicitud de corrección se envió a la agencia.",
          "Your correction request was sent to the agency.",
        ),
      );
    if (res) setModal("");
  }
  async function seed() {
    const res = await action("seed", {}, "Deux espaces de test ont été créés.");
    if (res) {
      setCodes(res.clients);
      setModal("codes");
      await load("");
    }
  }
  function jobTasks(j: Row) {
    return data?.tasks?.filter((t: Row) => t.job_id === j.id) || [];
  }
  function captionFor(j: Row, i: number) {
    const t = jobTasks(j).find((t: Row) => t.kind === "caption" && t.caption);
    try {
      return JSON.parse(t?.caption || "[]")[i] || "";
    } catch {
      return "";
    }
  }
  const job = detail && data?.jobs?.find((j: Row) => j.id === detail.id);
  if (loading)
    return (
      <div className="loading">
        <div className="wordmark">
          louvet<span>& partners</span>
        </div>
        <Loader2 className="spin" />
        <p>{E("Ouverture de votre studio…", "Abriendo tu estudio…", "Opening your studio…")}</p>
      </div>
    );
  if (!data)
    return (
      <div className="auth-page">
        <div className="wordmark">
          louvet<span>& partners</span>
        </div>
        <div className="auth-card">
          <LanguageSwitcher value={entryLang} onChange={chooseLang} />
          <span className="eyebrow">
            {E("VOTRE ESPACE DE CRÉATION", "TU ESPACIO DE CREACIÓN", "YOUR CREATIVE SPACE")}
          </span>
          <h1>
            {E("Bienvenue", "Bienvenida", "Welcome")}
            <br />
            {E("au studio.", "al estudio.", "to the studio.")}
          </h1>
          <p>
            {publicBeta
              ? E(
                  "Cette bêta est sur invitation. Connectez-vous avec votre e-mail et un code à usage unique, puis entrez le code personnel envoyé par Julie. Aucun paiement ne sera demandé.",
                  "Esta beta es solo por invitación. Inicia sesión con tu correo y un código de un solo uso, luego escribe el código personal que te envió Julie. No se te pedirá ningún pago.",
                  "This beta is invitation-only. Sign in with your email and a one-time code, then enter the personal code Julie sent you. No payment will be requested.",
                )
              : E(
                  "Connectez-vous avec votre e-mail. Créez votre demande d’inscription ou rejoignez un espace avec votre code client.",
                  "Inicia sesión con tu correo. Crea tu solicitud de registro o únete a un espacio con tu código de cliente.",
                  "Sign in with your email. Create your sign-up request or join a space with your client code.",
                )}
          </p>
          <a className="button primary" href={"/connexion?lang=" + entryLang} target="_top">
            {E("Se connecter par e-mail", "Iniciar sesión con correo", "Sign in with email")} <ArrowRight size={18} />
          </a>
          {error && <p className="error-inline">{error}</p>}
        </div>
      </div>
    );
  if (data.user.role === "unlinked" && data.beta?.enabled)
    return (
      <div className="auth-page">
        <div className="wordmark">
          louvet<span>& partners</span>
        </div>
        <div className="auth-card">
          <LanguageSwitcher value={entryLang} onChange={chooseLang} />
          <span className="eyebrow">{E("BÊTA SUR INVITATION", "BETA POR INVITACIÓN", "INVITATION-ONLY BETA")}</span>
          <h1>
            {E("Votre studio", "Tu estudio", "Your studio")}
            <br />
            {E("vous attend.", "te espera.", "is waiting.")}
          </h1>
          <p>
            {E("Votre adresse connectée :", "Tu correo conectado:", "Signed in as:")} <b>{data.user.email}</b>.{" "}
            {E(
              "Entrez le code personnel envoyé par Julie. Il ouvrira uniquement votre espace de démonstration.",
              "Escribe el código personal que te envió Julie. Solo abrirá tu espacio de demostración.",
              "Enter the personal code Julie sent you. It only opens your demo space.",
            )}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action("join", {
                code: form.code,
                first_name: form.first_name,
                weekly_opt_in: !!form.weekly_opt_in,
              });
            }}
          >
            <Field label={E("Votre prénom", "Tu nombre", "Your first name")}>
              <input
                required
                maxLength={80}
                autoComplete="given-name"
                value={form.first_name || ""}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
            </Field>
            <Field label={E("Votre code d’invitation", "Tu código de invitación", "Your invitation code")}>
              <input
                required
                autoComplete="off"
                spellCheck={false}
                placeholder="BETA-…"
                maxLength={37}
                value={form.code || ""}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </Field>
            <label className="optional-toggle">
              <input
                type="checkbox"
                checked={!!form.weekly_opt_in}
                onChange={(e) => setForm({ ...form, weekly_opt_in: e.target.checked })}
              />
              {E(
                "Recevoir le rappel du lundi lorsqu’il sera activé · facultatif",
                "Recibir el recordatorio del lunes cuando esté activo · opcional",
                "Get the Monday reminder once it’s on · optional",
              )}
            </label>
            <button className="button primary full" disabled={busy || !form.code} type="submit">
              {E("Ouvrir mon espace de test", "Abrir mi espacio de prueba", "Open my test space")}
            </button>
          </form>
          <p>
            {E(
              "Gratuit pendant la bêta. 20 tentatives d’image maximum, corrections et reprises comprises. Aucun paiement demandé.",
              "Gratis durante la beta. Máximo 20 intentos de imagen, correcciones incluidas. Sin pagos.",
              "Free during the beta. Up to 20 image attempts, corrections included. No payment requested.",
            )}
          </p>
          {error && (
            <p role="alert" className="error-inline">
              {error}
            </p>
          )}
          <a href="/auth/logout" target="_top" className="text-link">
            {E("Changer de compte", "Cambiar de cuenta", "Switch account")}
          </a>
        </div>
      </div>
    );
  if (data.user.role === "unlinked")
    return (
      <div className="auth-page">
        <div className="wordmark">
          louvet<span>& partners</span>
        </div>
        <div className="auth-card">
          <LanguageSwitcher value={entryLang} onChange={chooseLang} />
          <span className="eyebrow">
            {E("BONJOUR", "HOLA", "HELLO")}, {data.user.email}
          </span>
          <h1>
            {E("Faisons", "Vamos a", "Let’s get")}
            <br />
            {E("connaissance.", "conocernos.", "acquainted.")}
          </h1>
          <p>
            {E(
              "Créez votre compte client, puis répondez aux dix questions. L’agence préparera votre studio avant de l’ouvrir.",
              "Crea tu cuenta de cliente y responde las diez preguntas. La agencia preparará tu estudio antes de abrirlo.",
              "Create your client account, then answer the ten questions. The agency will set up your studio before opening it.",
            )}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action("register", {
                first_name: form.first_name,
                name: form.name,
                workspaceType: form.workspaceType || "brand",
                language: form.language || entryLang,
                weekly_opt_in: !!form.weekly_opt_in,
              });
            }}
          >
            <Field label={E("Votre prénom", "Tu nombre", "Your first name")}>
              <input
                required
                maxLength={80}
                value={form.first_name || ""}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
            </Field>
            <Field
              label={E("Nom de la marque ou nom public", "Nombre de la marca o nombre público", "Brand or public name")}
            >
              <input
                required
                maxLength={120}
                value={form.name || ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label={E("Votre activité", "Tu actividad", "What you do")}>
              <select
                value={form.workspaceType || "brand"}
                onChange={(e) => setForm({ ...form, workspaceType: e.target.value })}
              >
                <option value="brand">{E("Une marque", "Una marca", "A brand")}</option>
                <option value="creator">
                  {E("Créatrice / créateur de contenu", "Creadora / creador de contenido", "Content creator")}
                </option>
              </select>
            </Field>
            <Field label={E("Langue du questionnaire", "Idioma del cuestionario", "Questionnaire language")}>
              <select
                value={form.language || entryLang}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
              >
                <option value="fr">Français</option>
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </Field>
            <label className="optional-toggle">
              <input
                type="checkbox"
                checked={!!form.weekly_opt_in}
                onChange={(e) => setForm({ ...form, weekly_opt_in: e.target.checked })}
              />
              {E(
                "Recevoir le rappel du lundi · facultatif",
                "Recibir el recordatorio del lunes · opcional",
                "Get the Monday reminder · optional",
              )}
            </label>
            <button className="button primary full" disabled={busy} type="submit">
              {E(
                "Créer mon compte et répondre aux questions",
                "Crear mi cuenta y responder las preguntas",
                "Create my account and answer the questions",
              )}{" "}
              <ArrowRight size={18} />
            </button>
          </form>
          <details>
            <summary>
              {E("J’ai déjà un code client", "Ya tengo un código de cliente", "I already have a client code")}
            </summary>
            <p>
              {E(
                "Votre adresse doit avoir été autorisée par l’agence.",
                "Tu correo debe haber sido autorizado por la agencia.",
                "Your email must have been approved by the agency.",
              )}
            </p>
            <input
              aria-label={E("Code client", "Código de cliente", "Client code")}
              placeholder="LP-XXXXXXXXXXXX"
              value={form.code || ""}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
            <button
              className="button secondary"
              disabled={busy || !form.code}
              onClick={() =>
                action("join", {
                  code: form.code,
                  first_name: form.first_name,
                  weekly_opt_in: !!form.weekly_opt_in,
                })
              }
            >
              {E("Rejoindre mon espace", "Entrar a mi espacio", "Join my space")}
            </button>
          </details>
          {error && (
            <p role="alert" className="error-inline">
              {error}
            </p>
          )}
          <a href="/auth/logout" target="_top" className="text-link">
            {E("Changer de compte", "Cambiar de cuenta", "Switch account")}
          </a>
        </div>
      </div>
    );
  if (client && ((admin && intakePreview) || (!isAgency && !data.clientIntake?.ready)))
    return (
      <LangProvider value={admin ? normLang(client.config?.language) : lang}>
        {data.user?.role === "client" && (
          <ClientChat
            client={client}
            unread={chatUnreadLive ?? data.chatUnread ?? 0}
            open={chatOpen}
            setOpen={setChatOpen}
            onUnread={setChatUnreadLive}
            alwaysShowButton
          />
        )}
        <ClientIntake
          key={client.id}
          client={client}
          intake={
            data.clientIntake || {
              answers: {},
              status: "not_started",
              revision: 0,
            }
          }
          refresh={() => load()}
          preview={admin}
          onBack={() => {
            setClientView(false);
            setIntakePreview(false);
            setTab("brand");
          }}
        />
      </LangProvider>
    );
  const createTab = isAgency ? "overview" : "create";
  const pendingCount =
    (data.intakeQueue?.filter((i: Row) => i.status === "submitted").length || 0) +
    (data.publicRequests?.length || 0) +
    (data.offerRequests?.filter((o: Row) => o.status === "new").length || 0);
  const todoCount =
    data.todo.length +
    (data.bookingRequests?.length || 0) +
    (data.intakeQueue?.filter((i: Row) => i.status === "submitted").length || 0) +
    (data.videoQueue?.length || 0) +
    (data.videoReviews?.length || 0) +
    (data.collabPendingOffers?.length || 0) +
    (data.reelQueue || []).filter((c: Row) => c.status === "pending").length +
    (data.chatThreads || []).filter((t: Row) => t.unread > 0).length;
  // Fonctions allumées ou éteintes par l'agence (Agence › Fonctions visibles). Côté agence, tout reste visible.
  const feat: Record<string, any> = isAgency ? { opportunities: true, testVersions: true, brandCollabs: true, reels: true, recreate: true, siteImport: true } : data.features || {};
  // Opportunités en compte à rebours (créatrices) : badge « J-20 » dans le menu, écran d'attente.
  const oppDays = isAgency ? null : oppDaysLeft(feat);
  // Côté client, chaque entrée du menu regroupe plusieurs écrans, reliés par des onglets en haut de page.
  const clientGroups: Record<string, string[]> = {
    create: ["create", "templates", "recreate", "products"],
    montage: ["montage", "videos", "versions"],
    billing: ["billing", "collabs", "referral", "identity"],
  };
  const navActive = (id: string) => tab === id || (!isAgency && (clientGroups[id] || []).includes(tab));
  const subTabs: [string, string][] = isAgency
    ? []
    : clientGroups.create.includes(tab)
      ? [
          ["templates", L("Modèles à remplir", "Plantillas para llenar", "Templates to fill")],
          ...(noRecipe ? [] : ([["create", L("Préparés par le studio", "Preparadas por el estudio", "Made by the studio")]] as [string, string][])),
          ...(feat.recreate ? ([["recreate", L("Recréer un post", "Recrear un post", "Recreate a post")]] as [string, string][]) : []),
          ["products", creator ? L("Mes sujets", "Mis temas", "My topics") : L("Mes produits", "Mis productos", "My products")],
        ]
      : clientGroups.montage.includes(tab)
        ? [
            ["montage", L("Mes vidéos", "Mis videos", "My videos")],
            ["videos", L("Idées de vidéos", "Ideas de videos", "Video ideas")],
            ...(creator && feat.testVersions ? ([["versions", L("Versions à tester", "Versiones de prueba", "Test versions")]] as [string, string][]) : []),
          ]
        : clientGroups.billing.includes(tab)
          ? [
              ["billing", L("Abonnement", "Suscripción", "Subscription")],
              ...(creator ? ([["identity", L("Mes repères", "Mis referencias", "My guidelines")]] as [string, string][]) : []),
              ...(!creator && feat.brandCollabs ? ([["collabs", L("Collaborations", "Colaboraciones", "Collaborations")]] as [string, string][]) : []),
              ["referral", L("Réductions", "Descuentos", "Discounts")],
            ]
          : [];
  // Badge agence : offres de collaboration et Reels qui attendent une validation.
  const collabTodo = isAgency
    ? (data.collabPendingOffers?.length || 0) + (data.reelQueue || []).filter((c: Row) => c.status === "pending").length
    : 0;
  const nav = isAgency
    ? [
        ...(data.beta?.enabled ? [["beta", "Bêta & avis", Users]] : []),
        ["overview", "Vue d’ensemble", LayoutGrid],
        ["messages", "Messages", MessageCircle],
        ["opportunities", "Opportunités créatrices", Handshake],
        ["collabs", "Reels & collaborations", Sparkles],
        ["mail", "E-mails & rappels", Bell],
        ["pending", "Demandes en attente", Users],
        ["billing", "Paiements & abonnements", CreditCard],
        ["todo", "À traiter", Clock],
        ["delivery", "Livraison du 3", PackageCheck],
        ["referral", "Parrainages", Gift],
        ["publication", "Calendrier clients", CalendarDays],
        ["creations", "Créations", ImageIcon],
        ["templates", "Modèles", Shapes],
        ["videos", "30 idées vidéo", Video],
        ["montage", "Montages", Scissors],
        ["products", creator ? "Sujets & références" : "Produits", Package],
        ["recipes", "Recettes", WandSparkles],
        ["styles", "Styles de montage", Scissors],
        ["features", "Fonctions visibles", SlidersHorizontal],
        ["brand", creator ? "Identité & accès" : "Marque & accès", Palette],
        ["history", "Historique", History],
      ]
    : [
        ["overview", L("Accueil", "Inicio", "Home"), LayoutGrid],
        ["create", L("Créer", "Crear", "Create"), Sparkles],
        ["creations", L("Mes visuels", "Mis imágenes", "My visuals"), ImageIcon],
        ...(videoOn ? [["montage", L("Mes vidéos", "Mis videos", "My videos"), Video]] : []),
        ["publication", L("Mon calendrier", "Mi calendario", "My calendar"), CalendarDays],
        ...(creator && (feat.opportunities || oppDays !== null) ? [["opportunities", L("Opportunités", "Oportunidades", "Opportunities"), Handshake]] : []),
        ["billing", L("Mon compte", "Mi cuenta", "My account"), CreditCard],
      ];
  // Menu agence en trois groupes repliables : ce qui attend, le client choisi, les réglages de l'agence.
  const navById = Object.fromEntries((isAgency ? nav : []).map((n: any) => [n[0], n]));
  const groupOf = (ids: string[]) => ids.map((id) => navById[id]).filter(Boolean);
  const agencyNavGroups = isAgency
    ? [
        { id: "inbox", label: "À traiter", items: groupOf(["todo", "messages", "pending", "collabs", "beta"]), badge: 0 },
        { id: "client", label: "Client · " + (client?.name || ""), items: groupOf(["overview", "creations", "publication", "templates", "videos", "montage", "products", "recipes", "brand", "history"]), badge: 0 },
        { id: "agency", label: "Agence", items: groupOf(["billing", "referral", "delivery", "mail", "opportunities", "styles", "features"]), badge: 0 },
      ]
    : [];
  return (
    <LangProvider value={lang}>
      <div
        lang={lang}
        className={"shell " + (!isAgency ? "client-space" : "")}
        data-vibe={!isAgency ? client?.config.studioVibe || "clean" : undefined}
        style={!isAgency ? (studioTheme(client?.config) as React.CSSProperties) : undefined}
      >
        <aside className={"sidebar " + (mobileMenu ? "open" : "")}>
          <a className={isAgency ? "wordmark" : "client-wordmark"} href="/">
            {isAgency ? (
              <>
                louvet<span>& partners</span>
              </>
            ) : (
              <>
                {client?.config.brand || client?.name}
                <small>{L("Votre espace de création", "Tu espacio de creación", "Your creative space")}</small>
              </>
            )}
          </a>
          <div className="studio-label">
            {isAgency ? (
              <>
                CONTENT STUDIO <span>BÊTA</span>
              </>
            ) : (
              L("Avec Louvet & Partners", "Con Louvet & Partners", "With Louvet & Partners")
            )}
          </div>
          <div className="workspace-label">
            {isAgency
              ? "ESPACE AGENCE"
              : creator
                ? L("ESPACE CRÉATRICE", "ESPACIO CREADORA", "CREATOR SPACE")
                : L("ESPACE CLIENT", "ESPACIO CLIENTE", "CLIENT SPACE")}
          </div>
          <nav>
            {(isAgency ? agencyNavGroups : [{ id: "all", label: "", items: nav }]).map((g: Row) => (
              <div key={g.id} className={"nav-group" + (g.label ? " grouped" : "")}>
                {g.label && (
                  <button
                    className="nav-group-head"
                    aria-expanded={!navClosed[g.id]}
                    onClick={() => setNavClosed((c) => ({ ...c, [g.id]: !c[g.id] }))}
                  >
                    {g.label}
                    {g.badge > 0 && <span className="count">{g.badge}</span>}
                    <ChevronDown size={14} className={navClosed[g.id] ? "closed" : ""} />
                  </button>
                )}
                {!(navClosed[g.id] && !g.items.some((it: any) => navActive(it[0]))) && g.items.map(([id, label, Icon]: any) => (
              <button
                key={id}
                disabled={videoRendering}
                className={navActive(id) ? "nav-item active" : "nav-item"}
                aria-current={navActive(id) ? "page" : undefined}
                onClick={() => {
                  setTab(id);
                  setDetail(null);
                  setMobileMenu(false);
                }}
              >
                <Icon size={18} />
                {label}
                {id === "pending" && pendingCount > 0 && <span className="count">{pendingCount}</span>}
                {id === "todo" && todoCount > 0 && <span className="count">{todoCount}</span>}
                {id === "messages" && (data.chatUnread || 0) > 0 && <span className="count">{data.chatUnread}</span>}
                {id === "opportunities" && !isAgency && oppDays !== null && <span className="count soon">{L(`J-${oppDays}`, `D-${oppDays}`, `D-${oppDays}`)}</span>}
                {id === "collabs" && isAgency && collabTodo > 0 && (
                  <span className="count count-alert" title="Offres et Reels à valider">
                    {collabTodo}
                  </span>
                )}
              </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-bottom">
            {data.user?.role === "client" && (
              <ChatSidebarButton
                unread={chatUnreadLive ?? data.chatUnread ?? 0}
                onOpen={() => {
                  setMobileMenu(false);
                  setChatOpen(true);
                }}
              />
            )}
            {!isAgency && <BookingButton client={client} hasLink={!!data.bookingUrl} variant="sidebar" />}
            <div className={"secure-note" + (!isAgency ? " agency-only" : "")}>
              <ShieldCheck size={16} />
              <span>
                {L("Espace privé", "Espacio privado", "Private space")}
                <br />
                <small>
                  {L(
                    "Vos photos restent dans votre espace",
                    "Tus fotos se quedan en tu espacio",
                    "Your photos stay in your space",
                  )}
                </small>
              </span>
            </div>
            <div className="profile">
              <div className="avatar">{isAgency ? "LP" : client?.name?.slice(0, 2).toUpperCase() || "CL"}</div>
              <div>
                <b>{isAgency ? "Louvet & Partners" : client?.config.brand}</b>
                <small>{data.user.email}</small>
              </div>
              <a href="/auth/logout" target="_top" aria-label={L("Se déconnecter", "Cerrar sesión", "Sign out")}>
                <LogOut size={16} />
              </a>
            </div>
          </div>
        </aside>
        <main>
          <header className="topbar">
            <button
              className={"icon-button mobile-only" + (!isAgency ? " client-menu-button" : "")}
              aria-label={isAgency ? "Menu" : L("Mon compte et plus", "Mi cuenta y más", "My account and more")}
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              {isAgency ? <Menu /> : <span className="avatar">{client?.name?.slice(0, 2).toUpperCase() || "CL"}</span>}
            </button>
            <div className="breadcrumb">
              Content Studio <span>/</span>{" "}
              {isAgency ? "Agence" : client?.config.brand || L("Client", "Cliente", "Client")}
            </div>
            <div className="top-actions">
              {admin && (
                <button
                  disabled={videoRendering}
                  className={"view-toggle " + (clientView ? "on" : "")}
                  onClick={() => {
                    setClientView(!clientView);
                    setTab("overview");
                  }}
                >
                  {clientView ? "Retour agence" : "Vue client"} <ExternalLink size={14} />
                </button>
              )}
              {isAgency && <span className="live-dot">Version de test</span>}
              {!isAgency && <LanguageSwitcher value={lang} onChange={chooseLang} />}
              <button
                className="icon-button notification-button"
                aria-label="Notifications"
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={19} />
                {data.notifications.length > 0 && <i />}
              </button>
            </div>
            {notifications && (
              <div className="notification-panel">
                <h3>{L("Notifications", "Notificaciones", "Notifications")}</h3>
                {data.notifications.length ? (
                  data.notifications.map((n: Row) => {
                    const text = n.i18n?.[lang] || n.message;
                    const go = n.target as string | null;
                    return go ? (
                      <button
                        key={n.id}
                        className="notification-item"
                        onClick={() => {
                          setNotifications(false);
                          if (go === "chat") setChatOpen(true);
                          else {
                            setTab(go);
                            setDetail(null);
                          }
                        }}
                      >
                        <p>{text}</p>
                        <small>
                          {dates(n.created)} · <span className="notification-open">{L("Ouvrir", "Abrir", "Open")} →</span>
                        </small>
                      </button>
                    ) : (
                      <div key={n.id}>
                        <p>{text}</p>
                        <small>{dates(n.created)}</small>
                      </div>
                    );
                  })
                ) : (
                  <p className="muted">
                    {L(
                      "Vous retrouverez ici les nouvelles de vos créations.",
                      "Aquí verás las novedades de tus creaciones.",
                      "News about your creations will show up here.",
                    )}
                  </p>
                )}
              </div>
            )}
          </header>
          <div className="content">
            {error && !modal && (
              <div role="alert" className="alert error">
                <AlertCircle size={18} />
                <span>{error}</span>
                <button
                  className="icon-button"
                  aria-label={L("Fermer l’erreur", "Cerrar el error", "Close error")}
                  onClick={() => setError("")}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {data.beta?.enabled && !isAgency && (
              <div className="billing-notice">
                <b>
                  {L(
                    `${data.beta.remaining} visuels restants sur 20`,
                    `Te quedan ${data.beta.remaining} de 20 imágenes`,
                    `${data.beta.remaining} of 20 visuals left`,
                  )}
                </b>
                <p>
                  {L(
                    "Pour toute la bêta. Les corrections et les reprises sont incluses. Aucun paiement ni renouvellement automatique.",
                    "Para toda la beta. Las correcciones están incluidas. Sin pagos ni renovación automática.",
                    "For the whole beta. Corrections are included. No payment and no automatic renewal.",
                  )}
                </p>
              </div>
            )}
            {/* Côté client, l'information équivalente s'affiche dans « Créer » (bandeau orange). */}
            {data.apiStatus === "billing_required" && isAgency && (
              <div className="alert error">
                <AlertCircle size={18} />
                <span>{data.apiMessage}</span>
                {isAgency && (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      action("connection-check", {}, "Connexion vérifiée. Les générations sont disponibles.")
                    }
                  >
                    Vérifier après activation
                  </button>
                )}
              </div>
            )}
            {!isAgency && <BillingNotice billing={data.billing} onOpen={() => setTab("billing")} />}
            {clientView && (
              <div className="preview-bar">
                <Users size={16} />
                Vous consultez le parcours client depuis votre compte agence.
              </div>
            )}
            <section className="page-title">
              <div>
                <div className="eyebrow">
                  {isAgency ? "LA CRÉATIVITÉ, BIEN ORCHESTRÉE." : client.config.brand || client.name}
                </div>
                <h1>
                  {(tab === "opportunities"
                    ? oppTitles[isAgency ? "fr" : lang][0]
                    : tab === "templates"
                    ? L("Des visuels prêts, sans photo ou avec les vôtres.", "Imágenes listas, sin foto o con las tuyas.", "Ready visuals, with or without your photos.")
                    : tab === "versions"
                    ? L("Vos versions à tester.", "Tus versiones de prueba.", "Your test versions.")
                    : tab === "referral" && !isAgency
                    ? L("Vos réductions.", "Tus descuentos.", "Your discounts.")
                    : tab === "collabs"
                    ? isAgency
                      ? "Reels & collaborations."
                      : L("Collaborations.", "Colaboraciones.", "Collaborations.")
                    : extraTitles[tab]?.[0]) ??
                    (tab === "mail"
                      ? "Les e-mails, avec ta signature."
                      : tab === "beta"
                        ? "La bêta et vos retours."
                        : tab === "billing"
                          ? isAgency
                            ? "Paiements et accès."
                            : L("Votre abonnement.", "Tu suscripción.", "Your subscription.")
                          : tab === "publication"
                            ? L(
                                "Votre calendrier de publication.",
                                "Tu calendario de publicaciones.",
                                "Your posting calendar.",
                              )
                            : tab === "pending"
                              ? "Les demandes en attente."
                              : tab === "create"
                                ? L("Créons votre prochain visuel.", "Creemos tu próxima imagen.", "Let’s create your next visual.")
                              : tab === "recreate"
                                ? L("Recréez ce que vous aimez.", "Recrea lo que te gusta.", "Recreate what you love.")
                              : tab === "overview"
                                ? isAgency
                                  ? "Votre studio, en un regard."
                                  : L("Bonjour !", "¡Hola!", "Hello!")
                                : tab === "todo"
                                  ? "Les prochaines actions."
                                  : tab === "creations"
                                    ? L("Vos visuels sont ici.", "Aquí están tus imágenes.", "Your visuals are here.")
                                    : tab === "videos"
                                      ? L(
                                          "Votre prochain mois en vidéo.",
                                          "Tu próximo mes en video.",
                                          "Your next month on video.",
                                        )
                                      : tab === "montage"
                                        ? L(
                                            "Vos vidéos, au même endroit.",
                                            "Tus videos, en un solo lugar.",
                                            "Your videos, all in one place.",
                                          )
                                        : tab === "products"
                                          ? creator
                                            ? L(
                                                "Vos sujets, votre matière à créer.",
                                                "Tus temas, tu materia para crear.",
                                                "Your topics, the raw material for your content.",
                                              )
                                            : L(
                                                "Chaque produit a sa place.",
                                                "Cada producto tiene su lugar.",
                                                "Every product has its place.",
                                              )
                                          : tab === "styles"
                                            ? "Votre signature, en mouvement."
                                            : tab === "recipes"
                                              ? "Une idée. Une recette."
                                              : tab === "brand"
                                                ? creator
                                                  ? "Une identité bien définie."
                                                  : "Une marque bien définie."
                                                : tab === "identity"
                                                  ? L(
                                                      "Vos repères pour créer.",
                                                      "Tus referencias para crear.",
                                                      "Your guidelines for creating.",
                                                    )
                                                  : "La mémoire du studio.")}
                </h1>
                <p>
                  {(tab === "opportunities"
                    ? isAgency
                      ? "Le carnet de marques que voient les créatrices, trié par niche. Chacune y suit ses prises de contact en privé."
                      : oppTitles[lang][1]
                    : tab === "templates"
                    ? L(
                        "Choisissez un modèle, écrivez votre texte, choisissez vos couleurs et votre police : c’est prêt à publier.",
                        "Elige una plantilla, escribe tu texto, elige tus colores y tu fuente: listo para publicar.",
                        "Pick a template, write your text, choose your colors and font: it’s ready to post.",
                      )
                    : tab === "versions"
                    ? L(
                        "Testez plusieurs versions d’une même vidéo et gardez celle qui marche le mieux.",
                        "Prueba varias versiones de un mismo video y quédate con la que mejor funciona.",
                        "Test several versions of the same video and keep the one that works best.",
                      )
                    : tab === "referral" && !isAgency
                    ? L(
                        "Publiez un Reel avec Julie ou parrainez une marque : chaque fois, une réduction sur votre abonnement.",
                        "Publica un Reel con Julie o recomienda una marca: cada vez, un descuento en tu suscripción.",
                        "Post a Reel with Julie or refer a brand: each time, a discount on your plan.",
                      )
                    : tab === "collabs"
                    ? isAgency
                      ? "Les Reels déclarés par les clients, à valider, et les propositions entre créatrices et marques."
                      : L(
                          "Laissez les créatrices du studio vous proposer des collaborations, si vous le souhaitez.",
                          "Deja que las creadoras del estudio te propongan colaboraciones, si quieres.",
                          "Let studio creators propose collaborations to you, if you’d like.",
                        )
                    : extraTitles[tab]?.[1]) ??
                    (tab === "mail"
                      ? "Les textes, les chiffres sourcés et le suivi des envois."
                      : tab === "beta"
                        ? "Les invitations, les essais et les retours, au même endroit."
                        : tab === "billing"
                          ? L(
                              "Le suivi de vos paiements et de votre accès au studio.",
                              "El seguimiento de tus pagos y de tu acceso al estudio.",
                              "Track your payments and your studio access.",
                            )
                          : tab === "publication"
                            ? L(
                                "Chaque contenu à sa date. Votre régularité prend forme.",
                                "Cada contenido en su fecha. Tu constancia toma forma.",
                                "Every post on its date. Your consistency takes shape.",
                              )
                            : tab === "pending"
                              ? "Lisez les réponses, préparez chaque espace, puis ouvrez le compte."
                              : tab === "recreate"
                                ? L(
                                    "Un post vu sur Instagram, refait avec vos photos et vos mots.",
                                    "Un post visto en Instagram, rehecho con tus fotos y tus palabras.",
                                    "A post you saw on Instagram, remade with your photos and words.",
                                  )
                              : tab === "create"
                                ? L(
                                    "Choisissez votre produit : le studio prépare le visuel et son texte.",
                                    "Elige tu producto: el estudio prepara la imagen y su texto.",
                                    "Pick your product: the studio prepares the visual and its caption.",
                                  )
                              : tab === "overview"
                                ? isAgency
                                  ? "Un espace pour vos clients. Une vision claire pour votre équipe."
                                  : L(
                                      "Que voulez-vous faire aujourd’hui ?",
                                      "¿Qué quieres hacer hoy?",
                                      "What would you like to do today?",
                                    )
                                : tab === "creations"
                                  ? L(
                                      "Téléchargez vos visuels et copiez le texte à publier avec chacun.",
                                      "Descarga tus imágenes y copia el texto para publicar con cada una.",
                                      "Download your visuals and copy the text to post with each one.",
                                    )
                                  : tab === "videos"
                                    ? L(
                                        "30 idées chaque mois, avec un déroulé concret pour les tourner.",
                                        "30 ideas cada mes, con pasos concretos para grabarlas.",
                                        "30 ideas every month, with clear steps to film them.",
                                      )
                                    : tab === "montage"
                                      ? L(
                                          "Ajoutez les petites vidéos de votre téléphone pour les réunir en une seule.",
                                          "Agrega los videos cortos de tu teléfono para unirlos en uno solo.",
                                          "Add the short videos from your phone to combine them into one.",
                                        )
                                      : tab === "products"
                                        ? L(
                                            "Des informations enregistrées une fois, réutilisées à chaque création.",
                                            "Información guardada una vez y reutilizada en cada creación.",
                                            "Details saved once, reused every time you create.",
                                          )
                                        : tab === "styles"
                                          ? "Enregistrez vos styles, puis attribuez-les aux espaces clients."
                                          : tab === "recipes"
                                            ? "Vos directions créatives, prêtes à être réutilisées."
                                            : tab === "brand"
                                              ? "Identité, références, crédits et accès : tout commence ici."
                                              : tab === "todo"
                                                ? "Validations, corrections et générations à vérifier."
                                                : tab === "identity"
                                                  ? L(
                                                      "Ce qui vous ressemble, préparé avec l’agence.",
                                                      "Lo que te representa, preparado con la agencia.",
                                                      "What feels like you, prepared with the agency.",
                                                    )
                                                  : "Chaque décision conserve son auteur et sa date.")}
                </p>
              </div>
              {isAgency && !data.beta?.enabled && tab === "overview" && (
                <button
                  disabled={videoRendering}
                  className="button primary"
                  onClick={() => {
                    setForm({
                      quota_limit: 30,
                      language: "es",
                      workspaceType: "brand",
                    });
                    setModal("client");
                  }}
                >
                  <Plus size={17} />
                  Ajouter un client
                </button>
              )}
            </section>
            {subTabs.length > 0 && (
              <div className="sub-tabs" role="tablist">
                {subTabs.map(([id, label]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={tab === id}
                    className={tab === id ? "active" : ""}
                    disabled={videoRendering}
                    onClick={() => {
                      setTab(id);
                      setDetail(null);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {isAgency && data.clients.length > 0 && !["messages", "opportunities", "collabs", "mail", "todo", "pending", "features"].includes(tab) && (
              <div className="client-strip">
                <span className="eyebrow">CLIENT</span>
                <select
                  disabled={videoRendering}
                  value={selected}
                  onChange={(e) => changeClient(e.target.value)}
                  aria-label="Choisir un espace"
                >
                  {data.clients.map((c: Row) => (
                    <option key={c.id} value={c.id}>
                      {c.config.workspaceType === "creator" ? "Créatrice · " : "Marque · "}
                      {c.name}
                    </option>
                  ))}
                </select>
                <span className={"status " + (ready ? "ready" : "review")}>
                  {ready ? "Configuration prête" : "À configurer"}
                </span>
                <button disabled={videoRendering} className="text-link" onClick={openSettings}>
                  Paramètres <SlidersHorizontal size={14} />
                </button>
              </div>
            )}
            {!data.clients.length ? (
              <section className="welcome-empty">
                <div className="empty-icon">
                  <Sparkles size={30} />
                </div>
                <h2>Votre premier client commence ici.</h2>
                <p>Créez son espace, définissez sa marque et préparez sa première recette.</p>
                <button
                  className="button primary"
                  onClick={() => {
                    setForm({
                      quota_limit: 30,
                      language: "es",
                      workspaceType: "brand",
                    });
                    setModal("client");
                  }}
                >
                  Créer un espace client <Plus size={17} />
                </button>
                <button className="text-link" disabled={busy} onClick={seed}>
                  Ou explorer avec deux espaces de test <ArrowUpRight size={15} />
                </button>
                <div className="onboarding-row">
                  <span>01 · Créer l’espace</span>
                  <span>02 · Définir la marque</span>
                  <span>03 · Ajouter les produits</span>
                  <span>04 · Créer les contenus</span>
                </div>
              </section>
            ) : (
              <>
                {tab === "mail" && isAgency && <StudioMail mail={data.mail} refresh={() => load()} />}
                {tab === "messages" && isAgency && <AgencyInbox data={data} refresh={() => load()} />}
                {tab === "opportunities" && isAgency && <OpportunitiesAgency data={data} refresh={() => load()} />}
                {tab === "features" && isAgency && <FeaturesPanel data={data} refresh={() => load()} />}
                {tab === "opportunities" && !isAgency && client && creator && !feat.opportunities && oppDays !== null && (
                  <OppCountdown data={data} onOpened={() => load()} />
                )}
                {tab === "opportunities" && !isAgency && client && creator && feat.opportunities && (
                  <Opportunities data={data} client={client} refresh={() => load()} />
                )}
                {tab === "beta" && isAgency && (
                  <>
                    <BetaInviteCreator data={data} refresh={() => load()} />
                    <BetaAgency beta={data.beta} />
                  </>
                )}
                {tab === "overview" && !isAgency && (
                  <>
                    <ClientGuide
                      client={client}
                      data={data}
                      creator={creator}
                      onShown={setGuideShown}
                      onGo={(target) => {
                        setTab(target);
                        // Le guide ouvre directement le formulaire produit.
                        if (target === "products") openProduct();
                      }}
                    />
                        <div className="client-shortcuts">
                          <button onClick={() => setTab(noRecipe ? "templates" : "create")}>
                            <ImageIcon size={23} />
                            <b>{L("Créer un visuel", "Crear una imagen", "Create a visual")}</b>
                            <span>
                              {noRecipe
                                ? L("Avec un modèle et vos photos", "Con una plantilla y tus fotos", "With a template and your photos")
                                : L("À partir de vos photos", "A partir de tus fotos", "From your own photos")}
                            </span>
                          </button>
                          {videoOn && (
                          <button onClick={() => setTab("videos")}>
                            <Video size={23} />
                            <b>{L("Filmer une vidéo", "Grabar un video", "Film a video")}</b>
                            <span>
                              {L(
                                "Suivez les étapes, une à une",
                                "Sigue los pasos, uno a uno",
                                "Follow the steps, one by one",
                              )}
                            </span>
                          </button>
                          )}
                          {!noRecipe && (
                          <button onClick={() => setTab("templates")}>
                            <Shapes size={23} />
                            <b>{L("Modèles", "Plantillas", "Templates")}</b>
                            <span>
                              {L(
                                "Texte, avant / après, portfolio…",
                                "Texto, antes / después, portafolio…",
                                "Text, before / after, portfolio…",
                              )}
                            </span>
                          </button>
                          )}
                          {feat.recreate && (
                            <button onClick={() => setTab("recreate")}>
                              <Wand2 size={23} />
                              <b>{L("Recréer un post", "Recrear un post", "Recreate a post")}</b>
                              <span>{L("Vu sur Instagram, refait avec vos photos", "Visto en Instagram, rehecho con tus fotos", "Seen on Instagram, remade with your photos")}</span>
                            </button>
                          )}
                          <button onClick={() => setTab("publication")}>
                            <CalendarDays size={23} />
                            <b>{L("Voir mon calendrier", "Ver mi calendario", "See my calendar")}</b>
                            <span>
                              {L("Ce que vous pouvez publier", "Lo que puedes publicar", "What you can post")}
                            </span>
                          </button>
                        </div>
                    {!guideShown && (
                      <>
                        {feat.reels && <ReelTeaser data={data} onOpen={() => setTab("referral")} />}
                        {/* Les points n'apparaissent qu'après la première publication confirmée. */}
                        {(data.rewards?.total || 0) > 0 && <Rewards rewards={data.rewards} />}
                        <MailPreference
                          mail={data.mail}
                          busy={busy}
                          onChange={(enabled) =>
                            action(
                              "mail-preference",
                              { enabled },
                              L("Préférence enregistrée.", "Preferencia guardada.", "Preference saved."),
                            )
                          }
                        />
                        {data.jobs.length > 0 && (
                        <section className="recent-panel">
                          <div className="section-heading">
                            <div>
                              <span className="step-tag">
                                {L("VOS DERNIERS VISUELS", "TUS ÚLTIMAS IMÁGENES", "YOUR LATEST VISUALS")}
                              </span>
                            </div>
                            <button className="text-link" onClick={() => setTab("creations")}>
                              {L("Tout voir", "Ver todo", "See all")} <ArrowUpRight size={15} />
                            </button>
                          </div>
                          {data.jobs.slice(0, 3).map((j: Row) => (
                            <button
                              className="recent-job"
                              key={j.id}
                              onClick={() => {
                                setDetail(j);
                                setTab("creations");
                              }}
                            >
                              <div className="job-thumb">
                                {jobTasks(j).find((t: Row) => t.output_file) ? (
                                  <img
                                    src={"/api/studio/file/" + jobTasks(j).find((t: Row) => t.output_file).output_file}
                                    alt={L("Aperçu de création", "Vista previa de la creación", "Creation preview")}
                                  />
                                ) : (
                                  <ImageIcon size={22} />
                                )}
                              </div>
                              <div>
                                <b>{j.config.product.name}</b>
                                <small>{dates(j.created)}</small>
                              </div>
                              <span className={"status " + j.status}>{statuses[j.status]}</span>
                            </button>
                          ))}
                          {!data.jobs.length && (
                            <div className="empty-small">
                              <ImageIcon size={27} />
                              <p>
                                {L(
                                  "Votre galerie attend sa première création.",
                                  "Tu galería espera su primera creación.",
                                  "Your gallery is waiting for its first creation.",
                                )}
                              </p>
                              <span>
                                {L(
                                  "Tout commence avec une photo.",
                                  "Todo empieza con una foto.",
                                  "It all starts with a photo.",
                                )}
                              </span>
                            </div>
                          )}
                        </section>
                        )}
                      </>
                    )}
                  </>
                )}
                {tab === "overview" && isAgency && (
                  <>
                    {isAgency && (
                      <div className="stats">
                        <div>
                          <span>Marques & créatrices</span>
                          <b>
                            {data.clients.length}
                            <small>dans votre studio</small>
                          </b>
                          <Users size={20} />
                        </div>
                        <div>
                          <span>Créations de ce client</span>
                          <b>
                            {data.jobs.length}
                            <small>demandes enregistrées</small>
                          </b>
                          <ImageIcon size={20} />
                        </div>
                        <div>
                          <span>À traiter · tous clients</span>
                          <b>
                            {data.todo.length}
                            <small>actions en attente</small>
                          </b>
                          <Clock size={20} />
                        </div>
                        <div>
                          <span>Crédits disponibles</span>
                          <b>
                            {available}
                            <small>sur {client.quota_limit} attribués</small>
                          </b>
                          <Sparkles size={20} />
                        </div>
                      </div>
                    )}
                  </>
                )}
                {tab === createTab && (
                  <>
                    {!isAgency && (data.apiStatus === "billing_required" || !data.generationReady) && data.recipes.some((r: Row) => r.active) && (
                      <div className="alert warn" role="status">
                        <AlertCircle size={18} />
                        <span>
                          {L(
                            "La création de visuels avec vos photos est momentanément en pause. Les modèles et les vidéos fonctionnent.",
                            "La creación de imágenes con tus fotos está en pausa por el momento. Las plantillas y los videos funcionan.",
                            "Creating visuals from your photos is paused for now. Templates and videos still work.",
                          )}
                        </span>
                        <button className="button secondary" onClick={() => setTab("templates")}>
                          {L("Ouvrir les modèles", "Abrir las plantillas", "Open templates")}
                        </button>
                      </div>
                    )}
                    <div className={isAgency ? "studio-grid" : "studio-grid single"}>
                      <section className="create-panel" id="photo-creation">
                        {isAgency && (
                          <div className="section-heading">
                            <span className="step-tag">01 / CRÉER</span>
                            <Sparkles size={19} />
                          </div>
                        )}
                        <h2>
                          {isAgency
                            ? "Créer pour ce client."
                            : L("Votre visuel, en trois étapes.", "Tu imagen, en tres pasos.", "Your visual, in three steps.")}
                        </h2>
                        <p className="muted">
                          {creator
                            ? L(
                                "Choisissez un sujet et ajoutez des photos qui vous représentent.",
                                "Elige un tema y agrega fotos que te representen.",
                                "Choose a topic and add photos that represent you.",
                              )
                            : L(
                                "Choisissez un produit et ajoutez des photos où il est bien visible.",
                                "Elige un producto y agrega fotos donde se vea bien.",
                                "Choose a product and add photos where it’s clearly visible.",
                              )}{" "}
                          {L(
                            "Le studio prépare les visuels et les textes pour vous.",
                            "El estudio prepara las imágenes y los textos por ti.",
                            "The studio prepares the visuals and captions for you.",
                          )}
                        </p>
                        {!isAgency && !data.recipes.some((r: Row) => r.active) ? (
                          <div className="create-waiting">
                            <Clock size={26} />
                            <h3>
                              {L(
                                "Julie prépare vos types de visuel.",
                                "Julie está preparando tus tipos de imagen.",
                                "Julie is preparing your visual styles.",
                              )}
                            </h3>
                            <p>
                              {L(
                                "Vous recevrez un message dès qu’ils sont prêts. En attendant, les modèles sont disponibles.",
                                "Recibirás un mensaje en cuanto estén listos. Mientras tanto, las plantillas están disponibles.",
                                "You’ll get a message as soon as they’re ready. Meanwhile, templates are available.",
                              )}
                            </p>
                            <div className="row-actions">
                              <button className="button primary" onClick={() => setTab("templates")}>
                                {L("Ouvrir les modèles", "Abrir las plantillas", "Open templates")} <ArrowRight size={15} />
                              </button>
                              {data.user?.role === "client" && (
                                <button className="button secondary" onClick={() => setChatOpen(true)}>
                                  <MessageCircle size={15} />
                                  {L("Écrire à l’agence", "Escribir a la agencia", "Message the agency")}
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                        <>
                        <Field
                          label={
                            creator
                              ? L(
                                  "1. Que voulez-vous montrer ?",
                                  "1. ¿Qué quieres mostrar?",
                                  "1. What do you want to show?",
                                )
                              : L(
                                  "1. Quel produit voulez-vous montrer ?",
                                  "1. ¿Qué producto quieres mostrar?",
                                  "1. Which product do you want to show?",
                                )
                          }
                        >
                          <div className="select-add">
                            <select value={product} onChange={(e) => setProduct(e.target.value)}>
                              {!data.products.length && (
                                <option value="">
                                  {creator
                                    ? L("Ajoutez votre premier sujet", "Agrega tu primer tema", "Add your first topic")
                                    : L(
                                        "Ajoutez votre premier produit",
                                        "Agrega tu primer producto",
                                        "Add your first product",
                                      )}
                                </option>
                              )}
                              {data.products.map((p: Row) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <button
                              className="icon-button"
                              onClick={openProduct}
                              aria-label={
                                creator
                                  ? L("Ajouter un sujet", "Agregar un tema", "Add a topic")
                                  : L("Ajouter un produit", "Agregar un producto", "Add a product")
                              }
                            >
                              <Plus size={18} />
                            </button>
                          </div>
                        </Field>
                        <Field
                          label={L("Le type de visuel", "El tipo de imagen", "Visual style")}
                          hint={
                            isAgency
                              ? "Les recettes actives de ce client."
                              : L(
                                  "Votre agence a préparé ces choix pour vous.",
                                  "Tu agencia preparó estas opciones para ti.",
                                  "Your agency prepared these options for you.",
                                )
                          }
                        >
                          <select value={recipe} onChange={(e) => setRecipe(e.target.value)}>
                            {data.recipes
                              .filter((r: Row) => r.active)
                              .map((r: Row) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                          </select>
                        </Field>
                        {recipeRow && (
                          <div className="recipe-summary">
                            <span>
                              {recipeRow.config.count}{" "}
                              {recipeRow.config.count > 1
                                ? L("images", "imágenes", "images")
                                : L("image", "imagen", "image")}
                            </span>
                            <span>{formats[recipeRow.config.size]}</span>
                            <span>
                              {L("Textes en", "Textos en", "Captions in")}{" "}
                              {(
                                L(
                                  {
                                    fr: "français",
                                    es: "espagnol",
                                    en: "anglais",
                                  },
                                  {
                                    fr: "francés",
                                    es: "español",
                                    en: "inglés",
                                  },
                                  {
                                    fr: "French",
                                    es: "Spanish",
                                    en: "English",
                                  },
                                ) as Row
                              )[recipeRow.config.language] || recipeRow.config.language}
                            </span>
                          </div>
                        )}
                        <OccasionPicker
                          events={(data.calendar || []).map((e: Row) =>
                            productRow && e.product_name
                              ? {
                                  ...e,
                                  angle: e.angle.replaceAll(e.product_name, productRow.name),
                                }
                              : e,
                          )}
                          chosen={occasion}
                          onChoose={setOccasion}
                          admin={isAgency}
                          onAdd={() => {
                            setForm({
                              title: "",
                              date: "",
                              angle: "",
                              product_id: product,
                            });
                            setModal("occasion");
                          }}
                        />
                        <PlacePicker places={data.places || []} value={place} onChange={setPlace} creator={creator} />
                        <h3 className="photo-step-title">
                          {creator
                            ? L("2. Vos photos", "2. Tus fotos", "2. Your photos")
                            : L("2. Les photos de votre produit", "2. Las fotos de tu producto", "2. Your product photos")}{" "}
                          <small>({savedProductPhotos.length}/5)</small>
                        </h3>
                        <p className="photo-step-hint">
                          {L(
                            "Ajoutez 1 à 5 photos nettes de votre produit, une seule fois : elles restent enregistrées et servent à toutes vos prochaines créations.",
                            "Agrega de 1 a 5 fotos nítidas de tu producto, una sola vez: quedan guardadas y sirven para todas tus próximas creaciones.",
                            "Add 1 to 5 sharp photos of your product, just once: they stay saved and are used for all your future creations.",
                          )}
                        </p>
                        <div
                          className={"upload-zone " + (uploading ? "uploading" : "")}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            upload(e.dataTransfer.files);
                          }}
                        >
                          <input
                            ref={inputRef}
                            type="file"
                            accept="image/jpeg,image/png"
                            multiple
                            onChange={(e) => upload(e.target.files)}
                            hidden
                          />
                          <button
                            onClick={() => inputRef.current?.click()}
                            disabled={uploading || !product || savedProductPhotos.length >= 5}
                          >
                            <div className="upload-symbol">
                              {uploading ? <Loader2 className="spin" size={22} /> : <Upload size={22} />}
                            </div>
                            <b>
                              {uploading
                                ? L("Enregistrement des photos…", "Guardando las fotos…", "Saving photos…")
                                : savedProductPhotos.length >= 5
                                  ? L("5 photos enregistrées", "5 fotos guardadas", "5 photos saved")
                                  : creator
                                    ? L("Ajouter des photos", "Agregar fotos", "Add photos")
                                    : L(
                                      "Ajouter des photos du produit",
                                      "Agregar fotos del producto",
                                      "Add product photos",
                                    )}
                            </b>
                            <span>
                              {savedProductPhotos.length >= 5
                                ? L(
                                    "Retirez une photo ci-dessous pour en ajouter une autre.",
                                    "Quita una foto abajo para agregar otra.",
                                    "Remove a photo below to add another one.",
                                  )
                                : L(
                                    "Choisissez-les sur votre téléphone ou votre ordinateur.",
                                    "Elígelas desde tu teléfono o tu computadora.",
                                    "Pick them from your phone or computer.",
                                  )}
                            </span>
                            <small>
                              {L(
                                "JPG, PNG · 8 Mo max. · jusqu’à 5 photos par produit",
                                "JPG, PNG · máx. 8 MB · hasta 5 fotos por producto",
                                "JPG, PNG · 8 MB max · up to 5 photos per product",
                              )}
                            </small>
                          </button>
                        </div>
                        {data.files.some((f: Row) => f.purpose === "original" && f.product_id === product) && (
                          <>
                            <div className="mini-label">
                              {L(
                                "PHOTOS ENREGISTRÉES · UTILISÉES POUR CETTE CRÉATION",
                                "FOTOS GUARDADAS · SE USAN EN ESTA CREACIÓN",
                                "SAVED PHOTOS · USED FOR THIS CREATION",
                              )}
                            </div>
                            <div className="photo-picker">
                              {data.files
                                .filter((f: Row) => f.purpose === "original" && f.product_id === product)
                                .slice(0, 5)
                                .map((f: Row) => (
                                  <div className="product-photo" key={f.id}>
                                    <button
                                      className={photos.includes(f.id) ? "chosen" : ""}
                                      aria-label={L("Sélectionner ", "Seleccionar ", "Select ") + f.name}
                                      onClick={() =>
                                        setPhotos(
                                          photos.includes(f.id)
                                            ? photos.filter((x) => x !== f.id)
                                            : [...photos, f.id].slice(-5),
                                        )
                                      }
                                    >
                                      <img src={"/api/studio/file/" + f.id} alt={f.name} />
                                      {photos.includes(f.id) && (
                                        <span>
                                          <Check size={12} />
                                        </span>
                                      )}
                                    </button>
                                    <button
                                      className="product-photo-remove"
                                      aria-label={L("Retirer ", "Quitar ", "Remove ") + f.name}
                                      title={L(
                                        "Retirer cette photo du produit",
                                        "Quitar esta foto del producto",
                                        "Remove this photo from the product",
                                      )}
                                      disabled={busy}
                                      onClick={() => {
                                        if (
                                          confirm(
                                            L(
                                              "Retirer cette photo du produit ? Elle ne sera plus utilisée.",
                                              "¿Quitar esta foto del producto? Ya no se usará.",
                                              "Remove this photo from the product? It won’t be used anymore.",
                                            ),
                                          )
                                        )
                                          action(
                                            "product-photo-delete",
                                            {
                                              client_id: selected,
                                              file_id: f.id,
                                            },
                                            L("Photo retirée.", "Foto quitada.", "Photo removed."),
                                          );
                                      }}
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                            </div>
                          </>
                        )}
                        <label className="optional-toggle">
                          <input type="checkbox" checked={personal} onChange={(e) => setPersonal(e.target.checked)} />
                          <span>
                            {L("Ajouter une préférence", "Agregar una preferencia", "Add a preference")}{" "}
                            <small>{L("Facultatif", "Opcional", "Optional")}</small>
                          </span>
                        </label>
                        {personal && (
                          <textarea
                            placeholder={L(
                              "Une occasion, une ambiance, une envie particulière…",
                              "Una ocasión, un ambiente, una idea en particular…",
                              "An occasion, a mood, something specific you’d like…",
                            )}
                            value={brief}
                            onChange={(e) => setBrief(e.target.value)}
                            maxLength={1500}
                          />
                        )}
                        <label className="optional-toggle">
                          <input type="checkbox" checked={overlayOn} onChange={(e) => setOverlayOn(e.target.checked)} />
                          <span>
                            {L("Écrire un texte sur l’image", "Escribir un texto sobre la imagen", "Add text on the image")}{" "}
                            <small>{L("Facultatif", "Opcional", "Optional")}</small>
                          </span>
                        </label>
                        {overlayOn && (
                          <div className="overlay-fields">
                            <input
                              type="text"
                              maxLength={90}
                              value={overlayText}
                              onChange={(e) => setOverlayText(e.target.value)}
                              placeholder={L(
                                "Ex. : Nouvelle collection · -20 % ce week-end",
                                "Ej.: Nueva colección · -20 % este fin de semana",
                                "E.g. New collection · 20% off this weekend",
                              )}
                              aria-label={L("Texte sur l’image", "Texto sobre la imagen", "Text on the image")}
                            />
                            <div className="overlay-styles" role="group" aria-label={L("Style du texte", "Estilo del texto", "Text style")}>
                              {(
                                [
                                  ["elegant", L("Élégant", "Elegante", "Elegant")],
                                  ["modern", L("Moderne", "Moderno", "Modern")],
                                  ["handwritten", L("Manuscrit", "Manuscrito", "Handwritten")],
                                ] as const
                              ).map(([value, text]) => (
                                <button
                                  key={value}
                                  type="button"
                                  data-style={value}
                                  aria-pressed={overlayStyle === value}
                                  onClick={() => setOverlayStyle(value)}
                                >
                                  {text}
                                </button>
                              ))}
                            </div>
                            <small className="muted">
                              {L(
                                `${overlayText.length}/90 · le texte est écrit tel quel : vérifiez l’orthographe. Restez court pour un meilleur rendu.`,
                                `${overlayText.length}/90 · el texto se escribe tal cual: revisa la ortografía. Mientras más corto, mejor se ve.`,
                                `${overlayText.length}/90 · the text is written exactly as typed: check the spelling. Shorter text looks best.`,
                              )}
                            </small>
                          </div>
                        )}
                        <h3 className="photo-step-title">
                          {L(
                            "3. Créez votre visuel",
                            "3. Crea tu imagen",
                            "3. Create your visual",
                          )}
                        </h3>
                        <div className="credit-summary">
                          {isAgency ? (
                            <>
                              <span>{cost} crédit(s) pour cette création</span>
                              <span>
                                Il reste : <b>{available}</b>
                              </span>
                            </>
                          ) : (
                            <span>
                              {L(
                                `${cost} ${cost > 1 ? "visuels" : "visuel"} · il vous en restera ${Math.max(0, available - cost)}`,
                                `${cost} ${cost > 1 ? "imágenes" : "imagen"} · te quedarán ${Math.max(0, available - cost)}`,
                                `${cost} ${cost > 1 ? "visuals" : "visual"} · ${Math.max(0, available - cost)} left after this`,
                              )}
                            </span>
                          )}
                        </div>
                        <button
                          className="button primary full"
                          onClick={generate}
                          disabled={
                            busy ||
                            uploading ||
                            !photos.length ||
                            !recipe ||
                            !product ||
                            cost > available ||
                            !data.generationReady ||
                            !client.active ||
                            (!isAgency && data.billing?.enabled && !data.billing.access.allowed)
                          }
                        >
                          {busy ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}
                          {L(
                            "Créer mes visuels et leurs textes",
                            "Crear mis imágenes y sus textos",
                            "Create my visuals and captions",
                          )}{" "}
                          <ArrowRight size={17} />
                        </button>
                        {!isAgency && (
                          <p className="photo-step-hint">
                            {data.beta?.enabled
                              ? L(
                                  "Votre accès bêta comprend 20 visuels au total. Les corrections sont incluses. ",
                                  "Tu acceso beta incluye 20 imágenes en total. Las correcciones están incluidas. ",
                                  "Your beta access includes 20 visuals in total. Corrections are included. ",
                                )
                              : ""}
                            {cost > available
                              ? L(
                                  "Vous avez utilisé tous vos visuels de ce mois : écrivez à l’agence.",
                                  "Ya usaste todas tus imágenes de este mes: escribe a la agencia.",
                                  "You’ve used all your visuals for this month: message the agency.",
                                )
                              : !product
                                ? L(
                                    "Commencez par ajouter un produit ou un sujet.",
                                    "Empieza agregando un producto o un tema.",
                                    "Start by adding a product or a topic.",
                                  )
                                : !recipe
                                  ? L(
                                      "Votre agence doit d’abord préparer un type de photo.",
                                      "Tu agencia primero debe preparar un tipo de foto.",
                                      "Your agency needs to set up a photo type first.",
                                    )
                                  : !photos.length
                                    ? L(
                                        "Ajoutez une photo ou sélectionnez une photo enregistrée pour continuer.",
                                        "Agrega una foto o elige una foto guardada para continuar.",
                                        "Add a photo or select a saved photo to continue.",
                                      )
                                    : ""}
                          </p>
                        )}
                        <small className="privacy-line">
                          <ShieldCheck size={13} />
                          {L(
                            "Vos photos restent privées dans votre espace.",
                            "Tus fotos se mantienen privadas en tu espacio.",
                            "Your photos stay private in your space.",
                          )}
                        </small>
                        </>
                        )}
                      </section>
                      {isAgency && (
                      <div className="overview-right">
                        <section className="brand-card">
                          <div className="brand-card-top">
                            <span className="step-tag">
                              {L("02 / VOTRE UNIVERS", "02 / TU UNIVERSO", "02 / YOUR WORLD")}
                            </span>
                            <Palette size={19} />
                          </div>
                          <div className="brand-art">
                            <span className="orbit orbit-one" />
                            <span className="orbit orbit-two" />
                            <span className="orbit orbit-three" />
                            <div className="brand-monogram">
                              {client.config.brand?.slice(0, 1) || "L"}
                              <i>.</i>
                            </div>
                            <div className="brand-art-caption">
                              {L("Une identité.", "Una identidad.", "One identity.")}
                              <br />
                              {L(
                                "Mille façons de la raconter.",
                                "Mil maneras de contarla.",
                                "A thousand ways to tell it.",
                              )}
                            </div>
                          </div>
                          <div className="brand-card-bottom">
                            <div>
                              <h3>{client.config.brand}</h3>
                              <p>
                                {isAgency
                                  ? client.config.tone
                                  : L(
                                      "Un espace préparé pour vous par votre agence.",
                                      "Un espacio preparado para ti por tu agencia.",
                                      "A space your agency prepared for you.",
                                    )}
                              </p>
                            </div>
                            <div className="color-swatches">
                              {(client.config.colors || "#172d28, #f5f3eb")
                                .split(",")
                                .slice(0, 4)
                                .map((c: string, i: number) => (
                                  <i
                                    key={i}
                                    style={{
                                      backgroundColor: /^#[a-f0-9]{3,8}$/i.test(c.trim()) ? c.trim() : "#172d28",
                                    }}
                                  />
                                ))}
                            </div>
                          </div>
                        </section>
                        <section className="recent-panel">
                          <div className="section-heading">
                            <div>
                              <span className="step-tag">
                                {L("03 / DERNIÈRES CRÉATIONS", "03 / ÚLTIMAS CREACIONES", "03 / LATEST CREATIONS")}
                              </span>
                            </div>
                            <button className="text-link" onClick={() => setTab("creations")}>
                              {L("Tout voir", "Ver todo", "See all")} <ArrowUpRight size={15} />
                            </button>
                          </div>
                          {data.jobs.slice(0, 3).map((j: Row) => (
                            <button
                              className="recent-job"
                              key={j.id}
                              onClick={() => {
                                setDetail(j);
                                setTab("creations");
                              }}
                            >
                              <div className="job-thumb">
                                {jobTasks(j).find((t: Row) => t.output_file) ? (
                                  <img
                                    src={"/api/studio/file/" + jobTasks(j).find((t: Row) => t.output_file).output_file}
                                    alt={L("Aperçu de création", "Vista previa de la creación", "Creation preview")}
                                  />
                                ) : (
                                  <ImageIcon size={22} />
                                )}
                              </div>
                              <div>
                                <b>{j.config.product.name}</b>
                                <small>{dates(j.created)}</small>
                              </div>
                              <span className={"status " + j.status}>{statuses[j.status]}</span>
                            </button>
                          ))}
                          {!data.jobs.length && (
                            <div className="empty-small">
                              <ImageIcon size={27} />
                              <p>
                                {L(
                                  "Votre galerie attend sa première création.",
                                  "Tu galería espera su primera creación.",
                                  "Your gallery is waiting for its first creation.",
                                )}
                              </p>
                              <span>
                                {L(
                                  "Tout commence avec une photo.",
                                  "Todo empieza con una foto.",
                                  "It all starts with a photo.",
                                )}
                              </span>
                            </div>
                          )}
                        </section>
                      </div>
                      )}
                    </div>
                    {isAgency && (
                    <div className="bottom-note">
                      <span>
                        {L(
                          "Rentable. Recommandable. Reconnaissable.",
                          "Rentable. Reconocible. Recomendada.",
                          "Profitable. Recognizable. Recommended.",
                        )}
                      </span>
                      <span>
                        {L(
                          "Votre agence vous accompagne à chaque étape.",
                          "Tu agencia te acompaña en cada paso.",
                          "Your agency is with you every step of the way.",
                        )}
                      </span>
                    </div>
                    )}
                  </>
                )}
                {tab === "creations" && !job && !isAgency && (
                  <DeliveryPanel data={data} client={client} agency={false} refresh={() => load()} />
                )}
                {tab === "creations" &&
                  (job ? (
                    <>
                      <div className="section-heading">
                        <button className="text-link" onClick={() => setDetail(null)}>
                          ← {L("Toutes les créations", "Todas las creaciones", "All creations")}
                        </button>
                        <span className={"status " + job.status}>{statuses[job.status]}</span>
                      </div>
                      <h2>{job.config.product.name}</h2>
                      <p className="muted">
                        {dates(job.created)} · {formats[job.config.recipe.size]}
                        {job.parent_id
                          ? L(
                              " · Nouvelle version après correction",
                              " · Nueva versión después de la corrección",
                              " · New version after correction",
                            )
                          : ""}
                      </p>
                      {isAgency && job.status === "review" && (
                        <button
                          className="button primary"
                          disabled={busy}
                          onClick={() => action("approve", { job_id: job.id }, "Contenu validé.")}
                        >
                          <Check size={17} />
                          Valider la création
                        </button>
                      )}
                      <div className="gallery detail-gallery">
                        {jobTasks(job)
                          .filter((t: Row) => t.kind === "image")
                          .map((t: Row) => (
                            <article className="visual-card" key={t.id}>
                              <div className="visual">
                                {t.output_file ? (
                                  <img src={"/api/studio/file/" + t.output_file} alt={job.config.product.name} />
                                ) : (
                                  <div className="visual-wait">
                                    {t.status === "failed" || t.status === "uncertain" ? (
                                      <AlertCircle size={26} />
                                    ) : (
                                      <Loader2 className="spin" size={26} />
                                    )}
                                    <b>
                                      {t.status === "failed"
                                        ? L("Cette étape a échoué", "Este paso no funcionó", "This step failed")
                                        : t.status === "uncertain"
                                          ? L("Résultat à vérifier", "Resultado por revisar", "Result needs a check")
                                          : L(
                                              "Votre image se prépare",
                                              "Tu imagen se está preparando",
                                              "Your image is being prepared",
                                            )}
                                    </b>
                                    {t.error && <p>{isAgency ? t.error : plainText(t.error, lang)}</p>}
                                  </div>
                                )}
                              </div>
                              <div className="visual-body">
                                <div className="section-heading">
                                  <b>
                                    {L("Image", "Imagen", "Image")} {t.ordinal + 1}
                                  </b>
                                  {t.output_file && (
                                    <a
                                      className="icon-button"
                                      href={"/api/studio/file/" + t.output_file + "?download=1"}
                                      aria-label={L("Télécharger l’image", "Descargar la imagen", "Download image")}
                                    >
                                      <Download size={17} />
                                    </a>
                                  )}
                                </div>
                                <p className="caption">
                                  {captionFor(job, t.ordinal) ||
                                    L(
                                      "Le texte à publier avec cette image apparaîtra ici.",
                                      "Aquí aparecerá el texto para publicar con esta imagen.",
                                      "The caption to post with this image will appear here.",
                                    )}
                                </p>
                                {captionFor(job, t.ordinal) && (
                                  <button
                                    className="text-link"
                                    onClick={async () => {
                                      try {
                                        await navigator.clipboard.writeText(captionFor(job, t.ordinal));
                                        setToast(L("Texte à publier copié.", "Texto copiado.", "Caption copied."));
                                      } catch {
                                        setError(
                                          L(
                                            "La copie automatique n’est pas disponible dans ce navigateur.",
                                            "La copia automática no está disponible en este navegador.",
                                            "Automatic copy isn’t available in this browser.",
                                          ),
                                        );
                                      }
                                    }}
                                  >
                                    <Copy size={13} />
                                    {L(
                                      "Copier le texte à publier",
                                      "Copiar el texto para publicar",
                                      "Copy the caption",
                                    )}
                                  </button>
                                )}
                                {t.output_file && (
                                  <button
                                    className="button secondary full"
                                    onClick={() => {
                                      setForm({
                                        task_id: t.id,
                                        comment: "",
                                        permanent: false,
                                      });
                                      setModal("correction");
                                    }}
                                  >
                                    {L("Demander une modification", "Pedir un cambio", "Request a change")}
                                  </button>
                                )}
                                {isAgency && t.status === "failed" && (
                                  <button
                                    className="button secondary full"
                                    disabled={busy}
                                    onClick={() => action("retry", { task_id: t.id }, "Cette étape a été reprise.")}
                                  >
                                    Reprendre cette étape · {t.quota_cost} crédit(s)
                                  </button>
                                )}
                              </div>
                            </article>
                          ))}
                      </div>
                      {jobTasks(job)
                        .filter((t: Row) => t.kind === "caption" && t.status === "failed")
                        .map((t: Row) => (
                          <div key={t.id} className="alert error">
                            <span>{t.error}</span>
                            {isAgency && (
                              <button
                                className="button secondary"
                                disabled={busy}
                                onClick={() => action("retry", { task_id: t.id })}
                              >
                                Reprendre les légendes
                              </button>
                            )}
                          </div>
                        ))}
                      {job.parent_id && (
                        <button
                          className="text-link"
                          onClick={() => setDetail(data.jobs.find((j: Row) => j.id === job.parent_id))}
                        >
                          {L("Voir la version précédente", "Ver la versión anterior", "See previous version")}{" "}
                          <History size={14} />
                        </button>
                      )}
                      <div className="usage-note">
                        {isAgency
                          ? "Coût monétaire non disponible. Consommation API enregistrée lorsqu’elle est renvoyée par le fournisseur."
                          : L(
                              "Vous pouvez quitter cette page : la demande reste enregistrée.",
                              "Puedes salir de esta página: la solicitud queda guardada.",
                              "You can leave this page: your request stays saved.",
                            )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="section-heading">
                        <span className="muted">
                          {isAgency && data.jobs.length > 0 ? `${data.jobs.length} demande(s) enregistrée(s)` : ""}
                        </span>
                        <button className="button secondary" onClick={() => setTab(noRecipe ? "templates" : createTab)}>
                          <Plus size={16} />
                          {noRecipe
                            ? L("Créer avec un modèle", "Crear con una plantilla", "Create with a template")
                            : L("Nouveau visuel", "Nueva imagen", "New visual")}
                        </button>
                      </div>
                      <div className="gallery">
                        {data.jobs.map((j: Row) => {
                          const t = jobTasks(j).find((t: Row) => t.output_file);
                          return (
                            <button className="creation-card" key={j.id} onClick={() => setDetail(j)}>
                              <div className="visual">
                                {t ? (
                                  <img src={"/api/studio/file/" + t.output_file} alt={j.config.product.name} />
                                ) : (
                                  <div className="visual-wait">
                                    <ImageIcon size={35} />
                                    <span>{statuses[j.status]}</span>
                                  </div>
                                )}
                              </div>
                              <div className="creation-card-body">
                                <span className={"status " + j.status}>{statuses[j.status]}</span>
                                <h3>{j.config.product.name}</h3>
                                <p>
                                  {j.config.recipe.count} {L("image(s)", "imagen(es)", "image(s)")} · {dates(j.created)}
                                </p>
                                {j.parent_id && (
                                  <small>
                                    {L(
                                      "Version corrigée · original conservé",
                                      "Versión corregida · original guardado",
                                      "Corrected version · original kept",
                                    )}
                                  </small>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {!data.jobs.length && !(noRecipe && (data.designs || []).some((d: Row) => d.kind === "image")) && (
                        <div className="welcome-empty">
                          <ImageIcon size={35} />
                          <h2>
                            {L(
                              "Votre premier visuel vous attend.",
                              "Tu primera imagen te espera.",
                              "Your first visual is waiting.",
                            )}
                          </h2>
                          <p>
                            {noRecipe
                              ? L(
                                  "Vos visuels sur mesure arrivent bientôt. En attendant, créez-en un avec un modèle.",
                                  "Tus imágenes a medida llegan pronto. Mientras tanto, crea una con una plantilla.",
                                  "Your custom visuals are coming soon. Meanwhile, create one with a template.",
                                )
                              : L(
                                  "Choisissez un produit : le studio prépare le visuel et son texte.",
                                  "Elige un producto: el estudio prepara la imagen y su texto.",
                                  "Pick a product: the studio prepares the visual and its caption.",
                                )}
                          </p>
                          <button className="button primary" onClick={() => setTab(noRecipe ? "templates" : createTab)}>
                            {noRecipe
                              ? L("Créer avec un modèle", "Crear con una plantilla", "Create with a template")
                              : L("Créer mon premier visuel", "Crear mi primera imagen", "Create my first visual")}{" "}
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      )}
                    </>
                  ))}
                {tab === "creations" && !job && (data.designs || []).some((d: Row) => d.kind === "image") && (
                  <section className="design-section">
                    <div className="section-heading">
                      <h3>{L("Faits avec les modèles", "Hechas con las plantillas", "Made with templates")}</h3>
                      <button className="text-link" onClick={() => setTab("templates")}>
                        {L("Ouvrir les modèles", "Abrir las plantillas", "Open templates")} <ArrowRight size={14} />
                      </button>
                    </div>
                    <DesignList
                      data={data}
                      kind="image"
                      refresh={() => load()}
                      onEdit={(d) => {
                        setDesignEdit(d);
                        setTab("templates");
                      }}
                    />
                  </section>
                )}
                {tab === "recreate" && client && feat.recreate && (
                  <Recreate
                    key={"recreate-" + client.id}
                    data={data}
                    client={client}
                    refresh={() => load()}
                    initialUrl={recreateUrl}
                    onOpenDesign={(d) => {
                      setDesignEdit(d);
                      setTab("templates");
                    }}
                    onGo={(t) => setTab(t)}
                  />
                )}
                {tab === "templates" && client && !isAgency && feat.recreate && (
                  <button className="recreate-entry" onClick={() => setTab("recreate")}>
                    <div>
                      <b>{L("Recréer un post vu sur Instagram", "Recrear un post visto en Instagram", "Recreate a post you saw on Instagram")}</b>
                      <span>{L("Collez le lien, ajoutez une capture : le studio le refait avec vos photos.", "Pega el enlace, agrega una captura: el estudio lo rehace con tus fotos.", "Paste the link, add a screenshot: the studio remakes it with your photos.")}</span>
                    </div>
                    <Wand2 size={18} />
                  </button>
                )}
                {tab === "templates" && client && noRecipe && (
                  <p className="soon-note">
                    {L(
                      "Vos visuels sur mesure arrivent bientôt. En attendant, créez-en un avec un modèle.",
                      "Tus imágenes a medida llegan pronto. Mientras tanto, crea una con una plantilla.",
                      "Your custom visuals are coming soon. Meanwhile, create one with a template.",
                    )}
                  </p>
                )}
                {tab === "templates" && client && (
                  <TemplatesStudio
                    key={"templates-" + client.id}
                    data={data}
                    client={client}
                    refresh={() => load()}
                    canCreate={isAgency || !data.billing?.enabled || data.billing.access.allowed}
                    initial={designEdit}
                    onInitialUsed={() => setDesignEdit(null)}
                  />
                )}
                {tab === "montage" && (data.designs || []).some((d: Row) => d.kind === "video") && (
                  <section className="design-section">
                    <div className="section-heading">
                      <h3>{L("Vidéos avant / après", "Videos antes / después", "Before / after videos")}</h3>
                    </div>
                    <DesignList
                      data={data}
                      kind="video"
                      refresh={() => load()}
                      onEdit={(d) => {
                        setDesignEdit(d);
                        setTab("templates");
                      }}
                    />
                  </section>
                )}
                {tab === "identity" && creator && (
                  <CreatorStrategy key={client.id} client={client} agency={isAgency} refresh={() => load()} />
                )}
                {tab === "styles" && isAgency && (
                  <BrandVideoSettings key={"video-settings-" + client.id} data={data} client={client} refresh={() => load()} />
                )}
                {tab === "styles" && isAgency && <VideoStyles data={data} client={client} refresh={() => load()} />}
                {tab === "versions" && client && creator && feat.testVersions && (
                  <TestVersions
                    key={"tv-" + client.id}
                    data={data}
                    client={client}
                    refresh={() => load()}
                    onMode={setTab}
                    canCreate={isAgency || !data.billing?.enabled || data.billing.access.allowed}
                  />
                )}
                {(tab === "videos" || tab === "montage") && (
                  <VideoStudio
                    data={data}
                    client={client}
                    agency={isAgency}
                    mode={tab}
                    onMode={setTab}
                    refresh={() => load()}
                    canCreate={isAgency || !data.billing?.enabled || data.billing.access.allowed}
                  />
                )}
                {tab === "products" && client && !isAgency && feat.siteImport && <SiteImport key={"site-" + client.id} data={data} client={client} refresh={() => load()} />}
                {tab === "products" && (
                  <>
                    <div className="section-heading">
                      <span className="muted">
                        {data.products.length > 0 &&
                          (creator
                            ? L(
                                `${data.products.length} ${data.products.length > 1 ? "sujets" : "sujet"}`,
                                `${data.products.length} ${data.products.length > 1 ? "temas" : "tema"}`,
                                `${data.products.length} ${data.products.length > 1 ? "topics" : "topic"}`,
                              )
                            : L(
                                `${data.products.length} ${data.products.length > 1 ? "produits" : "produit"}`,
                                `${data.products.length} ${data.products.length > 1 ? "productos" : "producto"}`,
                                `${data.products.length} ${data.products.length > 1 ? "products" : "product"}`,
                              ))}
                      </span>
                      <button className="button primary" onClick={openProduct}>
                        <Plus size={16} />
                        {creator
                          ? L("Ajouter un sujet", "Agregar un tema", "Add a topic")
                          : L("Ajouter un produit", "Agregar un producto", "Add a product")}
                      </button>
                    </div>
                    {!data.products.length && !isAgency && (
                      <p className="soon-note">
                        {creator
                          ? L(
                              "Ajoutez votre premier sujet : 1 à 5 photos claires suffisent.",
                              "Agrega tu primer tema: bastan de 1 a 5 fotos claras.",
                              "Add your first topic: 1 to 5 clear photos are enough.",
                            )
                          : L(
                              "Ajoutez votre premier produit : 1 à 5 photos claires suffisent.",
                              "Agrega tu primer producto: bastan de 1 a 5 fotos claras.",
                              "Add your first product: 1 to 5 clear photos are enough.",
                            )}
                      </p>
                    )}
                    <div className="product-grid">
                      {data.products.map((p: Row) => (
                        <article key={p.id} className="product-card">
                          <span className="product-symbol">
                            <Package size={25} />
                          </span>
                          {isAgency && <span className="eyebrow">{p.brand}</span>}
                          <h3>{p.name}</h3>
                          <p>{p.description}</p>
                          <div className="product-detail">
                            {p.preserve && (
                              <>
                                <b>{L("Détails à respecter", "Detalles que respetar", "Details to respect")}</b>
                                <p>{p.preserve}</p>
                              </>
                            )}
                            {p.commercial && (
                              <>
                                <b>
                                  {L(
                                    "Prix et informations utiles",
                                    "Precio e información útil",
                                    "Price and useful details",
                                  )}
                                </b>
                                <p>{p.commercial}</p>
                              </>
                            )}
                          </div>
                          <button
                            className="text-link"
                            onClick={() => {
                              setProduct(p.id);
                              setTab(createTab);
                            }}
                          >
                            {creator
                              ? L("Créer avec ce sujet", "Crear con este tema", "Create with this topic")
                              : L("Créer avec ce produit", "Crear con este producto", "Create with this product")}{" "}
                            <ArrowUpRight size={15} />
                          </button>
                        </article>
                      ))}
                    </div>
                    {isAgency && <PlacesAgency key={client.id} data={data} client={client} refresh={() => load()} />}
                  </>
                )}
                {tab === "recipes" && isAgency && (
                  <>
                    <div className="section-heading">
                      <span className="muted">
                        Les clients voient un nom simple. Les instructions restent dans votre interface.
                      </span>
                      <button className="button primary" onClick={() => openRecipe()}>
                        <Plus size={16} />
                        Nouvelle recette
                      </button>
                    </div>
                    <div className="product-grid">
                      {data.recipes.map((r: Row) => (
                        <article key={r.id} className="product-card">
                          <WandSparkles size={26} />
                          <h3>{r.name}</h3>
                          <div className="recipe-summary">
                            <span>{r.config.count} visuels</span>
                            <span>{formats[r.config.size]}</span>
                            <span>{r.config.language.toUpperCase()}</span>
                          </div>
                          <ol className="scene-list">
                            {r.config.scenes.map((s: string, i: number) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ol>
                          <p className="muted">{r.config.instructions}</p>
                          <button className="text-link" onClick={() => openRecipe(r)}>
                            Modifier la recette <SlidersHorizontal size={14} />
                          </button>
                        </article>
                      ))}
                    </div>
                  </>
                )}
                {tab === "billing" && (
                  <BillingPanel
                    key={client.id}
                    billing={data.billing}
                    client={client}
                    agency={isAgency}
                    refresh={() => load()}
                  />
                )}
                {tab === "billing" && !isAgency && !creator && <OfferBlock data={data} client={client} refresh={() => load()} />}
                {tab === "delivery" && isAgency && (
                  <DeliveryPanel key={client.id} data={data} client={client} agency refresh={() => load()} />
                )}
                {tab === "referral" && !isAgency && client && feat.reels && (
                  <ReelCollabPanel data={data} client={client} refresh={() => load()} />
                )}
                {tab === "collabs" && isAgency && <AgencyCollabs data={data} refresh={() => load()} />}
                {tab === "collabs" && !isAgency && client && !creator && <OppTeaser data={data} />}
                {tab === "collabs" && !isAgency && client && !creator && feat.brandCollabs && (
                  <BrandCollabs key={client.id} data={data} client={client} refresh={() => load()} />
                )}
                {tab === "referral" && (
                  <ReferralPanel key={client.id} data={data} client={client} agency={isAgency} refresh={() => load()} />
                )}
                {tab === "overview" && isAgency && (
                  <AgencyBillingSummary
                    rows={data.billingSummary || []}
                    onSelect={async (id) => {
                      await changeClient(id);
                      setTab("billing");
                    }}
                  />
                )}
                {tab === "publication" && (
                  <MetaPanel key={"meta-" + client.id} data={data} client={client} refresh={() => load()} />
                )}
                {tab === "publication" && (
                  <PublicationCalendar
                    key={client.id}
                    data={data}
                    client={client}
                    agency={isAgency}
                    refresh={() => load()}
                  />
                )}
                {tab === "overview" && isAgency && (
                  <AgencyPublicationSummary
                    rows={data.publicationSummary || []}
                    onSelect={async (id) => {
                      await changeClient(id);
                      setTab("publication");
                    }}
                  />
                )}
                {tab === "pending" && isAgency && (
                  <>
                    <OfferRequests data={data} refresh={() => load()} />
                    <PublicRequests requests={data.publicRequests || []} />
                    <section className="panel">
                      <h3>
                        Demandes en attente{" "}
                        <span className="status review">
                          {data.intakeQueue?.filter((i: Row) => i.status === "submitted").length || 0}
                        </span>
                      </h3>
                      {data.intakeQueue?.length ? (
                        data.intakeQueue.map((i: Row) => (
                          <div className="pending-request" key={i.client_id}>
                            <div>
                              <b>{i.client_name}</b>
                              <p>
                                {i.first_name} {i.email && "· " + i.email}
                              </p>
                              <small>
                                {i.status === "submitted" ? "En attente de validation" : "Précisions demandées"} ·{" "}
                                {dates(i.updated)}
                              </small>
                            </div>
                            <div className="edit-actions">
                              <button
                                className="button secondary"
                                onClick={async () => {
                                  await changeClient(i.client_id);
                                  setTab("brand");
                                }}
                              >
                                Lire les réponses et préparer l’espace
                              </button>
                              <button
                                className="text-link"
                                onClick={async () => {
                                  await changeClient(i.client_id);
                                  setTab("publication");
                                }}
                              >
                                Préparer son calendrier
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="muted">Aucune demande en attente.</p>
                      )}
                    </section>
                  </>
                )}
                {tab === "brand" && isAgency && (
                  <>
                    <ClientAccessPanel key={"access-" + client.id} client={client} data={data} refresh={() => load()} />
                    <SiteImportAgency data={data} refresh={() => load()} />
                    <TemplatesAgency key={"templates-agency-" + client.id} data={data} client={client} refresh={() => load()} />
                    <button className="button secondary" onClick={() => setIntakePreview(true)}>
                      Aperçu du parcours client
                    </button>
                    <IntakeReview
                      key={"intake-" + client.id}
                      client={client}
                      intake={data.clientIntake}
                      refresh={() => load()}
                    />
                    {creator ? (
                      <CreatorStrategy key={client.id} client={client} agency={true} refresh={() => load()} />
                    ) : (
                      <QualityProfile key={client.id} client={client} refresh={() => load()} />
                    )}
                    <div className="brand-layout">
                      <section className="panel">
                        <div className="section-heading">
                          <h3>Configuration de l’espace</h3>
                          <button disabled={videoRendering} className="text-link" onClick={openSettings}>
                            Modifier <SlidersHorizontal size={14} />
                          </button>
                        </div>
                        <div className="setup-checks">
                          {[
                            ["Identité de marque", !!client.config.brand],
                            [creator ? "Sujet renseigné" : "Produit renseigné", data.products.length > 0],
                            ["Recette et formats définis", data.recipes.some((r: Row) => r.active)],
                            ["Langue et ton des légendes", !!client.config.language && !!client.config.tone],
                            ["Mode de validation", !!client.config.validation],
                            ["Quota attribué", client.quota_limit > 0],
                            ["Adresse client autorisée", client.config.allowedEmails?.length > 0],
                            ["Moteur IA connecté", data.apiConnected],
                          ].map(([label, ok]: any) => (
                            <div key={label}>
                              <span className={ok ? "check-icon" : "check-icon missing"}>
                                {ok ? <Check size={14} /> : <Clock size={14} />}
                              </span>
                              {label}
                              <small>{ok ? "Prêt" : "À compléter"}</small>
                            </div>
                          ))}
                        </div>
                        <button
                          className="button secondary full"
                          onClick={async () => {
                            const res = await action("rotate-code", { client_id: selected }, "Nouveau code créé.");
                            if (res) {
                              setCodes([{ name: client.name, code: res.code }]);
                              setModal("codes");
                            }
                          }}
                        >
                          Renouveler le code client
                        </button>
                      </section>
                      <section className="panel">
                        <h3>Références visuelles de marque</h3>
                        <p className="muted">
                          Ces références guident l’ambiance. Les photos produit restent la source de vérité.
                        </p>
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          multiple
                          onChange={(e) => upload(e.target.files, "brand")}
                        />
                        <div className="reference-grid">
                          {data.files
                            .filter((f: Row) => f.purpose === "brand")
                            .map((f: Row) => (
                              <img key={f.id} src={"/api/studio/file/" + f.id} alt={f.name} />
                            ))}
                        </div>
                        <div className="quota-bar">
                          <span>Crédits utilisés</span>
                          <b>
                            {client.quota_used} / {client.quota_limit}
                          </b>
                          <progress value={client.quota_used} max={client.quota_limit || 1} />
                        </div>
                        <small>
                          Images : {client.config.imageCost} · Légendes : {client.config.captionCost} · Variantes :{" "}
                          {client.config.variantCost} · Corrections : {client.config.correctionCost}
                        </small>
                      </section>
                    </div>
                    <section className="panel">
                      <h3>Utilisateurs et accès</h3>
                      <p className="muted">
                        Adresses autorisées :{" "}
                        {(client.config.allowedEmails || []).join(", ") ||
                          "Aucune. Ajoutez-les dans les paramètres avant de partager le code."}
                      </p>
                      {data.users.map((u: Row) => (
                        <div className="access-row" key={u.id}>
                          <span>{u.email}</span>
                          <span className="status">{u.active ? "Actif" : "Suspendu"}</span>
                          <button
                            className="text-link"
                            onClick={() =>
                              action("user-access", {
                                user_id: u.id,
                                active: !u.active,
                              })
                            }
                          >
                            {u.active ? "Suspendre" : "Réactiver"}
                          </button>
                        </div>
                      ))}
                    </section>
                    <section className="panel">
                      <h3>Mémoire des produits</h3>
                      <p className="muted">
                        Seules les règles approuvées par l’agence sont réutilisées. Vous pouvez désactiver ou restaurer
                        chacune d’elles.
                      </p>
                      {data.rules.map((r: Row) => (
                        <div className="rule-row" key={r.id}>
                          <div>
                            <b>{r.rule}</b>
                            <small>
                              {dates(r.created)} · {r.author} · origine : correction
                            </small>
                          </div>
                          <button
                            className="text-link"
                            onClick={() =>
                              action("toggle-rule", {
                                rule_id: r.id,
                                active: !r.active,
                              })
                            }
                          >
                            {r.active ? "Désactiver" : "Restaurer"}
                          </button>
                        </div>
                      ))}
                      {!data.rules.length && <p className="muted">Aucune règle permanente approuvée pour le moment.</p>}
                    </section>
                  </>
                )}
                {tab === "creations" && isAgency && !!data.corrections.length && (
                    <section className="panel">
                      <h3>Corrections · {client.name}</h3>
                      {data.corrections.map((c: Row) => (
                        <div key={c.id} className="correction-row">
                          <div>
                            <b>{c.comment}</b>
                            <small>
                              {dates(c.created)} ·{" "}
                              {c.status === "requested" ? "À traiter" : c.status === "done" ? "Terminée" : "En cours"}
                            </small>
                            {c.permanent && <span className="status review">Règle permanente proposée</span>}
                          </div>
                          <div className="row-actions">
                            {c.permanent && !data.rules.some((r: Row) => r.source === c.id) && (
                              <button
                                className="button secondary"
                                disabled={busy}
                                onClick={() =>
                                  action(
                                    "save-rule",
                                    { correction_id: c.id },
                                    "Règle approuvée pour les prochaines créations.",
                                  )
                                }
                              >
                                Approuver la règle
                              </button>
                            )}
                            {c.status === "requested" && (
                              <button
                                className="button primary"
                                disabled={busy}
                                onClick={() =>
                                  action("process-correction", { correction_id: c.id }, "Nouvelle version en création.")
                                }
                              >
                                Créer la correction · {client.config.correctionCost} crédit(s)
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {!data.corrections.length && <p className="muted">Aucune correction pour ce client.</p>}
                    </section>
                )}
                {tab === "todo" && isAgency && (
                  <>
                    {(() => {
                      // Boîte unique : tout ce qui attend Julie, client par client, avec le bouton pour agir.
                      const rows: { key: string; who: string; what: string; error?: string; when?: string; go: () => void; cta: string }[] = [];
                      for (const o of data.collabPendingOffers || [])
                        rows.push({ key: "offer-" + o.client_id, who: o.brand_name, what: o.approved ? "Offre de collaboration modifiée à valider" : "Nouvelle offre de collaboration à valider", when: o.updated, go: () => setTab("collabs"), cta: "Valider" });
                      for (const c of (data.reelQueue || []).filter((c: Row) => c.status === "pending"))
                        rows.push({ key: "reel-" + c.id, who: c.client_name, what: "Reel avec @withjulielouvet à vérifier", when: c.created, go: () => setTab("collabs"), cta: "Vérifier" });
                      for (const r of (data.publicRequests || []).filter((r: Row) => !r.status || r.status === "new" || r.status === "pending"))
                        rows.push({ key: "req-" + r.id, who: r.name || r.first_name, what: "Nouvelle demande d’abonnement", when: r.created, go: () => setTab("pending"), cta: "Ouvrir" });
                      for (const o of (data.offerRequests || []).filter((o: Row) => o.status === "new"))
                        rows.push({ key: "off-" + o.id, who: o.client_name || "", what: "Demande d’accompagnement complet", when: o.created, go: () => setTab("pending"), cta: "Ouvrir" });
                      for (const c of (data.reelQueue || []).filter((c: Row) => c.credit_error && c.status !== "credited"))
                        rows.push({ key: "reelcredit-" + c.id, who: c.client_name, what: "", error: `Crédit Stripe non appliqué : ${c.credit_error} — réessai automatique`, when: c.updated, go: () => setTab("collabs"), cta: "Voir" });
                      for (const r of (data.referralOverview || []).filter((r: Row) => r.credit_error && r.status !== "credited"))
                        rows.push({ key: "refcredit-" + r.id, who: r.referrer_name, what: "", error: `Crédit Stripe non appliqué : ${r.credit_error} — réessai automatique`, when: r.updated, go: () => setTab("referral"), cta: "Voir" });
                      for (const t of (data.chatThreads || []).filter((t: Row) => t.unread > 0))
                        rows.push({ key: "chat-" + t.client_id, who: t.client_name, what: `${t.unread} message${t.unread > 1 ? "s" : ""} non lu${t.unread > 1 ? "s" : ""}`, when: t.last_created, go: () => setTab("messages"), cta: "Répondre" });
                      return (
                        <section className="panel inbox-panel">
                          <h3>À faire maintenant · tous clients</h3>
                          {rows.map((r) => (
                            <button className="todo-row" key={r.key} onClick={r.go}>
                              <div>
                                <b>{r.who}</b>
                                {r.error ? (
                                  <small className="credit-error">{r.error}</small>
                                ) : (
                                  <small>
                                    {r.what}
                                    {r.when ? " · " + dates(r.when) : ""}
                                  </small>
                                )}
                              </div>
                              <span className="status review">{r.cta}</span>
                              <ArrowUpRight size={17} />
                            </button>
                          ))}
                          {!rows.length && <p className="muted">Aucune offre, aucun Reel, aucune demande ni aucun message en attente.</p>}
                        </section>
                      );
                    })()}
                    {!!data.intakeQueue?.length && (
                      <section className="panel">
                        <h3>Questionnaires de marque · tous clients</h3>
                        {data.intakeQueue.map((i: Row) => (
                          <button
                            className="todo-row"
                            key={i.client_id}
                            onClick={async () => {
                              await changeClient(i.client_id);
                              setTab("brand");
                            }}
                          >
                            <div>
                              <b>{i.client_name}</b>
                              <small>
                                {i.status === "submitted"
                                  ? "Réponses reçues · stratégie à préparer"
                                  : "En attente des précisions du client"}{" "}
                                · {dates(i.updated)}
                              </small>
                            </div>
                            <span className="status review">
                              {i.status === "submitted" ? "À organiser" : "À compléter"}
                            </span>
                            <ArrowUpRight size={17} />
                          </button>
                        ))}
                      </section>
                    )}
                    <BookingRequests data={data} refresh={() => load()} />
                    <VideoReviews
                      data={data}
                      refresh={() => load()}
                      openClient={async (id) => {
                        await changeClient(id);
                        setTab("montage");
                      }}
                    />
                    {!!data.videoQueue?.length && (
                      <section className="panel">
                        <h3>Montages à traiter · tous clients</h3>
                        {data.videoQueue.map((e: Row) => (
                          <button
                            className="todo-row"
                            key={e.id}
                            onClick={async () => {
                              await changeClient(e.client_id);
                              setTab("montage");
                            }}
                          >
                            <div>
                              <b>Demande de montage</b>
                              <small>
                                {e.client_name} · {dates(e.created)}
                              </small>
                            </div>
                            <span className="status review">
                              {e.status === "requested"
                                ? "À traiter"
                                : e.status === "editing"
                                  ? "En montage"
                                  : "À valider"}
                            </span>
                            <ArrowUpRight size={17} />
                          </button>
                        ))}
                      </section>
                    )}
                    <section className="panel">
                      <h3>Demandes à traiter · tous clients</h3>
                      {data.todo.map((j: Row) => (
                        <button
                          className="todo-row"
                          key={j.id}
                          onClick={async () => {
                            await changeClient(j.client_id);
                            setDetail({ id: j.id });
                            setTab("creations");
                          }}
                        >
                          <div>
                            <b>{j.product_name}</b>
                            <small>
                              {j.client_name} · {dates(j.created)}
                            </small>
                          </div>
                          <span className={"status " + j.status}>{statuses[j.status]}</span>
                          <ArrowUpRight size={17} />
                        </button>
                      ))}
                      {!data.todo.length && (
                        <div className="empty-small">
                          <CheckCircle2 size={30} />
                          <p>Tout est à jour.</p>
                        </div>
                      )}
                    </section>
                  </>
                )}
                {tab === "history" && isAgency && (
                  <section className="panel">
                    <h3>Journal de l’espace</h3>
                    <div className="audit-list">
                      {data.audit.map((a: Row) => (
                        <div key={a.id}>
                          <span className="audit-dot" />
                          <div>
                            <b>
                              {{
                                creator_strategy_updated: "Stratégie créatrice enregistrée",
                                client_created: "Espace créé",
                                product_created: "Produit ajouté",
                                photo_uploaded: "Photo enregistrée",
                                generation_started: "Création lancée",
                                content_approved: "Contenu validé",
                                correction_requested: "Correction demandée",
                                correction_started: "Nouvelle version lancée",
                                client_intake_submitted: "Questionnaire client transmis",
                                client_intake_draft_saved: "Brouillon du questionnaire enregistré",
                                client_intake_reviewed: "Questionnaire étudié et studio ouvert",
                                client_intake_changes_requested: "Précisions demandées au client",
                                quality_profile_updated: "Questionnaire créatif mis à jour",
                                video_render_started: "Montage automatique lancé",
                                video_render_completed: "Vidéo finale enregistrée",
                                client_settings_updated: "Paramètres modifiés",
                                recipe_saved: "Recette enregistrée",
                                product_rule_approved: "Règle produit approuvée",
                                product_rule_disabled: "Règle désactivée",
                                product_rule_restored: "Règle restaurée",
                                client_code_rotated: "Code client renouvelé",
                                user_access_updated: "Accès modifié",
                                failed_step_retried: "Étape manquante reprise",
                                client_joined: "Compte client rattaché",
                              }[a.action as string] || a.action}
                            </b>
                            <small>
                              {dates(a.created)} · {a.author}
                            </small>
                            <details>
                              <summary>Détails de la modification</summary>
                              <pre>{JSON.stringify(JSON.parse(a.detail), null, 2)}</pre>
                            </details>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {/* Suppression du compte : tout en bas de « Marque & accès », jamais au-dessus du travail courant. */}
                {isAgency && tab === "brand" && (
                  <div className="danger-zone">
                    <h3>Compte du client</h3>
                    <AccountControls
                      key={client.id}
                      client={client}
                      lifecycle={data.lifecycle}
                      onDone={async () => {
                        setSelected("");
                        await load("");
                      }}
                    />
                  </div>
                )}
              </>
            )}
            <footer>
              <span>LOUVET & PARTNERS</span>
              <span className="studio-legal">
                <a href={"/conditions?lang=" + lang} target="_blank" rel="noopener">
                  {L("Conditions", "Condiciones", "Terms")}
                </a>
                <a href={"/confidentialite?lang=" + lang} target="_blank" rel="noopener">
                  {L("Confidentialité", "Privacidad", "Privacy")}
                </a>
                <a href={"/mentions-legales?lang=" + lang} target="_blank" rel="noopener">
                  {L("Mentions légales", "Aviso legal", "Legal notice")}
                </a>
              </span>
              <span>
                {L(
                  "Content Studio · Version de test privée",
                  "Content Studio · Versión de prueba privada",
                  "Content Studio · Private test version",
                )}
              </span>
            </footer>
          </div>
        </main>
        {/* Téléphone : les 5 écrans principaux à portée de pouce. « Mon compte » et « Opportunités » sont dans le menu (avatar). */}
        {!isAgency && (
          <nav className="bottom-tabs" aria-label={L("Navigation principale", "Navegación principal", "Main navigation")}>
            {(
              [
                ["overview", L("Accueil", "Inicio", "Home"), LayoutGrid],
                ["create", L("Créer", "Crear", "Create"), Sparkles],
                ["creations", L("Visuels", "Imágenes", "Visuals"), ImageIcon],
                ["montage", L("Vidéos", "Videos", "Videos"), Video],
                ["publication", L("Calendrier", "Calendario", "Calendar"), CalendarDays],
              ] as [string, string, any][]
            ).filter(([id]) => videoOn || id !== "montage").map(([id, label, Icon]) => (
              <button
                key={id}
                disabled={videoRendering}
                className={navActive(id) ? "active" : ""}
                aria-current={navActive(id) ? "page" : undefined}
                onClick={() => {
                  setTab(id);
                  setDetail(null);
                  setMobileMenu(false);
                  window.scrollTo({ top: 0 });
                }}
              >
                <Icon size={21} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        )}
        {data.user?.role === "client" && (
          <ClientChat
            client={client}
            unread={chatUnreadLive ?? data.chatUnread ?? 0}
            open={chatOpen}
            setOpen={setChatOpen}
            onUnread={setChatUnreadLive}
            bookingLink={!!data.bookingUrl}
          />
        )}
        {toast && (
          <div className="toast" role="status">
            <CheckCircle2 size={18} />
            {toast}
          </div>
        )}
        {modal && (
          <Modal
            title={
              modal === "client"
                ? "Un nouvel espace client."
                : modal === "product"
                  ? creator
                    ? L("Préparez un sujet de création.", "Prepara un tema de creación.", "Set up a creation topic.")
                    : L("Présentez votre produit.", "Presenta tu producto.", "Introduce your product.")
                  : modal === "recipe"
                    ? "Composez votre recette."
                    : modal === "settings"
                      ? creator
                        ? "Les fondations de votre espace."
                        : "Les fondations de la marque."
                      : modal === "correction"
                        ? L("Affinons ce visuel.", "Afinemos esta imagen.", "Let’s fine-tune this image.")
                        : modal === "occasion"
                          ? "Une date pour cette marque."
                          : "Les codes de vos espaces."
            }
            subtitle={modal === "codes" ? "Ces codes ne sont affichés qu’ici. Copiez-les avant de fermer." : ""}
            close={() => {
              setModal("");
              setError("");
            }}
          >
            {error && <div className="alert error">{error}</div>}
            {modal === "client" && (
              <>
                <Field label="Type d’espace" hint="Le type est fixé à la création pour conserver un parcours cohérent.">
                  <select
                    value={form.workspaceType || "brand"}
                    onChange={(e) => setForm({ ...form, workspaceType: e.target.value })}
                  >
                    <option value="brand">Marque · produits et communication</option>
                    <option value="creator">Créatrice / créateur · identité et ligne éditoriale</option>
                  </select>
                </Field>
                <Field
                  label={
                    modal === "client" && form.workspaceType === "creator"
                      ? "Nom de la créatrice / du créateur"
                      : "Nom du client"
                  }
                >
                  <input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <Field label={form.workspaceType === "creator" ? "Nom public / signature" : "Nom de sa marque"}>
                  <input value={form.brand || ""} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                </Field>
                <div className="form-row">
                  <Field label="Quota total">
                    <input
                      type="number"
                      min="0"
                      value={form.quota_limit}
                      onChange={(e) => setForm({ ...form, quota_limit: e.target.value })}
                    />
                  </Field>
                  <Field label="Langue des légendes">
                    <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                      <option value="es">Espagnol</option>
                      <option value="fr">Français</option>
                      <option value="en">Anglais</option>
                    </select>
                  </Field>
                </div>
                <Field
                  label="Adresses des utilisateurs autorisés"
                  hint="Une adresse par ligne. Le client doit se connecter avec cette adresse via un code par e-mail."
                >
                  <textarea value={form.emails || ""} onChange={(e) => setForm({ ...form, emails: e.target.value })} />
                </Field>
              </>
            )}
            {modal === "occasion" && (
              <>
                <Field label="Nom de l’occasion">
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </Field>
                <Field label="Date">
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </Field>
                <Field label="Angle adapté à ce client">
                  <textarea value={form.angle} onChange={(e) => setForm({ ...form, angle: e.target.value })} />
                </Field>
                <Field label="Produit associé · facultatif">
                  <select
                    value={form.product_id || ""}
                    onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                  >
                    <option value="">Toute la marque</option>
                    {data.products.map((p: Row) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            {modal === "product" && !productSaved && (
              <>
                <Field
                  label={
                    creator
                      ? L("Nom du sujet *", "Nombre del tema *", "Topic name *")
                      : L("Nom du produit *", "Nombre del producto *", "Product name *")
                  }
                >
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <Field
                  label={L("Décrivez-le simplement *", "Descríbelo de forma sencilla *", "Describe it simply *")}
                  hint={L(
                    "Par exemple : sa taille, sa couleur, sa matière ou ce qu’il permet de faire.",
                    "Por ejemplo: su tamaño, su color, su material o para qué sirve.",
                    "For example: its size, color, material or what it does.",
                  )}
                >
                  <textarea
                    placeholder={
                      creator
                        ? L(
                            "Le sujet, le contexte réel et l’intention de ces visuels.",
                            "El tema, el contexto real y la intención de estas imágenes.",
                            "The topic, the real context and the purpose of these images.",
                          )
                        : L(
                            "Ce qu’est le produit, simplement.",
                            "Qué es el producto, en pocas palabras.",
                            "What the product is, simply.",
                          )
                    }
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </Field>
                <Field
                  label={L(
                    "Détails à respecter · facultatif",
                    "Detalles que respetar · opcional",
                    "Details to respect · optional",
                  )}
                >
                  <textarea
                    placeholder={
                      creator
                        ? L(
                            "Identité, traits, apparence naturelle, éléments et limites à respecter…",
                            "Identidad, rasgos, apariencia natural, elementos y límites que respetar…",
                            "Identity, features, natural look, elements and limits to respect…",
                          )
                        : L(
                            "Ex. : étiquette violette, forme carrée",
                            "Ej.: etiqueta morada, forma cuadrada",
                            "E.g. purple label, square shape",
                          )
                    }
                    value={form.preserve}
                    onChange={(e) => setForm({ ...form, preserve: e.target.value })}
                  />
                </Field>
                <Field
                  label={
                    creator
                      ? L(
                          "Contexte complémentaire · facultatif",
                          "Contexto adicional · opcional",
                          "Extra context · optional",
                        )
                      : L(
                          "Prix ou lien pour commander · facultatif",
                          "Precio o enlace para pedir · opcional",
                          "Price or ordering link · optional",
                        )
                  }
                >
                  <input
                    placeholder={L(
                      "Prix confirmé, lien de commande…",
                      "Precio confirmado, enlace de pedido…",
                      "Confirmed price, order link…",
                    )}
                    value={form.commercial}
                    onChange={(e) => setForm({ ...form, commercial: e.target.value })}
                  />
                </Field>
                {isAgency && (
                  <Field label="Marque">
                    <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                  </Field>
                )}
                <div className="field product-photos-field">
                  <span>
                    {creator
                      ? L("Ajoutez 1 à 5 photos", "Agrega de 1 a 5 fotos", "Add 1 to 5 photos")
                      : L(
                          "Ajoutez 1 à 5 photos du produit",
                          "Agrega de 1 a 5 fotos del producto",
                          "Add 1 to 5 product photos",
                        )}
                  </span>
                  <div className="product-photos-row">
                    {productFiles.map((f, i) => (
                      <div className="product-photo" key={i + f.name}>
                        <img src={URL.createObjectURL(f)} alt={f.name} />
                        <button
                          type="button"
                          className="product-photo-remove"
                          aria-label={L("Retirer ", "Quitar ", "Remove ") + f.name}
                          onClick={() => setProductFiles(productFiles.filter((_, j) => j !== i))}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {productFiles.length < 5 && (
                      <label className="product-photo-add">
                        <Upload size={18} />
                        <span>{L("Photos", "Fotos", "Photos")}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          multiple
                          hidden
                          onChange={(e) => {
                            const picked = Array.from(e.target.files || []);
                            setProductFiles([...productFiles, ...picked].slice(0, 5));
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                  <small>
                    {L(
                      "Des photos nettes, prises près d’une fenêtre. JPG ou PNG, 8 Mo max.",
                      "Fotos nítidas, tomadas junto a una ventana. JPG o PNG, máx. 8 MB.",
                      "Sharp photos, taken near a window. JPG or PNG, 8 MB max.",
                    )}
                  </small>
                </div>
              </>
            )}
            {modal === "recipe" && (
              <>
                <Field label="Nom visible par le client">
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <div className="form-row">
                  <Field label="Nombre de visuels">
                    <select
                      value={form.config.count}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          config: { ...form.config, count: e.target.value },
                        })
                      }
                    >
                      {[1, 2, 3].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Format">
                    <select
                      value={form.config.size}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          config: { ...form.config, size: e.target.value },
                        })
                      }
                    >
                      {Object.entries(formats).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l as string}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Ambiances · une par ligne">
                  <textarea
                    rows={4}
                    value={form.scenes}
                    onChange={(e) => setForm({ ...form, scenes: e.target.value })}
                  />
                </Field>
                <Field label="Instructions de création">
                  <textarea
                    value={form.config.instructions}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        config: {
                          ...form.config,
                          instructions: e.target.value,
                        },
                      })
                    }
                  />
                </Field>
                <div className="form-row">
                  <Field label="Langue">
                    <select
                      value={form.config.language}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          config: { ...form.config, language: e.target.value },
                        })
                      }
                    >
                      <option value="es">Espagnol</option>
                      <option value="fr">Français</option>
                      <option value="en">Anglais</option>
                    </select>
                  </Field>
                  <Field label="Ton">
                    <input
                      value={form.config.tone}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          config: { ...form.config, tone: e.target.value },
                        })
                      }
                    />
                  </Field>
                </div>
                <label className="optional-toggle">
                  <input
                    type="checkbox"
                    checked={form.active !== 0}
                    onChange={(e) => setForm({ ...form, active: e.target.checked ? 1 : 0 })}
                  />
                  Recette autorisée
                </label>
              </>
            )}
            {modal === "settings" && (
              <>
                <Field label="Nom du client">
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <Field label="Marque">
                  <input
                    value={form.config.brand}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        config: { ...form.config, brand: e.target.value },
                      })
                    }
                  />
                </Field>
                <Field label="Ton">
                  <input
                    value={form.config.tone}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        config: { ...form.config, tone: e.target.value },
                      })
                    }
                  />
                </Field>
                <div className="form-row">
                  <Field label="Langue par défaut">
                    <select
                      value={form.config.language}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          config: { ...form.config, language: e.target.value },
                        })
                      }
                    >
                      <option value="es">Espagnol</option>
                      <option value="fr">Français</option>
                      <option value="en">Anglais</option>
                    </select>
                  </Field>
                  <Field label="Couleurs · codes hexadécimaux">
                    <input
                      value={form.config.colors}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          config: { ...form.config, colors: e.target.value },
                        })
                      }
                    />
                  </Field>
                </div>
                <div className="form-row">
                  <Field label="Pays du client (tarif et marronniers)">
                    <select
                      value={form.config.country || "MX"}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          config: { ...form.config, country: e.target.value },
                        })
                      }
                    >
                      <option value="MX">Mexique</option>
                      <option value="FR">France</option>
                      <option value="US">États-Unis</option>
                    </select>
                  </Field>
                  <Field label="Secteur du client">
                    <select
                      value={form.config.sector || "auto"}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          config: { ...form.config, sector: e.target.value },
                        })
                      }
                    >
                      {[
                        ["auto", "Déduire des produits"],
                        ["food", "Alimentation / restauration"],
                        ["retail", "Commerce / produits"],
                        ["hospitality", "Hôtellerie"],
                        ["wellness", "Bien-être"],
                        ["general", "Services / généraliste"],
                      ].map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field
                  label="Occasions masquées · identifiants séparés par des virgules"
                  hint="Exemple : blackfriday, halloween. Laissez vide pour conserver les suggestions adaptées."
                >
                  <input
                    value={(form.config.calendarHidden || []).join(", ")}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        config: {
                          ...form.config,
                          calendarHidden: e.target.value
                            .split(",")
                            .map((x) => x.trim())
                            .filter(Boolean),
                        },
                      })
                    }
                  />
                </Field>
                <Field
                  label="Ambiance de l’espace client"
                  hint="Les couleurs ci-dessus s’appliquent aux boutons, aux menus, aux fonds et à l’accueil du client."
                >
                  <select
                    value={form.config.studioVibe || "clean"}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        config: { ...form.config, studioVibe: e.target.value },
                      })
                    }
                  >
                    <option value="clean">Sobre · clair, simple, aéré</option>
                    <option value="warm">Chaleureuse · formes douces, titres élégants</option>
                    <option value="bold">Vive · couleur plus présente, lignes affirmées</option>
                  </select>
                </Field>
                <div
                  className="client-space theme-sample"
                  data-vibe={form.config.studioVibe || "clean"}
                  style={studioTheme(form.config) as React.CSSProperties}
                >
                  <span className="eyebrow">APERÇU POUR {form.config.brand || form.name}</span>
                  <h3>Votre espace. Vos couleurs.</h3>
                  <p>Les textes restent lisibles, même avec des couleurs très claires.</p>
                  <span className="button primary">Créer mes images</span>
                  <span className="theme-sample-chip">Mon calendrier</span>
                </div>
                <Field label="Règles de marque">
                  <textarea
                    value={form.config.rules}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        config: { ...form.config, rules: e.target.value },
                      })
                    }
                  />
                </Field>
                <div className="form-row">
                  <Field label="Validation">
                    <select
                      value={form.config.validation}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          config: {
                            ...form.config,
                            validation: e.target.value,
                          },
                        })
                      }
                    >
                      <option value="agency">Validation par l’agence</option>
                      <option value="direct">Disponible directement</option>
                    </select>
                  </Field>
                  <Field label="Quota total">
                    <input
                      type="number"
                      min={client.quota_used}
                      value={form.quota_limit}
                      onChange={(e) => setForm({ ...form, quota_limit: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="mini-label">CRÉDITS PAR UNITÉ</div>
                <div className="form-row">
                  {[
                    ["imageCost", "Image"],
                    ["captionCost", "Légende"],
                    ["variantCost", "Variante"],
                    ["correctionCost", "Correction"],
                  ].map(([k, label]) => (
                    <Field key={k} label={label}>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={form.config[k]}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            config: {
                              ...form.config,
                              [k]: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </Field>
                  ))}
                </div>
                <Field
                  label="Points par post publié"
                  hint="10 par défaut. Les posts déjà récompensés conservent leur valeur initiale."
                >
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    value={form.config.pointsPerPost ?? 10}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        config: {
                          ...form.config,
                          pointsPerPost: Number(e.target.value),
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Adresses autorisées · une par ligne">
                  <textarea value={form.emails} onChange={(e) => setForm({ ...form, emails: e.target.value })} />
                </Field>
                <label className="optional-toggle">
                  <input
                    type="checkbox"
                    checked={!!form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked ? 1 : 0 })}
                  />
                  Espace actif
                </label>
              </>
            )}
            {modal === "correction" && (
              <>
                <Field
                  label={L("Que souhaitez-vous modifier ?", "¿Qué quieres cambiar?", "What would you like to change?")}
                >
                  <textarea
                    value={form.comment}
                    onChange={(e) => setForm({ ...form, comment: e.target.value })}
                    placeholder={L(
                      "Exemple : retirer le fromage filant.",
                      "Ejemplo: quitar el queso derretido.",
                      "Example: remove the melted cheese.",
                    )}
                  />
                </Field>
                <label className="optional-toggle">
                  <input
                    type="checkbox"
                    checked={form.permanent}
                    onChange={(e) => setForm({ ...form, permanent: e.target.checked })}
                  />
                  {L(
                    "Proposer une règle pour les prochaines créations",
                    "Proponer una regla para las próximas creaciones",
                    "Suggest a rule for future creations",
                  )}
                </label>
                <p className="muted">
                  {L(
                    "L’agence doit approuver toute règle permanente. Votre visuel original sera conservé.",
                    "La agencia debe aprobar cualquier regla permanente. Tu imagen original se conservará.",
                    "The agency must approve any permanent rule. Your original image will be kept.",
                  )}
                </p>
              </>
            )}
            {modal === "product" && productSaved ? (
              <div className="product-saved">
                <CheckCircle2 size={28} />
                <h3>
                  {creator
                    ? L("Sujet enregistré.", "Tema guardado.", "Topic saved.")
                    : L("Produit enregistré.", "Producto guardado.", "Product saved.")}
                </h3>
                <p className="muted">
                  {productSaved.photos
                    ? L(
                        "Ses photos sont prêtes pour vos prochains visuels.",
                        "Sus fotos están listas para tus próximas imágenes.",
                        "Its photos are ready for your next visuals.",
                      )
                    : L(
                        "Ajoutez une photo au moment de créer votre visuel.",
                        "Agrega una foto al crear tu imagen.",
                        "Add a photo when you create your visual.",
                      )}
                </p>
                <button
                  className="button primary full"
                  onClick={() => {
                    setProduct(productSaved.id);
                    setModal("");
                    setTab("create");
                  }}
                >
                  {creator
                    ? L("Créer un visuel avec ce sujet", "Crear una imagen con este tema", "Create a visual with this topic")
                    : L(
                        "Créer un visuel avec ce produit",
                        "Crear una imagen con este producto",
                        "Create a visual with this product",
                      )}{" "}
                  <ArrowRight size={16} />
                </button>
                <button className="text-link" onClick={() => setModal("")}>
                  {L("Plus tard", "Más tarde", "Later")}
                </button>
              </div>
            ) : modal === "codes" ? (
              <>
                {codes.map((c) => (
                  <div key={c.code} className="code-card">
                    <b>{c.name}</b>
                    <code>{c.code}</code>
                    <button
                      className="button secondary"
                      onClick={async () => {
                        await navigator.clipboard.writeText(c.code);
                        setToast("Code copié.");
                      }}
                    >
                      <Copy size={15} />
                      Copier le code
                    </button>
                  </div>
                ))}
                <p className="muted">
                  Avant d’inviter un client, autorisez son adresse et vérifiez l’accès à l’application. Le site reste
                  privé pour ces premiers tests.
                </p>
                <button className="button primary full" onClick={() => setModal("")}>
                  Continuer la configuration <ArrowRight size={16} />
                </button>
              </>
            ) : (
              <button className="button primary full" onClick={save} disabled={busy || uploading}>
                {busy || uploading ? <Loader2 className="spin" size={17} /> : <Check size={17} />}{" "}
                {modal === "correction"
                  ? L("Envoyer la demande", "Enviar la solicitud", "Send request")
                  : L("Enregistrer", "Guardar", "Save")}
              </button>
            )}
          </Modal>
        )}
      </div>
    </LangProvider>
  );
}
