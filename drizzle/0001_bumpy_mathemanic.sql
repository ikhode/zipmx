ALTER TABLE `drivers` ADD `base_fare` real DEFAULT 25;--> statement-breakpoint
ALTER TABLE `drivers` ADD `cost_per_km` real DEFAULT 10;--> statement-breakpoint
ALTER TABLE `drivers` ADD `cost_per_minute` real DEFAULT 2;