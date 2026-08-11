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
import { render, waitFor, cleanup } from "@testing-library/react";
import { Header } from "./Header";

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

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the wordmark", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ count: 5 }),
        }),
      ),
    );

    const { container } = render(<Header />);
    const wordmark = container.querySelector('[class*="wordmark"]');

    expect(wordmark).toHaveTextContent("POMODIARY");
  });

  it("renders the tagline", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ count: 5 }),
        }),
      ),
    );

    const { container } = render(<Header />);
    const tagline = container.querySelector('[class*="tagline"]');

    expect(tagline).toHaveTextContent("One hour. One honest account of it.");
  });

  it("renders hours-today count with fetch mocked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ count: 6 }),
        }),
      ),
    );

    const { container } = render(<Header />);
    const countSection = container.querySelector('[class*="countSection"]');

    // Initially shows "00" while loading
    expect(countSection).toHaveTextContent("00");

    // Wait for the count to be fetched and displayed
    await waitFor(
      () => {
        expect(countSection).toHaveTextContent("06");
      },
      { timeout: 1000 },
    );
  });

  it("renders count as zero-padded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ count: 3 }),
        }),
      ),
    );

    const { container } = render(<Header />);
    const countSection = container.querySelector('[class*="countSection"]');

    // Wait for the count to be fetched and displayed
    await waitFor(
      () => {
        expect(countSection).toHaveTextContent("03");
      },
      { timeout: 1000 },
    );
  });

  it("renders 00 while fetch is unresolved", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise(() => {
            /* Never resolves */
          }),
      ),
    );

    const { container } = render(<Header />);
    const countSection = container.querySelector('[class*="countSection"]');

    expect(countSection).toHaveTextContent("00");
  });
});
