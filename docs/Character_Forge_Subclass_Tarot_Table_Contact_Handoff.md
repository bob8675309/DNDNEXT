# Character Forge Subclass Tarot — Floating Gothic Library Handoff

Updated: 2026-09-27

Status: **implemented runtime checkpoint / browser acceptance pending**

> Legacy filename note: this document keeps the older `Table_Contact` filename so existing links do not break. The physical runic-table direction is retired.

Branch: `agent/subclass-tarot-scene-rebuild-20260922`  
Pull request: **#199 — Rebuild subclass Tarot selector**  
Validated runtime head before this documentation commit: `7ec85dd495674f77ec38946a921512cc9c0f70ae`

## Superseding decision

The physical runic-table presentation is retired.

Browser review established that repeated attempts to make 2D Tarot cards convincingly stand, bend, fold, or occlude around a physical tabletop introduced more visual artifacts than value. The parts worth preserving are the existing DNDNext Tarot fronts, hero scale, depth sizing, rear card backs, drag/flick motion, arrow/keyboard navigation, and explicit-click subclass authority.

The active presentation is now a **floating Tarot carousel suspended in a dark, smoky ruined gothic library**.

Do not reintroduce:

- runic table contact;
- rune foreground masking;
- card-bottom folds;
- per-card seat/pedestal masks;
- whole-card roll;
- surface-following assumptions.

## User-approved visual target

Preserve:

- real existing subclass Tarot fronts under `public/media/subclasses/**`;
- shared `subclass-selector-card-back-20260922.webp`;
- current hero-card scale;
- current non-linear physical size falloff;
- current restrained yaw;
- current continuous carousel motion;
- arrow, keyboard, drag, flick/snap, side-card click → hero, and explicit-click selection authority;
- face-up/front cards at full opacity.

Scene:

- dark ruined gothic library / archive rotunda;
- moonlit broken roof;
- deep architectural shadows;
- warm candle clusters at the outer galleries;
- heavy atmospheric smoke/fog;
- cards float freely in open air;
- no table, floor, altar, or other support under the cards;
- visible `Choose your Fate` title;
- restrained gold circular navigation.

## Installed background asset

Repository path:

`public/media/forge/subclass-carousel/subclass-selector-library-ruins-20260926.webp`

Verified transfer metadata:

- dimensions: **1672×941**;
- MIME: **image/webp**;
- bytes: **161,270**;
- SHA-256: `488c8d75b8b8d2d7bf9ab37195d0467cee73391c987a26ae1a5320b4e7b63987`.

Transfer bundle:

- Dropbox: `/DNDNext-Transfer/dndnext-subclass-library-ruins-20260927.zip`;
- bundle SHA-256: `a3e61d00d09a78f63bce4cd1c70bd3093621f7c97812fecef4eb2c876c8ba394`;
- asset-only bot commit: `fe6f8a584035accf4ea9006dd626f70cf040771a`.

The asset was installed through the standing guarded Dropbox → one-shot GitHub Actions materializer path with:

- exact target-head guard;
- ZIP SHA-256 verification;
- per-file SHA-256 verification;
- MIME verification;
- 1672×941 dimension verification;
- exact one-file diff guard;
- focused selector validator before push.

## Ambient life implemented

The room should feel alive without becoming busy.

### Back smoke

- uses existing `subclass-selector-smoke-back.png`;
- renders behind cards;
- slow 31-second drift loop;
- low/moderate opacity;
- no pointer interaction.

### Front smoke

- uses existing `subclass-selector-smoke-front.png`;
- renders above the card field but below navigation;
- masked away from the upper scene so the title stays readable;
- slow 24-second counter-drift loop;
- restrained opacity.

### Candle flicker

- implemented as subtle warm radial glow modulation over existing left/right candle clusters;
- left and right timings are asynchronous;
- no strobe;
- background plate itself never moves.

### Reduced motion

Under `prefers-reduced-motion: reduce`:

- smoke animation stops;
- candle flicker stops;
- carousel transitions collapse to the existing near-zero reduced-motion duration.

