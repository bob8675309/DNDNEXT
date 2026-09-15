# Character Forge Tarot Subclass Card Standard

Status: authoritative art-direction contract, reconciled 2026-09-15.

This document defines the visual, dimensional, compositional, and QA standard for every subclass Tarot card used by the Character Forge cinematic subclass carousel.

## Canonical dimensions

Use a true tall Tarot proportion.

- **Aspect ratio:** 7:12
- **Final in-repo export:** 840×1440 px WebP
- **Preferred working master:** 1680×2880 px or larger at 7:12
- If generation starts in a nearby portrait ratio, compose with crop-safe margins, crop to 7:12, and resize only after approval.
- Never stretch artwork to reach the target ratio.
- Carousel presentation should preserve `aspect-ratio: 7 / 12` rather than cropping standardized cards back toward older rectangular formats.

## One reusable card system

The illustration changes from subclass to subclass; the card system should not drift.

Recommended production order:

1. create the full-bleed illustration;
2. crop/normalize to 7:12;
3. apply the reusable antique-gold frame;
4. apply the fixed title/emblem geometry;
5. add only the restrained lower readability gradient needed for legibility;
6. perform full-resolution QA;
7. export 840×1440 WebP after approval.

Do not ask the image generator to reinvent frame/title/footer geometry for every card when a reusable template can produce consistency.

## Absolute rule: no footer

There is **no opaque footer panel**.

- No black rectangle at the bottom.
- No separate title band.
- No hard horizontal split between illustration and title area.
- The illustration continues behind the title and emblem to the bottom edge.
- Use only a restrained transparent bottom-up dark gradient for readability.
- Environmental and character detail should remain visible through the lower title zone.

The desired effect is one continuous illustration framed as a Tarot card, not artwork sitting above a UI footer.

## Lower-third geometry

For 840×1440 exports:

- artwork occupies the entire canvas;
- readability gradient may begin around 72–75% of card height and strengthen gradually toward the bottom;
- typical maximum black opacity should stay around 45–55%, not become fully opaque;
- title center target is roughly 83–85% of card height;
- emblem center target is roughly 91–93%;
- keep comfortable breathing room below the emblem and inside the bottom frame;
- long titles may wrap to two centered lines without expanding into a footer-like block;
- subtitles are optional and must not move the fixed title/emblem system.

Once the reusable production template is locked, use the same geometry for every card unless an explicit deck-wide revision is approved.

## Frame and gold treatment

- One consistent ornate antique-gold filigree frame across the deck.
- Detailed/elegant but not so thick that it steals composition space.
- Frame, title, and emblem carry most of the gold.
- Gold inside the illustration is an accent, not a requirement.
- Avoid simultaneously turning armor, clothing, scenery, magic, particles, and frame into reflective gold.
- The frame should unify cards with very different palettes and environments.

## Rendering target

Preferred character: crisp, high-detail cinematic fantasy realism with mostly matte materials and believable lighting.

Prioritize:

- readable facial structure;
- physically plausible anatomy and hands;
- class/subclass identity readable from pose, equipment, spell effects, environment, and action;
- convincing material separation for cloth, leather, steel, wood, stone, fur, skin, feathers, scales, etc.;
- strong silhouette at carousel size;
- clean depth hierarchy;
- restrained bloom/shine/particles rather than generic glitter everywhere.

Avoid:

- muddy painterly blur;
- plastic/game-render skin;
- over-sharpened halos;
- random excessive motes;
- mirrored or duplicated props;
- unreadable hands/weapons;
- anatomy hidden by effects merely to avoid solving it.

## Composition

Every card should read first as a distinctive subclass character/scene, not as a repeated portrait template.

Vary across the deck:

- species;
- gender/presentation;
- age range where appropriate;
- pose/action;
- camera height/angle;
- close, mid, and environmental framing;
- interior/exterior setting;
- weather/time of day;
- combat/non-combat storytelling;
- color temperature and palette.

