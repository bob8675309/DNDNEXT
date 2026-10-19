-- Register the approved 2026-10-16/17 merchant portrait batch in the shared NPC portrait library.
-- The artwork itself lives in public/npc-portraits/library/merchant-batch-20261016.
-- Assignments below are intentionally guarded to fill only merchants that still have no portrait.

INSERT INTO public.npc_portrait_library (
  name,bucket,storage_path,public_url,category,tags,species_tags,profession_tags,theme_tags,
  width,height,aspect_ratio,recommended_use,source,is_active,sort_order,notes
) VALUES
('Dwarven Jeweler','repo-static','library/merchant-batch-20261016/merchant-portrait-dwarf-jeweler-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-dwarf-jeweler-20261016.png','dwarf',ARRAY['dwarf','merchant-friendly','merchant','jeweler','artisan','jewelry','gemwork','workshop','polished']::text[],ARRAY['dwarf']::text[],ARRAY['merchant-friendly','merchant','jeweler','artisan']::text[],ARRAY['jewelry','gemwork','workshop','polished']::text[],1086,1448,'3:4','merchant','generated',true,186,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Lizardfolk Apothecary','repo-static','library/merchant-batch-20261016/merchant-portrait-lizardfolk-apothecary-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-lizardfolk-apothecary-20261016.png','lizardfolk',ARRAY['lizardfolk','merchant-friendly','merchant','apothecary','herbalist','apothecary','herbs','bazaar','oddity']::text[],ARRAY['lizardfolk']::text[],ARRAY['merchant-friendly','merchant','apothecary','herbalist']::text[],ARRAY['apothecary','herbs','bazaar','oddity']::text[],1086,1448,'3:4','merchant','generated',true,187,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Tiefling Curio Dealer','repo-static','library/merchant-batch-20261016/merchant-portrait-tiefling-curio-dealer-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-tiefling-curio-dealer-20261016.png','tiefling',ARRAY['tiefling','merchant-friendly','merchant','artisan','curio','arcane','relics','clockwork']::text[],ARRAY['tiefling']::text[],ARRAY['merchant-friendly','merchant','artisan']::text[],ARRAY['curio','arcane','relics','clockwork']::text[],1086,1448,'3:4','merchant','generated',true,188,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Human Scribe with Raven','repo-static','library/merchant-batch-20261016/merchant-portrait-human-scribe-raven-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-human-scribe-raven-20261016.png','human',ARRAY['human','merchant-friendly','merchant','scribe','books','raven','maps','scholarly']::text[],ARRAY['human']::text[],ARRAY['merchant-friendly','merchant','scribe']::text[],ARRAY['books','raven','maps','scholarly']::text[],1086,1448,'3:4','merchant','generated',true,189,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Goblin Prosthetic Smith','repo-static','library/merchant-batch-20261016/merchant-portrait-goblin-smith-prosthetic-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-goblin-smith-prosthetic-20261016.png','goblin',ARRAY['goblin','merchant-friendly','merchant','smith','artisan','forge','clockwork','smithy','prosthetic']::text[],ARRAY['goblin']::text[],ARRAY['merchant-friendly','merchant','smith','artisan']::text[],ARRAY['forge','clockwork','smithy','prosthetic']::text[],1086,1448,'3:4','merchant','generated',true,190,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Kenku Map Broker','repo-static','library/merchant-batch-20261016/merchant-portrait-kenku-map-broker-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-kenku-map-broker-20261016.png','kenku',ARRAY['kenku','merchant-friendly','merchant','scribe','maps','travel','caravan','broker']::text[],ARRAY['kenku']::text[],ARRAY['merchant-friendly','merchant','scribe']::text[],ARRAY['maps','travel','caravan','broker']::text[],1086,1448,'3:4','merchant','generated',true,191,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Minotaur Caravan Outfitter','repo-static','library/merchant-batch-20261016/merchant-portrait-minotaur-caravan-outfitter-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-minotaur-caravan-outfitter-20261016.png','minotaur',ARRAY['minotaur','merchant-friendly','merchant','artisan','caravan','road','rain','leatherwork']::text[],ARRAY['minotaur']::text[],ARRAY['merchant-friendly','merchant','artisan']::text[],ARRAY['caravan','road','rain','leatherwork']::text[],1086,1448,'3:4','merchant','generated',true,192,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Ratfolk Locksmith','repo-static','library/merchant-batch-20261016/merchant-portrait-ratfolk-locksmith-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-ratfolk-locksmith-20261016.png','ratfolk',ARRAY['ratfolk','merchant-friendly','merchant','artisan','locksmith','keys','alley','contraband']::text[],ARRAY['ratfolk']::text[],ARRAY['merchant-friendly','merchant','artisan']::text[],ARRAY['locksmith','keys','alley','contraband']::text[],1086,1448,'3:4','merchant','generated',true,193,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Hobgoblin Salvage Broker','repo-static','library/merchant-batch-20261016/merchant-portrait-hobgoblin-salvage-broker-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-hobgoblin-salvage-broker-20261016.png','hobgoblin',ARRAY['hobgoblin','merchant-friendly','merchant','artisan','salvage','industrial','scrap','dirty-town']::text[],ARRAY['hobgoblin']::text[],ARRAY['merchant-friendly','merchant','artisan']::text[],ARRAY['salvage','industrial','scrap','dirty-town']::text[],1086,1448,'3:4','merchant','generated',true,194,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Gnoll Spice Caravan Matriarch','repo-static','library/merchant-batch-20261016/merchant-portrait-gnoll-spice-caravan-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-gnoll-spice-caravan-20261016.png','gnoll',ARRAY['gnoll','merchant-friendly','merchant','caravan','spice','desert','moonlit']::text[],ARRAY['gnoll']::text[],ARRAY['merchant-friendly','merchant']::text[],ARRAY['caravan','spice','desert','moonlit']::text[],1086,1448,'3:4','merchant','generated',true,195,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Firbolg Road Apothecary','repo-static','library/merchant-batch-20261016/merchant-portrait-firbolg-road-apothecary-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-firbolg-road-apothecary-20261016.png','firbolg',ARRAY['firbolg','merchant-friendly','merchant','apothecary','herbalist','road','forest','rain','wagon']::text[],ARRAY['firbolg']::text[],ARRAY['merchant-friendly','merchant','apothecary','herbalist']::text[],ARRAY['road','forest','rain','wagon']::text[],1086,1448,'3:4','merchant','generated',true,196,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Thri-kreen Silk Dyer','repo-static','library/merchant-batch-20261016/merchant-portrait-thri-kreen-silk-dyer-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-thri-kreen-silk-dyer-20261016.png','thri-kreen',ARRAY['thri-kreen','merchant-friendly','merchant','artisan','silk','dye','textiles','border-town']::text[],ARRAY['thri-kreen']::text[],ARRAY['merchant-friendly','merchant','artisan']::text[],ARRAY['silk','dye','textiles','border-town']::text[],1086,1448,'3:4','merchant','generated',true,197,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Bugbear Junk Dealer','repo-static','library/merchant-batch-20261016/merchant-portrait-bugbear-junk-dealer-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-bugbear-junk-dealer-20261016.png','bugbear',ARRAY['bugbear','merchant-friendly','merchant','artisan','junk','salvage','frontier','mud']::text[],ARRAY['bugbear']::text[],ARRAY['merchant-friendly','merchant','artisan']::text[],ARRAY['junk','salvage','frontier','mud']::text[],1086,1448,'3:4','merchant','generated',true,198,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Aasimar Plague Apothecary','repo-static','library/merchant-batch-20261016/merchant-portrait-aasimar-plague-apothecary-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-aasimar-plague-apothecary-20261016.png','aasimar',ARRAY['aasimar','merchant-friendly','merchant','apothecary','herbalist','plague-doctor','road','rain','somber']::text[],ARRAY['aasimar']::text[],ARRAY['merchant-friendly','merchant','apothecary','herbalist']::text[],ARRAY['plague-doctor','road','rain','somber']::text[],1086,1448,'3:4','merchant','generated',true,199,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Tortle Cartographer','repo-static','library/merchant-batch-20261016/merchant-portrait-tortle-cartographer-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-tortle-cartographer-20261016.png','tortle',ARRAY['tortle','merchant-friendly','merchant','scribe','maps','desert','cartography','travel']::text[],ARRAY['tortle']::text[],ARRAY['merchant-friendly','merchant','scribe']::text[],ARRAY['maps','desert','cartography','travel']::text[],1086,1448,'3:4','merchant','generated',true,200,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Kenku Scribe','repo-static','library/merchant-batch-20261016/merchant-portrait-kenku-scribe-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-kenku-scribe-20261016.png','kenku',ARRAY['kenku','merchant-friendly','merchant','scribe','books','scribe','shop','scholarly']::text[],ARRAY['kenku']::text[],ARRAY['merchant-friendly','merchant','scribe']::text[],ARRAY['books','scribe','shop','scholarly']::text[],1086,1448,'3:4','merchant','generated',true,201,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Dwarf Ore Broker','repo-static','library/merchant-batch-20261016/merchant-portrait-dwarf-ore-broker-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-dwarf-ore-broker-20261016.png','dwarf',ARRAY['dwarf','merchant-friendly','merchant','smith','ore','mine','forge','industrial']::text[],ARRAY['dwarf']::text[],ARRAY['merchant-friendly','merchant','smith']::text[],ARRAY['ore','mine','forge','industrial']::text[],1086,1448,'3:4','merchant','generated',true,202,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Human Relic Dealer','repo-static','library/merchant-batch-20261016/merchant-portrait-human-relic-dealer-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-human-relic-dealer-20261016.png','human',ARRAY['human','merchant-friendly','merchant','artisan','relics','antiques','shop','polished']::text[],ARRAY['human']::text[],ARRAY['merchant-friendly','merchant','artisan']::text[],ARRAY['relics','antiques','shop','polished']::text[],1086,1448,'3:4','merchant','generated',true,203,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Orc Smith','repo-static','library/merchant-batch-20261016/merchant-portrait-orc-smith-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-orc-smith-20261016.png','orc',ARRAY['orc','merchant-friendly','merchant','smith','forge','smithy','weapons','industrial']::text[],ARRAY['orc']::text[],ARRAY['merchant-friendly','merchant','smith']::text[],ARRAY['forge','smithy','weapons','industrial']::text[],1086,1448,'3:4','merchant','generated',true,204,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Tiefling Apothecary','repo-static','library/merchant-batch-20261016/merchant-portrait-tiefling-apothecary-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-tiefling-apothecary-20261016.png','tiefling',ARRAY['tiefling','merchant-friendly','merchant','apothecary','herbalist','alchemy','herbs','shop','polished']::text[],ARRAY['tiefling']::text[],ARRAY['merchant-friendly','merchant','apothecary','herbalist']::text[],ARRAY['alchemy','herbs','shop','polished']::text[],1086,1448,'3:4','merchant','generated',true,205,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Human Scribe','repo-static','library/merchant-batch-20261016/merchant-portrait-human-scribe-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-human-scribe-20261016.png','human',ARRAY['human','merchant-friendly','merchant','scribe','scribe','books','records','polished']::text[],ARRAY['human']::text[],ARRAY['merchant-friendly','merchant','scribe']::text[],ARRAY['scribe','books','records','polished']::text[],1086,1448,'3:4','merchant','generated',true,206,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Dragonborn Caravan Trader','repo-static','library/merchant-batch-20261016/merchant-portrait-dragonborn-caravan-trader-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-dragonborn-caravan-trader-20261016.png','dragonborn',ARRAY['dragonborn','merchant-friendly','merchant','caravan','travel','desert','outfitter']::text[],ARRAY['dragonborn']::text[],ARRAY['merchant-friendly','merchant']::text[],ARRAY['caravan','travel','desert','outfitter']::text[],1086,1448,'3:4','merchant','generated',true,207,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Human Tailor','repo-static','library/merchant-batch-20261016/merchant-portrait-human-tailor-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-human-tailor-20261016.png','human',ARRAY['human','merchant-friendly','merchant','artisan','tailor','textiles','cloth','shop']::text[],ARRAY['human']::text[],ARRAY['merchant-friendly','merchant','artisan']::text[],ARRAY['tailor','textiles','cloth','shop']::text[],1086,1448,'3:4','merchant','generated',true,208,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Drow Curio Dealer','repo-static','library/merchant-batch-20261016/merchant-portrait-drow-curio-dealer-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-drow-curio-dealer-20261016.png','drow',ARRAY['drow','merchant-friendly','merchant','artisan','curio','arcane','relics','dark']::text[],ARRAY['drow']::text[],ARRAY['merchant-friendly','merchant','artisan']::text[],ARRAY['curio','arcane','relics','dark']::text[],1086,1448,'3:4','merchant','generated',true,209,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Mummy Relic Dealer','repo-static','library/merchant-batch-20261016/merchant-portrait-mummy-relic-dealer-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-mummy-relic-dealer-20261016.png','undead',ARRAY['undead','merchant-friendly','merchant','artisan','relics','antiquities','oddity','dark']::text[],ARRAY['undead']::text[],ARRAY['merchant-friendly','merchant','artisan']::text[],ARRAY['relics','antiquities','oddity','dark']::text[],1086,1448,'3:4','merchant','generated',true,210,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Grung Spice Merchant','repo-static','library/merchant-batch-20261016/merchant-portrait-grung-spice-merchant-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-grung-spice-merchant-20261016.png','grung',ARRAY['grung','merchant-friendly','merchant','spice','canal','bazaar','exotic']::text[],ARRAY['grung']::text[],ARRAY['merchant-friendly','merchant']::text[],ARRAY['spice','canal','bazaar','exotic']::text[],1086,1448,'3:4','merchant','generated',true,211,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Goblin Tinker','repo-static','library/merchant-batch-20261016/merchant-portrait-goblin-tinker-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-goblin-tinker-20261016.png','goblin',ARRAY['goblin','merchant-friendly','merchant','artisan','tinker','clockwork','junk','market']::text[],ARRAY['goblin']::text[],ARRAY['merchant-friendly','merchant','artisan']::text[],ARRAY['tinker','clockwork','junk','market']::text[],1086,1448,'3:4','merchant','generated',true,212,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Firbolg Herbalist','repo-static','library/merchant-batch-20261016/merchant-portrait-firbolg-herbalist-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-firbolg-herbalist-20261016.png','firbolg',ARRAY['firbolg','merchant-friendly','merchant','herbalist','apothecary','herbs','mushrooms','forest','shop']::text[],ARRAY['firbolg']::text[],ARRAY['merchant-friendly','merchant','herbalist','apothecary']::text[],ARRAY['herbs','mushrooms','forest','shop']::text[],1086,1448,'3:4','merchant','generated',true,213,'Merchant portrait batch 2026-10-16; repo-static artwork.'),
('Red Dragonborn Jeweler','repo-static','library/merchant-batch-20261016/merchant-portrait-red-dragonborn-jeweler-20261016.png','/npc-portraits/library/merchant-batch-20261016/merchant-portrait-red-dragonborn-jeweler-20261016.png','dragonborn',ARRAY['dragonborn','merchant-friendly','merchant','jeweler','artisan','jewelry','gems','workshop','polished']::text[],ARRAY['dragonborn']::text[],ARRAY['merchant-friendly','merchant','jeweler','artisan']::text[],ARRAY['jewelry','gems','workshop','polished']::text[],1086,1448,'3:4','merchant','generated',true,214,'Merchant portrait batch 2026-10-16; repo-static artwork.')
ON CONFLICT (bucket, storage_path) DO UPDATE SET
  name = EXCLUDED.name,
  public_url = EXCLUDED.public_url,
  category = EXCLUDED.category,
  tags = EXCLUDED.tags,
  species_tags = EXCLUDED.species_tags,
  profession_tags = EXCLUDED.profession_tags,
  theme_tags = EXCLUDED.theme_tags,
  width = EXCLUDED.width,
  height = EXCLUDED.height,
  aspect_ratio = EXCLUDED.aspect_ratio,
  recommended_use = EXCLUDED.recommended_use,
  source = EXCLUDED.source,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  notes = EXCLUDED.notes,
  updated_at = now();

UPDATE public.characters AS c
SET portrait_library_id = p.id,
    portrait_storage_path = p.storage_path,
    portrait_url = p.public_url,
    portrait_thumb_url = p.public_url,
    portrait_shop_url = p.public_url,
    portrait_source = 'library',
    image_url = p.public_url,
    updated_at = now()
FROM public.npc_portrait_library AS p
WHERE c.id = '0f7e0de7-1de0-44fd-9603-437dca2a65f4'::uuid
  AND p.bucket = 'repo-static'
  AND p.storage_path = 'library/merchant-batch-20261016/merchant-portrait-dwarf-jeweler-20261016.png'
  AND c.portrait_library_id IS NULL
  AND c.portrait_storage_path IS NULL
  AND c.portrait_url IS NULL
  AND c.portrait_shop_url IS NULL
  AND c.image_url IS NULL;

UPDATE public.characters AS c
SET portrait_library_id = p.id,
    portrait_storage_path = p.storage_path,
    portrait_url = p.public_url,
    portrait_thumb_url = p.public_url,
    portrait_shop_url = p.public_url,
    portrait_source = 'library',
    image_url = p.public_url,
    updated_at = now()
FROM public.npc_portrait_library AS p
WHERE c.id = '3a233427-e300-4313-8fce-34f6badb5d18'::uuid
  AND p.bucket = 'repo-static'
  AND p.storage_path = 'library/merchant-batch-20261016/merchant-portrait-goblin-smith-prosthetic-20261016.png'
  AND c.portrait_library_id IS NULL
  AND c.portrait_storage_path IS NULL
  AND c.portrait_url IS NULL
  AND c.portrait_shop_url IS NULL
  AND c.image_url IS NULL;

UPDATE public.characters AS c
SET portrait_library_id = p.id,
    portrait_storage_path = p.storage_path,
    portrait_url = p.public_url,
    portrait_thumb_url = p.public_url,
    portrait_shop_url = p.public_url,
    portrait_source = 'library',
    image_url = p.public_url,
    updated_at = now()
FROM public.npc_portrait_library AS p
WHERE c.id = '89ed36cb-ec0e-4b67-b2fb-7aadcfbcab80'::uuid
  AND p.bucket = 'repo-static'
  AND p.storage_path = 'library/merchant-batch-20261016/merchant-portrait-firbolg-herbalist-20261016.png'
  AND c.portrait_library_id IS NULL
  AND c.portrait_storage_path IS NULL
  AND c.portrait_url IS NULL
  AND c.portrait_shop_url IS NULL
  AND c.image_url IS NULL;

UPDATE public.characters AS c
SET portrait_library_id = p.id,
    portrait_storage_path = p.storage_path,
    portrait_url = p.public_url,
    portrait_thumb_url = p.public_url,
    portrait_shop_url = p.public_url,
    portrait_source = 'library',
    image_url = p.public_url,
    updated_at = now()
FROM public.npc_portrait_library AS p
WHERE c.id = '1cf50aae-dba6-4939-bd4b-b787bfc35262'::uuid
  AND p.bucket = 'repo-static'
  AND p.storage_path = 'library/merchant-batch-20261016/merchant-portrait-tiefling-curio-dealer-20261016.png'
  AND c.portrait_library_id IS NULL
  AND c.portrait_storage_path IS NULL
  AND c.portrait_url IS NULL
  AND c.portrait_shop_url IS NULL
  AND c.image_url IS NULL;

UPDATE public.characters AS c
SET portrait_library_id = p.id,
    portrait_storage_path = p.storage_path,
    portrait_url = p.public_url,
    portrait_thumb_url = p.public_url,
    portrait_shop_url = p.public_url,
    portrait_source = 'library',
    image_url = p.public_url,
    updated_at = now()
FROM public.npc_portrait_library AS p
WHERE c.id = 'e22e5748-06c2-460b-8cee-74dae96f2877'::uuid
  AND p.bucket = 'repo-static'
  AND p.storage_path = 'library/merchant-batch-20261016/merchant-portrait-minotaur-caravan-outfitter-20261016.png'
  AND c.portrait_library_id IS NULL
  AND c.portrait_storage_path IS NULL
  AND c.portrait_url IS NULL
  AND c.portrait_shop_url IS NULL
  AND c.image_url IS NULL;
