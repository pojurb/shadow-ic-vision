ALTER TABLE `evidence` ADD `polarity` text DEFAULT 'inconclusive' NOT NULL;--> statement-breakpoint
ALTER TABLE `evidence` ADD `delta_vs_threshold` real;--> statement-breakpoint
ALTER TABLE `evidence` ADD `polarity_method` text DEFAULT 'no_contract' NOT NULL;