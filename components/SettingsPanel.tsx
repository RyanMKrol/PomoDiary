"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiSettings } from "@/lib/api/timer-state";
import styles from "./SettingsPanel.module.css";

export interface SettingsPanelProps {
  settings: ApiSettings;
  updateSettings: (patch: Partial<ApiSettings>) => Promise<void>;
  onClose: () => void;
  isOpen: boolean;
}

export function SettingsPanel({
  settings,
  updateSettings,
  onClose,
  isOpen,
}: SettingsPanelProps) {
  const [soundOn, setSoundOn] = useState(settings.soundOn);
  const [chimeVolume, setChimeVolume] = useState(settings.chimeVolume);
  const [pauseAfterLog, setPauseAfterLog] = useState(settings.pauseAfterLog);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSoundOn(settings.soundOn);
    setChimeVolume(settings.chimeVolume);
    setPauseAfterLog(settings.pauseAfterLog);
  }, [settings]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  const handleSoundToggle = async (value: boolean) => {
    setSoundOn(value);
    await updateSettings({ soundOn: value });
  };

  const handleVolumeSelect = async (volume: number) => {
    setChimeVolume(volume);
    await updateSettings({ chimeVolume: volume });
  };

  const handlePauseAfterLogToggle = async (value: boolean) => {
    setPauseAfterLog(value);
    await updateSettings({ pauseAfterLog: value });
  };

  if (!isOpen) return null;

  return (
    <div
      className={styles.panelOverlay}
      ref={panelRef}
      data-testid="settings-panel"
    >
      <div className={styles.panelContent}>
        <div className={styles.section}>
          <label className={styles.sectionLabel}>Sound</label>
          <div className={styles.segmentedRow}>
            <button
              className={`${styles.segment} ${
                soundOn ? styles.segmentSelected : ""
              }`}
              onClick={() => handleSoundToggle(true)}
              data-testid="sound-on-button"
            >
              On
            </button>
            <button
              className={`${styles.segment} ${
                !soundOn ? styles.segmentSelected : ""
              }`}
              onClick={() => handleSoundToggle(false)}
              data-testid="sound-off-button"
            >
              Off
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <label className={styles.sectionLabel}>Volume</label>
          <div className={styles.segmentedRow}>
            {[0, 0.25, 0.5, 0.75, 1].map((vol) => (
              <button
                key={vol}
                className={`${styles.segment} ${
                  chimeVolume === vol ? styles.segmentSelected : ""
                }`}
                onClick={() => handleVolumeSelect(vol)}
                data-testid={`volume-${vol}-button`}
              >
                {vol === 0 ? "0" : vol === 1 ? "1" : vol.toFixed(2)}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <label className={styles.sectionLabel}>Start next hour paused</label>
          <div className={styles.segmentedRow}>
            <button
              className={`${styles.segment} ${
                !pauseAfterLog ? styles.segmentSelected : ""
              }`}
              onClick={() => handlePauseAfterLogToggle(false)}
              data-testid="pause-start-at-once-button"
            >
              Start at once
            </button>
            <button
              className={`${styles.segment} ${
                pauseAfterLog ? styles.segmentSelected : ""
              }`}
              onClick={() => handlePauseAfterLogToggle(true)}
              data-testid="pause-wait-for-me-button"
            >
              Wait for me
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
