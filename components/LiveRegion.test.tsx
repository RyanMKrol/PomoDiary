// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LiveRegion } from "./LiveRegion";
import { type UseTimerResult } from "@/lib/client/useTimer";

describe("LiveRegion", () => {
  afterEach(() => {
    cleanup();
  });

  const aug10_214pm = new Date("2026-08-10T14:14:00").getTime();
  const aug10_314pm = new Date("2026-08-10T15:14:00").getTime();

  it("renders an assertive live region", () => {
    const timerState: Partial<UseTimerResult> = { mode: "running" };
    render(<LiveRegion timerState={timerState} />);

    const region = screen.getByTestId("live-region");
    expect(region).toHaveAttribute("aria-live", "assertive");
  });

  it("is visually hidden", () => {
    render(<LiveRegion timerState={{ mode: "running" }} />);

    const region = screen.getByTestId("live-region");
    expect(region.className).toMatch(/visually-hidden/);
  });

  it("announces entering chime with the time range", () => {
    const { rerender } = render(
      <LiveRegion timerState={{ mode: "running" }} />,
    );

    rerender(
      <LiveRegion
        timerState={{
          mode: "chime",
          chimeFrom: aug10_214pm,
          chimeTo: aug10_314pm,
        }}
      />,
    );

    const region = screen.getByTestId("live-region");
    expect(region.textContent).toContain("Time's ripe.");
    expect(region.textContent).toContain("2:14 PM");
    expect(region.textContent).toContain("3:14 PM");
    expect(region.textContent).toContain(
      "Click anywhere to account for the hour.",
    );
  });

  it("announces entering sleep", () => {
    const { rerender } = render(
      <LiveRegion timerState={{ mode: "running" }} />,
    );

    rerender(
      <LiveRegion
        timerState={{ mode: "away" }}
        awayKind="sleep"
        awaySince={aug10_214pm}
      />,
    );

    const region = screen.getByTestId("live-region");
    expect(region.textContent).toContain("Asleep since");
    expect(region.textContent).toContain("2:14 PM");
  });

  it("announces entering work", () => {
    const { rerender } = render(
      <LiveRegion timerState={{ mode: "running" }} />,
    );

    rerender(
      <LiveRegion
        timerState={{ mode: "away" }}
        awayKind="work"
        awaySince={aug10_214pm}
      />,
    );

    const region = screen.getByTestId("live-region");
    expect(region.textContent).toContain("At work since");
  });

  it("announces returning with the hours logged count", () => {
    const { rerender } = render(
      <LiveRegion
        timerState={{ mode: "away" }}
        awayKind="sleep"
        awaySince={aug10_214pm}
      />,
    );

    rerender(<LiveRegion timerState={{ mode: "running", hoursToday: 5 }} />);

    const region = screen.getByTestId("live-region");
    expect(region.textContent).toBe("Back. 5 hours logged.");
  });

  it("does not announce anything on initial render", () => {
    render(<LiveRegion timerState={{ mode: "running" }} />);

    const region = screen.getByTestId("live-region");
    expect(region.textContent).toBe("");
  });
});
