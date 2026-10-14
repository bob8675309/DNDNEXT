## 2026-10-14 merchant-crafted alchemy authority + catalyst formatting + 90% MerchantPanel pass

The latest merchant review exposed a distinction between base recipe text and the finished merchant-crafted stock result. Quill Ashborn's Bomb of Lightning is the calibration case: the stock payload contains the original 2d6 / 10-foot recipe flavor alongside the actual crafted result of 3d6 with a 15-foot area. ItemCard now treats the final merchant-crafted payload (`merchant_craft` / `alchemy_result` / final effect fields) as presentation authority for merchant-crafted alchemy. The top summary, adaptive fields, duration, area, save, and damage therefore describe one finished item instead of mixing base-recipe and enhanced values. The same rule prevents enhanced elixirs from showing their original duration in the summary while a later section shows the crafted duration.

This is a renderer-authority correction only. Existing merchant stock rows were not rewritten and no alchemy formulas were changed.

Alchemy Modifiers / catalysts now use the same compact field-grid language as the rest of ItemCard instead of a prose-heavy "Final brew" block. Cards such as Freedom Resin present Slot, Purpose, Family, Brew Theme, Craft DC impact, and Contribution as distinct fields. The physical description remains in the top description/thumbnail row.

Normal MerchantPanel now explicitly uses `ItemCard variant="shop"`, matching Forge Equipment's compact storefront card presentation. This removes the extra internal price badge and keeps shop-only spacing consistent between the two storefronts.

Merchant stock-row descriptions are now a single ellipsized line instead of two wrapped lines. The full description is retained as a native hover title. This increases scan density without discarding the text.

For the embedded profile Shop view, the accepted desktop reference has shifted from the old 80% browser-zoom target to the current 90% view. The shop-active profile shell desktop width is therefore tightened from 920px to 840px at native 100% browser zoom. This is scoped to the embedded profile shop and does not alter the Forge Equipment shell or world-map behavior.

## 2026-10-14 alchemy ItemCard normalization + category-scrollbar correction

Browser/video review exposed two shared MerchantPanel issues after the crafting-style ItemCard pass.

Alchemy ingredients were rendering their physical description twice because the same canonical text exists as both `flavor` and `item_description`. Ingredient cards now recognize `alchemy.kind = ingredient`, keep the physical description once in the summary area, and use the details area for the actual brewing metadata already present in the catalog: Role/slot, Family, Brew Impact, Craft DC reduction, and Brew Tags.

Finished alchemy products now distinguish beneficial consumables from offensive delivery items. Potion/elixir cards no longer display a Save field merely because a generic `save_dc` number exists; a save is shown only when the payload also supplies a real save ability. This removes misleading Save DC values from beneficial items such as Elixir of Fire Resistance and Potion of Comprehension. Repeated effect/rules text that is identical to the summary is also suppressed.

Bomb cards now consume their existing canonical alchemy metadata instead of falling through to the generic item fields. Where available, the adaptive field grid exposes Use, Area, Save ability + DC, Damage dice/type, Duration, Condition, Repeat Save, and Charges. For example, Bomb of Lightning can surface its 10-foot burst, Dexterity save, enhanced save DC, 2d6 lightning damage, Instant duration, and use action without repeating the same effect paragraph twice.

No catalog rows were rewritten; this is a renderer correction over existing payload data.

The horizontal category scroller is also corrected. The chip row retains horizontal touch/wheel scrolling but hides its native bottom scrollbar. A synchronized scrollbar is rendered immediately above the chips, sized from the actual chip-row scroll width and kept in sync in both directions. This shared behavior applies to both normal MerchantPanel and Forge Equipment.

## 2026-10-14 crafting-preview ItemCard structure + deep rarity authority

The shared ItemCard now borrows the information hierarchy demonstrated by the existing Alchemy/Smithing preview cards while preserving the accepted shop-card footprint. The title/type header and centered rarity label remain first, followed by the short description + thumbnail row. A dedicated 3px rarity divider now sits immediately below that row. The divider uses the darker rarity anchor color with a subtle center highlight and restrained outer glow rather than a flat line.

