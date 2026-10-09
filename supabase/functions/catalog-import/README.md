# catalog-import (Supabase Edge Function)

Runs the catalog import one job per call: `plan` → one `set` job per set → `graph` steps (see
`packages/catalog-import`). pg_cron calls it every few seconds through pg_net while there is work.

- **Source**: `src/main.ts` (Deno). Workspace packages are inlined by `pnpm functions:build`
  (esbuild) into **`bundle.js`**, which is committed; npm packages stay external as
  `npm:<name>@<version>` specifiers resolved by the Deno runtime. The deployed entrypoint
  `index.ts` imports the bundle from the repository on GitHub (branch `main`), so a deploy uploads
  one short file: push first, then deploy. CI fails when the committed bundle is stale.
- **Database**: the platform's own `SUPABASE_DB_URL` (no password configured by hand).
- **Auth**: every call carries `x-catalog-import-token`, a secret generated inside the database
  (`catalog_import_schedule(...)` stores it in Vault); the function reads it back and compares.
  Deploy with JWT verification off (the token replaces it).
- **Limits**: 150 s wall clock, 2 s CPU per request. Each job fits; a worker older than 90 s
  answers "not accepting work" so no job dies with its worker.
- **Optional secrets** (Edge Functions → Secrets): `TCGDEX_BASE_URL`, `TCGDEX_LANGUAGE` (`en`),
  `TCGDEX_CONCURRENCY` (6), `CATALOG_IMPORT_MAX_WORKER_AGE_MS` (90000). Nothing is required.

Deploy (Supabase MCP `deploy_edge_function`, or the CLI):

```bash
pnpm functions:build
supabase functions deploy catalog-import --no-verify-jwt --project-ref xtebcuuipklenukpsoyp
```

Then, once, in the SQL editor (pg_net and pg_cron enabled in Database → Extensions):

```sql
select catalog_import_schedule('https://<project-ref>.supabase.co/functions/v1/catalog-import');
select catalog_import_request('pokemon', true);   -- full import; later runs: catalog_import_request('pokemon')
select catalog_import_status('pokemon');          -- progress
```

`catalog_import_unschedule()` stops the tick; `catalog_import_retry_failed('pokemon')` re-queues
failed jobs. The CLI drives the same queue locally: `pnpm catalog:import` (with `DATABASE_URL`).
