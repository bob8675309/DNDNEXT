# Rest Activity Popup — implementation checkpoint (2026-10-25)

**Status:** Draft PR #266 based on main (NOT deployed). Replaces its prior browser confirmation step with one Character Sheet rest-activity dialog. No new Supabase migration, attunement, crafting, or map/tactical changes.

## Owner-approved experience

1. Short Rest and Long Rest stay as two buttons in the spell-resource section, disabled during active combat.
2. Each opens one styled, keyboard-accessible activity dialog. **Rest & Recover** is the only currently enabled activity and calls the existing canonical complete_character_rest_v1 once after deliberate selection.
3. Short Rest restores eligible tracked short-rest/Pact Magic and backed class-use resources; Long Rest restores tracked short/long rest resources. This particular RPC does **not** restore HP or Hit Dice.
4. **Work on Crafting** is clearly unavailable pending later integration. No fake craft results.
5. **Attunement is OFF by default** for this campaign and hidden in the live dialog until the separate simpler Admin rule and eligible item selection actually exist. The component contains gated placeholder UI only; no source-specific time/GM approval. Overengineered drafts #257 and #260–#265 are NOT release prerequisites.
6. Escape, Cancel, backdrop, focus containment/return, visible errors, double-click protection, print exclusion, and backend active encounter guard are preserved.
7. Future location restrictions on rest (town/camp/GM discretion) are NOT implemented in this draft.

## Changed files

- components/CharacterRestActivityDialog.js and scoped CSS: portal activity modal matching current purple/dark resource styling.
- components/CharacterSheetEnhancements.js: opens activity dialog instead of window.confirm and calls the unchanged authoritative rest RPC only on recovery choice; failed requests leave dialog open.
- scripts/validate_player_rest_buttons.mjs and scoped workflow: checks buttons, encounter guards, interaction, future placeholder honesty and unchanged RPC.
- No rest-resource SQL, existing equipment modifiers, status or inventory writes, map UI, NPC forge or spell casting were changed.

## Review gates

Actual signed-in player/admin browser, mobile/focus/print and an active tactical encounter still need smoke validation before merge. Then implement separate Admin **Enable Attunement** OFF-by-default, ON=three-magic-item capacity and a real optional rest item selector. Crafting is a separate later workflow.
