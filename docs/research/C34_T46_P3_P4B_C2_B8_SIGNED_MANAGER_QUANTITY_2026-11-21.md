# C34 T46-P3-P4B-C2-B8 — Signed Admin/GM/DM merchant quantity control (research-only acceptance)

> **2026-11-21 CST ACCEPTED ONLY AS DISPOSABLE SIGNED RESEARCH:** B8 exact executable **`8ca73b6a0ff5d940b1d1bdf75d1f026f4e2deb86`**, [GitHub Actions #44880608168](https://github.com/bob8675309/DNDNEXT/actions/runs/44880608168), job `136774860160` **SUCCESS**. Full 78,084-character decoded job log was reviewed and every B8 acceptance marker, B2 recipe/-1GP, B6 original stale quantity RED, B7 moving/camping signed receipts and local teardown was observed. Docs-only later branch heads do **not** change this executable result. Not a production release or installed hosted function.

## Intent and exact changes

Original unchanged `components/MerchantPanel.js` Git blob `22e4d0810603bc0322904573cb5fe0c14bad1f88` computes increment/decrement using React's cached `stock` row and then issues an unconditional absolute `.update({qty})`. Preserved B6 genuine signed DM fixture deliberately proves buyer qty 3→2 then stale +1 sets 4 instead of correct 3 (**EXPECTED ORIGINAL RED**, not suppressed). Browser fallback DELETE then INSERT via separate requests is also non-atomic, and historical reroll SQL source lacks explicit seller lock. They are NOT changed by B8.

- **Unapplied candidate:** `scripts/integration/c34/candidates/t46_p3_p4b_c2b8_manager_quantity_pg17.sql` creates local-only `public.c34_t46_manage_stock_qty_v1(uuid,text,integer,integer,timestamptz)` with strict prerequisite checks (local fixture, PG17, original B2 seller guard present); `EXECUTE` granted only to `authenticated`, with authorization checked inside the SECURITY DEFINER body using `auth.uid()` and `public.user_profiles.role IN ('admin','gm','dm')`, not client metadata. Seller `FOR SHARE` first, stock `FOR UPDATE` second; merchant stock identity and revalidation inside lock; no location/rest/camp restriction. `delta` is nonzero and computed from locked current qty, rejects negative or integer overflow; `set` requires a qty and `updated_at` CAS, signals SQLSTATE `40001` on stale snapshot. Manager reduction to zero retains row available for future restock; buyer original exhausted-stock delete still occurs, absent rows never recreated by this RPC.
- **Signed runner:** `scripts/integration/c34/run_t46_p3_p4b_c2b8_manager_qty_signed.mjs` invoked **after original B2–B7 signed suites** from `scripts/integration/c34/test_t46_p3_p4b_c2b_guarded_buy_signed.mjs`.
- **CI:** original workflow `.github/workflows/validate-c34-t46-p3-p4b-c2b-guarded-buy.yml` extended with path triggers and Node syntax check. Original buyer file, MerchantPanel and useWallet, map, town and game runtime code not edited.

## Exact signed test receipts at B8 executable

| Marker | Actual demonstrated fact |
| --- | --- |
| `PASS T46-C2B8-ACL` | Signed player RPC 42501, anonymous EXECUTE false, player's direct stock REST PATCH denied; stock unchanged |
| `PASS T46-C2B8-MANAGERS` | Genuine signed database `admin`, `gm`, `dm` roles each successfully performed atomic nonzero relative quantity changes on same merchant shelf |
| `PASS T46-C2B8-CAS` | Absolute set requires exact `qty`+timestamp, stale qty or revision returns `40001`, fresh set commits |
| `PASS T46-C2B8-BOUNDS` | Negative, zero-delta, overflow, invalid mode, missing CAS, deleted row, nonmerchant stock rejected atomically; quantity zero maintained for later restock |
| `PASS T46-C2B8-RACE` | Signed manager delta + genuinely signed original B2 guarded buyer both blocked by same stock row `FOR UPDATE` and serialized; starting qty2, one buyer consumes 1, manager adds 1 => final qty2, exact 5GP paid, exactly one inventory delivery |
| `PASS T46-C2B8-BUYER-CAS` | After actual original signed buy qty3→2, manager's stale absolute set rejected 40001, one 4GP charge/item preserved |
| `PASS T46-C2B8-SIGNED-RESEARCH` | Candidate is signed/isolated acceptance only; original buyer definition MD5 unchanged |

**Inherited proof re-passed:** B2 original signed hidden bypass RED then guarded denial, original ordinary purchase, recipe discovery and duplicate rejection, infinite −1 GP wallet; B3 original async failure/stale notice RED; B4/B5 role/flag/town/browser, B6 signed competing one-unit buyers and original stale manager overwrite RED, B7 signed moving/camping sales and hidden/disabled negatives plus synthetic reverse-order deadlock victim/rollback. GitHub Actions cleanup reports `Stopped supabase local development setup.` Temporary application overlays restored by the original harness.

## Important limits and pending engineering work

This does **not** establish safe deployed quantity management: current `MerchantPanel.js` still calls old absolute stock PATCH; role grants/RLS of hosted stock mutation and current hosted `reroll_merchant_inventory_v2` SQL body/locking have NOT been inspected by execution; historically found repository Oct16 source is admin-only, delete→insert in one function but has no explicit seller lock. Its browser HTTP fallback remains nontransactional. There is no separate signed browser test of the future B8 button cutover, no full primary reroll/buyer contention proof, and all unique original PR contributions plus Forge/Option A/security/restore gates remain held. Zero-stock retention is a candidate policy, not release-approved user experience.

**ONE NEXT C2-B9:** source-actual, read-only hosted metadata/definition verification of primary merchant reroll source/role/grants/lock ordering **without executing production SQL**, where permitted by available safe APIs; if definition cannot be retrieved non-executably, mark unverified rather than querying production. Then design isolated seller-first transaction-safe reroll integration plus explicit server-authoritative quantity UI cutover and signed manager browser tests for owner review; no production changes.

**Hard HOLD unchanged:** 22/34 original `players.sheet` writer paths, 29/31 nonmap Forge triggers and two separately protected world-map triggers, complete original PR source/ACL/browser/rollback disposition, independently restored encrypted PG17 database + 340 Supabase Storage object bytes, and explicit owner GO for SQL, main, deploy; no protected map edits, hosted SQL/Storage writes, PR retirement, or paid agents.
