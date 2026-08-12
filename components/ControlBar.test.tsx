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
import { ControlBar } from "./ControlBar";
import type { UseTimerResult } from "@/lib/client/useTimer";

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

describe("ControlBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe("rendering in different modes", () => {
    it("renders when mode is running", () => {
      const { container } = render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          awayStart={vi.fn()}
        />,
      );
      const bar = container.querySelector("[data-testid='control-bar']");
      expect(bar).toBeInTheDocument();
    });

    it("renders when mode is paused", () => {
      const { container } = render(
        <ControlBar
          timerState={{ mode: "paused" } as Partial<UseTimerResult>}
          awayStart={vi.fn()}
        />,
      );
      const bar = container.querySelector("[data-testid='control-bar']");
      expect(bar).toBeInTheDocument();
    });

    it("does not render when mode is chime", () => {
      const { container } = render(
        <ControlBar
          timerState={{ mode: "chime" } as Partial<UseTimerResult>}
          awayStart={vi.fn()}
        />,
      );
      const bar = container.querySelector("[data-testid='control-bar']");
      expect(bar).not.toBeInTheDocument();
    });

    it("does not render when mode is recap", () => {
      const { container } = render(
        <ControlBar
          timerState={{ mode: "recap" } as Partial<UseTimerResult>}
          awayStart={vi.fn()}
        />,
      );
      const bar = container.querySelector("[data-testid='control-bar']");
      expect(bar).not.toBeInTheDocument();
    });

    it("does not render when mode is away", () => {
      const { container } = render(
        <ControlBar
          timerState={{ mode: "away" } as Partial<UseTimerResult>}
          awayStart={vi.fn()}
        />,
      );
      const bar = container.querySelector("[data-testid='control-bar']");
      expect(bar).not.toBeInTheDocument();
    });
  });

  describe("removed affordances", () => {
    it("renders no End early button (the hour only ends at :00)", () => {
      const { container } = render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          awayStart={vi.fn()}
        />,
      );
      expect(
        container.querySelector("[data-testid='control-end-early']"),
      ).not.toBeInTheDocument();
    });
  });

  describe("sleep button", () => {
    it("renders sleep button", () => {
      render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          awayStart={vi.fn()}
        />,
      );
      const button = screen.getByTestId("control-sleep");
      expect(button).toHaveTextContent("Sleep");
    });

    it("calls awayStart with sleep when button is clicked", async () => {
      const awayStart = vi.fn();
      const user = userEvent.setup();
      render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          awayStart={awayStart}
        />,
      );
      const button = screen.getByTestId("control-sleep");
      await user.click(button);
      expect(awayStart).toHaveBeenCalledWith("sleep");
    });

    it("has purple swatch with oklch color", () => {
      const { container } = render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          awayStart={vi.fn()}
        />,
      );
      const swatch = container.querySelector(
        "[data-testid='control-swatch-sleep']",
      );
      expect(swatch).toHaveStyle({ backgroundColor: "oklch(0.38 0.055 275)" });
    });
  });

  describe("work button", () => {
    it("renders work button", () => {
      render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          awayStart={vi.fn()}
        />,
      );
      const button = screen.getByTestId("control-work");
      expect(button).toHaveTextContent("Work");
    });

    it("calls awayStart with work when button is clicked", async () => {
      const awayStart = vi.fn();
      const user = userEvent.setup();
      render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          awayStart={awayStart}
        />,
      );
      const button = screen.getByTestId("control-work");
      await user.click(button);
      expect(awayStart).toHaveBeenCalledWith("work");
    });

    it("has blue swatch with oklch color", () => {
      const { container } = render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          awayStart={vi.fn()}
        />,
      );
      const swatch = container.querySelector(
        "[data-testid='control-swatch-work']",
      );
      expect(swatch).toHaveStyle({ backgroundColor: "oklch(0.50 0.075 235)" });
    });
  });

  describe("gym button", () => {
    it("renders gym button", () => {
      render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          awayStart={vi.fn()}
        />,
      );
      const button = screen.getByTestId("control-gym");
      expect(button).toHaveTextContent("Gym");
    });

    it("calls awayStart with gym when button is clicked", async () => {
      const awayStart = vi.fn();
      const user = userEvent.setup();
      render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          awayStart={awayStart}
        />,
      );
      const button = screen.getByTestId("control-gym");
      await user.click(button);
      expect(awayStart).toHaveBeenCalledWith("gym");
    });

    it("has green swatch with oklch color", () => {
      const { container } = render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          awayStart={vi.fn()}
        />,
      );
      const swatch = container.querySelector(
        "[data-testid='control-swatch-gym']",
      );
      expect(swatch).toHaveStyle({ backgroundColor: "oklch(0.50 0.09 120)" });
    });
  });

  describe("custom away (Else…)", () => {
    const settingsWith = (recentAwayLabels: string[]) => ({
      soundOn: true,
      chimeVolume: 0.5,
      pauseAfterLog: false,
      recentAwayLabels,
    });

    it("opens the custom area with the input when Else… is clicked", async () => {
      const user = userEvent.setup();
      render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          awayStart={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("control-away-more"));

      expect(screen.getByTestId("control-custom-area")).toBeInTheDocument();
      const input = screen.getByTestId("control-custom-input");
      expect(input).toHaveAttribute("placeholder", "Gone for a while, doing…");
      // The away-kind buttons swap out for the custom area
      expect(screen.queryByTestId("control-sleep")).not.toBeInTheDocument();
    });

    it("submits the trimmed label via awayStart on Enter", async () => {
      const awayStart = vi.fn();
      const user = userEvent.setup();
      render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          awayStart={awayStart}
        />,
      );

      await user.click(screen.getByTestId("control-away-more"));
      await user.type(
        screen.getByTestId("control-custom-input"),
        "  Trimmed Label  {Enter}",
      );

      expect(awayStart).toHaveBeenCalledWith("custom", "Trimmed Label");
    });

    it("does nothing on Enter when the input is empty", async () => {
      const awayStart = vi.fn();
      const user = userEvent.setup();
      render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          awayStart={awayStart}
        />,
      );

      await user.click(screen.getByTestId("control-away-more"));
      await user.type(screen.getByTestId("control-custom-input"), "{Enter}");

      expect(awayStart).not.toHaveBeenCalled();
      expect(screen.getByTestId("control-custom-area")).toBeInTheDocument();
    });

    it("closes back to the away buttons on Escape", async () => {
      const awayStart = vi.fn();
      const user = userEvent.setup();
      render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          awayStart={awayStart}
        />,
      );

      await user.click(screen.getByTestId("control-away-more"));
      await user.type(
        screen.getByTestId("control-custom-input"),
        "Somewhere{Escape}",
      );

      expect(
        screen.queryByTestId("control-custom-area"),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("control-sleep")).toBeInTheDocument();
      expect(awayStart).not.toHaveBeenCalled();
    });

    it("submits the typed label when the Go button is clicked", async () => {
      const awayStart = vi.fn();
      const user = userEvent.setup();
      render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          awayStart={awayStart}
        />,
      );

      await user.click(screen.getByTestId("control-away-more"));
      await user.type(screen.getByTestId("control-custom-input"), "Travelling");
      await user.click(screen.getByTestId("control-custom-go"));

      expect(awayStart).toHaveBeenCalledWith("custom", "Travelling");
    });

    it("closes the custom area when the cancel button is clicked", async () => {
      const awayStart = vi.fn();
      const user = userEvent.setup();
      render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          awayStart={awayStart}
        />,
      );

      await user.click(screen.getByTestId("control-away-more"));
      await user.click(screen.getByTestId("control-custom-cancel"));

      expect(
        screen.queryByTestId("control-custom-area"),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("control-sleep")).toBeInTheDocument();
      expect(awayStart).not.toHaveBeenCalled();
    });

    it("renders recent-label chips from settings.recentAwayLabels", async () => {
      const user = userEvent.setup();
      render(
        <ControlBar
          timerState={
            {
              mode: "running",
              settings: settingsWith(["Travelling", "School run"]),
            } as Partial<UseTimerResult>
          }
          awayStart={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("control-away-more"));

      expect(screen.getByTestId("control-recent-0")).toHaveTextContent(
        "Travelling",
      );
      expect(screen.getByTestId("control-recent-1")).toHaveTextContent(
        "School run",
      );
    });

    it("dispatches awayStart immediately when a recent chip is clicked", async () => {
      const awayStart = vi.fn();
      const user = userEvent.setup();
      render(
        <ControlBar
          timerState={
            {
              mode: "running",
              settings: settingsWith(["Travelling", "School run"]),
            } as Partial<UseTimerResult>
          }
          awayStart={awayStart}
        />,
      );

      await user.click(screen.getByTestId("control-away-more"));
      await user.click(screen.getByTestId("control-recent-1"));

      expect(awayStart).toHaveBeenCalledWith("custom", "School run");
      expect(
        screen.queryByTestId("control-custom-area"),
      ).not.toBeInTheDocument();
    });

    it("renders no chips when there are no recent labels", async () => {
      const user = userEvent.setup();
      render(
        <ControlBar
          timerState={
            {
              mode: "running",
              settings: settingsWith([]),
            } as Partial<UseTimerResult>
          }
          awayStart={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("control-away-more"));

      expect(screen.queryByTestId("control-recent-0")).not.toBeInTheDocument();
    });
  });

  describe("swatch appearance", () => {
    it("sleep swatch is a 9x9 square with the correct color", () => {
      const { container } = render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          awayStart={vi.fn()}
        />,
      );
      const swatch = container.querySelector(
        "[data-testid='control-swatch-sleep']",
      );
      expect(swatch).toHaveStyle({ backgroundColor: "oklch(0.38 0.055 275)" });
    });

    it("work swatch has correct color", () => {
      const { container } = render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          awayStart={vi.fn()}
        />,
      );
      const swatch = container.querySelector(
        "[data-testid='control-swatch-work']",
      );
      expect(swatch).toHaveStyle({ backgroundColor: "oklch(0.50 0.075 235)" });
    });
  });
});
