-- Louvet Content Studio : protections Postgres (à exécuter APRÈS 00-schema.sql et 02-nouvelles-fonctions.sql).
-- Sans risque, peut être rejoué autant de fois que nécessaire.
-- 1. Un espace supprimé ne peut plus recevoir de données : une notification Stripe tardive, un résultat
--    d'IA ou une tâche planifiée qui arriverait après la suppression est refusé par la base elle-même.
-- 2. Rattrapage unique : les offres de collaboration déjà visibles avant l'arrivée de la relecture par
--    l'agence restent visibles (elles sont marquées « validées » une seule fois, jamais les nouvelles).

CREATE OR REPLACE FUNCTION public.studio_block_deleted_client() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.client_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.client_deletions d WHERE d.client_id = NEW.client_id) THEN
    RAISE EXCEPTION 'client_deleted';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['shot_clips','monthly_deliveries','referral_codes','referrals','offer_requests','booking_requests','chat_messages','calendar_entries','opportunity_status','brand_collab_profiles','collab_requests','reel_collab_claims','test_versions','test_batches','inspirations','site_imports','places','designs','meta_connections','meta_oauth_states','meta_publications','accounts','audit','beta_feedback','beta_invites','beta_usage','billing_accounts','billing_events','client_intakes','client_video_styles','corrections','custom_occasions','email_outbox','files','intake_tests','jobs','notifications','products','publication_posts','recipes','registration_profiles','reward_events','rules','studio_mail_members','tasks','video_edits','video_ideas','video_plans','video_renders','upload_intents'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'client_id') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_no_deleted', t);
      EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.studio_block_deleted_client()', t || '_no_deleted', t);
    END IF;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.studio_migrations (id TEXT PRIMARY KEY, applied TEXT NOT NULL);
ALTER TABLE public.studio_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.studio_migrations FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.studio_migrations WHERE id = 'collab-offers-backfill') THEN
    UPDATE public.brand_collab_profiles SET
      approved_offer = json_build_object(
        'offer_types', COALESCE(offer_types::json -> 'list', '[]'::json),
        'offer', offer,
        'looking_for', looking_for,
        'niche', niche,
        'countries', COALESCE(countries::json -> 'list', '[]'::json),
        'link', link)::text,
      review_status = 'approved',
      reviewed_at = updated
    WHERE enabled = 1 AND approved_offer IS NULL AND reviewed_at IS NULL;
    INSERT INTO public.studio_migrations VALUES ('collab-offers-backfill', now()::text);
  END IF;
END $$;
