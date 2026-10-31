# Ultracite tooling migration

Completed on 2026-10-31. This change replaces Phase 1B's Biome tooling with Ultracite's standalone Oxlint/Oxfmt provider. No business features, Phase 2 work, commits, pushes, deployments, or database operations were performed.

## Restored baseline

Inspected `git status`, every tracked source/config diff, the lockfile changes, and every untracked file before restoring. All tracked changes belonged to the uncommitted Vite+ migration. Restored tracked files to HEAD `2798a24`, `feat: add typed API, database, and authentication infrastructure`.

Removed only the verified migration additions: `.node-version`, `.vite-hooks/pre-commit`, generated `.vite-hooks/_` dispatchers, `AGENTS.md`, `apps/server/vite.config.ts`, `apps/web/src/vite-env.d.ts`, `docs/tooling-migration.md`, root `tsconfig.json`, and root `vite.config.ts`. Removed the migration's local `core.hooksPath` setting. No broad Git cleanup was used. At that point `git status --short` was empty and `git diff --exit-code HEAD` passed. A frozen install restored the committed dependency graph, and all six original tests passed before the new migration.

The actual committed integration suite uses `node:test` through `tsx`. There was no committed Vitest dependency or config. Preserved that runner and the entire test file exactly, rather than migrating its imports or adding an unused preset.

## Setup and versions

