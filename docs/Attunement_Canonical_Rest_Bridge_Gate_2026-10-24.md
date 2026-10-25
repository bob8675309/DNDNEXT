# Attunement canonical Short Rest transaction bridge — staged (2026-10-24)

**Status:** Draft, NOT deployed. Stacked on #263 → #262 → #261 → #260 → #257, separate from #251 → #253 → #255. This PR changes only isolated SQL source, fixture, workflow and documentation: no production database, public UI, maps, AI runtime, inventory, existing game effects, or new attunement bonds.

## What the live authoritative rest does
Read-only production inspection confirmed public.complete_character_rest_v1(uuid,text) is the security-definer canonical standalone Short/Long Rest RPC. It checks private.can_manage_character_progression_v1, restores canonical spell slots, limited spell uses and source-backed class action uses, writes a character_rest_log row, and relies on the established BEFORE INSERT encounter guard for atomic rejection. It does not change active encounter snapshots, HP or Hit Dice. The newest SQL source is sql/20260810_90_rest_class_feature_restoration.sql, not the older August 2 variant.

## New minimal result contract
sql/20261024_07_attunement_canonical_rest_log_bridge.sql redefines the **same canonical function body** with *only* three additive changes: declare v_rest_log_id; append RETURNING id to its original rest-log INSERT; add restLogId to restResult JSON. Existing auth/rest restoration and logged details remain unchanged. The Node validator compares the normalized body byte-for-byte to the original to prevent unintentional future drift. The return key is **additive**; no caller is required to supply a new argument.

A private service-role-only table maps one world-clock attunement attempt to the **exact returned** canonical rest-log UUID, not a "latest rest" timestamp guess. Private.record_attunement_focused_short_rest_v1(character,attempt) requires an authenticated administrator principal (service key alone/anonymous context fails), standard progression permission, character+attempt advisory lock, session row and item FOR UPDATE, source+owner/class revalidation, a valid world hour and the original canonical rest transaction. It then inserts the immutable link and marks the attempt "rest_logged_unverified". Idempotent replay returns the same rest ID **without restoring resources twice**. A canonical rest resource/encounter/permission failure rolls back **both** rest and focus link. No new public RPC is available.

**This is not item attunement.** Contact throughout rest, uninterrupted downtime, separate item identification, Artificer exceptions, cursed/transfer/expiry behavior and authoritative GM acceptance are NOT fully machine-verifiable from this contract. The service result still returns canCreateBond=false and attunementQualified=false unconditionally; no new magic bonuses.

## World time vs wall time
DNDNext world_state.world_time is the authoritative accelerated campaign clock (4× real time in the live snapshot); character_rest_log.completed_at remains a server real timestamp. The attempt and its completed-world-time snapshot are recorded in private, independently of completed_at. Do **not** use the old #262 real-time startedEpoch proof format as if it proved 1 hour of game-time. That parser and its old test contract remain unchanged and are not used to authorize a bond here. A future unified receipt/attestation must eliminate conflicting clock semantics and close contact/interruptions evidence.

## Tests
Isolated Postgres16 tests extend the existing #257–#263 fixture. They assert: exact original canonical rest logic, standard spell slot/uses restored once, unique rest-log id, both ends of the link, replay no duplicate, previous 59-minute denial, world-hour acceptance **without magic**, admin and service-only failures, active encounter failure and subtransaction rollback of resource changes, valid abort after failure, and private ACL. They use synthetic items/world-time and a small test fixture for class-feature state, not live user data.

## Remaining to authorize before merge/deployment
1. User review of the **additive canonical RPC response** and full signed-in player/admin and active tactical-encounter compatibility. Source parity against live stored signature, ACL and triggers.
2. Trusted server protocol or GM attestation for physical contact/continuity/identification and world-clock pauses/interruptions; no client-supplied trusted JSON.
3. Connection to source-verified #261 prerequisites and original #257 bond writer, with capacity/Artificer/item transfer, replay, RLS/permission and curse/expiry gates. Do not treat stored bond as active effects until consumers are updated and proved.
4. Separate source-adapter bridge into #251 common effects, preserving original equipment calculations, typed damage resistance-before-flat reduction, and protected world/town-map behavior.

**Rollback principle:** Leave the canonical rest function unmodified in production; do not merge/apply this migration until exact-head tests and owner release approval.
