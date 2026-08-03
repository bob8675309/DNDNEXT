# Milestone 2 Multi-User Smoke Setup

Status: source implementation prepared; live session creation remains an explicit admin action.

## Navigation

Authenticated users now have an **Encounters** dropdown in the global navbar.

Player-visible links:

- **Battle Board** → `/encounters/combat`
- **Turn Movement** → `/encounters/play`

Admin-only links:

- **GM Staging** → `/encounters/live`
- **Map Workshop** → `/encounters`
- **Multi-User Smoke Setup** → `/encounters/multiplayer-smoke`

## Test roster

The preserved Round 6 encounter already contains Letho, Pip Quillspark, Aurelia Dawnmere, and Raska Stonejaw. The fresh multi-user session therefore uses only non-overlapping canonical characters:

| Session role | Account authority | Character | Team | Initiative | Start hex |
| --- | --- | --- | --- | ---: | --- |
| Player A | Character permission owner | Leso Varen | players | 18 | -3,-1 |
| GM | Admin profile | Dawn Whiteflame | enemies | 16 | 4,0 |
| Player B | Character permission owner | Varges | players | 14 | -3,1 |

The setup resolves controllers from `user_profiles` and `character_permissions`; it does not hardcode generated user or character UUIDs.

## Guarded workflow

1. Open `/encounters/multiplayer-smoke` while signed in as the administrator.
2. Confirm the reusable smoke arena and all three controller assignments show ready.
3. Select **Prepare fresh multi-user encounter**.
   - Creates or reuses only the `milestone2-multiplayer-smoke-v1` fixture.
   - Adds/repairs participants through `admin_add_encounter_participant_v1` and `admin_update_encounter_participant_staging_v1`.
   - Leaves the encounter in `initiative` status.
   - Does not start combat.
4. Open three browser sessions:
   - administrator / GM;
   - Player A account;
   - Player B account.
5. Return to the setup page and select **Start Encounter**.
   - Requires explicit browser confirmation.
   - Calls `admin_start_encounter_v1`.
6. Use Battle Board and Turn Movement to execute the Milestone 2 ownership/realtime matrix.

## Safety boundaries

- Preparation and Start are separate commands.
- The page blocks setup/start when any selected character appears in another active encounter.
- It does not directly insert or update encounter/participant tables.
- It does not restage, reset, pause, resolve, or archive the preserved Round 6 encounter.
- It reuses the tactical smoke arena without modifying world-map or town/city-map state.
- No world routes, route points, locations, travel, weather, camps, or clock state are read or written.

## Acceptance matrix after Start

Record evidence for:

- GM / Player A / Player B controller ownership;
- active-turn control rejection for the wrong user;
- turn synchronization across all three sessions;
- movement synchronization;
- spell-slot synchronization between battle and character sheet;
- reconnect and tab-away/tab-return reconstruction;
- stale-client rejection;
- reaction ownership;
- GM override behavior;
- final resolve/archive cleanup after evidence is complete.
