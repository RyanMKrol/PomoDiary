export const TAGS = [
  {
    label: "Deep work",
    color: "oklch(0.58 0.20 30)",
    words: [
      "wrote",
      "writing",
      "built",
      "build",
      "rewrote",
      "designed",
      "design",
      "code",
      "coded",
      "shipped",
      "drafted",
      "draft",
      "fixed",
      "refactor",
      "paired",
      "bug",
      "spec",
      "doc",
    ],
  },
  {
    label: "Admin",
    color: "oklch(0.58 0.13 250)",
    words: [
      "invoice",
      "expenses",
      "admin",
      "paperwork",
      "forms",
      "tax",
      "booking",
      "booked",
      "scheduling",
      "filed",
      "receipts",
      "hr",
    ],
  },
  {
    label: "Meetings",
    color: "oklch(0.58 0.15 305)",
    words: [
      "meeting",
      "standup",
      "stand-up",
      "call",
      "review",
      "1:1",
      "one-on-one",
      "sync",
      "interview",
      "workshop",
      "presentation",
      "demo",
    ],
  },
  {
    label: "Comms",
    color: "oklch(0.60 0.14 62)",
    words: [
      "slack",
      "email",
      "emails",
      "inbox",
      "replied",
      "reply",
      "messages",
      "dm",
      "thread",
      "followed up",
      "follow-up",
      "comments",
    ],
  },
  {
    label: "Learning",
    color: "oklch(0.58 0.14 155)",
    words: [
      "read",
      "reading",
      "learned",
      "learning",
      "course",
      "tutorial",
      "research",
      "studied",
      "docs",
      "article",
      "paper",
      "watched",
    ],
  },
  {
    label: "Errands",
    color: "oklch(0.58 0.10 200)",
    words: [
      "gym",
      "lunch",
      "shopping",
      "errand",
      "errands",
      "walk",
      "school run",
      "laundry",
      "cooked",
      "cleaning",
      "travel",
      "commute",
      "appointment",
    ],
  },
  {
    label: "Rest",
    color: "oklch(0.62 0.06 130)",
    words: [
      "break",
      "rest",
      "nap",
      "coffee",
      "tea",
      "sat",
      "garden",
      "music",
      "stretch",
      "breathe",
      "offline",
    ],
  },
  {
    label: "Lost it",
    color: "oklch(0.42 0.012 40)",
    words: [
      "scrolling",
      "twitter",
      "x",
      "youtube",
      "reddit",
      "distracted",
      "procrastin",
      "not sure",
      "no idea",
      "nothing",
      "wandered",
      "doomscroll",
      "lost",
    ],
  },
];

export const UNFILED_COLOR = "oklch(0.72 0.012 40)";

/** Grid/vine colour for entries whose tag is a user-typed away label (or any
 *  other tag outside the fixed vocabulary): a muted amber in the away band. */
export const CUSTOM_AWAY_COLOR = "oklch(0.45 0.06 62)";

export function tagColor(label: string): string {
  const tag = TAGS.find((t) => t.label === label);
  if (tag) return tag.color;

  const away = Object.values(AWAY).find((a) => a.tag === label);
  if (away) return away.color;

  if (label === "Unfiled") return UNFILED_COLOR;

  // Entries store only the tag string, so a custom away label (or a hand-
  // edited tag) is any label we do not recognise.
  return CUSTOM_AWAY_COLOR;
}

export const AWAY = {
  sleep: {
    tag: "Asleep",
    color: "oklch(0.38 0.055 275)",
    end: "I'm awake",
    title: "ASLEEP.",
    note: "The clock keeps your place. Every hour lands as sleep.",
    bullet: "Asleep",
  },
  work: {
    tag: "At work",
    color: "oklch(0.50 0.075 235)",
    end: "I'm back",
    title: "AT WORK.",
    note: "Away hours log themselves. Tidy them up later if you like.",
    bullet: "At work",
  },
  gym: {
    tag: "At the gym",
    color: "oklch(0.50 0.09 120)",
    end: "I'm back",
    title: "AT THE GYM.",
    note: "Away hours log themselves. Tidy them up later if you like.",
    bullet: "At the gym",
  },
};

export interface AwayConfig {
  tag: string;
  color: string;
  end: string;
  title: string;
  note: string;
  bullet: string;
}

/** Resolves the away card/entry config for a kind, deriving one from the
 *  user-typed label when the kind is "custom". */
export function awayConfig(
  kind: keyof typeof AWAY | "custom",
  label?: string | null,
): AwayConfig {
  if (kind === "custom") {
    const l = (label ?? "").trim() || "Away";
    return {
      tag: l,
      color: CUSTOM_AWAY_COLOR,
      end: "I'm back",
      title: `${l.toUpperCase()}.`,
      note: "Away hours log themselves. Tidy them up later if you like.",
      bullet: l,
    };
  }
  return AWAY[kind];
}

export const FEELS = ["Charged", "Steady", "Scattered", "Drained"];

export const INTENTS = {
  yes: "On purpose",
  no: "Got away",
};

export const PHRASES = [
  ["The hour is ripening.", "Come back when it chimes"],
  ["Still on the vine.", "Nothing to report yet"],
  ["Quietly counting.", "You work, I'll keep the clock"],
  ["Time passes either way.", "This bit you'll remember"],
  ["Growing on you.", "One hour, then one honest note"],
];

export function inferTag(bullets: string[]): string | null {
  const text = bullets.join(" ").toLowerCase();
  if (text.trim().length < 3) return null;

  let best: string | null = null;
  let bestScore = 0;

  TAGS.forEach((t) => {
    let score = 0;
    t.words.forEach((w) => {
      if (text.includes(w)) {
        score += w.length > 5 ? 2 : 1;
      }
    });
    if (score > bestScore) {
      bestScore = score;
      best = t.label;
    }
  });

  return best;
}
