# Tactical Spellcasting Attunement — Profile and Focus Shadow (2026-10-26)

**Status:** Draft-only, private/read-only. No live spell profile, slot snapshots, casting RPCs, damage resolution or player/UI behavior changed.

## Actual tactical authority

`public.encounter_spellcasting_profile_v1(participant_id)` from `sql/20260727_12_tactical_spell_foundation.sql` produces caster class/progression, spell-slot snapshots, known spell assignments, casting ability score, modifier, proficiency, spell attack bonus and save DC. Its canonical math is `spellAttackBonus = floor((rawCharacterSheetScore - 10)/2) + proficiencyBonus` and `spellSaveDc = 8 + spellAttackBonus`. The function does **not** aggregate `bonusSpellAttack` or `bonusSpellSaveDc` from equipped magic items, and its baseline raw sheet ability may differ from the shared equipment effects resolver's ability score. Per-spell attack/save overrides are returned in `knownSpells`, not applied to the profile's aggregate casting attack or DC.

The player-sheet spell quick actions were audited separately in #281. They use the client-side action builder and can use a different casting-stat source; their tests do not prove tactical spellcasting parity.

## New comparison

`private.encounter_attuned_spellcasting_shadow_v1(participant_id)` calls the **unchanged** authoritative tactical profile and existing server-derived selected ability effects source. It never mutates slots, encounters, spell assignments, HP or the original profile.

- Optional attunement **OFF:** `shadow` and `baseline` are exactly the original tactical profile JSON, with no new numeric effects.
- Optional attunement **ON:** the shadow recomputes `castingAbilityScore`, `castingAbilityModifier`, `spellAttackBonus`, and `spellSaveDc` from the verified character/ability selection and the original profile's proficiency bonus, but retains `slotSnapshot`, `knownSpells`, source class, ruleset and all other original fields exactly.
- If original profile raw ability modifier differs from the canonical equipment effects baseline modifier, report `tactical_raw_vs_equipment_ability_baseline_diverges`. This is a real consumer discrepancy, not permission to silently rewrite the live profile.
- Numeric/manual per-assignment attack/DC overrides are preserved **verbatim** inside known spells and flagged `per_spell_override_origins_unverified`.

### Magic focus audit, not effect enforcement

Read-only Supabase catalogue inspection found separate `bonusSpellAttack` and `bonusSpellSaveDc` fields on class-dependent focus items. Examples include **+1 Rod of the Pact Keeper** (+1/+1, type RD) and **+1 Wand of the War Mage** (+1 attack only, type WD). Focuses also vary by class, spell category, and stacking/ruleset; equipping a focus is not sufficient proof that every spell receives its bonus.

The shadow scans only equipped item identities from the existing private per-character source gate and merges catalogue/instance payloads using the canonical key/edition priority. For each spell-bonus item, it reports the exact item UUID, raw fields, magic verification, selection by this character, exclusive shared-account claim and `appliedToShadow=false`. **No focus bonus is applied automatically**, even when selected. `focusBonusApplicabilityVerified=false`, `tacticalSpellParityReady=false`, `fullEffectConsumerParityReady=false` and `consumerEnforced=false` remain explicit.

## Isolated verification

PostgreSQL16 fixture composes existing provenance/character/equipment/weapon fixtures, then loads a byte-equivalent copy of the original tactical spellcasting profile and raw ability score helper. A source validator asserts both exact texts. The fixture checks OFF baseline equality, cantrip/spell assignment preservation, Warlock Pact slot remaining/max (2 max, 1 remaining), no-selection ON behavior, +4 CHA score from a selected Staff changing proposed attack +6→+8 and DC14→16, unselected/selected Rod +1 attack/DC audit without auto-applying it, a Wand +1 attack-only audit, unverified rare +9 bonus rejection, two eligible focuses never stacking automatically, account-shared focus excluded from another character, admin-only private EXECUTE grants, and authenticated participant control in the canonical profile.

## Blocking issues

1. Class-, item- and spell-specific focus rules; source provenance, valid equipment slots, attunement exceptions, stacking and crafted/VAR payloads must be established before applying `bonusSpellAttack` and `bonusSpellSaveDc`.
2. A canonical authoritative ability score/effective-modifier source must be agreed across tactical and player-sheet consumers and tested against active encounter snapshots. Do not rewrite an active encounter's slot snapshot.
3. Per-spell `saveDcOverride`/`attackBonusOverride` provenance needs a separate tactical **casting writer** audit; the profile merely lists these assignments.
4. Cantrips, slot spending, reactions, spell damage/resistance/conditions, concentration, class features and battleboard roll/log projections are distinct consumers.
5. Server-authorized rest change windows, player-account physical equipment custody, signed-in browser/multi-character QA and full common-effect integration (#251/#253/#255) still block merging.

This branch is stacked on draft #281 and ancestors. No world/town map, Forge, item card/equipment drag/drop, combat logs, player character sheet, or production Supabase mutation was performed.