### Mouse

A distant mouse remains **optional after browser review**. Do not add it until the current smoke/candle presentation is accepted; the scene should not accumulate ambient gimmicks.

## Protected boundaries

Presentation-only. Do not change:

- canonical subclass catalogue/eligibility;
- subclass persistence/progression;
- Supabase schema/data/functions;
- world map/travel/routes/weather/camps/world clock;
- town/city-map behavior;
- tactical encounter authority;
- crafting/inventory/merchant/economy systems;
- approved subclass Tarot front artwork.

## Current implementation checklist

### Phase 1 — retire table-specific runtime

- [x] Remove `class-subclass-carousel-modal__rune-foreground`.
- [x] Remove rune foreground mask from runtime requirements.
- [x] Remove table-contact card shadow.
- [x] Remove table/rune-specific runtime comments.
- [x] Reject old table/rune presentation in the focused validator.
- [x] Keep Tarot art intact.

### Phase 2 — ruined-library stage

- [x] Install approved ruined-library WebP.
- [x] Use it as the sole static stage background.
- [x] Preserve 16:9 desktop framing.
- [x] Restore visible `Choose your Fate` heading as runtime text.
- [x] Keep center airspace clear for the hero card.
- [x] Add narrow-screen background cropping without changing selector authority.

### Phase 3 — floating carousel

- [x] Preserve one continuous path for all catalogue sizes.
- [x] Preserve current hero width.
- [x] Preserve multiple physical depth-size steps.
- [x] Keep whole-card roll at 0.
- [x] Keep yaw restrained at `0.24 × ring angle`, capped at ±34°.
- [x] Preserve existing vertical travel as a free-floating depth path rather than surface contact.
- [x] Preserve rear-card shared-back behavior.
- [ ] Browser-review Wizard dense-catalogue composition.
- [ ] Browser-review four-option/small catalogue composition.

### Phase 4 — ambient animation

- [x] Rear smoke layer.
- [x] Foreground smoke layer.
- [x] Independent long-loop keyframes.
- [x] Restrained asynchronous candle flicker.
- [x] `pointer-events: none` for ambient layers.
- [x] Reduced-motion shutdown.
- [x] Static background plate; no background animation.
- [ ] Optional mouse only after current presentation is accepted.

### Phase 5 — interaction authority

The runtime logic was intentionally preserved. Exact browser interaction acceptance remains pending.

- [x] Source still moves Left/Right exactly one card step.
- [x] Keyboard Left/Right still calls the same rotation authority.
- [x] Escape still closes modal.
- [x] Drag/flick code remains unchanged.
- [x] Click-vs-drag suppression remains unchanged.
- [x] Side-card click still rotates exact option to hero.
- [x] Exactly one `model.selectSubclass(option)` persistence path remains.
- [x] Future-level eligibility guard remains unchanged.
- [x] Selected subclass still re-centers on reopen.
- [ ] Browser-test slow drag.
- [ ] Browser-test fast flick/snap.
- [ ] Browser-test side-card click → hero/select.

### Phase 6 — validation

Exact runtime head: `e53706117ff70cc817063755e39c261bfb0accaf`

GitHub `Validate Class browser polish`: **PASS**

Included successful steps:

- Validate Class browser polish;
- Validate Class hero framing;
- Validate Class subclass browser;
- Validate approved Artificer mockup lock;
- Validate final Class browser correction;
- Validate Species and Class browser review fix.

Vercel exact-head deployment:

- deployment: `dpl_kUXpi2krxq3G8Egnt2mQjfssXLzu`;
- state: **READY**;
- Vercel status: **success**.

Runtime diff from the pre-library handoff checkpoint is bounded to:

- `components/ClassSubclassSection.js`;
- `styles/character-forge-subclass-tarot-layout.css`;
- `scripts/validate_class_subclass_browser.mjs`;
- `public/media/forge/subclass-carousel/subclass-selector-library-ruins-20260926.webp`.

No protected map/town/tactical/crafting/inventory/merchant/economy/Supabase runtime file changed.

