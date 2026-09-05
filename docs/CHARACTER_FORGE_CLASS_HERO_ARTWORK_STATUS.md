# Character Forge Class Hero Artwork Status

Status date: 2026-09-05

This is the focused handoff/status note for Character Forge Class hero artwork presentation on PR #177 (`agent/realistic-dice-core`).

## Browser/video finding

The 2026-09-05 browser recording showed that the large right-side Class hero/background paintings were badly cropped for the normal/core classes. The problem was presentation CSS rather than missing class data or a Supabase issue.

The Class guide renders its hero through the centralized resolver:

`NpcForgeClassGuide.js -> classHeroArtworkFor(selectedClass.class_key) -> utils/classes/classArtwork.js`

Most normal/core Class assets under `public/media/classes/` are square catalogue-style paintings. The previous hero rule forced every image through:

- `width: 100%` / `height: 100%`;
- `object-fit: cover`;
- a vertical focal crop;
- an additional `transform: scale(1.12)` zoom.

That combination is appropriate only for purpose-built wide hero artwork. On square paintings it removes a large part of the original composition and makes characters/backgrounds appear improperly zoomed and cropped.

## 2026-09-05 framing correction

A dedicated final cascade layer now lives at:

`styles/character-forge-class-hero-framing.css`

It intentionally distinguishes two artwork classes:

### Existing square/portrait-backed Class paintings

For normal/core classes that still use their existing square paintings:

- use `object-fit: contain`;
- align the painting to the right side of the hero art rail;
- remove the extra transform zoom;
- let the existing dark hero background/gradient fill unused horizontal space.

This preserves the complete painting rather than destructively cropping it into a wide rectangle.

### Purpose-built cinematic Class heroes

Artificer and Barbarian already have dedicated generated cinematic hero assets through `utils/classes/classArtwork.js`. Those two retain `object-fit: cover`, but the redundant post-resolver scale transform is removed.

This boundary lets the current catalogue look correct immediately without pretending every Class already owns a custom wide hero painting.

## Future Class artwork standard

When a new Class hero is explicitly generated/approved:

1. Create a hero composition intended for the wide Class header rather than stretching a menu portrait.
2. Keep the character readable beside the left-side class title/tagline/fact content.
3. Vary pose, environment, and eyeline across classes.
4. Use a realistic fantasy direction consistent with the accepted Character Forge Species artwork unless Paul requests a different visual language.
5. Preserve a separate menu/catalogue portrait when the wide hero does not crop cleanly into the left catalogue row.
6. Add the hero through `CINEMATIC_CLASS_HERO_ARTWORK` and the menu art through `CINEMATIC_CLASS_MENU_ARTWORK` rather than bypassing the resolver in page code.
7. Only switch a Class from the safe contained legacy-painting path to cinematic cover behavior after a purpose-built wide hero has been reviewed.

## Regression guard

`scripts/validate_class_hero_framing.mjs` protects this behavior and is called by the existing **Validate Class browser polish** workflow. It checks that:

- the correction stylesheet is loaded after the older cinematic correction layer;
- normal Class paintings use contain/no extra zoom;
- Artificer and Barbarian retain cinematic cover behavior;
- the centralized Class artwork resolver remains authoritative;
- the obsolete Bugbear Species crop override does not return;
- protected map/town behavior is not referenced by this presentation patch.

## Protected boundaries

This Class artwork correction is presentation-only.

- No class selection/persistence authority changed.
- No subclass/progression mechanics changed.
- No Supabase write or migration is required.
- No world-map or town/city-map code is part of the patch.
- No crafting, travel, inventory, merchant, tactical, or character-sheet runtime behavior is part of the patch.
