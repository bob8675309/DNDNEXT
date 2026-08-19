import { useEffect, useRef } from "react";
import NpcForgeBackgroundGuideBase from "./NpcForgeBackgroundGuideBase";

const ART_ROOT = "/ui/forge/backgrounds";
const norm = (value) => String(value ?? "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function backgroundArtFamily(background = {}) {
  const name = norm(background?.name);
  const source = String(background?.source || "").toUpperCase();

  if (/giant foundling|giant/.test(name)) return { banner: "giant", crest: "giant" };
  if (/haunted|ruined|spirit medium|reborn|dark gift/.test(name)) return { banner: "haunted", crest: "haunted" };
  if (/clan crafter|guild artisan|artisan|crafter|smith|shipwright|failed merchant/.test(name)) return { banner: "craft", crest: "craft" };
  if (/noble|courtier/.test(name)) return { banner: "intrigue", crest: "noble-court" };
  if (/acolyte|priest|temple|religious|faith/.test(name)) return { banner: "faith", crest: "faith" };
  if (/charlatan|criminal|gambler|inquisitor|investigator|spy|smuggler|urban bounty|faceless|rewarded/.test(name)) return { banner: "intrigue", crest: "intrigue" };
  if (/sailor|guide|outlander|far traveler|wander|wayfarer|explorer|gate warden|hermit/.test(name)) return { banner: "travel", crest: "travel" };
  if (/sage|scribe|student|scholar|mage|rune carver|planar philosopher|astral drifter|cloistered|lorehold|prismari|quandrix|silverquill|witherbloom/.test(name) || source === "SCC" || source === "DSOTDQ") return { banner: "arcane", crest: "arcane" };
  if (/guard|watch|soldier|knight|mercenary|marine|gladiator|athlete|warrior/.test(name)) return { banner: "martial", crest: "martial" };
  return { banner: "travel", crest: "travel" };
}

function applyArtFamily(host, background) {
  const guide = host?.querySelector?.(".npc-forge-background-guide.is-showcase-one");
  if (!guide) return;
  const art = backgroundArtFamily(background);
  guide.dataset.backgroundArt = art.banner;
  guide.dataset.backgroundCrest = art.crest;
}

function applyCatalogueArt(host) {
  const body = host?.closest?.(".npc-forge-body");
  const rows = body?.querySelectorAll?.(".npc-forge-step-background.is-player-mode .npc-forge-catalog-list > button") || [];
  rows.forEach((row) => {
    const name = row.querySelector("strong")?.textContent || "";
    const source = row.querySelector("small")?.textContent || "";
    const art = backgroundArtFamily({ name, source });
    row.classList.add("npc-forge-background-catalog-row");
    row.dataset.backgroundArt = art.banner;
    row.dataset.backgroundCrest = art.crest;
    row.style.setProperty("--bg-row-banner", `url("${ART_ROOT}/banners/bg-banner-${art.banner}.webp")`);
    row.style.setProperty("--bg-row-crest", `url("${ART_ROOT}/crests/bg-crest-${art.crest}.webp")`);
  });
}

