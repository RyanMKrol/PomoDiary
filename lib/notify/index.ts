import { fmtClock } from "../time";

const CHIME_TITLE = "⏰ Time's ripe — PomoDiary";
const FAVICON_ACCENT_HREF = "/favicon-accent.svg";

let originalTitle: string | null = null;
let originalFaviconHref: string | null = null;
let notificationPermission: NotificationPermission | null = null;

export function setChimeTitle(on: boolean): void {
  if (typeof window === "undefined") return;

  if (on) {
    if (originalTitle === null) {
      originalTitle = document.title;
    }
    document.title = CHIME_TITLE;
  } else {
    if (originalTitle !== null) {
      document.title = originalTitle;
      originalTitle = null;
    }
  }
}

export function setChimeFavicon(on: boolean): void {
  if (typeof window === "undefined") return;

  const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
  if (!link) return;

  if (on) {
    if (originalFaviconHref === null) {
      originalFaviconHref = link.href;
    }
    link.href = FAVICON_ACCENT_HREF;
  } else {
    if (originalFaviconHref !== null) {
      link.href = originalFaviconHref;
      originalFaviconHref = null;
    }
  }
}

export async function requestNotifyPermission(): Promise<void> {
  if (typeof Notification === "undefined") return;
  if (typeof window === "undefined") return;

  if (notificationPermission === null) {
    notificationPermission = await Notification.requestPermission();
  }
}

export function notifyChime(fromTs: number, toTs: number): void {
  if (typeof Notification === "undefined") return;
  if (typeof window === "undefined") return;

  if (
    notificationPermission !== "granted" ||
    document.visibilityState !== "hidden"
  ) {
    return;
  }

  const from = fmtClock(fromTs);
  const to = fmtClock(toTs);
  const notification = new Notification("Time's ripe.", {
    body: `${from} – ${to} — come account for it`,
  });

  notification.onclick = () => {
    window.focus();
  };
}
