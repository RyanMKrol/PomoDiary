CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"from" timestamp with time zone NOT NULL,
	"to" timestamp with time zone NOT NULL,
	"tag" text NOT NULL,
	"feel" text NOT NULL,
	"intent" text,
	"bullets" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timer_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"mode" text NOT NULL,
	"hour_start" timestamp with time zone NOT NULL,
	"paused_remaining" integer,
	"chime_from" timestamp with time zone,
	"chime_to" timestamp with time zone,
	"away_kind" text,
	"away_since" timestamp with time zone,
	"draft_bullets" jsonb NOT NULL,
	"draft_tag" text,
	"draft_feel" text,
	"draft_intent" text,
	"phrase_idx" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"session_minutes" integer DEFAULT 60 NOT NULL,
	"sound_on" boolean DEFAULT true NOT NULL,
	"chime_volume" real DEFAULT 0.8 NOT NULL,
	"pause_after_log" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "entries_user_id_from_idx" ON "entries" USING btree ("user_id","from");