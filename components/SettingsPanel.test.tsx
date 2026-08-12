// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPanel } from "./SettingsPanel";
import type { ApiSettings } from "@/lib/api/timer-state";

describe("SettingsPanel", () => {
  const defaultSettings: ApiSettings = {
    soundOn: true,
    chimeVolume: 0.5,
    pauseAfterLog: false,
    recentAwayLabels: [],
  };

  const mockUpdateSettings = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockUpdateSettings.mockClear();
    mockOnClose.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  describe("visibility", () => {
    it("renders when isOpen is true", () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          updateSettings={mockUpdateSettings}
          onClose={mockOnClose}
          isOpen={true}
        />,
      );

      expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
    });

    it("does not render when isOpen is false", () => {
      const { queryByTestId } = render(
        <SettingsPanel
          settings={defaultSettings}
          updateSettings={mockUpdateSettings}
          onClose={mockOnClose}
          isOpen={false}
        />,
      );

      expect(queryByTestId("settings-panel")).not.toBeInTheDocument();
    });

    it("closes panel on outside click", async () => {
      render(
        <>
          <div data-testid="outside-element" />
          <SettingsPanel
            settings={defaultSettings}
            updateSettings={mockUpdateSettings}
            onClose={mockOnClose}
            isOpen={true}
          />
        </>,
      );

      const outsideElement = screen.getByTestId("outside-element");
      fireEvent.mouseDown(outsideElement);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("sound toggle", () => {
    it("reflects current sound state", () => {
      render(
        <SettingsPanel
          settings={{ ...defaultSettings, soundOn: false }}
          updateSettings={mockUpdateSettings}
          onClose={mockOnClose}
          isOpen={true}
        />,
      );

      const offButton = screen.getByTestId("sound-off-button");
      expect(offButton.className).toMatch(/segmentSelected/);
    });

    it("toggles sound on", async () => {
      render(
        <SettingsPanel
          settings={{ ...defaultSettings, soundOn: false }}
          updateSettings={mockUpdateSettings}
          onClose={mockOnClose}
          isOpen={true}
        />,
      );

      const onButton = screen.getByTestId("sound-on-button");
      await userEvent.click(onButton);

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith({ soundOn: true });
      });
    });

    it("toggles sound off", async () => {
      render(
        <SettingsPanel
          settings={{ ...defaultSettings, soundOn: true }}
          updateSettings={mockUpdateSettings}
          onClose={mockOnClose}
          isOpen={true}
        />,
      );

      const offButton = screen.getByTestId("sound-off-button");
      await userEvent.click(offButton);

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith({ soundOn: false });
      });
    });
  });

  describe("volume selector", () => {
    it("reflects current volume value", () => {
      render(
        <SettingsPanel
          settings={{ ...defaultSettings, chimeVolume: 0.75 }}
          updateSettings={mockUpdateSettings}
          onClose={mockOnClose}
          isOpen={true}
        />,
      );

      const selectedButton = screen.getByTestId("volume-0.75-button");
      expect(selectedButton.className).toMatch(/segmentSelected/);
    });

    it("selects volume 0", async () => {
      render(
        <SettingsPanel
          settings={{ ...defaultSettings, chimeVolume: 0.5 }}
          updateSettings={mockUpdateSettings}
          onClose={mockOnClose}
          isOpen={true}
        />,
      );

      const button = screen.getByTestId("volume-0-button");
      await userEvent.click(button);

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith({ chimeVolume: 0 });
      });
    });

    it("selects volume 0.25", async () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          updateSettings={mockUpdateSettings}
          onClose={mockOnClose}
          isOpen={true}
        />,
      );

      const button = screen.getByTestId("volume-0.25-button");
      await userEvent.click(button);

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith({
          chimeVolume: 0.25,
        });
      });
    });

    it("selects volume 0.5", async () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          updateSettings={mockUpdateSettings}
          onClose={mockOnClose}
          isOpen={true}
        />,
      );

      const button = screen.getByTestId("volume-0.5-button");
      await userEvent.click(button);

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith({
          chimeVolume: 0.5,
        });
      });
    });

    it("selects volume 0.75", async () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          updateSettings={mockUpdateSettings}
          onClose={mockOnClose}
          isOpen={true}
        />,
      );

      const button = screen.getByTestId("volume-0.75-button");
      await userEvent.click(button);

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith({
          chimeVolume: 0.75,
        });
      });
    });

    it("selects volume 1", async () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          updateSettings={mockUpdateSettings}
          onClose={mockOnClose}
          isOpen={true}
        />,
      );

      const button = screen.getByTestId("volume-1-button");
      await userEvent.click(button);

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith({ chimeVolume: 1 });
      });
    });
  });

  describe("pause after log toggle", () => {
    it("reflects current pause after log state - start at once", () => {
      render(
        <SettingsPanel
          settings={{ ...defaultSettings, pauseAfterLog: false }}
          updateSettings={mockUpdateSettings}
          onClose={mockOnClose}
          isOpen={true}
        />,
      );

      const startAtOnceButton = screen.getByTestId(
        "pause-start-at-once-button",
      );
      expect(startAtOnceButton.className).toMatch(/segmentSelected/);
    });

    it("reflects current pause after log state - wait for me", () => {
      render(
        <SettingsPanel
          settings={{ ...defaultSettings, pauseAfterLog: true }}
          updateSettings={mockUpdateSettings}
          onClose={mockOnClose}
          isOpen={true}
        />,
      );

      const waitForMeButton = screen.getByTestId("pause-wait-for-me-button");
      expect(waitForMeButton.className).toMatch(/segmentSelected/);
    });

    it("sets pause after log to false when selecting start at once", async () => {
      render(
        <SettingsPanel
          settings={{ ...defaultSettings, pauseAfterLog: true }}
          updateSettings={mockUpdateSettings}
          onClose={mockOnClose}
          isOpen={true}
        />,
      );

      const startAtOnceButton = screen.getByTestId(
        "pause-start-at-once-button",
      );
      await userEvent.click(startAtOnceButton);

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith({
          pauseAfterLog: false,
        });
      });
    });

    it("sets pause after log to true when selecting wait for me", async () => {
      render(
        <SettingsPanel
          settings={{ ...defaultSettings, pauseAfterLog: false }}
          updateSettings={mockUpdateSettings}
          onClose={mockOnClose}
          isOpen={true}
        />,
      );

      const waitForMeButton = screen.getByTestId("pause-wait-for-me-button");
      await userEvent.click(waitForMeButton);

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith({
          pauseAfterLog: true,
        });
      });
    });
  });

  describe("settings persistence", () => {
    it("updates when settings prop changes", () => {
      const { rerender } = render(
        <SettingsPanel
          settings={{ ...defaultSettings, chimeVolume: 0.5 }}
          updateSettings={mockUpdateSettings}
          onClose={mockOnClose}
          isOpen={true}
        />,
      );

      expect(screen.getByTestId("volume-0.5-button").className).toMatch(
        /segmentSelected/,
      );

      rerender(
        <SettingsPanel
          settings={{ ...defaultSettings, chimeVolume: 1 }}
          updateSettings={mockUpdateSettings}
          onClose={mockOnClose}
          isOpen={true}
        />,
      );

      expect(screen.getByTestId("volume-1-button").className).toMatch(
        /segmentSelected/,
      );
    });

    it("syncs all settings when they change externally", () => {
      const { rerender } = render(
        <SettingsPanel
          settings={{
            soundOn: true,
            chimeVolume: 0.5,
            pauseAfterLog: false,
            recentAwayLabels: [],
          }}
          updateSettings={mockUpdateSettings}
          onClose={mockOnClose}
          isOpen={true}
        />,
      );

      rerender(
        <SettingsPanel
          settings={{
            soundOn: false,
            chimeVolume: 0.75,
            pauseAfterLog: true,
            recentAwayLabels: [],
          }}
          updateSettings={mockUpdateSettings}
          onClose={mockOnClose}
          isOpen={true}
        />,
      );

      const soundOffButton = screen.getByTestId("sound-off-button");
      expect(soundOffButton.className).toMatch(/segmentSelected/);

      const volumeButton = screen.getByTestId("volume-0.75-button");
      expect(volumeButton.className).toMatch(/segmentSelected/);

      const pauseButton = screen.getByTestId("pause-wait-for-me-button");
      expect(pauseButton.className).toMatch(/segmentSelected/);
    });
  });

  describe("styling", () => {
    it("renders settings panel with expected structure", () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          updateSettings={mockUpdateSettings}
          onClose={mockOnClose}
          isOpen={true}
        />,
      );

      const panel = screen.getByTestId("settings-panel");
      expect(panel).toBeInTheDocument();
      expect(panel.className).toMatch(/panelOverlay/);
    });

    it("applies selected state styling to segmented controls", async () => {
      render(
        <SettingsPanel
          settings={{ ...defaultSettings, soundOn: true }}
          updateSettings={mockUpdateSettings}
          onClose={mockOnClose}
          isOpen={true}
        />,
      );

      const selectedButton = screen.getByTestId("sound-on-button");
      expect(selectedButton.className).toMatch(/segmentSelected/);
    });
  });
});