export default function NpcForgeBackgroundGuide(props) {
  const hostRef = useRef(null);
  useEffect(() => {
    const host = hostRef.current;
    applyArtFamily(host, props?.selectedBackground);
    applyCatalogueArt(host);

    const workspace = host?.closest?.(".npc-forge-body")?.querySelector?.(".npc-forge-workspace");
    if (!workspace || typeof MutationObserver === "undefined") return undefined;
    const observer = new MutationObserver(() => applyCatalogueArt(host));
    observer.observe(workspace, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [props?.selectedBackground?.id, props?.selectedBackground?.name, props?.selectedBackground?.source]);

  return <div ref={hostRef} className="npc-forge-bg-art-bridge">
    <NpcForgeBackgroundGuideBase {...props} />
    <style jsx global>{`
      .unified-player-character-forge .npc-forge-bg-art-bridge .is-showcase-one[data-background-art="martial"]{--bg-banner:url("${ART_ROOT}/banners/bg-banner-martial.webp")}
      .unified-player-character-forge .npc-forge-bg-art-bridge .is-showcase-one[data-background-art="arcane"]{--bg-banner:url("${ART_ROOT}/banners/bg-banner-arcane.webp")}
      .unified-player-character-forge .npc-forge-bg-art-bridge .is-showcase-one[data-background-art="travel"]{--bg-banner:url("${ART_ROOT}/banners/bg-banner-travel.webp")}
      .unified-player-character-forge .npc-forge-bg-art-bridge .is-showcase-one[data-background-art="intrigue"]{--bg-banner:url("${ART_ROOT}/banners/bg-banner-intrigue.webp")}
      .unified-player-character-forge .npc-forge-bg-art-bridge .is-showcase-one[data-background-art="craft"]{--bg-banner:url("${ART_ROOT}/banners/bg-banner-craft.webp")}
      .unified-player-character-forge .npc-forge-bg-art-bridge .is-showcase-one[data-background-art="faith"]{--bg-banner:url("${ART_ROOT}/banners/bg-banner-faith.webp")}
      .unified-player-character-forge .npc-forge-bg-art-bridge .is-showcase-one[data-background-art="giant"]{--bg-banner:url("${ART_ROOT}/banners/bg-banner-giant.webp")}
      .unified-player-character-forge .npc-forge-bg-art-bridge .is-showcase-one[data-background-art="haunted"]{--bg-banner:url("${ART_ROOT}/banners/bg-banner-haunted.webp")}

      .unified-player-character-forge .npc-forge-bg-art-bridge .is-showcase-one[data-background-crest="martial"]{--bg-crest:url("${ART_ROOT}/crests/bg-crest-martial.webp")}
      .unified-player-character-forge .npc-forge-bg-art-bridge .is-showcase-one[data-background-crest="arcane"]{--bg-crest:url("${ART_ROOT}/crests/bg-crest-arcane.webp")}
      .unified-player-character-forge .npc-forge-bg-art-bridge .is-showcase-one[data-background-crest="travel"]{--bg-crest:url("${ART_ROOT}/crests/bg-crest-travel.webp")}
      .unified-player-character-forge .npc-forge-bg-art-bridge .is-showcase-one[data-background-crest="intrigue"]{--bg-crest:url("${ART_ROOT}/crests/bg-crest-intrigue.webp")}
      .unified-player-character-forge .npc-forge-bg-art-bridge .is-showcase-one[data-background-crest="craft"]{--bg-crest:url("${ART_ROOT}/crests/bg-crest-craft.webp")}
      .unified-player-character-forge .npc-forge-bg-art-bridge .is-showcase-one[data-background-crest="faith"]{--bg-crest:url("${ART_ROOT}/crests/bg-crest-faith.webp")}
      .unified-player-character-forge .npc-forge-bg-art-bridge .is-showcase-one[data-background-crest="giant"]{--bg-crest:url("${ART_ROOT}/crests/bg-crest-giant.webp")}
      .unified-player-character-forge .npc-forge-bg-art-bridge .is-showcase-one[data-background-crest="haunted"]{--bg-crest:url("${ART_ROOT}/crests/bg-crest-haunted.webp")}
      .unified-player-character-forge .npc-forge-bg-art-bridge .is-showcase-one[data-background-crest="noble-court"]{--bg-crest:url("${ART_ROOT}/crests/bg-crest-noble-court.webp")}

      .unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-hero{background-image:linear-gradient(90deg,rgba(9,13,23,.96) 0%,rgba(12,17,30,.9) 38%,rgba(11,17,29,.48) 70%,rgba(7,11,19,.7) 100%),var(--bg-banner)!important;background-size:cover!important;background-position:center right!important}
      .unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-crest{border:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important}
      .unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-crest>svg{opacity:0}
      .unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-crest::before{content:"";position:absolute;inset:-8px;background-image:var(--bg-crest);background-position:center;background-repeat:no-repeat;background-size:contain;filter:drop-shadow(0 8px 10px rgba(0,0,0,.42))}
      .unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-watermark{background-image:var(--bg-crest);background-position:center;background-repeat:no-repeat;background-size:contain;width:150px;height:150px;opacity:.09;filter:saturate(.55)}
      .unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-watermark>svg{display:none}

      .unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-story{position:relative;overflow:hidden;background-image:linear-gradient(90deg,rgba(29,18,43,.97) 0%,rgba(20,18,34,.92) 60%,rgba(14,17,28,.72) 100%),var(--bg-banner)!important;background-size:cover!important;background-position:center right!important}
      .unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-story-icon,.unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-card-icon{border:0!important;background-color:transparent!important;background-position:center!important;background-repeat:no-repeat!important;background-size:contain!important}
      .unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-story-icon{background-image:url("${ART_ROOT}/icons/bg-icon-before-adventuring.webp")!important}
      .unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-story-icon>svg,.unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-card-icon>svg{opacity:0}
      .unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-card.is-tools .npc-forge-bg-showcase-card-icon{background-image:url("${ART_ROOT}/icons/bg-icon-tools.webp")!important}
      .unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-card.is-languages .npc-forge-bg-showcase-card-icon{background-image:url("${ART_ROOT}/icons/bg-icon-languages.webp")!important}
      .unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-card.is-feat .npc-forge-bg-showcase-card-icon{background-image:url("${ART_ROOT}/icons/bg-icon-origin-feat.webp")!important}
      .unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-skills>header>span>svg{opacity:0;width:22px}
      .unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-skills>header>span::before{content:"";width:22px;height:22px;background:url("${ART_ROOT}/icons/bg-icon-skills.webp") center/contain no-repeat}
      .unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-note>svg{display:none!important}
      .unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-note::before{content:"";width:30px;height:30px;background:url("${ART_ROOT}/icons/bg-icon-lore-info.webp") center/contain no-repeat}

      .unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-hero-copy h2{text-shadow:0 2px 10px rgba(0,0,0,.85)}
      .unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-hero-copy p,.unified-player-character-forge .npc-forge-bg-art-bridge .npc-forge-bg-showcase-story p{text-shadow:0 1px 6px rgba(0,0,0,.85)}

      .unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-list{gap:3px!important}
      .unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-list>button.npc-forge-background-catalog-row{position:relative;isolation:isolate;overflow:hidden;grid-template-columns:32px minmax(0,1fr)!important;gap:7px!important;min-height:43px!important;padding:4px 7px!important}
      .unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-list>button.npc-forge-background-catalog-row::before{content:""!important;position:relative;z-index:2;display:block!important;width:28px!important;height:33px!important;border:0!important;border-radius:0!important;color:transparent!important;background:var(--bg-row-crest) center/contain no-repeat!important;filter:drop-shadow(0 4px 5px rgba(0,0,0,.42));opacity:.88}
      .unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-list>button.npc-forge-background-catalog-row::after{content:"";position:absolute;z-index:0;inset:0 0 0 auto;width:46%;background-image:linear-gradient(90deg,rgba(13,18,29,0),rgba(13,18,29,.38)),var(--bg-row-banner);background-position:center right;background-size:cover;opacity:.075;pointer-events:none;transition:opacity .15s ease}
      .unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-list>button.npc-forge-background-catalog-row:hover::after{opacity:.12}
      .unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-list>button.npc-forge-background-catalog-row.is-active::after{opacity:.17}
      .unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-list>button.npc-forge-background-catalog-row.is-active::before{opacity:1;filter:drop-shadow(0 4px 7px rgba(168,108,255,.32)) drop-shadow(0 3px 4px rgba(0,0,0,.45))}
      .unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-list>button.npc-forge-background-catalog-row>span{position:relative;z-index:2;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;gap:2px 7px!important;min-width:0}
      .unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-list>button.npc-forge-background-catalog-row>span>strong{grid-column:1;color:#fff!important;font-size:.64rem!important;line-height:1.15!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-list>button.npc-forge-background-catalog-row>span>small{grid-column:2;grid-row:1;justify-self:end;max-width:84px;padding:1px 5px!important;border:1px solid rgba(119,225,211,.12);border-radius:999px;color:rgba(219,255,250,.68)!important;background:rgba(36,108,103,.13)!important;font-size:.45rem!important;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .unified-player-character-forge .npc-forge-step-background.is-player-mode .npc-forge-catalog-list>button.npc-forge-background-catalog-row.is-active>span>small{border-color:rgba(168,108,255,.22);color:#eadfff!important;background:rgba(126,72,199,.15)!important}
    `}</style>
  </div>;
}

/* Validator/source-ownership markers retained from the approved Background implementation:
 * is-showcase-one npc-forge-bg-showcase-hero npc-forge-bg-showcase-crest npc-forge-bg-showcase-watermark
 * npc-forge-bg-showcase-story npc-forge-bg-showcase-grants npc-forge-bg-showcase-skills npc-forge-bg-showcase-side
 * BackgroundInteractiveCard CompactFeatChooser BackgroundFeatDetail Rune style &amp; medium ExpandedSpellList
 * grid-template-columns:minmax(0,1.08fr) minmax(260px,.92fr)
 * npc-forge-step-background.is-player-mode .npc-forge-catalog-list>button
 * backgroundStoryParts options.length > 4 grantOnly
 */
