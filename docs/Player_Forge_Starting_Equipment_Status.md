## 2026-10-12 MerchantPanel scroll + scene-fit follow-up

The first browser pass of the MerchantPanel-derived Equipment layout exposed two presentation defects:

- the stock workspace inherited a fixed-height Forge ancestor without giving `.merchant-stock-list` a bounded remaining height, so lower merchant inventory could be clipped without a usable vertical scroll region;
- the Forge scene resolver preferred the merchant portrait over the dedicated storefront image. That forced portrait-oriented media into the wider storefront scene and produced the oversized/cropped composition seen in the browser video.

The Forge MerchantPanel shell now gives the stock workspace and stock layout explicit flex/min-height/height boundaries, with the stock list owning vertical scrolling and visible scrollbar behavior. The Campaign Merchants rail remains independently scrollable. The scene now prefers `storefront_bg_image_url` / resolved storefront media and falls back to the portrait only when dedicated shop art is absent. Storefront art and portrait fallbacks use separate background-position anchors.

No transaction, wallet, stock-authority, map, movement, combat, or crafting behavior changed.

# Player Forge Starting Equipment & Character Currency Status

Status date: 2026-10-11  
Active follow-up: PR #208 (`agent/forge-ux-equipment-homebrew-20261011`)  
Current authority: migrations 49-51 plus `20261010_01_player_forge_starting_market.sql` and `20261011_02_player_forge_homebrew_starting_budget.sql`

## 2026-10-12 current MerchantPanel visual pivot

The latest side-by-side browser video confirms that the established live merchant storefront remains the stronger shopping composition. Character Forge Equipment now intentionally uses that storefront as the visual foundation rather than continuing the separate four-column Forge experiment.

The player-facing Equipment composition is now:

- **Campaign Merchants** remains as a narrow selector on the far left;
- the remaining space uses the current MerchantPanel hierarchy and CSS language: merchant header, large portrait/store scene, Search Stock/category strip, vertically scrolling stock list, and Selected Item ItemCard;
- the existing portrait-to-stock fade from the live MerchantPanel applies here too, so merchant art bleeds beneath the stock workspace rather than ending at a hard divider;
- Forge purchase behavior is still staged only. The new presentation component does not import `useWallet` and cannot call `buy_from_merchant`;
- starting purse, spent/remaining gold, cart contents, source-purse rules, and the explicit **No starting gear / Keep all starting gold** choice now live in the existing movable/collapsible Equipment summary dock. This intentionally uses the same interaction concept as the Class Feature window instead of permanently consuming another storefront column.

The normal `MerchantPanel` remains untouched as the account-wallet shop. This pass shares its presentation vocabulary without sharing its transaction controller.

## 2026-10-12 Spells → Equipment null-merchant crash hotfix

The post-merge browser video exposed a client-side crash immediately after pressing **Continue** from Spells into Equipment: `TypeError: can't access property "icon", e is null`. The full-stage background introduced in the prior pass mounted `MerchantAmbientBackdrop` during the first Equipment render while the async merchant query had not resolved yet, so `activeMerchant` was still null. `themeFromMerchant` then dereferenced `.icon`.

The Equipment stage now mounts merchant media only after an active merchant exists. The shared merchant theme/media helpers are also null-safe so a loading-state null cannot crash other storefront consumers. This is a presentation/loading-state correction only; spell validation, merchant queries, starting-market authority, cart behavior, rarity handling, and character currency rules are unchanged.

## 2026-10-12 full-stage art, rarity authority, and no-gear path

The Dawn browser review established three concrete corrections.

First, storefront art is now one continuous Equipment-stage background rather than a workshop-only image plus a separately filtered Wares duplicate. The active merchant's existing `MerchantAmbientBackdrop` is mounted once behind the purse bar, Campaign Merchants rail, workshop copy, Wares browser, and selected ItemCard. The Forge disables the workshop's duplicate backdrop and removes the Wares duplicate scene. Forge-specific image filtering/transforms and row backdrop blur are disabled; readability comes from translucent dark menu surfaces and restrained stage shading instead of blurring the artwork.

Second, Wares rarity now uses the site's canonical `rarity-*` class on the stock row itself. Live Dawn stock already carried correct `item_rarity` values (including Uncommon and Very Rare); the defect was presentation. The row had only an `is-rarity-*` class on the inner badge, so the existing `--rarity-color` authority fell back to gray. Rows and rarity badges now share the canonical rarity variable used elsewhere: neutral Common/Mundane, green Uncommon, blue Rare, purple Very Rare, gold Legendary, and red Artifact.

