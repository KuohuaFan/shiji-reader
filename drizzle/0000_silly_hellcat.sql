CREATE TABLE `chapter_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`volume` int NOT NULL,
	`status` enum('pending','in_review','reviewed') NOT NULL DEFAULT 'pending',
	`reviewerId` int,
	`reviewerName` varchar(120),
	`notes` text,
	`reviewedAt` bigint,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `chapter_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `chapter_review_volume_idx` UNIQUE(`volume`)
);
--> statement-breakpoint
CREATE TABLE `correction_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportCode` varchar(24) NOT NULL,
	`volume` int NOT NULL,
	`chapterTitle` varchar(120) NOT NULL,
	`layer` enum('original','translation') NOT NULL,
	`sectionIndex` int,
	`blockIndex` int,
	`selectedText` text,
	`suggestion` text NOT NULL,
	`reason` enum('typo','translation','omission','punctuation','other') NOT NULL,
	`evidence` text,
	`reporterName` varchar(120),
	`reporterEmail` varchar(320),
	`status` enum('pending','reviewing','accepted','rejected') NOT NULL DEFAULT 'pending',
	`reviewNote` text,
	`reviewedBy` int,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	`resolvedAt` bigint,
	CONSTRAINT `correction_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `correction_reports_reportCode_unique` UNIQUE(`reportCode`)
);
--> statement-breakpoint
CREATE TABLE `translation_revisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`volume` int NOT NULL,
	`sectionIndex` int NOT NULL,
	`blockIndex` int NOT NULL,
	`originalTranslation` text NOT NULL,
	`revisedTranslation` text NOT NULL,
	`rationale` text,
	`reviewerId` int NOT NULL,
	`reviewerName` varchar(120),
	`published` int NOT NULL DEFAULT 0,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `translation_revisions_id` PRIMARY KEY(`id`),
	CONSTRAINT `translation_revision_block_idx` UNIQUE(`volume`,`sectionIndex`,`blockIndex`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
