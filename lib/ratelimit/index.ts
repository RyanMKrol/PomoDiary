import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RateLimitKind = "read" | "write";

interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds?: number;
}

let readLimitClient: Ratelimit | null = null;
let writeLimitClient: Ratelimit | null = null;
let failOpenWarned = false;

function getClients(): {
  read: Ratelimit | null;
  write: Ratelimit | null;
} {
  if (readLimitClient && writeLimitClient) {
    return { read: readLimitClient, write: writeLimitClient };
  }

  const apiUrl = process.env.KV_REST_API_URL;
  const apiToken = process.env.KV_REST_API_TOKEN;

  if (!apiUrl || !apiToken) {
    if (!failOpenWarned) {
      console.warn(
        "Rate limit environment variables (KV_REST_API_URL, KV_REST_API_TOKEN) not set. " +
          "Rate limiting is disabled (fail-open mode).",
      );
      failOpenWarned = true;
    }
    return { read: null, write: null };
  }

  try {
    const redis = new Redis({
      url: apiUrl,
      token: apiToken,
    });

    readLimitClient = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(120, "1 m"),
      prefix: "pomodiary:read",
    });

    writeLimitClient = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "1 m"),
      prefix: "pomodiary:write",
    });

    return { read: readLimitClient, write: writeLimitClient };
  } catch (error) {
    console.warn(
      "Failed to initialize rate limit client:",
      error instanceof Error ? error.message : String(error),
    );
    return { read: null, write: null };
  }
}

export async function checkRateLimit(
  key: string,
  kind: RateLimitKind,
): Promise<RateLimitResult> {
  const { read, write } = getClients();
  const client = kind === "read" ? read : write;

  if (!client) {
    return { ok: true };
  }

  try {
    const result = await client.limit(key);

    if (!result.success) {
      return {
        ok: false,
        retryAfterSeconds: Math.ceil((result.reset - Date.now()) / 1000),
      };
    }

    return { ok: true };
  } catch (error) {
    console.warn(
      "Rate limit check failed:",
      error instanceof Error ? error.message : String(error),
    );
    return { ok: true };
  }
}

export function userKey(userId: string): string {
  return `user:${userId}`;
}

export function ipKey(ip: string): string {
  return `ip:${ip}`;
}

// For testing purposes only
export function resetState(): void {
  readLimitClient = null;
  writeLimitClient = null;
  failOpenWarned = false;
}