Third, the starting market now exposes an explicit **No gear / Keep all gold** action. Selecting it clears a non-empty cart only after confirmation, marks the draft intent as `keepStartingGold`, and explains that the full starting purse remains character-scoped. Adding an item clears that intent. This is presentation/state clarity, not a new currency rule: empty market carts were already valid and the existing materializer already persists the full unspent starting purse to `public.character_currency`.

## 2026-10-12 Dawn Whiteflame visual calibration pack

Dawn Whiteflame is now the first storefront with a complete approved media set. This is the calibration merchant for the remaining campaign shops.

The committed assets are:

- `/merchant-media/dawn-whiteflame/storefront.webp` — 16:9 photorealistic General Goods workshop scene, composed for the dedicated workshop pane and the low-opacity Wares bleed/fade;
- `/merchant-media/dawn-whiteflame/portrait.webp` — 3:4 merchant portrait for profile/shop portrait contexts;
- `/merchant-media/dawn-whiteflame/thumb.webp` — square merchant-rail thumbnail.

The generated art direction is intentionally darker and more photographic than the earlier bright fantasy mockups: warm practical lantern light, deep wood/leather/brass materials, believable adventuring stock, restrained saturation, and Dawn integrated into her actual shop rather than presented as a detached character portrait.

The live `public.characters` row points Dawn's canonical portrait and storefront fields at those static assets. `storefront_bg_video_url` remains null for this calibration pass; the ambient-video renderer is already implemented and can be populated later without another layout change.

Do not use the neutral placeholder gradients to judge final storefront atmosphere now that Dawn has real art. The next browser review should use Dawn to tune workshop width, crop/object-position, Wares bleed opacity, copy-panel transparency, and ItemCard balance. Once those values are approved, Dawn becomes the visual specification for the other six storefront merchants.

## 2026-10-12 Wares scrolling hotfix and visual-art checkpoint

The latest browser video exposed a functional layout bug: the Forge Wares list was reusing `.merchant-stock-list`, but unlike the normal MerchantPanel it is not nested inside `.merchant-stock-layout`. As a result, the list did not explicitly own the remaining flex height and the browser could clip lower stock rows without exposing a usable vertical scroll region.

The Forge-specific list now explicitly uses `flex: 1 1 0`, `min-height: 0`, `height: 0`, and `overflow-y: auto`, with a visible purple scrollbar and contained wheel scrolling. Search/sort/category/footer controls remain fixed while only the stock rows scroll.

The same video also confirms that the current visual treatment should not be judged as final art direction yet. Dawn Whiteflame and Brakka Wayfarer currently have no `portrait_shop_url`, `portrait_url`, `storefront_bg_url`, `storefront_bg_image_url`, or `storefront_bg_video_url` in live merchant data. Therefore the large workshop pane is still a neutral fallback and the Wares background fade has no real storefront artwork to blend from. Further decorative CSS iteration is intentionally deferred until the first approved photoreal storefront image is assigned, so the composition can be evaluated with real art instead of placeholder gradients.

## 2026-10-11 readability / rarity / artwork-fade polish

The first MerchantPanel-derived production review kept the new composition but exposed a readability floor problem: Equipment labels, merchant metadata, stock rows, filters, and the selected ItemCard were too small at normal desktop zoom.

This pass keeps the four-pane storefront architecture and improves scanability rather than changing commerce behavior:

- Campaign Merchant names, specialties, and supporting text are enlarged;
- Starting Market Total / Spent / Remaining / Cart values are enlarged;
- Wares search/sort controls, category chips, item names, prices, metadata, descriptions, and footer counts are enlarged;
- stock rows gain more vertical padding and preserve two lines of description;
- the first metadata pill now reflects canonical rarity color: neutral Common/Mundane, green Uncommon, blue Rare, purple Very Rare, gold Legendary, and red Artifact;
- the active merchant's resolved storefront image is reused at low opacity behind the Wares pane with a dark directional fade, retaining the older merchant-overlay atmosphere without sacrificing text contrast;
- the shared ItemCard `shop` variant receives a larger title, rarity label, rules text, metadata badges, and Game Details disclosure while default/admin ItemCard rendering remains unchanged.

A separate Spells correction fixes the top-right Forge spell Select action: its CSS rule had a missing closing brace, which allowed the teal button styling to parse incorrectly. The button now uses a high-contrast light-teal surface with dark text; selected/removal state remains intentionally distinct.

## 2026-10-11 MerchantPanel-derived storefront pivot

The preferred Equipment direction now uses the existing merchant overlay as the primary interaction model instead of the large horizontal hero experiment.