Rarity now has two explicit visual tokens: a deep anchor color and a lighter accent. The deep color is authoritative for the ItemCard outer frame, header, divider, and merchant stock-row border. The lighter accent is reserved for rarity labels and glow. The shared merchant storefront uses the same deep/accent values, so normal MerchantPanel and Forge Equipment remain visually synchronized. Current deep anchors include Rare #204875, Uncommon #1f5937, Very Rare #4a276b, Legendary #734314, and Artifact #762b34.

Below the divider, ItemCard now supports an adaptive two-column field grid sourced from the existing normalized payload rather than a second rules engine. Armor/shields prioritize Armor Class, Strength requirement, Stealth, Weight, Attunement, and Properties when present. Weapons/ammunition prioritize Damage, Range, Weight, Attunement, and Properties. Potions/elixirs keep their main Effect visible and place Use, Duration, Save DC, and Doses/Charges into the structured field grid when those values exist. General gear uses Weight, Charges, Attunement, and Properties as available. Alchemy Modifiers keep their dedicated crafting-role block.

Long named secondary traits continue to use per-property chevrons, so the main description remains visible while complex items can expose individual properties without one giant uninterrupted rules block.

Shop ItemCards no longer repeat the item price in their internal footer; the storefront purchase footer remains the sole shop price/availability/action presentation. Non-shop ItemCards retain their existing price badge.

No item mechanics, crafting formulas, prices, stock data, or checkout authority changed.

## 2026-10-13 shared dark-rarity / breathing-selection / cart-edge pass

The Forge and normal MerchantPanel now share the same darker rarity presentation for merchant inventory rows and selected ItemCards. The storefront palette is intentionally deeper and less neon: mundane/common use dark steel tones, Uncommon dark green, Rare dark blue, Very Rare dark violet, Legendary dark amber, and Artifact dark crimson. Those tokens are owned by the shared MerchantPanel storefront stylesheet so both normal merchant shops and Forge Equipment receive the same treatment.

Rarity remains visible on every stock row at all times through the full outline, left scan stripe, dark tinted wash, and restrained glow. Hover/focus and the selected row now use a slow breathing scale animation, growing only slightly and then easing back without changing document flow. Selected rows receive the stronger glow. Reduced-motion users receive the same color treatment without animation.

The selected ItemCard uses the same shared darker rarity tokens, so its 4px frame and layered rarity header are also darker in both Forge and normal MerchantPanel contexts. The long-trait chevron formatting from the prior pass is already shared through ItemCard and therefore remains available in both storefronts.

The Forge Starting Cart is still Forge-only, but its minimized header presentation now fills the complete top-right merchant-header lane with no extra inset box around it. The remaining-gold value inside that cart header is larger, bold, and given a clearer high-contrast pill treatment.

No merchant inventory data, rarity values, checkout authority, cart arithmetic, character currency, or item mechanics changed.

## 2026-10-13 ItemCard property-chevrons + Forge purchase-footer follow-up

The Forge selected-item strip above the ItemCard is now removed. The ItemCard moves to the top of the preview pane, while purchase context is consolidated below it. Remaining gold is no longer repeated under the ItemCard because the Starting Cart already owns budget/spent/remaining tracking in greater detail. The purchase footer now shows only Price, Available quantity, and the Add/Buy action.

The minimized Starting Cart keeps the same basic shape but now fills the complete top-right header action lane instead of sitting as a smaller control inside that space.

Rarity treatment is more pronounced in two layers. ItemCards retain their existing geometry but now use a 4px rarity frame and a darker, more dimensional rarity-colored header built from layered radial/linear gradients. Merchant stock rows also carry strong rarity color at all times rather than only after selection: every row receives a rarity outline, left scan stripe, tinted wash, and subtle glow; the selected state increases the tint and glow further.

