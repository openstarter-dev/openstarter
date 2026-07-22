// Build-time stub for DB drivers that aren't loaded at Cloudflare Workers
// runtime. apps/web/vite.config.ts aliases the drivers NOT matching
// wrangler.jsonc's `vars.DATABASE_PROVIDER` here when building with the
// Cloudflare nitro preset:
//   - d1         → stub mysql2 + postgres (mysql2 crashes workerd at module
//                  eval because of node:net/node:process requires; postgres.js
//                  is dead weight when the backend is D1 — built via bindings).
//   - postgresql → stub mysql2, keep postgres.js for the Hyperdrive binding.
//
// The stubbed `createXxxDb` code paths are never reached at runtime, so the
// throw below should never fire in production. Importing the stub is
// harmless; calling it throws a clear error.
//
// Mirrors ShipAny's src/core/db/driver-stub.ts.

function unavailable(): never {
  throw new Error(
    "This DB driver was stubbed out of the Cloudflare Workers build because it " +
      "does not match vars.DATABASE_PROVIDER in wrangler.jsonc. Make sure " +
      "DATABASE_PROVIDER there matches the database you intend to use (d1, or " +
      "postgresql with a Hyperdrive binding), then rebuild.",
  );
}

const stub = new Proxy(unavailable, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get: (): any => stub,
  apply: unavailable,
  construct: unavailable,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyStub = stub as any;

export default anyStub;
// Named exports the real drivers expose (mysql2's createPool/createConnection
// are referenced by drizzle-orm at import). Delegating to the proxy keeps
// imports cheap while any actual call surfaces the clear error above.
export const createPool = anyStub;
export const createConnection = anyStub;
