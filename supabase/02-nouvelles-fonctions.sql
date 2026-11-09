-- Louvet Content Studio : nouvelles fonctionnalités (octobre 2026).
-- À exécuter UNE FOIS dans le SQL Editor de Supabase, APRÈS 00-schema.sql.
-- Sans risque pour les données existantes : uniquement des CREATE … IF NOT EXISTS et ALTER … ADD COLUMN IF NOT EXISTS.
-- Peut être rejoué. Exécutez ensuite 03-protections.sql.
BEGIN;

-- 1. Banque de plans vidéo : un plan filmé une fois sert à tous les montages qui le demandent.
CREATE TABLE IF NOT EXISTS shot_clips (
  client_id TEXT NOT NULL,
  shot_key TEXT NOT NULL,
  file_id TEXT NOT NULL,
  label TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created TEXT NOT NULL,
  PRIMARY KEY (client_id, shot_key)
);
ALTER TABLE shot_clips ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE shot_clips FROM PUBLIC, anon, authenticated;

-- 2. Livraison mensuelle : 6 contenus préparés, validés par l'agence, envoyés le 3.
CREATE TABLE IF NOT EXISTS monthly_deliveries (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  month TEXT NOT NULL,
  status TEXT NOT NULL,
  items TEXT NOT NULL,
  note TEXT,
  validated_by TEXT,
  validated_at TEXT,
  sent_at TEXT,
  created TEXT NOT NULL,
  updated TEXT NOT NULL,
  UNIQUE (client_id, month)
);
ALTER TABLE monthly_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE monthly_deliveries FROM PUBLIC, anon, authenticated;

-- 3. Parrainage : un code par client, remise de 10 € / 200 MXN / 10 USD selon le pays, par marque parrainée qui paie.
CREATE TABLE IF NOT EXISTS referral_codes (
  code TEXT PRIMARY KEY,
  client_id TEXT NOT NULL UNIQUE,
  created TEXT NOT NULL
);
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE referral_codes FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  referred_client_id TEXT NOT NULL UNIQUE,
  referred_name TEXT NOT NULL,
  status TEXT NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 1000,
  currency TEXT NOT NULL DEFAULT 'usd',
  stripe_reference TEXT,
  created TEXT NOT NULL,
  credit_error TEXT,
  updated TEXT NOT NULL
);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE referrals FROM PUBLIC, anon, authenticated;
-- Code saisi par un prospect (formulaire public), rattaché à son espace lors de sa première connexion.
CREATE TABLE IF NOT EXISTS referral_claims (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  created TEXT NOT NULL
);
ALTER TABLE referral_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE referral_claims FROM PUBLIC, anon, authenticated;

-- 4. Demandes pour l'offre complète de l'agence (page facturation).
CREATE TABLE IF NOT EXISTS offer_requests (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL,
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);
ALTER TABLE offer_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE offer_requests FROM PUBLIC, anon, authenticated;

-- 5. Publication Meta (Instagram / Facebook) : connexion du compte du client et historique.
CREATE TABLE IF NOT EXISTS meta_connections (
  client_id TEXT PRIMARY KEY,
  ig_user_id TEXT NOT NULL,
  username TEXT,
  token_encrypted TEXT NOT NULL,
  token_expires TEXT,
  connected_by TEXT NOT NULL,
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);
ALTER TABLE meta_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE meta_connections FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS meta_oauth_states (
  state TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  expires TEXT NOT NULL
);
ALTER TABLE meta_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE meta_oauth_states FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS meta_publications (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  request_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  media_id TEXT,
  permalink TEXT,
  error TEXT,
  user_id TEXT NOT NULL,
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);
ALTER TABLE meta_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE meta_publications FROM PUBLIC, anon, authenticated;

