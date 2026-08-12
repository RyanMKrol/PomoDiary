import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    from: timestamp("from", { withTimezone: true }).notNull(),
    to: timestamp("to", { withTimezone: true }).notNull(),
    tag: text("tag").notNull(),
    feel: text("feel").notNull(),
    intent: text("intent"),
    bullets: jsonb("bullets").$type<string[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("entries_user_id_from_idx").on(table.userId, table.from)],
);

export const timerState = pgTable("timer_state", {
  userId: text("user_id").primaryKey(),
  mode: text("mode").notNull(),
  hourStart: timestamp("hour_start", { withTimezone: true }).notNull(),
  chimeFrom: timestamp("chime_from", { withTimezone: true }),
  chimeTo: timestamp("chime_to", { withTimezone: true }),
  awayKind: text("away_kind"),
  awaySince: timestamp("away_since", { withTimezone: true }),
  draftBullets: jsonb("draft_bullets").$type<string[]>().notNull(),
  draftTag: text("draft_tag"),
  draftFeel: text("draft_feel"),
  draftIntent: text("draft_intent"),
  phraseIdx: integer("phrase_idx").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const userSettings = pgTable("user_settings", {
  userId: text("user_id").primaryKey(),
  soundOn: boolean("sound_on").notNull().default(true),
  chimeVolume: real("chime_volume").notNull().default(0.8),
  pauseAfterLog: boolean("pause_after_log").notNull().default(false),
});
