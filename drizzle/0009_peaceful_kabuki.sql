CREATE TABLE `client_deletions` (
	`client_id` text PRIMARY KEY NOT NULL,
	`requested_by` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `studio_mail_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`text_fr` text NOT NULL,
	`text_es` text NOT NULL,
	`source_title` text NOT NULL,
	`source_url` text NOT NULL,
	`source_date` text NOT NULL,
	`approved` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `studio_mail_members` (
	`account_id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`language` text NOT NULL,
	`weekly_opt_in` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `email_outbox` ADD `kind` text DEFAULT 'welcome' NOT NULL;--> statement-breakpoint
ALTER TABLE `email_outbox` ADD `language` text DEFAULT 'fr' NOT NULL;--> statement-breakpoint
ALTER TABLE `email_outbox` ADD `copy_version` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `email_outbox` ADD `account_id` text;--> statement-breakpoint
ALTER TABLE `email_outbox` ADD `week_key` text;--> statement-breakpoint
ALTER TABLE `email_outbox` ADD `content` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
CREATE TRIGGER `accounts_no_deleted_insert` BEFORE INSERT ON `accounts` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `accounts_no_deleted_update` BEFORE UPDATE ON `accounts` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `audit_no_deleted_insert` BEFORE INSERT ON `audit` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `audit_no_deleted_update` BEFORE UPDATE ON `audit` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `beta_feedback_no_deleted_insert` BEFORE INSERT ON `beta_feedback` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `beta_feedback_no_deleted_update` BEFORE UPDATE ON `beta_feedback` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `beta_invites_no_deleted_insert` BEFORE INSERT ON `beta_invites` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `beta_invites_no_deleted_update` BEFORE UPDATE ON `beta_invites` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `beta_usage_no_deleted_insert` BEFORE INSERT ON `beta_usage` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `beta_usage_no_deleted_update` BEFORE UPDATE ON `beta_usage` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `billing_accounts_no_deleted_insert` BEFORE INSERT ON `billing_accounts` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `billing_accounts_no_deleted_update` BEFORE UPDATE ON `billing_accounts` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `billing_events_no_deleted_insert` BEFORE INSERT ON `billing_events` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `billing_events_no_deleted_update` BEFORE UPDATE ON `billing_events` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `client_intakes_no_deleted_insert` BEFORE INSERT ON `client_intakes` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `client_intakes_no_deleted_update` BEFORE UPDATE ON `client_intakes` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `client_video_styles_no_deleted_insert` BEFORE INSERT ON `client_video_styles` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `client_video_styles_no_deleted_update` BEFORE UPDATE ON `client_video_styles` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `corrections_no_deleted_insert` BEFORE INSERT ON `corrections` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `corrections_no_deleted_update` BEFORE UPDATE ON `corrections` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `custom_occasions_no_deleted_insert` BEFORE INSERT ON `custom_occasions` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `custom_occasions_no_deleted_update` BEFORE UPDATE ON `custom_occasions` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `email_outbox_no_deleted_insert` BEFORE INSERT ON `email_outbox` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `email_outbox_no_deleted_update` BEFORE UPDATE ON `email_outbox` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `files_no_deleted_insert` BEFORE INSERT ON `files` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `files_no_deleted_update` BEFORE UPDATE ON `files` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `intake_tests_no_deleted_insert` BEFORE INSERT ON `intake_tests` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `intake_tests_no_deleted_update` BEFORE UPDATE ON `intake_tests` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `jobs_no_deleted_insert` BEFORE INSERT ON `jobs` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `jobs_no_deleted_update` BEFORE UPDATE ON `jobs` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `notifications_no_deleted_insert` BEFORE INSERT ON `notifications` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `notifications_no_deleted_update` BEFORE UPDATE ON `notifications` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `products_no_deleted_insert` BEFORE INSERT ON `products` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `products_no_deleted_update` BEFORE UPDATE ON `products` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `publication_posts_no_deleted_insert` BEFORE INSERT ON `publication_posts` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `publication_posts_no_deleted_update` BEFORE UPDATE ON `publication_posts` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `recipes_no_deleted_insert` BEFORE INSERT ON `recipes` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `recipes_no_deleted_update` BEFORE UPDATE ON `recipes` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `registration_profiles_no_deleted_insert` BEFORE INSERT ON `registration_profiles` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `registration_profiles_no_deleted_update` BEFORE UPDATE ON `registration_profiles` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `reward_events_no_deleted_insert` BEFORE INSERT ON `reward_events` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `reward_events_no_deleted_update` BEFORE UPDATE ON `reward_events` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `rules_no_deleted_insert` BEFORE INSERT ON `rules` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `rules_no_deleted_update` BEFORE UPDATE ON `rules` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `studio_mail_members_no_deleted_insert` BEFORE INSERT ON `studio_mail_members` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `studio_mail_members_no_deleted_update` BEFORE UPDATE ON `studio_mail_members` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `tasks_no_deleted_insert` BEFORE INSERT ON `tasks` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `tasks_no_deleted_update` BEFORE UPDATE ON `tasks` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `video_edits_no_deleted_insert` BEFORE INSERT ON `video_edits` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `video_edits_no_deleted_update` BEFORE UPDATE ON `video_edits` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `video_ideas_no_deleted_insert` BEFORE INSERT ON `video_ideas` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `video_ideas_no_deleted_update` BEFORE UPDATE ON `video_ideas` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `video_plans_no_deleted_insert` BEFORE INSERT ON `video_plans` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `video_plans_no_deleted_update` BEFORE UPDATE ON `video_plans` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `video_renders_no_deleted_insert` BEFORE INSERT ON `video_renders` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;

--> statement-breakpoint
CREATE TRIGGER `video_renders_no_deleted_update` BEFORE UPDATE ON `video_renders` WHEN NEW.client_id IS NOT NULL AND EXISTS(SELECT 1 FROM client_deletions WHERE client_id=NEW.client_id) BEGIN SELECT RAISE(ABORT, 'client_deleted'); END;
