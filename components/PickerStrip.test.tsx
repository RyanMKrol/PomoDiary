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

    for (const label of [
      "Admin",
      "Learning",
      "Errands",
      "Rest",
      "Leisure",
      "Social",
      "Chores",
    ]) {
      expect(screen.getByTestId(`chip-${label}`)).toBeInTheDocument();
    }
  });

  it("renders the sentence-builder header and row labels", () => {
    render(
      <PickerStrip timerState={{ draftBullets: [""] }} updateDraft={vi.fn()} />,
    );

    expect(screen.getByText("Call the hour")).toBeInTheDocument();
    expect(screen.getByText("It was mostly…")).toBeInTheDocument();
    expect(screen.getByText("It felt…")).toBeInTheDocument();
    expect(screen.getByText("And it was…")).toBeInTheDocument();
  });

  it("renders three intent buttons with the display labels", () => {
    render(
      <PickerStrip timerState={{ draftBullets: [""] }} updateDraft={vi.fn()} />,
    );

    expect(screen.getByTestId("intent-yes")).toHaveTextContent("Planned");
    expect(screen.getByTestId("intent-no")).toHaveTextContent("Unplanned");
    expect(screen.getByTestId("intent-mixed")).toHaveTextContent("Mixed");
  });

  it("selects the mixed intent on click", async () => {
    const user = userEvent.setup();
    const updateDraft = vi.fn();

    render(
      <PickerStrip
        timerState={{ draftBullets: [""] }}
        updateDraft={updateDraft}
      />,
    );

    await user.click(screen.getByTestId("intent-mixed"));
    expect(updateDraft).toHaveBeenCalledWith({ intent: "mixed" });
  });

  it("toggles an intent off on reclick", async () => {
    const user = userEvent.setup();
    const updateDraft = vi.fn();

    render(
      <PickerStrip
        timerState={{ draftBullets: [""], draftIntent: "mixed" }}
        updateDraft={updateDraft}
      />,
    );

    await user.click(screen.getByTestId("intent-mixed"));
    expect(updateDraft).toHaveBeenCalledWith({ intent: null });
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

      const group = screen.getByRole("group", { name: "It was mostly…" });
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

describe("PickerStrip accordion", () => {
  afterEach(() => {
    cleanup();
  });

  it("collapses to just the header when the toggle is clicked, and reopens", async () => {
    const user = userEvent.setup();
    const timerState: Partial<UseTimerResult> = {
      mode: "running",
      draftBullets: [""],
    };

    render(<PickerStrip timerState={timerState} updateDraft={vi.fn()} />);

    expect(screen.getByTestId("chip-Admin")).toBeInTheDocument();

    await user.click(screen.getByTestId("picker-strip-toggle"));
    expect(screen.queryByTestId("chip-Admin")).not.toBeInTheDocument();
    expect(screen.getByTestId("picker-strip-toggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    await user.click(screen.getByTestId("picker-strip-toggle"));
    expect(screen.getByTestId("chip-Admin")).toBeInTheDocument();
  });

  it("stays open during recap even when collapsed — the chips call the hour", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <PickerStrip
        timerState={{ mode: "running", draftBullets: [""] }}
        updateDraft={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId("picker-strip-toggle"));
    expect(screen.queryByTestId("chip-Admin")).not.toBeInTheDocument();

    rerender(
      <PickerStrip
        timerState={{ mode: "recap", draftBullets: [""] }}
        updateDraft={vi.fn()}
      />,
    );
    expect(screen.getByTestId("chip-Admin")).toBeInTheDocument();
  });
});
