/** Private, server-only Supabase Storage adapter compatible with the original R2 usage. */
import { createClient } from "@supabase/supabase-js";
let client;
const bucket = () => process.env.SUPABASE_STORAGE_BUCKET || "studio-private";
function storage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Stockage Supabase non configuré.");
  if (!client)
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  return client.storage.from(bucket());
}
export const studioBucket = {
  /** Create a short-lived, scoped token. The API must validate user, tenant, MIME and size first. */
  async createUpload(key) {
    const { data, error } = await storage().createSignedUploadUrl(key, { upsert: false });
    if (error || !data?.token) throw Error(error?.message || "URL de téléversement indisponible.");
    return { path: data.path || key, token: data.token };
  },
  async signedDownload(key, download = false, ttl = 60) {
    const { data, error } = await storage().createSignedUrl(key, ttl, download ? { download: true } : {});
    if (error || !data?.signedUrl) throw Error(error?.message || "Lien de téléchargement indisponible.");
    return data.signedUrl;
  },
  async head(key) {
    // Storage.info checks existence and metadata without downloading entire large videos.
    const { data, error } = await storage().info(key);
    if (error) {
      if (/not found|does not exist|404/i.test(error.message)) return null;
      throw Error(error.message);
    }
    return data || null;
  },
  async put(key, bytes, opts = {}) {
    if (!/^[a-z0-9-]{8,}\/[^.][\s\S]*$/i.test(key) || key.includes("..")) throw Error("Clé de stockage invalide.");
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    const { error } = await storage().upload(key, buffer, {
      upsert: false,
      contentType: opts.httpMetadata?.contentType || opts.contentType || "application/octet-stream",
      cacheControl: "private, no-store",
    });
    if (error) throw Error(error.message);
    return { key };
  },
  async get(key) {
    const { data, error } = await storage().download(key);
    if (error) {
      if (/not found|does not exist|404/i.test(error.message)) return null;
      throw Error(error.message);
    }
    const buf = await data.arrayBuffer();
    return {
      body: new Blob([buf], { type: data.type || "application/octet-stream" }).stream(),
      arrayBuffer: async () => buf,
    };
  },
  async delete(keys) {
    const arr = Array.isArray(keys) ? keys : [keys];
    if (!arr.length) return;
    for (let i = 0; i < arr.length; i += 100) {
      const { error } = await storage().remove(arr.slice(i, i + 100));
      if (error) throw Error(error.message);
    }
  },
  async list({ prefix = "", limit = 1000 } = {}) {
    // Supabase lists one folder at a time, unlike R2. Walk descendants for reliable account deletion.
    const found = [],
      queue = [prefix.replace(/\/$/, "")];
    while (queue.length && found.length < limit) {
      const folder = queue.shift();
      let offset = 0;
      while (found.length < limit) {
        const { data, error } = await storage().list(folder, { limit: 100, offset });
        if (error) throw Error(error.message);
        for (const o of data || []) {
          const key = folder ? folder + "/" + o.name : o.name;
          if (o.id === null) queue.push(key);
          else found.push({ key });
        }
        if ((data || []).length < 100) break;
        offset += 100;
      }
    }
    return { objects: found.slice(0, limit), truncated: queue.length > 0 };
  },
};
