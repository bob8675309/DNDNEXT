# Atomic Attack identity boundary — guarded staging, 2026-10-27

**Draft child of #294. No production migration, browser route, gameplay integration or service-role credential changes.**

## Verified live security fact

Read-only inspection of `public.encounter_can_control_participant_v1(uuid)` found that its first branch returns true for `auth.role()='service_role'`, without consulting participant ownership. That behavior belongs to the existing production helper. In the draft atomic candidate, `auth.uid()` is tested, but the candidate's EXECUTE grant is limited to `service_role`. A service-role connection plus a spoofable/borrowed `auth.uid()` claim therefore cannot be considered an end-user authorization proof.

## This staged change

The candidate now explicitly rejects any database execution context whose `auth.role()` is not `authenticated` **before acquiring participant locks or writing**. The existing service-role-only EXECUTE grant is deliberately NOT loosened. Therefore the draft candidate is intentionally non-executable in its normal granted role until a separately designed, verified identity bridge is introduced. This is a security hold, not a completed feature. The existing public production attack writers are unchanged.

`scripts/validate_attack_identity_boundary.mjs` checks this fail-closed source contract, the still-private grant, the lack of an enabled battleboard consumer, and the unchanged control helper call. It cannot establish live signed-in permissions or protect arbitrary future SQL changes on its own.

## Required protocol before any endpoint

1. Authenticate the original user by server-side verification of their Supabase access token (not by trusting a submitted user ID or decoding unverified claims). Avoid using user-editable metadata as authorization.
2. Execute permission checks in a real, authenticated-user database context, including exact active participant, character edit entitlement, encounter, round/turn and item custody. Re-check within the *same transaction* as action resolution and after required row locks. Never assume a service-role call inherits user authorization.
3. Preserve the existing service-role bypass helper for legacy behavior only; any new capability must use a dedicated authenticated-role, fail-closed authorization primitive that cannot be satisfied by `service_role` or caller-supplied `requested_by`.
4. If a privileged worker must execute the transaction, design a non-forgeable, single-use server-issued authorization record that binds verified user, encounter, participant, action UUID, request UUID, target, item and turn, with expiry and atomic consume under locks. Validate that privileged callers cannot mint an authorization record from arbitrary browser parameters. Do not trust an unsigned `p_user_id`.
5. Include negative tests: unauthenticated, service-role-only, forged identity, mismatched actor/character, revoked permission, other encounter, stale turn, retry with different payload, replay after turn advance, simultaneous requests and concurrent permission/equipment changes. Preserve transaction rollback and one-shot effect semantics.
6. Only after those tests and explicit review should the execution role/grant be revised and any API route integrated. Never expose service credentials in Next.js browser bundles.

## Current outcome

**Identity verified for production: FALSE. Endpoint supported: FALSE. Attack executor deployable: FALSE.** The guard intentionally blocks the current service-role-only candidate and its existing synthetic test caller until the isolated PG16 fixtures are updated to exercise authenticated identities. The previously green #294 tests are evidence for that earlier head, **not** for this branch.

The next task is implementing and independently testing a true authenticated-role transactional command design, with signed-in end-to-end coverage, before attempting production migration.
## Next isolated fixture reconciliation (child of #296)

The previous #296 isolated PG16 workflows failed because the old synthetic fixture did not provide an `authenticated` role context. This follow-up replaces `auth.role()` **only inside disposable PG16** with a `fixture.role` test value, asserts that `service_role` is rejected without mutating candidate state, and runs the existing rollback/idempotency/damage tests with the synthetic authenticated role. This is simulation, **not Supabase Auth JWT verification, a grant change, or a production authorization bridge**. The real candidate SQL and live grants remain unchanged. A green fixture establishes compatibility with the guard in isolated tests only.

## Post-lock authorization hardening (new stacked draft)

The atomic candidate previously used the legacy participant-control helper **before** locking the participant row. This draft adds a second check **after the attacker row lock**, directly using current `controller_user_id`, `character_permissions.can_edit` (matching rows locked `FOR SHARE`) or `public.is_admin`. A revoked character editor fails rather than relying on a prior helper result. No service-role bypass is used in this second check, and role/EXECUTE deadlock-by-design remains unchanged.

**Limits:** Admin status is still checked through the existing live helper, JWT authenticity is not proven by these synthetic fixtures, and concurrent administrative role revocation or controller changes require dedicated two-session signed-in integration tests. This is a defense-in-depth candidate, not a deployable authenticated RPC. New source-contract validation checks ordering and fields; existing isolated PG16 attack regressions must be rerun on this exact head.
