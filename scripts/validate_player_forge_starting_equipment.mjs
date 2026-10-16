import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const migration = read("sql/20260808_49_player_forge_starting_equipment_currency.sql");
const marketMigration = read("sql/20261010_01_player_forge_starting_market.sql");
const homebrewMigration = read("sql/20261011_02_player_forge_homebrew_starting_budget.sql");
const utility = read("utils/playerForgeStartingEquipment.js");
const controller = read("components/useNpcForgeController.js");
const core = read("components/NpcForgeCoreSupport.js");
const equipmentStep = read("components/NpcForgeEquipmentStep.js");
const forgeMerchantMarket = read("components/NpcForgeMerchantMarket.js");
const sharedStorefront = read("components/MerchantStorefrontView.js");
const merchantPanel = read("components/MerchantPanel.js");
const equipmentDock = read("components/NpcForgeEquipmentSummaryDock.js");
const cartDrawer = read("components/NpcForgeStartingCartDrawer.js");
const workshopPane = read("components/MerchantWorkshopPane.js");
const merchantRail = read("components/MerchantRail.js");
const waresList = read("components/MerchantWaresList.js");
const merchantBackdrop = read("components/MerchantAmbientBackdrop.js");
const merchantMedia = read("utils/merchantStorefrontMedia.js");
const merchantTheme = read("utils/merchantTheme.js");
const itemVisuals = read("utils/itemVisuals.js");
const itemCard = read("components/ItemCard.js");
const cardCompact = read("styles/card-compact.css");
const merchantStyles = read("styles/merchant-storefront.css");
const equipmentStyles = read("styles/player-forge-equipment-market.css");
const npcShopFill = read("styles/npc-shop-embedded-fill.css");
const app = read("pages/_app.js");
const merchantExpansion = read("sql/20261011_03_starting_market_merchant_expansion.sql");
const merchantVariety = read("sql/20261011_04_merchant_catalog_reroll_variety.sql");
const merchantDistribution = read("sql/20261012_02_merchant_stock_distribution.sql");
const merchantRecipeCap = read("sql/20261012_03_merchant_recipe_rarity_cap.sql");
const dawnStorefrontMetadata = read("sql/20261011_05_dawn_storefront_metadata.sql");
const dawnStorefrontMedia = read("sql/20261012_01_dawn_whiteflame_media.sql");
const derived = read("components/useNpcForgeDerivedModel.js");
const modal = read("components/NewNpcModalV3Refined.js");

const need = (source, token, label = token) => {
  if (!source.includes(token)) throw new Error(`Missing ${label}: ${token}`);
};
const forbid = (source, token, label = token) => {
  if (source.includes(token)) throw new Error(`Forbidden ${label}: ${token}`);
};

for (const token of [
  "create table if not exists public.character_currency",
  "character_id uuid primary key",
  "copper_value bigint not null default 0",
  "source_breakdown jsonb",
  "('artificer','EFA'",
  "('barbarian','XPHB'",
  "('bard','XPHB'",
  "('cleric','XPHB'",
  "('druid','XPHB'",
  "('fighter','XPHB'",
  "('monk','XPHB'",
  "('paladin','XPHB'",
  "('ranger','XPHB'",
  "('rogue','XPHB'",
  "('sorcerer','XPHB'",
  "('warlock','XPHB'",
  "('wizard','XPHB'",
  "'{startingEquipment,defaultData}'",
  "player_forge_equipment_choice_allowed_v1",
  "get_player_forge_starting_equipment_v1",
  "materialize_player_forge_starting_equipment_v1",
  "character_progression_materialize_player_forge_starting_equipment_v1",
  "deferrable initially deferred",
  "'character',p_character_id::text",
  "startingEquipmentSelections",
  "startingEquipmentSummary",
  "startingCurrencyCopper",
  "higherLevelMagicItemGuide",
  "private.player_forge_higher_level_wealth_v1",
  "(500+v_roll*25)*100",
  "(5000+v_roll*250)*100",
  "(20000+v_roll*250)*100",
  "jsonb_build_object('common',1,'uncommon',1)",
  "jsonb_build_object('common',2,'uncommon',3,'rare',1)",
  "jsonb_build_object('common',2,'uncommon',4,'rare',3,'veryRare',1)",
  "get_character_currency_v1",
]) need(migration, token);

