# Character magic-effect source gate — private real-inventory shadow (2026-10-25)

**Status: draft, additive, read-only, not wired to any gameplay consumers.** Builds on the corrected physical-versus-magical contribution contract in PR #273.

## Verified source inputs

`private.character_magic_effect_source_gate_shadow_v1(uuid)` queries the actual existing inventory schema and optional attunement settings/selection schema from the stacked draft migrations, rather than accepting browser-provided inventory lists or client-selected item IDs. It uses the same player account/editable-character and directly owned NPC/character/merchant inventory expansion as the legacy equipment resolver, and only includes **equipped** inventory rows.

Each row returns the exact inventory UUID, whether it is equipped, whether magic source provenance is verified under the current `private.optional_rest_item_is_magic_v1` checks, whether this character selected it, whether another character claimed it, whether player-account custody is ambiguous, and a separate **magic rider eligibility** flag. The function itself does **not** assert that physical shielding/armor is valid for an arbitrary slot; that remains with the specialized equipment authority.

When campaign attunement is **OFF**, `magicRiderEligible=true` for each currently equipped source, preserving prior selected-bond-independent legacy source eligibility. When **ON**, an item with a non-mundane rarity can contribute magical riders only with source verification and its own character's exact selected inventory ID. Mundane physical items are not gated. Unverified or already claimed magic sources do not receive magical rider eligibility.

**Caveat:** Non-mundane rarity is an initial conservative candidate filter, **not final D&D magic/attunement classification**. `common` is potentially ambiguous and source-specific exceptions are not implemented. The selection helper's exact-key VAR card match remains provisional pending trusted provenance. The function must not silently invent new magic eligibility.

## Multi-character inventory limitation

Player inventory is account-scoped in live DnDWeb; the checked account with player items has multiple editable characters. The projection reports `accountScopeAmbiguous=true` on such entries, rather than claiming a shield or weapon physically belongs to only one character. The one-character unique magic-item selection claim prevents a magic rider from being selected simultaneously for two characters, but it **does not resolve the legacy shared-account physical equip projection**. No existing player inventory rows or gear slots are mutated.

## Security and validation

- `private`-schema function, fixed search path, `SECURITY DEFINER` restricted by explicit REVOKE/GRANT to `service_role`; not a public/browser RPC. Its body validates character existence and settings availability.
- Read-only `STABLE` projection. No `UPDATE`, `INSERT`, `DELETE`, active encounter mutation, or consumer monkey patching.
- Isolated PostgreSQL16 workflow first runs the already existing OFF/ON admin and selection behavior fixtures, then creates this private projection and tests actual seeded inventory custody, false/true campaign state, verified and unverified magic sources, one-character selection for an account-shared item, denial for another character, a mundane rapier staying eligible, foreign character source isolation, and private ACL.

## Required before player-facing enforcement

Integrate the catalogue+instance effect parser and field-level physical/magical split with the existing `private.character_equipment_effects_v1` and tactical damage mitigation, then test full numeric/spell/weapon/condition source parity. In particular, tactical resistance and flat DR must preserve Resistance → DR → Vulnerability. Character/actor-specific equipment custody, character-choice cadence, and signed-in browser/encounter QA remain blockers. `consumerEnforced=false` is deliberate and Admin Dashboard `effects_enforced` and `selection_ready` stay false. No production migration or merge is authorized by this ledger alone.

Protected systems: world/town maps, character Forge, item art/ItemCard styles, equipment slot placement and live campaign state.
