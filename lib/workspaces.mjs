export const workspaceType = (config) => (config?.workspaceType === "creator" ? "creator" : "brand");
export const isCreator = (config) => workspaceType(config) === "creator";
const clean = (value, max = 2000) =>
  String(value ?? "")
    .trim()
    .slice(0, max);
export function normalizeCreatorStrategy(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Stratégie créatrice invalide.");
  const value = {};
  for (const key of [
    "displayName",
    "bio",
    "audience",
    "positioning",
    "voice",
    "visualWorld",
    "boundaries",
    "action",
    "filmingResources",
  ])
    value[key] = clean(input[key], key === "displayName" ? 120 : 2000);
  if (input.pillars && !Array.isArray(input.pillars)) throw new Error("Les piliers doivent être une liste.");
  value.pillars = [...new Set((input.pillars || []).map((x) => clean(x, 120)).filter(Boolean))];
  if (value.pillars.length > 6) throw new Error("Choisissez au maximum six piliers de contenu.");
  if (input.platforms && !Array.isArray(input.platforms)) throw new Error("Les plateformes doivent être une liste.");
  value.platforms = [
    ...new Set((input.platforms || []).filter((x) => ["Instagram", "TikTok", "YouTube", "LinkedIn"].includes(x))),
  ];
  return value;
}
export const creatorStrategyReady = (s) => !!(s?.pillars?.length && s?.audience?.trim() && s?.positioning?.trim());
export function creatorContext(s = {}) {
  const labels = {
    displayName: "Creator name",
    bio: "Approved biography",
    audience: "Audience",
    positioning: "Positioning",
    voice: "Voice",
    visualWorld: "Visual direction",
    boundaries: "Boundaries and permissions",
    action: "Call to action",
    filmingResources: "Real filming resources",
  };
  return [
    ...Object.entries(labels)
      .filter(([k]) => s[k])
      .map(([k, l]) => `${l}: ${s[k]}`),
    s.pillars?.length ? `Editorial pillars: ${s.pillars.join("; ")}` : "",
    s.platforms?.length ? `Platforms: ${s.platforms.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
export const creatorRecipe = {
  count: 3,
  size: "1024x1280",
  language: "fr",
  tone: "Personnel, naturel et précis",
  scenes: [
    "Portrait éditorial naturel à partir des photos fournies, lumière douce",
    "Référence en situation dans son univers personnel",
    "Cadrage alternatif pour une couverture de publication",
  ],
  instructions:
    "Préserver les personnes et éléments des photos originales. Ne pas inventer d’événement vécu, de collaboration, de résultat, de logo ou de texte. Aucune transformation du corps ou embellissement non demandé.",
};
