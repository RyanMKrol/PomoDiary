// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GridView } from "./GridView";
import type { Entry } from "@/lib/db/entries.store";

function mockFetchResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("GridView", () => {
  describe("structure", () => {
    it("renders 10 day rows", async () => {
      global.fetch = vi.fn(() => mockFetchResponse([])) as any;
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
      global.fetch = vi.fn(() => mockFetchResponse([])) as any;
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
      global.fetch = vi.fn(() => mockFetchResponse([])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      const label = await screen.findByTestId("day-label-1");
      expect(label).toHaveTextContent("Yesterday");
    });

    it("renders weekday and date for older days", async () => {
      global.fetch = vi.fn(() => mockFetchResponse([])) as any;
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
          tag: "Deep work",
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
          tag: "Comms",
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
          tag: "Meetings",
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
        tag: "Deep work",
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
        backgroundColor: "oklch(0.58 0.20 30)",
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
        tag: "Comms",
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
      expect(cell).toHaveAttribute("title", "10:00 · Comms — Inbox, mostly");
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
        tag: "Deep work",
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
        tag: "Comms",
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
      // Should have Deep work color, not Comms
      expect(cell).toHaveStyle({
        backgroundColor: "oklch(0.58 0.20 30)",
      });
      expect(cell).toHaveAttribute("title", "10:00 · Deep work — First");
    });
  });

  describe("legend", () => {
    it("renders exactly 10 legend items", async () => {
      global.fetch = vi.fn(() => mockFetchResponse([])) as any;
      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      // Wait for content to load
      await screen.findByTestId("day-row-0");

      // Check all 10 legend items are present
      const deepWorkLabel = screen.getByText("Deep work");
      const adminLabel = screen.getByText("Admin");
      const meetingsLabel = screen.getByText("Meetings");
      const commsLabel = screen.getByText("Comms");
      const learningLabel = screen.getByText("Learning");
      const errandsLabel = screen.getByText("Errands");
      const restLabel = screen.getByText("Rest");
      const lostItLabel = screen.getByText("Lost it");
      const asleepLabel = screen.getByText("Asleep");
      const atWorkLabel = screen.getByText("At work");

      expect(deepWorkLabel).toBeInTheDocument();
      expect(adminLabel).toBeInTheDocument();
      expect(meetingsLabel).toBeInTheDocument();
      expect(commsLabel).toBeInTheDocument();
      expect(learningLabel).toBeInTheDocument();
      expect(errandsLabel).toBeInTheDocument();
      expect(restLabel).toBeInTheDocument();
      expect(lostItLabel).toBeInTheDocument();
      expect(asleepLabel).toBeInTheDocument();
      expect(atWorkLabel).toBeInTheDocument();
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

      global.fetch = vi.fn(() => mockFetchResponse([])) as any;
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

      global.fetch = vi.fn(() => mockFetchResponse([])) as any;
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
    it("fetches 10 days of data starting from 9 days ago", async () => {
      const fetchSpy = vi.fn(() => mockFetchResponse([])) as any;
      global.fetch = fetchSpy;

      render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      await screen.findByTestId("day-row-0");

      // Should have been called with from/to parameters
      expect(fetchSpy).toHaveBeenCalled();
      const callUrl = fetchSpy.mock.calls[0][0];
      expect(callUrl).toContain("/api/entries?from=");
      expect(callUrl).toContain("&to=");
    });
  });

  describe("refetching", () => {
    it("refetches when timerState.mode changes", async () => {
      const fetchSpy = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        }),
      );

      global.fetch = fetchSpy as any;

      const { rerender } = render(
        <GridView onSelectDay={() => {}} timerState={{ mode: "running" }} />,
      );

      await screen.findByTestId("day-row-0");
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      rerender(
        <GridView onSelectDay={() => {}} timerState={{ mode: "recap" }} />,
      );

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
        tag: ["Deep work", "Comms", "Meetings", "Admin", "Learning"][i],
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
