import MerchantAmbientBackdrop from "./MerchantAmbientBackdrop";
import { merchantShopLabel, merchantTagline, resolveMerchantStorefrontMedia } from "../utils/merchantStorefrontMedia";

export default function MerchantHero({ merchant }) {
  if (!merchant) return null;
  const shopLabel = merchantShopLabel(merchant);
  const tagline = merchantTagline(merchant);
  const media = resolveMerchantStorefrontMedia(merchant);

  return <section className="merchant-storefront-hero" aria-label={`${merchant.name || "Merchant"} storefront`}>
    <MerchantAmbientBackdrop merchant={merchant} />
    <div className="merchant-storefront-hero__copy">
      <h2>{merchant.name || "Merchant"}</h2>
      <strong>{shopLabel}</strong>
      {tagline ? <p>{tagline}</p> : null}
    </div>
    {media.hasDedicatedVideo ? <div className="merchant-storefront-hero__ambient-note" title="This storefront uses a subtle ambient background loop.">
      <span aria-hidden="true">◌</span>
      <span>Ambient shop scene</span>
    </div> : null}
  </section>;
}
