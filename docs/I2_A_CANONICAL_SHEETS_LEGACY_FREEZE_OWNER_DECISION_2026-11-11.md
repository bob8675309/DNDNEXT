# I2-A — Owner-approved Option A: canonical character sheets, preserved legacy snapshots

**Decision recorded: November 10, 2026, America/Chicago (November 11 UTC).**
**Authority:** Owner explicitly approved Option A in the current DNDNext development conversation:

> Preserve existing legacy players.sheet data, make canonical per-character sheets authoritative, and phase out the automatic legacy mirror **after auditing consumers**. Proceed with research and safe planning; **no production changes yet**.

This is now the **approved architectural direction**, not a request for another preference decision. It is **not** deployment or merge authorization. The original-source evidence in held PRs #360–#364 and the November 9 integration-first I0–I6 owner program remain authoritative for research history. Do not reinterpret those prior bounded scratch GREEN specimens as approval to keep live mirrors permanently. Preserve their RED/GREEN research evidence and tests unmodified; new acceptance is a new contract.

## 1. Meaning of Option A

- The **canonical, authoritative character sheet** is public.character_sheets, indexed by character_id and linked to public.characters.id and character_permissions. Character-specific progression, grants, equipment, private Story, action resources and inventory retain their own source-specific guarded authorities; canonical sheet does **not** become the sole source of those normalized game records.
- A player can create, own or edit multiple characters. A character action, level-up, rest, grant, inventory change, or Forge creation must read/write **the intended character ID**, not select a character implicitly from the player's account-wide sheet.
- public.players remains an **account/profile identity row**, preserving user_id, name and any required display-name workflows. Its legacy sheet column remains physically present; existing nonempty sheet bytes must be preserved. After approved cutover, it becomes a **frozen legacy compatibility snapshot**, with **no automatic write or replacement for either matching or different characters**. Empty existing legacy sheets must not be populated by future character events.
- No automatic backfill, inferred creation marker, default active-character selection, silent migration/reassociation, deletion, TRUNCATE, NULL assignment, or copy of one character's sheet into someone else's account.
- Canonical player UI uses explicitly selected per-character records, currently through get_my_player_characters_v2() joining character_sheets. Account-wide sheet is **not** a live selected-character mirror.
- Any eventual owner-visible export or archival browser for frozen snapshots must be separately designed and permission-tested, not added as a hidden requirement to a release.

## 2. Grounded read-only findings, not source guesses

The repo baseline is held draft PR #364, head f969af0a15cc8a7e517808cb2eeeefea3119f6fd. DnDWeb live PostgreSQL introspection was **SELECT-only** and produced no identifiers, account names, sheet contents or private Story values.

| Read-only evidence | Observed value and implication |
|---|---|
| Legacy player rows | 5; **3 have nonempty sheets**; all must be retained |
| Nonempty sheets without meta.creationRequestId | **2 of 3**; never infer identity or backfill automatically |
| Nonempty sheet belonging to an account with multiple editable characters | **1 account**; shared-mirror collision is relevant to current data |
| Nonempty legacy sheets exactly matching an editable canonical sheet | 2; **not** permission to overwrite them |
| Original UPDATE public.players functions | **34**, all SECURITY DEFINER; source fingerprint 34/34 matches I1-N snapshot, no drift |
| Original INSERT/UPSERT public.players functions | 3: create_player_character_v1, create_player_character_v2, sync_user_profile |
| Functions with direct FROM/JOIN public.players | 6 source-matched database lookups, none observed to read the sheet |
| Named browser .from("players") consumers | 7 reviewed application files select identity/profile fields (id/user_id/name), not sheet |
| Canonical roster RPC | get_my_player_characters_v2() source MD5 deca87aaad0dce214743c87cdca03f36; joins character_sheets by character ID |
| public.players custom table triggers | 0 noninternal observed |
| Player row RLS | ENABLED; self SELECT/INSERT/UPDATE plus admin ALL |
| Authenticated role privileges | Table-wide INSERT and UPDATE; direct UPDATE on **sheet** currently permitted |
| SECURITY DEFINER writers | 34 of 34; a client column privilege change **alone** will not stop their server-side writes |

