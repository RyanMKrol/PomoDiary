import { describe, it, expect } from "vitest";

import {
  LIMITS,
  bulletsSchema,
  tagSchema,
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
    expect(tagSchema.safeParse("Unfiled").success).toBe(true);
  });

  it("rejects an unknown tag label", () => {
    expect(tagSchema.safeParse("Not a real tag").success).toBe(false);
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
    expect(timerActionSchema.safeParse({ type: "pause" }).success).toBe(true);
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

  it("accepts an empty draftUpdate patch", () => {
    expect(
      timerActionSchema.safeParse({ type: "draftUpdate", patch: {} }).success,
    ).toBe(true);
  });
});

describe("settingsPatchSchema", () => {
  it("accepts sessionMinutes at the boundaries", () => {
    expect(
      settingsPatchSchema.safeParse({
        sessionMinutes: LIMITS.SESSION_MINUTES_MIN,
      }).success,
    ).toBe(true);
    expect(
      settingsPatchSchema.safeParse({
        sessionMinutes: LIMITS.SESSION_MINUTES_MAX,
      }).success,
    ).toBe(true);
  });

  it("rejects sessionMinutes just outside the boundaries", () => {
    expect(
      settingsPatchSchema.safeParse({
        sessionMinutes: LIMITS.SESSION_MINUTES_MIN - 1,
      }).success,
    ).toBe(false);
    expect(
      settingsPatchSchema.safeParse({
        sessionMinutes: LIMITS.SESSION_MINUTES_MAX + 1,
      }).success,
    ).toBe(false);
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
