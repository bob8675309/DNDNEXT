# Character Forge Subclass Tarot — Floating Gothic Library Handoff

Updated: 2026-09-27

Status: **implemented runtime checkpoint / browser acceptance pending**

> Legacy filename note: this document keeps the older `Table_Contact` filename so existing links do not break. The physical runic-table direction is retired.

Branch: `agent/subclass-tarot-scene-rebuild-20260922`  
Pull request: **#199 — Rebuild subclass Tarot selector**  
Validated runtime head: `e53706117ff70cc817063755e39c261bfb0accaf`

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
