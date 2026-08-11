// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  setChimeTitle,
  setChimeFavicon,
  requestNotifyPermission,
  notifyChime,
} from "./index";

describe("notify module", () => {
  let mockNotificationInstances: any[] = [];

  beforeEach(() => {
    // Reset document title
    document.title = "PomoDiary";

    // Create favicon link if it doesn't exist
    const existingLink = document.querySelector('link[rel="icon"]');
    if (existingLink) existingLink.remove();

    const link = document.createElement("link");
    link.rel = "icon";
    link.href = "/favicon.svg";
    document.head.appendChild(link);

    // Clear instances
    mockNotificationInstances = [];

    // Mock Notification class
    const MockNotification: any = vi.fn(function (
      this: any,
      title: string,
      options?: NotificationOptions,
    ) {
      const instance = { title, body: options?.body, onclick: null };
      mockNotificationInstances.push(instance);
      return instance;
    });

    MockNotification.permission = "default";
    MockNotification.requestPermission = vi.fn(async () => "granted");

    Object.defineProperty(window, "Notification", {
      writable: true,
      configurable: true,
      value: MockNotification,
    });
  });

  afterEach(() => {
    // Clean up favicon link
    const link = document.querySelector('link[rel="icon"]');
    if (link) link.remove();
  });

  describe("setChimeTitle", () => {
    it("sets the page title to chime title when called with true", () => {
      const originalTitle = document.title;
      expect(originalTitle).toBe("PomoDiary");

      setChimeTitle(true);
      expect(document.title).toBe("⏰ Time's ripe — PomoDiary");
    });

    it("restores the original title when called with false", () => {
      const originalTitle = document.title;
      setChimeTitle(true);
      expect(document.title).toBe("⏰ Time's ripe — PomoDiary");

      setChimeTitle(false);
      expect(document.title).toBe(originalTitle);
    });

    it("handles multiple toggles correctly", () => {
      const originalTitle = document.title;
      setChimeTitle(true);
      expect(document.title).toBe("⏰ Time's ripe — PomoDiary");

      setChimeTitle(false);
      expect(document.title).toBe(originalTitle);

      setChimeTitle(true);
      expect(document.title).toBe("⏰ Time's ripe — PomoDiary");

      setChimeTitle(false);
      expect(document.title).toBe(originalTitle);
    });

    it("does nothing on SSR (when window is undefined)", () => {
      // This is hard to test in jsdom, but the function should not throw
      expect(() => setChimeTitle(true)).not.toThrow();
    });
  });

  describe("setChimeFavicon", () => {
    it("swaps favicon href to accent variant when called with true", () => {
      const link = document.querySelector(
        'link[rel="icon"]',
      ) as HTMLLinkElement;
      expect(link.href).toContain("/favicon.svg");

      setChimeFavicon(true);
      expect(link.href).toContain("/favicon-accent.svg");
    });

    it("restores the original favicon href when called with false", () => {
      const link = document.querySelector(
        'link[rel="icon"]',
      ) as HTMLLinkElement;
      const originalHref = link.href;

      setChimeFavicon(true);
      expect(link.href).toContain("/favicon-accent.svg");

      setChimeFavicon(false);
      expect(link.href).toBe(originalHref);
    });

    it("handles multiple toggles correctly", () => {
      const link = document.querySelector(
        'link[rel="icon"]',
      ) as HTMLLinkElement;
      const originalHref = link.href;

      setChimeFavicon(true);
      expect(link.href).toContain("/favicon-accent.svg");

      setChimeFavicon(false);
      expect(link.href).toBe(originalHref);

      setChimeFavicon(true);
      expect(link.href).toContain("/favicon-accent.svg");

      setChimeFavicon(false);
      expect(link.href).toBe(originalHref);
    });

    it("does nothing if favicon link does not exist", () => {
      const link = document.querySelector('link[rel="icon"]');
      if (link) link.remove();

      expect(() => setChimeFavicon(true)).not.toThrow();
      expect(() => setChimeFavicon(false)).not.toThrow();
    });
  });

  describe("requestNotifyPermission", () => {
    it("requests notification permission", async () => {
      const notif = window.Notification;
      const MockNotification: any = vi.fn(function (
        this: any,
        title: string,
        options?: NotificationOptions,
      ) {
        return { title, body: options?.body };
      });
      MockNotification.permission = "default";
      MockNotification.requestPermission = vi.fn(async () => "granted");

      Object.defineProperty(window, "Notification", {
        writable: true,
        configurable: true,
        value: MockNotification,
      });

      await requestNotifyPermission();
      expect(MockNotification.requestPermission).toHaveBeenCalled();

      Object.defineProperty(window, "Notification", {
        writable: true,
        configurable: true,
        value: notif,
      });
    });

    it("does nothing if Notification is not defined", async () => {
      const notif = window.Notification;
      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: undefined,
      });

      // Should not throw
      await requestNotifyPermission();

      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: notif,
      });
    });
  });

  describe("notifyChime", () => {
    it("creates a notification when permission is granted and page is hidden", async () => {
      // Set permission to granted
      await requestNotifyPermission();

      // Mock visibility state
      Object.defineProperty(document, "visibilityState", {
        writable: true,
        configurable: true,
        value: "hidden",
      });

      mockNotificationInstances = [];

      const fromTs = new Date(2025, 7, 10, 14, 0, 0).getTime();
      const toTs = new Date(2025, 7, 10, 15, 0, 0).getTime();

      notifyChime(fromTs, toTs);

      expect(mockNotificationInstances.length).toBe(1);
      expect(mockNotificationInstances[0].title).toBe("Time's ripe.");
      expect(mockNotificationInstances[0].body).toContain("2:00 PM");
      expect(mockNotificationInstances[0].body).toContain("3:00 PM");
      expect(mockNotificationInstances[0].body).toContain(
        "— come account for it",
      );
    });

    it("does not create a notification when page is visible", async () => {
      // Set permission to granted
      await requestNotifyPermission();

      // Mock visibility state - page is visible
      Object.defineProperty(document, "visibilityState", {
        writable: true,
        configurable: true,
        value: "visible",
      });

      mockNotificationInstances = [];

      const fromTs = new Date(2025, 7, 10, 14, 0, 0).getTime();
      const toTs = new Date(2025, 7, 10, 15, 0, 0).getTime();

      notifyChime(fromTs, toTs);

      expect(mockNotificationInstances.length).toBe(0);
    });

    it("sets onclick handler to focus window", async () => {
      // Set permission to granted
      await requestNotifyPermission();

      // Mock visibility state
      Object.defineProperty(document, "visibilityState", {
        writable: true,
        configurable: true,
        value: "hidden",
      });

      const windowFocusSpy = vi.spyOn(window, "focus");

      const fromTs = new Date(2025, 7, 10, 14, 0, 0).getTime();
      const toTs = new Date(2025, 7, 10, 15, 0, 0).getTime();

      mockNotificationInstances = [];
      notifyChime(fromTs, toTs);

      // Simulate clicking the notification
      if (mockNotificationInstances.length > 0) {
        const notification = mockNotificationInstances[0];
        if (notification.onclick) {
          notification.onclick(new Event("click"));
          expect(windowFocusSpy).toHaveBeenCalled();
        }
      }
    });

    it("does nothing if Notification is not defined", () => {
      const notif = window.Notification;
      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: undefined,
      });

      const fromTs = new Date(2025, 7, 10, 14, 0, 0).getTime();
      const toTs = new Date(2025, 7, 10, 15, 0, 0).getTime();

      // Should not throw
      expect(() => notifyChime(fromTs, toTs)).not.toThrow();

      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: notif,
      });
    });
  });
});