forbid(migration, "player_wallets", "account wallet usage");
forbid(migration, "owner_type,'player'", "account-scoped starter inventory");
forbid(migration, "'player',p_character_id", "player owner type starter inventory");
forbid(migration, "insert into public.items_catalog", "invented catalogue items");
forbid(migration, "item_rarity in ('common','uncommon','rare','very rare')", "automatic higher-level magic item grant");
forbid(migration, "MapPageClient", "world-map crossover");
forbid(migration, "map_routes", "world-route crossover");
forbid(migration, "weather", "world-weather crossover");

for (const token of [
  "normalizeEquipmentOptions",
  "equipmentChoiceKey",
  "equipmentPartNeedsChoice",
  "higherLevelCopper",
  "higherLevelWealthRule",
  "magicAllowanceLabel",
  "startingEquipmentSelectionComplete",
  "startingCurrencyCopper",
  "formatCopper",
  "keepStartingGold",
  "(500 + d10 * 25) * 100",
  "(5000 + d10 * 250) * 100",
  "(20000 + d10 * 250) * 100",
]) need(utility, token);
need(utility, "model?.sourceIncomplete && startingEquipmentRuleset(selection) === PLAYER_FORGE_EQUIPMENT_RULESETS.VANILLA", "partial-source vanilla guard");

for (const token of [
  '"Spells", "Equipment", "Identity"',
  "startingEquipment: {}",
]) need(core, token);

for (const token of [
  "get_player_forge_starting_equipment_v1",
  "normalizeStartingEquipmentSelection",
  "startingEquipmentSelectionComplete",
  "equipmentModel",
  'key === "equipment"',
  "startingEquipment: {}",
  "sourceIncomplete: true",
  "missingClass: !selectedClass?.id",
  "missingBackground: !selectedBackground?.id",
]) need(controller, token);

need(modal, 'stepKey === "equipment" ? "is-step-equipment" : ""', "Equipment-specific Forge window class");

for (const token of [
  "startingMarketBudgetCopper",
  "startingMarketRemainingCopper",
  "marketPurchases",
  "keepFullPurse",
  "keepStartingGold",
  'from("characters")',
  'from("character_stock")',
  "MerchantRail",
  "NpcForgeMerchantMarket",
  "NpcForgeEquipmentSummaryDock",
  'presentation="header"',
  "MerchantAmbientBackdrop",
  'className="forge-equipment-stage-backdrop"',
  "headerActions={cartControl}",
  "Preparing the starting market…",
  "sourceIncomplete",
  "Using the DNDNext 300 gp starting-market floor for this preview.",
  "storefront_bg_video_url",
  "storefront_bg_image_url",
]) need(equipmentStep, token);

for (const token of [
  "MerchantStorefrontView",
  "merchant-panel-inner merchant-market merchant-storefront-shared merchant-panel-forge",
  "resolveMerchantPortrait",
  "resolveMerchantStorefrontMedia",
  "const sceneImage = portrait || media.imageUrl",
  "--merchant-bg-position",
  "--merchant-bg-size",
  "rarityClass",
  "rarityBadgeClass",
  "Starting equipment merchant",
  "Unspent starting gold becomes this character's wallet balance",
  "(media.videoUrl || !sceneImage)",
  'variant: "shop"',
  "detailsCollapsible: false",
  "showPreviewHeader={false}",
  '{ label: "Price"',
  '{ label: "Available"',
]) need(forgeMerchantMarket, token, "shared MerchantPanel-derived Forge storefront");
for (const token of [
  "merchant-market-header",
  "merchant-market-shell",
  "merchant-scene",
  "merchant-stock-workspace",
  "merchant-stock-layout",
  "merchant-stock-list",
  "merchant-preview-pane",
  "ItemCard",
  "previewMetrics",
  "showPreviewHeader",
  "actionLabel",
  "quantityFor",
  "title={rowDescription}",
  "showSceneCopy",
  "ammunitionFactsForCard",
  "Max range halved",
  "Spell attacks",
  "Spell save DC",
]) need(sharedStorefront, token, "shared merchant storefront presentation");
for (const token of [
  'import MerchantStorefrontView from "./MerchantStorefrontView";',
  "merchant-storefront-shared",
  "desiredCount = 28 + Math.floor(Math.random() * 5)",
  "const nLow",
  "const nUncommon",
  "const nRare",
  'itemCardProps={{ variant: "shop", detailsCollapsible: false }}',
  'headerKicker=""',
  "merchant-market-theme-pill",
  "showSceneCopy={false}",
]) need(merchantPanel, token, "normal MerchantPanel shared storefront adoption");
forbid(forgeMerchantMarket, "buy_from_merchant", "normal merchant checkout inside Forge storefront");
forbid(forgeMerchantMarket, "useWallet", "account wallet hook inside Forge storefront");

