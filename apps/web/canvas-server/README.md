# GreenPlan infinite canvas

The `/design` route now mounts tldraw in the browser only. The default board is
persisted in IndexedDB. Upload PNG/JPG/WebP images, pan with Space or the hand
tool, zoom with wheel/pinch, and add text, arrows, frames, drawings and sticky
notes. Comments in this version are collaborative sticky notes, not threaded
conversations with notifications or resolved state.

## Local development

Install from the repository root:

```sh
pnpm install
```

Start the sync server in one terminal:

```sh
pnpm --filter web dev:canvas
```

Start the application in another:

```sh
pnpm dev:web
```

Vite proxies `/canvas-sync` WebSockets to loopback port 3102. Restart Vite after
changing this proxy configuration. Share creates a new empty room; it never
silently publishes the local board. Copy the room link into two browsers to
verify live shapes, cursors and sticky notes. Room snapshots are saved under
`apps/web/.canvas-data`. Uploaded images are embedded in the room snapshot;
this is appropriate for small local prototypes, not large production boards.

## Deployment boundaries

This sync service binds to loopback and is a development implementation.
Production requires an authenticated room membership check, an HTTPS/WSS
reverse proxy for `/canvas-sync`, durable room storage with single ownership,
asset object storage, quotas and backup retention. Capability links alone are
not an organization access-control model. The production web build does not
start this process automatically.

Configure `VITE_TLDRAW_LICENSE_KEY` with your tldraw license for production.
Retain the SDK watermark and license checks. Review the SDK license and
https://tldraw.dev/docs/sync before production deployment.

## Verification pending installation

Dependency installation was blocked by the execution approval service. Full
TypeScript, browser interaction, multi-client synchronization and restart
persistence checks must run once dependencies are installed. HTTP 200 for the
SSR loading shell alone does not verify that the client canvas has mounted.