Long rules text now supports named secondary-property disclosures without collapsing the whole ItemCard. When an item description contains multiple short named trait headings followed by body text, the main introductory description remains visible and each named trait renders as its own chevron disclosure. This is intended for items such as Leather Golem Armor, where traits like Immutable Form, Lightning Absorption, Curse, Aversion of Fire, and Berserk can be inspected individually instead of forcing the player through one extremely tall uninterrupted rules block. Simple items continue to render exactly as plain rule text.

No item mechanics, merchant prices, cart authority, character currency, or crafting rules changed in this pass.

## 2026-10-13 ItemCard rarity/readability + Alchemy Modifier follow-up

The selected ItemCard keeps its established dimensions and layout, but receives the requested visual-strength pass: the rarity border is now 3px around the full card, and the header is a near-solid rarity-colored gradient rather than a mostly-purple header with only a thin rarity accent. Equipment-only ItemCard text is also raised above the shared storefront compact floor for better readability without changing the card footprint.

Live data inspection clarified the Freedom Resin case. Freedom Resin is not a finished potion or consumable result; it is a canonical Rare `Alchemy Modifier` from the DNDNext Alchemy Codex. Its payload identifies it as a `Fourth-slot condition counteragent`, family `Enhancer / Catalyst`, with brew tag `Restraint`, zero Craft DC reduction, and `Recipe theme component` impact. The codex metadata explicitly says the selected recipe determines the finished brew behavior.

ItemCard now recognizes this modifier payload. Instead of showing duplicate flavor text followed by meaningless Damage / Range / Properties dashes, an Alchemy Modifier section shows Role, Family, Brew tag, Craft DC impact, and a clear note that the selected recipe determines the final brew effect and duration. Finished potions/elixirs continue to use their existing Potion Details fields.

No catalog rows or crafting formulas were modified in this pass; this is a presentation/normalization correction over existing canonical payload data.

## 2026-10-13 Equipment readability and rarity-outline follow-up

The latest side-by-side review found two remaining Forge-only presentation issues before the planned ItemCard visual redesign.

First, the Forge stock-browser text had remained below the normal MerchantPanel readability floor. The Equipment step now matches the MerchantPanel small-text sizing for merchant subline/kicker text, search/category controls, stock-row title/price/meta/description text, and the Campaign Merchants rail.

Second, the active Forge stock bubbles were defaulting to the mundane gray `--rarity-color` because the current MerchantPanel-derived path did not define the canonical rarity variables for `rarity-uncommon`, `rarity-rare`, and higher classes. Equipment now uses the canonical merchant palette directly: Common `#ced4da`, Mundane `#aab2bd`, Uncommon `#55d17a`, Rare `#5aa7f3`, Very Rare `#a67cf3`, Legendary `#f3b24d`, and Artifact `#e85d5d`.

The rarity color now outlines the entire middle-column stock bubble instead of appearing only as a left-side stripe. The left edge remains slightly stronger as a scan affordance, while hover/selected states preserve the same rarity color around the complete border.

The ItemCard itself is intentionally unchanged in this pass. Its upcoming redesign remains a separate visual-only task after the Equipment storefront geometry is accepted.

## 2026-10-13 MerchantPanel horizontal-balance follow-up

The latest side-by-side comparison showed that the Forge Equipment selected ItemCard was still narrower than the normal MerchantPanel while the middle stock browser was substantially wider.

Desktop Equipment now uses a roughly 54/46 stock-list-to-preview split instead of the previous approximately 62/38 split. This makes the selected ItemCard meaningfully wider for readability while preserving a 285px minimum stock-list column on large desktop layouts. That minimum is deliberate so the stock bubbles can later accommodate a small leading item icon without requiring another major layout reflow.

The ItemCard itself is not visually redesigned in this pass. Its current expanded presentation and dimensions remain the baseline while the future card redesign is deferred until the Equipment storefront geometry is accepted.

