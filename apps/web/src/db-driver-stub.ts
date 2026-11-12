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
export const createPool = anyStub;
export const createConnection = anyStub;
export const createClient = anyStub;
export const drizzle = anyStub;
