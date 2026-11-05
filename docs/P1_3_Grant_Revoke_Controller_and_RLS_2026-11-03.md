# P1.3 — In-flight grant revocation, active controller reassignment and real-policy RLS (2026-11-03)

> **RESEARCH ONLY — NOT DEPLOYED.** Source/test SHA `04b8d7846522f89e7e0335f307b911d9a3ea9972` on [draft PR #317](https://github.com/bob8675309/DNDNEXT/pull/317), [real-GoTrue JWT run 41709639824](https://github.com/bob8675309/DNDNEXT/actions/runs/41709639824) **SUCCESS**, signed-in cases **142–156 ALL PASS**. The same workflow reran prior original/candidate cases 48–141. Five independent JWT identities (GM, controller A, controller B, equipment owner, outsider); disposable PostgreSQL 17 and PostgREST. No live users, campaign data, SQL changes, grants, gameplay, merge, or deployment. Production main SHA `51c351a142d03378dff8e47e05182afe21a15622` remains unchanged.

## Deployed sources and policy predicates — SELECT-only

- `public.admin_update_encounter_participant_staging_v1`, exact deployed SQL MD5 `190bbed26d2067905b00000686c17176` saved in [original Admin snapshot](../scripts/fixtures/p1_3_admin_staging_source_pg17.sql). It locks P with `FOR UPDATE OF p` before updating E, and explicitly **refuses** any staging changes after status `active`. It is **not** an active combat controller-reassignment API.
- Live `public.encounter_participants.controller_user_id` is the combat controller. The actual deployed `public.character_permissions` has `can_inventory`, `can_edit` and `can_convert`; **no `can_control` column**. Prior scratch-only `can_control` fixtures are not evidence of a deployed grant.
- Live `character_permissions_admin_write` permits Admin policy-controlled grant UPDATE; `character_permissions_select_self` permits caller-owned grant rows or Admin. Live `inventory_items_select_owner_or_admin` restricts raw inventory SELECT to `user_id=auth.uid()` or Admin.
- Critically, `character_sheets_select_visible_or_assigned` permits full `character_sheets` SELECT whenever the linked character is selectable under `characters_select_visible_or_assigned`. The latter allows **any non-hidden character**, or a hidden character accessible through `private.can_access_character_v1(character_id,'read')`. Live authenticated users have EXECUTE on the specific private RLS helper and schema usage; these grants were replicated in the scratch test.

## Controlled G/P revocation and permission-row lock experiment

[Fixture](../scripts/fixtures/p1_3_permission_controller_rls_parity_pg17.sql) implements the deployed RLS SELECT/UPDATE predicate forms for the four relevant tables against **synthetic only** rows and exact original staging function. Two test-only trigger barriers force an authenticated Admin's G (`character_permissions`) UPDATE and a **modeled-only** active encounter E/P controller reassignment to overlap with a real signed-in reaction request.

- Before G lock: the prior E→P→L→I→W candidate can read the old `can_inventory=true` while the Admin's G-row revocation is uncommitted. A reaction can succeed in this schedule. This is a **pre-commit nonblocking stale read**, not proof of a production exploit.
- [Separate disposable G-lock extension](../scripts/fixtures/p1_3_permission_row_lock_candidate_pg17.sql) acquires G `FOR UPDATE` **after I** and before W, and rechecks the player-owned item association. It waits for the signed-in Admin revocation to commit and then denies the attack with no HP, reaction, W or persistent ledger mutation.
- For active E/P controller reassignment, an explicitly `p13_reassign_active_controller_research_v1` model acquires E then P. It is **not** a deployed function. Under the forced overlap, the old controller is denied after the Admin commits, the newly assigned controller can act/replay, and the old controller cannot read the cached result. The real source staging function separately rejects active changes.

**Bounded lock sequence tested:** E → sorted P → private request ledger L → selected inventory item I → association grant G → reaction W → original timed-effect X/HP processing in the already-tested individual attack path. **No global safety certificate**: other Admin/resource/grant/crafting writers may acquire G or I before E; locking may create new inversions. No coordinated migration, trigger cutoff, runtime audit or production grant changes were performed.

## Successful real signed-in cases

| Case | Disposition in disposable CI |
| --- | --- |
| 142 | Five independent GoTrue JWTs; actor controller lacks inventory/sheet-edit grants |
| 143 | **Expected unsafe baseline:** prior I-only guard accepts attack during Admin's uncommitted G-row revocation |
| 144 | Opt-in G-row lock extension loaded after baseline; original source stays separately snapshotted |
| 145 | G-locked candidate waits for signed-in Admin commit and denies revoked item with no mutation |
| 146 | Exact original Admin staging RPC rejects active combat reassignment |
| 147 | Explicitly modeled active Admin E/P reassignment makes old controller's concurrent attack fail |
| 148 | New controller acts/replays; old controller denied cached-result access |
| 149 | R2 modeled: owner `can_inventory` revoked after a successful attack blocks later cached private weapon result |
| 150 | Source-like characters/sheet RLS hides a hidden NPC sheet from outsider and combat-only controller; associated inventory manager and GM see it |
| 151 | **OWNER PRIVACY DECISION REQUIRED:** an unrelated signed-in user reads a synthetic **visible NPC's full sheet** under the deployed policy predicates |
| 152 | Source-like raw inventory RLS restricts item rows to the item owner or Admin, not combat controller |
| 153 | Source-like permission-row RLS shows own grants/Admin, not unrelated user's grants |
| 154 | Signed-in outsider's unauthorized UPDATE of another user's grant touches zero rows |
| 155 | Non-Admin denied by original staging and modeled active Admin reassignment; anon attack denied |
| 156 | G-locked concurrent same-UUID attack returns one result and spends one reaction |

**CI correction transparency:** [initial 41707301770](https://github.com/bob8675309/DNDNEXT/actions/runs/41707301770) failed before first race because a scratch trigger referenced a helper intentionally unexecutable by JWT clients; fixed the trigger to use literal **synthetic UUIDs**. [Run 41708726512](https://github.com/bob8675309/DNDNEXT/actions/runs/41708726512) passed cases 142–149, then revealed the scratch RLS helper EXECUTE grant was too restrictive versus production. The exact live authenticated helper EXECUTE grant was restored **only in disposable CI**. [Final 41709639824](https://github.com/bob8675309/DNDNEXT/actions/runs/41709639824) passed all 15 cases. Neither correction widens production privilege or changes the attack candidate's authorization rules.

## Mandatory unresolved decisions and limits

1. **Visible NPC full-sheet privacy is undecided.** Case 151 reproduces authorization implied by existing RLS with synthetic rows. This is **not** proof that live players have viewed secret sheets, nor a finding that visibility must be restricted without owner policy. The owner must choose between full sheet visibility and approved player-safe summaries; then design server-sanitized views with exact table/RLS acceptance as appropriate. Do **not** alter live RLS without authorization.
2. **Active controller reassignment remains research-only.** The deployed staging writer refuses active changes and locks P before E. The test-only active writer was crafted E-first for contention; no equivalent production API, trigger, or grant is approved. Owner R1/R2 are approved as security requirements, not deployed.
3. **Global E/P/L/I/G/W/X/S/C admission and lock graph remains unproven.** Tests cover two forced barriers, not all grant mutations, replay paths, inventory effects, Admin activation/resume, spell slots or historical requests. In particular, I→G in the model could invert a different G→I writer; no general deadlock-free guarantee.
4. **Concealed event timing** and first-execution viewer projection remain separate open requirements. Owner prefers the neutral label `Unknown Events`, but when/how it appears is not settled.
5. P1.5 TC1 Option A admission remains approved **but undeployed**; R3 service principal policy remains **open**. Production legacy direct RPC grants are unchanged.

**Next single P1.3 task:** Build the global inventory/permission/resource writer lock graph, specifically find any live G→I or I→G side effects from equipment, crafting, trade and level-up paths; source-test cross-class schedules in disposable PG before selecting a universal canonical order. In parallel, obtain owner decision on full visible NPC sheet vs safe player-facing summary; do not alter production policy prematurely.

**Owner manual test:** None required, all JWTs and rows were disposable.
