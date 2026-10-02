// Backward-compatible entry point: all trade regression checks now use the
// isolated dedicated test database and their own local API process.
if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) {
  throw new Error("Member trade tests are development-only.");
}

console.log("Redirecting to the isolated orderless settlement regression suite.");
await import("./test-orderless-settlement.mjs");