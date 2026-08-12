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

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.startsWith("/api/entries")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            mode: "running",
            remainingSeconds: 1800,
            hourStart: Date.now() - 1800 * 1000,
            blockEnd: Date.now() + 1800 * 1000,
            chimeFrom: null,
            chimeTo: null,
            awayKind: null,
            awaySince: null,
            awayLabel: null,
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
            count: 0,
          }),
      });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Panels", () => {
  it("renders left panel", () => {
    const { getByTestId } = render(<Panels />);

    expect(getByTestId("left-panel")).toBeInTheDocument();
  });

  it("renders right panel", () => {
    const { getByTestId } = render(<Panels />);

    expect(getByTestId("right-panel")).toBeInTheDocument();
  });

  it("renders both panels", () => {
    const { getByTestId } = render(<Panels />);

    expect(getByTestId("left-panel")).toBeInTheDocument();
    expect(getByTestId("right-panel")).toBeInTheDocument();
  });

  it("composes the dial, bullet jotter, picker strip, control bar and vine day view", async () => {
    render(<Panels />);

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
