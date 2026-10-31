# Recurron

A pnpm/Turborepo monorepo with a React + Vite frontend, a Hono API on Cloudflare Workers, and Neon PostgreSQL. The frontend uses TanStack Router and TanStack Query, with a shared oRPC contract and Better Auth for email/password authentication.

## Structure

```text
apps/
  web/                 React + Vite SPA
  server/              Hono Worker with health, oRPC, and Better Auth endpoints
packages/
  api/                 Shared API contract and validation schemas
  db/                  Neon/Drizzle client, auth schema, and migrations
  typescript-config/   Shared TypeScript settings
  tailwind-config/     Shared Tailwind theme
```

The web app consumes the client-safe contract from `packages/api`. `apps/server` implements the contract and mounts Better Auth directly at `/api/auth/*`.

## Setup

Use Node.js 24.15.0 from `.node-version` and pnpm 11.24.0. Ultracite supports Node.js `^22.22.2 || >=24.15.0`.

```sh
pnpm install
cp apps/server/.dev.vars.example apps/server/.dev.vars
cp packages/db/.env.example packages/db/.env
cp apps/web/.env.example apps/web/.env.local
openssl rand -base64 32
```

Set the generated value as `BETTER_AUTH_SECRET` in `apps/server/.dev.vars`. Replace `DATABASE_URL` in both database configuration files with the same Neon development database URL. Private environment files are gitignored.

| Variable | Configuration | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Server `.dev.vars` and DB `.env` | Neon PostgreSQL connection string with TLS |
| `BETTER_AUTH_SECRET` | Server `.dev.vars` | Random secret with at least 32 characters |
| `BETTER_AUTH_URL` | Wrangler vars or server `.dev.vars` | API origin; defaults to `http://localhost:8787` |
| `WEB_ORIGIN` | Wrangler vars or server `.dev.vars` | Allowed browser origin; defaults to `http://localhost:3000` |
| `VITE_API_URL` | Web `.env.local` or build environment | Public API origin; defaults to `http://localhost:8787` in development and is required in production |

Use origins without a trailing slash or path, and use `localhost` consistently for both local apps. Never put secrets in `VITE_*` variables.

```sh
pnpm db:migrate
pnpm db:check
pnpm dev
```

`db:migrate` applies the committed migrations. `db:check` verifies the Neon connection and auth tables without changing data. `pnpm dev` starts both apps.

## Local URLs

| URL                                     | Purpose                          |
| --------------------------------------- | -------------------------------- |
| `http://localhost:3000`                 | Login or role-specific workspace |
| `http://localhost:8787/health`          | API liveness check               |
| `http://localhost:8787/rpc/system/ping` | Typed `system.ping` procedure    |
| `http://localhost:8787/api/auth/ok`     | Auth handler check               |
| `http://localhost:8787/api/auth/*`      | Better Auth endpoints            |

Health and ping work without database credentials. Authentication requires valid server configuration and a migrated database. Both browser clients include credentials, and CORS allows only the configured `WEB_ORIGIN`.

## Current implementation

Phase 4A backend and Phase 4B authentication/management UI are complete. ADMIN uses `/admin`; STAFF uses `/app` with a read-only catalog and editable customer directory. CUSTOMER accounts enter the `/portal` placeholder. The UI reuses the existing Better Auth permissions and oRPC contracts.

See [Phase 4 UI routes and verification](docs/phase-4b-ui.md) and [Phase 4A API behavior](docs/phase-4a-api.md). Subscription and billing workflows are outside the current implementation.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the web app and local Worker |
| `pnpm typecheck` | Check workspace TypeScript types |
| `pnpm check` | Run Ultracite formatting and type-aware lint checks |
| `pnpm lint` | Run Oxlint, including type-aware rules |
| `pnpm format` | Apply Oxfmt formatting |
| `pnpm format:check` | Check formatting without changing files |
| `pnpm fix` | Apply Oxfmt formatting and safe Oxlint fixes |
| `pnpm test` | Run the six unchanged Node/tsx integration tests |
| `pnpm build` | Build the web app and package the Worker without deploying |
| `pnpm build:worker` | Package only the Worker without deploying |
| `pnpm preview` | Preview the web build locally |
| `pnpm db:generate` | Generate Drizzle migrations after schema changes |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm db:check` | Check database connectivity and auth tables |
| `pnpm --filter @recurron/server cf-typegen` | Regenerate Worker binding and runtime types |

## Code quality

Ultracite 8.1.0 supplies standalone Oxlint and Oxfmt presets. `oxlint.config.ts` enables type-aware linting with `oxlint-tsgolint`. The web workspace adds React and TanStack presets; the DB workspace selects Drizzle, whose Oxlint preset currently adds no rules. The committed integration suite uses Node's test runner through tsx, so no Vitest preset or runner is added.

`oxfmt.config.ts` preserves single quotes, no semicolons, import order, and Tailwind class order. Generated route trees, Worker types, migrations, build outputs, dependency folders, and environment files are excluded. Narrow lint adaptations preserve Node test-runner behavior, Drizzle column order, and Hono's upstream Context typing. All other preset rules remain active.

Turborepo still orchestrates development, builds, and workspace typechecks with the existing `turbo.json`. Development remains persistent and uncached; builds retain their output cache and `VITE_API_URL` input. Tests keep their original root command. Code-quality commands run once at the root. Database commands retain their existing uncached pnpm scripts.

Run `pnpm exec ultracite doctor` to diagnose tooling. Agent instructions are in `AGENTS.md`, the installed skill is in `.agents/skills/ultracite`, and `.codex/hooks.json` runs Ultracite's file-scoped fix hook after Codex edits. Review lint fixes for behavior changes before keeping them. The `.agents/` and `.codex/` folders are local, gitignored agent helpers; they are not required to run the app or the code-quality commands. `AGENTS.md` remains shared repository guidance.

## Deployment

Set the public API origin when building:

```sh
VITE_API_URL=https://api.example.com pnpm build
```

The web build is written to `apps/web/dist`. Configure the static host to serve `index.html` for SPA routes. The Worker bundle is written to `apps/server/dist` using Wrangler's dry-run build.

Configure production `WEB_ORIGIN` and `BETTER_AUTH_URL` in Wrangler and provide `DATABASE_URL` and `BETTER_AUTH_SECRET` through Cloudflare Worker secrets. Local `.dev.vars` files are not uploaded as secrets. Run database migrations separately from builds.

Keep the web and API on the same site for cookie support. The Neon HTTP adapter does not support interactive transactions, so multi-step auth writes are not atomic. Password reset and verification email delivery require a mail provider.
