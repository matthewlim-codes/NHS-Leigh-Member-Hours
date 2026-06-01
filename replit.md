# NHS (Leigh) Member Hour Tracker

A private member portal for an NHS-style community club. Members log in to see their volunteer hours pulled live from a Google Sheet.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/member-portal run dev` — run the frontend (port 25958)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `SESSION_SECRET` — secret for express-session

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (Tailwind, shadcn/ui, wouter, TanStack Query)
- API: Express 5 + express-session + connect-pg-simple
- DB: PostgreSQL + Drizzle ORM
- Auth: bcryptjs password hashing, server-side sessions in PostgreSQL
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Google Sheets: @replit/connectors-sdk (Replit-managed OAuth)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/members.ts` — members table schema
- `artifacts/api-server/src/routes/auth.ts` — login, logout, me, change-password
- `artifacts/api-server/src/routes/dashboard.ts` — member dashboard data
- `artifacts/api-server/src/lib/sheets.ts` — Google Sheets helper + username/password generation
- `artifacts/member-portal/src/pages/` — login, change-password, dashboard pages

## Architecture decisions

- **Auto-provisioning accounts**: Members are not pre-seeded. On first login, the app verifies the temp password against the member's `STUDENT ID` from Google Sheets, then creates the account in the DB with `mustChangePassword=true`.
- **Google Sheets as source of truth**: Hours and display names are always fetched fresh from the sheet, never cached in the DB.
- **Session storage in PostgreSQL**: Uses connect-pg-simple so sessions survive server restarts.
- **Username format**: `First-Last` (for sheet names stored as `Last, First`, e.g. `Lim, Matthew` → `Matthew-Lim`).
- **Temp password format**: the member's `STUDENT ID` value from the sheet.

## Product

Members visit the portal, enter their username (e.g. `Matthew-Lim`) and their Student ID as their temporary password. On first login they must set a new password. They then see their name and total volunteer hours from the Google Sheet. The sheet owner updates hours in Google Sheets and members see the latest data on their next visit.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm run typecheck:libs` before `pnpm --filter @workspace/api-server run typecheck` after changing `lib/db` schema — the composite lib must be rebuilt first.
- The Google Sheets integration uses Replit's connector proxy (`@replit/connectors-sdk`). If it returns errors, the connection may need to be re-authorized via the integrations panel.
- The spreadsheet ID and member data tabs are configured in `artifacts/api-server/src/lib/sheets.ts`. The current sheet reads the `11/12` and `10` tabs, finds columns by header across the first few header rows, and expects `STUDENT ID`, `NAME`, and `TOTAL HOURS` columns.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
