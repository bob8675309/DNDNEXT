# NPC Portrait Generation Workflow

This queue is for creating **original** fantasy-realistic NPC portraits. Use the Pinterest/reference-board examples only for broad direction: dramatic fantasy portraiture, varied faces, detailed clothing, painterly rendering, and moody lighting. Do not copy a found image, face, pose, costume, watermark, or artist signature.

## Files

- Queue: `docs/npc-portrait-generation-queue.json`
- Art direction: `docs/npc-portrait-art-direction.md`
- Finished images: `public/npc-portraits/realistic/<category>/<slug>.jpg`

## Generation settings

- Aspect ratio: `3:4`
- Preferred master size: `1536x2048`
- Minimum accepted size: `768x1024`
- Format: JPG or WebP for finished public assets
- Crop: upper-body or three-quarter-body portrait
- Background: visible shop/workshop/location context

## Review checklist

Accept a portrait only if all are true:

1. It is realistic or painterly-realistic fantasy art.
2. The NPC face is clear and expressive.
3. The role is readable from clothing, props, and environment.
4. It is not cartoon/vector/chibi/emoji-like.
5. It does not contain text, logos, watermarks, or signatures.
6. It is not an obvious copy of a web reference.
7. Hands are acceptable; no major face or anatomy distortions.
8. It works at small card size and large profile size.

## Suggested usage

Generate 2–4 candidates per queue item. Pick the strongest one, rename it to the `suggestedPath`, and commit it to the repo. After adding a portrait, set that character's `portrait_url` and `portrait_shop_url` to the public path, then synchronize `character_sheets.sheet.portrait`.

Example SQL for a finished portrait:

```sql
update public.characters
set portrait_url = '/npc-portraits/realistic/merchant/ba-barrackus-badass-market-broker.jpg',
    portrait_shop_url = '/npc-portraits/realistic/merchant/ba-barrackus-badass-market-broker.jpg',
    portrait_source = 'library',
    updated_at = now()
where name = 'B.A Barrackus';

update public.character_sheets cs
set sheet = jsonb_set(
  coalesce(cs.sheet, '{}'::jsonb),
  '{portrait}',
  jsonb_build_object(
    'url', '/npc-portraits/realistic/merchant/ba-barrackus-badass-market-broker.jpg',
    'storagePath', '',
    'thumbUrl', '/npc-portraits/realistic/merchant/ba-barrackus-badass-market-broker.jpg',
    'shopUrl', '/npc-portraits/realistic/merchant/ba-barrackus-badass-market-broker.jpg',
    'source', 'library',
    'prompt', '',
    'recommendedMasterSize', '1536x2048',
    'aspectRatio', '3:4'
  ),
  true
),
updated_at = now()
from public.characters c
where c.id = cs.character_id
  and c.name = 'B.A Barrackus';
```

## Batch priority

Start with shop-facing characters because they are most visible:

1. B.A Barrackus
2. Gormek Ironjaw
3. Alchroy
4. Linn
5. Sally
6. Archivist Neral
7. Milo the Wandering
8. Grinda Oakshade
9. Marn the Bold
10. Stablemaster Dalo

Then generate major town/lore NPCs:

1. Mog
2. Marta Ironroot
3. Bardin Truebeard
4. Captain Brannic Holt
5. Ilga the Windwalker
6. Elandra Waveborn
7. Cerric The Cut
8. Bralen Stables

## Notes

The existing SVG defaults are acceptable only as temporary fallback art. They should not be used as the final look for important NPCs, merchants, or crafters.
