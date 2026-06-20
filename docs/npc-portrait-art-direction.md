# NPC Portrait Art Direction

## Goal

NPC portraits should read as **fantasy / D&D / painterly-realistic** character art, not mascot art, icons, emoji, or flat vector placeholders. The portrait should feel like a believable person standing in their shop, workshop, market stall, archive, forge, or arcane studio.

Recommended master size: **1536×2048 px**  
Minimum acceptable size: **768×1024 px**  
Aspect ratio: **3:4 vertical**

## Visual target

Use portraits like `public/parchment.jpg`, `public/parchment3.jpg`, and similar images as the intended direction:

- realistic fantasy illustration
- upper-body or three-quarter-body NPC
- clear face and readable silhouette
- shop/workshop environment visible behind the character
- warm lantern/candle/forge light
- detailed props that communicate role
- practical medieval/fantasy clothing
- grounded color palette
- no modern clothing, plastic, guns, neon cyberpunk, or cartoon proportions

Avoid:

- flat SVG mascot art
- emoji-like faces
- chibi/cartoon proportions
- simple vector shapes
- watermarked stock images in production
- direct copies of found internet art

The generated SVG files in `public/npc-portraits/defaults` are only emergency fallbacks. Finished characters should use realistic JPG/PNG/WebP portraits.

## Folder convention

Place finished portraits under:

```text
public/npc-portraits/realistic/<category>/<slug>.jpg
```

Suggested categories:

```text
smithing
alchemy
enchanting
scribe
merchant
general
monster
noble
guard
```

Examples:

```text
public/npc-portraits/realistic/smithing/dwarf-forgemaster-gormek.jpg
public/npc-portraits/realistic/enchanting/arcane-enchanter-linn.jpg
public/npc-portraits/realistic/merchant/barrackus-market-broker.jpg
```

## Core prompt template

```text
A realistic painterly fantasy portrait of [NPC DESCRIPTION], Dungeons and Dragons campaign art, three-quarter upper body, standing inside [SHOP OR WORKSHOP], expressive face, believable medieval fantasy clothing, detailed hands and props, warm lantern light, atmospheric depth, richly textured background, cinematic composition, high detail, grounded color palette, 3:4 vertical portrait, no text, no watermark, no logo, no modern objects, not cartoon, not vector art, not chibi.
```

## Negative prompt

```text
cartoon, chibi, mascot, emoji, flat vector, simple shapes, comic book outline, anime, modern clothing, modern storefront, gun, camera, phone, text, watermark, logo, signature, extra fingers, distorted hands, deformed face, blurry face, low detail, cropped head, duplicate person
```

## Portrait prompt pack

### Smithing / forge

1. **Dwarf forgemaster**

```text
A realistic painterly fantasy portrait of a stout older dwarf master blacksmith with a heavy braided gray beard, soot-marked face, leather apron, thick gloves, and a calm confident stare, standing in a cramped forge full of anvils, hanging tools, glowing coals, weapon blanks, and stacked ingots, warm forge light, Dungeons and Dragons campaign art, three-quarter upper body, high detail, 3:4 vertical portrait, no text, no watermark, not cartoon, not vector art.
```

2. **Orc armorer**

```text
A realistic painterly fantasy portrait of a broad-shouldered orc armorer with tusks, scarred green skin, iron piercings, a dark leather smith apron, and a massive hammer resting at his side, standing in a smoky workshop lined with shields, chain mail, tongs, and red-hot metal, dramatic forge glow, grounded medieval fantasy style, Dungeons and Dragons campaign art, 3:4 vertical portrait, no text, no watermark, not cartoon.
```

3. **Human weaponsmith**

```text
A realistic painterly fantasy portrait of a weathered human weaponsmith with rolled sleeves, burn scars, close-cropped beard, and focused eyes, holding a half-finished sword hilt in a busy stone forge, racks of blades and tools behind him, warm orange light and floating sparks, grounded D&D fantasy art, 3:4 vertical portrait, no text, no watermark, not vector art.
```

### Alchemy / apothecary

4. **Dwarf apothecary**

```text
A realistic painterly fantasy portrait of an elderly dwarf apothecary with round brass spectacles, a long gray beard, herb-stained fingers, and a leather satchel of vials, standing in a crowded alchemy shop filled with jars, dried herbs, copper alembics, glass bottles, candles, and handwritten labels, warm dusty light, Dungeons and Dragons campaign art, 3:4 vertical portrait, no text, no watermark, not cartoon.
```

5. **Elf herbalist**

```text
A realistic painterly fantasy portrait of a graceful elf herbalist with silver hair, practical forest-green robes, and a calm clinical expression, holding a bundle of rare herbs in a shop packed with hanging flowers, potion bottles, mortar and pestle, and drying roots, soft green-gold light, painterly realistic D&D fantasy, 3:4 vertical portrait, no text, no watermark, not vector art.
```

6. **Tiefling poisoner**

```text
A realistic painterly fantasy portrait of a tiefling poisoner with small curved horns, burgundy skin, dark braided hair, and sharp intelligent eyes, wearing a dark apothecary coat and holding a tiny black vial, surrounded by locked cabinets, venom jars, dried mushrooms, and candlelit glassware, moody fantasy realism, Dungeons and Dragons campaign art, 3:4 vertical portrait, no text, no watermark, not cartoon.
```

### Enchanting / arcane shop

7. **Arcane enchanter**