forbid(equipmentStep, "npc-forge-starting-market__budgetbar", "duplicated in-workspace budget strip");
forbid(equipmentStep, "buy_from_merchant", "account-wallet merchant checkout inside Forge");
forbid(equipmentStep, "useWallet", "account wallet hook inside Forge");

for (const token of [
  "createPortal",
  'presentation = "floating"',
  'presentation === "rail"',
  'presentation === "header"',
  'presentation !== "rail"',
  "Starting cart",
  "Total gold",
  "Spent",
  "Remaining → wallet",
  "keepStartingGold",
  "onKeepFullPurse",
  "rollRequired",
  "onRollWealth",
  "Higher-level wealth",
  "No starting gear",
  "Keep all starting gold",
]) need(equipmentDock, token, "reusable Equipment feature-window summary dock");

for (const token of [
  "Starting cart",
  "Total gold",
  "Spent",
  "Remaining",
  "Vanilla source purse",
  "Class source cash",
  "Background source cash",
  "DM guide only",
  "forge-starting-cart-drawer",
]) need(cartDrawer, token, "Forge starting-cart drawer");

for (const token of ["MerchantAmbientBackdrop", "merchantShopLabel", "merchantTagline", "forge-merchant-workshop", "showBackdrop = true", "showBackdrop ? <MerchantAmbientBackdrop"]) need(workshopPane, token, "merchant workshop pane");
for (const token of ["resolveMerchantPortrait", "merchantInitials", "themeFromMerchant", "Campaign merchants", "merchant-rail__merchant", "merchant-rail__portrait-fallback"]) need(merchantRail, token, "merchant rail");
forbid(merchantRail, "merchantTagline", "unreadable third-line merchant rail tagline");
need(equipmentStyles, "font-size: .58rem;", "larger Forge merchant role label");
need(equipmentStyles, "font-size: .72rem;\n    line-height: 1.32;\n    white-space: nowrap;", "larger single-line Forge stock summary");
for (const token of ["resolveItemVisual", "raritySlug", "rarityClass", "rarityRowClass", "rarity-", "merchant-stock-row", "Search stock", "Sort", "merchant-category-chip", "is-rarity-"]) need(waresList, token, "merchant-overlay wares list");
forbid(waresList, "resolveMerchantStorefrontMedia", "duplicate per-column storefront background");
forbid(waresList, "forge-merchant-wares__scene", "duplicate Wares scene background");
for (const token of ["LOOP_TAIL_SECONDS", "muted", "playsInline", "prefers-reduced-motion"]) {
  if (token === "prefers-reduced-motion") need(merchantStyles, token, "merchant reduced-motion support");
  else need(merchantBackdrop, token, "merchant ambient backdrop");
}
for (const token of ["storefront_bg_video_url", "storefront_bg_image_url", "portrait_shop_url", "portrait_thumb_url", "THEME_BACKDROPS", "merchantInitials", "themeFromMerchant"]) need(merchantMedia, token, "merchant media resolver");
for (const token of ["asMerchantRecord", "const record = asMerchantRecord(merchant)"]) need(merchantMedia, token, "null-safe merchant media resolver");
for (const token of ['const merchantRecord = m && typeof m === "object" ? m : {}', "merchantRecord.icon", "merchantRecord.storefront_title"]) need(merchantTheme, token, "null-safe merchant theme resolver");
forbid(merchantMedia, '|| "/parchment.jpg"', "shared character portrait fallback in storefront media");
forbid(merchantMedia, "/merchant-backgrounds/", "phantom theme-image fallback path");
forbid(merchantMedia, "merchant.description", "character biography as shop tagline");
for (const token of ["resolveItemVisual", "explicitItemImage", "FALLBACKS", "NAME_FALLBACKS", "Material: { icon:", "Recipe: { icon:", "Bomb: { icon:", '"Plant / Herb": { icon:']) need(itemVisuals, token, "item visual fallback resolver");
for (const token of ['variant = "default"', "detailsCollapsible", "sitem-game-details", "sitem-thumb-fallback", "resolveItemVisual", "alchemyModifierDetailsForItem", "merchantCraftedAlchemyDetails", "sitem-alchemy-modifier-grid", "Contribution", "ruleDuplicatesFlavor", "namedRuleSections", "sitem-rule-trait", "structuredRules.traits.map", "adaptiveItemFields", "sitem-field-grid", "sitem-rarity-divider", 'variant !== "shop"', "alchemyIngredientDetailsForItem", "bombDetailsForItem", "normalizedComparableText", 'clean("Area"', 'clean("Damage"', "saveAbilityValue && saveDcValue", "sitem-alchemy-ingredient-grid", "function playerText", "function craftedByName", "function splitNarrativeLead", "function cardFamilyForItem", "function armorClassDisplay", "function weaponRangeDisplay", "function ruleMetrics", "function ammunitionMechanics", 'clean("Damage Type"', 'clean("Mastery"', 'clean("Spell Attack Bonus"', 'clean("Spell Save DC Bonus"', "ammunitionRulesOnly", 'sitem-family-${cardFamily}', "sitem-crafted-by", "sitem-detail-stack--", "Dex (no max)" ]) need(itemCard, token, "shared ItemCard shop variant");
for (const token of ["2026-10-11 storefront ItemCard readability floor", "2026-10-13 stronger ItemCard rarity frame", "2026-10-13 ItemCard dark-rarity art pass + trait chevrons", "2026-10-14 crafting-preview ItemCard structure + deep rarity tokens", ".sitem-rarity-divider", ".sitem-field-grid", "--sitem-rarity-deep: #204875", "--sitem-rarity-accent: #4d8fd4", "border-width: 4px", ".sitem-rule-trait > summary::after", ".sitem-card.is-shop-variant .sitem-title", "font-size: 1rem", ".sitem-card.is-shop-variant .sitem-section", "border: 3px solid var(--sitem-rarity-color)", "color-mix(in srgb, var(--sitem-rarity-color) 82%", "2026-10-15 approved eight-family ItemCard standard", ".sitem-rarity-divider__crystal", ".sitem-detail-stack--armor .sitem-rule-traits", "--sitem-rarity-deep: #434b55"]) need(cardCompact, token, "shop ItemCard readability");
for (const token of ["MerchantCategoryScroller", "useRef", "useState", "ResizeObserver", "merchant-category-scrollbar", "merchant-category-scrollbar__spacer", "stockFactsForCard", "playerFacingItemText", "merchant-stock-row-fact"]) need(sharedStorefront, token, "top merchant category scrollbar");
need(merchantStyles, ".merchant-market-theme-pill", "moved merchant theme badge");
for (const token of [".merchant-rail", ".sitem-thumb-fallback", ".merchant-ambient-backdrop__fallback", ".merchant-rail__portrait-fallback", ".forge-merchant-workshop", ".forge-merchant-wares", ".is-rarity-uncommon", ".is-rarity-rare", ".is-rarity-very-rare", ".is-rarity-legendary", ".is-rarity-artifact", ".forge-merchant-wares__row.rarity-uncommon", ".forge-merchant-wares__row.rarity-very-rare", "--rarity-color", "2026-10-12 unified Equipment scene + canonical rarity pass", "2026-10-12 Forge Wares scrolling hotfix", "2026-10-12 native 80%-reference storefront density", "merchant-storefront-shared .sitem-card.is-shop-variant .sitem-title", "overflow-y: auto !important", "scrollbar-gutter: stable", "2026-10-13 shared dark-rarity storefront energy pass", "2026-10-14 shared deep/accent rarity authority", "2026-10-14 category-scrollbar + alchemy-card readability pass", ".merchant-category-stack", ".merchant-category-scrollbar.is-active", ".merchant-category-row::-webkit-scrollbar", "2026-10-14 single-line merchant row summaries", "text-overflow: ellipsis", "--merchant-rarity-rare: #204875", "--merchant-rarity-rare-accent: #4d8fd4", "--merchant-rarity-rare: #2b568f", "--merchant-rarity-uncommon: #286f46", "@keyframes merchant-rarity-breathe", "animation: merchant-rarity-breathe 3.5s ease-in-out infinite", ".merchant-storefront-shared .sitem-card:has(.sitem-header.rarity-rare)", "2026-10-15 merchant readability + shared baseline rarity pass", "--merchant-rarity-common: var(--merchant-rarity-mundane)", ".merchant-stock-row-meta .merchant-stock-row-fact"]) need(merchantStyles, token, "shared merchant storefront styles");
for (const token of ["current accepted visual reference is the 90% browser-zoom view", "width: min(840px, calc(100vw - 1.25rem))"]) need(npcShopFill, token, "embedded MerchantPanel 90-percent reference density");
for (const token of [".npc-forge-equipment-storefront", ".forge-equipment-vendor-frame", ".forge-equipment-merchant-panel", ".forge-equipment-merchant-market-shell", ".npc-forge-equipment-summary-dock__no-gear", ".npc-forge-equipment-summary-dock__wealth", ".npc-forge-equipment-summary-dock.is-header", "merchant-stock-row.rarity-mundane", "--rarity-color", "grid-template-columns: 132px minmax(0, 1fr)", "flex: 1 1 auto", "height: auto", "overflow-y: auto !important", "overscroll-behavior: contain", "--merchant-bg-position", "--merchant-bg-size", "background-size: var(--merchant-bg-size, contain)", "2026-10-12 MerchantPanel-derived Equipment pivot", "2026-10-12 Equipment MerchantPanel scroll + scene-fit correction", "2026-10-12 stable merchant portrait framing", "2026-10-12 native 80%-reference Equipment density", "2026-10-13 integrated Equipment storefront composition", "2026-10-13 Forge sharpness + stock-scroll correction", "2026-10-13 MerchantPanel vertical-balance pass", "2026-10-13 MerchantPanel-height parity correction", "2026-10-13 MerchantPanel horizontal-balance pass", "2026-10-13 Equipment readability + full rarity-outline pass", "2026-10-13 Equipment ItemCard readability bump", "2026-10-13 Equipment purchase-footer + rarity-energy pass", "grid-template-columns: minmax(0,1fr) minmax(270px, 32%)", "font-size: .74rem", ".merchant-stock-row.rarity-uncommon", "--rarity-color: #55d17a", ".merchant-stock-row.rarity-rare", "--rarity-color: #5aa7f3", "border: 1px solid color-mix(in srgb, var(--rarity-color) 68%", "font-size: .72rem", "font-size: .60rem", ".npc-forge-modal-v2.is-player-mode.is-step-equipment:not(.is-app-windowed)", "height: calc(100dvh - var(--dndnext-window-nav-offset, 58px) - 32px)", "grid-template-columns: minmax(285px, 1.08fr) minmax(300px, .92fr)", "grid-template-columns: minmax(330px, 1.12fr) minmax(0, 1.88fr)", "grid-template-columns: minmax(300px,1fr) minmax(220px,.60fr)", "grid-template-rows: minmax(0,1fr)", "-webkit-line-clamp: 1", "flex: 1 1 0", "height: 0", "height: 100%", "2026-10-13 Forge cart-edge + dark-rarity parity pass", ".merchant-market-header {\n    padding: 0 !important", "font-size: .72rem", "var(--merchant-rarity-rare)", "animation: merchant-rarity-breathe 3.5s ease-in-out infinite", "2026-10-15 Equipment 90%-view balance pass", "grid-template-columns: minmax(270px, 1.02fr) minmax(320px, .98fr)", "font-size: .77rem"]) need(equipmentStyles, token, "Forge Equipment MerchantPanel-derived layout");
forbid(equipmentStyles, "backdrop-filter: blur(", "Forge Equipment backdrop blur");
need(app, 'import "../styles/merchant-storefront.css";', "shared merchant stylesheet import");
need(app, 'import "../styles/player-forge-equipment-market.css";', "Forge Equipment stylesheet import");

