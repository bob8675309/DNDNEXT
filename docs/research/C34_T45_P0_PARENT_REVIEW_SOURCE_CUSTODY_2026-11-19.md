# C34 T45-P0 — Original parent Level Up review source custody and visibility policy question

**Status:** Source/static original-blob contract **ACCEPTED**, signed parent RPC/browser **NOT STARTED**. **Release HOLD.**  
**Date:** November 19, 2026, Central.  
**Research PR:** [draft #379](https://github.com/bob8675309/DNDNEXT/pull/379).  
**Exact source-only executable:** `9b2204b3a8d452c902a44f7812043cc33375fb04`; [Actions #44556159182](https://github.com/bob8675309/DNDNEXT/actions/runs/44556159182), [job #135672636764](https://github.com/bob8675309/DNDNEXT/actions/runs/44556159182/job/135672636764) **SUCCESS**, T45 new **5/5**, inherited P1.3, T43, T44 static gates successful.

## Verified unchanged original sources
- `components/CharacterClassPanel.js` Git blob `d39d2bceab944d3d4ec42cc2cfda92609ce51a2b`.
- `sql/20260710_02_character_progression_foundation.sql` blob `b1b9781e06e9210a30c520b7f531bce7cbdbd82a`: `private.can_manage_character_progression_v1` and `public.get_character_progression_v1`.
- `sql/20260710_04_character_xp_level_up_review.sql` blob `81bce9bec9c59b3b673aeaada913cd054e4b74c7`: `public.can_manage_character_progression_v1`, `public.cancel_character_level_up_v1`, original cancel-invalid trigger and initial review RPC declarations.
- `sql/20260710_07_transactional_level_up_completion.sql` blob `4a39927c667fab9a2dd87ef1785aadb785e47d38`: later source-original `public.get_character_level_up_review_v1` with `canComplete=v_session.metadata_ready`.
- `sql/20260808_15_level_up_review_fail_closed_choice_deltas.sql` blob `aa71d3dc8cad6e679bdd95b32f857207621597cb`: latest source-original `public.begin_character_level_up_v1`, includes persistent class-choice gap guards and metadata readiness.
- Source-only suite `scripts/integration/c34/test_t45_parent_review_source.mjs` checks each immutable Git blob, the actual UI call graph, auth and session behavior, and the **distinction** between progression read and review management permissions.

## Current parent UI contract (source, not exercised browser)

The parent loads progression, class_catalog and `can_manage_character_progression_v1` in parallel, then loads `get_character_level_up_review_v1` only when the actor can manage. `Review Level Up` invokes original `begin_character_level_up_v1`; `Cancel review` invokes original `cancel_character_level_up_v1`; a server-returned review is passed as `review={levelUpReview}` to `CharacterLevelUpChoices`. The original begin/get/cancel bodies all use `private.can_manage_character_progression_v1`. The latest original begin locks progression and any open session `FOR UPDATE`, checks `pending_level_up`, source/canonical metadata and persistent choice gaps, and returns one open session (reused on refresh) with an initial start event only when new. Original cancel marks open session `cancelled` and records an event. Original trigger invalidates open session when pending flag or class level changes.

## Source-level reader visibility concern (not confirmed runtime exposure)

`public.get_character_progression_v1` is SECURITY DEFINER and executable by `authenticated`; its body rejects `auth.uid() IS NULL` but does not check the character's ownership, `character_permissions`, a visibility flag, or `private.can_manage_character_progression_v1` before selecting character, class, XP, class level, progression and up to 20 recent events. This is **source-level evidence of absent per-character ACL in this specific reader**; no signed outsider RPC was executed in T45-P0 and no production user's data was inspected. The intended authorization may permit general NPC/class progress viewing, but private or hidden character progression policy needs explicit owner decision before a patch. Never infer the logged-in-but-unrelated user could access the original review actions: those DO enforce edit privilege separately.

## Why T45 remains open

The historical `scripts/fixtures/p1_3_levelup_v5_local_auth_pg17.sql` stages only a simple mock `public.get_character_progression_v1` and **no original `begin/get/cancel` RPCs**. The accepted T43 public signed Level Up proof uses source-correct v5 but synthetic class-level/catalog data. The accepted T44 Chromium proof mounts the actual child choice component in a temporary Next route with **injected synthetic review props** and deliberately does not mount `CharacterClassPanel`. Neither can establish real server-originated parent review ownership, session refresh/cancel, rollback or signed outsider progression visibility. The P1.3 private `current_user_is_admin` helper is reduced; it is not evidence of modern app-wide GM/DM/Admin equivalence.

**T45-P0 committed only a source test and standalone static CI; no source-original code, database schema/RLS, production SQL/data, protected world map, PR merge or Vercel deployment was changed. Hourly automation is paused as owner requested.**

**ONE NEXT T45-P1:** build a separate disposable signed PG17/GoTrue/PostgREST + actual Next parent Chromium fixture that stages exact source-origin reader/capability/latest begin/get/cancel/trigger and explicitly marked reduced catalog metadata, without injecting `review`. First test cross-character progression reader with signed outsider and anonymous, then begin/get/cancel edit authorization, XP gating, session idempotence, stale invalidation, same-JWT revocation, legitimate editor recovery and zero original character Sheet/XP mutation before Apply. Keep all P1.3/T43/T44 inherited evidence; if dependencies prevent full browser acceptance, report exact blockers, do not weaken original functions. Full Sorcerer/Warlock catalog, real Forge/Story/nonce, 22/34 legacy account Sheet writers, independent encrypted PG17 and **340 Storage-object restore**, and owner release approval remain separate blockers.
