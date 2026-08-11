import styles from "./Panels.module.css";

export function Panels() {
  return (
    <div className={styles.panelsContainer}>
      <div className={styles.leftPanel} data-testid="left-panel">
        {/* Placeholder for timer panel */}
      </div>
      <div className={styles.rightPanel} data-testid="right-panel">
        {/* Placeholder for log panel */}
      </div>
    </div>
  );
}
