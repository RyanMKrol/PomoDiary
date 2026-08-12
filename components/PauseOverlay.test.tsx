// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PauseOverlay } from "./PauseOverlay";

afterEach(() => cleanup());

describe("PauseOverlay", () => {
  it("shows the paused headline and the holding copy", () => {
    const { getByText } = render(<PauseOverlay onResume={() => {}} />);
    expect(getByText("Paused.")).toBeInTheDocument();
    expect(getByText("Holding between hours")).toBeInTheDocument();
    expect(
      getByText(
        /The clock waits for you\. Click anywhere to start a block that runs to the next :00\./,
      ),
    ).toBeInTheDocument();
  });

  it("resumes when the card itself is clicked", async () => {
    const onResume = vi.fn();
    const { getByTestId } = render(<PauseOverlay onResume={onResume} />);
    await userEvent.click(getByTestId("pause-overlay"));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("resumes exactly once via the labeled button", async () => {
    const onResume = vi.fn();
    const { getByTestId } = render(<PauseOverlay onResume={onResume} />);
    await userEvent.click(getByTestId("pause-overlay-resume"));
    expect(onResume).toHaveBeenCalledTimes(1);
  });
});