-- 6. Demandes de rendez-vous avec l'agence (bouton d'aide du studio, quand aucun lien de réservation n'est configuré).
CREATE TABLE IF NOT EXISTS booking_requests (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  slots TEXT NOT NULL,
  message TEXT NOT NULL,
  timezone TEXT NOT NULL,
  status TEXT NOT NULL,
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE booking_requests FROM PUBLIC, anon, authenticated;

-- Lieux (décors de référence fournis par l'agence : restaurant, boutique, bureau, chambre…).
CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  label TEXT NOT NULL,
  labels TEXT NOT NULL,
  description TEXT NOT NULL,
  files TEXT NOT NULL,
  active BIGINT NOT NULL DEFAULT 1,
  position BIGINT NOT NULL DEFAULT 0,
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS places_client ON places(client_id);
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE places FROM PUBLIC, anon, authenticated;

-- Atelier « Modèles » : visuels composés dans le navigateur (le fichier est dans files, id identique).
CREATE TABLE IF NOT EXISTS designs (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  template TEXT NOT NULL,
  created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS designs_client ON designs(client_id);
ALTER TABLE designs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE designs FROM PUBLIC, anon, authenticated;

-- Messages client ↔ agence : un fil par espace client (photo jointe éventuelle dans files, purpose 'chat').
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  author TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  file_id TEXT,
  read_at TEXT,
  created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_messages_client ON chat_messages(client_id, created);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE chat_messages FROM PUBLIC, anon, authenticated;

-- Calendrier : contenus que le client ajoute lui-même (visuel, modèle, vidéo ou note), sans points.
CREATE TABLE IF NOT EXISTS calendar_entries (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  kind TEXT NOT NULL,
  file_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  done BIGINT NOT NULL DEFAULT 0,
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS calendar_entries_client ON calendar_entries(client_id, date);
ALTER TABLE calendar_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE calendar_entries FROM PUBLIC, anon, authenticated;

-- Opportunités pour les créatrices : carnet de marques (commun, écrit par l'agence) et suivi privé de chaque créatrice.
CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  niche TEXT NOT NULL,
  brand TEXT NOT NULL,
  instagram TEXT,
  email TEXT,
  site TEXT,
  country TEXT NOT NULL DEFAULT 'INTL',
  languages TEXT NOT NULL DEFAULT '{}',
  note TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '{}',
  active BIGINT NOT NULL DEFAULT 1,
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS opportunities_niche ON opportunities(niche, active);
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE opportunities FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS opportunity_status (
  client_id TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  note TEXT NOT NULL DEFAULT '',
  updated TEXT NOT NULL,
  PRIMARY KEY (client_id, opportunity_id)
);
ALTER TABLE opportunity_status ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE opportunity_status FROM PUBLIC, anon, authenticated;

-- Collaborations : marques clientes ouvertes aux propositions des créatrices (consentement daté), et propositions reçues.
CREATE TABLE IF NOT EXISTS brand_collab_profiles (
  client_id TEXT PRIMARY KEY,
  enabled BIGINT NOT NULL DEFAULT 0,
  consent_at TEXT,
  offer_types TEXT NOT NULL DEFAULT '{}',
  offer TEXT NOT NULL DEFAULT '',
  looking_for TEXT NOT NULL DEFAULT '',
  niche TEXT NOT NULL DEFAULT '',
  countries TEXT NOT NULL DEFAULT '{}',
  link TEXT NOT NULL DEFAULT '',
  updated TEXT NOT NULL,
  approved_offer TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending',
  review_reason TEXT NOT NULL DEFAULT '',
  reviewed_at TEXT
);
-- Relecture des offres par l'agence : la version validée reste visible pendant qu'une modification attend.
ALTER TABLE brand_collab_profiles ADD COLUMN IF NOT EXISTS approved_offer TEXT;
ALTER TABLE brand_collab_profiles ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE brand_collab_profiles ADD COLUMN IF NOT EXISTS review_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE brand_collab_profiles ADD COLUMN IF NOT EXISTS reviewed_at TEXT;
ALTER TABLE brand_collab_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE brand_collab_profiles FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS collab_requests (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  brand_client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  instagram TEXT NOT NULL DEFAULT '',
  portfolio TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  reply TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  hidden BIGINT NOT NULL DEFAULT 0,
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS collab_requests_creator ON collab_requests(client_id, brand_client_id);
CREATE INDEX IF NOT EXISTS collab_requests_brand ON collab_requests(brand_client_id, status);
ALTER TABLE collab_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE collab_requests FROM PUBLIC, anon, authenticated;

-- Reels publiés en collaboration avec @withjulielouvet : un Reel ne peut être déclaré qu'une fois, par un seul client.
CREATE TABLE IF NOT EXISTS reel_collab_claims (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  shortcode TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT NOT NULL DEFAULT '',
  amount_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  approved_month TEXT,
  stripe_reference TEXT,
  created TEXT NOT NULL,
  credit_error TEXT,
  updated TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reel_collab_claims_client ON reel_collab_claims(client_id, status);
ALTER TABLE reel_collab_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE reel_collab_claims FROM PUBLIC, anon, authenticated;

-- Versions à tester (créatrices) : une vidéo déclinée en 3, 5 ou 10 versions, puis la gagnante choisie d'après les vues.
CREATE TABLE IF NOT EXISTS test_batches (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  source_edit_id TEXT,
  source_file_id TEXT,
  count BIGINT NOT NULL DEFAULT 0,
  axes TEXT NOT NULL DEFAULT '[]',
  context TEXT NOT NULL DEFAULT '{}',
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'rendering',
  parent_batch_id TEXT,
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS test_batches_client ON test_batches(client_id, created);
ALTER TABLE test_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE test_batches FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS test_versions (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  label TEXT NOT NULL,
  recipe TEXT NOT NULL DEFAULT '{}',
  file_id TEXT,
  posted_at TEXT,
  views BIGINT,
  likes BIGINT,
  saves BIGINT,
  shares BIGINT,
  note TEXT NOT NULL DEFAULT '',
  winner BIGINT NOT NULL DEFAULT 0,
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS test_versions_batch ON test_versions(batch_id, label);
ALTER TABLE test_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE test_versions FROM PUBLIC, anon, authenticated;

-- Montant et devise du tarif Stripe enregistré (tarif personnalisé affiché correctement au client).
ALTER TABLE billing_accounts ADD COLUMN IF NOT EXISTS price_amount BIGINT;
ALTER TABLE billing_accounts ADD COLUMN IF NOT EXISTS price_currency TEXT;
-- Remise (parrainage, Reel) qui n'a pas pu être créditée chez Stripe : visible par l'agence.
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS credit_error TEXT;
ALTER TABLE reel_collab_claims ADD COLUMN IF NOT EXISTS credit_error TEXT;

-- « Recréer ce post » : recettes tirées des captures d'un post Instagram (les captures sont des fichiers « inspiration »).
CREATE TABLE IF NOT EXISTS inspirations (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  files TEXT NOT NULL DEFAULT '[]',
  recipe TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,
  created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inspirations_client ON inspirations(client_id, created);
ALTER TABLE inspirations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE inspirations FROM PUBLIC, anon, authenticated;
-- « Importer mon site » : ce que le studio a lu sur le site public de la cliente, et ce qu'elle a appliqué.
CREATE TABLE IF NOT EXISTS site_imports (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  url TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT '{}',
  applied TEXT NOT NULL DEFAULT '{}',
  created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS site_imports_client ON site_imports(client_id, created);
ALTER TABLE site_imports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE site_imports FROM PUBLIC, anon, authenticated;

COMMIT;
