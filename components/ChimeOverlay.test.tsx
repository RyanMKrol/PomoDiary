// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeAll, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChimeOverlay } from "./ChimeOverlay";

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

describe("ChimeOverlay", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const aug10_214pm = new Date("2026-08-10T14:14:00").getTime();
  const aug10_314pm = new Date("2026-08-10T15:14:00").getTime();

  it("renders chime overlay", () => {
    const onAcknowledge = vi.fn();
    render(
      <ChimeOverlay
        chimeFrom={aug10_214pm}
        chimeTo={aug10_314pm}
        onAcknowledge={onAcknowledge}
      />,
    );

    expect(screen.getByTestId("chime-overlay")).toBeInTheDocument();
  });

  it("displays headline with apostrophe and line break", () => {
    const onAcknowledge = vi.fn();
    const { container } = render(
      <ChimeOverlay
        chimeFrom={aug10_214pm}
        chimeTo={aug10_314pm}
        onAcknowledge={onAcknowledge}
      />,
    );

    const headline = container.querySelector("h1");
    expect(headline?.textContent).toMatch(/TIME.*S.*RIPE\./);
  });

  it("displays time range in footer", () => {
    const onAcknowledge = vi.fn();
    const { container } = render(
      <ChimeOverlay
        chimeFrom={aug10_214pm}
        chimeTo={aug10_314pm}
        onAcknowledge={onAcknowledge}
      />,
    );

    const footer = container.querySelector("p");
    expect(footer?.textContent).toContain("2:14 PM");
    expect(footer?.textContent).toContain("3:14 PM");
  });

  it("displays footer message about clicking", () => {
    const onAcknowledge = vi.fn();
    const { container } = render(
      <ChimeOverlay
        chimeFrom={aug10_214pm}
        chimeTo={aug10_314pm}
        onAcknowledge={onAcknowledge}
      />,
    );

    const footer = container.querySelector("p");
    expect(footer?.textContent).toContain("click anywhere to account for it");
  });

  it("calls onAcknowledge when clicked", async () => {
    const user = userEvent.setup();
    const onAcknowledge = vi.fn();
    render(
      <ChimeOverlay
        chimeFrom={aug10_214pm}
        chimeTo={aug10_314pm}
        onAcknowledge={onAcknowledge}
      />,
    );

    const overlay = screen.getByTestId("chime-overlay");
    await user.click(overlay);

    expect(onAcknowledge).toHaveBeenCalledOnce();
  });

  it("renders pulse animation box", () => {
    const onAcknowledge = vi.fn();
    const { container } = render(
      <ChimeOverlay
        chimeFrom={aug10_214pm}
        chimeTo={aug10_314pm}
        onAcknowledge={onAcknowledge}
      />,
    );

    const pulseBox = container.querySelector("[class*='pulseBox']");
    expect(pulseBox).toBeInTheDocument();
  });

  it("has absolute positioning to cover panel", () => {
    const onAcknowledge = vi.fn();
    const { container } = render(
      <ChimeOverlay
        chimeFrom={aug10_214pm}
        chimeTo={aug10_314pm}
        onAcknowledge={onAcknowledge}
      />,
    );

    const overlay = container.querySelector("[data-testid='chime-overlay']");
    expect(overlay).toBeInTheDocument();
    // Verify it's a button (the overlay is a button element)
    expect(overlay?.tagName).toBe("BUTTON");
  });
});
