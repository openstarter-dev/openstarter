# Customizing this template

Work through these steps after cloning. Most branding lives in **three files** —
once you've renamed the project, customizing is mostly editing those.

> macOS uses BSD `sed` (`sed -i ''`); Linux uses GNU `sed` (`sed -i`). Commands
> below show the macOS form. On Linux, drop the empty `''` after `-i`.

## 1. Rename your project

Pick a project name and an npm scope (e.g. project `acme`, scope `@acme`).

**Preview** what would change first:

```bash
grep -rl "openstarter" --include="*.json" --include="*.ts" --include="*.tsx" --include="*.yaml" --include="*.md" .
```

Replace the package scope `@openstarter/` everywhere:

```bash
grep -rl "@openstarter/" --include="*.json" --include="*.ts" --include="*.tsx" . \
  | xargs sed -i '' 's/@openstarter\//@acme\//g'
```

Then set the root project name (root `package.json` "name" field) and any
remaining references:

```bash
sed -i '' 's/"name": "openstarter"/"name": "acme"/' package.json
```

Files that reference the scope or name: root `package.json`,
`pnpm-workspace.yaml`, `tsconfig.base.json` paths, every `packages/*/package.json`,
`apps/web/package.json`, `apps/web/tsconfig.json`, and all `@openstarter/*`
imports under `apps/web/src` and `packages/*`.

Reinstall and verify:

```bash
pnpm install
pnpm check-types
```

## 2. Set your display name

Edit `apps/web/src/lib/branding.ts`:

- `BRAND_NAME` — shown in the header, sidebar, footer, page `<title>`, and auth pages
- `BRAND_TAGLINE` — the hero headline and footer tagline
- `BRAND_DESCRIPTION` — the `<meta name="description">`
- `SOCIAL_LINKS` — your GitHub / X / Discord URLs
- `COPYRIGHT_YEAR_START` — the footer copyright start year

## 3. Replace the marketing copy

Find every placeholder:

```bash
grep -rn "TODO: replace" apps/web/src
```

Edit these files:

- `apps/web/src/components/marketing/hero.tsx` — headline, subtitle, CTAs
- `apps/web/src/components/marketing/features.tsx` — the three feature cards
- `apps/web/src/components/marketing/pricing-section.tsx` — layout (data lives below)
- `apps/web/src/components/marketing/faq.tsx` — layout (data lives below)

## 4. Configure pricing

Edit `PRICING_TIERS` in `apps/web/src/lib/marketing/pricing.ts`. Add/remove
tiers, change names, prices, and feature lists. Both the landing page and
`/pricing` read from this one array.

> Phase 3 will swap this static array for tiers synced from Stripe Products.
> CTAs currently link to `/login`.

## 5. Replace the FAQ

Edit `FAQ_ENTRIES` in `apps/web/src/lib/marketing/faq.ts`.

## 6. Regenerate secrets

```bash
openssl rand -hex 32
```

Put the result in `apps/web/.env` as `BETTER_AUTH_SECRET`.

## 7. Reset git history (optional)

```bash
rm -rf .git && git init && git add -A && git commit -m "initial commit"
```

## 8. Fill or remove legal pages

Edit `apps/web/src/routes/_marketing/privacy.tsx` and `terms.tsx` with your
real policy, or remove the routes and their footer links if you don't need them.

## 9. What's next

| You want users to...            | Wait for...                        |
| ------------------------------- | ---------------------------------- |
| Reset passwords / verify email  | Phase 1 (auth experience)          |
| Sign in with Google/GitHub      | Phase 1 (OAuth)                    |
| Edit profile / manage sessions  | Phase 1 (account settings)         |
| Receive transactional emails    | Phase 2 (email)                    |
| Pay for a subscription          | Phase 3 (Stripe billing)           |

See `docs/superpowers/specs/` for the design of each phase.