## 2026-10-13 MerchantPanel height-parity correction

The latest side-by-side browser video showed that the previous “vertical balance” pass solved the wrong problem: it compressed content inside the existing short Forge window instead of matching the normal MerchantPanel’s taller canvas.

The Character Forge modal now receives an explicit `is-step-equipment` class while the Equipment step is active. On desktop, a non-manually-resized Equipment Forge window fills the same usable vertical window envelope as the normal profile/merchant panel: `100dvh - navbar offset - 32px`. The Forge header, step bar, and footer remain intact; the Equipment body flexes to consume the remaining height.

The last stock-row/chrome compression is intentionally overridden for the active Equipment step. MerchantPanel-like header padding, toolbar height, category chips, two-line stock descriptions, stock-row spacing, preview padding, and cart-header size are restored. The selected ItemCard remains fully expanded. Extra visible stock and taller merchant art now come from the taller outer Forge canvas rather than from making the storefront elements smaller.

Manually dragged/resized app-window geometry remains respected because this default-height rule applies only while the Forge is not `is-app-windowed`.

## 2026-10-13 MerchantPanel vertical-balance follow-up

The normal MerchantPanel is now the accepted vertical-density reference for the Forge Equipment tab. The Forge keeps its narrower selected-item column and integrated merchant-art background, but now gives the vendor frame the full available Equipment body height.

The previous storefront container still reserved an obsolete `auto` grid row from the older top-purse/cart layout even though the Starting Cart has moved into the merchant header. That dead row is removed; the storefront now uses a single `minmax(0,1fr)` row. Equipment workspace padding, vendor-frame padding, header/cart height, toolbar spacing, and preview chrome are also reduced slightly so those pixels become usable merchant art and stock-list height.

The selected ItemCard remains fully expanded. The stock browser is denser instead: stock descriptions are clamped to one line in Forge, row/meta spacing is tightened, and the existing dedicated stock scrollbar remains authoritative. The intent is to expose roughly one to two additional stock rows at desktop heights while preserving the taller selected-card presentation.

No normal MerchantPanel styling, commerce authority, stock generation, character currency, or protected world-map behavior changed in this pass.

## 2026-10-13 sharp overlay / expanded ItemCard / stock-scroll follow-up

The latest browser comparison showed three Forge-only defects after the integrated-background pass. The normal MerchantPanel's selected ItemCard was preferred because its rules/details are fully open; the Forge still passed `detailsCollapsible: true`. The Forge now passes `detailsCollapsible: false`, so selected starting-equipment ItemCards always render their complete rules/stat/source content and naturally use the taller preview presentation.

The translucent Equipment composition is retained, but all Forge Equipment `backdrop-filter: blur(...)` effects have been removed. Merchant art remains visible behind the rail, stock, preview, and cart surfaces without optical blur; the stage media itself is also rendered with no filter override in the final desktop rule.

The non-scrolling Equipment stock list was a height-ownership defect. The stock workspace remains the full-height grid cell, while exactly one child—the `merchant-stock-layout` flex region—now owns the remaining height using `flex: 1 1 0`, `height: 0`, and `min-height: 0`. The stock list then fills that bounded region with `height: 100%` and `overflow-y: auto`. This deliberately avoids restoring the earlier chained zero-height constraints that collapsed the storefront.

No commerce, currency, stock-generation, materialization, or protected world-map authority changed in this follow-up.

## 2026-10-13 integrated Equipment storefront composition

A follow-up browser/video review established that the normal merchant panel was at an acceptable native scale, while the Forge Equipment tab still read too large and too segmented. The Forge-only presentation now treats the active merchant artwork as a full-stage background rather than confining atmosphere to the scene column.

The active merchant is rendered through `MerchantAmbientBackdrop` behind the Campaign Merchants rail, storefront header, stock workspace, and selected-item preview. The scene itself remains the brightest/readable portion, while the rail, stock controls, rows, and preview use translucent dark surfaces and blur so the same merchant environment bleeds behind them without sacrificing legibility.

