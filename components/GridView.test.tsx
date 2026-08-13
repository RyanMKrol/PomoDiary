// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GridView } from "./GridView";
import type { Entry } from "@/lib/db/entries.store";
import { invalidateEntriesCache } from "@/lib/client/entriesCache";

function mockFetchResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

/** An entry n days ago at 10:00 — used to anchor the grid's start date,
 *  since the grid only shows days from the earliest entry onward. */
function entryDaysAgo(n: number) {
  const from = new Date();
  from.setHours(10, 0, 0, 0);
  from.setDate(from.getDate() - n);
  const to = new Date(from);
  to.setHours(11, 0, 0, 0);
  return {
    id: `anchor-${n}`,
    from: from.toISOString(),
    to: to.toISOString(),
    tag: "Learning",
    feel: "Steady",
    intent: "yes",
    bullets: ["anchor"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // The entries cache is module-level state that persists between tests —
  // without a reset it would serve one test's fixtures to the next (every
  // grid fetch shares the "all" key).
  invalidateEntriesCache();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("GridView", () => {
  describe("structure", () => {
    it("renders one row per day back to the earliest entry", async () => {
      global.fetch = vi.fn(() => mockFetchResponse([entryDaysAgo(9)])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      const rows = await screen.findAllByTestId(/^day-row-/);
      expect(rows).toHaveLength(10);
    });

    it("renders ruler with 8 hour labels", async () => {
      global.fetch = vi.fn(() => mockFetchResponse([])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      const labels = await screen.findAllByTestId(/^ruler-label-/);
      expect(labels).toHaveLength(8);

      expect(await screen.findByTestId("ruler-label-0")).toHaveTextContent(
        "00",
      );
      expect(screen.getByTestId("ruler-label-3")).toHaveTextContent("03");
      expect(screen.getByTestId("ruler-label-6")).toHaveTextContent("06");
      expect(screen.getByTestId("ruler-label-9")).toHaveTextContent("09");
      expect(screen.getByTestId("ruler-label-12")).toHaveTextContent("12");
      expect(screen.getByTestId("ruler-label-15")).toHaveTextContent("15");
      expect(screen.getByTestId("ruler-label-18")).toHaveTextContent("18");
      expect(screen.getByTestId("ruler-label-21")).toHaveTextContent("21");
    });

    it("renders HRS label in ruler", async () => {
      global.fetch = vi.fn(() => mockFetchResponse([])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      // Wait for day rows to ensure content is loaded before checking for HRS
      await screen.findAllByTestId(/^day-row-/);
      const hrs = screen.getByText("HRS");
      expect(hrs).toBeInTheDocument();
    });

    it("renders 24 cells per day row", async () => {
      global.fetch = vi.fn(() => mockFetchResponse([entryDaysAgo(9)])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      // Wait for content to load first
      await screen.findByTestId("cell-0-0");

      // Check each day row has 24 cells (0-23)
      for (let dayIndex = 0; dayIndex < 10; dayIndex++) {
        for (let hour = 0; hour < 24; hour++) {
          const cell = screen.getByTestId(`cell-${dayIndex}-${hour}`);
          expect(cell).toBeInTheDocument();
        }
      }
    });
  });

  describe("day labels", () => {
    it("renders Today for first day", async () => {
      global.fetch = vi.fn(() => mockFetchResponse([])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      const label = await screen.findByTestId("day-label-0");
      expect(label).toHaveTextContent("Today");
    });

    it("renders Yesterday for second day", async () => {
      global.fetch = vi.fn(() => mockFetchResponse([entryDaysAgo(9)])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      const label = await screen.findByTestId("day-label-1");
      expect(label).toHaveTextContent("Yesterday");
    });

    it("renders weekday and date for older days", async () => {
      global.fetch = vi.fn(() => mockFetchResponse([entryDaysAgo(9)])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      const label = await screen.findByTestId("day-label-2");
      // Should contain weekday abbreviation and day number
      expect(label.textContent).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    });
  });

  describe("day counts", () => {
    it("renders zero-padded count for empty days", async () => {
      global.fetch = vi.fn(() => mockFetchResponse([])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      const count = await screen.findByTestId("day-count-0");
      expect(count).toHaveTextContent("00");
    });

    it("renders zero-padded count for days with entries", async () => {
      const now = Date.now();
      const today = new Date(now);
      today.setHours(10, 0, 0, 0);

      const entries: Entry[] = [
        {
          id: "1",
          userId: "user",
          from: today,
          to: new Date(today.getTime() + 3600000),
          tag: "Admin",
          feel: "Charged",
          intent: "yes",
          bullets: ["Entry 1"],
          createdAt: new Date(),
        },
        {
          id: "2",
          userId: "user",
          from: new Date(today.getTime() + 3600000),
          to: new Date(today.getTime() + 7200000),
          tag: "Learning",
          feel: "Steady",
          intent: "yes",
          bullets: ["Entry 2"],
          createdAt: new Date(),
        },
        {
          id: "3",
          userId: "user",
          from: new Date(today.getTime() + 7200000),
          to: new Date(today.getTime() + 10800000),
          tag: "Errands",
          feel: "Scattered",
          intent: "no",
          bullets: ["Entry 3"],
          createdAt: new Date(),
        },
      ];

      global.fetch = vi.fn(() => mockFetchResponse(entries)) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      const count = await screen.findByTestId("day-count-0");
      expect(count).toHaveTextContent("03");
    });
  });

  describe("entry rendering", () => {
    it("colours a cell with entry's tag colour", async () => {
      const now = Date.now();
      const today = new Date(now);
      today.setHours(10, 0, 0, 0);

      const entry: Entry = {
        id: "test-1",
        userId: "user",
        from: today,
        to: new Date(today.getTime() + 3600000),
        tag: "Leisure",
        feel: "Charged",
        intent: "yes",
        bullets: ["Test entry"],
        createdAt: new Date(),
      };

      global.fetch = vi.fn(() => mockFetchResponse([entry])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      const cell = await screen.findByTestId("cell-0-10");
      expect(cell).toHaveStyle({
        backgroundColor: "oklch(0.58 0.15 305)",
      });
    });

    it("sets correct title for entry cell", async () => {
      const now = Date.now();
      const today = new Date(now);
      today.setHours(10, 0, 0, 0);

      const entry: Entry = {
        id: "test-1",
        userId: "user",
        from: today,
        to: new Date(today.getTime() + 3600000),
        tag: "Admin",
        feel: "Charged",
        intent: "yes",
        bullets: ["Inbox, mostly"],
        createdAt: new Date(),
      };

      global.fetch = vi.fn(() => mockFetchResponse([entry])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      const cell = await screen.findByTestId("cell-0-10");
      expect(cell).toHaveAttribute("title", "10:00 · Admin — Inbox, mostly");
    });

    it("sets correct title for empty cell", async () => {
      global.fetch = vi.fn(() => mockFetchResponse([])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      const cell = await screen.findByTestId("cell-0-10");
      expect(cell).toHaveAttribute("title", "10:00 · not logged");
    });

    it("colours empty cells with default grey", async () => {
      global.fetch = vi.fn(() => mockFetchResponse([])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      const cell = await screen.findByTestId("cell-0-10");
      expect(cell).toHaveStyle({
        backgroundColor: "var(--empty-cell)",
      });
    });
  });

  describe("same-hour collision", () => {
    it("keeps first entry when two share the same start hour", async () => {
      const now = Date.now();
      const today = new Date(now);
      today.setHours(10, 0, 0, 0);

      const entry1: Entry = {
        id: "test-1",
        userId: "user",
        from: today,
        to: new Date(today.getTime() + 1800000),
        tag: "Leisure",
        feel: "Charged",
        intent: "yes",
        bullets: ["First"],
        createdAt: new Date(),
      };

      const entry2: Entry = {
        id: "test-2",
        userId: "user",
        from: today,
        to: new Date(today.getTime() + 1800000),
        tag: "Social",
        feel: "Steady",
        intent: "yes",
        bullets: ["Second"],
        createdAt: new Date(),
      };

      global.fetch = vi.fn(() => mockFetchResponse([entry1, entry2])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      const cell = await screen.findByTestId("cell-0-10");
      // Should have Leisure color, not Social
      expect(cell).toHaveStyle({
        backgroundColor: "oklch(0.58 0.15 305)",
      });
      expect(cell).toHaveAttribute("title", "10:00 · Leisure — First");
    });
  });

  describe("legend", () => {
    it("renders exactly 11 legend items", async () => {
      global.fetch = vi.fn(() => mockFetchResponse([])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      // Wait for content to load
      await screen.findByTestId("day-row-0");

      // Check all 11 legend items are present: 7 tags, 3 fixed away
      // kinds, and the custom-away swatch.
      for (const label of [
        "Admin",
        "Learning",
        "Errands",
        "Rest",
        "Leisure",
        "Social",
        "Chores",
        "Asleep",
        "At work",
        "At the gym",
        "Away (custom)",
      ]) {
        expect(screen.getByText(label)).toBeInTheDocument();
      }

      // The retired work-hours vocabulary is gone from the legend.
      for (const removed of ["Deep work", "Meetings", "Comms", "Lost it"]) {
        expect(screen.queryByText(removed)).not.toBeInTheDocument();
      }
    });

    it("does not render Unfiled in legend", async () => {
      global.fetch = vi.fn(() => mockFetchResponse([])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      await screen.findByTestId("day-row-0");
      const unfiledLabel = screen.queryByText("Unfiled");
      expect(unfiledLabel).not.toBeInTheDocument();
    });

    it("renders footer text", async () => {
      global.fetch = vi.fn(() => mockFetchResponse([])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      await screen.findByTestId("day-row-0");
      const footerText = screen.getByText(
        "Click a day to read the hours back.",
      );
      expect(footerText).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("gives each cell role=img with an aria-label matching its title", async () => {
      const now = Date.now();
      const today = new Date(now);
      today.setHours(10, 0, 0, 0);

      const entry: Entry = {
        id: "test-1",
        userId: "user",
        from: today,
        to: new Date(today.getTime() + 3600000),
        tag: "Admin",
        feel: "Charged",
        intent: "yes",
        bullets: ["Inbox, mostly"],
        createdAt: new Date(),
      };

      global.fetch = vi.fn(() => mockFetchResponse([entry])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      const cell = await screen.findByTestId("cell-0-10");
      expect(cell).toHaveAttribute("role", "img");
      expect(cell).toHaveAttribute(
        "aria-label",
        "10:00 · Admin — Inbox, mostly",
      );
    });

    it("gives each day row an aria-label with the day and hours logged", async () => {
      const now = Date.now();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      const entries: Entry[] = Array.from({ length: 3 }, (_, i) => ({
        id: `entry-${i}`,
        userId: "user",
        from: new Date(today.getTime() + i * 3600000),
        to: new Date(today.getTime() + (i + 1) * 3600000),
        tag: "Learning",
        feel: "Charged",
        intent: "yes",
        bullets: [`Entry ${i}`],
        createdAt: new Date(),
      }));

      global.fetch = vi.fn(() => mockFetchResponse(entries)) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      const row = await screen.findByTestId("day-row-0");
      expect(row).toHaveAttribute(
        "aria-label",
        "Today, 3 hours logged. Open day.",
      );
    });

    it("uses singular 'hour' when only one is logged", async () => {
      const now = Date.now();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      const entry: Entry = {
        id: "entry-1",
        userId: "user",
        from: today,
        to: new Date(today.getTime() + 3600000),
        tag: "Learning",
        feel: "Charged",
        intent: "yes",
        bullets: ["Entry"],
        createdAt: new Date(),
      };

      global.fetch = vi.fn(() => mockFetchResponse([entry])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      const row = await screen.findByTestId("day-row-0");
      expect(row).toHaveAttribute(
        "aria-label",
        "Today, 1 hour logged. Open day.",
      );
    });
  });

  describe("row click interaction", () => {
    it("calls onSelectDay with correct index when row clicked", async () => {
      const user = userEvent.setup();
      const onSelectDay = vi.fn();

      global.fetch = vi.fn(() => mockFetchResponse([])) as any;
      render(
        <GridView onSelectDay={onSelectDay} timerState={{ mode: "running" }} />,
      );

      const row = await screen.findByTestId("day-row-0");
      await user.click(row);

      expect(onSelectDay).toHaveBeenCalledWith(0);
    });

    it("calls onSelectDay for different day rows", async () => {
      const user = userEvent.setup();
      const onSelectDay = vi.fn();

      global.fetch = vi.fn(() => mockFetchResponse([entryDaysAgo(9)])) as any;
      render(
        <GridView onSelectDay={onSelectDay} timerState={{ mode: "running" }} />,
      );

      const row3 = await screen.findByTestId("day-row-3");
      await user.click(row3);

      expect(onSelectDay).toHaveBeenCalledWith(3);
    });

    it("calls onSelectDay when clicking on cell within row", async () => {
      const user = userEvent.setup();
      const onSelectDay = vi.fn();

      global.fetch = vi.fn(() => mockFetchResponse([entryDaysAgo(9)])) as any;
      render(
        <GridView onSelectDay={onSelectDay} timerState={{ mode: "running" }} />,
      );

      const cell = await screen.findByTestId("cell-2-10");
      await user.click(cell);

      // The click should bubble up to the row button
      expect(onSelectDay).toHaveBeenCalledWith(2);
    });
  });

  describe("away entries", () => {
    it("renders Asleep entries with correct colour", async () => {
      const now = Date.now();
      const today = new Date(now);
      today.setHours(22, 0, 0, 0);

      const asleepEntry: Entry = {
        id: "sleep-1",
        userId: "user",
        from: today,
        to: new Date(today.getTime() + 3600000),
        tag: "Asleep",
        feel: "Steady",
        intent: "yes",
        bullets: ["Asleep"],
        createdAt: new Date(),
      };

      global.fetch = vi.fn(() => mockFetchResponse([asleepEntry])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      const cell = await screen.findByTestId("cell-0-22");
      expect(cell).toHaveStyle({
        backgroundColor: "oklch(0.38 0.055 275)",
      });
    });

    it("renders At work entries with correct colour", async () => {
      const now = Date.now();
      const today = new Date(now);
      today.setHours(14, 0, 0, 0);

      const workEntry: Entry = {
        id: "work-1",
        userId: "user",
        from: today,
        to: new Date(today.getTime() + 3600000),
        tag: "At work",
        feel: "Steady",
        intent: "yes",
        bullets: ["At work"],
        createdAt: new Date(),
      };

      global.fetch = vi.fn(() => mockFetchResponse([workEntry])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      const cell = await screen.findByTestId("cell-0-14");
      expect(cell).toHaveStyle({
        backgroundColor: "oklch(0.50 0.075 235)",
      });
    });
  });

  describe("date boundaries", () => {
    it("fetches the full history with no range params", async () => {
      const fetchSpy = vi.fn(() => mockFetchResponse([])) as any;
      global.fetch = fetchSpy;

      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      await screen.findByTestId("day-row-0");

      // No from/to: the API returns everything for this user (grid grows
      // one row per day back to the earliest entry).
      expect(fetchSpy).toHaveBeenCalled();
      const callUrl = fetchSpy.mock.calls[0][0];
      expect(callUrl).toBe("/api/entries");
    });
  });

  describe("refetching", () => {
    it("refetches only when entriesVersion bumps, not on mode changes", async () => {
      const fetchSpy = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        }),
      );

      global.fetch = fetchSpy as any;

      const { rerender } = render(
        <GridView
          onSelectDay={() => {}}
          timerState={{ mode: "running", entriesVersion: 0 }}
        />,
      );

      await screen.findByTestId("day-row-0");
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Mode transitions are local under the optimistic client and precede
      // the server insert — they must NOT refetch.
      rerender(
        <GridView
          onSelectDay={() => {}}
          timerState={{ mode: "recap", entriesVersion: 0 }}
        />,
      );
      rerender(
        <GridView
          onSelectDay={() => {}}
          timerState={{ mode: "running", entriesVersion: 0 }}
        />,
      );
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // A flush ack confirmed new entries in the database — refetch.
      rerender(
        <GridView
          onSelectDay={() => {}}
          timerState={{ mode: "running", entriesVersion: 1 }}
        />,
      );
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("caching", () => {
    beforeEach(() => {
      invalidateEntriesCache();
    });

    it("serves a remount at the same entriesVersion from cache with zero fetches", async () => {
      const fetchSpy = vi.fn(() => mockFetchResponse([entryDaysAgo(9)]));
      global.fetch = fetchSpy as any;

      const { unmount } = render(
        <GridView
          onSelectDay={() => {}}
          timerState={{ mode: "running", entriesVersion: 0 }}
        />,
      );
      await screen.findByTestId("day-row-9");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      unmount();

      // Toggling day<->grid remounts GridView — same version must come
      // straight from the cache without touching the network.
      render(
        <GridView
          onSelectDay={() => {}}
          timerState={{ mode: "running", entriesVersion: 0 }}
        />,
      );
      expect(await screen.findByTestId("day-row-9")).toBeInTheDocument();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("refetches on remount after an entriesVersion bump", async () => {
      const fetchSpy = vi.fn(() => mockFetchResponse([entryDaysAgo(9)]));
      global.fetch = fetchSpy as any;

      const { unmount } = render(
        <GridView
          onSelectDay={() => {}}
          timerState={{ mode: "running", entriesVersion: 0 }}
        />,
      );
      await screen.findByTestId("day-row-9");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      unmount();

      // The slot was stored at version 0 — a caller at version 1 must miss.
      render(
        <GridView
          onSelectDay={() => {}}
          timerState={{ mode: "running", entriesVersion: 1 }}
        />,
      );
      await screen.findByTestId("day-row-9");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("refetches on remount after invalidateEntriesCache (an entry edit)", async () => {
      const fetchSpy = vi.fn(() => mockFetchResponse([entryDaysAgo(9)]));
      global.fetch = fetchSpy as any;

      const { unmount } = render(
        <GridView
          onSelectDay={() => {}}
          timerState={{ mode: "running", entriesVersion: 0 }}
        />,
      );
      await screen.findByTestId("day-row-9");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      unmount();

      // GridView has no editor of its own — DayView's save callback calls
      // invalidateEntriesCache(), so simulate that directly.
      invalidateEntriesCache();

      render(
        <GridView
          onSelectDay={() => {}}
          timerState={{ mode: "running", entriesVersion: 0 }}
        />,
      );
      await screen.findByTestId("day-row-9");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("multiple entries in same day", () => {
    it("counts all entries in a day", async () => {
      const now = Date.now();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      const entries: Entry[] = Array.from({ length: 5 }, (_, i) => ({
        id: `entry-${i}`,
        userId: "user",
        from: new Date(today.getTime() + i * 3600000),
        to: new Date(today.getTime() + (i + 1) * 3600000),
        tag: ["Admin", "Learning", "Errands", "Social", "Chores"][i],
        feel: "Charged",
        intent: "yes",
        bullets: [`Entry ${i}`],
        createdAt: new Date(),
      }));

      global.fetch = vi.fn(() => mockFetchResponse(entries)) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      const count = await screen.findByTestId("day-count-0");
      expect(count).toHaveTextContent("05");
    });
  });
});

describe("history growth", () => {
  it("shows one row per day back to the earliest entry, beyond the 10-day floor", async () => {
    const from = new Date();
    from.setHours(10, 0, 0, 0);
    from.setDate(from.getDate() - 14);
    const to = new Date(from);
    to.setHours(11, 0, 0, 0);
    const oldEntry = {
      id: "old-1",
      from: from.toISOString(),
      to: to.toISOString(),
      tag: "Learning",
      feel: "Steady",
      intent: "yes",
      bullets: ["ancient history"],
    };
    global.fetch = vi.fn(() => mockFetchResponse([oldEntry])) as any;

    render(
      <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
    );

    // 14 days ago + today = 15 rows.
    await screen.findByTestId("day-row-14");
    const rows = await screen.findAllByTestId(/^day-row-/);
    expect(rows).toHaveLength(15);
  });

  it("shows only today when there are no entries at all", async () => {
    global.fetch = vi.fn(() => mockFetchResponse([])) as any;

    render(
      <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
    );

    await screen.findByTestId("day-row-0");
    const rows = await screen.findAllByTestId(/^day-row-/);
    expect(rows).toHaveLength(1);
  });
});

describe("midnight crossing", () => {
  it("grows a fresh TODAY row when the grid stays open across midnight", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 7, 12, 23, 0, 0));
      global.fetch = vi.fn(() => mockFetchResponse([entryDaysAgo(0)])) as any;

      const { rerender } = render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "away" }} />,
      );
      await act(async () => {});
      expect(screen.getAllByTestId(/^day-row-/)).toHaveLength(1);

      // Cross midnight; any re-render (the timer publishes every minute)
      // must add the new TODAY row instead of keeping yesterday on top.
      vi.setSystemTime(new Date(2026, 7, 13, 8, 0, 0));
      rerender(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );
      expect(screen.getAllByTestId(/^day-row-/)).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
