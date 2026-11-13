# I2J-V1 — Option A legacy snapshot freeze with immutable public v2 and private Story

**Status: BOUNDED SIGNED GREEN on isolated PostgreSQL 17 + genuine GoTrue/PostgREST; RESEARCH ONLY, NOT A MIGRATION OR PRODUCTION RELEASE.** November 12, 2026 America/Chicago (CI logs November 13 UTC).

## Exact source and verified evidence

- **Research branch:** `agent/i2j-cross-pr-source-preflight-20261112`; original `main` base `6637b14f807ebec79542deb7eef4b2bc3abfb5fd`.
- **Signed run:** [GitHub Actions #43370977822](https://github.com/bob8675309/DNDNEXT/actions/runs/43370977822), job `131706393523`, **SUCCESS** at exact source and test commit **`7ff5ce586aa701eea4d20d51107f92a363bfd6ea`**. All **I2J-V1-01 through I2J-V1-11** printed PASS from real signed account registration / RPCs. The job used local `127.0.0.1:55621` for GoTrue/PostgREST and `127.0.0.1:55622` for PostgreSQL 17, isolated temporary Supabase CLI `@2.120.0` (intentionally pinned CLI v2), followed by `stop --no-backup`. No connected hosted DB was mutated.
- **Original v1 source:** live read-only `pg_get_functiondef('public.create_player_character_v1(jsonb,jsonb)')` MD5 `e2db5802f1f51b93f5b9d374a835e4b9`. Original v1 creates character/permission/progression/level event/sheet/spells, then performs `UPDATE public.players SET name=v_name,sheet=v_sheet,updated_at=now()` followed by dependent `IF NOT FOUND THEN INSERT ... name,sheet`. One linked player-character limit remains original.
- **Pinned original historical research:** complete original I2C source/setup `scripts/fixtures/i2j/pinned/i2c_original_creation_signup_shared_forge_pg17.sql` Git blob `1717bbac40bb4f53c87857675bf70c7181982c34`. Its original signed I2C-01..10 and I2D-01..11 research passes remain valid on their own historical heads, but the unmodified I2C SQL cannot be concatenated after immutable #324.
- **Original dependencies preserved:** Stage1–3 exact files pinned from #345, immutable #324 from unchanged main candidate, #351 Story-aware nonce exact pinned source, original I2D private copied v2 Option A scratch Git blob `889b661aef1317ca91a44eeac2d2ef7238d8cad6`, original I2C profile-only ACL Git blob `4a3b270b1f303698737d5bf2b321eb063a93c481`. The original private v2 MD5 was `1d06d00eb4b4aa4c125796d761f5e259`, and after I2D it was `00b2167041b9c2e4e1a98d3873839f37`. Original v3 and Story wrapper MD5s are separately asserted.

## Engineering decision: split v1 from the incompatible I2C full-source bundle

The old I2C source was source-correct in its separate signed context but required both a **present #324 nonce reservation table** and the **old unwrapped public v2** MD5 `0351f0a00acae023278e1b8b065b00c9`. Since #324 creates the reservation and then replaces public v2 with immutable intent, original I2C cannot run as written after #324, and running it before #324 fails the table precondition.

The I2J approach does **not** weaken either guard or reinstall old v2. New source-only composer `scripts/release/i2j_compose_v1_original_setup.mjs` reads the exact unchanged original I2C fixture (verified byte-for-byte against its Git blob), excludes **only** the public v2 function body, corresponding old-v2 MD5 check, its REVOKE/GRANT pair and the obsolete five-function message, and emits an exclusive-disposable temp SQL fixture. The emitted source installs original live-shaped v1, original signup trigger `sync_user_profile()`, original Fighter spell helper and source priority helper. It fails unless the real #324 public v2 reservation wrapper and private Story table exist.

The new **scratch-only** source patch `scripts/fixtures/i2j_v1_option_a_identity_only_after_immutable_pg17.sql` checks original v1 MD5 `e2db5802f1f51b93f5b9d374a835e4b9`, the original signup and class/spell helpers, #324 public v2 wrapper semantics, original pinned private copied v2 (or its already source-reversible I2D form), exact public v3 and #351 Story wrapper source. It replaces precisely the original v1 `UPDATE ... IF NOT FOUND THEN INSERT` **as one unit**, with the original I2C identity-only `INSERT INTO public.players(user_id,name) ... ON CONFLICT(user_id) DO NOTHING`. A reversible `pg_get_functiondef` comparison proves that restoring the one block yields exactly the original v1 MD5. It asserts **no other v1 account UPDATE/INSERT survives**, and public v2/v3/private v2/Story and signup function MD5s remain unchanged. It has an explicit `PGAPPNAME=dndnext-i2j-v1-local` guard plus local-only schema/role gates.

The creator’s untrusted `raw_user_meta_data` can influence only **cosmetic fallback profile display name** on a missing account, not permissions. Canonical `public.character_sheets` remains per character. Neither current nor historical `players.sheet`, including `{}`, is an automatic mirror.

## Genuine signed RED → GREEN results

| Test | Observed actual acceptance |
|---|---|
| I2J-V1-01 | Source-exact original v1 and signup plus immutable public v2/v3, private v2, Story fingerprints |
| I2J-V1-02 **original RED** | Existing populated historical `players.sheet` **and account name changed** by original signed v1; canonical character, sheet and permission created |
| I2J-V1-03 **original RED** | Original v1 also overwrote an existing `{}` account snapshot |
| I2J-V1-04 | Source-reversible v1-only scratch patch applied; every pinned public/private v2/v3/Story/signup source hash unchanged |
| I2J-V1-05 | Signed v1 created canonical character while preserving populated historical legacy sheet, name, `updated_at`; second linked v1 rejected with `23505` |
| I2J-V1-06 | Existing `{}` historical sheet, name, timestamp all unchanged after signed new canonical character |
| I2J-V1-07 | No existing `players` row: signed v1 created ID/name-only account using original signup display fallback, empty `{}` historical field |
| I2J-V1-08 | Original I2C signed account-column ACL permits profile rename but denies direct sheet write (`42501`) and anonymous account reads |
| I2J-V1-09 | Original I2D private copied-v2 repair applied after new v1 patch; public v2/v3 and newly patched v1 fingerprints unchanged |
| I2J-V1-10 | Public #324 v2 creates canonical new character, preserves existing empty historical snapshot; same nonce replay idempotent and foreign nonce denied (`42501`) |
| I2J-V1-11 | #351 signed v3/private Story creates only creator-private Story, never old GM Secret; identical replay returns original character, changed Story intent fails `22023`; legacy account remains inert |

Source original RED and green assertions were executed in the **same isolated PG17+GoTrue/PostgREST workflow**, with new signed actors. The local fixture is intentionally smaller than full production and does **not** install 31/31 live production original creation triggers concurrently. The earlier I2J [31-trigger fingerprint census](I2J_ORIGINAL_31_TRIGGER_SOURCE_FINGERPRINTS_2026-11-12.json) remains read-only evidence, not joint trigger behavioral acceptance.

## Remaining boundaries and next gate

**No automatic production migration or deployment.** The new candidate is a separate guarded v1-only reconciliation; original full I2C remains source-order **BLOCKED** and preserved, while the narrow v1 split is independently **SIGNED GREEN**. The 34 original account `UPDATE public.players` writers still include **22 not yet bounded-tested**, and three account insert/upsert families plus private copies and direct authenticated privileges must be accounted before an Option A cutover. The source-only privacy/immutable/Story/inventory combined ROLLBACK probe is a separate artifact, not yet executed on a complete original 31-trigger disposable DB. Privileged `SECURITY DEFINER` function ACLs, real Next.js signed browser role transitions, Forge full original first-load, PDF, inventory and independent backup+Storage restore remain open release gates.

**ONE NEXT TASK:** Integrate the v1-only repair into the existing I2J disposable source-order composer as a separately protected optional signed step, and build **31/31 co-resident original trigger acceptance** with source-identical function/trigger definitions—starting with exact function-body source and dependent fixture collection. Preserve the current 11/11 signed RED/GREEN receipt without changing its fixture semantics; do not touch the world-map runtime or live database.
