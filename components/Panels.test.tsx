// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, beforeAll, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
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

describe("Panels", () => {
  afterEach(() => {
    cleanup();
  });

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
});
