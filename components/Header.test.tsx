// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Header } from "./Header";

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Header", () => {
  it("renders the wordmark", () => {
    const { container } = render(<Header timerState={{}} />);
    const wordmark = container.querySelector('[class*="wordmark"]');

    expect(wordmark).toHaveTextContent("POMODIARY");
  });

  it("renders the tagline", () => {
    const { container } = render(<Header timerState={{}} />);
    const tagline = container.querySelector('[class*="tagline"]');

    expect(tagline).toHaveTextContent("Hour by hour, an honest accounting.");
  });

  it("shows 00 while the timer state is loading", () => {
    const { container } = render(<Header timerState={{ loading: true }} />);
    const countSection = container.querySelector('[class*="countSection"]');

    expect(countSection).toHaveTextContent("00");
  });

  it("shows 00 for an empty timer state (loading defaults on)", () => {
    const { container } = render(<Header timerState={{}} />);
    const countSection = container.querySelector('[class*="countSection"]');

    expect(countSection).toHaveTextContent("00");
  });

  it("renders hoursToday zero-padded once loaded", () => {
    const { container } = render(
      <Header timerState={{ loading: false, hoursToday: 6 }} />,
    );
    const countSection = container.querySelector('[class*="countSection"]');

    expect(countSection).toHaveTextContent("06");
  });

  it("renders a two-digit count without extra padding", () => {
    const { container } = render(
      <Header timerState={{ loading: false, hoursToday: 12 }} />,
    );
    const countSection = container.querySelector('[class*="countSection"]');

    expect(countSection).toHaveTextContent("12");
  });

  it("falls back to 00 when loaded with no count yet", () => {
    const { container } = render(<Header timerState={{ loading: false }} />);
    const countSection = container.querySelector('[class*="countSection"]');

    expect(countSection).toHaveTextContent("00");
  });

  it("never fetches — the count rides the shared timer state prop", () => {
    render(<Header timerState={{ loading: false, hoursToday: 3 }} />);
    render(<Header timerState={{ loading: true }} />);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
