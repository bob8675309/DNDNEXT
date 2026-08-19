# Background Forge Art Asset Inventory

## Complete: reusable family banners
- martial
- arcane
- travel
- intrigue
- craft
- faith
- giant
- haunted

## Complete: reusable family crests
- martial
- arcane
- travel
- intrigue / rogue
- craft
- faith
- giant
- haunted
- noble / court

## Complete: section icons
- skills
- tools
- languages
- origin feat
- background feature
- before adventuring
- special choice
- lore / info

## Integration decision
- The approved hero banners are reused at lower opacity in the Before Adventuring strip rather than creating duplicate narrative-strip raster files.
- Helper strips use the reusable lore/info icon plus CSS color treatment rather than duplicating baked-in text artwork.
- This keeps the art library small and prevents the same scene from being stored multiple times.

## Integration status
- Phase 1 wired: selected Background hero uses its family banner and shared family crest.
- Phase 1 wired: Skills, Tools, Languages, Origin Feat, Before Adventuring, and Lore/Info surfaces use the shared icon kit.
- Existing Background choice/routing mechanics remain owned by the preserved base guide.

## Still to finish
- browser-review family classification across representative backgrounds
- left-catalogue family identity polish if the hero treatment is approved
- special background-specific art only where the shared kit is not distinctive enough