## 2026-09-27 depth/smoke polish checkpoint

Browser feedback on the first ruined-library preview was positive: the floating carousel and animated smoke direction are accepted as the basis for further polish.

Implemented in this pass:

- added the approved generated `Choose your Fate` title artwork;
- added the approved generated left/right celestial navigation artwork;
- retained the existing colored smoke family;
- added the generated gray-blue smoke family as a separately animated layer;
- moved both mid-scene smoke layers into the carousel stacking context so they render **in front of rear/back cards but behind front-facing cards**;
- kept the original rear smoke behind the entire carousel;
- introduced explicit front/rear card z-index bands so rear cards cannot slice across nearer face-up cards;
- made outer cards atomic stacking layers while keeping the inner Tarot face flip context;
- increased candle/torch glow modulation so the flicker is visible without becoming a strobe;
- slightly lifted front-facing card brightness:
  - near-front cards: `brightness(1.06)`;
  - hero: `brightness(1.11)`;
- preserved all existing carousel motion/selection authority and reduced-motion shutdown.

Binary assets installed through the guarded Dropbox → one-shot GitHub Actions transfer route:

- `subclass-selector-title-choose-fate-20260927.webp`
  - 201,682 bytes
  - SHA-256 `b7cc7a3fdd3839111a5f5435976d998bd4cc7b09075f1eaae030603aeb20ba41`
- `subclass-selector-nav-prev-20260927.webp`
  - 36,798 bytes
  - SHA-256 `9c5242b72f5b61128c9491424e50d290d4f0e854eb84ce1782d2b960b564d21b`
- `subclass-selector-nav-next-20260927.webp`
  - 36,878 bytes
  - SHA-256 `2a49de4212fb7dc1175209a1c019e1f3946f0366b1756095c6714b437ed7be6b`
- `subclass-selector-smoke-gray-20260927.webp`
  - 361,530 bytes
  - SHA-256 `dbd1c25ebf2b15435ede4e41b90172d28c69f7ee8545c8b14310d81ca497c9ed`

Transfer bundle:

- Dropbox: `/DNDNext-Transfer/dndnext-subclass-polish-assets-20260927.zip`
- ZIP SHA-256: `67965c87deedc8471fe18feb597e8c7b78d673266dac697d928d8c9410b08f9a`
- asset commit: `f6c38d7e1a8e5a87f1b20d19d4daff2340c3c8c2`

Runtime polish commit:

- `7ec85dd495674f77ec38946a921512cc9c0f70ae`

Validation at the runtime polish commit:

- **Validate Class browser polish: PASS**
- **Validate Class hero framing: PASS**
- **Validate Class subclass browser: PASS**
- **Validate approved Artificer mockup lock: PASS**
- **Validate final Class browser correction: PASS**
- **Validate Species and Class browser review fix: PASS**

Browser acceptance still required:

- [ ] confirm both colored and gray smoke read as separate depth layers;
- [ ] confirm front-facing cards stay above rear cards through drag/flick;
- [ ] confirm hero/near-front brightness lift is subtle enough;
- [ ] confirm candle flicker is now noticeable but not distracting;
- [ ] confirm approved title and navigation artwork scale well on desktop/medium/mobile;
- [ ] confirm Wizard dense-catalogue and four-option classes remain balanced.

## 2026-09-27 next polish checklist — ambience / readability / creature life

This checklist is the next bounded browser-polish pass after review of build `c2471e72acf137e471d7ece852212a80c57f855e`.

### A. Smoke balance

- [ ] Keep all three existing smoke depths: rear smoke, colored mid smoke, and gray-blue mid smoke.
- [ ] Reduce the overall purple wash slightly so the ruined-library architecture and Tarot faces retain neutral contrast.
- [ ] Let gray smoke carry more of the atmospheric volume; darken/desaturate it further only if browser review shows it washing out cards.
- [ ] Keep smoke in front of rear/back-facing cards and behind face-up/front cards.
- [ ] Verify the hero remains readable through an entire smoke loop.
- [ ] Keep each smoke family on different duration/direction/easing so the layers never move as one sheet.
- [ ] Preserve `prefers-reduced-motion` shutdown.

