export function fmtClock(ts: number): string {
  const date = new Date(ts);
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return formatter.format(date);
}

export function dayKey(ts: number): string {
  return new Date(ts).toDateString();
}

export function fmtDayTitle(ts: number, now: number): string {
  const date = new Date(ts);
  const nowDate = new Date(now);

  // Check if same day in local time
  if (
    date.getFullYear() === nowDate.getFullYear() &&
    date.getMonth() === nowDate.getMonth() &&
    date.getDate() === nowDate.getDate()
  ) {
    return "Today";
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  const parts = formatter.formatToParts(date);
  let weekday = "";
  let day = "";
  let month = "";

  for (const part of parts) {
    if (part.type === "weekday") weekday = part.value;
    if (part.type === "day") day = part.value;
    if (part.type === "month") month = part.value;
  }

  return `${weekday} ${day} ${month}`;
}

export function fmtGridDayLabel(ts: number, index: number): string {
  if (index === 0) return "Today";
  if (index === 1) return "Yesterday";

  const date = new Date(ts);
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    day: "numeric",
  });
  const parts = formatter.formatToParts(date);
  let weekday = "";
  let day = "";

  for (const part of parts) {
    if (part.type === "weekday") weekday = part.value;
    if (part.type === "day") day = part.value;
  }

  return `${weekday} ${day}`;
}

export function fmtTodayLabel(now: number): string {
  const date = new Date(now);
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const parts = formatter.formatToParts(date);
  let weekday = "";
  let day = "";
  let month = "";

  for (const part of parts) {
    if (part.type === "weekday") weekday = part.value;
    if (part.type === "day") day = part.value;
    if (part.type === "month") month = part.value;
  }

  return `${weekday} ${day} ${month}`;
}

export function fmtAwayElapsed(sinceTs: number, now: number): string {
  const elapsedMs = now - sinceTs;
  const elapsedMinutes = Math.floor(elapsedMs / 60000);

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min`;
  }

  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function padCount(n: number): string {
  return String(n).padStart(2, "0");
}

export function fmtChimeRange(fromTs: number, toTs: number): string {
  const from = fmtClock(fromTs);
  const to = fmtClock(toTs);
  return `${from} – ${to}`;
}

export function gridCellTitle(
  hour: number,
  tag: string,
  firstBullet: string,
): string {
  const hourStr = hour.toString();
  return `${hourStr}:00 · ${tag} — ${firstBullet}`;
}

export function gridCellEmptyTitle(hour: number): string {
  const hourStr = hour.toString();
  return `${hourStr}:00 · not logged`;
}
