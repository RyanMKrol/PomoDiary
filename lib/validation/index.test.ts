import { describe, it, expect } from "vitest";

import {
  LIMITS,
  bulletsSchema,
  tagSchema,
  awayLabelSchema,
  feelSchema,
  timerActionSchema,
  settingsPatchSchema,
  entryPatchSchema,
} from "./index";

describe("bulletsSchema", () => {
  it("accepts a bullet at the max length", () => {
    const bullet = "a".repeat(LIMITS.MAX_BULLET_LENGTH);
    expect(bulletsSchema.safeParse([bullet]).success).toBe(true);
  });

  it("rejects a bullet one character over the max length", () => {
    const bullet = "a".repeat(LIMITS.MAX_BULLET_LENGTH + 1);
    expect(bulletsSchema.safeParse([bullet]).success).toBe(false);
  });

  it("accepts the max number of bullets", () => {
    const bullets = Array.from(
      { length: LIMITS.MAX_BULLETS_PER_ENTRY },
      (_, i) => `bullet ${i}`,
    );
    expect(bulletsSchema.safeParse(bullets).success).toBe(true);
  });

  it("rejects one bullet over the max count", () => {
    const bullets = Array.from(
      { length: LIMITS.MAX_BULLETS_PER_ENTRY + 1 },
      (_, i) => `bullet ${i}`,
    );
    expect(bulletsSchema.safeParse(bullets).success).toBe(false);
  });
});

describe("tagSchema", () => {
  it("accepts a known tag label", () => {
    expect(tagSchema.safeParse("Deep work").success).toBe(true);
  });

  it("accepts the away tags and Unfiled", () => {
    expect(tagSchema.safeParse("Asleep").success).toBe(true);
    expect(tagSchema.safeParse("At work").success).toBe(true);
    expect(tagSchema.safeParse("At the gym").success).toBe(true);
    expect(tagSchema.safeParse("Unfiled").success).toBe(true);
  });

  it("accepts an arbitrary bounded string (custom away labels)", () => {
    expect(tagSchema.safeParse("Not a real tag").success).toBe(true);
    expect(tagSchema.safeParse("Travelling").success).toBe(true);
    expect(tagSchema.safeParse("a".repeat(LIMITS.MAX_TAG_LENGTH)).success).toBe(
      true,
    );
  });

  it("rejects empty and whitespace-only tags", () => {
    expect(tagSchema.safeParse("").success).toBe(false);
    expect(tagSchema.safeParse("   ").success).toBe(false);
  });

  it("rejects a tag one character over the max length", () => {
    expect(
      tagSchema.safeParse("a".repeat(LIMITS.MAX_TAG_LENGTH + 1)).success,
    ).toBe(false);
  });
});

describe("awayLabelSchema", () => {
  it("accepts a bounded non-empty label and trims it", () => {
    const result = awayLabelSchema.safeParse("  Travelling  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("Travelling");
    }
    expect(
      awayLabelSchema.safeParse("a".repeat(LIMITS.MAX_TAG_LENGTH)).success,
    ).toBe(true);
  });

  it("rejects empty, whitespace-only, and over-long labels", () => {
    expect(awayLabelSchema.safeParse("").success).toBe(false);
    expect(awayLabelSchema.safeParse("   ").success).toBe(false);
    expect(
      awayLabelSchema.safeParse("a".repeat(LIMITS.MAX_TAG_LENGTH + 1)).success,
    ).toBe(false);
  });
});

describe("feelSchema", () => {
  it("accepts a known feel and the empty placeholder", () => {
    expect(feelSchema.safeParse("Charged").success).toBe(true);
    expect(feelSchema.safeParse("—").success).toBe(true);
  });

  it("rejects an unknown feel", () => {
    expect(feelSchema.safeParse("Ecstatic").success).toBe(false);
  });
});

describe("timerActionSchema", () => {
  it("accepts a known action type", () => {
    expect(timerActionSchema.safeParse({ type: "resume" }).success).toBe(true);
    expect(
      timerActionSchema.safeParse({
        type: "log",
        payload: { bullets: [], tag: null, feel: null, intent: null },
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown action type", () => {
    expect(timerActionSchema.safeParse({ type: "notAnAction" }).success).toBe(
      false,
    );
  });

  it("rejects the removed pause action", () => {
    expect(timerActionSchema.safeParse({ type: "pause" }).success).toBe(false);
  });

  it("accepts an empty draftUpdate patch", () => {
    expect(
      timerActionSchema.safeParse({ type: "draftUpdate", patch: {} }).success,
    ).toBe(true);
  });

  it("accepts awayStart for every fixed kind without a label", () => {
    for (const kind of ["sleep", "work", "gym"]) {
      expect(
        timerActionSchema.safeParse({ type: "awayStart", kind }).success,
      ).toBe(true);
    }
  });

  it("accepts a custom awayStart with a label", () => {
    expect(
      timerActionSchema.safeParse({
        type: "awayStart",
        kind: "custom",
        label: "Travelling",
      }).success,
    ).toBe(true);
  });

  it("rejects a custom awayStart without a label", () => {
    expect(
      timerActionSchema.safeParse({ type: "awayStart", kind: "custom" })
        .success,
    ).toBe(false);
  });

  it("rejects a custom awayStart with an empty or whitespace label", () => {
    expect(
      timerActionSchema.safeParse({
        type: "awayStart",
        kind: "custom",
        label: "",
      }).success,
    ).toBe(false);
    expect(
      timerActionSchema.safeParse({
        type: "awayStart",
        kind: "custom",
        label: "   ",
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown away kind", () => {
    expect(
      timerActionSchema.safeParse({ type: "awayStart", kind: "holiday" })
        .success,
    ).toBe(false);
  });
});

describe("settingsPatchSchema", () => {
  it("accepts chimeVolume at the boundaries", () => {
    expect(settingsPatchSchema.safeParse({ chimeVolume: 0 }).success).toBe(
      true,
    );
    expect(settingsPatchSchema.safeParse({ chimeVolume: 1 }).success).toBe(
      true,
    );
  });

  it("rejects chimeVolume just outside the boundaries", () => {
    expect(settingsPatchSchema.safeParse({ chimeVolume: -0.1 }).success).toBe(
      false,
    );
    expect(settingsPatchSchema.safeParse({ chimeVolume: 1.1 }).success).toBe(
      false,
    );
  });

  it("accepts boolean fields", () => {
    expect(
      settingsPatchSchema.safeParse({ soundOn: false, pauseAfterLog: true })
        .success,
    ).toBe(true);
  });

  it("strips the removed sessionMinutes key instead of keeping it", () => {
    const result = settingsPatchSchema.safeParse({ sessionMinutes: 45 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("sessionMinutes");
    }
  });
});

describe("entryPatchSchema", () => {
  it("accepts a patch with at least one key", () => {
    expect(entryPatchSchema.safeParse({ tag: "Admin" }).success).toBe(true);
  });

  it("rejects an empty patch", () => {
    expect(entryPatchSchema.safeParse({}).success).toBe(false);
  });
});
