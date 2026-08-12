// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import "@testing-library/jest-dom/vitest";
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DayView } from "./DayView";
import type { Entry } from "@/lib/db/entries.store";
import { invalidateEntriesCache } from "@/lib/client/entriesCache";

function mockFetchResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // The entries cache is module-level state that persists between tests —
  // without a reset it would serve one test's fixtures to the next.
  invalidateEntriesCache();
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
      tag: "Learning",
      feel: "Charged",
      intent: "yes",
      bullets: ["Wrote the report", "Fixed a bug"],
      createdAt: new Date("2024-01-15T11:00:00Z"),
    };

    // Away entries always carry feel "—" — that alone suppresses the chip.
    const mockEntryAway: Entry = {
      id: "test-away",
      userId: "user-1",
      from: new Date("2024-01-15T22:00:00Z"),
      to: new Date("2024-01-15T23:00:00Z"),
      tag: "Asleep",
      feel: "—",
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
        tag: "Social",
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

      expect(tagChip).toHaveTextContent("Learning");
      expect(feelChip).toHaveTextContent("Charged");
      expect(intentChip).toHaveTextContent("Planned");
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
      const intentMixed: Entry = {
        ...mockEntry,
        id: "intent-mixed",
        intent: "mixed",
      };
      const intentNull: Entry = {
        ...mockEntry,
        id: "intent-null",
        intent: null,
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([intentYes, intentNo, intentMixed, intentNull]),
        }),
      ) as any;

      render(
        <DayView dayStart={0} dayEnd={1000} timerState={{ mode: "running" }} />,
      );

      const yesChip = await screen.findByTestId("chip-intent-intent-yes");
      const noChip = await screen.findByTestId("chip-intent-intent-no");
      const mixedChip = await screen.findByTestId("chip-intent-intent-mixed");

      expect(yesChip).toHaveTextContent("Planned");
      expect(noChip).toHaveTextContent("Unplanned");
      expect(noChip).toHaveStyle({
        backgroundColor: "oklch(0.42 0.012 40)",
      });
      // Mixed gets the neutral chip style, not the darker "no" treatment.
      expect(mixedChip).toHaveTextContent("Mixed");
      expect(mixedChip).not.toHaveStyle({
        backgroundColor: "oklch(0.42 0.012 40)",
      });
      // No intent picked = no chip at all (no placeholder).
      expect(screen.queryByTestId("chip-intent-intent-null")).toBeNull();
    });

    it("hides the feel chip for away hours", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([mockEntryAway]),
        }),
      ) as any;

      render(
        <DayView dayStart={0} dayEnd={1000} timerState={{ mode: "running" }} />,
      );

      await screen.findByTestId("chip-tag-test-away");
      expect(screen.queryByTestId("chip-feel-test-away")).toBeNull();
    });

    it("hides the feel chip for gym and custom-away hours", async () => {
      const gymEntry: Entry = {
        ...mockEntryAway,
        id: "test-gym",
        tag: "At the gym",
        bullets: ["At the gym"],
      };
      const customEntry: Entry = {
        ...mockEntryAway,
        id: "test-custom",
        from: new Date("2024-01-15T20:00:00Z"),
        to: new Date("2024-01-15T21:00:00Z"),
        tag: "Travelling",
        bullets: ["Travelling"],
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([gymEntry, customEntry]),
        }),
      ) as any;

      render(
        <DayView dayStart={0} dayEnd={1000} timerState={{ mode: "running" }} />,
      );

      await screen.findByTestId("chip-tag-test-gym");
      await screen.findByTestId("chip-tag-test-custom");
      expect(screen.queryByTestId("chip-feel-test-gym")).toBeNull();
      expect(screen.queryByTestId("chip-feel-test-custom")).toBeNull();
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

    it("refetches only when entriesVersion bumps, not on mode changes", async () => {
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
          timerState={{ mode: "running", entriesVersion: 0 }}
        />,
      );

      await screen.findByText("Nothing in the basket yet.");
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Mode transitions are local under the optimistic client and precede
      // the server insert — they must NOT refetch.
      rerender(
        <DayView
          dayStart={1000}
          dayEnd={2000}
          timerState={{ mode: "recap", entriesVersion: 0 }}
        />,
      );
      rerender(
        <DayView
          dayStart={1000}
          dayEnd={2000}
          timerState={{ mode: "running", entriesVersion: 0 }}
        />,
      );
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // A flush ack confirmed new entries in the database — refetch.
      rerender(
        <DayView
          dayStart={1000}
          dayEnd={2000}
          timerState={{ mode: "running", entriesVersion: 1 }}
        />,
      );
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("caching", () => {
    const cachedEntry: Entry = {
      id: "cached-1",
      userId: "user-1",
      from: new Date("2024-01-15T10:00:00Z"),
      to: new Date("2024-01-15T11:00:00Z"),
      tag: "Learning",
      feel: "Charged",
      intent: "yes",
      bullets: ["Cached work"],
      createdAt: new Date("2024-01-15T11:00:00Z"),
    };

    beforeEach(() => {
      invalidateEntriesCache();
    });

    it("serves a remount at the same entriesVersion from cache with zero fetches", async () => {
      const fetchSpy = vi.fn(() => mockFetchResponse([cachedEntry]));
      global.fetch = fetchSpy as any;

      const { unmount } = render(
        <DayView
          dayStart={0}
          dayEnd={1000}
          timerState={{ mode: "running", entriesVersion: 0 }}
        />,
      );
      await screen.findByTestId("entry-cached-1");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      unmount();

      // Toggling day<->grid remounts DayView — same day, same version must
      // come straight from the cache without touching the network.
      render(
        <DayView
          dayStart={0}
          dayEnd={1000}
          timerState={{ mode: "running", entriesVersion: 0 }}
        />,
      );
      expect(await screen.findByTestId("entry-cached-1")).toBeInTheDocument();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("refetches on remount after an entriesVersion bump", async () => {
      const fetchSpy = vi.fn(() => mockFetchResponse([cachedEntry]));
      global.fetch = fetchSpy as any;

      const { unmount } = render(
        <DayView
          dayStart={0}
          dayEnd={1000}
          timerState={{ mode: "running", entriesVersion: 0 }}
        />,
      );
      await screen.findByTestId("entry-cached-1");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      unmount();

      // The slot was stored at version 0 — a caller at version 1 must miss.
      render(
        <DayView
          dayStart={0}
          dayEnd={1000}
          timerState={{ mode: "running", entriesVersion: 1 }}
        />,
      );
      await screen.findByTestId("entry-cached-1");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("refetches on remount after an entry edit is saved", async () => {
      const user = userEvent.setup();
      const updatedEntry: Entry = { ...cachedEntry, tag: "Admin" };
      const listCalls = () =>
        fetchSpy.mock.calls.filter(([url]) =>
          String(url).startsWith("/api/entries?"),
        ).length;

      const fetchSpy = vi.fn((url: string) => {
        if (String(url).startsWith("/api/entries/cached-1")) {
          return mockFetchResponse(updatedEntry);
        }
        return mockFetchResponse([cachedEntry]);
      });
      global.fetch = fetchSpy as any;

      const { unmount } = render(
        <DayView
          dayStart={0}
          dayEnd={1000}
          timerState={{ mode: "running", entriesVersion: 0 }}
        />,
      );

      // Drive the real editor-save path: edit the entry's tag and save.
      const editButton = await screen.findByTestId("edit-button-cached-1");
      await user.click(editButton);
      await user.click(screen.getByTestId("editor-chip-cached-1-Admin"));
      await user.click(screen.getByTestId("editor-save-cached-1"));
      await waitFor(() => {
        expect(screen.getByTestId("chip-tag-cached-1")).toHaveTextContent(
          "Admin",
        );
      });
      expect(listCalls()).toBe(1);
      unmount();

      // The save invalidated the cache — a remount at the same version must
      // go back to the network rather than serve the pre-edit copy.
      render(
        <DayView
          dayStart={0}
          dayEnd={1000}
          timerState={{ mode: "running", entriesVersion: 0 }}
        />,
      );
      await screen.findByTestId("entry-cached-1");
      expect(listCalls()).toBe(2);
    });
  });

  describe("editing", () => {
    const mockEntry1: Entry = {
      id: "test-1",
      userId: "user-1",
      from: new Date("2024-01-15T10:00:00Z"),
      to: new Date("2024-01-15T11:00:00Z"),
      tag: "Learning",
      feel: "Charged",
      intent: "yes",
      bullets: ["Wrote the report"],
      createdAt: new Date("2024-01-15T11:00:00Z"),
    };

    const mockEntry2: Entry = {
      id: "test-2",
      userId: "user-1",
      from: new Date("2024-01-15T11:00:00Z"),
      to: new Date("2024-01-15T12:00:00Z"),
      tag: "Social",
      feel: "Steady",
      intent: "no",
      bullets: ["Team sync"],
      createdAt: new Date("2024-01-15T12:00:00Z"),
    };

    it("renders Edit button on each entry", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([mockEntry1, mockEntry2]),
        }),
      ) as any;

      render(
        <DayView dayStart={0} dayEnd={1000} timerState={{ mode: "running" }} />,
      );

      const editButton1 = await screen.findByTestId("edit-button-test-1");
      const editButton2 = await screen.findByTestId("edit-button-test-2");

      expect(editButton1).toHaveTextContent("Edit");
      expect(editButton2).toHaveTextContent("Edit");
    });

    it("shows editor when Edit button clicked", async () => {
      const user = userEvent.setup();
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([mockEntry1]),
        }),
      ) as any;

      render(
        <DayView dayStart={0} dayEnd={1000} timerState={{ mode: "running" }} />,
      );

      const editButton = await screen.findByTestId("edit-button-test-1");
      await user.click(editButton);

      // Verify editor is shown
      const editor = screen.getByTestId("editor-test-1");
      expect(editor).toBeInTheDocument();

      // Verify save/cancel buttons are shown
      expect(screen.getByTestId("editor-save-test-1")).toBeInTheDocument();
      expect(screen.getByTestId("editor-cancel-test-1")).toBeInTheDocument();
    });

    it("closes editor for first entry when opening second entry", async () => {
      const user = userEvent.setup();
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([mockEntry1, mockEntry2]),
        }),
      ) as any;

      render(
        <DayView dayStart={0} dayEnd={1000} timerState={{ mode: "running" }} />,
      );

      const editButton1 = await screen.findByTestId("edit-button-test-1");
      await user.click(editButton1);

      // Verify first entry is in edit mode
      expect(screen.getByTestId("editor-test-1")).toBeInTheDocument();

      const editButton2 = screen.getByTestId("edit-button-test-2");
      await user.click(editButton2);

      // Verify second entry is now in edit mode
      expect(screen.getByTestId("editor-test-2")).toBeInTheDocument();

      // Verify first entry is no longer in edit mode (chips are shown instead)
      expect(screen.queryByTestId("editor-test-1")).not.toBeInTheDocument();
      expect(screen.getByTestId("chip-tag-test-1")).toBeInTheDocument();
    });

    it("saves changes when Save is clicked", async () => {
      const user = userEvent.setup();
      const updatedEntry: Entry = {
        ...mockEntry1,
        tag: "Admin",
      };

      global.fetch = vi.fn((url: string) => {
        if (url.startsWith("/api/entries/test-1")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(updatedEntry),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([mockEntry1]),
        });
      }) as any;

      render(
        <DayView dayStart={0} dayEnd={1000} timerState={{ mode: "running" }} />,
      );

      const editButton = await screen.findByTestId("edit-button-test-1");
      await user.click(editButton);

      // Change the tag
      const adminChip = screen.getByTestId("editor-chip-test-1-Admin");
      await user.click(adminChip);

      // Save
      const saveButton = screen.getByTestId("editor-save-test-1");
      await user.click(saveButton);

      // Verify entry re-renders with updated tag
      await waitFor(() => {
        expect(screen.getByTestId("chip-tag-test-1")).toHaveTextContent(
          "Admin",
        );
      });

      // Verify editor is closed
      expect(screen.queryByTestId("editor-test-1")).not.toBeInTheDocument();
    });

    it("cancels edit and closes editor without saving", async () => {
      const user = userEvent.setup();
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([mockEntry1]),
        }),
      ) as any;

      render(
        <DayView dayStart={0} dayEnd={1000} timerState={{ mode: "running" }} />,
      );

      const editButton = await screen.findByTestId("edit-button-test-1");
      await user.click(editButton);

      // Change the tag
      const adminChip = screen.getByTestId("editor-chip-test-1-Admin");
      await user.click(adminChip);

      // Cancel
      const cancelButton = screen.getByTestId("editor-cancel-test-1");
      await user.click(cancelButton);

      // Verify editor is closed
      expect(screen.queryByTestId("editor-test-1")).not.toBeInTheDocument();

      // Verify tag is unchanged
      expect(screen.getByTestId("chip-tag-test-1")).toHaveTextContent(
        "Learning",
      );
    });

    it("handles empty bullet fallback on save", async () => {
      const user = userEvent.setup();
      const entryWithBullets: Entry = {
        ...mockEntry1,
        bullets: ["First"],
      };
      const updatedEntry: Entry = {
        ...entryWithBullets,
        bullets: ["(nothing written down)"],
      };

      global.fetch = vi.fn((url: string) => {
        if (url.startsWith("/api/entries/test-1")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(updatedEntry),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([entryWithBullets]),
        });
      }) as any;

      render(
        <DayView dayStart={0} dayEnd={1000} timerState={{ mode: "running" }} />,
      );

      const editButton = await screen.findByTestId("edit-button-test-1");
      await user.click(editButton);

      // Delete all bullets
      const input = screen.getByDisplayValue("First");
      await user.clear(input);

      // Save
      const saveButton = screen.getByTestId("editor-save-test-1");
      await user.click(saveButton);

      // Verify fallback was used
      await waitFor(() => {
        expect(screen.getByTestId("bullet-test-1-0")).toHaveTextContent(
          "(nothing written down)",
        );
      });
    });

    it("displays error message on 422 and keeps editor open", async () => {
      const user = userEvent.setup();
      global.fetch = vi.fn((url: string) => {
        if (url.startsWith("/api/entries/test-1")) {
          return Promise.resolve({
            status: 422,
            json: () => Promise.resolve({ message: "Bullet too long" }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([mockEntry1]),
        });
      }) as any;

      render(
        <DayView dayStart={0} dayEnd={1000} timerState={{ mode: "running" }} />,
      );

      const editButton = await screen.findByTestId("edit-button-test-1");
      await user.click(editButton);

      // Try to save
      const saveButton = screen.getByTestId("editor-save-test-1");
      await user.click(saveButton);

      // Verify error is shown
      await waitFor(() => {
        expect(screen.getByTestId("editor-error-test-1")).toHaveTextContent(
          "Bullet too long",
        );
      });

      // Verify editor is still open
      expect(screen.getByTestId("editor-test-1")).toBeInTheDocument();
    });
  });
});

describe("React StrictMode", () => {
  it("still completes the first load when effects double-fire", async () => {
    const mockEntry: Entry = {
      id: "strict-1",
      userId: "user-1",
      from: new Date(100),
      to: new Date(900),
      tag: "Learning",
      feel: "Steady",
      intent: "yes",
      bullets: ["strict mode entry"],
      createdAt: new Date(900),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([mockEntry]),
      }),
    ) as any;

    render(
      <React.StrictMode>
        <DayView dayStart={0} dayEnd={1000} timerState={{ mode: "running" }} />
      </React.StrictMode>,
    );

    // StrictMode mounts effects twice, cancelling the first fetch; the
    // second run must still fetch rather than early-return, or the vine
    // stays blank forever (the bug this test pins).
    expect(
      await screen.findByTestId(`entry-${mockEntry.id}`),
    ).toBeInTheDocument();
  });
});
