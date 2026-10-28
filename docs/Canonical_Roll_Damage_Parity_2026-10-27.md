# Canonical Roll and Damage Helper Parity — 2026-10-27

**Draft #294 (stacked on #293). NO production SQL, API exposure, equipment/Forge/map/encounter UI changes.** This stage upgrades isolated validation of the unconnected atomic weapon Attack candidate.

## Source audit against actual live Supabase (read only)

The current *production* implementation differs materially from the older July attack/damage migration and the deterministic #293 test doubles.

- **Roll:** `private.encounter_resolve_attack_roll_v1(uuid,uuid,boolean)` has two independently consumable one-shot effects: `guiding_bolt_next_attack_advantage` (on the target) and `vicious_mockery_next_attack_disadvantage` (on the attacker). It removes the rows and writes `effect_consumed` logs. If both apply, Advantage and Disadvantage cancel and only one d20 is rolled. Without cancellation, the helper rolls two and selects higher/lower accordingly. Live `pg_get_functiondef` fingerprint: `25af82e66a082a36e8105bad0187b271`. Source: `sql/20260730_02_tactical_vicious_mockery.sql`.
- **Equipment mitigation:** `private.encounter_equipped_damage_mitigation_v1(uuid,text)` reads structured equipped inventory/catalogue entries (not item prose), returns equipment resistance, the **highest** matching flat typed reduction (not the sum) and sources. Live source fingerprint: `b64c9f5935485eb7dde661acd1582a97`. Source: `sql/20261016_07_equipped_item_damage_mitigation.sql`. **Important legacy physical-source caveat:** its equipment reader can include account-shared equipped items via `character_permissions`, which does not establish exclusive character custody for proposed hand/attunement benefits. No such claim is made here.
- **Damage:** `public.encounter_apply_damage_internal_v1(uuid,integer,text)` uses immunity first, then **Resistance (floor half) → flat typed reduction → vulnerability → temporary HP → HP**. The result includes `equipmentResistance`, `damageAfterResistance`, `flatReductionAvailable`, `flatReductionApplied`, `damageAfterFlatReduction`, `mitigationSources`, and final damage/HP. Live fingerprint: `53afa5d760a7b6c1a4cc3f837bc7e067`. Source: `sql/20261016_08_resistance_before_flat_reduction.sql` (overrides older `_07` order).

The previous source-contract checks anchored to `sql/20260729_03_tactical_attack_roll_modifiers.sql` and `sql/20260727_09_los_cover_saves_damage.sql`, which were not the *final* live helper implementations. The authoritative source for this regression stage is the latest versioned migrations above.

## Code change: preserve full helper evidence

In the still-private, service-role-only `sql/20261027_03_attack_action_atomic_weapon_candidate.sql`, the saved event result now includes `viciousMockeryDisadvantage`, `viciousMockeryEffectConsumed`, and a complete `damageMitigation` JSON object copied from the actual shared damage helper. Existing fields and unchanged legacy public attack/unarmed/opportunity RPCs are preserved.

This is **not** new gameplay enforcement: the candidate remains unconnected to the battleboard, and the trusted service-caller/user-identity protocol from #293 is still unresolved.

## PG16 verification — original helper bodies, not simplified doubles

`scripts/fixtures/canonical_live_roll_damage_helpers_pg16.sql` contains direct copies of the versioned production-source function bodies for the three helpers, installed **only after** the complete #293 disposable fixture finishes. A Node validator ensures that these copies stay byte-identical to their respective migration function definitions, so future source changes invalidate the suite rather than silently testing stale approximations.

`scripts/fixtures/canonical_roll_damage_parity_candidate.sql` checks:
- 31 Fire raw, equipment resistance, flat 10 and Fire vulnerability: 31 → 15 → 5 → 10, then temp HP 4, HP 100 → 94;
- multiple flat-damage sources choose highest 10 rather than 10+3, damage 5 consumes 4 temp HP and 1 HP;
- small resisted damage fully reduced by flat; immunity zeroes damage and preserves temp HP; unequipped items stop granting mitigation;
- Guiding Bolt and Vicious Mockery each consumed **exactly once**, their effects cancel when combined, the subsequent roll gets neither effect, and advantage-only/disadvantage-only rolls select the appropriate d20;
- explicit PostgreSQL savepoint failure after rolling and damaging restores both one-shot effects, HP and effect-consumption log records;
- actual helper calls **through the #293 atomic Attack candidate** save both effects in the event result, preserve the full damage mitigation object, spend the Action once, and return identical saved request results without reroll, effect/log duplication or second attack consuming the one-shot effects.

The fixture still uses a **synthetic targeting/cover-return stub**, not the complete live map LOS graph, and it does not simulate all classes, shields, spells, movement, reactions, cross-user concurrent sessions, or signed-in browser calls. Random d20 tests assert range/ordering rather than assuming a hit, avoiding stochastic flakes.

## Outstanding release blockers

1. Confirm live `pg_get_functiondef` fingerprints before any subsequent release: updates to roll, mitigation or damage functions must trigger re-audit and new exact snapshots.
2. Resolve trusted end-user identity for service-only candidates, signed-in authorization, endpoint/feature-flag design and audit, no service-role credential in browser.
3. Verify real attack/action/turn transaction parity including concurrent actors, cross-encounter targets, Guiding Bolt/Vicious Mockery expiration and effect source, resistance combinations, target defeat and complete combat-log contract.
4. Integrate subclasses/multiclass/Action Surge and special attack substitutions, actual hand/weapon/Shield action interactions, optional attunement rest eligibility and per-item source effects.
5. Obtain explicit approval for production migration/merge. **All stacked PRs #267→#294 remain drafts**. Existing public attack, unarmed, spell and opportunity functions, world/town maps and Forge remain unchanged.

Current master: [Attunement_Effects_Integration_Current_Handoff_2026-10-26.md](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md).
