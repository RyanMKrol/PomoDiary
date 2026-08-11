// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DayView } from "./DayView";
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

describe("DayView", () => {
  describe("empty state", () => {
    it("shows the exact empty state headline", async () => {
      global.fetch = vi.fn(() => mockFetchResponse([])) as any;

      render(
        <DayView dayStart={0} dayEnd={1000} timerState={{ mode: "running" }} />,
      );

      const headline = await screen.findByText("Nothing in the basket yet.");
      expect(headline).toBeInTheDocument();
    });

    it("shows the exact empty state body copy", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        }),
      ) as any;

      render(
        <DayView dayStart={0} dayEnd={1000} timerState={{ mode: "running" }} />,
      );

      const body = await screen.findByText(/The ring fills as the hour passes/);
      expect(body).toBeInTheDocument();
    });

    it("shows the 30px red square", async () => {
      global.fetch = vi.fn(() => mockFetchResponse([])) as any;

      render(
        <DayView dayStart={0} dayEnd={1000} timerState={{ mode: "running" }} />,
      );

      const square = await screen.findByText("Nothing in the basket yet.");
      expect(square).toBeInTheDocument();
    });
  });

  describe("entry rendering", () => {
    const mockEntry: Entry = {
      id: "test-1",
      userId: "user-1",
      from: new Date("2024-01-15T10:00:00Z"),
      to: new Date("2024-01-15T11:00:00Z"),
      tag: "Deep work",
      feel: "Charged",
      intent: "yes",
      bullets: ["Wrote the report", "Fixed a bug"],
      createdAt: new Date("2024-01-15T11:00:00Z"),
    };

    const mockEntryAway: Entry = {
      id: "test-away",
      userId: "user-1",
      from: new Date("2024-01-15T22:00:00Z"),
      to: new Date("2024-01-15T23:00:00Z"),
      tag: "Asleep",
      feel: "Steady",
      intent: "yes",
      bullets: ["Asleep"],
      createdAt: new Date("2024-01-15T23:00:00Z"),
    };

    it("renders entries newest-first", async () => {
      const olderEntry: Entry = {
        id: "test-older",
        userId: "user-1",
        from: new Date("2024-01-15T09:00:00Z"),
        to: new Date("2024-01-15T10:00:00Z"),
        tag: "Admin",
        feel: "Scattered",
        intent: "no",
        bullets: ["Did admin stuff"],
        createdAt: new Date("2024-01-15T10:00:00Z"),
      };

      const newerEntry: Entry = {
        id: "test-newer",
        userId: "user-1",
        from: new Date("2024-01-15T11:00:00Z"),
        to: new Date("2024-01-15T12:00:00Z"),
        tag: "Meetings",
        feel: "Charged",
        intent: "yes",
        bullets: ["Team sync"],
        createdAt: new Date("2024-01-15T12:00:00Z"),
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([newerEntry, olderEntry]),
        }),
      ) as any;

      render(
        <DayView dayStart={0} dayEnd={1000} timerState={{ mode: "running" }} />,
      );

      const entries = await screen.findAllByTestId(/^entry-/);
      expect(entries).toHaveLength(2);
      expect(entries[0]).toHaveAttribute("data-testid", "entry-test-newer");
      expect(entries[1]).toHaveAttribute("data-testid", "entry-test-older");
    });

    it("renders formatted times correctly", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([mockEntry]),
        }),
      ) as any;

      render(
        <DayView dayStart={0} dayEnd={1000} timerState={{ mode: "running" }} />,
      );

      const startTime = await screen.findByText("10:00 AM");
      const endTime = await screen.findByText("to 11:00 AM");
      expect(startTime).toBeInTheDocument();
      expect(endTime).toBeInTheDocument();
    });

    it("renders all chips with correct content", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([mockEntry]),
        }),
      ) as any;

      render(
        <DayView dayStart={0} dayEnd={1000} timerState={{ mode: "running" }} />,
      );

      const tagChip = await screen.findByTestId("chip-tag-test-1");
      const feelChip = await screen.findByTestId("chip-feel-test-1");
      const intentChip = await screen.findByTestId("chip-intent-test-1");

      expect(tagChip).toHaveTextContent("Deep work");
      expect(feelChip).toHaveTextContent("Charged");
      expect(intentChip).toHaveTextContent("Intentional");
    });

    it("renders intent chip with correct variants", async () => {
      const intentYes: Entry = {
        ...mockEntry,
        id: "intent-yes",
        intent: "yes",
      };
      const intentNo: Entry = {
        ...mockEntry,
        id: "intent-no",
        intent: "no",
      };
      const intentNull: Entry = {
        ...mockEntry,
        id: "intent-null",
        intent: null,
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([intentYes, intentNo, intentNull]),
        }),
      ) as any;

      render(
        <DayView dayStart={0} dayEnd={1000} timerState={{ mode: "running" }} />,
      );

      const yesChip = await screen.findByTestId("chip-intent-intent-yes");
      const noChip = await screen.findByTestId("chip-intent-intent-no");
      const nullChip = await screen.findByTestId("chip-intent-intent-null");

      expect(yesChip).toHaveTextContent("Intentional");
      expect(noChip).toHaveTextContent("Got away");
      expect(noChip).toHaveStyle({
        backgroundColor: "oklch(0.42 0.012 40)",
      });
      expect(nullChip).toHaveTextContent("Unmarked");
    });

    it("shows the — feel chip for away hours", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([mockEntryAway]),
        }),
      ) as any;

      render(
        <DayView dayStart={0} dayEnd={1000} timerState={{ mode: "running" }} />,
      );

      const awayFeel = await screen.findByTestId("chip-feel-test-away");
      expect(awayFeel).toHaveTextContent("—");
    });

    it("renders bullets with correct formatting", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([mockEntry]),
        }),
      ) as any;

      render(
        <DayView dayStart={0} dayEnd={1000} timerState={{ mode: "running" }} />,
      );

      const bullet1 = await screen.findByTestId("bullet-test-1-0");
      const bullet2 = await screen.findByTestId("bullet-test-1-1");

      expect(bullet1).toHaveTextContent("Wrote the report");
      expect(bullet2).toHaveTextContent("Fixed a bug");
    });
  });

  describe("refetching", () => {
    it("refetches when dayStart changes", async () => {
      const fetchSpy = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        }),
      );

      global.fetch = fetchSpy as any;

      const { rerender } = render(
        <DayView
          dayStart={1000}
          dayEnd={2000}
          timerState={{ mode: "running" }}
        />,
      );

      await screen.findByText("Nothing in the basket yet.");
      expect(fetchSpy).toHaveBeenCalledWith("/api/entries?from=1000&to=2000");

      rerender(
        <DayView
          dayStart={3000}
          dayEnd={4000}
          timerState={{ mode: "running" }}
        />,
      );

      await screen.findByText("Nothing in the basket yet.");
      expect(fetchSpy).toHaveBeenCalledWith("/api/entries?from=3000&to=4000");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("refetches when timerState.mode changes", async () => {
      const fetchSpy = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        }),
      );

      global.fetch = fetchSpy as any;

      const { rerender } = render(
        <DayView
          dayStart={1000}
          dayEnd={2000}
          timerState={{ mode: "running" }}
        />,
      );

      await screen.findByText("Nothing in the basket yet.");
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      rerender(
        <DayView
          dayStart={1000}
          dayEnd={2000}
          timerState={{ mode: "recap" }}
        />,
      );

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