The user-approved plan must handle **the three INSERT/UPSERT functions separately**, since an UPSERT can overwrite an existing sheet without containing the exact text “UPDATE public.players” counted in the 34-function census.

The original v1 creator additionally changes the player's profile NAME during character creation; the eventual change must preserve account name editing as an independent user-profile action, rather than silently replacing the name with the latest character. The v2 creator uses account-wide INSERT/ON CONFLICT UPDATE of sheet even if its ordinary UPDATE text does not appear in the 34 count. The signup sync_user_profile trigger inserts an identity row without passing sheet (default empty), and must remain operational.

The current PlayerAccountPanel selects players.id/user_id/name, creates players.user_id/name, updates name/updated_at, and upserts user_id/name. This profile workflow must remain intact. The PlayerCharacterProfilePanelUnified uses get_my_player_characters_v2 for the canonical per-character sheet. Other direct players queries reviewed: OfferTradeButton, pages/admin, pages/npcs, pages/inventory, pages/encounters/live; all direct queries there select player identity/profile fields, not legacy sheet.

### Scope and unknowns

Source search examined the connected public GitHub repository and live public/private stored-function definitions, PostgreSQL view definitions, the players table trigger catalogue and player-row policies. No public/private view definition or noninternal table trigger was found that explicitly references players.sheet in the observed source pattern. **This does not prove complete consumer absence**: unexamined external applications, ad hoc SQL/reporting, dynamic table names/SQL, privileged service clients, library integrations, backup restore tools and stale deployed builds may access it. The seven reviewed client files are a bounded list, not a universal absence certificate. Audit those consumers before changing writes or SELECT/INSERT privileges.

### Current access risk

The authenticated database role currently has table-wide INSERT and UPDATE on public.players, and RLS allows self-row updates. Thus a signed client can mutate its own old sheet, although the reviewed current UI does not visibly request this. All 34 server writers are SECURITY DEFINER and may bypass client table/column restrictions. A complete freeze must **coordinate both source writer retirement and direct-client column privileges** in one tested release package.

Supabase's official **Column Level Security** documentation states that revoking a column permission does not override a still-granted **table-level** permission. A candidate must revoke the relevant table-level privilege and restore only required profile columns, rather than rely on an ineffective per-column REVOKE. The privileges, RLS policies, authorized Admin behavior, player-name INSERT/UPSERT and function-definer execution must all be tested under genuine JWT roles before any migration. Docs: https://supabase.com/docs/guides/database/postgres/column-level-security

## 3. Proposed integration stages (research gates, not migrations)

### I2-A0 — preserve owner decision and source evidence

- Store this explicit owner decision, the immutable I1-N 34-source MD5 census and source provenance, the current read-only aggregate counts, and the previously successful I1-L/M/N/O/P CI runs. Do not overwrite archived research RED witnesses or rewrite their GREEN expectations.
- Freeze the current repo and database source baseline for comparison. Verify all 34 source hashes are still exact before preparing any function replacement. Any new DB function or reader adds a new required audit entry.
- No production data or permissions touched in this research PR.

### I2-A1 — complete the consumer/dependency audit

- Follow all seven named app player-row queries, PlayerAccountPanel name creation/update/upsert, canonical get_my_player_characters_v2 and additional controller, worker and server actions; test direct vs indirect sources and the actual deployed browser build.
- Review the **34 SECURITY DEFINER updaters** and **three INSERT/UPSERT paths**, not merely function names: identify each caller, update order, authorization, downstream use of FOUND/ROW_COUNT, triggers, locks and exception semantics. A removed UPDATE may change PL/pgSQL FOUND or change downstream behavior even when canonical sheet writes remain.
- Inventory service_role scripts, cron/scheduled routines, legacy reports, mobile/third-party clients and backups; their absence cannot be inferred from GitHub alone. Preserve NPC private Story, merchant inventories, item rights, earned features, selected character binding and world/town/tactical boundaries.
- Confirm whether any historical character sheet reads the frozen column for recovery; if so, provide a separately authorized read/archive path before retirement. Do not silently return stale data as “current.”

### I2-A2 — source-authentic disposable freeze candidate

