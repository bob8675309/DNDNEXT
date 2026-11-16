# C34 T30 — Strict town-only capabilities and source-original Stage2 NPC Profile (RESEARCH HOLD)

**November 16, 2026.** Branch: [draft #379](https://github.com/bob8675309/DNDNEXT/pull/379), based on the previous T29 signed-success code. **No live permissions, production database, world map, active town route, protected shared components, feature flag, or main deployment changed.** All code in this increment is unmounted or disposable.

## The source/negative-test plan before integration

1. Keep T29's exact Admin/GM/DM commerce source and original buyer intact. Do not use existing broad `public.is_admin(uid uuid)` to confer town travel, GM dossier or privacy rights.
2. Provide a **disposable local PG17-only** public RPC `c34_town_role_capabilities_research_v1()` with no caller-supplied target UID. Source of role is `auth.uid()` bound to `public.user_profiles.role`, strict `admin`, `gm`, `dm` values. Anonymous EXECUTE revoked; SECURITY DEFINER has explicit search_path. This is a capability display projection, **not** stock/wallet/dossier authorization (each action checks the database independently).
3. Add an unmounted client reader that validates exact returned booleans against canonical role, checks genuine `auth.getUser()` at both ends and accepts an externally invalidated actor generation for same-user logout/relogin. Do not change the shared hooks/panels or world map.
4. Compose the existing T21 signed Stage1 public Profile/Stage2 editor/Stage3 Story reader with a **separate strict Stage2 Admin-only** `get_npc_dossier_admin_v1` call. GM/DM may display stock and player GP tools but must not read NPC dossier, change travel or leak secret through public lore. Sheet/Print and Story still require their independent server-owned character grants.
5. Run offline source/negative tests (unknown, uppercase, malformed role, injected privileged booleans, stale actor, mid-request demotion, public lore secret) and the genuine existing 25-minute signed PG17/GoTrue/PostgREST/current Next/Chromium/PDF suite plus appended T30 role/Profile test. Preserve T26–T29 failures and exact buyer hash. **CI outcome must be verified, not inferred from a pushed commit.**

## Deliverables (pending exact-head CI)

- `utils/c34/t30TownRoleProfileCandidate.mjs` — unmounted strict role + NPC client adapter.
- `scripts/integration/c34/t30_disposable_town_role_capabilities_pg17.sql` — disposable-only RPC, no production migration.
- `scripts/integration/c34/test_t30_town_role_source.mjs` — Node22 deterministic source and negative cases.
- `scripts/integration/c34/test_t30_town_role_profile_signed_pg17.mjs` — real GoTrue role matrix against unchanged Stage1/2 and T29 original buyer.
- Both C34 workflows gain one bounded T30 validation step each; earlier test gates remain present.

## Release boundary and one next gate

A genuine signed PASS would establish this **unmounted capability + safe-reader composition in disposable PG17**. It would **not** mean production has the new RPC, current `NpcPanelTownT28P2Research.jsx` has adopted it, or the town flag is enabled. The next step after accepted CI is an isolated, current-Next town UI probe that gates commerce/travel/dossier visibly and verifies role changes, Profile→Shop→Profile, private narrative, delayed responses and all original regressions. Mounting or migrating production still needs separate owner approval and the independent DB/Storage restore gate.
