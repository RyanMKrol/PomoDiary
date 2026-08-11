import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, userKey } from "../ratelimit";
import { getUserId, UnauthorizedError } from "./auth";

export type RouteHandlerFn = (userId: string) => Promise<NextResponse>;

export async function handleRoute(
  req: NextRequest,
  handler: RouteHandlerFn,
  rateLimitKind: "read" | "write" = "write",
): Promise<NextResponse> {
  try {
    const userId = await getUserId();

    const rateLimitResult = await checkRateLimit(
      userKey(userId),
      rateLimitKind,
    );

    if (!rateLimitResult.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimitResult.retryAfterSeconds || 60),
          },
        },
      );
    }

    return await handler(userId);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("Route handler error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
