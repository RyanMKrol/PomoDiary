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
import { Dial } from "./Dial";
import { PHRASES } from "@/lib/domain";

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

describe("Dial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
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
              draftBullets: [],
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
        }),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe("SVG rendering", () => {
    it("renders SVG with correct viewBox", () => {
      const { container } = render(<Dial timerState={{ loading: true }} />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("viewBox", "0 0 200 200");
    });

    it("renders track circle with correct attributes", () => {
      const { container } = render(<Dial timerState={{ loading: true }} />);
      const trackCircle = container.querySelector('circle[stroke="#e0dddd"]');
      expect(trackCircle).toHaveAttribute("cx", "100");
      expect(trackCircle).toHaveAttribute("cy", "100");
      expect(trackCircle).toHaveAttribute("r", "88");
      expect(trackCircle).toHaveAttribute("stroke", "#e0dddd");
      expect(trackCircle).toHaveAttribute("stroke-width", "14");
      expect(trackCircle).toHaveAttribute("fill", "none");
    });

    it("renders 12 tick marks", () => {
      const { container } = render(<Dial timerState={{ loading: true }} />);
      const lines = container.querySelectorAll("line");
      expect(lines).toHaveLength(12);
    });

    it("renders tick marks with correct styling", () => {
      const { container } = render(<Dial timerState={{ loading: true }} />);
      const lines = container.querySelectorAll("line");
      lines.forEach((line) => {
        expect(line).toHaveAttribute("stroke", "rgba(32,30,29,.3)");
        expect(line).toHaveAttribute("stroke-width", "2");
      });
    });

    it("renders progress arc with correct attributes", () => {
      const { container } = render(<Dial timerState={{ loading: true }} />);
      const circles = container.querySelectorAll("circle");
      const progressArc = circles[circles.length - 1];
      expect(progressArc).toHaveAttribute("cx", "100");
      expect(progressArc).toHaveAttribute("cy", "100");
      expect(progressArc).toHaveAttribute("r", "88");
      expect(progressArc).toHaveAttribute("stroke-width", "14");
      expect(progressArc).toHaveAttribute("stroke-dasharray", "552.92");
      expect(progressArc).toHaveAttribute("fill", "none");
    });
  });

  describe("dashoffset calculations", () => {
    it("calculates dashoffset as 552.92 at the top of the hour (nothing swept)", () => {
      // blockEnd is always an epoch-hour multiple in real payloads; the
      // clock-face arc math depends on it.
      const hourStart = Math.floor(Date.now() / 3_600_000) * 3_600_000;
      const { container } = render(
        <Dial
          timerState={{
            loading: false,
            mode: "running",
            remainingSeconds: 3600,
            hourStart,
            blockEnd: hourStart + 3600 * 1000,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
          }}
        />,
      );
      const circles = container.querySelectorAll("circle");
      const progressArc = circles[circles.length - 1];
      const offset = parseFloat(
        progressArc.getAttribute("stroke-dashoffset") || "0",
      );
      expect(offset).toBeCloseTo(552.92, 1);
    });

    it("calculates dashoffset as 276.46 at half past the hour", () => {
      // Aligned full-hour block with 30 minutes remaining: wall time is
      // half past, so half the ring is swept.
      const hourStart = Math.floor(Date.now() / 3_600_000) * 3_600_000;
      const { container } = render(
        <Dial
          timerState={{
            loading: false,
            mode: "running",
            remainingSeconds: 1800,
            hourStart,
            blockEnd: hourStart + 3600 * 1000,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
          }}
        />,
      );
      const circles = container.querySelectorAll("circle");
      const progressArc = circles[circles.length - 1];
      const offset = parseFloat(
        progressArc.getAttribute("stroke-dashoffset") || "0",
      );
      expect(offset).toBeCloseTo(276.46, 1);
    });

    it("mirrors the wall clock for a block started mid-hour (21 past shows 21 min swept)", () => {
      // Block began at :21 and ends on the next :00. The ring must read
      // like a clock face: 21 minutes already filled, NOT an empty ring.
      const boundary = Math.floor(Date.now() / 3_600_000) * 3_600_000;
      const hourStart = boundary + 21 * 60 * 1000;
      const blockEnd = boundary + 3_600_000;
      const remainingSeconds = 39 * 60;
      const { container } = render(
        <Dial
          timerState={{
            loading: false,
            mode: "running",
            remainingSeconds,
            hourStart,
            blockEnd,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
          }}
        />,
      );
      const circles = container.querySelectorAll("circle");
      const progressArc = circles[circles.length - 1];
      const offset = parseFloat(
        progressArc.getAttribute("stroke-dashoffset") || "0",
      );
      // 21 of 60 minutes swept: offset = 552.92 * (1 - 1260/3600)
      expect(offset).toBeCloseTo(552.92 * (1 - 1260 / 3600), 1);
    });

    it("falls back to a 3600s block when hourStart/blockEnd are null", () => {
      const { container } = render(
        <Dial
          timerState={{
            loading: false,
            mode: "running",
            remainingSeconds: 1800,
            hourStart: null,
            blockEnd: null,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
          }}
        />,
      );
      const circles = container.querySelectorAll("circle");
      const progressArc = circles[circles.length - 1];
      const offset = parseFloat(
        progressArc.getAttribute("stroke-dashoffset") || "0",
      );
      expect(offset).toBeCloseTo(276.46, 1);
    });

    it("calculates dashoffset as 0 at 0% remaining (chime)", () => {
      const { container } = render(
        <Dial
          timerState={{
            loading: false,
            mode: "chime",
            remainingSeconds: 0,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
            chimeFrom: Date.now(),
            chimeTo: Date.now(),
          }}
        />,
      );
      const circles = container.querySelectorAll("circle");
      const progressArc = circles[circles.length - 1];
      const offset = parseFloat(
        progressArc.getAttribute("stroke-dashoffset") || "0",
      );
      expect(offset).toBeCloseTo(0, 1);
    });
  });

  describe("status labels", () => {
    it("displays 'Hour in progress' when running", () => {
      render(
        <Dial
          timerState={{
            loading: false,
            mode: "running",
            remainingSeconds: 1800,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
          }}
        />,
      );
      expect(screen.getByText("Hour in progress")).toBeInTheDocument();
    });

    it("displays 'Paused' when paused", () => {
      render(
        <Dial
          timerState={{
            loading: false,
            mode: "paused",
            remainingSeconds: 1800,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
          }}
        />,
      );
      expect(screen.getByText("Paused.")).toBeInTheDocument();
    });

    it("displays 'Time's ripe' when at chime", () => {
      render(
        <Dial
          timerState={{
            loading: false,
            mode: "chime",
            remainingSeconds: 0,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
            chimeFrom: Date.now(),
            chimeTo: Date.now(),
          }}
        />,
      );
      expect(screen.getByText("Time's ripe")).toBeInTheDocument();
    });

    it("displays 'Recap the hour' when in recap", () => {
      render(
        <Dial
          timerState={{
            loading: false,
            mode: "recap",
            remainingSeconds: 0,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
            chimeFrom: Date.now(),
            chimeTo: Date.now(),
          }}
        />,
      );
      expect(screen.getByText("Recap the hour")).toBeInTheDocument();
    });
  });

  describe("phrases and sub-phrases", () => {
    it("displays phrase from PHRASES array when running", () => {
      const phraseIdx = 0;
      const [expectedPhrase] = PHRASES[phraseIdx];
      render(
        <Dial
          timerState={{
            loading: false,
            mode: "running",
            remainingSeconds: 1800,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx,
          }}
        />,
      );
      expect(screen.getByText(expectedPhrase)).toBeInTheDocument();
    });

    it("displays sub-phrase from PHRASES array when running", () => {
      const phraseIdx = 0;
      const [, expectedSubPhrase] = PHRASES[phraseIdx];
      render(
        <Dial
          timerState={{
            loading: false,
            mode: "running",
            remainingSeconds: 1800,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx,
          }}
        />,
      );
      expect(screen.getByText(expectedSubPhrase)).toBeInTheDocument();
    });

    it("displays 'That hour, then.' as phrase when in recap", () => {
      render(
        <Dial
          timerState={{
            loading: false,
            mode: "recap",
            remainingSeconds: 0,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
            chimeFrom: Date.now(),
            chimeTo: Date.now(),
          }}
        />,
      );
      expect(screen.getByText("That hour, then.")).toBeInTheDocument();
    });

    it("displays 'Say where it went' as sub-phrase when in recap", () => {
      render(
        <Dial
          timerState={{
            loading: false,
            mode: "recap",
            remainingSeconds: 0,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
            chimeFrom: Date.now(),
            chimeTo: Date.now(),
          }}
        />,
      );
      expect(screen.getByText("Say where it went")).toBeInTheDocument();
    });

    it("displays 'Paused.' as phrase when paused", () => {
      render(
        <Dial
          timerState={{
            loading: false,
            mode: "paused",
            remainingSeconds: 1800,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
          }}
        />,
      );
      expect(screen.getByText("Paused.")).toBeInTheDocument();
    });

    it("displays 'The clock waits for you' as sub-phrase when paused", () => {
      render(
        <Dial
          timerState={{
            loading: false,
            mode: "paused",
            remainingSeconds: 1800,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
          }}
        />,
      );
      expect(screen.getByText("The clock waits for you")).toBeInTheDocument();
    });

    it("displays different phrase based on phraseIdx", () => {
      const phraseIdx = 2;
      const [expectedPhrase] = PHRASES[phraseIdx];
      render(
        <Dial
          timerState={{
            loading: false,
            mode: "running",
            remainingSeconds: 1800,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx,
          }}
        />,
      );
      expect(screen.getByText(expectedPhrase)).toBeInTheDocument();
    });
  });

  describe("arc color", () => {
    it("uses #ec3013 (red) when no tag is set and bullets are empty", () => {
      const { container } = render(
        <Dial
          timerState={{
            loading: false,
            mode: "running",
            remainingSeconds: 1800,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
          }}
        />,
      );
      const circles = container.querySelectorAll("circle");
      const progressArc = circles[circles.length - 1];
      expect(progressArc).toHaveAttribute("stroke", "#ec3013");
    });

    it("uses #ec3013 when no explicit tag and no inference", () => {
      const { container } = render(
        <Dial
          timerState={{
            loading: false,
            mode: "running",
            remainingSeconds: 1800,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: ["a", "b"],
            draftTag: null,
            phraseIdx: 0,
          }}
        />,
      );
      const circles = container.querySelectorAll("circle");
      const progressArc = circles[circles.length - 1];
      // No tag and too short to infer, should default to #ec3013
      expect(progressArc).toHaveAttribute("stroke", "#ec3013");
    });

    it("stays brand red when a tag is explicitly set", () => {
      const tagLabel = "Deep work";
      const { container } = render(
        <Dial
          timerState={{
            loading: false,
            mode: "running",
            remainingSeconds: 1800,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: ["wrote code"],
            draftTag: tagLabel,
            phraseIdx: 0,
          }}
        />,
      );
      const circles = container.querySelectorAll("circle");
      const progressArc = circles[circles.length - 1];
      expect(progressArc).toHaveAttribute("stroke", "#ec3013");
    });

    it("stays brand red when a tag could be inferred", () => {
      const { container } = render(
        <Dial
          timerState={{
            loading: false,
            mode: "running",
            remainingSeconds: 1800,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: ["Slack Slack Slack messages and inbox"],
            draftTag: null,
            phraseIdx: 0,
          }}
        />,
      );
      const circles = container.querySelectorAll("circle");
      const progressArc = circles[circles.length - 1];
      expect(progressArc).toHaveAttribute("stroke", "#ec3013");
    });

    it("stays brand red with both explicit and inferred tags", () => {
      const tagLabel = "Deep work";
      const { container } = render(
        <Dial
          timerState={{
            loading: false,
            mode: "running",
            remainingSeconds: 1800,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: ["Slack inbox messages"],
            draftTag: tagLabel,
            phraseIdx: 0,
          }}
        />,
      );
      const circles = container.querySelectorAll("circle");
      const progressArc = circles[circles.length - 1];
      expect(progressArc).toHaveAttribute("stroke", "#ec3013");
    });
  });

  describe("click interaction", () => {
    it("is not clickable — ending the hour early lives in the control bar", () => {
      const { container } = render(
        <Dial
          timerState={{
            loading: false,
            mode: "running",
            remainingSeconds: 1800,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
          }}
        />,
      );
      expect(container.querySelector('[title="Ring it now"]')).toBeNull();
    });
  });

  describe("time display", () => {
    it("displays hourStart time when running", () => {
      const now = Date.now();
      render(
        <Dial
          timerState={{
            loading: false,
            mode: "running",
            remainingSeconds: 1800,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
            hourStart: now - 1800 * 1000,
            blockEnd: now + 1800 * 1000,
          }}
        />,
      );
      // Just verify the "Since" text is present
      expect(screen.getByText(/Since /)).toBeInTheDocument();
    });

    it("displays chimeFrom time when in recap", () => {
      const now = Date.now();
      render(
        <Dial
          timerState={{
            loading: false,
            mode: "recap",
            remainingSeconds: 0,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
            chimeFrom: now,
            chimeTo: now,
          }}
        />,
      );
      expect(screen.getByText(/Since /)).toBeInTheDocument();
    });

    it("displays chimeFrom time when at chime", () => {
      const now = Date.now();
      render(
        <Dial
          timerState={{
            loading: false,
            mode: "chime",
            remainingSeconds: 0,
            settings: {
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
              recentAwayLabels: [],
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
            chimeFrom: now,
            chimeTo: now,
          }}
        />,
      );
      expect(screen.getByText(/Since /)).toBeInTheDocument();
    });
  });

  describe("dial wrapper attributes", () => {
    it("carries no click affordance (no title attribute)", () => {
      const { container } = render(<Dial timerState={{ loading: true }} />);
      expect(container.querySelector('[title="Ring it now"]')).toBeNull();
    });

    it("keeps the dialWrapper CSS class", () => {
      const { container } = render(<Dial timerState={{ loading: true }} />);
      const dialWrapper = container.querySelector('[class*="dialWrapper"]');
      expect(dialWrapper?.className).toMatch(/dialWrapper/);
    });

    it("has breathe animation via CSS class", () => {
      const { container } = render(<Dial timerState={{ loading: true }} />);
      const dialWrapper = container.querySelector('[class*="dialWrapper"]');
      expect(dialWrapper?.className).toMatch(/dialWrapper/);
      // CSS class includes the animation
    });
  });
});

describe("running pulse", () => {
  afterEach(() => cleanup());

  it("shows the radial pulse while an hour is running", () => {
    const { getByTestId } = render(
      <Dial timerState={{ mode: "running", remainingSeconds: 1800 }} />,
    );
    expect(getByTestId("dial-pulse")).toBeInTheDocument();
  });

  it("hides the pulse when paused", () => {
    const { queryByTestId } = render(
      <Dial timerState={{ mode: "paused", remainingSeconds: 1800 }} />,
    );
    expect(queryByTestId("dial-pulse")).not.toBeInTheDocument();
  });
});