### B. Candle / torch life

- [ ] Strengthen candle flicker one more restrained step; current browser review still reads it as too subtle.
- [ ] Tighten glow hotspots around actual visible candle clusters instead of broadly lighting wall regions.
- [ ] Keep left/right timings asynchronous.
- [ ] Avoid fast brightness changes, strobing, or full-scene exposure shifts.

### C. Card readability / layering

- [ ] Preserve hero as the brightest card, but review whether `brightness(1.11)` needs a small reduction after smoke retuning.
- [ ] Preserve a smaller brightness lift for near-front side cards.
- [ ] Add a restrained edge/rim contrast lift to face-up side cards only if smoke still swallows their borders.
- [ ] Re-test explicit front/rear z-index bands through slow drag and fast flick.
- [ ] Confirm no rear card, rear card back, or smoke layer slices across a nearer face-up card.
- [ ] Check Wizard dense catalogue plus one four-option class.

### D. Title / navigation polish

- [ ] Keep the approved generated title and arrow assets already installed.
- [ ] Browser-review title dominance; if it competes with hero, reduce displayed size or glow slightly rather than replacing the asset.
- [ ] Keep navigation controls separated from card hit areas and visually subordinate to the hero.
- [ ] Verify desktop, medium, and narrow sizing.

### E. Feature-panel integration

- [ ] Review the right-side feature/details panel against the cinematic modal.
- [ ] If it still reads as a detached application panel, tune only presentation: shadow, border, transparency, ambient tint, and breathing room.
- [ ] Do not change inspection authority, feature data, or persistence behavior.

### F. Ambient creature pass — existing mouse art

Do **not** generate replacement mice before checking the existing generated assets from this work session.

Existing created assets available for reuse:

- `moonlit_gothic_mice_asset_trio.png`
- `crawling_moonlit_fantasy_mouse.png`

Target behavior:

- [ ] Pick the cleaner existing mouse asset after visual inspection; do not add both unless there is a concrete reason.
- [ ] Install the chosen mouse as a small optimized transparent runtime asset through the guarded binary-transfer path.
- [ ] Place it on a distant lower wall / shelf / balcony route, outside the main card and title silhouette.
- [ ] Use one short scurry path with long idle delay, approximately one appearance every 20–35 seconds.
- [ ] Keep scale tiny enough that the mouse reads as an easter-egg ambient detail, not a UI element.
- [ ] Keep the mouse behind the Tarot cards and all interaction layers.
- [ ] Disable mouse motion under `prefers-reduced-motion: reduce`.
- [ ] Browser-review the mouse before considering bats.

### G. Optional bats — only after mouse review

- [ ] Do not add bats in the same first creature pass.
- [ ] If the room still feels too static after the mouse/flicker/smoke pass, test one very distant bat silhouette route near the broken upper roof.
- [ ] Keep bat frequency rarer than the mouse and avoid crossing the title, hero card, or moon focal point.
- [ ] Remove the bat idea entirely if it reads as haunted-house decoration rather than subtle environmental life.

### H. Performance / regression guard

- [ ] Keep ambient layers transform/opacity based; avoid expensive animated blur/filter changes on full-screen elements.
- [ ] Check recording/runtime FPS after adding the mouse.
- [ ] Preserve carousel drag/flick responsiveness.
- [ ] Preserve reduced-motion behavior.
- [ ] Run the focused Class/subclass validator suite.
- [ ] Verify exact changed-file scope.
- [ ] Verify exact-head Vercel Preview.
- [ ] Keep PR #199 unmerged until Paul's explicit approval.

## 2026-09-28 motion / flame / float polish checkpoint

Browser feedback after the prior smoke-and-mouse pass:

