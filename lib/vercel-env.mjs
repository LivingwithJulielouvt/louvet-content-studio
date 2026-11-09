import { studioDb } from "./vercel-db.mjs";
import { studioBucket } from "./vercel-storage.mjs";
import { createClient } from "@supabase/supabase-js";
/**
 * No secrets leave the server and no external provider is activated by creating this object.
 * @param {{id:string,email:string}|null} [authUser]
 */
export function studioEnv(authUser = null) {
  return {
    DB: studioDb,
    BUCKET: studioBucket,
    AUTH_USER: authUser,
    AUTH_ADMIN: {
      async deleteUser(id) {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw Error("Clé de service Supabase manquante.");
        const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false },
        });
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error && !/not found|404/i.test(error.message)) throw Error(error.message);
      },
    },
    ...Object.fromEntries(
      Object.keys(process.env)
        .filter((x) =>
          /^(AGENCY_|BETA_MODE|OWNER_PRIVATE_SERVICE|STUDIO_URL|OPENAI_API_KEY|OPENAI_BASE_URL|AI_GENERATION_ENABLED|TEXT_MODEL|IMAGE_MODEL|TTS_MODEL|TRANSCRIBE_MODEL|IMAGE_QUALITY|AI_STATUS|BREVO_|EMAIL_|MAIL_WEEKLY_ENABLED|STUDIO_MAIL_CRON_SECRET|STRIPE_|PUBLIC_|META_|MONTHLY_DELIVERY_|BOOKING_URL|TURNSTILE_|SENTRY_|VERCEL_GIT_COMMIT_SHA)/.test(
            x,
          ),
        )
        .map((x) => [x, process.env[x]]),
    ),
  };
}
