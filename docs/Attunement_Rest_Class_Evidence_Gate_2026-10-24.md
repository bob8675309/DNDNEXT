# Attunement class and focused-Short-Rest evidence gate (2026-10-24)

Status: STAGED ONLY. This PR stacks onto #261 → #260 → #257. No production deployment, gameplay mutation, rest RPC replacement, item bonds, or effect activation.

## Canonical rules and live implementation

The 2024 D&D Basic Rules require one Short Rest in physical contact with and focused exclusively on a single item, separate from a rest used to identify it. The Short Rest is one hour and cannot be interrupted. Sources: https://www.dndbeyond.com/sources/dnd/br-2024/equipment and https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary/.

The live DNDNext public.complete_character_rest_v1(uuid,text) records resource restoration in character_rest_log but has **no item focus/contact fields**. Read-only inspection found seven historical rest entries, none containing attunementFocus. Existing before-insert active-encounter rest guard remains intact. Canonical class identity is character_progression.class_id → class_catalog.id/class_key, not client-supplied display text.

## New internal read model

private.attunement_rest_class_evidence_v1(characterId,itemId) uses exact trusted item-key source facts from #261 and canonical class progression to report class prerequisite status. Staff of Power requires Sorcerer, Warlock or Wizard; Boots of Speed has no class prerequisite.

Generic logged rests, Long Rests, unqualified focus metadata, missing contact, interrupted rest, simultaneous item focus, or less than one full hour **never** prove attunement. The helper can recognize a narrowly specified future *server-authored* rest receipt in character_rest_log.details.attunementFocus, with a single item, contact, exclusive focus, separate identification and an uninterrupted hour. The current rest command **cannot produce this receipt**. Test rows are synthetic, inserted only into isolated PostgreSQL.

The helper returns attunementReady=false in every branch. It is SECURITY INVOKER, callable only by service_role; neither a browser command nor a replacement for authoritative rest/attunement controllers.

## Remaining release work

Implement a fully guarded server rest producer with deliberate GM/player verification of contact, duration, identification and interruption; ensure event-time and rollback parity with all existing rest triggers. Connect the #257 attunement bond writer to this trusted evidence, source-specific class prerequisites, cap and transfer/end lifecycle, and the #251 effect adapter. Revalidate character-sheet and tactical consumers before any production merge. Do not change world or town maps.
