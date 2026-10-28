# Authenticated Attack Caller Boundary — 2026-10-27

**Draft #295 stacked on #294. Read-only player/GM authorization proof only. DO NOT MERGE, DEPLOY, OR CONNECT IT TO LIVE ATTACK WRITERS.**

## Verified identity/permission architecture

The existing battleboard `pages/encounters/combat.js` calls the Supabase client directly under its user's session. The canonical `public.encounter_can_control_participant_v1(participant_id)` reads `auth.uid()` and accepts: (1) an administrator verified by `public.is_admin`, (2) `encounter_participants.controller_user_id` equal to the caller, or (3) an explicit `character_permissions.can_edit` grant. **It also returns true immediately for `auth.role()='service_role'`, intentionally bypassing regular participant checks.**

This matters because the #293/#294 executable candidate is `service_role`-only **but also expects `auth.uid()` and requires participant control**. Using a service client does **not** inherently supply the human user's verified JWT identity. An arbitrary `user_id` argument supplied by the browser or a manually set `request.jwt.claim.sub` on a privileged connection is **not** proof of authentication. Do **not** bypass that gap by injecting a claimed user ID or exposing a service key in the browser.

Supabase's database documentation notes that SECURITY DEFINER functions use their owner's privileges and bypass RLS by default, so each function must perform its own ownership checks; a narrow `EXECUTE` grant is necessary but not sufficient. Supabase Auth makes the validated JWT identity available through `auth.uid()`; JWT **signature/expiry validation happens before** a Data API or verified user-context call reaches Postgres. The database cannot prove signature authenticity merely by reading `request.jwt.claim.*`.

Official references: https://supabase.com/docs/guides/database/functions ; https://supabase.com/docs/guides/auth ; https://supabase.com/docs/guides/database/postgres/row-level-security.

## New safely separated authorization preflight

`sql/20261027_04_authenticated_attack_caller_preflight_shadow.sql` introduces:

`public.encounter_attack_caller_preflight_shadow_v1(participant_id, expected_encounter_id, expected_round, expected_turn_index)`

- `STABLE SECURITY DEFINER`, fixed search path, with EXECUTE granted **only** to `authenticated` (not `anon`, `PUBLIC`, or `service_role`). Returns no data for unauthorized callers.
- Explicitly requires `auth.role()='authenticated'` and a non-null `auth.uid()` before any sensitive read. Unlike the canonical generic control helper, a service-role caller cannot use this new function's permission shortcut.
- Calls the **existing canonical** participant-control check, then verifies exact encounter, character participant, active undefeated turn, expected round/turn index, available Action and source-resolved PHB/XPHB base-class attack allowance from #291.
- Returns only a user-bound, read-only proof of these conditions. It deliberately sets `trustedEndpointIdentityHandoffReady=false`, `jwtSignatureVerifiedByDatabase=false`, `atomicCandidateCalled=false`, `attackActionSpent=false`, `damageApplied=false`, `combatConsumerEnabled=false`. It does not reserve a slot, roll dice, spend Action or call #293's private executor.
- Does **not** accept `p_user_id`, `p_is_admin`, `p_role`, a raw token, or any browser-provided authority claim. The only identity source is the Supabase-validated request context.

## Isolated PG16 tests

`scripts/fixtures/canonical_controller_acl_pg16.sql` copies the **exact** source of the real participant-control function from `sql/20260727_04_authoritative_encounter_turn_movement.sql`. A Node source validator fails on any drift.

`scripts/fixtures/authenticated_attack_caller_preflight_shadow.sql` composes all earlier campaign/attunement/hand/attack/source/actual roll/damage regressions, then temporarily replaces *test-only* `auth.uid()` and `auth.role()` implementations to read simulated `request.jwt.claim.sub` and `request.jwt.claim.role` values. It uses actual PostgreSQL `SET ROLE authenticated`, `anon`, and `service_role` to test:
- Player with an explicit `character_permissions.can_edit` grant, direct `controller_user_id` (different player), and canonical admin-based control.
- Foreign player denied without exposing character, class, or encounter details; missing JWT UID denied; a service_role **JWT role claim** denied even under authenticated SQL role.
- Anonymous and service-role **SQL roles** denied EXECUTE even if their synthetic JWT claims say authenticated.
- Wrong encounter, stale round/turn, non-active participant and resource state rejected.
- Private executable atomic candidate still has NO direct authenticated/anonymous EXECUTE privilege.

**Boundary of proof:** The PostgreSQL fixture can test function privileges and context propagation, **not cryptographic verification** of JWT signatures or browser cookie security. Only the managed Supabase Auth/Data API can validate a real session. No player browser test or externally accessible endpoint for #293 has been created. Crucially, the private candidate still cannot simply be invoked by the player preflight; that would bypass the remaining action/hand/feature release gates.

## Release order

1. Decide on a safe, feature-gated authenticated **server or PostgREST execution adapter** that preserves user identity to the database. Prefer user-scoped authenticated JWT/RLS context rather than service-role impersonation. Never put a service key in client code.
2. Run true signed-in player/admin/foreign-user browser tests, permission revocation, replay after turn end, token expiration and cross-encounter isolation.
3. Review exact #293 atomic roll/damage writer parity with real map targeting and concurrent requests (already source-tested for Guiding Bolt, Vicious Mockery and equipment mitigation in #294).
4. Resolve subclass/multiclass/Action Surge, per-attack draw/stow, shields, two-hand grip, shared inventory custody, somatic/focus and optional attunement/rest authorization before making a real consumer callable.
5. Explicit approval is still required before any merge, production migration or activation.

**All draft #267–#295 PRs remain unmerged and undeployed.** Live attack, spell, movement, maps, Forge, inventory, resources, damage functions and character sheets are unchanged.

[Current staged integration handoff](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md).