Checked the official [setup documentation](https://www.ultracite.ai/docs/setup), [monorepo documentation](https://www.ultracite.ai/docs/monorepos), npm engine metadata, and `init --help` before initialization. Node 24.13.0 did not satisfy Ultracite's engine requirement. Installed and used Node 24.15.0, pinned it in `.node-version`, and set the root engine range to `^22.22.2 || >=24.15.0`. pnpm remains 11.24.0.

Ran the documented installer with supported flags:

```sh
pnpm dlx ultracite@latest init --yes --pm pnpm --linter oxlint --type-aware \
  --workspace-framework apps/web=react apps/web=tanstack packages/db=drizzle \
  --agents codex --hooks codex --install-skill
```

There were no existing editor folders, Husky, Lefthook, lint-staged, or pre-commit integrations to preserve. No optional JS plugins were selected. Type-aware linting was explicitly requested and is enabled in the root Oxlint config.

| Tool            | Version            |
| --------------- | ------------------ |
| Ultracite       | 8.1.0              |
| Oxlint          | 1.90.0             |
| Oxfmt           | 0.74.0             |
| oxlint-tsgolint | 7.0.2005           |
| Turborepo       | 2.11.10, unchanged |
| Vite            | 8.3.5, unchanged   |
| TypeScript      | 7.0.2, unchanged   |
| Wrangler        | 4.156.0, unchanged |

The root extends `ultracite/oxlint/core` and `ultracite/oxfmt`. `apps/web/oxlint.config.ts` adds React and TanStack. `packages/db/oxlint.config.ts` selects Drizzle. Ultracite's Oxlint Drizzle preset currently contains no rules, as documented in its installed source. No Drizzle-specific enforcement is claimed. The TanStack preset provides its own framework adaptations for route filenames, mutually recursive route declarations, and inference-sensitive property order.

## Files changed

Following the requested setup, the installer created `.agents/` and `.codex/` locally. Both folders are now gitignored at the user's request and will not be included in commits. `AGENTS.md` and `skills-lock.json` remain available for version control.

Created, with `.agents/` and `.codex/` kept local as noted above:

- `.node-version`
- `oxlint.config.ts`, `oxfmt.config.ts`
- `apps/web/oxlint.config.ts`, `packages/db/oxlint.config.ts`
- `apps/web/src/vite-env.d.ts`
- `AGENTS.md`, `.codex/hooks.json`, `skills-lock.json`
- `.agents/skills/ultracite/SKILL.md`
- `.agents/skills/ultracite/references/code-standards.md`
- `.agents/skills/ultracite/references/upgrades/v5.md`, `v6.md`, `v7.md`, `v8.md`
- `docs/tooling.md`

Removed `biome.json` and the Biome dependency/catalog entry. Removed the prior Vite+ migration files during baseline restoration as listed above.

Modified:

- `.gitignore` to exclude local agent folders.

- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` for standalone quality tooling, supported Node engines, and root commands.
- `apps/server/package.json`, `apps/web/package.json`, `packages/db/package.json` for formatter-only key ordering. All workspace manifests remain semantically identical to HEAD.
- `apps/server/src/auth.ts`, `apps/server/src/env.ts` for function-expression style and property ordering; configuration values and validation stay the same.
- `apps/server/src/index.ts`, `apps/web/src/lib/api.ts` for explicit async returns, expression bodies, and property ordering. Endpoints, CORS values, credential handling, and response behavior stay the same.
- `apps/web/src/lib/env.ts` for explicit missing/empty-string checks equivalent to the original typed input guard.
- `apps/web/src/main.tsx` for a root selector and guard braces.
- `apps/web/src/routes/index.tsx` for an arrow component and equivalent status branches with unchanged UI strings and hook order.
- `apps/web/src/styles.css` for mechanical formatting.
- `packages/db/drizzle.config.ts` for property ordering, `packages/db/src/index.ts` for function-expression style and braces, and `packages/db/src/check.ts` for equivalent positive branches and explicit missing/empty-string handling.
- `README.md` for setup, commands, and tooling guidance.

Byte-for-byte preserved against HEAD: `turbo.json`, the six-test file, `packages/api`, server router, database schema, migrations, Wrangler config, shared TypeScript configs, and web Vite config. `.gitignore` additionally excludes the local `.agents/` and `.codex/` folders.

## Lint findings and resolutions

The initial check found declaration style, object key order, missing braces, a nested UI ternary, a negated DB check branch, Promise-returning callbacks without `async`, async returns without `await`, and `getElementById` style findings. Fixed these individually or with reviewed safe fixes. No dangerous fixes were used.

Type-aware linting also found `any` from Vite's open environment index signature and nullable-string truthiness checks. Added optional `VITE_API_URL` typing with `strictImportMetaEnv` and explicit empty/undefined guards. Runtime defaults and validation requirements are unchanged.

The generated workspace configs accessed `root.settings` even though the root had no settings property. Removed those unnecessary accesses to resolve their type-aware errors.

Narrow adaptations:

| Scope | Adaptation | Reason |
| --- | --- | --- |
| `apps/server/src/index.test.ts` only | Keep `no-await-in-loop`, `require-await`, and `sort-keys` off | Preserve the exact Node test fixture, its async adapter, sequential CORS requests, and object order |
| Same test file | `typescript/return-await` uses `in-try-catch` | Preserve the original Promise-returning test adapter |
| Same test file | `typescript/no-floating-promises` allows only `test` from package `node:test` | Node's runner owns and reports these test promises; other floating promises remain errors |
| `packages/db/src/schema.ts` only | `sort-keys` off | Preserve Drizzle column declaration order and committed migration representation |
| `apps/server/src/index.ts` only | `typescript/no-unsafe-argument` off | Hono's upstream CORS signature uses `Context<any>` |
| `**/*.jsonc` formatting only | No trailing commas | Preserve the existing Wrangler config style |

No global rule relaxations were added. Generated routes, Worker declarations, migrations, build outputs, dependencies, and environment files are ignored. Formatting retains two spaces, single quotes, no semicolons, trailing commas in TypeScript, import order, and Tailwind class order.

## Root commands

| Command | Behavior |
| --- | --- |
| `pnpm dev` | `turbo run dev`, starts Vite and Wrangler |
| `pnpm check` | `ultracite check`, read-only formatting and type-aware lint |
| `pnpm lint` | `oxlint --deny-warnings`, type-aware through root config |
| `pnpm format` | `oxfmt --write` |
| `pnpm format:check` | `oxfmt --check` |
| `pnpm fix` | `ultracite fix`, formatting and safe lint fixes |
| `pnpm typecheck` | `turbo run typecheck`, existing workspace TypeScript checks |
| `pnpm test` | Original server Node/tsx integration suite |
| `VITE_API_URL=http://localhost:8787 pnpm build` | `turbo run build`, SPA production build and Worker dry run |
| `pnpm build:worker` | `turbo run build --filter=@recurron/server` |
| `pnpm preview` | Existing web preview command |
| `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:check` | Existing uncached pnpm workspace commands, not run for this task |

`pnpm exec ultracite doctor` diagnoses the setup. No new git-hook manager or prepare script was introduced. The installer-generated Codex hook runs `pnpm exec ultracite fix --hook` after `apply_patch`.

## Verification

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed, including a fresh install after moving all five existing workspace/root `node_modules` directories outside the repository |
| `pnpm check` | Passed, no formatting or lint findings |
| `pnpm lint` | Passed, no errors or warnings |
| `pnpm format:check` | Passed |
| Explicit `oxlint --type-aware --deny-warnings --report-unused-disable-directives` | Passed |
| `ultracite doctor` | 8 passed, 0 warnings, 0 failures |
| `pnpm typecheck` | All four workspace tasks passed through Turbo |
| `pnpm test` | All six unchanged integration tests passed, no skips |
| Production web build with local API origin | Passed |
| Worker dry-run build | Passed without uploading |
| Repeat root build | Both builds hit Turbo's local cache |
| Missing web output restoration | Turbo restored every artifact with identical SHA-256 hashes |
| `VITE_API_URL` task input | Dry-run task hashes differed for two API origins |
| Root `pnpm dev` | Both apps ready on ports 3000 and 8787, both tasks bypass cache; stopped after smoke checks |
| Chromium UI and browser oRPC | `API status: pong`, RPC HTTP 200, no page errors |
| Credentialed browser `/health` | HTTP 200, `{"status":"ok"}` |
| Credentialed browser `/api/auth/ok` | HTTP 200, `{"ok":true}` |
| Protected-file comparison | Exact HEAD matches listed above |
| Workspace manifest comparison | All workspace manifests semantically identical to HEAD |
| Legacy-tool audit | No installed Biome, Vite+, or ESLint dependency; no legacy project configuration |
| `git diff --check` | Passed |

The browser check used synthetic process-environment secrets and a cached Playwright/Chromium install outside the project. No real database was contacted. Database-backed signup/login was outside this tooling verification. No browser-test dependency was added to Recurron.

Prettier remains an existing transitive dependency of TanStack Router's generator and an optional Ultracite peer. It is not a direct dependency, command, or project configuration. Upstream optional-peer metadata can still mention Biome or Vite+ in the lockfile; neither has an installed dependency snapshot. The only install warnings were two existing deprecated transitive `@esbuild-kit` packages inherited through Drizzle Kit.

The final worktree contains the uncommitted Ultracite migration. No verification failures remain.
