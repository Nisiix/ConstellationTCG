// Deployed entrypoint of the `catalog-import` Edge Function.
//
// The program is `bundle.js` next to this file, built from `src/main.ts` by `pnpm functions:build`
// and committed; it is imported from the repository on GitHub so that a deploy uploads this file
// only. Push the bundle before deploying: the platform snapshots the import at deploy time.
import 'https://raw.githubusercontent.com/Nisiix/ConstellationTCG/main/supabase/functions/catalog-import/bundle.js'
