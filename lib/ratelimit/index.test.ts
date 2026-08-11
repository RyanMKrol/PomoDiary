import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mockLimit = vi.fn();

// Mock the Upstash modules before importing the module under test
vi.mock("@upstash/redis", () => {
  return {
    Redis: class {
      constructor() {}
    },
  };
});

vi.mock("@upstash/ratelimit", () => {
  return {
    Ratelimit: class {
      limit = mockLimit;
      static slidingWindow() {
        return {};
      }
      constructor() {}
    },
  };
});

import { checkRateLimit, userKey, ipKey, resetState } from "./index";

describe("ratelimit", () => {
  beforeEach(() => {
    mockLimit.mockClear();
    vi.clearAllMocks();
    resetState();
    // Reset environment variables for each test
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("userKey and ipKey", () => {
    it("formats user key correctly", () => {
      expect(userKey("user123")).toBe("user:user123");
    });

    it("formats IP key correctly", () => {
      expect(ipKey("192.168.1.1")).toBe("ip:192.168.1.1");
    });
  });

  describe("checkRateLimit", () => {
    it("allows requests under the read limit", async () => {
      process.env.KV_REST_API_URL = "https://redis.example.com";
      process.env.KV_REST_API_TOKEN = "token123";

      mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 1000 });

      const result = await checkRateLimit("user:123", "read");

      expect(result.ok).toBe(true);
      expect(result.retryAfterSeconds).toBeUndefined();
      expect(mockLimit).toHaveBeenCalledWith("user:123");
    });

    it("allows requests under the write limit", async () => {
      process.env.KV_REST_API_URL = "https://redis.example.com";
      process.env.KV_REST_API_TOKEN = "token123";

      mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 1000 });

      const result = await checkRateLimit("user:123", "write");

      expect(result.ok).toBe(true);
      expect(result.retryAfterSeconds).toBeUndefined();
      expect(mockLimit).toHaveBeenCalledWith("user:123");
    });

    it("blocks requests that exceed read limit", async () => {
      process.env.KV_REST_API_URL = "https://redis.example.com";
      process.env.KV_REST_API_TOKEN = "token123";

      const now = Date.now();
      const reset = now + 30000;

      mockLimit.mockResolvedValue({
        success: false,
        reset,
      });

      const result = await checkRateLimit("user:123", "read");

      expect(result.ok).toBe(false);
      expect(result.retryAfterSeconds).toBe(30);
    });

    it("blocks requests that exceed write limit", async () => {
      process.env.KV_REST_API_URL = "https://redis.example.com";
      process.env.KV_REST_API_TOKEN = "token123";

      const now = Date.now();
      const reset = now + 45000;

      mockLimit.mockResolvedValue({
        success: false,
        reset,
      });

      const result = await checkRateLimit("user:123", "write");

      expect(result.ok).toBe(false);
      expect(result.retryAfterSeconds).toBe(45);
    });

    it("fails open when KV_REST_API_URL is missing", async () => {
      delete process.env.KV_REST_API_URL;
      process.env.KV_REST_API_TOKEN = "token123";

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const result = await checkRateLimit("user:123", "read");

      expect(result.ok).toBe(true);
      expect(result.retryAfterSeconds).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Rate limit environment variables"),
      );

      consoleWarnSpy.mockRestore();
    });

    it("fails open when KV_REST_API_TOKEN is missing", async () => {
      process.env.KV_REST_API_URL = "https://redis.example.com";
      delete process.env.KV_REST_API_TOKEN;

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const result = await checkRateLimit("user:456", "read");

      expect(result.ok).toBe(true);
      expect(result.retryAfterSeconds).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Rate limit environment variables"),
      );

      consoleWarnSpy.mockRestore();
    });

    it("fails open when Redis client throws an error", async () => {
      process.env.KV_REST_API_URL = "https://redis.example.com";
      process.env.KV_REST_API_TOKEN = "token123";

      mockLimit.mockRejectedValue(new Error("Redis connection failed"));

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const result = await checkRateLimit("user:789", "read");

      expect(result.ok).toBe(true);
      expect(result.retryAfterSeconds).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalled();
      const calls = consoleWarnSpy.mock.calls;
      expect(calls[0][0]).toContain("Rate limit check failed");

      consoleWarnSpy.mockRestore();
    });
  });
});
