CREATE TABLE `decisions_new` (
	`id` text PRIMARY KEY NOT NULL,
	`thesis_id` text NOT NULL,
	`outcome` text NOT NULL,
	`action` text,
	`rationale` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`thesis_id`) REFERENCES `theses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `decisions_new` (`id`, `thesis_id`, `outcome`, `action`, `rationale`, `created_at`)
SELECT
  `id`,
  `thesis_id`,
  CASE WHEN instr(`decision`, ': ') > 0
       THEN substr(`decision`, 1, instr(`decision`, ': ') - 1)
       ELSE `decision` END,
  CASE WHEN instr(`decision`, ': ') > 0
       THEN substr(`decision`, instr(`decision`, ': ') + 2)
       ELSE NULL END,
  `rationale`,
  CASE WHEN `created_at` NOT LIKE '%T%'
       THEN replace(`created_at`, ' ', 'T') || '.000Z'
       ELSE `created_at` END
FROM `decisions`;
--> statement-breakpoint
DROP TABLE `decisions`;
--> statement-breakpoint
ALTER TABLE `decisions_new` RENAME TO `decisions`;
--> statement-breakpoint
CREATE INDEX `decisions_thesis_created_idx` ON `decisions` (`thesis_id`,`created_at`);
