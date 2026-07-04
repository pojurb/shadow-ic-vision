CREATE TABLE `research_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`assumption_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`error` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`lease_expires_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`assumption_id`) REFERENCES `assumptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `research_jobs_assumption_id_unique` ON `research_jobs` (`assumption_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_assumptions` (
	`id` text PRIMARY KEY NOT NULL,
	`thesis_id` text NOT NULL,
	`statement` text NOT NULL,
	`status` text DEFAULT 'untested' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`thesis_id`) REFERENCES `theses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_assumptions`("id", "thesis_id", "statement", "status", "created_at", "updated_at") SELECT "id", "thesis_id", "statement", CASE "status" WHEN 'pending' THEN 'untested' ELSE "status" END, "created_at", "updated_at" FROM `assumptions`;--> statement-breakpoint
DROP TABLE `assumptions`;--> statement-breakpoint
ALTER TABLE `__new_assumptions` RENAME TO `assumptions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_theses` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text,
	`draft_message_id` text,
	`ticker` text,
	`company_name` text,
	`market` text,
	`core_belief` text,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`draft_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_theses`("id", "conversation_id", "draft_message_id", "ticker", "company_name", "market", "core_belief", "title", "description", "status", "created_at", "updated_at") SELECT "id", "conversation_id", NULL, NULL, NULL, NULL, NULL, "title", "description", CASE "status" WHEN 'closed' THEN 'archived' ELSE 'active' END, "created_at", "updated_at" FROM `theses`;--> statement-breakpoint
DROP TABLE `theses`;--> statement-breakpoint
ALTER TABLE `__new_theses` RENAME TO `theses`;--> statement-breakpoint
CREATE UNIQUE INDEX `theses_conversation_id_unique` ON `theses` (`conversation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `theses_draft_message_id_unique` ON `theses` (`draft_message_id`);--> statement-breakpoint
ALTER TABLE `evidence` ADD `source_tier` text DEFAULT 'official' NOT NULL;--> statement-breakpoint
ALTER TABLE `evidence` ADD `source_name` text DEFAULT 'Unknown source' NOT NULL;--> statement-breakpoint
ALTER TABLE `evidence` ADD `publish_date` text;--> statement-breakpoint
ALTER TABLE `evidence` ADD `impact_summary` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `structured_payload` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `validation_outcome` text DEFAULT 'not_applicable' NOT NULL;
