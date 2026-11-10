# I1-B — Original Forge immutable nonce + C3.3 private Story joint signed regression

**Research only — November 9, 2026.** This is a source-locked integration negative fixture, not a candidate production SQL migration. The branch is intentionally based on secure research #345 at `4f5f8ff7587aff1a68f21581ad68a4752789f54a`, rather than merging #324/terminal Forge branches and risking older NPC privacy Stage3. PR #348 carries the canonical I0–I6 priority; #349 separately preserves read-only 31-trigger audit sources.

## Verified exact-source signed result (November 9 local / November 10 UTC)

**Executed, not just source-inferred.** PR [#350](https://github.com/bob8675309/DNDNEXT/pull/350) original test head `a8e13dc91b5076a1dcd95ea26731e0cb63b40f3b`, [GitHub Actions original-combined-signed-nonce run 42740333918](https://github.com/bob8675309/DNDNEXT/actions/runs/42740333918): **SUCCESS for research characterization**. All four source/docs checks succeeded and Supabase Preview skipped. PostgreSQL17/GoTrue/PostgREST started, original fixtures installed, signed RPC cases executed and disposable containers removed.

- **I1B-01 PASS:** new signed Forge v3 character + source-checked creator attribution, exactly one Story/sheet/immutable reservation.
- **I1B-02 PASS:** changed original payload same nonce rejected with SQLSTATE `22023`; unrelated actor same nonce rejected `42501`.
- **I1B-03 KNOWN INTEGRATION GAP CONFIRMED:** changed-only private Story under the same creation nonce was **ACCEPTED and returned original character**, silently ignoring changed Story. This violates complete creation-intent rejection; **NOT RELEASE READY**. The test checks no duplicate character or secret was produced.
- **I1B-04 PASS:** legitimate same-intent replay after explicit creator Story edit did not overwrite later edit.
- **I1B-05 PASS:** overlength Story check rejected `23514` and rolled back both character and intent reservation.
- **I1B-06 PASS:** signed replay after active edit grant revoked rejected `42501`; no new character/Story writes.

**Mandatory next phase I1-C:** a source-pinned, transactionally complete Story-aware creation-intent correction with no raw Story in nonce ledger; reject changed-only Story before returning cached character, retain no-overwrite and current-role recheck, and preserve original public v2/v3 + creator/grant/inventory contracts. Test both first-create and retry across true signed GoTrue, failure/rollback, different users, and original triggered pathways. This is a new candidate/test-only branch and requires separately authorized release; no partial production SQL.

## Source authority and exact execution

- Run only in CI on disposable localhost Supabase CLI v2.120.0, PostgreSQL 17, genuine GoTrue-issued JWT and PostgREST. All DB writes occur there. The script fails closed unless `GITHUB_ACTIONS=true`, `CI=true`, PGHOST=127.0.0.1, PGPORT=54322, PGDATABASE=postgres, and `DNDNEXT_I1B_LOCAL_CONFIRM=DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY` match.
- Source unchanged: base `scripts/fixtures/forge_creation_replay_local_auth_pg17.sql` and `c33_forge_privacy_original_policy_join_pg17.sql` (exact original Forge v2/v3 MD5), #345 Stage1–3 `sql/candidates/20261104_*_stage*.sql`, and #324's unmodified `sql/candidates/20261105_player_creation_immutable_intent_v1.sql` (same blob already present on main). No synthetic nonce implementation.
- New `scripts/test_i1b_forge_private_story_nonce_local_auth.mjs` composes those candidates in an isolated database, checks preflight fingerprints and real signature/authority, and calls the actual `create_player_character_with_private_backstory_v1` through signed PostgREST.
- Six checks: first atomic creation/provenance and one row; changed base payload rejected; cross-actor nonce denied; changed-only Story under same nonce characterized; identical replay after an explicit author edit leaves Story intact; overlength text undoes both creation and reservation; revoked editor cannot replay.
- The current candidate's nonce fingerprint covers `(version,player-v3,p_payload,p_spell_choices,p_magic_selections)` and **does not include `p_private_backstory`**. The Story wrapper calls inner v3 then inserts with `ON CONFLICT DO NOTHING`. A changed-only Story retry can therefore return the same ID without reporting changed intent. The test logs `KNOWN INTEGRATION GAP I1B-03` if the true signed DB reproduces this behavior. Set `DNDNEXT_I1B_REQUIRE_FIXED=1` to make that precise gap a failing **future release gate**. A green characterization workflow is NOT proof the complete-intent invariant passed.
- The 31 original progression/character/inventory trigger suite, Stage4 inventory CHECK/four RLS policies, real production Auth/RLS, full ten-step Forge Chromium, recovery rehearsal and release rollback remain separate pending gates. Source fixture is a reduced subset of the genuine function bodies, not a production-shape 31/31 environment.

## Integration policy and no-side-effects

No changes to shipped app code, world-map/town/tactical systems, hosted Supabase, Storage, original spell/catalog/merchant-stock records, Vercel, original open PR ancestry or developer-agent configuration. Keep #324/#328–#335/#345 research open. Confirm exact-head CI and preserve original failed/positive evidence. This research may identify a required coordinated Story-aware nonce design, but may **not** edit production SQL as a shortcut.

**ONE NEXT TASK after source-authentic CI result:** if I1B-03 is reproduced, design and prove a server-side, race-safe, transactionally bound private-Story addition to the complete creation-intent fingerprint that rejects changed-only Story under the same nonce but never overwrites later legitimate authorized edits; preserve original public v2/v3 semantics and entire existing source/trigger graph. Then run the source-locked negative/auth fixture again before any release proposal.
