# Source-verified 2024 item attunement records — staged gate (2026-10-24)

**PR scope:** Draft stacked on #260 → #257. No production migration, catalogue data change, magic activation, Short Rest approval, direct UI permissions or sheet/tactical consumer switch.

## Authoritative reference and edition trap

The 2024 Basic Rules official list [Magic Items A–Z](https://www.dndbeyond.com/sources/dnd/br-2024/magic-items-a-z) explicitly labels **Ring of Protection**, **Cloak of Protection** and **Boots of Speed** as requiring attunement and **Staff of Power** as requiring attunement by **Sorcerer, Warlock or Wizard**. The live DnDWeb XDMG payloads for those first three do not have structured reqAttune flags, while Staff of Power already has class-tagged requirements. This is a source import gap, not an assumption of absence.

**Do not conflate editions:** The **2024 Ring of Resistance** is listed **without** attunement. The *2014 legacy* Ring of Fire Resistance required attunement; DNDNext's typed XDMG campaign Ring of Fire Resistance variants have special custom resistance/DR and rarity metadata. They are intentionally **not** mapped to either blanket rule. The existing canonical tactical Resistance-before-flat-DR pipeline must remain untouched; a verified source/edition mapping and campaign owner decision are required before allowing typed variant effects through the new shared engine.

### Importer trace — no unproven stripping claim

Repository review of `scripts/build-all-items.mjs` confirms `normalizeBase` preserves source fields, including `reqAttune: it.reqAttune ?? null`, and `scripts/seed_items_catalog.mjs` preserves preexisting structured payloads. Therefore the verified missing XDMG attunement flags **cannot be attributed to a demonstrated seeder stripping bug**. The gap may predate the builder in the imported source dataset, `_copy` resolution, or a generation/seeding path. Before implementing full-catalog normalization, compare the exact upstream 2024 item records, the resolved all-items JSON, and the seeded row at each stage. `scripts/lib/campaign_item_overrides.mjs` deliberately rewrites typed resistance rings to a campaign variant with Resistance then typed flat reduction; it does **not** set an attunement property. Preserve that campaign decision and request an explicit rule for the custom variant rather than inheriting an older edition's requirement.

## Scope of the fix

\`scripts/fixtures/verified_item_attunement_2024.json\` holds four **exact-key, cited, source-edition-bound positive attunement facts**. \`private.verified_item_attunement_rule_v1(text)\` is a private, read-only, immutable, **service_role-only** lookup. \`private.passive_equipment_source_gate_v1\` now consumes that verified metadata when the catalogue omits the requirement, and reports provenance plus a deliberate "source_metadata_conflict" if a structured explicit negative contradicts verified required state. Records not on the curated exact-key list remain unknown; the effect eligibility result is **always false**, even for correctly bonded gear.

This is deliberately **not** a global item rarity, ring-category, fuzzy name, inventory-payload or spell-rules inference. No change is made to \`items_catalog\`, deployed SQL, \`private.character_equipment_effects_v1\`, action economy, runtime spell/condition effects, or the earlier attunement bond **write command**. PR #257's bond command still needs its own source-correct requirement normalization and guarded Short Rest/class prerequisite workflow before merge.

## Test gates

- Node contract validates canonical exact-key mapping in SQL against the manifest (including class keys, source identity and private grants).
- Disposable PostgreSQL16 verifies three previously omitted items become \`required\` (without becoming eligible), Staff's class list remains intact, a bond alone remains insufficient, an explicit conflicting catalogue negative fails closed, owner/equipment rules remain enforced, and 2014 Fire Resistance variant names are not accidentally mapped to 2024 Ring of Resistance.
- Run existing #257/#260 fixture suites unchanged except updating previous Ring/Cloak expectations in the source gate fixtures.

## Remaining engineering work

1. Verify 2024 **negative/no-attunement** records (e.g. general Ring of Resistance), imported source aliases and **campaign** variants before expanding to the full catalogue; no blanket auto-correction.
2. Reconcile the **attunement write RPC** with verified source facts, Short Rest completion, class restrictions, creature status and release/transfer. Do not regard timestamps or a stored bond as proof of a qualifying completed Short Rest.
3. Integrate the vetted state into the common source adapter behind existing sheet/roll/tactical ACL checks, while preserving mundane armor/shields and source-defined stacking; record real-character and encounter parity.
4. Keep future AI tool read-only and permission-filtered; don't provide arbitrary SQL, effect data or rules authority to models.

See current [effects release gate](https://github.com/bob8675309/DNDNEXT/blob/docs/effects-readiness-gate-reconciliation-20261024/docs/Character_Effects_Release_Readiness_Gates_2026-10-24.md).
