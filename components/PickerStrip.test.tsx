// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  describe,
  expect,
  it,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PickerStrip } from "./PickerStrip";
import { type UseTimerResult } from "@/lib/client/useTimer";
import styles from "./PickerStrip.module.css";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

describe("PickerStrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("renders the label row with 'Call it' text", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: [""],
        draftTag: null,
        draftFeel: null,
        draftIntent: null,
      };

      render(<PickerStrip timerState={timerState} updateDraft={updateDraft} />);

      expect(screen.getByText("Call it")).toBeInTheDocument();
    });

    it("shows inferred tag hint when there is inference and no explicit pick", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: ["Wrote the pricing page"],
        draftTag: null,
        draftFeel: null,
        draftIntent: null,
      };

      render(<PickerStrip timerState={timerState} updateDraft={updateDraft} />);

      // inferTag should detect "wrote" and infer "Deep work"
      expect(screen.getByText(/reads like deep work/i)).toBeInTheDocument();
    });

    it("hides inferred tag hint when there is an explicit pick", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: ["Wrote the pricing page"],
        draftTag: "Comms",
        draftFeel: null,
        draftIntent: null,
      };

      render(<PickerStrip timerState={timerState} updateDraft={updateDraft} />);

      expect(screen.queryByText(/reads like/)).not.toBeInTheDocument();
    });

    it("renders all tag chips in TAGS order", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: [""],
        draftTag: null,
        draftFeel: null,
        draftIntent: null,
      };

      render(<PickerStrip timerState={timerState} updateDraft={updateDraft} />);

      expect(screen.getByText(/Deep work/i)).toBeInTheDocument();
      expect(screen.getByText(/Admin/i)).toBeInTheDocument();
      expect(screen.getByText(/Meetings/i)).toBeInTheDocument();
      expect(screen.getByText(/Comms/i)).toBeInTheDocument();
      expect(screen.getByText(/Learning/i)).toBeInTheDocument();
      expect(screen.getByText(/Errands/i)).toBeInTheDocument();
      expect(screen.getByText(/Rest/i)).toBeInTheDocument();
      expect(screen.getByText(/Lost it/i)).toBeInTheDocument();
    });

    it("renders feeling row with 4 segments", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: [""],
        draftTag: null,
        draftFeel: null,
        draftIntent: null,
      };

      render(<PickerStrip timerState={timerState} updateDraft={updateDraft} />);

      expect(screen.getByText("Charged")).toBeInTheDocument();
      expect(screen.getByText("Steady")).toBeInTheDocument();
      expect(screen.getByText("Scattered")).toBeInTheDocument();
      expect(screen.getByText("Drained")).toBeInTheDocument();
    });

    it("renders intent row with 2 segments", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: [""],
        draftTag: null,
        draftFeel: null,
        draftIntent: null,
      };

      render(<PickerStrip timerState={timerState} updateDraft={updateDraft} />);

      expect(screen.getByText("On purpose")).toBeInTheDocument();
      expect(screen.getByText("Got away")).toBeInTheDocument();
    });

    it("is pinned with flex:0 0 auto", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: [""],
        draftTag: null,
        draftFeel: null,
        draftIntent: null,
      };

      const { container } = render(
        <PickerStrip timerState={timerState} updateDraft={updateDraft} />,
      );

      const strip = container.querySelector("[data-testid='picker-strip']");
      expect(strip).toHaveClass(styles.strip);
    });
  });

  describe("chip state — idle", () => {
    it("renders idle chip with transparent fill and divider border", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: [""],
        draftTag: null,
        draftFeel: null,
        draftIntent: null,
      };

      const { container } = render(
        <PickerStrip timerState={timerState} updateDraft={updateDraft} />,
      );

      const deepWorkChip = container.querySelector(
        '[data-testid="chip-Deep work"]',
      );
      expect(deepWorkChip).toHaveClass(styles.chipIdle);
    });
  });

  describe("chip state — suggested", () => {
    it("renders suggested chip with category color border and text", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: ["Wrote the design system"],
        draftTag: null,
        draftFeel: null,
        draftIntent: null,
      };

      const { container } = render(
        <PickerStrip timerState={timerState} updateDraft={updateDraft} />,
      );

      const deepWorkChip = container.querySelector(
        '[data-testid="chip-Deep work"]',
      );
      expect(deepWorkChip).toHaveClass(styles.chipSuggested);
    });
  });

  describe("chip state — selected", () => {
    it("renders selected chip with category color fill and white text", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: [""],
        draftTag: "Deep work",
        draftFeel: null,
        draftIntent: null,
      };

      const { container } = render(
        <PickerStrip timerState={timerState} updateDraft={updateDraft} />,
      );

      const deepWorkChip = container.querySelector(
        '[data-testid="chip-Deep work"]',
      );
      expect(deepWorkChip).toHaveClass(styles.chipSelected);
    });
  });

  describe("chip interactions", () => {
    it("clicking an unselected chip selects it", async () => {
      const updateDraft = vi.fn();
      const user = userEvent.setup();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: [""],
        draftTag: null,
        draftFeel: null,
        draftIntent: null,
      };

      const { container } = render(
        <PickerStrip timerState={timerState} updateDraft={updateDraft} />,
      );

      const deepWorkChip = container.querySelector(
        '[data-testid="chip-Deep work"]',
      ) as HTMLElement;

      await user.click(deepWorkChip);

      expect(updateDraft).toHaveBeenCalledWith({ tag: "Deep work" });
    });

    it("clicking a selected chip deselects it", async () => {
      const updateDraft = vi.fn();
      const user = userEvent.setup();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: [""],
        draftTag: "Deep work",
        draftFeel: null,
        draftIntent: null,
      };

      const { container } = render(
        <PickerStrip timerState={timerState} updateDraft={updateDraft} />,
      );

      const deepWorkChip = container.querySelector(
        '[data-testid="chip-Deep work"]',
      ) as HTMLElement;

      await user.click(deepWorkChip);

      expect(updateDraft).toHaveBeenCalledWith({ tag: null });
    });

    it("explicit pick beats suggestion", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: ["Wrote the design"],
        draftTag: "Comms",
        draftFeel: null,
        draftIntent: null,
      };

      const { container } = render(
        <PickerStrip timerState={timerState} updateDraft={updateDraft} />,
      );

      // Deep work would be suggested but Comms is picked
      const commsChip = container.querySelector('[data-testid="chip-Comms"]');
      expect(commsChip).toHaveClass(styles.chipSelected);

      const deepWorkChip = container.querySelector(
        '[data-testid="chip-Deep work"]',
      );
      expect(deepWorkChip).not.toHaveClass(styles.chipSelected);
    });

    it("suggestion disappears once a chip is picked", async () => {
      const updateDraft = vi.fn();
      const user = userEvent.setup();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: ["Wrote the design"],
        draftTag: null,
        draftFeel: null,
        draftIntent: null,
      };

      const { container, rerender } = render(
        <PickerStrip timerState={timerState} updateDraft={updateDraft} />,
      );

      // First, suggestion should be visible
      expect(screen.getByText(/reads like deep work/i)).toBeInTheDocument();

      // Now pick a tag
      const deepWorkChip = container.querySelector(
        '[data-testid="chip-Deep work"]',
      ) as HTMLElement;
      await user.click(deepWorkChip);

      // Re-render with the picked tag
      const newTimerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: ["Wrote the design"],
        draftTag: "Deep work",
        draftFeel: null,
        draftIntent: null,
      };

      rerender(
        <PickerStrip timerState={newTimerState} updateDraft={updateDraft} />,
      );

      // Suggestion should not appear because tag is picked
      expect(screen.queryByText(/reads like/)).not.toBeInTheDocument();
    });
  });

  describe("feeling row", () => {
    it("clicking a feeling button selects it", async () => {
      const updateDraft = vi.fn();
      const user = userEvent.setup();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: [""],
        draftTag: null,
        draftFeel: null,
        draftIntent: null,
      };

      render(<PickerStrip timerState={timerState} updateDraft={updateDraft} />);

      const chargedButton = screen.getByText("Charged");
      await user.click(chargedButton);

      expect(updateDraft).toHaveBeenCalledWith({ feel: "Charged" });
    });

    it("clicking a selected feeling button deselects it", async () => {
      const updateDraft = vi.fn();
      const user = userEvent.setup();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: [""],
        draftTag: null,
        draftFeel: "Charged",
        draftIntent: null,
      };

      render(<PickerStrip timerState={timerState} updateDraft={updateDraft} />);

      const chargedButton = screen.getByText("Charged");
      await user.click(chargedButton);

      expect(updateDraft).toHaveBeenCalledWith({ feel: null });
    });

    it("selected feeling has ink fill not color", () => {
      const updateDraft = vi.fn();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: [""],
        draftTag: null,
        draftFeel: "Charged",
        draftIntent: null,
      };

      const { container } = render(
        <PickerStrip timerState={timerState} updateDraft={updateDraft} />,
      );

      const chargedButton = container.querySelector(
        '[data-testid="feel-Charged"]',
      ) as HTMLElement;
      expect(chargedButton).toHaveClass(styles.feelSelected);
    });
  });

  describe("intent row", () => {
    it("stores 'yes' key for 'On purpose' intent", async () => {
      const updateDraft = vi.fn();
      const user = userEvent.setup();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: [""],
        draftTag: null,
        draftFeel: null,
        draftIntent: null,
      };

      render(<PickerStrip timerState={timerState} updateDraft={updateDraft} />);

      const onPurposeButton = screen.getByText("On purpose");
      await user.click(onPurposeButton);

      expect(updateDraft).toHaveBeenCalledWith({ intent: "yes" });
    });

    it("stores 'no' key for 'Got away' intent", async () => {
      const updateDraft = vi.fn();
      const user = userEvent.setup();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: [""],
        draftTag: null,
        draftFeel: null,
        draftIntent: null,
      };

      render(<PickerStrip timerState={timerState} updateDraft={updateDraft} />);

      const gotAwayButton = screen.getByText("Got away");
      await user.click(gotAwayButton);

      expect(updateDraft).toHaveBeenCalledWith({ intent: "no" });
    });

    it("clicking a selected intent button deselects it", async () => {
      const updateDraft = vi.fn();
      const user = userEvent.setup();
      const timerState: Partial<UseTimerResult> = {
        mode: "recap",
        draftBullets: [""],
        draftTag: null,
        draftFeel: null,
        draftIntent: "yes",
      };

      render(<PickerStrip timerState={timerState} updateDraft={updateDraft} />);

      const onPurposeButton = screen.getByText("On purpose");
      await user.click(onPurposeButton);

      expect(updateDraft).toHaveBeenCalledWith({ intent: null });
    });
  });

  describe("inference and chip-state interactions", () => {
    it("suggestion appears from typed bullets and disappears once picked", () => {
      const updateDraft = vi.fn();

      const { rerender } = render(
        <PickerStrip
          timerState={{
            mode: "recap",
            draftBullets: [""],
            draftTag: null,
            draftFeel: null,
            draftIntent: null,
          }}
          updateDraft={updateDraft}
        />,
      );

      expect(screen.queryByText(/reads like/)).not.toBeInTheDocument();

      // Add bullets that trigger inference
      rerender(
        <PickerStrip
          timerState={{
            mode: "recap",
            draftBullets: ["Rewrote the API"],
            draftTag: null,
            draftFeel: null,
            draftIntent: null,
          }}
          updateDraft={updateDraft}
        />,
      );

      expect(screen.getByText(/reads like deep work/i)).toBeInTheDocument();

      // Pick a tag
      rerender(
        <PickerStrip
          timerState={{
            mode: "recap",
            draftBullets: ["Rewrote the API"],
            draftTag: "Deep work",
            draftFeel: null,
            draftIntent: null,
          }}
          updateDraft={updateDraft}
        />,
      );

      expect(screen.queryByText(/reads like/)).not.toBeInTheDocument();
    });

    it("suggested chip styling differs from selected chip styling", () => {
      const updateDraft = vi.fn();

      const { container, rerender } = render(
        <PickerStrip
          timerState={{
            mode: "recap",
            draftBullets: ["Wrote a blog post"],
            draftTag: null,
            draftFeel: null,
            draftIntent: null,
          }}
          updateDraft={updateDraft}
        />,
      );

      const deepWorkSuggested = container.querySelector(
        '[data-testid="chip-Deep work"]',
      );
      expect(deepWorkSuggested).toHaveClass(styles.chipSuggested);
      expect(deepWorkSuggested).not.toHaveClass(styles.chipSelected);

      // Now select it
      rerender(
        <PickerStrip
          timerState={{
            mode: "recap",
            draftBullets: ["Wrote a blog post"],
            draftTag: "Deep work",
            draftFeel: null,
            draftIntent: null,
          }}
          updateDraft={updateDraft}
        />,
      );

      const deepWorkSelected = container.querySelector(
        '[data-testid="chip-Deep work"]',
      );
      expect(deepWorkSelected).toHaveClass(styles.chipSelected);
      expect(deepWorkSelected).not.toHaveClass(styles.chipSuggested);
    });
  });
});
