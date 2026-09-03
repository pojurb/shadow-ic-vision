CREATE TABLE `source_adequacy_assessments` (
	`assumption_id` text PRIMARY KEY NOT NULL,
	`classification` text NOT NULL,
	`reasoning` text NOT NULL,
	`contract_fingerprint` text NOT NULL,
	`assessed_by` text DEFAULT 'user' NOT NULL,
	`assessed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`assumption_id`) REFERENCES `assumptions`(`id`) ON UPDATE no action ON DELETE cascade
);