The Forge composition is intentionally close to the current `MerchantPanel`:

- a narrow **Campaign Merchants** selector sits at the extreme left;
- a dedicated **merchant + workshop** scene occupies the next pane and supports the same still/ambient media resolver;
- a dense **Wares** pane uses the established MerchantPanel search/category/list language and the shared item visual resolver;
- the right pane uses the existing shared `ItemCard` with the opt-in shop presentation and collapsible **Game Details**;
- starting purse information is compressed into a top utility bar showing **Total gold / Spent / Remaining / Cart** rather than consuming a permanent right-hand panel;
- the cart opens as a collapsible overlay drawer so shopping space remains dedicated to merchant, stock, and selected-item inspection.

Forge purchase authority remains separate from normal merchant checkout. `MerchantPanel` continues to use the account wallet and `buy_from_merchant`; Character Forge continues to stage `marketPurchases[]` and resolves them transactionally only when the character is created.

The shared pieces retained from the earlier storefront pass are still valid: merchant media fields, ambient-loop support, `ItemCard` shop mode, centralized item-art fallbacks, seven live storefront merchants, and full-catalogue stock generation. The pivot changes composition, not commerce authority.

## 2026-10-11 first production storefront review correction

The first live browser/video review exposed presentation problems that were not visible in static validation:

- the merchant hero and right-side panels were respecting minimum heights that could exceed the actual Forge body height, pushing the stock browser and Starting Cart below the clipped workspace;
- all seven live storefront merchants still had empty portrait/shop/background fields, so the storefront resolver fell back to `/parchment.jpg`, which showed an unrelated character image for multiple merchants;
- the merchant rail therefore also had blank portrait boxes when no merchant portrait existed;
- Dawn Whiteflame still had stale storefront metadata (`Clam merchant`, generic shop title, no storefront tagline), which caused her Character biography to leak into shop presentation.

The corrective pass changes presentation rather than commerce authority:

- the desktop Equipment center column now reserves roughly 42% of the available height for the merchant hero and gives the remaining space to the stock browser, with additional short-viewport reductions;
- the Selected Item and Starting Cart share the available right-rail height and each scroll internally rather than forcing the other below the Forge viewport;
- merchants with no approved portrait now receive a deliberate monogram portrait fallback;
- storefronts with no approved hero art now use a neutral dark storefront treatment, with existing profession-themed merchant backgrounds reused only where they are appropriate;
- `/parchment.jpg` is no longer the storefront media fallback;
- Character biography text is no longer used as a storefront tagline;
- Dawn's storefront metadata is corrected to **General goods merchant / General Goods / Quality gear for every journey.**

The Forge-draft warning seen while reviewing a version-specific Vercel hostname is not a new persistence defect. Player Forge draft persistence is browser `localStorage`, scoped by the signed-in user **and by web origin**. A draft saved at `dndnext.vercel.app` is not visible to a deployment hostname such as `dndnext-<hash>-pauls-projects-....vercel.app`. The direct `forgeStep=equipment` convenience continues to work when opened on the same origin as the saved draft. The warning copy now states that boundary explicitly.

## 2026-10-11 storefront UI implementation batch

Active implementation branch: `agent/forge-equipment-storefront-ui-20261011`.

This batch deliberately reuses the existing merchant and item authorities rather than creating a second shop system.

- `NpcForgeEquipmentStep` remains the owner of Forge-only staged `marketPurchases[]`; it still reads enabled merchants from `public.characters` and live shelves from `public.character_stock`.
- The approved Equipment composition is now split into reusable presentation pieces: `MerchantRail`, `MerchantHero`, `MerchantAmbientBackdrop`, and `MerchantStockBrowser`.
- The Forge layout is a three-column storefront on desktop: Campaign Merchants on the left, a large merchant/workshop hero plus searchable stock browser in the center, and Selected Item + Starting Cart on the right.
- Merchant media resolution now understands `storefront_bg_video_url`, `storefront_bg_image_url`, `storefront_bg_url`, shop portraits, normal portraits, and legacy background fields.
- Ambient storefront video is muted, inline, tail-looped, and disabled by `prefers-reduced-motion`; a still image remains the fallback/poster.
- The existing shared `ItemCard` remains the item-detail renderer. It gained an opt-in `shop` presentation and collapsible **Game Details** without changing default Inventory/Admin/NPC rendering.
- Missing item art no longer has to render as an accidental generic placeholder. `utils/itemVisuals.js` resolves explicit item art first, then supplies category/name-aware fallback icon treatments until individual item art is created.
- Compact stock rows use the same visual resolver, item terminology, and source payloads as ItemCard, while remaining dense enough for merchant browsing.
- `NpcForgeEquipmentSummaryDock` keeps its existing floating mode for reuse, but the Forge passes `presentation="rail"` so Total Gold / Spent / Remaining / cart / source-purse information occupies the lower-right panel from the approved mockup.
- Normal wallet purchasing remains owned by `MerchantPanel`; Character Forge does **not** import `useWallet` or call `buy_from_merchant`.

