# C34 T40 — source-original Rage standalone Sheet action, linked legacy account mirror and independent Rest dependency

**2026-11-18 CST.** HELD [draft PR #379](https://github.com/bob8675309/DNDNEXT/pull/379). This dossier records source custody, real current UI callers, and **read-only deployed function-metadata verification**. The executable T40 signed-local run on `ce62cfe8bc3f2173f7a9c7868e0301e462d176a2` is **IN PROGRESS**, NOT yet an accepted PostgreSQL RED/GREEN. No production SQL, hosted row writes, original application component, protected world-map, deployment, paid agents, merge, or original PR branches changed. The hourly autonomous development agent remains PAUSED.

## Original SQL and actual deployed metadata

- The original standalone action migration `sql/20260802_02_character_sheet_feature_actions.sql`, exact Git blob **`a7e432a0f6be939f038a7926f81e9b81e36a903b`**, defines source `public.update_character_sheet_action_state_v1(uuid,text,text)` (SECURITY DEFINER) for a persistent **Barbarian Rage** toggle, NOT tactical/encounter state. It checks `private.can_manage_character_progression_v1(p_character_id)`, allows only `activate` / `deactivate` / `reset`, reads and locks the target canonical `character_sheets` row, computes maximum and remaining Rage uses, and changes `sheet.actionState.rage` for **one specific `character_id`**.
- The source-original function then replaces **every linked editing user's entire legacy account snapshot**, even when the existing `players.sheet` belongs to another character:
  ```sql
  update public.players p
  set sheet=v_sheet,updated_at=now()
  where p.user_id in (
    select cp.user_id
    from public.character_permissions cp
    where cp.character_id=p_character_id and cp.can_edit
  );
  ```
  This is a **source-proven overbroad account-level update**, distinct from T39 Weapon Mastery and previously signed I1/I2 legacy writer studies.
- **Production metadata, read-only SELECT only:** DnDWeb Supabase PG17 `pg_proc` reports this exact deployed action signature with `md5(pg_get_functiondef)` **`313a533250724b2e2abc754899d0f8d4`**; authenticated users have `EXECUTE`, anonymous users do not. A read-only `regexp_match` scan of `pg_get_functiondef` confirmed its compiled body contains both the `UPDATE public.character_sheets` and the `UPDATE public.players p SET sheet=v_sheet` linked to `cp.character_id=p_character_id AND cp.can_edit`. **No real player record, Sheet value or live mutation was queried**, and this does NOT prove any actual player has experienced an overwrite.

## Real current application consumer chain

- `pages/npcs.js` directly mounts `useNpcSheetActionData`, passing `canCommand: !!isAdmin || !!charPerm?.can_edit` and the selected character's `onActionCommand`; this is a genuine current Pages Router NPC Sheet, not merely an unused SQL function.
- `hooks/useNpcSheetActionData.js` calls `supabase.rpc("update_character_sheet_action_state_v1",{p_character_id:activeId,p_action_key:action.actionKey,p_operation:operation})`; its guards reject delayed selection changes via `requestRef` and `activeIdRef`; on success it applies the returned `data.sheet` to the selected character.
- `components/NpcPanel.js` independently calls the same RPC from the NPC Profile Sheet panel using `npcId`, and displays current remaining uses. Existing source/click behavior must be preserved; **none of these application files is altered by T40**.
- Client `canCommand` is UX gating only. Real actor authorization must remain server-side in original `private.can_manage_character_progression_v1` plus the `character_permissions` row; authenticated function EXECUTE alone does NOT grant permission to edit arbitrary characters.

## Separate, coupled original Rest writer — NOT closed by an action-only patch

- Migration `sql/20260810_90_rest_class_feature_restoration.sql`, exact Git blob **`2bd48d73398a3e9095b61ee288c0377d464edfc6`**, defines private `restore_character_rest_action_state_v1(uuid,text)`; its source also writes scoped canonical Rage state then mirrors the **entire** Sheet to every linked `cp.can_edit` account. It is called from `public.complete_character_rest_v1(uuid,text)`. XPHB Barbarian Rage restores one use on Short Rest and all on Long Rest; PHB Rage restores on Long Rest only. Independent role/cadence/encounter and tactical separation must remain intact.
- **Read-only deployed metadata confirms the REST path is live:** private helper `md5(pg_get_functiondef)` **`d75edf2ac583e3790882155c702e2165`** with broad account mirror, callable by neither `anon` nor `authenticated` directly; deployed `public.complete_character_rest_v1(uuid,text)` MD5 **`fffbf0705d640a7d2bfb08aa78ad521a`** invokes that helper and is EXECUTABLE by authenticated, not anon. This establishes **two distinct deployed function paths** that must be reconciled before release. It is not evidence of production data damage.
- The T40 action Option A candidate does **not** update or replace the private Rest helper, the public complete-rest RPC, or the original source migrations; thus **a fully safe Rage / Rest UX is NOT claimed** even if T40 action signed RED/GREEN ultimately passes.

## Tests, provenance and gated acceptance

- `scripts/integration/c34/test_t40_rage_action_legacy_mirror_source.mjs` pins both original Git blobs, source role/target/Rage/uses contracts, the true NPC Sheet and Profile caller chain, the **separate Rest dependency**, and tamper negatives. [T40 source-only workflow #44422742130](https://github.com/bob8675309/DNDNEXT/actions/runs/44422742130) succeeded on executable `ce62cfe8bc3f2173f7a9c7868e0301e462d176a2`; all 7 new T40 source tests and inherited source checks passed.
- `scripts/integration/c34/test_t40_rage_action_signed_pg17.mjs` is wired at the end of existing full source-pinned signed PG17/GoTrue/PostgREST/Next/Chromium workflow [#44422742187](https://github.com/bob8675309/DNDNEXT/actions/runs/44422742187). It installs exact ORIGINAL action SQL in the disposable DB, uses signed GM, linked editor, independent player accounts and two synthetic NPC Barbarian character Sheets with distinct account history, and should reproduce original RED against the two historical linked accounts without touching another canonical character. It then installs a **distinct, explicitly NON-ORIGINAL** one-clause candidate (removes ONLY the complete account-wide legacy update) inside the disposable DB and checks signed GREEN through activate/deactivate/zero-use/reset, denial, role revocation and independent canonical/account preservation.
- **At time of writing, signed run is still running; T40 original RED and Option A GREEN must be verified from exact Actions job logs before research acceptance.** Source test success, observed deployed code, or a synthetic candidate alone are not acceptance. If signed run fails, retain the failure reason and distinguish test defect from original defect.
- Remain careful that this fixture is a **source-shaped synthetic Barbarian Rage account test** and is not mounted actual UI click automation, complete gameplay/campaign integration, live historical-account migration or a verified fix to the original Rest writer. Do not reduce the current global **22/34 legacy writer release gate** until all original writer/reader and full actor/role contracts are reconciled.

**One next bounded task after T40 signed acceptance:** handle the distinct original `private.restore_character_rest_action_state_v1` under the true signed `public.complete_character_rest_v1` local-auth path, retaining XPHB-vs-PHB rest rules and existing original spell-slot/rest/tactical guards, then demonstrate its independent historical linked-account RED and an explicitly scoped candidate GREEN. Continue to HOLD any production or main release for independent encrypted PG17 restore, all **340 Storage objects**, full original PR and Sheet writer compatibility, and explicit owner go/no-go.
