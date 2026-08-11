import { auth } from "@clerk/nextjs/server";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

// Fixed user id the visual harness (scripts/visual-check.mjs) drives its fixtures as.
// Guarded so the bypass is dead outside a local harness run against a local build.
const E2E_BYPASS_USER_ID = "e2e-user";

function isE2EBypassAuth(): boolean {
  return process.env.E2E_BYPASS_AUTH === "1" && !process.env.VERCEL;
}

export async function getUserId(): Promise<string> {
  if (isE2EBypassAuth()) return E2E_BYPASS_USER_ID;
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();
  return userId;
}
