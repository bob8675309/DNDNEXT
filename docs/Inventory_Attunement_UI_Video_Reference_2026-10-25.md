# Inventory attunement — visual reference and integration guard (2026-10-25)

## What the owner's 76-second equipment video actually shows
- The **/inventory** player page (owner displayed as Letho) has the existing three-column purple/dark **Equipment Stage**: a large silhouette and slotted equipment at left; **Backpack Contents** in a narrow middle column with filters; the full **Selected Item** `ItemCard` at right. Items can be dragged to equip and dragged out to unequip. Keep this presentation and behavior.
- The selected **Cloak of Protection** appears as Uncommon, in the Shoulders slot once equipped, with displayed +1 AC and +1 saving throw effects. The video also shows a breastplate and an animated shield equipped.
- A separately opened character sheet for **Letho** shows AC 19. Its AC breakdown tooltip references Breastplate base 14 / Dexterity max +2, Animated Shield +2, and Cloak of Protection +1. This is a useful displayed legacy-behavior example for future independent end-to-end fixtures, **not** proof of all effect-source legality or the finished attunement rule.
- The sheet is reached from a character-context panel whose **Active character** selector can change between multiple characters; the regular /inventory page, however, currently identifies a player's inventory by **account user ID**. A displayed character name alone does **not** authenticate item allocation to that character.
- The video also demonstrates weapon entries (Battleaxe and Rapier) and character sheet interaction. Do not introduce equipment or attack-calculation regressions.

## Approved UX target
- Put **Attune / Unattune** below the selected full-size ItemCard, not inside the shared ItemCard itself; preserve card reuse and rarity styling.
- Use a subtle attuned marker on slotted items and compact backpack status, plus a small **n / 3** counter beside the equipped count. Do not add another inventory list inside the Camp & Downtime dialog.
- **Attunement OFF:** show no controls and retain existing bonuses; **ON:** show authoritative selection state and remaining capacity. Unverified/unowned/unequipped sources must not be actionable.
- Maintain keyboard accessibility, responsive widths, drag/drop, item selection, trading/transfers, and NPC/merchant inventory contexts without writing from EquipmentDiagram.

## Non-negotiable functional integration gates
1. Resolve **per-character** inventory allocation/ownership for accounts containing multiple editable characters. Do not derive character UUID from displayed inventory account metadata. The stacked integration draft now permits a shared-account magic item to be exclusively claimed for attunement by one explicitly chosen character; other characters cannot claim the same item until it is released. This does **not** reassign underlying equipment custody or fix legacy cross-character equipment projections.
2. Establish a **server-authorized rest opportunity** before permitting changes from the inventory view; an untrusted UI flag or URL parameter alone is not permission. Continue to deny changes during active combat.
3. The existing `/inventory` page now lists the authenticated player's verified character roster, chooses an explicit character (rest navigation carries that ID), and fetches the existing authenticated `get_character_rest_magic_choices_v1` snapshot only for a validated, explicitly chosen character; supplies it to the opt-in equipment component; serializes one inventory-id toggle to `set_character_rest_magic_choices_v1` with refetch and error handling.
4. The stacked integration replaces the duplicate picker with an **Open Inventory** action carrying character/rest context. Existing Short/Long Rest recovery is still separate. Rest link context does not constitute independent server-side rest proof; the setter currently relies on authenticated character permissions and the existing active-combat guard. Ordinary **Rest & Recover** remains separate and works even with attunement OFF.
5. Make magic effects conditional on the selected item IDs through verified source-level common effects + legacy AC/save/spell/weapon/tactical consumer parity, including four-plus equipped items, without unequipping or destroying anything.
6. Verify signed-in admin/player, at least two playable characters under one account, mobile, keyboard, concurrent saves, transfer, unequip, class exceptions, and combat. Use the displayed Letho AC formula and Cloak of Protection bonuses as **regression examples**, not universal baseline values.

## Current PR state
This draft only adds opt-in presentation hooks to `EquipmentDiagram`; **no caller passes attunement yet, no client-side attunement RPC is invoked, and no production gameplay is changed.** Do not merge as an operational feature before gates above.
