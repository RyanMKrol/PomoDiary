import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";
import { getUserId, UnauthorizedError } from "./auth";

const mockAuth = auth as unknown as {
  mockResolvedValue: (v: { userId: string | null }) => void;
};

describe("getUserId", () => {
  const originalBypass = process.env.E2E_BYPASS_AUTH;
  const originalVercel = process.env.VERCEL;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.E2E_BYPASS_AUTH;
    delete process.env.VERCEL;
  });

  afterEach(() => {
    if (originalBypass === undefined) delete process.env.E2E_BYPASS_AUTH;
    else process.env.E2E_BYPASS_AUTH = originalBypass;
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  });

  it("returns the real Clerk user id when the bypass flag is unset", async () => {
    mockAuth.mockResolvedValue({ userId: "user_real" });
    await expect(getUserId()).resolves.toBe("user_real");
  });

  it("throws UnauthorizedError when unauthenticated and the bypass flag is unset", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    await expect(getUserId()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("returns the fixed e2e-user id when E2E_BYPASS_AUTH=1", async () => {
    process.env.E2E_BYPASS_AUTH = "1";
    mockAuth.mockResolvedValue({ userId: null });
    await expect(getUserId()).resolves.toBe("e2e-user");
  });

  it("ignores the bypass flag on Vercel even when set", async () => {
    process.env.E2E_BYPASS_AUTH = "1";
    process.env.VERCEL = "1";
    mockAuth.mockResolvedValue({ userId: null });
    await expect(getUserId()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
