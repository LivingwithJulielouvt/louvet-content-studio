"use client";
import { VIDEO_MAX_BYTES, videoTooBig } from "../lib/video-limits";
// Banque de plans : chaque plan filmé est enregistré une fois et réutilisé par toutes les idées qui le demandent.
import { useState } from "react";
import { Check, Loader2, Upload, Repeat2 } from "lucide-react";
import { uploadStudioMedia } from "../lib/direct-upload-client";
import { shotKey, ideaScenes } from "../lib/shot-key.mjs";
import { useL, useLang, dateLocale } from "../lib/i18n";
type Row = Record<string, any>;

async function post(path: string, body: Row) {
  const r = await fetch("/api/studio/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Studio-Request": "1" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(data.error || "Action impossible.");
  return data;
}

/** Avancement d'une idée : nombre de plans déjà disponibles dans la banque. */
export function shotProgress(idea: Row, shots: Row[] = []) {
  const keys = new Set(shots.map((s) => s.shot_key)),
    scenes = ideaScenes(idea.content);
  const done = scenes.filter((s: string) => keys.has(shotKey(s))).length;
  return { done, total: scenes.length, ready: scenes.length > 0 && done === scenes.length };
}

/**
 * Bouton « Ajouter ma vidéo » d'une étape de la fiche de tournage.
 * Chaque plan filmé est enregistré une fois et réutilisé par toutes les idées qui le demandent.
 */
export function ShotButton({
  idea,
  client,
  shots,
  canCreate,
  index,
  onSaved,
}: {
  idea: Row;
  client: Row;
  shots: Row[];
  canCreate: boolean;
  index: number;
  onSaved: (message: string) => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const L = useL(),
    lang = useLang();
  const scenes = ideaScenes(idea.content),
    scene = scenes[index];
  if (!scene) return null;
  const saved = new Map(shots.map((s) => [s.shot_key, s])).get(shotKey(scene));
  async function add(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > VIDEO_MAX_BYTES) throw new Error(videoTooBig(lang));
      const uploaded = await uploadStudioMedia(file, { kind: "video", client_id: client.id });
      const result = await post("shot-clip-save", {
        client_id: client.id,
        idea_id: idea.id,
        scene_index: index,
        file_id: uploaded.id,
      });
      await onSaved(
        result.assembled?.length
          ? L(
              "Toutes vos vidéos sont là : le montage se prépare dans « Mes vidéos ».",
              "Ya están todos tus videos: la edición se prepara en “Mis videos”.",
              "All your videos are in: the edit is being prepared in “My videos”.",
            )
          : result.reused_in
            ? result.reused_in === 1
              ? L(
                  "Vidéo enregistrée. Elle servira aussi pour une autre idée : inutile de la refilmer.",
                  "Video guardado. También servirá para otra idea: no hace falta volver a grabarlo.",
                  "Video saved. It will also be used for another idea, no need to film it again.",
                )
              : L(
                  `Vidéo enregistrée. Elle servira aussi pour ${result.reused_in} autres idées : inutile de la refilmer.`,
                  `Video guardado. También servirá para ${result.reused_in} ideas más: no hace falta volver a grabarlo.`,
                  `Video saved. It will also be used for ${result.reused_in} other ideas, no need to film it again.`,
                )
            : L("Vidéo enregistrée.", "Video guardado.", "Video saved."),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={"shot-button " + (saved ? "done" : "")}>
      {saved && <video preload="metadata" playsInline muted src={"/api/studio/file/" + saved.file_id} />}
      <label className={"button " + (saved ? "secondary" : "primary") + (busy || !canCreate ? " disabled" : "")}>
        {busy ? <Loader2 className="spin" size={15} /> : saved ? <Check size={15} /> : <Upload size={15} />}
        {busy
          ? L("Envoi…", "Enviando…", "Uploading…")
          : saved
            ? L("Refaire cette vidéo", "Volver a grabar", "Redo this video")
            : L("Ajouter ma vidéo", "Agregar mi video", "Add my video")}
        <input
          type="file"
          accept="video/mp4,video/quicktime,video/webm,.mov"
          hidden
          disabled={busy || !canCreate}
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {saved && (
        <small>
          <Repeat2 size={12} /> {L("Ajoutée le", "Agregado el", "Added on")}{" "}
          {new Date(saved.created).toLocaleDateString(dateLocale(lang))}
        </small>
      )}
      {error && <p className="error-inline">{error}</p>}
    </div>
  );
}
