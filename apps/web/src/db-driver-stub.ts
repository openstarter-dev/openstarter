function unavailable(): never {
  throw new Error(
    "This DB driver was stubbed out of the Cloudflare Workers build because it is not " +
      "used by the D1 runtime. If you see this error, a dependency is importing a " +
      "database driver that the openstarter Workers build does not ship.",
  );
}

const stub = new Proxy(unavailable, {
  get: (): any => stub,
  apply: unavailable,
  construct: unavailable,
});

const anyStub = stub as any;

export default anyStub;
export const createPool = anyStub;
export const createConnection = anyStub;
export const createClient = anyStub;
export const drizzle = anyStub;
