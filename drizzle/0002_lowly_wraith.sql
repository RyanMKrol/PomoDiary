ALTER TABLE "timer_state" ADD COLUMN "away_label" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "recent_away_labels" jsonb DEFAULT '[]'::jsonb NOT NULL;