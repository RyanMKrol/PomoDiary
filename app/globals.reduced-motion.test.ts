import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("prefers-reduced-motion", () => {
  const css = readFileSync(join(__dirname, "globals.css"), "utf-8");

  it("suppresses animations under prefers-reduced-motion: reduce", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it("forces animation duration/iteration down instead of touching transitions", () => {
    const match = css.match(
      /@media \(prefers-reduced-motion: reduce\) {([\s\S]*?)}\s*}/,
    );
    expect(match).not.toBeNull();
    const block = match![1];
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(block).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(block).not.toMatch(/transition-duration/);
  });

  it("still defines the six ambient keyframe animations it is meant to suppress", () => {
    for (const name of [
      "breathe",
      "ringPulse",
      "riseIn",
      "wipeIn",
      "barGrow",
      "popDot",
    ]) {
      expect(css).toMatch(new RegExp(`@keyframes ${name}\\b`));
    }
  });
});
