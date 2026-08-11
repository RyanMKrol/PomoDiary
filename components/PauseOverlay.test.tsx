// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PauseOverlay } from "./PauseOverlay";

afterEach(() => cleanup());

describe("PauseOverlay", () => {
  it("shows the paused headline and remaining minutes", () => {
    const { getByText } = render(
      <PauseOverlay remainingSeconds={1800} onResume={() => {}} />,
    );
    expect(getByText("Paused.")).toBeInTheDocument();
    expect(getByText("30 min still on the clock")).toBeInTheDocument();
  });

  it("resumes when the card itself is clicked", async () => {
    const onResume = vi.fn();
    const { getByTestId } = render(
      <PauseOverlay remainingSeconds={600} onResume={onResume} />,
    );
    await userEvent.click(getByTestId("pause-overlay"));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("resumes exactly once via the labeled button", async () => {
    const onResume = vi.fn();
    const { getByTestId } = render(
      <PauseOverlay remainingSeconds={600} onResume={onResume} />,
    );
    await userEvent.click(getByTestId("pause-overlay-resume"));
    expect(onResume).toHaveBeenCalledTimes(1);
  });
});
