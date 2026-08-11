"use client";

import { useEffect, useRef, useState } from "react";
import type { Entry, EntryPatch } from "@/lib/db/entries.store";
import { TAGS, FEELS, INTENTS, tagColor } from "@/lib/domain";
import styles from "./EntryEditor.module.css";

export interface EntryEditorProps {
  entry: Entry;
  onSave: (updated: Entry) => void;
  onCancel: () => void;
}

export function EntryEditor({ entry, onSave, onCancel }: EntryEditorProps) {
  const [bullets, setBullets] = useState(entry.bullets);
  const [tag, setTag] = useState(entry.tag);
  const [feel, setFeel] = useState(entry.feel);
  const [intent, setIntent] = useState(entry.intent || null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [pendingFocusIndex, setPendingFocusIndex] = useState<number | null>(
    bullets.length - 1,
  );

  // Keep the ref array in sync with bullet array
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, bullets.length);
  }, [bullets.length]);

  // Apply pending focus after state update
  useEffect(() => {
    if (pendingFocusIndex !== null && inputRefs.current[pendingFocusIndex]) {
      inputRefs.current[pendingFocusIndex]?.focus();
      setPendingFocusIndex(null);
    }
  }, [pendingFocusIndex]);

  const handleBulletChange = (index: number, value: string) => {
    const newBullets = [...bullets];
    newBullets[index] = value;
    setBullets(newBullets);
  };

  const handleBulletKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const newBullets = [...bullets];
      newBullets.splice(index + 1, 0, "");
      inputRefs.current.splice(index + 1, 0, null);
      setPendingFocusIndex(index + 1);
      setBullets(newBullets);
    } else if (
      e.key === "Backspace" &&
      bullets[index] === "" &&
      bullets.length > 1
    ) {
      e.preventDefault();
      const newBullets = [...bullets];
      newBullets.splice(index, 1);
      inputRefs.current.splice(index, 1);
      setPendingFocusIndex(Math.max(0, index - 1));
      setBullets(newBullets);
    }
  };

  const handleTagClick = (tagLabel: string) => {
    if (tag === tagLabel) {
      setTag(entry.tag); // Reset to original
    } else {
      setTag(tagLabel);
    }
  };

  const handleFeelClick = (feelLabel: string) => {
    if (feel === feelLabel) {
      setFeel(entry.feel); // Reset to original
    } else {
      setFeel(feelLabel);
    }
  };

  const handleIntentClick = (intentKey: string) => {
    if (intent === intentKey) {
      setIntent(entry.intent || null); // Reset to original
    } else {
      setIntent(intentKey);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Trim and filter bullets
      let finalBullets = bullets
        .map((b) => b.trim())
        .filter((b) => b.length > 0);

      // All-empty fallback
      if (finalBullets.length === 0) {
        finalBullets = ["(nothing written down)"];
      }

      // Build patch with only changed fields
      const patch: EntryPatch = {};
      if (tag !== entry.tag) patch.tag = tag;
      if (feel !== entry.feel) patch.feel = feel;
      if (intent !== entry.intent) patch.intent = intent;
      if (JSON.stringify(finalBullets) !== JSON.stringify(entry.bullets)) {
        patch.bullets = finalBullets;
      }

      const response = await fetch(`/api/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      if (response.status === 422) {
        const data = await response.json();
        setError(data.message || "Validation failed");
        setSaving(false);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to save entry");
      }

      const updated = await response.json();
      onSave(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSaving(false);
    }
  };

  const markerColor = tagColor(tag);

  return (
    <div className={styles.editor} data-testid={`editor-${entry.id}`}>
      {/* Bullets */}
      <div className={styles.bulletList}>
        {bullets.map((bullet, index) => (
          <div key={index} className={styles.bulletRow}>
            <span
              className={styles.marker}
              style={{ backgroundColor: markerColor }}
              data-testid={`editor-bullet-marker-${entry.id}-${index}`}
            />
            <input
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              value={bullet}
              onChange={(e) => handleBulletChange(index, e.target.value)}
              onKeyDown={(e) => handleBulletKeyDown(index, e)}
              placeholder={index === 0 ? "Edit the bullet..." : "…"}
              className={styles.bulletInput}
              data-testid={`editor-bullet-input-${entry.id}-${index}`}
            />
          </div>
        ))}
      </div>

      {/* Tag chips */}
      <div className={styles.tagChipsContainer}>
        {TAGS.map((t) => {
          const isSelected = tag === t.label;
          const isOriginal = entry.tag === t.label;

          return (
            <button
              key={t.label}
              className={`${styles.tagChip} ${
                isSelected ? styles.tagChipSelected : ""
              }`}
              onClick={() => handleTagClick(t.label)}
              style={
                isSelected
                  ? { backgroundColor: t.color, borderColor: t.color }
                  : isOriginal
                    ? { borderColor: t.color, color: t.color }
                    : undefined
              }
              data-testid={`editor-chip-${entry.id}-${t.label}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Feel chips */}
      <div className={styles.feelChipsContainer}>
        {FEELS.map((f) => (
          <button
            key={f}
            className={`${styles.feelChip} ${
              feel === f ? styles.feelChipSelected : ""
            }`}
            onClick={() => handleFeelClick(f)}
            data-testid={`editor-feel-${entry.id}-${f}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Intent chips */}
      <div className={styles.intentChipsContainer}>
        {Object.entries(INTENTS).map(([key, label]) => (
          <button
            key={key}
            className={`${styles.intentChip} ${
              intent === key ? styles.intentChipSelected : ""
            }`}
            onClick={() => handleIntentClick(key)}
            data-testid={`editor-intent-${entry.id}-${key}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className={styles.error} data-testid={`editor-error-${entry.id}`}>
          {error}
        </div>
      )}

      {/* Save/Cancel buttons */}
      <div className={styles.actions}>
        <button
          className={styles.saveButton}
          onClick={handleSave}
          disabled={saving}
          data-testid={`editor-save-${entry.id}`}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          className={styles.cancelButton}
          onClick={onCancel}
          disabled={saving}
          data-testid={`editor-cancel-${entry.id}`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