for (const token of [
  "cashOnlyEquipmentOption",
  "startingEquipmentRuleset",
  "startingMarketVanillaCopper",
  "DNDNEXT_STARTING_MARKET_FLOOR_COPPER",
  "startingMarketBaseCopper",
  "startingMarketPurchases",
  "startingMarketSpentCopper",
  "startingMarketBudgetCopper",
  "startingMarketRemainingCopper",
  'mode: "market"',
]) need(utility, token, "starting-market utility");

for (const token of [
  "player_forge_cash_equipment_option_v1",
  "v_mode='market'",
  "marketPurchases",
  "for update of cs",
  "merchant.storefront_enabled is true",
  "Starting-market purchases exceed the source-backed starting purse.",
  "'startingMarket',true",
  "'character',p_character_id::text",
  "delete from public.character_stock",
  "update public.character_stock",
  "'marketSpentCopper'",
  "startingCurrencyCopper",
]) need(marketMigration, token, "starting-market server authority");

forbid(marketMigration, "player_wallets", "starting-market account wallet usage");
forbid(marketMigration, "owner_type,'player'", "starting-market account inventory");
forbid(marketMigration, "MapPageClient", "starting-market world-map crossover");
forbid(marketMigration, "map_routes", "starting-market route crossover");
forbid(marketMigration, "weather", "starting-market weather crossover");