Desktop proportions were rebalanced around the review target: the Campaign Merchants rail is slightly wider, the merchant scene receives most of the reclaimed width, and the selected-item preview is approximately one-third narrower than the prior Forge split. The stock list receives the rest of the reclaimed workspace.

The Starting Cart no longer defaults to an expanded floating window. In the Forge it now uses `presentation="header"`, starts collapsed, and occupies the storefront's top-right header action position that previously showed only the remaining-GP badge. Expanding it opens an overlay below the header without changing the merchant scene, stock, or preview geometry. The existing floating and rail presentations remain available for other contexts.

This pass is presentation-only. Starting-market purchases, server validation/materialization, character currency, merchant stock authority, and all protected world-map systems are unchanged.

## 2026-10-12 shared storefront + balanced prototype merchant stock

The Equipment storefront and the normal runtime merchant shop now render the same shared presentation component, `components/MerchantStorefrontView.js`. The transaction controllers remain separate: runtime `MerchantPanel` still owns the account wallet, `buy_from_merchant`, admin stock controls, and merchant travel controls; Player Forge still owns only the starting purse, staged `marketPurchases[]`, and the server-authoritative creation materializer.

The Forge keeps Campaign Merchants as the separate left rail. Inside the active storefront, both contexts now share the merchant header, scene, Search Stock/category controls, scrollable stock list, selected ItemCard preview, rarity treatment, and layout hierarchy. Forge-specific actions substitute Starting Gold Remaining and Add to Starting Cart for the runtime wallet/purchase action.

Unspent starting-market currency continues to be materialized server-side into `public.character_currency` by the deferred `character_progression` trigger. The Equipment summary now labels this explicitly as `Remaining → wallet`; no account-wide player wallet is used.

Routine merchant stock generation now draws from the complete canonical `public.items_catalog` but uses explicit rarity shelves instead of allowing one global ranking to determine rarity accidentally. Prototype storefronts are regenerated at 30 rows each. The baseline target is approximately 57% Mundane/Common, 33% Uncommon, and the remaining few rows Rare; routine rerolls exclude Very Rare, Legendary, and Artifact stock. Specialist merchants may reserve one recipe row, but that recipe is also capped at Rare or below. Theme affinity and item-type diversity determine which catalog entries win inside each rarity shelf.

Because no storefront inventory is manually curated in the prototype phase, all currently enabled storefronts were refreshed against the new rule. The live verification after the recipe cap shows 30 stock rows per enabled storefront and zero Very Rare/Legendary/Artifact rows.

The merchant presentation also received a native 100%-browser-zoom density pass. The previous embedded merchant profile sizing was visually comfortable only around 80% browser zoom; the CSS now uses smaller desktop shell width, spacing, typography, stock-row padding, and preview padding instead of relying on browser zoom or CSS transforms. Forge Equipment receives the corresponding density reduction while preserving its bounded scroll regions and stable merchant-image framing.

No world-map, route simulation, weather, combat, crafting formulas, account-wallet authority, or character-creation transaction boundaries were changed by this pass.

## 2026-10-12 stable merchant image framing

The follow-up video showed that switching stock categories could still change the apparent merchant-image zoom. The image itself was not changing; the scene box was still allowed to follow the filtered workspace's content height, and `background-size: cover` recalculated the crop whenever that box changed.

The Forge merchant shell is now hard-bounded to the remaining Equipment viewport (`flex: 1 1 0; height: 0`) so item filters cannot resize the scene. The left merchant image also returns to the established live MerchantPanel behavior: the profile/shop portrait is preferred over storefront art and is rendered with `contain` rather than `cover`. That keeps the profile portrait at one stable zoom/crop while switching All, Melee Weapon, Armor, or other categories. Dedicated storefront art remains the fallback when a merchant has no profile/shop portrait.

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
