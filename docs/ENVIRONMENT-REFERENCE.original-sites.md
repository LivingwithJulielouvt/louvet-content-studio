# Référence des variables et points d’injection

Inventaire statique des noms lus dans les sources et scripts. Les variables métier, bindings et clés sont expliqués dans le README. Les chemins, options de l’outillage et fonctions de simulation ne sont pas des clés de production. Les valeurs réelles ne sont pas exportées.

| Nom | Références dans les sources |
| --- | --- |
| `AGENCY_OWNER_ID` | `lib/studio.mjs`, `tests/beta.mjs` |
| `AI_STATUS` | `lib/studio.mjs` |
| `API_FETCH` | `lib/studio.mjs`, `tests/beta.mjs`, `tests/billing.mjs`, `tests/security.mjs` |
| `BASH_SOURCE` | `scripts/build-verified.sh`, `scripts/install-ci.sh`, `scripts/install-pnpm.sh`, `scripts/sites-env.sh` |
| `BETA_MODE` | `lib/beta.mjs`, `lib/billing.mjs`, `tests/beta.mjs` |
| `BILLING_NOW` | `lib/billing.mjs`, `tests/billing.mjs` |
| `BREVO_API_KEY` | `lib/studio-mail.mjs`, `tests/public-subscriptions.mjs`, `tests/publication.mjs`, `tests/studio-mail.mjs` |
| `BREVO_FETCH` | `lib/studio-mail.mjs`, `tests/public-subscriptions.mjs`, `tests/publication.mjs`, `tests/studio-mail.mjs` |
| `BREVO_SENDER_EMAIL` | `lib/public-subscriptions.mjs`, `lib/studio-mail.mjs`, `tests/public-subscriptions.mjs`, `tests/publication.mjs`, `tests/studio-mail.mjs` |
| `BREVO_STUDIO_LIST_ID` | `lib/studio-mail.mjs`, `tests/publication.mjs`, `tests/studio-mail.mjs` |
| `BUCKET` | `lib/client-lifecycle.mjs`, `lib/studio.mjs`, `tests/client-lifecycle.mjs` |
| `CLOUDFLARE_CF_FETCH_ENABLED` | `scripts/sites-env.mjs`, `vite.config.ts` |
| `CODEX_SANDBOX` | `vite.config.ts` |
| `CONNECTORS` | `build/sites-worker.ts` |
| `CORE_VERSION` | `public/media-engine/const.js` |
| `DB` | `db/index.ts`, `lib/beta.mjs`, `lib/billing.mjs`, `lib/client-lifecycle.mjs`, `lib/public-subscriptions.mjs`, `lib/publication.mjs`, `lib/studio-mail.mjs`, `lib/studio.mjs` |
| `DEV` | `build/sites-worker.ts` |
| `EMAIL_COPY_APPROVED_VERSION` | `lib/studio-mail.mjs`, `tests/public-subscriptions.mjs`, `tests/publication.mjs`, `tests/studio-mail.mjs` |
| `EMAIL_DELIVERY_ENABLED` | `lib/studio-mail.mjs`, `tests/public-subscriptions.mjs`, `tests/publication.mjs`, `tests/studio-mail.mjs` |
| `EMAIL_UNSUBSCRIBE_PUBLIC_READY` | `lib/studio-mail.mjs`, `tests/studio-mail.mjs` |
| `EMAIL_UNSUBSCRIBE_SECRET` | `lib/studio-mail.mjs`, `tests/studio-mail.mjs` |
| `FS` | `public/media-engine/ffmpeg-core.js` |
| `HOME` | `scripts/install-ci.sh`, `scripts/install-pnpm.sh` |
| `IMAGE_MODEL` | `lib/studio.mjs` |
| `JSON` | `build/connector-preview-plugin.mjs`, `scripts/connector-preview/connector-preview-session.mjs`, `scripts/install-ci.sh`, `scripts/npm-install.mjs`, `scripts/pnpm-install.mjs` |
| `M` | `lib/video-render.mjs` |
| `MAIL_NOW` | `lib/studio-mail.mjs`, `tests/studio-mail.mjs` |
| `MAIL_WEEKLY_ENABLED` | `lib/studio-mail.mjs`, `tests/studio-mail.mjs` |
| `MINIFLARE_REGISTRY_PATH` | `scripts/sites-env.mjs`, `vite.config.ts` |
| `MOBILE_BREAKPOINT` | `hooks/use-mobile.ts` |
| `OPENAI_API_KEY` | `lib/studio.mjs`, `tests/live.mjs` |
| `OWNER_PRIVATE_SERVICE` | `lib/studio.mjs`, `tests/beta.mjs`, `tests/editorial.mjs` |
| `PPID` | `scripts/install-ci.sh` |
| `S` | `app/publication-calendar.tsx`, `lib/creator-editorial.mjs`, `lib/editorial.mjs`, `lib/video-render.mjs` |
| `SHARP_IGNORE_GLOBAL_LIBVIPS` | `scripts/install-ci.mjs` |
| `SIDEBAR_COOKIE_MAX_AGE` | `components/ui/sidebar.tsx` |
| `SIDEBAR_COOKIE_NAME` | `components/ui/sidebar.tsx` |
| `SIGN_IN_PATH` | `app/chatgpt-auth.ts` |
| `SIGN_OUT_PATH` | `app/chatgpt-auth.ts` |
| `SITES_BUILD_KILL_AFTER` | `scripts/build-verified.sh` |
| `SITES_BUILD_TIMEOUT` | `scripts/build-verified.sh` |
| `SITES_ENV_READY` | `scripts/build-verified.sh`, `scripts/install-ci.sh`, `scripts/install-pnpm.sh` |
| `SITES_INSTALL_KILL_AFTER` | `scripts/install-ci.sh`, `scripts/install-pnpm.sh` |
| `SITES_INSTALL_LOCKS` | `scripts/install-pnpm.sh` |
| `SITES_INSTALL_LOCKS_PID` | `scripts/install-pnpm.sh` |
| `SITES_INSTALL_REPORT_PATH` | `scripts/npm-install.mjs`, `scripts/pnpm-install.mjs` |
| `SITES_INSTALL_TIMEOUT` | `scripts/install-ci.sh`, `scripts/install-pnpm.sh` |
| `SITES_NPM_CACHE_SEED` | `scripts/install-ci.sh` |
| `SITES_PNPM_BIN` | `scripts/install-pnpm.sh` |
| `SITES_PNPM_BOOTSTRAP_TIMEOUT` | `scripts/install-pnpm.sh` |
| `SITES_PNPM_CACHE_SEED` | `scripts/install-pnpm.sh` |
| `SITES_PNPM_SHARED_STORE` | `pnpm-workspace.yaml`, `scripts/install-pnpm.sh` |
| `SITES_PNPM_STORE_LOCK_TIMEOUT` | `scripts/install-pnpm.sh` |
| `SITES_PNPM_STORE_PREPARE_TIMEOUT` | `scripts/install-pnpm.sh` |
| `SITES_PROJECT_ROOT` | `scripts/build-verified.sh`, `scripts/install-ci.sh`, `scripts/install-pnpm.sh` |
| `SITES_RUNTIME_ROOT` | `scripts/install-ci.sh`, `scripts/install-pnpm.sh`, `scripts/sites-env.mjs`, `scripts/sites-env.sh` |
| `STRIPE_DEFAULT_AMOUNT` | `lib/billing.mjs` |
| `STRIPE_DEFAULT_CURRENCY` | `lib/billing.mjs` |
| `STRIPE_DEFAULT_PRICE_ID` | `lib/billing.mjs` |
| `STRIPE_FETCH` | `lib/billing.mjs`, `tests/beta.mjs`, `tests/billing.mjs` |
| `STRIPE_SECRET_KEY` | `lib/billing.mjs`, `tests/beta.mjs`, `tests/billing.mjs` |
| `STRIPE_SOURCE_AUTOMATIC_TAX` | `lib/billing.mjs` |
| `STRIPE_SOURCE_PAYMENT_LINK` | `lib/billing.mjs` |
| `STRIPE_TAX_REGISTRATIONS_VERIFIED` | `lib/billing.mjs` |
| `STRIPE_WEBHOOK_INGRESS_READY` | `lib/billing.mjs` |
| `STRIPE_WEBHOOK_SECRET` | `lib/billing.mjs`, `tests/billing.mjs` |
| `STUDIO_MAIL_CRON_SECRET` | `lib/studio-mail.mjs`, `tests/studio-mail.mjs` |
| `STUDIO_URL` | `lib/billing.mjs`, `lib/public-subscriptions.mjs`, `lib/studio-mail.mjs`, `tests/billing.mjs`, `tests/public-subscriptions.mjs`, `tests/publication.mjs`, `tests/studio-mail.mjs` |
| `TEXT_MODEL` | `lib/studio.mjs` |
| `UTF8T` | `public/media-engine/ffmpeg-core.js` |
| `WRANGLER_LOG_PATH` | `scripts/sites-env.mjs`, `vite.config.ts` |
| `WRANGLER_REGISTRY_PATH` | `scripts/sites-env.mjs`, `vite.config.ts` |
| `WRANGLER_SEND_METRICS` | `scripts/sites-env.mjs`, `vite.config.ts` |
| `WRANGLER_WRITE_LOGS` | `scripts/sites-env.mjs`, `vite.config.ts` |
| `XDG_CACHE_HOME` | `scripts/install-pnpm.sh` |
| `XDG_DATA_HOME` | `scripts/install-pnpm.sh` |
