ALTER TABLE `evidence` ADD `assurance_level` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `source_snapshots` ADD `assurance_level` text DEFAULT 'unknown' NOT NULL;