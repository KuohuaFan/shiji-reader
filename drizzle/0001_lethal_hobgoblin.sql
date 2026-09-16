CREATE TABLE `event_ledger_analyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artifactCode` varchar(32) NOT NULL,
	`title` varchar(240) NOT NULL,
	`category` enum('政治','歷史','法制','國際','社會','經濟') NOT NULL,
	`jurisdiction` varchar(120) NOT NULL,
	`eventDate` varchar(40) NOT NULL,
	`status` enum('ai_draft','reviewed','published') NOT NULL DEFAULT 'ai_draft',
	`inputSnapshot` text NOT NULL,
	`outputSnapshot` text NOT NULL,
	`promptSummary` text NOT NULL,
	`promptHash` varchar(64) NOT NULL,
	`sourceSnapshotHash` varchar(64) NOT NULL,
	`model` varchar(80) NOT NULL,
	`analyzedAt` bigint NOT NULL,
	`reviewedBy` int,
	`reviewNote` text,
	`reviewedAt` bigint,
	`publishedAt` bigint,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `event_ledger_analyses_id` PRIMARY KEY(`id`),
	CONSTRAINT `event_ledger_analyses_artifactCode_unique` UNIQUE(`artifactCode`)
);
--> statement-breakpoint
CREATE TABLE `event_ledger_outcomes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`analysisId` int NOT NULL,
	`horizonDays` int NOT NULL,
	`outcome` enum('occurred','not_occurred','indeterminate') NOT NULL,
	`resolutionNote` text NOT NULL,
	`brierScoreMicros` int,
	`resolvedBy` int NOT NULL,
	`resolvedAt` bigint NOT NULL,
	CONSTRAINT `event_ledger_outcomes_id` PRIMARY KEY(`id`),
	CONSTRAINT `event_ledger_outcome_idx` UNIQUE(`analysisId`,`horizonDays`)
);
--> statement-breakpoint
CREATE TABLE `event_ledger_revisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`analysisId` int NOT NULL,
	`revisionNumber` int NOT NULL,
	`contentSnapshot` text NOT NULL,
	`revisionNote` text NOT NULL,
	`editorId` int NOT NULL,
	`editorName` varchar(120),
	`createdAt` bigint NOT NULL,
	CONSTRAINT `event_ledger_revisions_id` PRIMARY KEY(`id`),
	CONSTRAINT `event_ledger_revision_idx` UNIQUE(`analysisId`,`revisionNumber`)
);
