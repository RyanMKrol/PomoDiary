ALTER TABLE "user_settings" ALTER COLUMN "chime_volume" SET DEFAULT 1;--> statement-breakpoint
UPDATE "user_settings" SET "chime_volume" = 1 WHERE "chime_volume" = 0.8;
