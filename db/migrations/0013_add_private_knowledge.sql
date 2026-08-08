CREATE TABLE `knowledge_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`document_hash` text NOT NULL,
	`claim_text` text NOT NULL,
	`classification` text NOT NULL,
	`locator` text NOT NULL,
	`quote_hash` text NOT NULL,
	`status` text DEFAULT 'candidate' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`document_hash`) REFERENCES `knowledge_documents`(`document_hash`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `knowledge_claims_document_hash_idx` ON `knowledge_claims` (`document_hash`);--> statement-breakpoint
CREATE TABLE `knowledge_documents` (
	`document_hash` text PRIMARY KEY NOT NULL,
	`relative_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`status` text NOT NULL,
	`duplicate_of_hash` text,
	`extraction_path` text,
	`batch_path` text,
	`last_error` text,
	`error_code` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`provider` text,
	`model_id` text,
	`prompt_version` text,
	`processed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `knowledge_documents_relative_path_idx` ON `knowledge_documents` (`relative_path`);--> statement-breakpoint
CREATE INDEX `knowledge_documents_status_idx` ON `knowledge_documents` (`status`);--> statement-breakpoint
CREATE TABLE `knowledge_graph_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`document_hash` text NOT NULL,
	`source_node_id` text NOT NULL,
	`target_node_id` text NOT NULL,
	`edge_type` text NOT NULL,
	`source_claim_ids` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'candidate' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`document_hash`) REFERENCES `knowledge_documents`(`document_hash`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_node_id`) REFERENCES `knowledge_graph_nodes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`target_node_id`) REFERENCES `knowledge_graph_nodes`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `knowledge_graph_edges_document_hash_idx` ON `knowledge_graph_edges` (`document_hash`);--> statement-breakpoint
CREATE INDEX `knowledge_graph_edges_source_node_idx` ON `knowledge_graph_edges` (`source_node_id`);--> statement-breakpoint
CREATE INDEX `knowledge_graph_edges_target_node_idx` ON `knowledge_graph_edges` (`target_node_id`);--> statement-breakpoint
CREATE TABLE `knowledge_graph_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`document_hash` text NOT NULL,
	`source_claim_id` text,
	`node_type` text NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'candidate' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`document_hash`) REFERENCES `knowledge_documents`(`document_hash`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_claim_id`) REFERENCES `knowledge_claims`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `knowledge_graph_nodes_document_hash_idx` ON `knowledge_graph_nodes` (`document_hash`);--> statement-breakpoint
CREATE INDEX `knowledge_graph_nodes_source_claim_idx` ON `knowledge_graph_nodes` (`source_claim_id`);--> statement-breakpoint
CREATE TABLE `knowledge_processing_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`stage` text NOT NULL,
	`document_hash` text,
	`status` text NOT NULL,
	`provider` text,
	`model_id` text,
	`prompt_version` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`duration_ms` integer,
	`error_code` text,
	`error` text,
	FOREIGN KEY (`document_hash`) REFERENCES `knowledge_documents`(`document_hash`) ON UPDATE no action ON DELETE cascade
);
