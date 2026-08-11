// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PickerStrip } from "./PickerStrip";
import { type UseTimerResult } from "@/lib/client/useTimer";

describe("PickerStrip", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a tag chip for every tag", () => {
    const updateDraft = vi.fn();
    const timerState: Partial<UseTimerResult> = { draftBullets: [""] };

    render(<PickerStrip timerState={timerState} updateDraft={updateDraft} />);

    expect(screen.getByTestId("chip-Deep work")).toBeInTheDocument();
    expect(screen.getByTestId("chip-Admin")).toBeInTheDocument();
  });

  it("selects a tag on click", async () => {
    const user = userEvent.setup();
    const updateDraft = vi.fn();
    const timerState: Partial<UseTimerResult> = { draftBullets: [""] };

    render(<PickerStrip timerState={timerState} updateDraft={updateDraft} />);

    await user.click(screen.getByTestId("chip-Admin"));
    expect(updateDraft).toHaveBeenCalledWith({ tag: "Admin" });
  });

  it("deselects a tag on reclick", async () => {
    const user = userEvent.setup();
    const updateDraft = vi.fn();
    const timerState: Partial<UseTimerResult> = {
      draftBullets: [""],
      draftTag: "Admin",
    };

    render(<PickerStrip timerState={timerState} updateDraft={updateDraft} />);

    await user.click(screen.getByTestId("chip-Admin"));
    expect(updateDraft).toHaveBeenCalledWith({ tag: null });
  });

  describe("accessibility", () => {
    it("groups the tag chips with a labelled group", () => {
      render(
        <PickerStrip
          timerState={{ draftBullets: [""] }}
          updateDraft={vi.fn()}
        />,
      );

      const group = screen.getByRole("group", { name: "Call it" });
      expect(group).toBeInTheDocument();
    });

    it("groups the feel row with a labelled group", () => {
      render(
        <PickerStrip
          timerState={{ draftBullets: [""] }}
          updateDraft={vi.fn()}
        />,
      );

      expect(
        screen.getByRole("group", { name: "Feeling" }),
      ).toBeInTheDocument();
    });

    it("groups the intent row with a labelled group", () => {
      render(
        <PickerStrip
          timerState={{ draftBullets: [""] }}
          updateDraft={vi.fn()}
        />,
      );

      expect(screen.getByRole("group", { name: "Intent" })).toBeInTheDocument();
    });

    it("exposes aria-pressed=false on an unselected tag chip", () => {
      render(
        <PickerStrip
          timerState={{ draftBullets: [""] }}
          updateDraft={vi.fn()}
        />,
      );

      expect(screen.getByTestId("chip-Admin")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });

    it("exposes aria-pressed=true on a selected tag chip", () => {
      render(
        <PickerStrip
          timerState={{ draftBullets: [""], draftTag: "Admin" }}
          updateDraft={vi.fn()}
        />,
      );

      expect(screen.getByTestId("chip-Admin")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });

    it("exposes aria-pressed on the feel row options", () => {
      render(
        <PickerStrip
          timerState={{ draftBullets: [""], draftFeel: "Charged" }}
          updateDraft={vi.fn()}
        />,
      );

      expect(screen.getByTestId("feel-Charged")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByTestId("feel-Steady")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });

    it("exposes aria-pressed on the intent row options", () => {
      render(
        <PickerStrip
          timerState={{ draftBullets: [""], draftIntent: "yes" }}
          updateDraft={vi.fn()}
        />,
      );

      expect(screen.getByTestId("intent-yes")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
  });
});
