// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";

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

describe("RTL setup", () => {
  it("renders a React component with RTL", () => {
    const TestComponent = () => <div>test content</div>;

    render(<TestComponent />);

    expect(screen.getByText("test content")).toBeInTheDocument();
  });

  it("window.matchMedia is callable and returns MediaQueryList-like object", () => {
    const mediaQuery = window.matchMedia("(min-width: 1px)");

    expect(mediaQuery).toBeDefined();
    expect(mediaQuery.matches).toBeDefined();
    expect(typeof mediaQuery.matches).toBe("boolean");
  });
});
