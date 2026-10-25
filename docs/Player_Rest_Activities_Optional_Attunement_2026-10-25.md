# Player Rest Activities and Optional Attunement — Current Product Direction

**Owner clarification: 2026-10-25. Highest-priority requirement for rest and attunement UI.** This supersedes the proposed complexity of the #260–#265 attunement-evidence stack. It does not erase their historical tests or authorize any deployment.

## Experience the player should have

- The Character Sheet already has **Short Rest** and **Long Rest** buttons. They call `complete_character_rest_v1`. Keep both as the primary player actions and use the existing restoration authority for eligible spells and class/other limited-use abilities. **Neither requires attunement, DM signoff, a running 60-minute timer, or a prior item-focused rest.**
- **Never allow either rest during active combat.** Both the Character Sheet state and canonical server encounter guard must continue enforcing this, even if the UI is bypassed.
- Clicking either button should eventually open **one simple rest-activity dialog** (consistent with the current Character Sheet), with options such as **Rest & Recover**, **Attune / Change Magic Items** (only when attunement rules are enabled), **Work on Crafting** (not enabled until actual crafting integration), and extensible later activities. Keep the recovery flow obvious and default; a crafting or attunement choice must not silently negate legitimate short/long resource recovery. Avoid extra sequential confirmations unless they prevent a meaningful mistake.
- Resting represents characters stopping to sleep, relax, and engage in suitable camp downtime. Crafting is a future activity within the rest experience; do not implement a duplicate crafting engine in the rest dialog.
- **Future location enforcement:** Long Rest at appropriate camps, inns, towns, and similar safe places; Short Rest may also be allowed in other situations at GM discretion. This is planned for tactical-board and later locations; do not impose map/location checks now. **No world-map or town-map changes** are authorized here.

## Attunement is an optional campaign capacity rule — not a separate rest system

- **Admin Attunement toggle: OFF by default for this campaign.** The GM does not ordinarily use attunement. With the rule OFF, a character's magic equipment functions as allowed by normal inventory/equipment-slot, ownership, source and encounter rules, **without** creating magic-item bonds or going through a rest attunement flow.
- With the rule **ON**, use a simple default **three magic items per character** as the active/equipped attunement capacity, consistent with the earlier three-item setting. Players can choose / change which magic items occupy the limited capacity during the optional **Attune / Change Magic Items** rest activity. This is a campaign-friendly house-rule capacity, not a commitment to enforce every sourcebook-specific attunement prerequisite.
- **Physical equipment placement remains independent:** no unlimited helmets, armor, boots, or weapons. The toggle limits eligible magical-item capacity, **not** the number or kind of body slots.
- The GM must be able to toggle the rule OFF/ON from the **Admin Dashboard** without causing spontaneous equipment deletion or changing item ownership. Plan and test how to handle existing characters with more than three eligible magic items before the ON switch is deployed; do not silently destroy/unequip items or retroactively suppress benefits.
- Do not automatically treat magic items that lack imported `reqAttune` flags as unusable **while the optional rule is OFF**. Exact 2024 item sources and exotic source-specific attunement conditions are no longer a prerequisite for ordinary recovery or the OFF mode.
- Avoid implementing Artificer extended capacity, class exclusions, cursed items and exception rules as prerequisites for the **first simple optional toggle** without another owner decision. Preserve source information for future optional advanced rules.

## What current GitHub draft code gets wrong

- **Draft #257** uses `unlimited_attunement_enabled=false` by default (**Standard 3**) and labels the Admin switch **Unlimited attunement**. The clarified default/UI is **Attunement OFF**; flip semantics and default as part of an explicitly reviewed replacement before release. Its `CharacterAttunementPanel` allows direct item toggles outside a rest. This should become an activity in the rest dialog, not a permanent intrusive sheet block.
- **Drafts #260–#265** add source-specific positive attunement facts, class prerequisites, exclusive focused-world-hour timers, a canonical rest-link bridge and separate authenticated DM evidence/approval. The source/ownership/custody and concurrency tests may be reusable, but **do not merge or ship this stack for the simple campaign rest/attunement experience**. It is overengineered for this requirement. Keep it as historical research until explicitly authorized otherwise.
- **Draft #266** (independent, based on main) adjusts inaccurate Short/Long Rest confirmation copy and source-contract tests; it should not add extra attunement prompts or change the rest RPC.
- The **Common Character Effects Engine** remains a separate source-aware mechanic with real gameplay-consumer parity requirements. The optional attunement toggle should be an eligibility switch **only when ON**, not a condition for the engine to calculate normal magic effects when OFF. Future AI can read authorized state and explain it; it must not grant effects or trigger rests independently.

## Safe implementation order (not a request to deploy)

1. Preserve working two-button rest RPC and combat guard; correct misleading confirmation text (#266 is a separate draft).
2. Show an **actual Character Sheet component-based rest-dialog mockup** and get approval on how Rest & Recover, Attune / Change Magic Items and future Crafting are arranged; maintain existing profile/paper styling and printable sheet.
3. Build an admin **Enable Attunement Limit** OFF/ON toggle (OFF initially, ON 3); review cap-on transition for already equipped magic gear. Verify player, NPC and multiple-character inventory associations without touching unrelated equipment-slot constraints.
4. Wire the optional attune/select action into a rest activity, reusing source/ownership and cap safeguards where helpful, **without** a mandatory minute-by-minute focus timer or generic DM approval step. Keep ordinary Short/Long Rest independent of the opt-in feature.
5. Add isolated Postgres, permission, rest, active-encounter, equipment-slot, attunement-OFF parity and attunement-ON cap tests; then user-approved browser smoke and runtime merge/deployment.

**Source of authority:** owner's explicit product clarification on October 25, 2026, verified current CharacterSheetEnhancements, CharacterSheetResourceTracker, canonical rest and encounter guard, plus draft #257/stack. If older technical documentation conflicts, **this page wins on intended product behavior**; live deployed code continues to win on what actually exists.
