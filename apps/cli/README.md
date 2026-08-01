# @openstarter/cli

`openstarter` — Command-line interface for openstarter, authenticating via Better
Auth's Device Authorization Grant (RFC 8628) and talking to the backend's HTTP API.

## Installation

**Global install:**

```bash
npm install -g @openstarter/cli
```

**Or run without installing:**

```bash
npx @openstarter/cli <command>
```

**Local development linking:**

```bash
pnpm --filter @openstarter/cli build
pnpm --filter @openstarter/cli link --global
```

## Quick Start

```bash
# Log in (device authorization: open the printed URL in a browser, click 授权)
openstarter login

# Confirm who you are
openstarter whoami

# Work with notes
openstarter list
openstarter create --name "My First Note" --description "hello"
openstarter get note_1

# Profile + diagnostics
openstarter profile
openstarter profile:update --name "Ada Lovelace"
openstarter status
openstarter info

# Log out
openstarter logout
```

Point the CLI at a non-default backend (e.g. local dev) with the global
`--api-url` flag, set before the subcommand:

```bash
openstarter --api-url http://localhost:3000 login
openstarter --api-url http://localhost:3000 status
```

## Commands

### Authentication

| Command | Description |
| --- | --- |
| `openstarter login` | Authenticate via device authorization; saves the session token. |
| `openstarter logout` | Clear local credentials. |
| `openstarter whoami` | Show the currently logged-in user's profile. |

### Profile

| Command | Description |
| --- | --- |
| `openstarter profile` | Show your profile (id / email / name / createdAt). |
| `openstarter profile:update --name <name>` | Update your display name. |

### Data (notes)

| Command | Description |
| --- | --- |
| `openstarter list [--limit <n>]` | List your notes (newest first, `--limit` 1–100, default 10). |
| `openstarter get <id>` | Show a single note by id. |
| `openstarter create --name <name> [--description <desc>]` | Create a note; prints its id. |

### System

| Command | Description |
| --- | --- |
| `openstarter status` | Probe the API and report connection state, latency, server version, and auth state. |
| `openstarter info` | Print local CLI version, configured API URL, config path, and login state. |

## Global Options

| Option | Description |
| --- | --- |
| `--api-url <url>` | Override the API URL for this invocation (persists to config). |
| `--verbose` | Print the error stack on failure. |
| `--json` (per command) | Emit JSON-friendly output for scripting. |
| `-h, --help` | Show help. |
| `-V, --version` | Show CLI version. |

## Authentication Flow (RFC 8628 Device Authorization Grant)

```
CLI                                    Browser + Backend
 │  POST /api/auth/device/code            │
 │ ───────────────────────────────────▶   │  issues device_code + user_code
 │ ◀── device_code, user_code, verifier  │
 │  prints verification_uri_complete       │
 │                                         │  user opens link, already signed in
 │                                         │  GET /api/auth/device?user_code=…  (claims)
 │                                         │  POST /api/auth/device/approve     (authorizes)
 │  poll POST /api/auth/device/token       │
 │ ───────────────────────────────────▶   │
 │ ◀── access_token (= signed session token)│
 │  stores it as Bearer credential         │
```

The CLI's `access_token` is the user's signed Better Auth **session token**; it is
sent as `Authorization: Bearer <token>` and accepted by the server's bearer plugin
(`requireSignature: true`, since session tokens carry a HMAC signature).

## Configuration

Stored in `~/.openstarter/config.json` (managed by [`conf`](https://www.npmjs.com/package/conf)):

```json
{
  "apiUrl": "https://app.openstarter.dev",
  "auth": { "accessToken": "<session-token>", "expiresAt": 1799000000000, "refreshToken": "" }
}
```

Default API URL: `https://app.openstarter.dev`.

## Response Envelope

The API returns a uniform `{ code, message, data? }` envelope; the CLI unwraps
`data` for display and maps errors to exit codes.

## Exit Codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | General / API error |
| `2` | Authentication error (run `openstarter login`) |
| `3` | Network error |
| `4` | Configuration error |

## Development

```bash
pnpm install
pnpm --filter @openstarter/cli dev        # tsx watch
pnpm --filter @openstarter/cli build      # tsup -> dist/index.js
pnpm --filter @openstarter/cli check-types
node apps/cli/dist/index.js --help
```

Notes: `tsup` injects the `#!/usr/bin/env node` shebang via its banner, so the
source file omits it. The config singleton is lazy (`Proxy`) so unauthenticated
commands don't pay for a disk read on startup.

## Performance Targets

| Metric | Target | Measured |
| --- | --- | --- |
| Bundle size | < 5 MB | ~9.6 KB ✅ |
| Cold startup | < 100 ms | median ~150 ms warm ❌ (Node runtime baseline ~80 ms; see e2e log) |

## License

MIT
