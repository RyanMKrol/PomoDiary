import { describe, it, expect } from "vitest";
import {
  TAGS,
  AWAY,
  FEELS,
  INTENTS,
  PHRASES,
  UNFILED_COLOR,
  CUSTOM_AWAY_COLOR,
  awayConfig,
  tagColor,
  inferTag,
} from "./index";

describe("domain", () => {
  describe("TAGS", () => {
    it("has the 7 life-centric tags in order", () => {
      expect(TAGS).toHaveLength(7);
      expect(TAGS.map((t) => t.label)).toEqual([
        "Admin",
        "Learning",
        "Errands",
        "Rest",
        "Leisure",
        "Social",
        "Chores",
      ]);
    });

    it("has exact OKLCH colours", () => {
      expect(TAGS[0].color).toBe("oklch(0.58 0.13 250)");
      expect(TAGS[1].color).toBe("oklch(0.58 0.14 155)");
      expect(TAGS[2].color).toBe("oklch(0.58 0.10 200)");
      expect(TAGS[3].color).toBe("oklch(0.62 0.06 130)");
      expect(TAGS[4].color).toBe("oklch(0.58 0.15 305)");
      expect(TAGS[5].color).toBe("oklch(0.60 0.14 62)");
      expect(TAGS[6].color).toBe("oklch(0.48 0.09 45)");
    });

    it("includes exact keywords including multi-word phrases", () => {
      // Multi-word phrases in Errands
      expect(TAGS[2].words).toContain("post office");
      expect(TAGS[2].words).toContain("school run");
      // Hyphenated keyword in Rest
      expect(TAGS[3].words).toContain("lie-in");
      // Short household keywords in Chores
      expect(TAGS[6].words).toContain("diy");
      expect(TAGS[6].words).toContain("laundry");
    });
  });

  describe("UNFILED_COLOR", () => {
    it("has the correct OKLCH value", () => {
      expect(UNFILED_COLOR).toBe("oklch(0.72 0.012 40)");
    });
  });

  describe("CUSTOM_AWAY_COLOR", () => {
    it("has the correct OKLCH value", () => {
      expect(CUSTOM_AWAY_COLOR).toBe("oklch(0.45 0.06 62)");
    });
  });

  describe("tagColor", () => {
    it("returns the tag's color for a tag label", () => {
      expect(tagColor("Leisure")).toBe("oklch(0.58 0.15 305)");
      expect(tagColor("Social")).toBe("oklch(0.60 0.14 62)");
      expect(tagColor("Chores")).toBe("oklch(0.48 0.09 45)");
    });

    it("returns the away mode color for Asleep", () => {
      expect(tagColor("Asleep")).toBe("oklch(0.38 0.055 275)");
    });

    it("returns the away mode color for At work", () => {
      expect(tagColor("At work")).toBe("oklch(0.50 0.075 235)");
    });

    it("returns the away mode color for At the gym", () => {
      expect(tagColor("At the gym")).toBe("oklch(0.50 0.09 120)");
    });

    it("returns UNFILED_COLOR only for the exact Unfiled label", () => {
      expect(tagColor("Unfiled")).toBe(UNFILED_COLOR);
    });

    it("returns CUSTOM_AWAY_COLOR for unknown labels (custom away tags)", () => {
      expect(tagColor("Unknown")).toBe(CUSTOM_AWAY_COLOR);
      expect(tagColor("Travelling")).toBe(CUSTOM_AWAY_COLOR);
    });

    it("treats retired work-era tags as unknown labels (amber fallback)", () => {
      // Entries logged under the old vocabulary keep their text and render
      // via the unknown-tag fallback, like custom away labels.
      expect(tagColor("Deep work")).toBe(CUSTOM_AWAY_COLOR);
      expect(tagColor("Meetings")).toBe(CUSTOM_AWAY_COLOR);
      expect(tagColor("Comms")).toBe(CUSTOM_AWAY_COLOR);
      expect(tagColor("Lost it")).toBe(CUSTOM_AWAY_COLOR);
    });
  });

  describe("AWAY", () => {
    it("has sleep config with exact values", () => {
      expect(AWAY.sleep).toEqual({
        tag: "Asleep",
        color: "oklch(0.38 0.055 275)",
        end: "I'm awake",
        title: "ASLEEP.",
        note: "The clock keeps your place. Every hour lands as sleep.",
        bullet: "Asleep",
      });
    });

    it("has work config with exact values", () => {
      expect(AWAY.work).toEqual({
        tag: "At work",
        color: "oklch(0.50 0.075 235)",
        end: "I'm back",
        title: "AT WORK.",
        note: "Away hours log themselves. Tidy them up later if you like.",
        bullet: "At work",
      });
    });

    it("has gym config with exact values", () => {
      expect(AWAY.gym).toEqual({
        tag: "At the gym",
        color: "oklch(0.50 0.09 120)",
        end: "I'm back",
        title: "AT THE GYM.",
        note: "Away hours log themselves. Tidy them up later if you like.",
        bullet: "At the gym",
      });
    });
  });

  describe("awayConfig", () => {
    it("returns the AWAY entry verbatim for fixed kinds", () => {
      expect(awayConfig("sleep")).toBe(AWAY.sleep);
      expect(awayConfig("work")).toBe(AWAY.work);
      expect(awayConfig("gym")).toBe(AWAY.gym);
    });

    it("ignores a label passed alongside a fixed kind", () => {
      expect(awayConfig("gym", "Travelling")).toBe(AWAY.gym);
    });

    it("derives a config from the label for a custom kind", () => {
      expect(awayConfig("custom", "Travelling")).toEqual({
        tag: "Travelling",
        color: CUSTOM_AWAY_COLOR,
        end: "I'm back",
        title: "TRAVELLING.",
        note: "Away hours log themselves. Tidy them up later if you like.",
        bullet: "Travelling",
      });
    });

    it("trims the label and uppercases the title", () => {
      const cfg = awayConfig("custom", "  at the dentist  ");
      expect(cfg.tag).toBe("at the dentist");
      expect(cfg.bullet).toBe("at the dentist");
      expect(cfg.title).toBe("AT THE DENTIST.");
    });

    it("falls back to Away for a missing or empty custom label", () => {
      for (const label of [undefined, null, "", "   "]) {
        const cfg = awayConfig("custom", label);
        expect(cfg.tag).toBe("Away");
        expect(cfg.bullet).toBe("Away");
        expect(cfg.title).toBe("AWAY.");
        expect(cfg.color).toBe(CUSTOM_AWAY_COLOR);
        expect(cfg.end).toBe("I'm back");
      }
    });
  });

  describe("FEELS", () => {
    it("has the four feeling labels", () => {
      expect(FEELS).toEqual(["Charged", "Steady", "Scattered", "Drained"]);
    });
  });

  describe("INTENTS", () => {
    it("maps yes to Planned", () => {
      expect(INTENTS.yes).toBe("Planned");
    });

    it("maps no to Unplanned", () => {
      expect(INTENTS.no).toBe("Unplanned");
    });

    it("maps mixed to Mixed", () => {
      expect(INTENTS.mixed).toBe("Mixed");
    });

    it("has exactly the three intent keys", () => {
      expect(Object.keys(INTENTS)).toEqual(["yes", "no", "mixed"]);
    });
  });

  describe("PHRASES", () => {
    it("has 5 phrase pairs", () => {
      expect(PHRASES).toHaveLength(5);
    });

    it("has exact phrase text", () => {
      expect(PHRASES[0]).toEqual([
        "The hour is ripening.",
        "Come back when it chimes",
      ]);
      expect(PHRASES[1]).toEqual([
        "Still on the vine.",
        "Nothing to report yet",
      ]);
      expect(PHRASES[2]).toEqual([
        "Quietly counting.",
        "You work, I'll keep the clock",
      ]);
      expect(PHRASES[3]).toEqual([
        "Time passes either way.",
        "This bit you'll remember",
      ]);
      expect(PHRASES[4]).toEqual([
        "Growing on you.",
        "One hour, then one honest note",
      ]);
    });
  });

  describe("inferTag", () => {
    it("returns null for text shorter than 3 characters", () => {
      expect(inferTag(["ab"])).toBeNull();
      expect(inferTag([""])).toBeNull();
      expect(inferTag(["  "])).toBeNull();
    });

    it("returns null when no keywords match", () => {
      expect(inferTag(["qwerty"])).toBeNull();
      expect(inferTag(["zzzz"])).toBeNull();
    });

    it("returns the matching tag for simple keywords", () => {
      expect(inferTag(["did the laundry and cooked dinner"])).toBe("Chores");
      expect(inferTag(["played some games and watched a film"])).toBe(
        "Leisure",
      );
    });

    it("applies +2 weighting for keywords longer than 5 characters", () => {
      // "research" is 8 chars, should score 2
      expect(inferTag(["research"])).toBe("Learning");
    });

    it("applies +1 weighting for keywords 5 characters or shorter", () => {
      // "read" is 4 chars, should score 1
      expect(inferTag(["read", "read", "read"])).toBe("Learning");
    });

    it("distinguishes 5-char keywords (score 1) from 6-char keywords (score 2)", () => {
      // "break" is 5 chars (score 1), should match Rest
      expect(inferTag(["break"])).toBe("Rest");
      // "garden" is 6 chars (score 2), should also match Rest
      expect(inferTag(["garden"])).toBe("Rest");
    });

    it("counts each keyword only once even if it appears multiple times", () => {
      expect(inferTag(["read read read read"])).toBe("Learning");
    });

    it("uses substring matching (not word boundaries)", () => {
      // "rereading" contains "read" (score 1) and "reading" (score 2) —
      // neither is a standalone word in the text, both match as substrings.
      expect(inferTag(["rereading"])).toBe("Learning");
    });

    it("handles multi-word phrases like 'post office'", () => {
      expect(inferTag(["post office"])).toBe("Errands");
      expect(inferTag(["school run"])).toBe("Errands");
    });

    it("breaks ties by choosing the earlier category", () => {
      // "walk" (4 chars, score 1) matches Errands (index 2)
      // "book" (4 chars, score 1) matches Leisure (index 4)
      // Both score 1 — the earlier category (Errands) wins the tie.
      expect(inferTag(["walk book"])).toBe("Errands");
    });

    it("handles case insensitivity", () => {
      expect(inferTag(["LAUNDRY"])).toBe("Chores");
      expect(inferTag(["lAuNdRy"])).toBe("Chores");
    });

    it("joins bullets with spaces and handles raw text", () => {
      expect(inferTag(["Friends", "pub", "40 minutes"])).toBe("Social");
    });

    it("spot-check: returns Chores for 'did the laundry and cooked dinner'", () => {
      // From the acceptance criteria
      expect(inferTag(["did the laundry and cooked dinner"])).toBe("Chores");
    });

    it("spot-check: returns null for 'ab'", () => {
      // From the acceptance criteria
      expect(inferTag(["ab"])).toBeNull();
    });

    it("matches short two-character keywords in text >= 3 chars", () => {
      // "the tv" clears the 3-char floor and contains "tv" (Leisure), score 1
      expect(inferTag(["the tv"])).toBe("Leisure");
    });

    it("scores higher-value keywords appropriately", () => {
      // "scrolling" (9 chars, score 2) now lives in Leisure
      expect(inferTag(["scrolling"])).toBe("Leisure");
    });
  });
});
