import MerchantAmbientBackdrop from "./MerchantAmbientBackdrop";
import { merchantShopLabel, merchantTagline } from "../utils/merchantStorefrontMedia";

export default function MerchantHero({ merchant }) {
  if (!merchant) return null;
  const shopLabel = merchantShopLabel(merchant);
  const tagline = merchantTagline(merchant);

  return <section className="merchant-storefront-hero" aria-label={`${merchant.name || "Merchant"} storefront`}>
    <MerchantAmbientBackdrop merchant={merchant} />
    <div className="merchant-storefront-hero__copy">
      <h2>{merchant.name || "Merchant"}</h2>
      <strong>{shopLabel}</strong>
      {tagline ? <p>{tagline}</p> : null}
    </div>
    <div className="merchant-storefront-hero__ambient-note" title="This storefront supports subtle ambient background loops when a merchant video is available.">
      <span aria-hidden="true">◌</span>
      <span>Ambient shop scene</span>
    </div>
  </section>;
}
