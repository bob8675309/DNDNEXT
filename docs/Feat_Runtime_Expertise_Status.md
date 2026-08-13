# Feat Runtime Expertise Status

Status date: 2026-08-09
PR: #170 (`agent/character-forge-resilience-presentation`)
Live migration: 71

## Scope

This ledger is the controlling evidence for the source-correct split between permanent feat acquisition and Long-Rest Expertise runtime for:

- RHW **Echoing Soul**
- FRHoF **Zhentarim Tactics**

Combat/action benefits such as Intrusive Echoes and Retaliate are deliberately outside this slice.

## Echoing Soul acquisition correction

The imported Echoing Soul metadata under-counted its permanent acquisition benefits.

Migration 71 corrects the normalized catalog row to:

- two skill proficiencies (`skillProficiencies: [{any:2}]`);
- one additional language (`languageProficiencies: [{any:1}]`);
- one proficient-skill Expertise choice (`expertise: [{anyProficientSkill:1}]`).

The Player Forge choice normalizer now presents:

1. exactly two permanent skill choices;
2. one additional language from the Player's Handbook language tables;
3. one `runtime-expertise` choice using a skill the character is already proficient in or receives from the two new skill grants.

`runtime-expertise` is intentionally a new child kind. The existing generic `expertise` kind remains owned by Skill Expert, and `damage-type` remains owned by Elemental Adept.

The PHB additional-language catalogue contains 18 choices. Common itself is omitted because player characters already know it and therefore it cannot satisfy an additional-language grant.

## Echoing Soul runtime Expertise

Each normalized Echoing Soul feat instance owns one runtime row:

`echoing-soul-expertise:<instance hash>`

At acquisition, the feat-instance trigger:

- validates exactly two distinct skill choices;
- applies those permanent skill proficiencies to the character sheet;
- validates and appends exactly one additional PHB language;
- validates one initial Expertise choice against the character's now-effective skill proficiencies;
- materializes the initial runtime Expertise state.

The initial Expertise persists across Long Rests.

A newer canonical `long_rest` permits replacing the current Expertise with another currently proficient skill. Runtime replacement does not rewrite the feat's permanent skill/language choices or the normalized acquisition `choices` JSON.

## Zhentarim Tactics runtime Expertise

Zhentarim Tactics does **not** grant Expertise when the feat is acquired.

After a Long Rest completed after feat acquisition, the character may choose one currently proficient skill for Expertise.

That runtime state uses:

`zhentarim-tactics-expertise:<instance hash>`

The Expertise lasts until the next Long Rest. Migration 71 adds a rest-log trigger that removes the Zhentarim runtime row when the next `long_rest` is recorded, then refreshes the sheet runtime projection.

The newly completed Long Rest immediately opens a fresh Expertise choice.

## Effective proficiency boundary

The server's runtime Expertise picker uses the existing preferred 18-skill catalogue and checks effective character proficiency.

Permanent sheet proficiency counts normally. Current temporary skill proficiency from these existing runtime families may also qualify:

- Astral Trance
- Githyanki Astral Knowledge
- Khoravar Skill Versatility

The character-sheet projection remains non-destructive. `projectCharacterSheetRuntimeProficiencies` applies runtime Expertise only when the skill is still effectively proficient. Expertise never creates proficiency by itself.

This is important when a temporary proficiency that originally qualified an Expertise choice later expires.

## Sheet/runtime projection

Current per-feat Expertise state is projected under:

`sheet.runtimeProficiencies.featExpertise`

The derived sheet can mark the selected skill as Expertise for display/calculation, but stored permanent `proficiencies.skills` and `expertiseSkills` are not rewritten by later runtime changes.

## UI

`CharacterFeatRuntimeExpertisePanel` is mounted through the existing character-sheet runtime host beside the Boon runtime panel.

It uses:

- `get_character_feat_runtime_expertise_v1`
- `configure_character_feat_runtime_expertise_v1`

The panel shows the current per-instance Expertise state and follows the distinct source cadences:

- Echoing Soul: persistent current choice; newer Long Rest opens replacement.
- Zhentarim Tactics: no acquisition choice; Long Rest opens selection; next Long Rest expires it.

The database remains final authority for skill eligibility, rest timing, feat-instance ownership, and active-encounter locking.

## ACL / protected boundaries

Both public runtime Expertise RPCs explicitly revoke anonymous execute and grant authenticated/service-role execution only.

Private helpers/triggers are service-role-only.

This slice does not:

- create or modify inventory;
- change account wallets;
- update encounter participant state;
- implement Intrusive Echoes or Retaliate actions;
- change world-map, route, travel, or weather systems.

## Validation gates

Before deployment:

- migration 71 compiled against the live Supabase schema inside an explicit rollback transaction;
- the compile verified Echoing metadata becomes two skills, 18 PHB additional-language options, both public RPCs, and both acquisition/rest triggers;
- the dedicated feat-runtime Expertise semantic validator passed;
- unified Forge validation passed;
- character progression v3 validation passed;
- the dedicated production `build:vercel` gate passed;
- every shared Character Forge/runtime regression completed successfully on the deployment head.

## Live rollback proofs

### Echoing Soul

A synthetic Echoing Soul grant selected:

- Arcana + Stealth as permanent skill proficiencies;
- Sylvan as the permanent additional language;
- Arcana as initial Expertise.

Verified:

- both permanent skill proficiencies were applied;
- Sylvan was appended;
- Arcana runtime Expertise materialized;
- sheet runtime projection matched;
- an unproficient skill was rejected;
- replacement before a newer Long Rest was rejected;
- real `complete_character_rest_v1(...,'long_rest')` unlocked replacement;
- replacement to Stealth succeeded;
- permanent skills/language remained unchanged;
- normalized acquisition choices remained unchanged;
- a second replacement on the same Long Rest was rejected.

### Zhentarim Tactics

A synthetic grant began with permanent Athletics + Stealth proficiency.

Verified:

- no Expertise existed at acquisition;
- configuration before a Long Rest was rejected;
- first Long Rest opened a choice;
- Stealth Expertise materialized;
- mid-cycle replacement was rejected;
- an unproficient skill was rejected;
- permanent skill proficiency and permanent `expertiseSkills` remained unchanged;
- the next Long Rest automatically removed the runtime row and sheet projection;
- that same rest cycle opened a new choice;
- Athletics Expertise then materialized successfully.

All fixtures rolled back.

## Final production integrity

After all rollback fixtures:

- migration 71 registered;
- 0 live Echoing Soul runtime rows;
- 0 live Zhentarim Tactics runtime rows;
- 0 live Echoing Soul grant-instance QA rows;
- 0 live Zhentarim Tactics grant-instance QA rows;
- 0 synthetic Expertise characters;
- 7 characters;
- 7 character sheets;
- 30 character-spell rows;
- 7 progression rows;
- 18 inventory rows;
- 20 locations;
- 4 routes;
- 9 route points.

## Status

Echoing Soul permanent acquisition correction + Long-Rest-replaceable Expertise and Zhentarim Tactics post-rest/expiring Expertise are **live and rollback-proven** through migration 71.

Next source-choice runtime audit should continue with Cartomancer Hidden Ace and then the remaining class/subclass runtime families that the Forge parser already excludes from permanent choice authority.
