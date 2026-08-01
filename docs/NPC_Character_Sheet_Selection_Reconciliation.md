# NPC Character Sheet Selection Reconciliation

Updated: 2026-08-01  
Status: required reading before changing `/npcs` selection, character-sheet loading, equipped-item loading, notes loading, or `CharacterSheetPanel` identity behavior.

## Ownership boundary

`pages/npcs.js` owns the selected NPC/merchant identity and the asynchronous reads associated with that identity:

- `character_sheets.sheet`;
- equipped `inventory_items`;
- `character_notes`;
- the controlled character-sheet draft and edit mode.

`components/CharacterSheetPanel.js` renders and edits the validated props supplied by the page. It may load the shared numeric equipment RPC for the current `effectsKey`, but it must not duplicate the page's sheet, inventory, or notes loader.

## Failure modes this prevents

Changing the roster selection updates the visible character name immediately. Database reads for the sheet and equipment complete later and can be delayed further when the browser tab is backgrounded.

Without an identity/request guard, the page can display combinations such as:

```text
selected/header identity: Pip Quillspark
sheet statistics: Letho
armor/equipment effects: Raska Stonejaw
```

The original stale-state defect had three independent causes:

1. a draft synchronization effect depended on both `sheet` and `selectedKey`, so a selection change copied the previous sheet into the new identity before the new read completed;
2. `loadSelectedSheet` accepted late responses without checking which character was still selected;
3. equipped rows were left visible until the replacement inventory query finished.

A later recovery exposed a separate liveness defect: rapid switching could leave the final valid sheet request pending indefinitely. Because the already-selected roster key was ignored, the user also had no retry path. The current design protects both correctness and liveness.

## Required invariant

Every identity-bound response may be committed only when both values remain current:

```text
response.requestedKey == activeSelectedKey
response.requestId == activeRequestIdForThatResource
```

A request ID match alone is insufficient. A character-key match alone is insufficient.

Separate monotonically increasing request IDs are maintained for:

- sheet reads;
- equipped-item reads;
- notes reads.

## Selection transaction

All selection changes must pass through `selectCharacterKey`. In the same React update batch it:

1. aborts the prior sheet read;
2. updates the active identity reference;
3. invalidates all outstanding sheet/equipment/notes request IDs;
4. clears the previous sheet and controlled draft;
5. closes sheet edit mode;
6. clears equipped rows and notes;
7. clears the prior roll result and load error;
8. enters a bounded loading state;
9. commits the new `selectedKey`.

Do not call `setSelectedKey` elsewhere. The validator requires a single internal call inside `selectCharacterKey`.

## Sheet liveness and retry

Sheet loading is independent from notes loading. A notes-table availability change or notes callback recreation must never restart or supersede the active sheet request.

Each active sheet request:

- receives its own `AbortController`;
- aborts any superseded sheet request;
- has an eight-second deadline;
- clears the loading state in `finally` only when it is still the current identity/request pair;
- produces an explicit error and **Retry sheet** action rather than an endless loading placeholder.

Clicking the already-selected roster row while it is loading or failed also calls `retrySelectedSheet`. Retrying invalidates the prior request ID and starts a fresh read for the same selected identity without changing character state.

## Draft synchronization

The controlled draft synchronizes only when a validated `sheet` response is accepted:

```text
useEffect(..., [sheet])
```

Never add `selectedKey` to that dependency list. Selection is responsible for clearing the draft; adding it back recreates the stale-sheet copy race.

## Rendering boundary

While the selected sheet is loading, render a loading placeholder instead of any prior or empty character sheet. Once the validated response is accepted, mount `CharacterSheetPanel` with `key={selectedKey}` so internal draft/effect state cannot cross character identities.

When a current request times out or fails, render the error and retry action. Do not leave `sheetLoading` true indefinitely and do not restore a previous character's sheet as a fallback.

## Tab suspension

A background tab may delay a request, but the request/identity guards reject it if a newer selection has occurred. Superseded sheet requests are actively aborted. Returning to the tab must not make an old response current again.

## Regression gate

`scripts/validate_npc_sheet_selection_reconciliation.mjs` models delayed previous-character responses and verifies:

- identity plus request-ID comparison;
- immediate clearing of all identity-bound surfaces;
- guarded sheet, equipment, and notes responses;
- sheet-only draft synchronization;
- sheet/notes effect isolation;
- active-request abortion and timeout;
- same-character retry paths;
- one selection mutation path;
- identity-keyed sheet mounting.

The validator is registered in the production tactical/build suite because the character-sheet numeric pipeline is consumed by tactical staging and weapon profiles.

## Protected boundaries

This reconciliation layer must not:

- alter sheet or inventory write authorization;
- modify crafting completion;
- rewrite active encounter participants;
- change tactical combat RPCs;
- touch world-map routes, travel, weather, or town/city-map behavior.
