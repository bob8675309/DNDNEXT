import MerchantAmbientBackdrop from "./MerchantAmbientBackdrop";
import { merchantShopLabel, merchantTagline } from "../utils/merchantStorefrontMedia";
import { themeFromMerchant } from "../utils/merchantTheme";

export default function MerchantWorkshopPane({ merchant }) {
  if (!merchant) return <section className="forge-merchant-workshop is-empty">
    <div className="forge-merchant-workshop__empty">Choose a campaign merchant to browse their storefront.</div>
  </section>;

  const shopLabel = merchantShopLabel(merchant);
  const tagline = merchantTagline(merchant);
  const theme = themeFromMerchant(merchant);

  return <section className={`forge-merchant-workshop is-${theme}`} aria-label={`${merchant.name || "Merchant"} workshop`}>
    <MerchantAmbientBackdrop merchant={merchant} />
    <div className="forge-merchant-workshop__copy">
      <span>{shopLabel}</span>
      <h2>{merchant.name || "Merchant"}</h2>
      {tagline ? <p>{tagline}</p> : null}
    </div>
  </section>;
}
