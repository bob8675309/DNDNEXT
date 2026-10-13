import MerchantAmbientBackdrop from "./MerchantAmbientBackdrop";
import MerchantStorefrontView from "./MerchantStorefrontView";
import {
  merchantShopLabel,
  merchantTagline,
  resolveMerchantPortrait,
  resolveMerchantStorefrontMedia,
} from "../utils/merchantStorefrontMedia";
import { themeFromMerchant } from "../utils/merchantTheme";
import { formatCopper } from "../utils/playerForgeStartingEquipment";

function safeText(value) {
  return String(value ?? "").trim();
}

function raritySlug(value = "") {
  return safeText(value || "Mundane")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "mundane";
}

function rarityClass(value = "") {
  return `rarity-${raritySlug(value)}`;
}

function rarityBadgeClass(value = "") {
  return `is-rarity-${raritySlug(value)}`;
}

export default function NpcForgeMerchantMarket({
  merchant = null,
  items = [],
  categories = ["All"],
  selectedCard = null,
  query = "",
  typeFilter = "All",
  loading = false,
  error = "",
  notice = "",
  remainingCopper = 0,
  onQueryChange = null,
  onTypeFilterChange = null,
  onSelect = null,
  onAdd = null,
  canAddItem = null,
  selectedActionLabel = "Add to Starting Cart",
}) {
  if (!merchant) {
    return <section className="merchant-panel-inner merchant-market merchant-panel-forge forge-equipment-merchant-panel is-loading">
      <div className="merchant-market-empty">Loading campaign storefront…</div>
    </section>;
  }

  const theme = themeFromMerchant(merchant);
  const media = resolveMerchantStorefrontMedia(merchant);
  const portrait = resolveMerchantPortrait(merchant);
  const sceneImage = portrait || media.imageUrl;
  const shopLabel = merchantShopLabel(merchant);
  const tagline = merchantTagline(merchant);
  const stockLabel = loading
    ? "Loading stock"
    : `${items.length} item${items.length === 1 ? "" : "s"} shown`;

  const sceneStyle = sceneImage ? {
    "--merchant-bg": `url("${sceneImage}")`,
    "--merchant-bg-position": portrait ? "center top" : "center center",
    "--merchant-bg-size": "contain",
  } : undefined;

  const selectedAvailable = Math.max(0, Number(selectedCard?._available_qty || 0));
  const addEnabled = Boolean(selectedCard) && (typeof canAddItem !== "function" || canAddItem(selectedCard));

  return <MerchantStorefrontView
    merchant={merchant}
    rootClassName="merchant-panel-inner merchant-market merchant-panel-forge forge-equipment-merchant-panel"
    headerKicker="Starting equipment merchant"
    title={`${merchant.name || "Merchant"}’s Wares`}
    subline={`${shopLabel} · ${stockLabel}`}
    headerActions={<span className="merchant-wallet-badge" title="Unspent starting gold becomes this character's wallet balance when creation finishes.">
      {formatCopper(remainingCopper)} left
    </span>}
    notice={notice}
    shellClassName="forge-equipment-merchant-market-shell"
    sceneClassName={`forge-equipment-vendor-scene is-${theme}`}
    sceneStyle={sceneStyle}
    sceneMedia={media.videoUrl ? <MerchantAmbientBackdrop merchant={merchant} className="forge-equipment-vendor-ambient" /> : null}
    theme={theme}
    sceneTitle={shopLabel || "Curated wares"}
    sceneTagline={tagline || "Browse the merchant’s current stock and choose what this character carries into the campaign."}
    workspaceClassName="forge-equipment-merchant-stock"
    query={query}
    onQueryChange={onQueryChange}
    searchPlaceholder="Name, rarity, type, source, or description"
    categories={categories}
    typeFilter={typeFilter}
    onTypeFilterChange={onTypeFilterChange}
    error={error}
    loading={loading}
    items={items}
    selectedCard={selectedCard}
    onSelect={onSelect}
    stockAriaLabel={`${merchant.name || "Merchant"} stock`}
    rarityClassFor={rarityClass}
    rarityBadgeClassFor={rarityBadgeClass}
    showSource
    quantityFor={(card) => Math.max(0, Number(card?._available_qty ?? card?._stock_qty ?? 0))}
    itemCardProps={{ variant: "shop", detailsCollapsible: true }}
    previewMetrics={[
      { label: "Available", value: selectedAvailable },
      { label: "Remaining", value: formatCopper(remainingCopper) },
    ]}
    actionLabel={selectedActionLabel}
    actionDisabled={!addEnabled}
    onAction={onAdd}
  />;
}
