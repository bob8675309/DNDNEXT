# Character Forge Tarot Subclass Card Standard

Status: authoritative art-direction contract as of 2026-09-12.

This document defines the required visual, dimensional, compositional, and QA standard for every subclass tarot card used by the Character Forge subclass carousel. The previous mixed-generation subclass artwork was intentionally removed so the deck can be rebuilt from one normalized standard.

## 1. Canonical card dimensions

Use a true tall tarot proportion rather than the older 5:7 treatment.

- **Canonical aspect ratio:** **7:12**
- **Final in-repo export:** **840 × 1440 px WebP**
- **Preferred high-resolution working master:** **1680 × 2880 px** or larger at the same 7:12 ratio
- If an image generator can only produce a nearby portrait ratio, generate with extra side-safe composition, crop to **7:12**, then resize to 840 × 1440 only after the composition is approved.
- Never stretch an image to the target ratio.
- The Forge carousel must ultimately use `aspect-ratio: 7 / 12` so the UI does not crop the standardized cards back toward 5:7.

Why 7:12: it is visibly taller and narrower than 5:7 and reads much more like a traditional tarot card while still fitting the horizontal Forge carousel well.

## 2. One fixed card template

Formatting must not drift from card to card. The **art changes; the card system does not**.

The most reliable production approach is:

1. Generate the illustration as full-bleed artwork.
2. Normalize/crop it to the canonical 7:12 canvas.
3. Apply the same reusable gold frame, title position, emblem position, and lower readability gradient to every card.
4. Export only after the illustration and anatomy pass QA.

Do not ask the image generator to reinvent the frame/footer/title layout for every card if a reusable template can be used instead. The generator should primarily solve the illustration.

## 3. Absolute rule: NO FOOTER

**There is no footer panel.**

This has been clarified repeatedly and is non-negotiable.

- No opaque black rectangle at the bottom.
- No separate black title band.
- No darker-black-on-black stacked lower panel.
- No visible horizontal boundary that makes the card feel split into artwork + footer.
- The **illustration continues behind the title and emblem all the way to the bottom of the card**.
- For readability, use only a restrained transparent bottom-up dark gradient over the artwork.
- Environmental details should remain visible through the lower title area.

The older Grave-style treatment is the benchmark: continuous illustration, readable title, integrated emblem, no separate footer.

## 4. Lower-third geometry

Keep the lower treatment fixed so title placement stops drifting.

For an 840 × 1440 export:

- Full-bleed artwork: entire 840 × 1440 canvas.
- Readability gradient may begin around **72–75% card height** and strengthen gradually toward the bottom.
- Gradient maximum opacity should generally stay around **45–55% black**, not fully opaque.
- Title center target: approximately **83–85% card height**.
- Emblem center target: approximately **91–93% card height**.
- Keep the bottom frame visible with comfortable breathing room below the emblem.
- Long titles may wrap to two centered lines, but the title/emblem geometry must not reflow into a larger footer-like block.
- Subtitle is optional, not required. If used, it must occupy a fixed small zone and must **not** move the title or emblem. Omit it when unnecessary.

Exact pixel placement may be adjusted once a reusable template is finalized, but all cards must use the same finalized geometry.

## 5. Frame and gold treatment

- Use one consistent ornate **antique-gold filigree frame** for the full deck.
- Elegant and detailed, but not excessively thick.
- The frame, title, and emblem should carry most of the card's gold.
- Gold inside the illustration is an accent, not the dominant material.
- Avoid covering armor, clothing, scenery, magic, and particles in reflective gold at the same time.
- The gold frame should visually unify cards with very different color palettes.

## 6. Preferred image character: photorealistic, crisp, matte

The preferred rendering target is **high-detail cinematic photorealism** while still reading as fantasy art.

Prioritize:

- crisp facial detail;
- realistic skin, hair, fur, scales, cloth, leather, stone, wood, and metal;
- strong local contrast around the subject;
- clear silhouette separation from the background;
- believable material response;
- natural depth and atmospheric perspective;
- high apparent resolution when the card is viewed full-size or reduced in the carousel.

Avoid:

- painterly mush;
- low-resolution softness;
- excessive sharpening halos;
- artificial grain;
- glitter-like texture;
- wet/plastic-looking skin or clothing;
- making every hard surface mirror-shiny.

## 7. Dry/matte lighting preference

The deck should generally have a **drier, less glossy** finish.

- Do not spray every image with floating light motes, sparkles, dust glints, or glitter.
- Do not make every environment full of dozens of candles, lanterns, torches, or tiny highlights.
- Use shine and glow for a reason: a spell, moonlight, divine radiance, embers, reflected water, a magical artifact, etc.
- One controlled magical effect is usually stronger than many unrelated particle effects.
- Background illumination should support the focal subject rather than compete with it.
- Brightness and reflective detail should be used like an accent, not a garden hose.

## 8. Background standard

Backgrounds should be detailed enough to tell a story but quiet enough to preserve the character as the primary focal point.

Good backgrounds:

- readable landscape, architecture, battlefield, temple, forest, ship, workshop, ruin, extraplanar space, or settlement;
- selective environmental detail;
- color separation from the subject;
- depth and atmospheric recession;
- one or two supporting story elements.

Avoid:

- dozens of tiny torches/candles/windows that turn into visual noise;
- excessive floating particles;
- overbusy crowds unless the subclass specifically needs them;
- repeating the same gothic castle/moon composition too often;
- background highlights that are brighter or sharper than the character's face.

## 9. Character composition and variety