- In isolated authenticated PostgreSQL 17, preserve exact original function DDL and source RED transactions. Build a **new** Option A candidate (do NOT silently edit I1-M/O/P history) that retires every legacy sheet write while keeping all canonical writes and return values.
- Retire server writes in **all 34 UPDATE bodies** plus direct creator v1 UPDATE/INSERT and v2 account-wide sheet UPSERT, with consistent fallback identity-row creation. Retain the original signup user-profile creator and legitimate player-name edits. Do not conflate character display name with account display name.
- Fail closed for any previously unknown legacy writer, missing expected source fingerprint, unsupported source rule catalogue, permission drift or removal that changes a function's FOUND/ROW_COUNT behavior. Prefer a coherent atomic candidate rather than piecemeal production edits that leave the mirror mutable.
- **New required Option A invariant:** players.sheet must remain byte-identical before and after ALL character operations, **including operations on the same character that originally occupied the snapshot**. Prior I1-M/O/P GREEN tests intentionally allowed same-character refresh; retain them as historical bounded research, but add new freeze-contract tests instead of modifying those original receipts.
- Positive paths: signed v1/v2/v3 creation, two-character account, editor/delegate separation, genuine earned level-up, Admin set, HP/action, short/long rest (including actual spell resources and encounter rest veto), source-owned grants, equipment/inventory/merchant flow, account profile name edit/upsert, canonical character selection and printable sheet.
- Negative paths: anonymous/unauthorized/GM-private access, direct sheet update/insert as authenticated, replay, duplicate request nonce, stale row/marker, cross-user permission, trigger-induced side effects, concurrent writer locks/serialization and rollback. No 31-trigger, browser or concurrency parity claim until it is actually exercised.

### I2-A3 — client and privilege compatibility candidate

- Keep players user_id/name profile flows; select character sheets by canonical character ID through authorized readers. Do not remove the players table, alter its primary keys, clear legacy snapshots, or break trade/merchant/inventory player-name lookups.
- Stage a test-only migration design that removes **table-level** client INSERT/UPDATE grants on players and grants back only columns required for legitimate profile insert/update. Check inheritance/PUBLIC grants, default values, ON CONFLICT name behavior, SELECT/RLS policy parity, Admin workflows and service_role privileges in a disposable role-authentic environment.
- Specifically assert client writes to players.sheet are denied and client name updates/inserts remain allowed. SECURITY DEFINER database writers must also be retired, or the freeze remains incomplete.
- Revoke or adjust sheet READ visibility **only if** privacy and backward-compatibility review authorizes that separately; preserved legacy rows must remain recoverable by privileged owner-approved procedure.

### I2-A4 — production release approval / rollback gates

**Still blocked** pending separate owner approval. Required: whole original 31-trigger creation graph, signed browser/UI acceptance, every known 34+3 writer and consumer migrated, role/RLS and Admin controls, CP/CS/grants/inventory lock order, logged source hashes, real full DB + all Storage bucket backups, independently encrypted second backup and an isolated restore test. Supabase CLI v3 has breaking changes; keep established local v2 tooling pinned until CI is deliberately updated.

The eventual deployment should be a reviewed, reversible, atomic transition (server writer retirement and direct-client write restrictions together, with staged app compatibility). No old mirror should be resumed as a side effect of rollback without owner permission. Rollback means returning application/auth behavior to a tested safe state, **never** restoring a stale legacy sheet over any canonical character. Keep captured backups, run post-cutover discrepancy and unauthorized-write tests, and document exact restoration procedures before implementation.

## 4. What is authorized now

**Allowed:** research, read-only PostgreSQL metadata/aggregate inspection, GitHub documentation, source-audited test design, SELECT-only audit files, local disposable CI fixtures, draft PRs, and exact-head verification.

**Not allowed by this approval:** production DDL/DML, touching player sheets, migrating/backfilling a legacy row, changing live roles/RLS, freezing live writes, deleting files/DB rows, changing runtime behavior, merging research PRs, deploying to Vercel, or enabling paid agents.

**Next one bounded engineering action:** prepare a source-hash-pinned **disposable Option A no-writes acceptance suite** spanning the existing I1-M/O/P families and all 34+3 writer sources; explicitly test account-name compatibility and direct column privileges. Resolve unknown external/deployed consumers and required whole-system gates before proposing any hosted cutover.