This is a presentation refactor only. Final starting-market checkout, stock locking, price revalidation, character-scoped inventory/currency, homebrew/vanilla ruleset handling, and all protected world/town/combat/crafting boundaries remain unchanged.

## 2026-10-11 Equipment browser-review follow-up

The Equipment workspace now uses the full Forge width on desktop. Budget, spent, remaining currency, source-purse provenance, higher-level magic guidance, and cart contents live in a draggable/collapsible **Starting cart** dock modeled on the Class feature window instead of reserving a permanent right-hand column. The old in-workspace Ruleset / Budget / Spent / Remaining strip and separate vanilla-reference disclosure are no longer the primary presentation.

A direct `forgeStep=equipment` review link is still draft-aware: Equipment requires a selected Class and Background because those choices determine the source-backed purse. When those prerequisites are not present in the account-scoped saved Forge draft, the step now explains the missing prerequisites instead of sitting forever on “Preparing the starting market…”.

The class starter rule imported as **“Choose an Artisan's Tool or Musical Instrument”** is now normalized through the existing DNDNext class-artisan campaign adaptation and appears as one additional **Trade Skill** choice in Training. It is source-granted and does not spend the character's normal Class Skill / Trade Skill allowance.

The live storefront catalogue was expanded from one enabled merchant to seven. Six storefront-only merchant characters were added without map locations or routes: Mara Ironvein, Selene Quill, Pell Mossgrove, Brakka Wayfarer, Ilyra Glasshand, and Torren Packswell. Their live shelves are generated from `public.items_catalog`, not from a static sample list. The live canonical catalogue contains 2,739 rows / 2,702 distinct names across 29 item types, and every catalogue row currently carries merchant tags. The diversified reroll keeps recipes to a small portion of each shelf, spreads stock across item types, and uses the complete catalogue as its fallback candidate pool. Current storefront stock after the expansion is 232 rows, all 232 resolving back to canonical `items_catalog` rows.

## 2026-10-11 DNDNext homebrew market override

The player-facing Forge now records an explicit starting-equipment ruleset. The default is `dndnext-homebrew`; `vanilla` remains a supported server value for the future global vanilla/homebrew campaign switch.

For market-mode creation:

- the imported class and Background cash alternatives remain the **vanilla source purse** and are retained in metadata/provenance;
- DNDNext Homebrew raises the starting market base to a **300 gp minimum** when the vanilla source purse is lower;
- existing level 5+ higher-level wealth remains additive after the active base purse;
- the live server still re-resolves merchant, stock, quantity, and current price transactionally at character creation;
- unspent coin remains character-scoped;
- legacy Package A/B/C payloads remain supported for old drafts and future vanilla-mode presentation.

The Equipment screen no longer leads with separate Class Purse / Background Purse / Budget / Remaining cards. It uses a compact **Ruleset / Budget / Spent / Remaining** strip and a collapsed **Vanilla starting-equipment reference** disclosure so the imported source values are preserved without dominating the shopping UI.

The storefront selector is portrait-aware and uses merchant imagery when the merchant record provides it. Production now has seven enabled storefront merchants. The six newly seeded storefronts intentionally remain hidden and unplaced on the world map until a later world-content pass assigns approved locations, routes, and portrait art; this avoids changing map behavior as a side effect of the Equipment expansion.

## Current player-facing model

The Character Forge **Equipment** step no longer asks a player to choose Package A / B / C.

The imported class and Background equipment sources already contain a cash-only alternative. The Forge now treats that source-backed cash alternative as the character's starting purse and lets the player stage purchases from the campaign's existing merchant storefronts.

The live source audit on 2026-10-10 found:

- 14 supported class entries with imported starting-equipment choices;
- all 14 have a source-backed cash alternative;
- 16 XPHB Background entries with imported starting-equipment choices;
- all 16 have a source-backed cash alternative.

No arbitrary flat starting-gold table was invented for the new UI.

At levels 5+, the existing higher-level wealth rule remains additive to that source-backed class + Background purse:

- levels 5-10: `500 gp + 1d10 x 25 gp`;
- levels 11-16: `5,000 gp + 1d10 x 250 gp`;
- levels 17-20: `20,000 gp + 1d10 x 250 gp`.