The deck must be cohesive **without becoming repetitive**.

Vary across adjacent cards:

- facing direction;
- gaze direction;
- standing/crouching/seated/action poses;
- low, eye-level, and slightly elevated camera angles;
- close, medium, and environmental framing;
- weapon/action/focus point;
- serious, calm, fierce, seductive, scholarly, playful, grim, noble, strange, or exhausted moods.

Do not make a whole batch stare toward the same upper corner.

An occasional card may intentionally take one quality to an extreme—very stoic, very fierce, especially glamorous/sexy, especially gritty, etc.—as a standout card. That exception should feel deliberate and should not break the deck's anatomy, framing, or lower-third rules.

## 10. Species and gender diversity

Do not let the deck collapse into humans and elves.

Use the Character Forge species roster as inspiration and deliberately rotate through appropriate species such as:

- Dragonborn;
- Dwarf;
- Gnome;
- Halfling;
- Goliath;
- Orc / Half-Orc where available;
- Tiefling;
- Aasimar;
- Genasi;
- Fairy;
- Autognome;
- Firbolg;
- Bugbear;
- other campaign-supported species that fit the subclass concept.

Humans and elves are still valid, but should not dominate consecutive batches.

Also vary gender presentation. Do not accidentally produce an entire batch of only women or only men. A practical guideline is to check the previous several approved cards before choosing the next subject.

## 11. Sexy vs. tasteful

Some cards can be sexy or glamorous, but:

- anatomy must remain believable;
- breasts and body proportions must not be exaggerated;
- do not rely on excessive exposed skin to communicate attractiveness;
- clothing/armor should still make sense for the character and scene;
- sensuality can come from pose, confidence, expression, costume design, lighting, and silhouette.

Other cards should deliberately be stoic, brutal, scholarly, old, scarred, armored, weathered, strange, or otherwise non-glamorous so the deck has range.

## 12. Subclass readability

A viewer should understand the subclass fantasy before reading the title.

Examples:

- Beast Master: clear meaningful bond with an animal companion.
- Grave: funerary/death imagery without becoming a generic necromancer.
- Arcane Trickster: stealth and magic must both read.
- Drakewarden: the ranger–drake relationship must be obvious.
- Light: controlled divine/radiant identity.
- Tempest: storm authority rather than random blue sparkles.
- Lore: scholarship/storytelling rather than generic wizard imagery.

Use environment, pose, props, companions, magic, and expression to communicate the subclass.

## 13. Anatomy and object QA — mandatory

Before accepting **every card**, inspect it at full resolution.

Check:

- both hands;
- exact finger count/placement where visible;
- wrists;
- elbows;
- shoulder attachment;
- leg and knee direction;
- feet/toes if visible;
- face symmetry and eyes;
- horns, ears, tails, wings, and species anatomy;
- weapon grips;
- bow/string/arrow geometry;
- swords, staffs, shields, books, instruments, tools, and other props;
- companion anatomy;
- overlapping limbs and silhouettes;
- impossible duplicated jewelry/straps/objects.

If a hand, arm, weapon, or major prop is wrong, **redo the card**. Do not keep a strong composition with visibly broken anatomy.

## 14. Pre-generation checklist

Before every new set:

- [ ] Confirm exact subclass names against the current checklist / Supabase preferred catalogue.
- [ ] Confirm none are already approved in the new normalized deck.
- [ ] Choose species and gender with recent-card diversity in mind.
- [ ] Choose a pose/gaze/composition that differs from neighboring cards.
- [ ] Define the subclass identity before adding decorative effects.
- [ ] Remember: 7:12, full-bleed art, no footer.
- [ ] Keep gold and glow controlled.
- [ ] Prefer crisp photorealism and a dry/matte finish.

## 15. Post-generation acceptance test

A card is not approved until it passes all of these:

1. **Subclass test:** Does the image clearly communicate the subclass?
2. **Deck test:** Does it look like it belongs in the same tarot deck?
3. **Dimension test:** Is it exactly 7:12 and destined for 840 × 1440 export?
4. **No-footer test:** Does the artwork continue behind the title/emblem to the bottom?
5. **Anatomy test:** Are hands, fingers, limbs, face, species anatomy, weapons, and props correct?
6. **Clarity test:** Is the subject crisp and clearly separated from the background?
7. **Matte test:** Is the image free of unnecessary glitter, random light motes, and excessive shine?
8. **Background test:** Does the environment add story without drowning out the subject?
9. **Variety test:** Is the pose/gaze/species/gender/mood sufficiently different from recent cards?
10. **Carousel test:** Does it remain attractive and readable when reduced to carousel size?

If any of 1–6 fails, regenerate before moving on. Problems in 7–10 should normally be corrected before approval as well.

## 16. Repository/export contract

- Final format: WebP.
- Final dimensions: **840 × 1440**.
- Recommended quality: high-quality visually lossless/near-lossless export appropriate for UI artwork.
- Repository path pattern: `public/media/subclasses/<class-key>/<class-key>-<art-family>.webp`.
- Keep file naming lowercase and hyphenated.
- Do not wire an asset in `utils/classes/subclassArtwork.js` until that specific card has been reviewed and approved.
- Cards should be added in small reviewed batches so a weak card cannot disappear inside a large upload.

## 17. Protected implementation boundaries

Artwork work must remain presentation-only.

Do not change subclass eligibility, level requirements, selection persistence, progression, class rules, Supabase schema/data, maps, travel, crafting, inventory, merchants, encounters, tactical authority, or other unrelated runtime systems while producing card art.
