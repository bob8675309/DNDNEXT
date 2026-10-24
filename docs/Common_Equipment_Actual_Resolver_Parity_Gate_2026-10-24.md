# Actual equipment resolver parity gate — October 24, 2026

This branch is based on draft PR #251 and adds **test-only** coverage; it does not modify runtime, deploy schema, or merge PRs #250–252.

The isolated PostgreSQL job builds the repository's actual legacy `private.character_equipment_effects_v1` SQL function and supplies synthetic, owner-scoped inventory rows with catalog payloads. The result is passed into the proposed `private.normalize_equipment_bonus_effects_v1` and `private.resolve_effect_bundle_v1`; assertions check save bonuses (all + individual), Athletics/Acrobatics, and initiative. Further legacy assertions cover catalog-only keys, equipped versus unequipped, foreign ownership, instance payload override precedence, multiple equipped instances, light/medium/heavy armor and shield, negative Dexterity and invalid armor equip slot.

The *existing* resolver is authoritative for AC. **AC is intentionally not fed to the common adapter**, which cannot represent armor formula parity; no source-aware 5e duplicate magic item stacking rules are inferred. This test does not establish full live-character parity, proficiency/class mechanics, spell attack/Spell Save DC, immunities, resistance, tactical weapon hit/damage, rest/encounter lifecycle, alternate AC or unarmored defense.

Run in an isolated PostgreSQL 16 environment via the PR workflow; a green run is needed before claiming that end-to-end tests pass. No production Supabase data is copied or changed.