The higher-level magic-item allowance remains a **DM guide only**. The Forge does not create free magic items from that guide.

## Starting Market UI

`components/NpcForgeEquipmentStep.js` now uses the existing merchant data model:

- merchant identity and storefront metadata come from `public.characters`;
- only `storefront_enabled=true` merchants are shown;
- live stock comes from `public.character_stock`;
- the existing `ItemCard` is reused for item details;
- the player can search/filter stock and stage purchases into a Starting Cart;
- the UI shows source class cash, source Background cash, total budget, staged spending, and remaining coin;
- keeping some or all starting gold is legal.

The storefront presentation was also given a modest readability/scale pass. Existing shop/admin/purchase capabilities were intentionally preserved.

Recipes are not treated as starting equipment. They remain owned by the normal recipe/unlock flow rather than being projected into a new character's equipment inventory.

## Transaction boundary

Character Forge does **not** run the normal account-wallet merchant purchase RPC while the new character is still only a draft.

Instead, `startingEquipmentSelections` stores a staged `marketPurchases[]` cart. At character creation, the deferred Player Forge equipment materializer performs the authoritative checkout in the same database transaction.

For every staged row it:

1. re-resolves the merchant and stock row;
2. requires that the merchant still has an enabled storefront;
3. locks the stock row;
4. rechecks available quantity;
5. uses the **current server-side merchant price**, not the client-staged price;
6. rejects recipe/unlock rows;
7. recomputes the source-backed class + Background + higher-level cash budget on the server;
8. rejects the whole creation transaction if authoritative purchase cost exceeds that budget;
9. moves the purchased item into `inventory_items` as character-owned inventory;
10. decrements or removes the merchant stock row;
11. writes only the unspent balance to `public.character_currency`.

A stale cart therefore fails closed instead of silently overspending or duplicating merchant stock.

## Character-scoped inventory and currency

Starting-market purchases retain the existing multi-character authority:

- `inventory_items.owner_type='character'`;
- `inventory_items.owner_id=<character uuid>`;
- items start unequipped;
- AC, attacks, equipment bonuses, and tactical derived effects remain owned by the existing equip pipeline;
- unspent coin is stored in `public.character_currency`;
- the starting market does not spend or modify the account-wide wallet.

The sheet receives:

- `startingEquipmentSummary`;
- `startingCurrencyCopper`;
- `higherLevelMagicItemGuide`;
- the same remaining balance under `meta.startingCurrencyCopper`.

The Review step shows the source budget, staged market spend, remaining currency, merchant count, purchased items, higher-level d10 result, and magic-item guide.

## Legacy compatibility

The server materializer still accepts legacy `mode='package'` payloads from older drafts.

Legacy package materialization continues to resolve canonical items through `items_catalog`, preserve source quantities, validate category choices, and write character-scoped inventory/currency.

New Player Forge drafts normalize to `mode='market'`, so Package A/B/C is no longer the player-facing path.

## Guards

The deferred sheet guard still verifies:

- `startingEquipmentSelections` is an object;
- submitted Background id exists;
- submitted Background id/name matches the character Background;
- Background source matches when recorded;
- level 5+ requires a valid d10 result;
- levels below 5 reject a higher-level wealth roll.

For market mode it additionally requires:

- `marketPurchases` is an array when supplied;
- every staged purchase is an object;
- every purchase identifies its merchant and stock row;
- quantity is a positive whole number.

Live stock, price, storefront state, budget, and recipe eligibility are revalidated by the materializer at checkout.

## 2026-10-10 live verification

The new SQL compiled and replaced the live helper/materializer/guard successfully.

Live source-backed cash audit after deployment:

- classes: 14 total, 0 missing cash alternatives;
- Backgrounds: 16 total, 0 missing cash alternatives;
- class cash alternatives ranged from 50 gp to 160 gp;
- XPHB Background cash alternatives are 50 gp in the current imported set.

The live materializer contains the market branch, the live deferred guard recognizes `marketPurchases`, and the existing materializer/guard triggers remain attached.

Applying the migration did not purchase or consume merchant stock. The active storefront stock count remained unchanged after the authority migration.

## Protected boundaries

This work does not change:

- world-map movement, routes, weather, or time simulation;
- town/city-map roster semantics;
- encounter/tactical combat;
- crafting recipe logic;
- equipment-derived AC/attack authority.

The change is confined to Character Forge starting equipment, merchant storefront presentation, merchant stock checkout at character creation, character inventory, and character-scoped starting currency.
