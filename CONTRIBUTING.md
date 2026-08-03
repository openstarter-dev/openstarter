# Contributing to OpenStarter

## Development Setup

1. Clone the repo
2. `pnpm install`
3. `cp .env.example .env`
4. `cp apps/web/.env.example apps/web/.env`
5. `pnpm db:push`
6. `pnpm dev`

## Project Structure

See [README.md](./README.md#project-structure) for the monorepo layout.

## Coding Standards

- TypeScript strict mode
- Immutable data patterns (no mutation)
- Small focused files (200-400 lines, max 800)
- Chinese documentation comments for business logic
- `as const` + union types instead of `enum`
- Proper error handling at every level

## Testing

- `pnpm test` — run all tests
- `pnpm test:coverage` — with coverage report
- Property-based testing with fast-check is encouraged
- Minimum 80% coverage for new code

## Pull Request Process

1. Create a feature branch from `main`
2. Write tests first (TDD)
3. Implement the feature
4. Ensure all tests pass
5. Run `pnpm check-types` for type checking
6. Run `pnpm lint` for code quality
7. Submit a PR with a clear description

## Commit Convention

Follow conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `ci:`