Do not repeatedly default to a Human standing front-facing in the same three-quarter pose when the Forge supports a much broader Species catalogue.

Species casting is art direction only. It never changes subclass eligibility, Species identity, or gameplay rules.

## Subclass specificity

The illustration must communicate the named subclass, not merely its base class.

Use source-backed motifs and recognizable fantasy language without copying copyrighted book art composition. Examples of subclass specificity can come from:

- signature weapons/tools;
- distinctive spell school or energy behavior;
- companion/construct/spirit presence;
- environment tied to subclass fantasy;
- armor/costume/material language;
- disciplined pose or ritual action;
- subclass-specific iconography translated into an original composition.

Do not solve distinct subclasses by recoloring the same character/pose.

## Emblem/title rules

- Title uses the same font treatment, weight, spacing, and gold family across the deck.
- Emblem sits below the title in the fixed lower geometry.
- Emblem should support subclass identity but remain secondary to the illustration/title.
- Do not add source-book labels, rules text, level requirements, mechanical stats, or long subtitles to the card art.
- The UI can provide rules/details separately.

## Anatomy and prop QA — mandatory

Inspect the full-resolution working image before approval/export.

Check at minimum:

- correct finger count/hand structure where visible;
- believable wrist/elbow/shoulder connections;
- correct leg/foot attachment and stance;
- face symmetry appropriate to the pose;
- eyes looking intentionally rather than drifting;
- weapon grips and blade/shaft continuity;
- bows/strings/crossbows/firearms only where setting/rules actually support them;
- shields/armor straps and contact points;
- musical instruments/tools with coherent construction;
- companion limbs/wings/tails/heads;
- horns/ears/tusks/feathers/scales and other Species identifiers;
- no duplicated/merged background bodies;
- no text-like visual artifacts inside the illustration.

If a defect is obvious at full size, regenerate or repair the illustration before templating. Do not rely on final downscaling to hide it.

## Effects QA

Magic/effects should support the subclass rather than obscure it.

- Keep important hands/face/weapon silhouette readable.
- Avoid covering anatomy with opaque energy where the underlying pose is unresolved.
- Use restrained particles and bloom.
- Make effect direction/impact physically understandable.
- Avoid generic purple/blue glow if the subclass has a more distinctive visual identity.

## File/path rules

Final assets belong under:

`public/media/subclasses/<class-key>/<class-key>-<art-family>.webp`

Use normalized stable filenames. Do not overwrite unrelated historical artwork unless the replacement is explicitly approved.

The resolver `utils/classes/subclassArtwork.js` owns visible identity -> artwork path mapping. Do not encode rules logic into filenames or artwork helpers.

## Approval and completion

A generated image is not automatically a completed card.

Completion requires:

1. exact visible subclass identity confirmed;
2. Paul approves the individual illustration/card;
3. full-resolution QA passes;
4. canonical template/dimensions pass;
5. final 840×1440 WebP installed;
6. exact resolver wiring or explicitly approved intentional alias;
7. focused validator pass;
8. runtime/browser confirmation when an intentional Preview is requested.

## Batch diversity check

Before approving a batch, compare it with recently approved cards. Reject avoidable repetition in:

- Species;
- face/hair silhouette;
- pose;
- camera distance;
- environment;
- palette;
- weapon/tool;
- dominant magic effect.

Some thematic repetition is natural within a Class, but the deck should feel like a broad fantasy world rather than the same model in different costumes.

## Runtime safety boundary

Artwork work is presentation-only. It must not change:

- subclass identity/eligibility;
- level gates;
- persistence;
- progression injection;
- Supabase catalogue authority;
- world/town maps;
- travel/routes/weather/camps/clock;
- crafting/inventory/merchant/economy behavior;
- tactical/encounter rules.

Current production-completion tracking lives in `CHARACTER_FORGE_TAROT_SUBCLASS_ARTWORK_CHECKLIST.md`.