- ignore the recorded GPU/PC load for selector tuning; the recording machine was intentionally running games in the background;
- candle glow flicker is accepted, but a few actual flames should move intermittently;
- the previous mouse was too subtle to notice;
- title should be smaller;
- the carousel should sit lower;
- click/arrow rotation should be slow enough to visibly watch cards travel and turn;
- non-hero cards should have a subtle idle float around their assigned carousel point;
- the hero must stay completely still;
- some smoke may cross in front of face-up side cards, but never the hero;
- some cards disappeared on hover and that compositor regression must be removed.

Implemented at runtime:

- carousel vertical center moved from `55.8` to `59.2`;
- approved title artwork reduced to `clamp(300px, 33vw, 560px)` on desktop, with a smaller mobile treatment;
- button/keyboard card travel slowed from ~0.52s to **0.88s**;
- Tarot face flip transition slowed to **0.68s**;
- added a nested `class-subclass-carousel-card__float` wrapper:
  - non-hero cards idle-float by only a few pixels with tiny sub-degree roll;
  - per-card phase offsets prevent synchronized bobbing;
  - hero float is disabled;
  - dragging disables float and snaps the card back to its authoritative carousel point;
- added a low-opacity `smoke-near` depth layer at z-index 760:
  - crosses face-up side cards;
  - remains below hero z-index 820;
  - preserves hero clarity;
- removed the hover-time `filter` from the 3D Tarot surface, which was the likely browser compositor trigger for cards disappearing on hover;
- hover emphasis now changes only the visible front-face border/glow;
- mouse presentation strengthened:
  - larger displayed size;
  - brighter/less desaturated;
  - longer visible scurry window;
  - 26-second rare loop;
  - still behind Tarot and interaction layers;
- added one optimized **96×139 / 7,204-byte** flame overlay:
  - `public/media/forge/subclass-carousel/subclass-selector-flame-20260928.webp`;
  - four small placements over existing background candle zones;
  - intermittent opacity/sway/stretch rather than continuous motion;
  - asynchronous phase offsets;
- reduced-motion disables card float, smoke-near motion, flame motion, and mouse motion.

Validation:

- first runtime commit: `48a8c8f33ccbc91aeea364002fc4ba87acc07631`;
- stale `validate_class_browser_polish.mjs` still described the retired clean-cathedral/no-smoke target and failed correctly;
- validator contract was updated to the accepted floating ruined-library direction at `1f0c928632440f33c44b59fb1a95efd160b887f9`;
- all six Class/Forge CI steps then passed;
- browser acceptance remains pending.

Review next:

- [ ] title scale;
- [ ] lower carousel placement;
- [ ] visible card travel/flip timing;
- [ ] non-hero float subtlety;
- [ ] hero remains completely still;
- [ ] side-card near-smoke depth;
- [ ] no card disappearance on hover;
- [ ] mouse now noticeable without becoming distracting;
- [ ] intermittent flame motion aligns with real candle clusters;
- [ ] reduced-motion static behavior.

## Browser acceptance still required

Review deliberately before merge:

### Wizard / dense catalogue

- [ ] hero remains crisp/dominant;
- [ ] several side-card size steps remain obvious;
- [ ] rear backs read through the smoke;
- [ ] smoke feels substantial but does not obscure the hero;
- [ ] carousel reads as floating in the room.

### Small catalogue

- [ ] four-option layout remains balanced;
- [ ] side cards remain face-up as expected;
- [ ] scene does not feel empty.

### Motion / ambience

- [ ] slow drag;
- [ ] fast flick/snap;
- [ ] arrows;
- [ ] side-card click → hero;
- [ ] rear front/back transition;
- [ ] back/front smoke loops feel natural;
- [ ] candle flicker is subtle;
- [ ] reduced-motion mode is effectively static.

### Responsive

- [ ] desktop 16:9;
- [ ] medium viewport;
- [ ] narrow/mobile fallback.

## Definition of done

The selector is accepted when the live modal reads as a **floating Tarot carousel in a dark, smoke-filled ruined gothic library**, using the real DNDNext Tarot deck and existing carousel authority. The scene has no physical-surface dependency. Ambient smoke and candle flicker make the room feel alive without distracting from subclass selection. No canonical Forge authority or protected subsystem is changed.

Do not merge PR #199 without Paul's explicit approval.