for (const token of [
  "dndnext-homebrew",
  "30000::bigint",
  "greatest(v_package_copper,30000::bigint)",
  "'vanillaSourceCopper',v_package_copper",
  "'homebrewBaseFloorCopper',30000",
  "startingEquipmentRuleset",
  "Unknown Player Forge starting-equipment ruleset.",
]) need(homebrewMigration, token, "DNDNext homebrew starting-budget authority");

forbid(homebrewMigration, "player_wallets", "homebrew starting-budget account wallet usage");
forbid(homebrewMigration, "MapPageClient", "homebrew starting-budget world-map crossover");
forbid(homebrewMigration, "map_routes", "homebrew starting-budget route crossover");

for (const token of [
  "startingEquipmentSelections",
  "backgroundId: selectedBackground?.id || null",
]) need(derived, token);

for (const token of [
  'import NpcForgeEquipmentStep from "./NpcForgeEquipmentStep";',
  'stepKey === "equipment"',
  "equipmentModel",
  "draft.startingEquipment",
]) need(modal, token);

for (const token of [
  "dawn whiteflame",
  "General goods merchant",
  "General Goods",
  "Quality gear for every journey.",
]) need(dawnStorefrontMetadata, token, "Dawn storefront metadata correction");

for (const token of [
  "dawn whiteflame",
  "/merchant-media/dawn-whiteflame/storefront.webp",
  "/merchant-media/dawn-whiteflame/portrait.webp",
  "/merchant-media/dawn-whiteflame/thumb.webp",
  "storefront_bg_image_url",
  "portrait_shop_url",
  "portrait_thumb_url",
  "portrait_source = 'generated'",
  "storefront_bg_video_url = null",
]) need(dawnStorefrontMedia, token, "Dawn visual calibration media");

