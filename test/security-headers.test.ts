import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("security headers", () => {
  it("should have headers configuration", async () => {
    expect(nextConfig.headers).toBeDefined();
  });

  it("should include security headers for catch-all route", async () => {
    const headers = await nextConfig.headers!();
    const catchAllHeader = headers.find((h) => h.source === "/(.*)")!;

    expect(catchAllHeader).toBeDefined();
    expect(catchAllHeader.headers).toBeDefined();

    const headerMap = new Map(
      catchAllHeader.headers.map((h) => [h.key, h.value]),
    );

    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headerMap.get("X-Frame-Options")).toBe("DENY");
    expect(headerMap.get("Content-Security-Policy")).toBe(
      "frame-ancestors 'none'",
    );
    expect(headerMap.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headerMap.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
  });

  it("should have exactly five headers for the catch-all route", async () => {
    const headers = await nextConfig.headers!();
    const catchAllHeader = headers.find((h) => h.source === "/(.*)")!;

    expect(catchAllHeader.headers).toHaveLength(5);
  });
});
