// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeAll, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AwayOverlay } from "./AwayOverlay";
import { AWAY, CUSTOM_AWAY_COLOR } from "@/lib/domain";

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

describe("AwayOverlay", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const baseTime = new Date("2026-08-10T23:20:00").getTime();

  it("renders away overlay for sleep mode", () => {
    const onReturn = vi.fn();
    render(
      <AwayOverlay
        awayKind="sleep"
        awaySince={baseTime}
        now={baseTime}
        onReturn={onReturn}
      />,
    );

    expect(screen.getByTestId("away-overlay")).toBeInTheDocument();
  });

  it("renders away overlay for work mode", () => {
    const onReturn = vi.fn();
    render(
      <AwayOverlay
        awayKind="work"
        awaySince={baseTime}
        now={baseTime}
        onReturn={onReturn}
      />,
    );

    expect(screen.getByTestId("away-overlay")).toBeInTheDocument();
  });

  it("displays correct headline for sleep", () => {
    const onReturn = vi.fn();
    const { container } = render(
      <AwayOverlay
        awayKind="sleep"
        awaySince={baseTime}
        now={baseTime}
        onReturn={onReturn}
      />,
    );

    const headline = container.querySelector("h1");
    expect(headline?.textContent).toBe(AWAY.sleep.title);
  });

  it("displays correct headline for work", () => {
    const onReturn = vi.fn();
    const { container } = render(
      <AwayOverlay
        awayKind="work"
        awaySince={baseTime}
        now={baseTime}
        onReturn={onReturn}
      />,
    );

    const headline = container.querySelector("h1");
    expect(headline?.textContent).toBe(AWAY.work.title);
  });

  it("displays correct end label for sleep", () => {
    const onReturn = vi.fn();
    render(
      <AwayOverlay
        awayKind="sleep"
        awaySince={baseTime}
        now={baseTime}
        onReturn={onReturn}
      />,
    );

    const button = screen.getByTestId("away-return-button");
    expect(button.textContent).toContain(AWAY.sleep.end);
  });

  it("displays correct end label for work", () => {
    const onReturn = vi.fn();
    render(
      <AwayOverlay
        awayKind="work"
        awaySince={baseTime}
        now={baseTime}
        onReturn={onReturn}
      />,
    );

    const button = screen.getByTestId("away-return-button");
    expect(button.textContent).toContain(AWAY.work.end);
  });

  it("displays elapsed time", () => {
    const onReturn = vi.fn();
    const later = baseTime + 15 * 60 * 1000; // 15 minutes later
    const { container } = render(
      <AwayOverlay
        awayKind="sleep"
        awaySince={baseTime}
        now={later}
        onReturn={onReturn}
      />,
    );

    const elapsed = container.querySelector("[class*='elapsed']");
    expect(elapsed?.textContent).toContain("15 min");
  });

  it("updates elapsed time when now changes", () => {
    const onReturn = vi.fn();
    const later1 = baseTime + 15 * 60 * 1000;
    const later2 = baseTime + 45 * 60 * 1000;

    const { container, rerender } = render(
      <AwayOverlay
        awayKind="sleep"
        awaySince={baseTime}
        now={later1}
        onReturn={onReturn}
      />,
    );

    let elapsed = container.querySelector("[class*='elapsed']");
    expect(elapsed?.textContent).toContain("15 min");

    rerender(
      <AwayOverlay
        awayKind="sleep"
        awaySince={baseTime}
        now={later2}
        onReturn={onReturn}
      />,
    );

    elapsed = container.querySelector("[class*='elapsed']");
    expect(elapsed?.textContent).toContain("45 min");
  });

  it("displays mode note for sleep", () => {
    const onReturn = vi.fn();
    const { container } = render(
      <AwayOverlay
        awayKind="sleep"
        awaySince={baseTime}
        now={baseTime}
        onReturn={onReturn}
      />,
    );

    const note = container.querySelector("[class*='note']");
    expect(note?.textContent).toBe(AWAY.sleep.note);
  });

  it("displays mode note for work", () => {
    const onReturn = vi.fn();
    const { container } = render(
      <AwayOverlay
        awayKind="work"
        awaySince={baseTime}
        now={baseTime}
        onReturn={onReturn}
      />,
    );

    const note = container.querySelector("[class*='note']");
    expect(note?.textContent).toBe(AWAY.work.note);
  });

  it("has correct absolute positioning", () => {
    const onReturn = vi.fn();
    const { container } = render(
      <AwayOverlay
        awayKind="sleep"
        awaySince={baseTime}
        now={baseTime}
        onReturn={onReturn}
      />,
    );

    const overlay = container.querySelector("[data-testid='away-overlay']");
    expect(overlay).toBeInTheDocument();
    // Verify it's a div with the overlay styling
    expect(overlay?.tagName).toBe("DIV");
  });

  it("calls onReturn when button is clicked", async () => {
    const user = userEvent.setup();
    const onReturn = vi.fn();
    render(
      <AwayOverlay
        awayKind="sleep"
        awaySince={baseTime}
        now={baseTime}
        onReturn={onReturn}
      />,
    );

    const button = screen.getByTestId("away-return-button");
    await user.click(button);

    expect(onReturn).toHaveBeenCalledOnce();
  });

  it("has background color set inline for sleep", () => {
    const onReturn = vi.fn();
    const { container } = render(
      <AwayOverlay
        awayKind="sleep"
        awaySince={baseTime}
        now={baseTime}
        onReturn={onReturn}
      />,
    );

    const overlay = container.querySelector("[data-testid='away-overlay']");
    expect(overlay).toHaveAttribute("style");
  });

  it("displays swatch in return button", () => {
    const onReturn = vi.fn();
    const { container } = render(
      <AwayOverlay
        awayKind="sleep"
        awaySince={baseTime}
        now={baseTime}
        onReturn={onReturn}
      />,
    );

    const swatches = container.querySelectorAll("[class*='swatch']");
    expect(swatches.length).toBeGreaterThan(0);
  });

  it("renders gym title, end label and color", () => {
    const onReturn = vi.fn();
    const { container } = render(
      <AwayOverlay
        awayKind="gym"
        awaySince={baseTime}
        now={baseTime}
        onReturn={onReturn}
      />,
    );

    const headline = container.querySelector("h1");
    expect(headline?.textContent).toBe(AWAY.gym.title);

    const button = screen.getByTestId("away-return-button");
    expect(button.textContent).toContain(AWAY.gym.end);

    const overlay = screen.getByTestId("away-overlay");
    expect(overlay).toHaveStyle({ backgroundColor: AWAY.gym.color });
  });

  it("renders custom away from the user-typed label", () => {
    const onReturn = vi.fn();
    const { container } = render(
      <AwayOverlay
        awayKind="custom"
        awaySince={baseTime}
        now={baseTime}
        awayLabel="Travelling"
        onReturn={onReturn}
      />,
    );

    const headline = container.querySelector("h1");
    expect(headline?.textContent).toBe("TRAVELLING.");

    const button = screen.getByTestId("away-return-button");
    expect(button.textContent).toContain("I'm back");

    const overlay = screen.getByTestId("away-overlay");
    expect(overlay).toHaveStyle({ backgroundColor: CUSTOM_AWAY_COLOR });
  });

  it("falls back to a plain Away headline when the custom label is missing", () => {
    const onReturn = vi.fn();
    const { container } = render(
      <AwayOverlay
        awayKind="custom"
        awaySince={baseTime}
        now={baseTime}
        onReturn={onReturn}
      />,
    );

    const headline = container.querySelector("h1");
    expect(headline?.textContent).toBe("AWAY.");
  });

  it("displays start time in elapsed text", () => {
    const onReturn = vi.fn();
    const { container } = render(
      <AwayOverlay
        awayKind="sleep"
        awaySince={baseTime}
        now={baseTime}
        onReturn={onReturn}
      />,
    );

    const elapsed = container.querySelector("[class*='elapsed']");
    expect(elapsed?.textContent).toContain("Since");
  });
});

describe("click anywhere to return", () => {
  afterEach(() => cleanup());

  it("calls onReturn when the card itself is clicked", async () => {
    const onReturn = vi.fn();
    const { getByTestId } = render(
      <AwayOverlay
        awayKind="sleep"
        awaySince={1_700_000_000_000}
        now={1_700_000_000_000}
        onReturn={onReturn}
      />,
    );

    await userEvent.click(getByTestId("away-overlay"));
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it("calls onReturn exactly once when the labeled button is clicked", async () => {
    const onReturn = vi.fn();
    const { getByTestId } = render(
      <AwayOverlay
        awayKind="work"
        awaySince={1_700_000_000_000}
        now={1_700_000_000_000}
        onReturn={onReturn}
      />,
    );

    await userEvent.click(getByTestId("away-return-button"));
    expect(onReturn).toHaveBeenCalledTimes(1);
  });
});
