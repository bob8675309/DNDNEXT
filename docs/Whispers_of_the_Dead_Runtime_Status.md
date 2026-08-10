# Whispers of the Dead Runtime — Status

Status: **deployed and rollback-accepted** on PR #170.

## Source authority

Whispers of the Dead is modeled for **PHB Rogue / TCE Phantom / level 3+**.

After finishing a qualifying Short Rest or Long Rest, the character may choose one skill or tool proficiency they currently lack. The borrowed proficiency **persists through later rests** until the feature is used again to choose a different proficiency. A later rest therefore unlocks an optional replacement; it does not expire the current benefit.

## Runtime authority

Migration 84: `whispers_of_the_dead_runtime` (`20260810001351`).

- runtime key: `rogue-phantom-whispers-of-the-dead`
- cadence: `short_or_long_rest`
- sheet projection: `runtimeFeatures.whispersOfTheDead`
- first selection requires a post-acquisition qualifying rest
- one selection/replacement per qualifying rest
- active encounter blocks configuration
- permanent skill/tool Training arrays are never rewritten
- candidate options exclude proficiencies already supplied by permanent sheet authority or active runtime proficiency overlays
- the previous borrowed proficiency becomes eligible again after replacement

`CharacterWhispersOfTheDeadPanel` is mounted in the always-reachable runtime chain and passes `characterId`, `p_kind`, and `p_name` explicitly.

## Acceptance

Rollback proof covered base Stealth, Thieves' Tools, and another active runtime proficiency; initial borrowed Acrobatics; exclusion of already-proficient options; persistence across a newer rest; replacement to a tool; re-eligibility of Acrobatics after replacement; same-rest/encounter guards; ACLs; unchanged permanent proficiency arrays; exact PHB/TCE gating; and zero residue.

Migration 89 classifies the first unlocked rest-backed choice as attention when no borrowed proficiency is active. Once configured, later rests expose Whispers only as an **optional persistent replacement**, so it does not falsely flash after every rest.

## Protected boundaries

No world-map, town/city-map, route/travel/weather, crafting/inventory, or tactical combat execution behavior is changed here.
