CREATE TABLE `assumption_measurements` (
	`assumption_id` text PRIMARY KEY NOT NULL,
	`resolution` text DEFAULT 'legacy_unspecified' NOT NULL,
	`metric` text DEFAULT '' NOT NULL,
	`definition_variant` text DEFAULT '' NOT NULL,
	`operator` text DEFAULT 'none' NOT NULL,
	`threshold` real,
	`unit` text DEFAULT 'unspecified' NOT NULL,
	`time_basis` text DEFAULT 'unspecified' NOT NULL,
	`source_tags` text DEFAULT '[]' NOT NULL,
	`clarifying_question` text,
	`ambiguity_reason` text DEFAULT 'none' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`assumption_id`) REFERENCES `assumptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- M011 backfill, hand-appended (drizzle-kit generates DDL only).
--
-- Every pre-M011 assumption gets an explicit `legacy_unspecified` row so the
-- coverage ledger can distinguish "this thesis predates measurement contracts"
-- from "the model failed to produce one" — two states that would otherwise both
-- read as a missing row, and only one of which is the app's fault.
--
-- Consequence, deliberate rather than discovered later: every pre-M011 thesis
-- will report a suppressed confidence gate, because it genuinely has no
-- contract against which any claim could be checked. Saying that accurately is
-- the point.
--
-- Idempotent: `assumption_id` is the primary key.
INSERT OR IGNORE INTO `assumption_measurements` (`assumption_id`, `resolution`)
  SELECT `id`, 'legacy_unspecified' FROM `assumptions`;
