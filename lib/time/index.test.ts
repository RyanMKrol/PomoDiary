import { describe, it, expect } from "vitest";
import {
  fmtClock,
  dayKey,
  fmtDayTitle,
  fmtGridDayLabel,
  fmtTodayLabel,
  fmtAwayElapsed,
  padCount,
  fmtChimeRange,
  gridCellTitle,
  gridCellEmptyTitle,
} from "./index";

describe("time formatting", () => {
  // Use fixed timestamps for deterministic testing
  // August 10, 2025 2:14 PM local time
  const aug10_214pm = new Date(2025, 7, 10, 14, 14, 0).getTime();
  // August 10, 2025 3:14 PM local time
  const aug10_314pm = new Date(2025, 7, 10, 15, 14, 0).getTime();
  // August 9, 2025 (yesterday)
  const aug9 = new Date(2025, 7, 9, 12, 0, 0).getTime();
  // August 8, 2025 (2 days ago)
  const aug8 = new Date(2025, 7, 8, 12, 0, 0).getTime();

  describe("fmtClock", () => {
    it("formats time as 12-hour with no leading zero on hour", () => {
      expect(fmtClock(aug10_214pm)).toBe("2:14 PM");
    });

    it("formats 3 PM correctly", () => {
      expect(fmtClock(aug10_314pm)).toBe("3:14 PM");
    });

    it("formats morning time with AM", () => {
      const morning = new Date(2025, 7, 10, 9, 5, 0).getTime();
      expect(fmtClock(morning)).toBe("9:05 AM");
    });

    it("formats noon correctly", () => {
      const noon = new Date(2025, 7, 10, 12, 0, 0).getTime();
      expect(fmtClock(noon)).toBe("12:00 PM");
    });

    it("formats midnight correctly", () => {
      const midnight = new Date(2025, 7, 10, 0, 0, 0).getTime();
      expect(fmtClock(midnight)).toBe("12:00 AM");
    });
  });

  describe("dayKey", () => {
    it("returns a date string in toDateString format", () => {
      const key = dayKey(aug10_214pm);
      expect(key).toMatch(/^[A-Za-z]{3} [A-Za-z]{3} \d{2} \d{4}$/);
    });

    it("returns same day for different times on the same day", () => {
      const morning = new Date(2025, 7, 10, 8, 0, 0).getTime();
      const evening = new Date(2025, 7, 10, 20, 0, 0).getTime();
      expect(dayKey(morning)).toBe(dayKey(evening));
    });

    it("returns different days for different days", () => {
      expect(dayKey(aug10_214pm)).not.toBe(dayKey(aug9));
    });
  });

  describe("fmtDayTitle", () => {
    it("returns 'Today' when same day as now", () => {
      expect(fmtDayTitle(aug10_214pm, aug10_314pm)).toBe("Today");
    });

    it("returns long form for previous day", () => {
      const title = fmtDayTitle(aug9, aug10_214pm);
      expect(title).toMatch(/^[A-Za-z]+ \d+ [A-Za-z]{3}$/);
      // Should be Saturday 9 Aug
      expect(title).toContain("9");
      expect(title).toContain("Aug");
    });

    it("returns long form for 2 days ago", () => {
      const title = fmtDayTitle(aug8, aug10_214pm);
      expect(title).toMatch(/^[A-Za-z]+ \d+ [A-Za-z]{3}$/);
      expect(title).toContain("8");
      expect(title).toContain("Aug");
    });
  });

  describe("fmtGridDayLabel", () => {
    it("returns 'Today' for index 0", () => {
      expect(fmtGridDayLabel(aug10_214pm, 0)).toBe("Today");
    });

    it("returns 'Yesterday' for index 1", () => {
      expect(fmtGridDayLabel(aug9, 1)).toBe("Yesterday");
    });

    it("returns short form like 'Sat 8' for index >= 2", () => {
      const label = fmtGridDayLabel(aug8, 2);
      expect(label).toMatch(/^[A-Za-z]{3} \d+$/);
    });

    it("returns unpadded day number", () => {
      const label = fmtGridDayLabel(aug9, 2);
      expect(label).toMatch(/^[A-Za-z]{3} 9$/);
    });
  });

  describe("fmtTodayLabel", () => {
    it("formats as 'Mon 10 Aug' style", () => {
      const label = fmtTodayLabel(aug10_214pm);
      expect(label).toMatch(/^[A-Za-z]{3} \d+ [A-Za-z]{3}$/);
      expect(label).toContain("10");
      expect(label).toContain("Aug");
    });
  });

  describe("fmtAwayElapsed", () => {
    it("formats minutes under an hour", () => {
      // 43 minutes later
      const later = aug10_214pm + 43 * 60 * 1000;
      expect(fmtAwayElapsed(aug10_214pm, later)).toBe("43 min");
    });

    it("formats the 59/60 minute boundary (59 min)", () => {
      const later = aug10_214pm + 59 * 60 * 1000;
      expect(fmtAwayElapsed(aug10_214pm, later)).toBe("59 min");
    });

    it("formats the 59/60 minute boundary (60 min)", () => {
      const later = aug10_214pm + 60 * 60 * 1000;
      expect(fmtAwayElapsed(aug10_214pm, later)).toBe("1h 0m");
    });

    it("formats hours and minutes without padding minutes", () => {
      // 7 hours 12 minutes later
      const later = aug10_214pm + (7 * 60 + 12) * 60 * 1000;
      expect(fmtAwayElapsed(aug10_214pm, later)).toBe("7h 12m");
    });

    it("formats with unpadded minutes like 7h 5m", () => {
      // 7 hours 5 minutes later
      const later = aug10_214pm + (7 * 60 + 5) * 60 * 1000;
      expect(fmtAwayElapsed(aug10_214pm, later)).toBe("7h 5m");
    });

    it("formats 1 minute correctly", () => {
      const later = aug10_214pm + 1 * 60 * 1000;
      expect(fmtAwayElapsed(aug10_214pm, later)).toBe("1 min");
    });

    it("formats 0 minutes correctly", () => {
      expect(fmtAwayElapsed(aug10_214pm, aug10_214pm)).toBe("0 min");
    });
  });

  describe("padCount", () => {
    it("pads single digit to 2 digits", () => {
      expect(padCount(3)).toBe("03");
    });

    it("pads zero to 00", () => {
      expect(padCount(0)).toBe("00");
    });

    it("returns 2-digit number as is", () => {
      expect(padCount(42)).toBe("42");
    });

    it("handles larger numbers", () => {
      expect(padCount(100)).toBe("100");
    });
  });

  describe("fmtChimeRange", () => {
    it("formats range with en dash separator", () => {
      const range = fmtChimeRange(aug10_214pm, aug10_314pm);
      expect(range).toBe("2:14 PM – 3:14 PM");
    });

    it("uses en dash (U+2013), not hyphen or em dash", () => {
      const range = fmtChimeRange(aug10_214pm, aug10_314pm);
      // U+2013 is the en dash character
      expect(range).toContain(" – ");
      expect(range).not.toContain(" - ");
      expect(range).not.toContain(" — ");
    });

    it("has spaces around the dash", () => {
      const range = fmtChimeRange(aug10_214pm, aug10_314pm);
      expect(range).toMatch(/PM – \d/);
    });
  });

  describe("gridCellTitle", () => {
    it("formats with middle dot and em dash separators", () => {
      const title = gridCellTitle(14, "Comms", "Inbox, mostly");
      expect(title).toBe("14:00 · Comms — Inbox, mostly");
    });

    it("uses middle dot (U+00B7) as first separator", () => {
      const title = gridCellTitle(9, "Deep work", "coding");
      // U+00B7 is the middle dot
      expect(title).toContain(" · ");
    });

    it("uses em dash (U+2014) as second separator", () => {
      const title = gridCellTitle(9, "Deep work", "coding");
      // U+2014 is the em dash
      expect(title).toContain(" — ");
    });

    it("does not zero-pad hour", () => {
      const title9 = gridCellTitle(9, "Rest", "break");
      expect(title9).toBe("9:00 · Rest — break");

      const title14 = gridCellTitle(14, "Meetings", "standup");
      expect(title14).toBe("14:00 · Meetings — standup");
    });

    it("formats various hours correctly", () => {
      expect(gridCellTitle(0, "Tag", "text")).toBe("0:00 · Tag — text");
      expect(gridCellTitle(23, "Tag", "text")).toBe("23:00 · Tag — text");
    });
  });

  describe("gridCellEmptyTitle", () => {
    it("formats empty cell with not logged message", () => {
      const title = gridCellEmptyTitle(9);
      expect(title).toBe("9:00 · not logged");
    });

    it("uses middle dot separator", () => {
      const title = gridCellEmptyTitle(9);
      expect(title).toContain(" · ");
    });

    it("does not zero-pad hour", () => {
      expect(gridCellEmptyTitle(9)).toBe("9:00 · not logged");
      expect(gridCellEmptyTitle(14)).toBe("14:00 · not logged");
    });

    it("formats various hours correctly", () => {
      expect(gridCellEmptyTitle(0)).toBe("0:00 · not logged");
      expect(gridCellEmptyTitle(23)).toBe("23:00 · not logged");
    });
  });
});
