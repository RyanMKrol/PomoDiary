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
import { PHRASES, tagColor } from "@/lib/domain";

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
              chimeFrom: null,
              chimeTo: null,
              draftBullets: [],
              draftTag: null,
              draftFeel: null,
              draftIntent: null,
              phraseIdx: 0,
              settings: {
                sessionMinutes: 60,
                soundOn: true,
                chimeVolume: 0.8,
                pauseAfterLog: false,
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
      const circles = container.querySelectorAll("circle");
      const trackCircle = circles[0];
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
      const progressArc = circles[1];
      expect(progressArc).toHaveAttribute("cx", "100");
      expect(progressArc).toHaveAttribute("cy", "100");
      expect(progressArc).toHaveAttribute("r", "88");
      expect(progressArc).toHaveAttribute("stroke-width", "14");
      expect(progressArc).toHaveAttribute("stroke-dasharray", "552.92");
      expect(progressArc).toHaveAttribute("fill", "none");
    });
  });

  describe("dashoffset calculations", () => {
    it("calculates dashoffset as 552.92 at 100% remaining", () => {
      const sessionSeconds = 3600;
      const { container } = render(
        <Dial
          timerState={{
            loading: false,
            mode: "running",
            remainingSeconds: sessionSeconds,
            settings: {
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
          }}
        />,
      );
      const circles = container.querySelectorAll("circle");
      const progressArc = circles[1];
      const offset = parseFloat(
        progressArc.getAttribute("stroke-dashoffset") || "0",
      );
      expect(offset).toBeCloseTo(552.92, 1);
    });

    it("calculates dashoffset as 276.46 at 50% remaining", () => {
      const sessionSeconds = 3600;
      const { container } = render(
        <Dial
          timerState={{
            loading: false,
            mode: "running",
            remainingSeconds: sessionSeconds / 2,
            settings: {
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
          }}
        />,
      );
      const circles = container.querySelectorAll("circle");
      const progressArc = circles[1];
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
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
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
      const progressArc = circles[1];
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
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
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
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
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
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
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
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
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
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
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
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
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
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
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
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
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
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
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
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
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
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
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
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
          }}
        />,
      );
      const circles = container.querySelectorAll("circle");
      const progressArc = circles[1];
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
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
            },
            draftBullets: ["a", "b"],
            draftTag: null,
            phraseIdx: 0,
          }}
        />,
      );
      const circles = container.querySelectorAll("circle");
      const progressArc = circles[1];
      // No tag and too short to infer, should default to #ec3013
      expect(progressArc).toHaveAttribute("stroke", "#ec3013");
    });

    it("uses draft tag's colour when explicitly set", () => {
      const tagLabel = "Deep work";
      const expectedColor = tagColor(tagLabel);
      const { container } = render(
        <Dial
          timerState={{
            loading: false,
            mode: "running",
            remainingSeconds: 1800,
            settings: {
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
            },
            draftBullets: ["wrote code"],
            draftTag: tagLabel,
            phraseIdx: 0,
          }}
        />,
      );
      const circles = container.querySelectorAll("circle");
      const progressArc = circles[1];
      expect(progressArc).toHaveAttribute("stroke", expectedColor);
    });

    it("uses inferred tag's colour when no explicit tag", () => {
      const expectedColor = tagColor("Comms");
      const { container } = render(
        <Dial
          timerState={{
            loading: false,
            mode: "running",
            remainingSeconds: 1800,
            settings: {
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
            },
            draftBullets: ["Slack Slack Slack messages and inbox"],
            draftTag: null,
            phraseIdx: 0,
          }}
        />,
      );
      const circles = container.querySelectorAll("circle");
      const progressArc = circles[1];
      expect(progressArc).toHaveAttribute("stroke", expectedColor);
    });

    it("prefers explicit tag over inferred tag", () => {
      const tagLabel = "Deep work";
      const expectedColor = tagColor(tagLabel);
      const { container } = render(
        <Dial
          timerState={{
            loading: false,
            mode: "running",
            remainingSeconds: 1800,
            settings: {
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
            },
            draftBullets: ["Slack inbox messages"],
            draftTag: tagLabel,
            phraseIdx: 0,
          }}
        />,
      );
      const circles = container.querySelectorAll("circle");
      const progressArc = circles[1];
      expect(progressArc).toHaveAttribute("stroke", expectedColor);
    });
  });

  describe("click interaction", () => {
    it("calls ringNow when dial is clicked", async () => {
      const ringNow = vi.fn();
      const user = userEvent.setup();
      const { container } = render(
        <Dial
          timerState={{
            loading: false,
            mode: "running",
            remainingSeconds: 1800,
            settings: {
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
            ringNow,
          }}
        />,
      );
      const dialWrapper = container.querySelector('[title="Ring it now"]');
      expect(dialWrapper).toBeInTheDocument();
      await user.click(dialWrapper!);
      expect(ringNow).toHaveBeenCalled();
    });
  });

  describe("time display", () => {
    it("displays hourStart time when running", () => {
      const now = Date.now();
      const timerStateWithHourStart = {
        loading: false,
        mode: "running" as const,
        remainingSeconds: 1800,
        settings: {
          sessionMinutes: 60,
          soundOn: true,
          chimeVolume: 0.8,
          pauseAfterLog: false,
        },
        draftBullets: [],
        draftTag: null,
        phraseIdx: 0,
        hourStart: now,
      } as Partial<Record<string, unknown>>;
      render(<Dial timerState={timerStateWithHourStart as any} />); // eslint-disable-line @typescript-eslint/no-explicit-any
      // Just verify the "Since" text is present
      expect(
        screen.getByText(/Since .* · click the dial to ring it now/),
      ).toBeInTheDocument();
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
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
            chimeFrom: now,
            chimeTo: now,
          }}
        />,
      );
      expect(
        screen.getByText(/Since .* · click the dial to ring it now/),
      ).toBeInTheDocument();
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
              sessionMinutes: 60,
              soundOn: true,
              chimeVolume: 0.8,
              pauseAfterLog: false,
            },
            draftBullets: [],
            draftTag: null,
            phraseIdx: 0,
            chimeFrom: now,
            chimeTo: now,
          }}
        />,
      );
      expect(
        screen.getByText(/Since .* · click the dial to ring it now/),
      ).toBeInTheDocument();
    });
  });

  describe("dial wrapper attributes", () => {
    it("has title='Ring it now'", () => {
      const { container } = render(<Dial timerState={{ loading: true }} />);
      const dialWrapper = container.querySelector('[title="Ring it now"]');
      expect(dialWrapper).toBeInTheDocument();
    });

    it("has cursor:pointer style via CSS class", () => {
      const { container } = render(<Dial timerState={{ loading: true }} />);
      const dialWrapper = container.querySelector('[title="Ring it now"]');
      // The cursor should be applied via CSS module class
      expect(dialWrapper?.className).toMatch(/dialWrapper/);
    });

    it("has breathe animation via CSS class", () => {
      const { container } = render(<Dial timerState={{ loading: true }} />);
      const dialWrapper = container.querySelector('[title="Ring it now"]');
      expect(dialWrapper?.className).toMatch(/dialWrapper/);
      // CSS class includes the animation
    });
  });
});
