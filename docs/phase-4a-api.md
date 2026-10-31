# Phase 4A backend

The client-safe catalog contract is part of `apiContract`. All catalog operations use the existing session context and Better Auth `requirePermission` middleware before calling a feature service.

| Resource | Operations                         | ADMIN | STAFF     | CUSTOMER |
| -------- | ---------------------------------- | ----- | --------- | -------- |
| Product  | list, get, create, update, archive | All   | list, get | None     |
| Plan     | list, get, create, update, archive | All   | list, get | None     |
| Customer | list, get, create, update          | All   | All       | None     |

Lists accept `page` starting at 1, `pageSize` from 1 to 100, and `search`. Defaults are page 1 and 20 records. Results contain `items` and the total matching record count, including when the requested page is empty. Queries use SQL `ILIKE`, `LIMIT`, `OFFSET`, and `count`, ordered by creation time descending and ID. Search matches literal substrings without treating user-entered `%` or `_` as wildcards. Customer search covers name, email, and company; catalog search covers name. Lists include active and inactive records.

Product money fields and variant `price_delta_minor` use safe integer minor units. Clients can use the shared `parseMinor` and `formatMinor` helpers at display boundaries. Negative variant adjustments are supported. Product create/update accepts nested variants identified by attribute name and value name. Updates replace the supplied variant configuration: omitted variants become inactive, matching variants retain their database IDs, and new combinations receive new IDs. Renaming a combination creates a new variant and retains the old one as inactive. `get` returns retained inactive variants too. Archives set `isActive` to false without deleting records.

Product and variant writes use Neon HTTP atomic batches. The parent update acquires the row lock before variant changes, so concurrent replacements are serialized. Single-record customer/plan writes are single atomic SQL statements. Customers are created with no portal user association; updates leave any existing `user_id` untouched.

The API declares `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`, `CONFLICT`, and `INTERNAL_SERVER_ERROR`. Expected database conflicts and constraint violations are mapped to these errors without returning SQL or driver details.

## Verification

Use Node 24.15.0 and pnpm 11.24.0. No migrations are needed for Phase 4A.

- `pnpm check`, `pnpm lint`, `pnpm typecheck`
- `pnpm test` preserves the six original server tests.
- `pnpm --filter @recurron/server test:catalog:unit` checks validation, sanitized errors, and anonymous access without a database.
- `pnpm --filter @recurron/server test:catalog` runs authenticated HTTP/oRPC workflows against Neon, including transaction rollback and signed variant persistence. It reads `DATABASE_URL` from the process or private local database/server environment files.
- `pnpm --filter @recurron/server test:auth` runs the preserved Phase 3 integration suite with `DATABASE_URL` in the process environment.
- `pnpm --filter @recurron/db test:money` and `pnpm --filter @recurron/db test:integrity` run the preserved Phase 2 checks.
- `VITE_API_URL=http://localhost:8787 pnpm build` builds the production SPA and dry-runs the Worker. Use the intended API origin for production artifacts.
- `pnpm build:worker` separately dry-runs the Worker.

The catalog integration suite creates temporary ADMIN, STAFF, and CUSTOMER accounts with random credentials through Better Auth's trusted server API. It signs in and calls the application fetch handler through the contract client. Fixtures have a unique random prefix and are removed in a `finally` block using an atomic cleanup batch. The test requires a configured Neon URL and fails explicitly if it is absent.

Phase 4B now consumes these operations for login, role-specific shells, and shared forms. See [UI status and verification](phase-4b-ui.md). Subscription workflows remain outside this phase.
