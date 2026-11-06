# J133–J141 — Original portrait-library source-link trigger

**Status: staged for exact-head CI, not yet authenticated accepted.** This work belongs only to draft PR #324 stacked on held #321; no live Supabase migrations/grants or browser deployment.

## Previous proven checkpoint (do not repeat)
Run [42164951469](https://github.com/bob8675309/DNDNEXT/actions/runs/42164951469) at commit `8b247ebe9df2d77410b087cb9370d3dea3f938e9` passed both disposable PG17 and local genuine GoTrue/PostgREST jobs, including source-original player tag guard **J125–J132**. The disposable fixture held **13/31** original creation-adjacent trigger DDL, with 18 absent at that checkpoint. J29 prior editor revocation was confirmed and restored solely for later source-authenticated tests.

## Second original characters trigger (pending)
- Production `sync_character_portrait_library_id_v1`: BEFORE INSERT OR UPDATE OF `portrait_storage_path, portrait_url, portrait_source` on `public.characters`.
- Original function: `private.sync_character_portrait_library_id_v1()`; live `md5(pg_get_functiondef)` = `74cb0bf9d7a614a860344f12cf787e05`. Source body is copied unchanged and hashes at runtime.
- Reduced local `npc_portrait_library` has the missing production-shaped `name text` and `sort_order integer` fields added only for source compilation; full storage/catalog policies are NOT reproduced. Character UPDATE uses J125's explicitly reduced editor-only RLS and grants for the original portrait columns.
- J133: source and trigger fidelity on disposable PG17.
- J134: three declared local catalog specimens, including an inactive record.
- J135: real signed-in Player links active library portrait by storage path.
- J136: exact original storage-path match takes precedence over conflicting URL.
- J137: correct URL-only fallback.
- J138: inactive portrait has no library match.
- J139: switching away from library source clears stale library ID.
- J140: Admin-with-grant allowed; outsider and anonymous editor denied under reduced local ACL.
- J141: G/GI/I/C/CP/CS, nonce, stock and sheet states unchanged.

If all source checks and signed-in tests pass, the **static installed original-table trigger count** becomes **14/31**, not proof that 14 handlers have full branch parity; 17 original table triggers remain unstaged. Original runtime semantics and full browser/permission catalog remain further release gates.

**One next step:** Inspect exact-head GoTrue+PG17 CI; repair fixture defects without altering original source/hash, then refresh bot coverage evidence. No merge/production SQL/paid AI activation.
