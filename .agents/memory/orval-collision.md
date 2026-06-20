---
name: Orval path+query param TS2308 collision
description: Having both path param AND query param on the same route causes GetXxxParams name collision.
---

## Rule
When an OpenAPI operation has BOTH a path parameter AND a query parameter, Orval generates `GetXxxParams` in both `api.ts` (Zod schema) and `types/getXxxParams.ts` (TypeScript interface). The `lib/api-zod/src/index.ts` re-exports both with `export *`, causing TS2308 collision.

**Why:** Operations with only path params don't create a types/ file. Operations with path+query params create both, causing the double-export.

**How to apply:**
- If an operation needs query params, consider removing them from the spec and handling them server-side with defaults.
- Or separate the path param into a different operationId from the query param route.
- The error appears as: `Module "./generated/api" has already exported a member named 'GetXxxParams'` during `pnpm run typecheck:libs` after codegen.
- Orval itself succeeds — only the chained typecheck fails, so it looks like a codegen error but is actually a downstream typecheck collision.
