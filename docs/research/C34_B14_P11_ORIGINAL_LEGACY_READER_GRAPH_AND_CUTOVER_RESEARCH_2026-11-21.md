# C34 B14-P11 — Original full-row inventory reader origin and cutover graph

**November 21, 2026 CST — isolated disposable P11 signed runtime attribution ACCEPTED at `59044a2`; original UI/SQL cutover still HOLD.**
Held draft PR [#379](https://github.com/bob8675309/DNDNEXT/pull/379).
Read-only/source-preserving work. The earlier exact signed
[run #44971006230](https://github.com/bob8675309/DNDNEXT/actions/runs/44971006230)
proved P10 calls ONLY P9 slim/P7 page+equip, but recorded **two**
\`get_character_inventory_v1\` from the *surrounding* Next page. This is a
separate legacy privacy/release issue; neither request was made through P10.

## Source graph directly verified at existing original branch

- \`pages/_app.js\` always renders \`PlayerCharacterProfilePanel\`. Its real body
  \`components/PlayerCharacterProfilePanelUnified.js\` returns null only for
  logged-out users. When signed in, \`keepCreatorMounted = isLoggedIn\` and the
  suspended backdrop is **CSS-hidden, not unmounted**. The persisted player
  character also renders \`<CharacterInteractionPanel ...>\` regardless of
  whether \`open\` is true. That panel imports and renders original \`NpcPanel\`.
- \`components/NpcPanel.js\` checks \`character_permissions\` and treats
  \`can_inventory || can_edit\` as BOTH \`canView\` and \`canManage\`. Its
  \`loadInventoryRows\` effect calls \`get_character_inventory_v1\` on mount
  even if the surrounding Profile is suspended. It also eagerly derives
  \`character_spells\` under the same shared inventory permission and allows
  \`set_character_inventory_equipment_v1\` and old
  \`transfer_inventory_item_v1\`. It is **not safe** to expose hired read-only
  NPC backpack through this shared permission model.
- \`pages/npcs.js\` is a **different entrypoint**: it mounts
  \`hooks/useNpcSheetActionData.js\` when a selected NPC passes legacy inventory
  permission. That hook calls \`get_character_inventory_v1\` and additionally
  fetches spells/option grants/progression. P10 does not replace that hook.
- \`pages/inventory.js\` uses original broad \`list_item_send_targets_v1\`,
  old direct \`transfer_inventory_item_v1\` plus an RPC-failure raw UPDATE
  fallback, unguarded raw bulk UPDATE and raw equipment updates. Its original
  account, NPC and merchant inventory browser must be kept functional but
  owner-/recipient-scoped behind approved versioned endpoints before cutover.
  Original \`OfferTradeButton\` and \`TradeRequestsPanel\` use their own
  \`trade_requests\`/\`accept_trade\` workflow; \`AssignItemButton\` legitimately
  inserts new source-owned item rows for Forge/Town and must not be disabled.
- Original June SQL and P2 direct-to-NPC remain immediate moves without P6
  pending consent; P4 original controlled-sidekick gift also requires careful
  conditional closure. Source-original functions, UI and merchant stock must
  be preserved in a release candidate until coordinated approvals.

## Experimental runtime caller attribution

The **temporary** signed P10 Next route records browser
\`new Error().stack\` **only** when shared Supabase
\`rpc("get_character_inventory_v1")\` is invoked, after app mount and
**before** the first signed actor login. It captures sanitized module/line
frames (no JWT, UUID, arguments, inventory rows or private payload), confirms
the original global Profile remains suspended, and crosschecks counts against
network RPCs from the whole browser. It continues to enforce a separately
scoped P10-only P9/P7 whitelist, without changing or disabling global
application components. True caller-source attribution is not accepted until
the new signed exact SHA CI log is examined; source graph alone is not
proof of which exact component emitted each of the previous two requests.

## Proposed coordinated cutover boundaries — design, NOT executed

1. **NPC Profile**: preserve original public/GM dossier and center/drag profile,
   original hidden/merchant behavior, independent PR312 control, PR318 GM
   management and PR345 creator-private Story. Replace only private NPC inventory
   and equipment reads in the relevant original entrypoints with P9 slim public
   worn gear, P7 lazy redacted backpack and separate P7 equip. Do not drop
   the **player-character** original Forge character inventory tab; those tagged
   PCs require their own current principal-scoped private player inventory
   contract, not an NPC P7 route. Do not simply unmount the persistent hidden
   global player profile without proving its Forge draft and state retention.
2. **/npcs hook**: separate inventory/progression/spells authorization;
   an ordinary hired view grant must not become creator secrets, spell-sheet
   management or GM edit. Capture server-projected rights and invalidate on
   actor/NPC switch and same-JWT revoke; tests must still render original
   character ability/action details.
3. **/inventory**: preserve player-account sends and trades, GM merchant
   personal inventory and independent \`character_stock\` buyer workflow;
   recognize true \`owner_type=character\` Forge gear and prohibit tagged
   player-character NPC recipients. Route source-player-to-account via P8
   immediate send, source-player/Forge gear to NPC via pending P6 or approved
   explicit autoaccept; no single or bulk raw fallback.
4. **Server**: installing P8 *alone* is insufficient. Coordinate
   authenticated EXECUTE grants/revokes on original June/P2/P4 direct-NPC
   paths, restrictive RLS and unique typed recipient checks, source provenance,
   private offer status GM decision, bulk atomicity, owner-CAS, item→NPC
   lock order and idempotent receipts. Do not globally modify the shared
   \`is_admin\` helper or protected world-map triggers. Preserve legitimate
   user-owned INSERT for Town craft and original Forge starts.
5. **Release**: owner-reviewed rollout/rollback, independent encrypted
   PG17 and 340 Storage object recovery, 22/34 legacy \`players.sheet\`
   writers, 29/31 nonmap + two protected map triggers, full original
   PR312/318/345 and merchant/Forge/Town/browser user matrix, explicit
   separate owner GO before actual runtime migration/merge/deployment.

No change to gameplay pages, original SQL, world map, hosted database, main,
deployment, merchant stock, paid agents or automations.

## Exact signed caller attribution accepted — November 21, 2026 CST

[Actions #44972725926](https://github.com/bob8675309/DNDNEXT/actions/runs/44972725926), job **137055804071 SUCCESS**, code SHA `59044a2fd2bee58f5ef12b79616898c895474a11`, **106,846-character / 1,248-line** decoded signed log reviewed. Browser-wide trace recorded **two** `get_character_inventory_v1` RPCs outside the P10 scoped client. The temporary runtime stack capture explicitly emitted:

- `NpcPanel.useCallback[loadInventoryRows]` from `webpack-internal:///(pages-dir-browser)/./components/NpcPanel.js:378:103`.
- `NpcPanel.useEffect` from `webpack-internal:///(pages-dir-browser)/./components/NpcPanel.js:401:13`.

These are **compiled browser source locations**; the original checked-in `components/NpcPanel.js` has the full-row RPC at original line 295 and effect at 312–314. `PASS T46-C2B14-P11-TRACE` confirms actual, not inferred, caller attribution: legacy fetch originates from **the original mounted `NpcPanel`**, not P10. The signed test independently checked that the global player Profile was suspended, demonstrating a hidden-but-mounted original reader on the test route. P10's own scoped client still called **only** P9 slim/P7 page/equip (`PASS T46-C2B14-P10-SIGNED`).

**Not generalized to every route:** `pages/npcs.js` separately mounts `useNpcSheetActionData.js`, whose old full-row read and spell/action preload remain a source-confirmed cutover item but were *not* the two requests observed on the P10 test page. Do not remove persistent player-Forge mounts merely to suppress background fetches; correct the read lifecycle and PC/NPC taxonomy with signed character state preservation.
