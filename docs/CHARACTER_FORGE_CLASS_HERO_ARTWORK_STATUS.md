# Character Forge Class Hero Artwork Status

Status date: 2026-09-08

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

## 2026-09-08 Wizard browser correction

Browser comparison against the accepted Class mockup showed two remaining presentation defects after the artwork first reached the Character Forge border:

1. the left/middle of Wizard's cinematic background read like a blurred or separately processed panel instead of one continuous painting;
2. Wizard subclass thumbnails were being letterboxed/cropped from artwork that did not match the actual selector viewport.

The final Wizard correction keeps the **Character Forge modal** as the single cinematic-image containing block, but replaces the Wizard image with a crisp 1600×900 composition designed around the real desktop Forge proportions. The castle/environment remains detailed through the left and center of the image while the Wizard stays on the right. CSS now uses only a restrained transparent readability fade that clears by roughly the middle of the canvas; no blur or second nested Class image is allowed.

The final presentation layer remains:

`styles/character-forge-class-final-corners.css`

It now explicitly suppresses `backdrop-filter`/blur behavior on the cinematic Class body/copy surfaces, keeps the body and nested guide transparent, and leaves the single modal-owned image visible behind the Class copy, subclass selector, and progression table.

Wizard's 18 canonical subclass presentation assets were also replaced with binary-distinct wide-format WebPs authored for the real selector ratio. They are 456×240 (1.9:1), matching the 76×40 display viewport, and therefore use `object-fit: cover` rather than the previous `contain` workaround. Canonical subclass identity, source, eligibility, selection, persistence, and progression remain owned by the existing Class model/context and Supabase-backed catalogue; only presentation artwork changed.

Validated runtime commit for this browser correction:

`d879a51378618453c3ee7205c6dfe2322f3e1e27` — `Refine Wizard cinematic and subclass artwork`

The guarded materializer verified the Wizard hero as WebP 1600×900, all 18 Wizard subclass WebPs as 456×240, binary uniqueness across all 18 subclass assets, the exact bounded changed-file list, `git diff --check`, the Class browser suite, Class hero framing, subclass browser, Artificer lock, final browser correction, Species/Class review, and Source Magic Routing before pushing the commit.

## Future Class artwork standard

When a new Class hero is explicitly generated/approved:

1. Create a hero composition intended for the wide Class header rather than stretching a menu portrait.
2. Keep the character readable beside the left-side class title/tagline/fact content.
3. Vary pose, environment, and eyeline across classes.
4. Use a realistic fantasy direction consistent with the accepted Character Forge Species artwork unless Paul requests a different visual language.
5. Preserve a separate menu/catalogue portrait when the wide hero does not crop cleanly into the left catalogue row.
6. Add the hero through `CINEMATIC_CLASS_HERO_ARTWORK` and the menu art through `CINEMATIC_CLASS_MENU_ARTWORK` rather than bypassing the resolver in page code.
7. Only switch a Class from the safe contained legacy-painting path to cinematic cover behavior after a purpose-built wide hero has been reviewed.
8. For subclass selector artwork, author directly to the selector's wide viewport ratio instead of relying on `contain`, portrait crops, or CSS transforms to rescue mismatched source art.

## Regression guard

`scripts/validate_class_hero_framing.mjs` protects this behavior and is called by the existing **Validate Class browser polish** workflow. It checks that:

- the correction stylesheet is loaded after the older cinematic correction layer;
- normal Class paintings use contain/no extra zoom;
- Artificer and Barbarian retain cinematic cover behavior;
- the centralized Class artwork resolver remains authoritative;
- the modal owns one crisp public cinematic image from Forge border to Forge border;
- the Class body/nested hero do not repaint or blur a second cinematic layer;
- Wizard subclass artwork fills the native wide selector slot instead of being letterboxed;
- the obsolete Bugbear Species crop override does not return;
- protected map/town behavior is not referenced by this presentation patch.

## Protected boundaries

This Class artwork correction is presentation-only.

- No class selection/persistence authority changed.
- No subclass/progression mechanics changed.
- No Supabase write or migration is required.
- No world-map or town/city-map code is part of the patch.
- No crafting, travel, inventory, merchant, tactical, or character-sheet runtime behavior is part of the patch.

## 2026-09-08 resize/readability correction

Browser review after the clean Wizard replacement established two additional presentation requirements:

- The modal-owned cinematic remains one sharp image, but the left reading zone now carries a stronger transparent black/navy scrim. It darkens the Class title/tagline area without blur or a second cropped image, then clears before the right-side hero subject.
- Fighter and Wizard provide explicit cinematic focal positions so resizing favors the character's head and upper body instead of center-cropping the face out of the frame.
- The shared desktop window controller no longer allows a resized Forge to be dragged almost completely outside the viewport. Drag and post-interaction reclamping now keep the full window inside the usable viewport bounds.
- Double-click/double-tap header reset remains available, but it is recovery convenience rather than the only way to rescue a lost Forge window.

Validated resize/readability commit:

`b89af0a18172da666fd07928b569d3cd7405856c` — `Keep Forge window visible and darken Class reading zone`

This correction is presentation/window-management only: no Class rules, subclass authority, Supabase schema/data, world-map, town/city-map, crafting, travel, encounter, or inventory behavior changed.
