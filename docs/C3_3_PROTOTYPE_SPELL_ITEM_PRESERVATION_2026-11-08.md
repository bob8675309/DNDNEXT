# DNDNext prototype: spell, item and recipe preservation contract (2026-11-08)

## Owner direction / risk classification

**Owner-confirmed on 2026-11-08:** The website is a **prototype**, **no one is playing**, and existing characters, NPCs and locations are **development/test content**. Crucially, **spells and items must not be deleted**. This replaces any assumption that the existing characters or locations contain active player campaign progress; it does **not** authorize a blind database reset, character/user deletion, world-map change, or loss of dependent spell and item records. Test character/location edits may be lower-risk, but preserve their current rows by default unless specific cleanup is subsequently approved.

**Hard preservation rule:** no `DROP TABLE`, `TRUNCATE`, `DELETE`, `CASCADE`, bulk reseed/overwrite, storage deletion, or database reset affecting original **spell data, item data, inventories, merchant stock, recipes, crafting/alchemy definitions, spell/action assignments, or related image/asset files**. A reviewed inventory **CHECK constraint** replacement is not a row deletion, but must retain all rows and RLS; it requires explicit owner-gated schema cutover.

## Read-only live DnDWeb PG17.4 baseline (2026-11-08)

Connected project `DnDWeb`, project ref `ucggczovhmauhshvhusx`. Exact aggregate query only; no user, character, item or spell content was exported. These are **point-in-time counts**, not an unconditional guarantee that legitimate development operations will never update data.

| Database table | Rows | Content digest where collected |
|---|---:|---|
| `private.character_spell_mastery` | 0 | not taken |
| `public.ai_item_images` | 0 | not taken |
| `public.alchemy_enhancer_effects` | 15 | not taken |
| `public.alchemy_reagent_families` | 18 | not taken |
| `public.alchemy_recipe_options` | 21 | `1f283ecbfb8030c711359a9f8cd7a2e8` |
| `public.campaign_item_pool_settings` | 1 | not taken |
| `public.character_spell_slots` | 5 | not taken |
| `public.character_spells` | 36 | `11074e631a14141b4f9f3f2e5a50948e` |
| `public.character_stock` | 240 | `9af01019339ea0e709f5c0f7f0ad4a06` |
| `public.craft_plans` | 10 | not taken |
| `public.crafting_attempts` | 21 | not taken |
| `public.crafting_material_effects` | 14 | not taken |
| `public.crafting_recipe_rules` | 48 | `1fb87b988a144244bd61a0422813367b` |
| `public.encounter_spell_slots` | 11 | not taken |
| `public.inventory_items` | 23 | `bbfd19f4a01e5c7d37bc3b32ab9f0ea1` |
| `public.items_catalog` | 2,739 | `c15bb65a6a40335fe19eb7a0f9ca7f33` |
| `public.npc_known_recipes` | 0 | not taken |
| `public.player_recipes` | 0 | not taken |
| `public.recipes` | 132 | `5e8c0bf8ab910cf842c4050be5fb8e31` |
| `public.spell_effects` | 1,037 | `cdbbde19b9f0f97d5f354dc8dda2ed13` |
| `public.spells_catalog` | 1,037 | `2d5b951f16ba167ca647ddd4bd5253f7` |

Content digest algorithm: `md5(coalesce(string_agg(md5(to_jsonb(row)::text),'' ORDER BY md5(to_jsonb(row)::text)),''))`. It compares entire logical rows independent of row order; it is an **integrity signal, not a backup**, and it can change due to expected item/spell edits. Collect a fresh snapshot immediately before and after any owner-approved database migration, compare **unchanged catalogs exactly**, and separately reconcile any intentional additions to player inventory/stock/spell assignments. The original 2026-11-08 snapshot also had **0** `owner_type='character'` inventory rows and **7** nonempty historical GM secrets; both are aggregate-only facts. Do not infer those characters or secrets are disposable solely from the prototype status.

## Deletion dependency traps confirmed by live foreign-key metadata

