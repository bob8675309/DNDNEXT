# Character Sheet Identity Reconciliation

Updated: 2026-08-01  
Status: required reading before changing NPC selection, sheet loading, equipped-item loading, tab visibility refresh, or `CharacterSheetPanel` state synchronization.

## Problem this contract prevents

The NPC roster changes the selected character immediately, while the character sheet, equipped inventory, and authoritative numeric effects are asynchronous reads. Browser tab suspension can delay those reads. Without an identity guard, a response for the previous character can finish after the next selection and display the wrong statistics, armor, weapons, and equipment under the new character’s name.

This is a state-identity defect, not an Armor Class formula defect.

## Required invariant

A character-sheet response may be applied only when both are still current:

```text
response.characterId == activeCharacterId
response.requestId == activeRequestId
```

A matching request number is insufficient if the character identity differs. A matching character identity is insufficient if a newer request has begun.

## Shared panel responsibility

`components/CharacterSheetPanel.js` owns an identity-scoped read snapshot whenever `effectsKey` contains a character UUID. The snapshot includes:

- the selected character’s sheet JSON;
- the selected character’s equipped inventory rows;
- locally derived descriptive equipment effects and breakdown text;
- the server-authoritative numeric equipment result.

On character identity change, the panel must immediately:

1. invalidate all outstanding request IDs;
2. discard the previous identity snapshot;
3. clear the controlled or internal draft;
4. close edit mode;
5. render a loading state rather than the previous character;
6. load the new sheet and equipped inventory;
7. apply the result only after the identity/request guard passes.

## Equipment ownership

The NPC page embeds an owner-type hint in `effectsKey` (`npc:<uuid>` or `merchant:<uuid>`). Other callers may provide only the UUID; the panel then resolves `characters.kind` before loading equipped inventory.

Only rows matching all of these may enter the snapshot:

```text
owner_type = resolved selected-character owner type
owner_id = selected character UUID
is_equipped = true
```

Do not merge prior parent equipment while the new identity is loading.

## Tab visibility and focus

Browsers can suspend requests and timers in background tabs. When the page becomes visible or focused again, the panel performs a bounded refresh for the current identity. It does not refresh over an active edit session.

A visibility refresh preserves the current snapshot until the replacement is validated. A character switch does not: it shows a loading state immediately to guarantee that stale data never appears under a new name.

## Editing boundary

- View mode renders the validated identity snapshot.
- Entering edit mode copies that snapshot into the editable draft.
- Parent state is not trusted as identity-bearing because the legacy `sheet` and `draft` props contain no character ID.
- After a successful save, the current identity snapshot is updated from the saved draft.
- Computed equipment overlays remain non-persistent.

## Regression gate

`scripts/validate_character_sheet_identity_reconciliation.mjs` models the observed race:

```text
Raska request 11 begins
Pip request 12 becomes current
Raska request 11 resolves late → rejected
Pip request 12 resolves → accepted
```

The validator also requires guarded sheet/equipment reads, immediate hard reset, visibility reconciliation, and the absence of database writes, encounter mutations, or world/town-map references.

## Protected boundaries

This reconciliation layer must never:

- write character sheets or inventory by itself;
- alter crafting completion or equip mutations;
- rewrite active encounter participants;
- alter tactical combat RPCs;
- touch world-map routes, travel, weather, or town/city-map behavior.
