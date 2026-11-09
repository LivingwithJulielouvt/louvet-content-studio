"use client";
import { createSupabaseBrowser } from "./supabase/client";
type UploadOptions = {
  kind: "photo" | "video" | "video-output" | "render-output" | "music" | "sticker" | "design" | "design-video" | "chat" | "test-version" | "inspiration";
  client_id: string;
  product_id?: string;
  purpose?: string;
  edit_id?: string;
  render_id?: string;
  /** Versions à tester : la version dont c’est le fichier rendu. */
  version_id?: string;
  place_id?: string;
  /** Atelier « Modèles » : le modèle (textes, couleurs, photos) enregistré avec le visuel. */
  template?: Record<string, any>;
};
/** The browser sends media directly to private Supabase Storage, bypassing the Vercel 4.5MB limit. */
export async function uploadStudioMedia(file: File, options: UploadOptions) {
  const post = async (action: string, body: any) => {
    const r = await fetch("/api/studio/" + action, {
      method: "POST",
      headers: { "X-Studio-Request": "1", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw Error(data.error || "Enregistrement impossible.");
    return data;
  };
  // Photo jointe à un message : actions dédiées (ouvertes même avant l'ouverture du studio ou pendant un impayé).
  const chat = options.kind === "chat";
  // Captures d'un post à recréer : actions dédiées (« Recréer ce post »).
  const inspiration = options.kind === "inspiration";
  const intent = await post(chat ? "chat-photo-intent" : inspiration ? "recreate-upload-intent" : "upload-intent", { ...options, filename: file.name, mime: file.type, size: file.size });
  const supabase = createSupabaseBrowser();
  const { error } = await supabase.storage
    .from(process.env.NEXT_PUBLIC_STUDIO_BUCKET || "studio-private")
    .uploadToSignedUrl(intent.path, intent.token, file, { contentType: file.type });
  if (error) throw Error("Transfert du fichier impossible : " + error.message);
  return post(chat ? "chat-photo-commit" : inspiration ? "recreate-upload-commit" : "upload-commit", { intent_id: intent.id });
}
