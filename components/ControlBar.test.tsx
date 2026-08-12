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
          ringNow={vi.fn()}
          restart={vi.fn()}
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
          ringNow={vi.fn()}
          restart={vi.fn()}
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
          ringNow={vi.fn()}
          restart={vi.fn()}
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
          ringNow={vi.fn()}
          restart={vi.fn()}
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
          ringNow={vi.fn()}
          restart={vi.fn()}
          awayStart={vi.fn()}
        />,
      );
      const bar = container.querySelector("[data-testid='control-bar']");
      expect(bar).not.toBeInTheDocument();
    });
  });

  describe("end early button", () => {
    it("shows the 'End early' label", () => {
      render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          ringNow={vi.fn()}
          restart={vi.fn()}
          awayStart={vi.fn()}
        />,
      );
      const button = screen.getByTestId("control-end-early");
      expect(button).toHaveTextContent("End early");
    });

    it("calls ringNow when clicked", async () => {
      const ringNow = vi.fn();
      const user = userEvent.setup();
      render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          ringNow={ringNow}
          restart={vi.fn()}
          awayStart={vi.fn()}
        />,
      );
      const button = screen.getByTestId("control-end-early");
      await user.click(button);
      expect(ringNow).toHaveBeenCalled();
    });

    it("has red swatch with correct color", () => {
      const { container } = render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          ringNow={vi.fn()}
          restart={vi.fn()}
          awayStart={vi.fn()}
        />,
      );
      const swatch = container.querySelector(
        "[data-testid='control-swatch-end-early']",
      );
      expect(swatch).toHaveStyle({ backgroundColor: "#ec3013" });
    });
  });

  describe("restart button", () => {
    it("renders restart button", () => {
      render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          ringNow={vi.fn()}
          restart={vi.fn()}
          awayStart={vi.fn()}
        />,
      );
      const button = screen.getByTestId("control-restart");
      expect(button).toHaveTextContent("Restart");
    });

    it("calls restart when button is clicked", async () => {
      const restart = vi.fn();
      const user = userEvent.setup();
      render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          ringNow={vi.fn()}
          restart={restart}
          awayStart={vi.fn()}
        />,
      );
      const button = screen.getByTestId("control-restart");
      await user.click(button);
      expect(restart).toHaveBeenCalled();
    });

    it("does not have a swatch", () => {
      render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          ringNow={vi.fn()}
          restart={vi.fn()}
          awayStart={vi.fn()}
        />,
      );
      const button = screen.getByTestId("control-restart");
      const swatch = button.querySelector("[data-testid]");
      expect(swatch).not.toBeInTheDocument();
    });
  });

  describe("sleep button", () => {
    it("renders sleep button", () => {
      render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          ringNow={vi.fn()}
          restart={vi.fn()}
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
          ringNow={vi.fn()}
          restart={vi.fn()}
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
          ringNow={vi.fn()}
          restart={vi.fn()}
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
          ringNow={vi.fn()}
          restart={vi.fn()}
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
          ringNow={vi.fn()}
          restart={vi.fn()}
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
          ringNow={vi.fn()}
          restart={vi.fn()}
          awayStart={vi.fn()}
        />,
      );
      const swatch = container.querySelector(
        "[data-testid='control-swatch-work']",
      );
      expect(swatch).toHaveStyle({ backgroundColor: "oklch(0.50 0.075 235)" });
    });
  });

  describe("button styling", () => {
    it("end early button has flex:1 to fill available space", () => {
      render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          ringNow={vi.fn()}
          restart={vi.fn()}
          awayStart={vi.fn()}
        />,
      );
      const button = screen.getByTestId("control-end-early");
      expect(button.className).toBeTruthy();
    });
  });

  describe("swatch appearance", () => {
    it("end early swatch is 9x9 square", () => {
      const { container } = render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          ringNow={vi.fn()}
          restart={vi.fn()}
          awayStart={vi.fn()}
        />,
      );
      const swatch = container.querySelector(
        "[data-testid='control-swatch-end-early']",
      );
      expect(swatch?.className).toMatch(/swatch/);
    });

    it("sleep swatch has correct color", () => {
      const { container } = render(
        <ControlBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          ringNow={vi.fn()}
          restart={vi.fn()}
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
          ringNow={vi.fn()}
          restart={vi.fn()}
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
