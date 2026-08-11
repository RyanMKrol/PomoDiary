import type { ZodType } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, userKey } from "../ratelimit";
import { CapError } from "../db/entries.store";
import { getUserId, UnauthorizedError } from "./auth";

export type RouteHandlerFn = (userId: string) => Promise<NextResponse>;

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

export async function parseJsonBody<T>(
  req: NextRequest,
  schema: ZodType<T>,
): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new BadRequestError("Invalid JSON body");
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    throw new BadRequestError(result.error.message);
  }
  return result.data;
}

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

    if (error instanceof BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof CapError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    console.error("Route handler error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
