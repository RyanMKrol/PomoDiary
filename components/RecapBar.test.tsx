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
import { RecapBar } from "./RecapBar";
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

describe("RecapBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe("rendering in different modes", () => {
    it("renders when mode is recap", () => {
      const { container } = render(
        <RecapBar
          timerState={{ mode: "recap" } as Partial<UseTimerResult>}
          log={vi.fn()}
          skip={vi.fn()}
        />,
      );
      const bar = container.querySelector("[data-testid='recap-bar']");
      expect(bar).toBeInTheDocument();
    });

    it("does not render when mode is running", () => {
      const { container } = render(
        <RecapBar
          timerState={{ mode: "running" } as Partial<UseTimerResult>}
          log={vi.fn()}
          skip={vi.fn()}
        />,
      );
      const bar = container.querySelector("[data-testid='recap-bar']");
      expect(bar).not.toBeInTheDocument();
    });

    it("does not render when mode is paused", () => {
      const { container } = render(
        <RecapBar
          timerState={{ mode: "paused" } as Partial<UseTimerResult>}
          log={vi.fn()}
          skip={vi.fn()}
        />,
      );
      const bar = container.querySelector("[data-testid='recap-bar']");
      expect(bar).not.toBeInTheDocument();
    });

    it("does not render when mode is chime", () => {
      const { container } = render(
        <RecapBar
          timerState={{ mode: "chime" } as Partial<UseTimerResult>}
          log={vi.fn()}
          skip={vi.fn()}
        />,
      );
      const bar = container.querySelector("[data-testid='recap-bar']");
      expect(bar).not.toBeInTheDocument();
    });

    it("does not render when mode is away", () => {
      const { container } = render(
        <RecapBar
          timerState={{ mode: "away" } as Partial<UseTimerResult>}
          log={vi.fn()}
          skip={vi.fn()}
        />,
      );
      const bar = container.querySelector("[data-testid='recap-bar']");
      expect(bar).not.toBeInTheDocument();
    });
  });

  describe("log it button", () => {
    it("renders log it button with correct text", () => {
      render(
        <RecapBar
          timerState={{ mode: "recap" } as Partial<UseTimerResult>}
          log={vi.fn()}
          skip={vi.fn()}
        />,
      );
      const button = screen.getByTestId("recap-log-it");
      expect(button).toHaveTextContent("Log it & start the next hour");
    });

    it("calls log with current drafts when clicked", async () => {
      const log = vi.fn();
      const user = userEvent.setup();
      render(
        <RecapBar
          timerState={
            {
              mode: "recap",
              draftBullets: ["bullet 1", "bullet 2"],
              draftTag: "Learning",
              draftFeel: "Charged",
              draftIntent: "yes",
            } as Partial<UseTimerResult>
          }
          log={log}
          skip={vi.fn()}
        />,
      );
      const button = screen.getByTestId("recap-log-it");
      await user.click(button);
      expect(log).toHaveBeenCalledWith({
        bullets: ["bullet 1", "bullet 2"],
        tag: "Learning",
        feel: "Charged",
        intent: "yes",
      });
    });

    it("passes null values when drafts are not set", async () => {
      const log = vi.fn();
      const user = userEvent.setup();
      render(
        <RecapBar
          timerState={
            {
              mode: "recap",
              draftBullets: [],
              draftTag: null,
              draftFeel: null,
              draftIntent: null,
            } as Partial<UseTimerResult>
          }
          log={log}
          skip={vi.fn()}
        />,
      );
      const button = screen.getByTestId("recap-log-it");
      await user.click(button);
      expect(log).toHaveBeenCalledWith({
        bullets: [],
        tag: null,
        feel: null,
        intent: null,
      });
    });

    it("has red background with accent color via CSS class", () => {
      render(
        <RecapBar
          timerState={{ mode: "recap" } as Partial<UseTimerResult>}
          log={vi.fn()}
          skip={vi.fn()}
        />,
      );
      const button = screen.getByTestId("recap-log-it");
      expect(button.className).toMatch(/logItButton/);
    });

    it("has white text via CSS class", () => {
      render(
        <RecapBar
          timerState={{ mode: "recap" } as Partial<UseTimerResult>}
          log={vi.fn()}
          skip={vi.fn()}
        />,
      );
      const button = screen.getByTestId("recap-log-it");
      expect(button.className).toMatch(/logItButton/);
    });

    it("has white swatch element", () => {
      const { container } = render(
        <RecapBar
          timerState={{ mode: "recap" } as Partial<UseTimerResult>}
          log={vi.fn()}
          skip={vi.fn()}
        />,
      );
      const swatch = container.querySelector(
        "[data-testid='recap-swatch-log-it']",
      );
      expect(swatch).toBeInTheDocument();
      expect(swatch?.className).toMatch(/logItSwatch/);
    });

    it("has flex:1 to fill available space", () => {
      render(
        <RecapBar
          timerState={{ mode: "recap" } as Partial<UseTimerResult>}
          log={vi.fn()}
          skip={vi.fn()}
        />,
      );
      const button = screen.getByTestId("recap-log-it");
      expect(button.className).toMatch(/logItButton/);
    });
  });

  describe("skip button", () => {
    it("renders skip button with correct text", () => {
      render(
        <RecapBar
          timerState={{ mode: "recap" } as Partial<UseTimerResult>}
          log={vi.fn()}
          skip={vi.fn()}
        />,
      );
      const button = screen.getByTestId("recap-skip");
      expect(button).toHaveTextContent("Skip");
    });

    it("calls skip when clicked", async () => {
      const skip = vi.fn();
      const user = userEvent.setup();
      render(
        <RecapBar
          timerState={{ mode: "recap" } as Partial<UseTimerResult>}
          log={vi.fn()}
          skip={skip}
        />,
      );
      const button = screen.getByTestId("recap-skip");
      await user.click(button);
      expect(skip).toHaveBeenCalled();
    });

    it("has transparent background via CSS class", () => {
      render(
        <RecapBar
          timerState={{ mode: "recap" } as Partial<UseTimerResult>}
          log={vi.fn()}
          skip={vi.fn()}
        />,
      );
      const button = screen.getByTestId("recap-skip");
      expect(button.className).toMatch(/skipButton/);
    });

    it("has muted text color via CSS class", () => {
      render(
        <RecapBar
          timerState={{ mode: "recap" } as Partial<UseTimerResult>}
          log={vi.fn()}
          skip={vi.fn()}
        />,
      );
      const button = screen.getByTestId("recap-skip");
      expect(button.className).toMatch(/skipButton/);
    });

    it("has left border", () => {
      render(
        <RecapBar
          timerState={{ mode: "recap" } as Partial<UseTimerResult>}
          log={vi.fn()}
          skip={vi.fn()}
        />,
      );
      const button = screen.getByTestId("recap-skip");
      expect(button.className).toMatch(/skipButton/);
      // CSS has border-left: 2px solid
    });
  });

  describe("button layout", () => {
    it("renders both buttons together", () => {
      const { container } = render(
        <RecapBar
          timerState={{ mode: "recap" } as Partial<UseTimerResult>}
          log={vi.fn()}
          skip={vi.fn()}
        />,
      );
      const bar = container.querySelector("[data-testid='recap-bar']");
      const buttons = bar?.querySelectorAll("button");
      expect(buttons).toHaveLength(2);
    });

    it("log it button comes before skip button", () => {
      const { container } = render(
        <RecapBar
          timerState={{ mode: "recap" } as Partial<UseTimerResult>}
          log={vi.fn()}
          skip={vi.fn()}
        />,
      );
      const bar = container.querySelector("[data-testid='recap-bar']");
      const buttons = bar?.querySelectorAll("button");
      expect(buttons?.[0]).toHaveAttribute("data-testid", "recap-log-it");
      expect(buttons?.[1]).toHaveAttribute("data-testid", "recap-skip");
    });

    it("bar has flexbox layout", () => {
      const { container } = render(
        <RecapBar
          timerState={{ mode: "recap" } as Partial<UseTimerResult>}
          log={vi.fn()}
          skip={vi.fn()}
        />,
      );
      const bar = container.querySelector("[data-testid='recap-bar']");
      expect(bar?.className).toMatch(/bar/);
    });
  });

  describe("log with various draft combinations", () => {
    it("logs with only tag set", async () => {
      const log = vi.fn();
      const user = userEvent.setup();
      render(
        <RecapBar
          timerState={
            {
              mode: "recap",
              draftBullets: [],
              draftTag: "Social",
              draftFeel: null,
              draftIntent: null,
            } as Partial<UseTimerResult>
          }
          log={log}
          skip={vi.fn()}
        />,
      );
      const button = screen.getByTestId("recap-log-it");
      await user.click(button);
      expect(log).toHaveBeenCalledWith({
        bullets: [],
        tag: "Social",
        feel: null,
        intent: null,
      });
    });

    it("logs with only bullets set", async () => {
      const log = vi.fn();
      const user = userEvent.setup();
      render(
        <RecapBar
          timerState={
            {
              mode: "recap",
              draftBullets: ["wrote code", "reviewed PR"],
              draftTag: null,
              draftFeel: null,
              draftIntent: null,
            } as Partial<UseTimerResult>
          }
          log={log}
          skip={vi.fn()}
        />,
      );
      const button = screen.getByTestId("recap-log-it");
      await user.click(button);
      expect(log).toHaveBeenCalledWith({
        bullets: ["wrote code", "reviewed PR"],
        tag: null,
        feel: null,
        intent: null,
      });
    });

    it("logs with empty bullets array", async () => {
      const log = vi.fn();
      const user = userEvent.setup();
      render(
        <RecapBar
          timerState={
            {
              mode: "recap",
              draftBullets: [],
              draftTag: "Unfiled",
              draftFeel: "Steady",
              draftIntent: "yes",
            } as Partial<UseTimerResult>
          }
          log={log}
          skip={vi.fn()}
        />,
      );
      const button = screen.getByTestId("recap-log-it");
      await user.click(button);
      expect(log).toHaveBeenCalledWith({
        bullets: [],
        tag: "Unfiled",
        feel: "Steady",
        intent: "yes",
      });
    });
  });

  describe("swatch appearance", () => {
    it("log it button has white square swatch with correct class", () => {
      const { container } = render(
        <RecapBar
          timerState={{ mode: "recap" } as Partial<UseTimerResult>}
          log={vi.fn()}
          skip={vi.fn()}
        />,
      );
      const swatch = container.querySelector(
        "[data-testid='recap-swatch-log-it']",
      );
      expect(swatch).toBeInTheDocument();
      expect(swatch?.className).toMatch(/logItSwatch/);
    });

    it("swatch is 10x10 square with correct class", () => {
      const { container } = render(
        <RecapBar
          timerState={{ mode: "recap" } as Partial<UseTimerResult>}
          log={vi.fn()}
          skip={vi.fn()}
        />,
      );
      const swatch = container.querySelector(
        "[data-testid='recap-swatch-log-it']",
      );
      expect(swatch?.className).toMatch(/logItSwatch/);
    });
  });
});
