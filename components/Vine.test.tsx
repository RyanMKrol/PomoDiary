// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Vine } from "./Vine";

function mockFetchResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.fetch = vi.fn(() => mockFetchResponse([])) as any;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Vine", () => {
  describe("panel header", () => {
    it("renders 'The vine' label", async () => {
      render(<Vine timerState={{ mode: "running" }} />);
      const label = screen.getByText("The vine");
      expect(label).toBeInTheDocument();
    });

    it("renders view title as 'Today' for current day", async () => {
      render(<Vine timerState={{ mode: "running" }} />);
      await screen.findByText("Nothing in the basket yet.");
      const title = screen.getByText("Today");
      expect(title).toBeInTheDocument();
    });

    it("renders zoom button with correct label for day view", async () => {
      render(<Vine timerState={{ mode: "running" }} />);
      const button = screen.getByTestId("vine-zoom-button");
      expect(button).toHaveTextContent("Zoom out");
    });

    it("renders zoom button with square icon", async () => {
      render(<Vine timerState={{ mode: "running" }} />);
      const button = screen.getByTestId("vine-zoom-button");
      expect(button).toBeInTheDocument();
      expect(button.textContent).toContain("Zoom out");
    });

    it("renders settings button", async () => {
      render(<Vine timerState={{ mode: "running" }} />);
      const button = screen.getByTestId("vine-settings-button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("Settings");
    });
  });

  describe("view toggling", () => {
    it("toggles view from day to grid when zoom button clicked", async () => {
      const user = userEvent.setup();
      render(<Vine timerState={{ mode: "running" }} />);

      await screen.findByText("Nothing in the basket yet.");

      const button = screen.getByTestId("vine-zoom-button");
      expect(button).toHaveTextContent("Zoom out");

      await user.click(button);
      expect(button).toHaveTextContent("Back to the day");
    });

    it("toggles back to day view when zoom button clicked again", async () => {
      const user = userEvent.setup();
      render(<Vine timerState={{ mode: "running" }} />);

      await screen.findByText("Nothing in the basket yet.");

      const button = screen.getByTestId("vine-zoom-button");
      await user.click(button);
      expect(button).toHaveTextContent("Back to the day");

      await user.click(button);
      expect(button).toHaveTextContent("Zoom out");
    });

    it("hides DayView when in grid view", async () => {
      const user = userEvent.setup();
      render(<Vine timerState={{ mode: "running" }} />);

      await screen.findByText("Nothing in the basket yet.");

      const button = screen.getByTestId("vine-zoom-button");
      await user.click(button);

      expect(
        screen.queryByText("Nothing in the basket yet."),
      ).not.toBeInTheDocument();
    });

    it("shows DayView when toggling back to day view", async () => {
      const user = userEvent.setup();
      render(<Vine timerState={{ mode: "running" }} />);

      await screen.findByText("Nothing in the basket yet.");

      const button = screen.getByTestId("vine-zoom-button");
      await user.click(button);
      await user.click(button);

      await screen.findByText("Nothing in the basket yet.");
    });
  });

  describe("settings panel", () => {
    it("does not render settings panel initially", async () => {
      const settings = {
        sessionMinutes: 60,
        soundOn: true,
        chimeVolume: 0.5,
        pauseAfterLog: false,
      };
      const updateSettings = vi.fn();

      render(
        <Vine
          timerState={{
            mode: "running",
            settings,
            updateSettings,
          }}
        />,
      );

      await screen.findByText("Nothing in the basket yet.");
      expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();
    });

    it("opens settings panel when settings button clicked", async () => {
      const user = userEvent.setup();
      const settings = {
        sessionMinutes: 60,
        soundOn: true,
        chimeVolume: 0.5,
        pauseAfterLog: false,
      };
      const updateSettings = vi.fn();

      render(
        <Vine
          timerState={{
            mode: "running",
            settings,
            updateSettings,
          }}
        />,
      );

      await screen.findByText("Nothing in the basket yet.");
      const settingsButton = screen.getByTestId("vine-settings-button");
      await user.click(settingsButton);

      expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
    });

    it("shows settings panel when settings button is clicked with settings provided", async () => {
      const user = userEvent.setup();
      const settings = {
        sessionMinutes: 60,
        soundOn: true,
        chimeVolume: 0.5,
        pauseAfterLog: false,
      };
      const updateSettings = vi.fn();

      render(
        <Vine
          timerState={{
            mode: "running",
            settings,
            updateSettings,
          }}
        />,
      );

      await screen.findByText("Nothing in the basket yet.");
      const settingsButton = screen.getByTestId("vine-settings-button");

      // Initially panel should not be visible
      expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();

      // Click to open
      await user.click(settingsButton);

      // Panel should now be visible
      expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
      expect(screen.getByTestId("session-minutes-input")).toBeInTheDocument();
    });
  });

  describe("focus management", () => {
    it("returns focus to the settings button when the panel closes", async () => {
      const user = userEvent.setup();
      const settings = {
        sessionMinutes: 60,
        soundOn: true,
        chimeVolume: 0.5,
        pauseAfterLog: false,
      };
      const updateSettings = vi.fn();

      render(
        <Vine
          timerState={{
            mode: "running",
            settings,
            updateSettings,
          }}
        />,
      );

      await screen.findByText("Nothing in the basket yet.");
      const settingsButton = screen.getByTestId("vine-settings-button");
      await user.click(settingsButton);
      expect(screen.getByTestId("settings-panel")).toBeInTheDocument();

      const outside = document.createElement("div");
      document.body.appendChild(outside);
      fireEvent.mouseDown(outside);

      await waitFor(() => {
        expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();
      });
      expect(settingsButton).toHaveFocus();

      document.body.removeChild(outside);
    });
  });

  describe("integration", () => {
    it("renders vine container", () => {
      const { container } = render(<Vine timerState={{ mode: "running" }} />);
      expect(
        container.querySelector("[data-testid='vine-container']"),
      ).toBeInTheDocument();
    });

    it("renders header with correct structure", async () => {
      render(<Vine timerState={{ mode: "running" }} />);
      const label = screen.getByText("The vine");
      const title = screen.getByText("Today");
      const button = screen.getByTestId("vine-zoom-button");
      expect(label).toBeInTheDocument();
      expect(title).toBeInTheDocument();
      expect(button).toBeInTheDocument();
    });
  });
});