- `public.character_spells.character_id`, `public.character_spell_slots.character_id`, and `public.character_stock.character_id` reference `public.characters` **ON DELETE CASCADE**. Removing development NPCs/characters can silently remove their spells, spell slots, and merchant items.
- `public.inventory_items.user_id` references `auth.users` **ON DELETE CASCADE**. Deleting development Auth accounts can destroy inventory records even when there are no real players.
- `public.spell_effects.spell_id` and `public.character_spells.spell_id` reference `public.spells_catalog` **ON DELETE CASCADE**. Replacing spell catalog rows with `DELETE + INSERT` would delete associated effects/assignments. Preserve spell IDs and original catalog rows.
- Additional recipes/stock/portrait/storage relations may have indirect dependencies. This list documents **confirmed examples**, not an exhaustive proof that every indirect dependency was scanned.
- Do **not** delete character/user rows as a shortcut to clean tests. Use isolated disposable PG17/GoTrue/PostgREST fixtures, and maintain existing database tables/records until a reviewed, data-preserving alternative is designed.

## Prototype-friendly C3.3 release gate (less ceremony, same core safety)

Because no players are currently using the system, a brief planned development interruption and compatibility cutover may be acceptable. We need not certify production-scale traffic or player downtime, and the owner may later explicitly accept some untested development-only character/location edge cases. **However, source-derived spells/items/inventory data must remain intact, permission/secret leaks must fail closed, and the new client still must be deployed together with the missing RPCs.**

1. Verify exact Git SHA, branch and connected DnDWeb project. Obtain verified database backup/snapshot with restore procedure (including protected tables and Supabase Storage assets where relevant). The current row counts/digests are *not* a backup.
2. Before any schema change, obtain fresh counts + digests using the **SELECT-only** preservation script `scripts/diagnostics/c33_prototype_spell_item_preservation_readonly.sql`. Fail release if a protected object is missing or unexpectedly changed; reconcile known dev additions separately.
3. Verify coordinated NPC stage1–3 privacy and inventory CHECK/**four RLS policy** SQL, original signed Forge and Profile role negatives, GM secret and creator-private Story boundaries; rehearse transaction abort **already proven C3R01–05**. Do not drop the owner CHECK alone or temporarily permit unrestricted direct inventory DML.
4. Prepare a **single reviewed migration** or controlled maintenance strategy; the four candidate files' individual `BEGIN/COMMIT` statements are research form, not an atomic installer. Stage SQL RPCs and compatible UI under planned short downtime, preserving prior working UI for rollback; no client cutover against missing RPCs.
5. Perform actual read-only before/after preserved-data comparison; no reductions of original spell/item/recipe rows and no unexplained hash changes to static catalogs, merchant stock or personal inventory. Repeat signed role tests and original Forge creation/gear materialization. If any data loss appears, hold rollout and restore from verified backup—do not reseed spells or items from placeholders.
6. **Ask owner before merging/pushing `main`, executing live SQL, or deploying Vercel.** The owner authorized proactive prototype development, **not** automatic merge or catalog destruction. PR #345 remains draft at this receipt.

## Evidence and limitations

- [Local source-original Forge/NPC precommit rollback run #42491214807](https://github.com/bob8675309/DNDNEXT/actions/runs/42491214807) successfully exercised C3R01–05 and original non-map C3M01; [25/25 checks at code head `fd1b9c0b9d3f3e8aeb44bfbdd237ca11c9adfe28`](https://github.com/bob8675309/DNDNEXT/commit/fd1b9c0b9d3f3e8aeb44bfbdd237ca11c9adfe28/checks). **No live DDL/DML was executed** in the evidence collection; only metadata, aggregate counts and content digests were queried.
- **20/31 distinct original creation-adjacent triggers** have been source-tested across suites. Two untested original triggers concern world-map movement and are intentionally not touched. Production-complete 31-trigger fidelity and a post-commit data-restoring downgrade remain separate risk items; do not claim them from a pre-commit ROLLBACK.
- **Next bounded work:** prioritize the remaining non-map Forge triggers based on real spell/item integrity risk, reproduce relevant cases with original source and signed disposable tests, and assemble the short, owner-reviewable prototype migration/backup checklist. Request owner approval at the point merging or live cutover actually becomes advisable.
