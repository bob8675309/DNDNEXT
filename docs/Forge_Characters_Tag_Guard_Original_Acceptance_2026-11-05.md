# J125–J132 — Original player-character tag guard (held Forge research)

**Status: staged for exact-head CI, not yet authenticated-accepted.** This research belongs only to draft PR #324 stacked on unmerged NPC privacy PR #321. No production migrations, grants, data writes, browser acceptance or Vercel deployment.

## Source and evidence
- Production trigger `characters_guard_player_tags_v1` is `BEFORE UPDATE OF tags ON public.characters FOR EACH ROW`.
- Live original function `private.guard_player_character_tag_update_v1()` has read-only observed `md5(pg_get_functiondef)` = `b8b0008a718de1aa3e74d66b30f1a679`. Its exact unchanged body and original event/handler DDL are installed *only* in disposable PostgreSQL 17 following J124.
- Original direct tag edits by signed-in non-Admins on existing `player-character` rows raise SQLSTATE 42501. The guard deliberately allows legitimate nested sheet tag updates when `pg_trigger_depth()>1`, and same-value updates.
- Test character UPDATE RLS is a narrow, declared editor-only **surrogate**, not production `private.can_access_character_v1`, grants or Admin policy.

## Proposed real GoTrue/PostgREST tests
- J125: source MD5 and exact original event/timing/trigger.
- J126: signed Player direct changed tags denied with original 42501/message; unchanged CP/CS/G/GI/I/C and count fingerprints.
- J127: original nested sheet tag-sync adds profession and preserves campaign tags.
- J128: same-value direct UPDATE allowed as the deployed source specifies.
- J129: GM/Admin JWT with explicit editor grant can change player tags.
- J130: outsider JWT without editor grant sees zero rows under reduced local RLS.
- J131: anonymous UPDATE not permitted.
- J132: revoked editor loses access and G/GI/I/C/CP/CS remain stable.

**Scope limit:** A green result increments original creation-adjacent trigger fixture DDL from 12/31 to 13/31, leaving 18 unstaged. It is not full production-equivalent 31-trigger, original privileges, source catalogs, transaction/deadlock, browser or release acceptance. Preserve all J00–J124 checks.

**Single next task:** Examine exact-head PG17 + local GoTrue results, repair only test-fixture errors, then update coverage report/receipt. Never weaken original function, source hash, negative error or rollback assertions.