```text
A realistic painterly fantasy portrait of a composed arcane enchanter with luminous eyes, embroidered violet robes, silver rings, and a crystal focus in one hand, standing in an enchanting atelier filled with floating runes, suspended weapons, glowing gems, spell diagrams, and shelves of magical components, soft purple and gold light, Dungeons and Dragons campaign art, 3:4 vertical portrait, no text, no watermark, not cartoon, not vector art.
```

8. **Drow rune artisan**

```text
A realistic painterly fantasy portrait of a drow rune artisan with white hair, dark gray skin, precise silver jewelry, and an intense gaze, inscribing glowing runes onto a dagger in a shadowy subterranean magic workshop, crystals, scrolls, and arcane tools around them, cinematic fantasy realism, D&D campaign portrait, 3:4 vertical, no text, no watermark, not anime.
```

9. **Human charm-maker**

```text
A realistic painterly fantasy portrait of a middle-aged human charm-maker with tired wise eyes, layered blue robes, and many small talismans pinned to a leather vest, seated behind a wooden counter covered with amulets, candles, carved bones, gemstones, and spell threads, warm candlelit magical shop, painterly realistic D&D style, 3:4 portrait, no text, no watermark, not cartoon.
```

### Scribe / archive

10. **Grayhall archivist**

```text
A realistic painterly fantasy portrait of an elderly archivist with ink-stained hands, small spectacles, a trimmed white beard, and a heavy brown robe, standing inside a cramped archive packed with scroll tubes, ledgers, quills, maps, wax seals, and stacked books, warm library lamp light, grounded Dungeons and Dragons fantasy art, 3:4 vertical portrait, no text, no watermark, not vector art.
```

11. **Runic calligrapher**

```text
A realistic painterly fantasy portrait of a focused runic calligrapher with shaved head, ritual tattoos, and a dark scholar's coat, holding a glowing quill over parchment in a dim scriptorium, shelves of scrolls, ink bottles, candles, and magical diagrams in the background, painterly realistic D&D campaign art, 3:4 vertical portrait, no text, no watermark, not cartoon.
```

12. **Halfling map-scribe**

```text
A realistic painterly fantasy portrait of a cheerful halfling map-scribe with curly hair, practical travel clothes, and ink-smudged fingers, standing on a stool behind a desk covered in maps, compasses, wax seals, scrolls, and tiny labeled drawers, warm tavern-library atmosphere, Dungeons and Dragons campaign art, 3:4 vertical portrait, no text, no watermark, not vector art.
```

### Merchant / market

13. **Market factor**

```text
A realistic painterly fantasy portrait of a seasoned market factor with a weathered face, wrapped headscarf, layered merchant robes, and careful calculating eyes, standing before a busy open-air market stall filled with fruit, spices, bolts of cloth, baskets, and hanging scales, warm daylight filtering through canvas awnings, Dungeons and Dragons campaign art, 3:4 vertical portrait, no text, no watermark, not cartoon.
```

14. **Caravan merchant**

```text
A realistic painterly fantasy portrait of a rugged caravan merchant with sun-browned skin, a travel cloak, heavy coin belt, and a friendly suspicious smile, standing beside a wagon counter loaded with trade goods, lanterns, crates, ropes, and exotic trinkets, dusty road market atmosphere, painterly realistic fantasy, 3:4 vertical portrait, no text, no watermark, not vector art.
```

15. **General storekeeper**

```text
A realistic painterly fantasy portrait of a practical village storekeeper with rolled sleeves, simple blue tunic, trimmed beard, and a neutral professional stare, standing inside a medieval general store with baskets, rope, sacks, jars, tools, lanterns, and shelves of everyday adventuring gear, warm natural light, Dungeons and Dragons campaign art, 3:4 portrait, no text, no watermark, not cartoon.
```

### Guards, nobles, and notable NPCs

16. **City guard captain**

```text
A realistic painterly fantasy portrait of a stern city guard captain in worn mail and a dark cloak, graying beard, tired eyes, one hand on a sword pommel, standing in a stone guardroom with weapon racks, maps, torches, and a city banner behind him, grounded D&D fantasy realism, 3:4 vertical portrait, no text, no watermark, not cartoon.
```

17. **Monster city official**

```text
A realistic painterly fantasy portrait of a composed monstrous city official with subtle inhuman features, elegant dark court clothing, rings, and a calculating expression, standing in a dim civic chamber of carved stone and candlelight, documents and seals on a desk, Dungeons and Dragons campaign art, painterly realistic, 3:4 vertical portrait, no text, no watermark, not vector art.
```

18. **Arena veteran**

```text
A realistic painterly fantasy portrait of a scarred arena veteran with a shaved head, battered leather armor, old medals, and a watchful expression, standing in a shadowed gladiator staging room with weapons, sand, banners, and torchlight, gritty D&D fantasy realism, 3:4 vertical portrait, no text, no watermark, not cartoon.
```

## Database usage

For public-folder portraits, store the direct site path in the character row:

```sql
update public.characters
set portrait_url = '/npc-portraits/realistic/merchant/barrackus-market-broker.jpg',
    portrait_shop_url = '/npc-portraits/realistic/merchant/barrackus-market-broker.jpg',
    portrait_source = 'library',
    updated_at = now()
where name = 'B.A Barrackus';
```

Also update the sheet portrait object so the character sheet and row stay synchronized.

## Production caution

Do not ship watermarked stock images or direct copies of internet art. Use generated original art, commissioned art, licensed assets, or your own uploads.
