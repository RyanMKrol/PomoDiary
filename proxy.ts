import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

// Lets the visual harness (scripts/visual-check.mjs) drive the real composed UI without
// Clerk credentials. Guarded so the bypass is dead in any real deployment.
function isE2EBypassAuth(): boolean {
  return process.env.E2E_BYPASS_AUTH === "1" && !process.env.VERCEL;
}

export default clerkMiddleware(async (auth, req) => {
  if (isE2EBypassAuth()) return;
  if (!isPublicRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
