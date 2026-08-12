// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntryEditor } from "./EntryEditor";
import type { Entry } from "@/lib/db/entries.store";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EntryEditor", () => {
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

  describe("rendering", () => {
    it("renders all bullet inputs with current values", () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();

      render(
        <EntryEditor entry={mockEntry} onSave={onSave} onCancel={onCancel} />,
      );

      expect(screen.getByDisplayValue("Wrote the report")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Fixed a bug")).toBeInTheDocument();
    });

    it("renders tag chips with current selection", () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();

      render(
        <EntryEditor entry={mockEntry} onSave={onSave} onCancel={onCancel} />,
      );

      const learningChip = screen.getByTestId(
        "editor-chip-test-1-Learning",
      ) as HTMLButtonElement;
      expect(learningChip.className).toContain("tagChipSelected");
    });

    it("renders feel chips with current selection", () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();

      render(
        <EntryEditor entry={mockEntry} onSave={onSave} onCancel={onCancel} />,
      );

      const chargedChip = screen.getByTestId(
        "editor-feel-test-1-Charged",
      ) as HTMLButtonElement;
      expect(chargedChip.className).toContain("feelChipSelected");
    });

    it("renders intent chips with current selection", () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();

      render(
        <EntryEditor entry={mockEntry} onSave={onSave} onCancel={onCancel} />,
      );

      const intentChip = screen.getByTestId(
        "editor-intent-test-1-yes",
      ) as HTMLButtonElement;
      expect(intentChip.className).toContain("intentChipSelected");
    });

    it("renders Save and Cancel buttons", () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();

      render(
        <EntryEditor entry={mockEntry} onSave={onSave} onCancel={onCancel} />,
      );

      expect(screen.getByTestId("editor-save-test-1")).toBeInTheDocument();
      expect(screen.getByTestId("editor-cancel-test-1")).toBeInTheDocument();
    });
  });

  describe("bullet editing", () => {
    it("updates bullet text on input change", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const onCancel = vi.fn();

      render(
        <EntryEditor entry={mockEntry} onSave={onSave} onCancel={onCancel} />,
      );

      const input = screen.getByDisplayValue("Wrote the report");
      await user.clear(input);
      await user.type(input, "Updated the report");

      expect(
        screen.getByDisplayValue("Updated the report"),
      ).toBeInTheDocument();
    });

    it("adds new bullet on Enter key", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const onCancel = vi.fn();

      render(
        <EntryEditor entry={mockEntry} onSave={onSave} onCancel={onCancel} />,
      );

      const lastInput = screen.getByDisplayValue("Fixed a bug");
      await user.click(lastInput);
      await user.keyboard("{Enter}");

      const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
      const newInput = inputs[inputs.length - 1];
      expect(newInput).toBeInTheDocument();
      expect(newInput.value).toBe("");
    });

    it("removes empty bullet on Backspace", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const onCancel = vi.fn();

      render(
        <EntryEditor entry={mockEntry} onSave={onSave} onCancel={onCancel} />,
      );

      // First add a new empty bullet
      const lastInput = screen.getByDisplayValue("Fixed a bug");
      await user.click(lastInput);
      await user.keyboard("{Enter}");

      // Now remove it with Backspace
      const emptyInputs = screen.getAllByDisplayValue("");
      const emptyInput = emptyInputs[emptyInputs.length - 1];
      await user.click(emptyInput);
      await user.keyboard("{Backspace}");

      // Should only have the original 2 bullets
      expect(screen.getByDisplayValue("Wrote the report")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Fixed a bug")).toBeInTheDocument();
    });
  });

  describe("tag editing", () => {
    it("changes tag on chip click", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const onCancel = vi.fn();

      render(
        <EntryEditor entry={mockEntry} onSave={onSave} onCancel={onCancel} />,
      );

      const adminChip = screen.getByTestId("editor-chip-test-1-Admin");
      await user.click(adminChip);

      expect(adminChip.className).toContain("tagChipSelected");
      const learningChip = screen.getByTestId("editor-chip-test-1-Learning");
      expect(learningChip.className).not.toContain("tagChipSelected");
    });
  });

  describe("feel editing", () => {
    it("changes feel on chip click", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const onCancel = vi.fn();

      render(
        <EntryEditor entry={mockEntry} onSave={onSave} onCancel={onCancel} />,
      );

      const drainedChip = screen.getByTestId("editor-feel-test-1-Drained");
      await user.click(drainedChip);

      expect(drainedChip.className).toContain("feelChipSelected");
      const chargedChip = screen.getByTestId("editor-feel-test-1-Charged");
      expect(chargedChip.className).not.toContain("feelChipSelected");
    });
  });

  describe("intent editing", () => {
    it("renders all three intent chips with their display labels", () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();

      render(
        <EntryEditor entry={mockEntry} onSave={onSave} onCancel={onCancel} />,
      );

      expect(screen.getByTestId("editor-intent-test-1-yes")).toHaveTextContent(
        "Planned",
      );
      expect(screen.getByTestId("editor-intent-test-1-no")).toHaveTextContent(
        "Unplanned",
      );
      expect(
        screen.getByTestId("editor-intent-test-1-mixed"),
      ).toHaveTextContent("Mixed");
    });

    it("changes intent on chip click", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const onCancel = vi.fn();

      render(
        <EntryEditor entry={mockEntry} onSave={onSave} onCancel={onCancel} />,
      );

      const noChip = screen.getByTestId("editor-intent-test-1-no");
      await user.click(noChip);

      expect(noChip.className).toContain("intentChipSelected");
      const yesChip = screen.getByTestId("editor-intent-test-1-yes");
      expect(yesChip.className).not.toContain("intentChipSelected");
    });

    it("selects the mixed intent on chip click", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const onCancel = vi.fn();

      render(
        <EntryEditor entry={mockEntry} onSave={onSave} onCancel={onCancel} />,
      );

      const mixedChip = screen.getByTestId("editor-intent-test-1-mixed");
      await user.click(mixedChip);

      expect(mixedChip.className).toContain("intentChipSelected");
      const yesChip = screen.getByTestId("editor-intent-test-1-yes");
      expect(yesChip.className).not.toContain("intentChipSelected");
    });
  });

  describe("cancel", () => {
    it("calls onCancel when Cancel button clicked", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const onCancel = vi.fn();

      render(
        <EntryEditor entry={mockEntry} onSave={onSave} onCancel={onCancel} />,
      );

      const cancelButton = screen.getByTestId("editor-cancel-test-1");
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalledOnce();
      expect(onSave).not.toHaveBeenCalled();
    });

    it("discards unsaved changes on cancel", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const onCancel = vi.fn();

      render(
        <EntryEditor entry={mockEntry} onSave={onSave} onCancel={onCancel} />,
      );

      // Make a change
      const input = screen.getByDisplayValue("Wrote the report");
      await user.clear(input);
      await user.type(input, "Changed text");

      // Cancel
      const cancelButton = screen.getByTestId("editor-cancel-test-1");
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalledOnce();
    });
  });

  describe("save", () => {
    it("patches only changed fields on save", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const onCancel = vi.fn();

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockEntry),
        }),
      ) as any;

      render(
        <EntryEditor entry={mockEntry} onSave={onSave} onCancel={onCancel} />,
      );

      // Change only the tag
      const adminChip = screen.getByTestId("editor-chip-test-1-Admin");
      await user.click(adminChip);

      const saveButton = screen.getByTestId("editor-save-test-1");
      await user.click(saveButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/entries/test-1",
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({ tag: "Admin" }),
          }),
        );
      });
    });

    it("keeps an off-list custom tag when only a bullet changes", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const onCancel = vi.fn();

      // Tag typed by the user via the custom-away flow — not in TAGS.
      const customEntry: Entry = {
        ...mockEntry,
        id: "test-custom",
        tag: "Travelling",
        feel: "—",
        bullets: ["Travelling"],
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(customEntry),
        }),
      ) as any;

      render(
        <EntryEditor entry={customEntry} onSave={onSave} onCancel={onCancel} />,
      );

      const input = screen.getByDisplayValue("Travelling");
      await user.clear(input);
      await user.type(input, "Train to Glasgow");

      const saveButton = screen.getByTestId("editor-save-test-custom");
      await user.click(saveButton);

      await waitFor(() => {
        const callBody = JSON.parse(
          (global.fetch as any).mock.calls[0][1].body,
        );
        expect(callBody.bullets).toEqual(["Train to Glasgow"]);
        // The PATCH must not touch the tag — the custom label survives.
        expect("tag" in callBody).toBe(false);
      });
    });

    it("trims bullets and drops empties on save", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const onCancel = vi.fn();

      const entryWithWhitespace: Entry = {
        ...mockEntry,
        bullets: ["  Text with spaces  ", "", "Another"],
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(entryWithWhitespace),
        }),
      ) as any;

      render(
        <EntryEditor
          entry={entryWithWhitespace}
          onSave={onSave}
          onCancel={onCancel}
        />,
      );

      const saveButton = screen.getByTestId("editor-save-test-1");
      await user.click(saveButton);

      await waitFor(() => {
        const callBody = JSON.parse(
          (global.fetch as any).mock.calls[0][1].body,
        );
        expect(callBody.bullets).toEqual(["Text with spaces", "Another"]);
      });
    });

    it("converts all-empty bullets to fallback on save", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const onCancel = vi.fn();

      const emptyEntry: Entry = {
        ...mockEntry,
        bullets: [],
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(emptyEntry),
        }),
      ) as any;

      render(
        <EntryEditor entry={emptyEntry} onSave={onSave} onCancel={onCancel} />,
      );

      const saveButton = screen.getByTestId("editor-save-test-1");
      await user.click(saveButton);

      await waitFor(() => {
        const callBody = JSON.parse(
          (global.fetch as any).mock.calls[0][1].body,
        );
        expect(callBody.bullets).toEqual(["(nothing written down)"]);
      });
    });

    it("shows error on 422 validation failure", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const onCancel = vi.fn();

      global.fetch = vi.fn(() =>
        Promise.resolve({
          status: 422,
          json: () => Promise.resolve({ message: "Bullet too long" }),
        }),
      ) as any;

      render(
        <EntryEditor entry={mockEntry} onSave={onSave} onCancel={onCancel} />,
      );

      const saveButton = screen.getByTestId("editor-save-test-1");
      await user.click(saveButton);

      await waitFor(() => {
        const error = screen.getByTestId("editor-error-test-1");
        expect(error).toHaveTextContent("Bullet too long");
      });
    });

    it("keeps edit open on 422 error", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const onCancel = vi.fn();

      global.fetch = vi.fn(() =>
        Promise.resolve({
          status: 422,
          json: () => Promise.resolve({ message: "Validation failed" }),
        }),
      ) as any;

      render(
        <EntryEditor entry={mockEntry} onSave={onSave} onCancel={onCancel} />,
      );

      const saveButton = screen.getByTestId("editor-save-test-1");
      await user.click(saveButton);

      await waitFor(() => {
        expect(onSave).not.toHaveBeenCalled();
        // Verify we're still in edit mode (Save button is still there)
        expect(screen.getByTestId("editor-save-test-1")).toBeInTheDocument();
      });
    });

    it("calls onSave with updated entry on success", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const onCancel = vi.fn();

      const updatedEntry: Entry = {
        ...mockEntry,
        tag: "Admin",
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(updatedEntry),
        }),
      ) as any;

      render(
        <EntryEditor entry={mockEntry} onSave={onSave} onCancel={onCancel} />,
      );

      const adminChip = screen.getByTestId("editor-chip-test-1-Admin");
      await user.click(adminChip);

      const saveButton = screen.getByTestId("editor-save-test-1");
      await user.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(updatedEntry);
      });
    });
  });
});
