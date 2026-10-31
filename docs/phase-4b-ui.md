# Phase 4 implementation status

Phase 4A backend is complete and verified. Phase 4B UI is complete, with authentication and management pages in the existing React app. The backend contracts, services, permissions, schema, migrations, and tests are preserved.

## Routes

| Route | Experience |
| --- | --- |
| `/` | Routes an authenticated account to its workspace, otherwise to login |
| `/login` | Email/password sign-in through the existing Better Auth client |
| `/admin` | Administrative overview and navigation |
| `/admin/products` | Product search, pagination, creation, editing, variants, and archiving |
| `/admin/plans` | Plan search, pagination, creation, policy editing, and archiving |
| `/admin/customers` | Customer search, pagination, creation, and editing |
| `/app` | Staff operational overview |
| `/app/products` | Read-only product catalog and variant details |
| `/app/plans` | Read-only plan availability and policies |
| `/app/customers` | Customer directory with creation and editing |
| `/portal` | Authenticated placeholder only; no customer features |

Login routes ADMIN to `/admin`, STAFF to `/app`, and CUSTOMER to `/portal`. TanStack Router `beforeLoad` checks sessions and the existing Better Auth permission definitions. The layouts also handle session loading, failures, and session loss. Staff cannot enter Admin routes, and Customer accounts cannot enter either management workspace. Logout clears the query cache before returning to login.

The frontend uses Better Auth's existing permission checker and role definitions for navigation and action visibility. Each oRPC procedure remains responsible for enforcing permissions on the server. No public signup, role selection, or password-reset UI has been added. Sign-in requires an account provisioned through the existing trusted Better Auth administration mechanism.

## Shared UI and data access

Both layouts use one configurable shell and the same feature components. Shared pieces cover labeled fields and accessible validation messages, checkboxes, feedback, status badges, search, pagination, archive confirmation, and editor titles. Tables scroll within their container on narrow screens; navigation moves above the content. There are no dashboard metrics or decorative animations.

Feature pages use the existing oRPC client with TanStack Query. Successful writes invalidate only that resource's query family. Search and pagination are sent to the backend. Forms use the shared contract schemas for validation, disable submission while saving, and display sanitized API errors. Product prices use the shared minor-unit helpers and display ordinary money values. Positive and negative variant adjustments are supported. Edits show active variants; omitted variants are retained as inactive by the backend. Plans expose only existing fields and do not invent a plan price. Customer creation does not create a portal user.

No automated test cases were added in Phase 4B. All previous tests are preserved.

## Verification performed

Verified in a Chromium browser against the local Vite app and Hono Worker backed by the supplied production Neon database, using temporary role accounts and uniquely prefixed fixtures.

- Login, invalid credentials, logout, and anonymous protected-route redirects.
- ADMIN landing at `/admin`; product search and two-page pagination; product creation with an Odoo `+₹560` adjustment; product editing with a negative adjustment; removal of a variant and persistence as inactive; product archiving.
- ADMIN monthly plan creation, field-level rejection of an invalid availability range, policy/minimum-quantity editing, and archiving.
- ADMIN customer creation/editing, search, and two-page pagination.
- STAFF landing at `/app`; direct Admin navigation redirected to the Staff overview; product and plan details with disabled fields and no save actions; customer creation/editing; direct oRPC product/plan mutations rejected with `FORBIDDEN`.
- CUSTOMER landing at `/portal`; Admin and Staff routes redirected to the placeholder; direct customer-directory API access rejected with `FORBIDDEN`.
- Search empty states and desktop/mobile layouts, including a 390px viewport without document overflow.

`pnpm check`, `pnpm lint`, `pnpm typecheck`, the unchanged `pnpm test` suite, the production web build, and the Worker dry-run build pass on Node 24.15.0. No new automated tests were added. No backend rewrite, migration, commit, push, or deployment was performed.

Temporary verification accounts, records, and credential files are removed after verification. There are no remaining Phase 4B implementation blockers. Sign-in uses provisioned accounts; the temporary verification credentials are not permanent demo access.