for (const token of [
  "Mara Ironvein",
  "Selene Quill",
  "Pell Mossgrove",
  "Brakka Wayfarer",
  "Ilyra Glasshand",
  "Torren Packswell",
  "reroll_merchant_inventory_v2",
]) need(merchantExpansion, token, "starting-market merchant expansion");

for (const token of [
  "from public.items_catalog ic",
  "v_total integer := least(greatest",
  "48",
  "row_number() over",
  "type_slot",
  "lower(coalesce(ic.item_type,'')) <> 'recipe'",
  "v_recipe_target",
  "perform * from public.reroll_merchant_inventory_v2(v.id,v.theme,36)",
]) need(merchantVariety, token, "full-catalog diversified merchant reroll");

for (const token of [
  "0.57",
  "0.33",
  "rarity_bucket",
  "in ('mundane','common')",
  "= 'uncommon'",
  "= 'rare'",
  "v_total-(select count(*) from merchant_reroll_pick)",
  "where c.storefront_enabled is true",
  "perform * from public.reroll_merchant_inventory_v2(v.id,v_theme,30)",
]) need(merchantDistribution, token, "balanced full-catalog merchant distribution");

for (const token of [
  "lower(coalesce(ic.item_rarity,'mundane')) in ('mundane','common','uncommon','rare')",
  "perform * from public.reroll_merchant_inventory_v2(v.id,v_theme,30)",
]) need(merchantRecipeCap, token, "routine merchant recipe rarity cap");
forbid(merchantRecipeCap, "very rare','legendary','artifact", "routine recipe high-rarity allowance");

for (const source of [utility, controller, equipmentStep, forgeMerchantMarket, sharedStorefront, equipmentDock, cartDrawer, workshopPane, merchantRail, waresList, merchantBackdrop, merchantMedia, itemVisuals, itemCard, cardCompact, merchantStyles, equipmentStyles, npcShopFill, derived, modal, merchantExpansion, merchantVariety, merchantDistribution, merchantRecipeCap, dawnStorefrontMetadata, dawnStorefrontMedia]) {
  for (const token of ["MapPageClient", "map_routes", "advance_all_characters", "weather"]) forbid(source, token, `protected world boundary ${token}`);
}

console.log("Player Forge starting market authority, shared MerchantPanel storefront composition, balanced 30-item merchant stock, character-wallet handoff, merchant rail, staged purchases, and protected boundaries validated.");
