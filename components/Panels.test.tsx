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
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import type { UseTimerResult } from "@/lib/client/useTimer";
import { Panels } from "./Panels";

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

/** A fully-loaded UseTimerResult fixture: Panels no longer owns the hook —
 *  AppShell owns the single client and passes the state down as a prop. */
function makeTimerState(
  overrides: Partial<UseTimerResult> = {},
): UseTimerResult {
  return {
    loading: false,
    mode: "running",
    remainingSeconds: 1800,
    hourStart: Date.now() - 1800 * 1000,
    blockEnd: Date.now() + 1800 * 1000,
    chimeFrom: null,
    chimeTo: null,
    draftBullets: [""],
    draftTag: null,
    draftFeel: null,
    draftIntent: null,
    phraseIdx: 0,
    settings: {
      soundOn: true,
      chimeVolume: 0.8,
      pauseAfterLog: false,
      recentAwayLabels: [],
    },
    hoursToday: 0,
    entriesVersion: 0,
    awayElapsedSeconds: null,
    awayKind: null,
    awaySince: null,
    awayLabel: null,
    resume: vi.fn().mockResolvedValue(undefined),
    ringNow: vi.fn().mockResolvedValue(undefined),
    acknowledge: vi.fn().mockResolvedValue(undefined),
    log: vi.fn().mockResolvedValue(undefined),
    skip: vi.fn().mockResolvedValue(undefined),
    awayStart: vi.fn().mockResolvedValue(undefined),
    awayReturn: vi.fn().mockResolvedValue(undefined),
    updateDraft: vi.fn(),
    updateSettings: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Only the vine's entry views fetch; the timer state arrives as a prop.
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (String(url).startsWith("/api/entries")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.reject(new Error(`unexpected fetch: ${String(url)}`));
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Panels", () => {
  it("renders left panel", () => {
    const { getByTestId } = render(<Panels timerState={makeTimerState()} />);

    expect(getByTestId("left-panel")).toBeInTheDocument();
  });

  it("renders right panel", () => {
    const { getByTestId } = render(<Panels timerState={makeTimerState()} />);

    expect(getByTestId("right-panel")).toBeInTheDocument();
  });

  it("renders both panels", () => {
    const { getByTestId } = render(<Panels timerState={makeTimerState()} />);

    expect(getByTestId("left-panel")).toBeInTheDocument();
    expect(getByTestId("right-panel")).toBeInTheDocument();
  });

  it("composes the dial, bullet jotter, picker strip, control bar and vine day view", async () => {
    render(<Panels timerState={makeTimerState()} />);

    const leftPanel = screen.getByTestId("left-panel");
    expect(leftPanel.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByTestId("bullet-jotter")).toBeInTheDocument();
    expect(screen.getByTestId("picker-strip")).toBeInTheDocument();
    expect(screen.getByTestId("control-bar")).toBeInTheDocument();

    expect(screen.getByTestId("vine-container")).toBeInTheDocument();
    expect(screen.getByText("The vine")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText("Nothing in the basket yet."),
      ).toBeInTheDocument(),
    );
  });
});
