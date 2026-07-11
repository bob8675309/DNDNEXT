-- Make the admin feature-grant panel useful before the full reviewed option import.
-- Imported source versions automatically win through character_option_catalog_preferred.

insert into public.character_option_catalog(
  option_key,option_type,name,source,category,description,prerequisite_text,metadata,updated_at
)
select
  'feat:' || lower(regexp_replace(regexp_replace(name,'[’'']','','g'),'[^a-zA-Z0-9]+','-','g')) || '|CAMPAIGN',
  'feat',name,'CAMPAIGN',category,
  'Campaign fallback entry. Import the reviewed 5etools character-option batches to replace this with the preferred source description and metadata.',
  case when category='General' then 'Level 4+ under standard progression; the Game Master may grant it earlier as a campaign reward.' else null end,
  jsonb_build_object('minimumLevel',case when category='General' then 4 else 1 end,'fallback',true),now()
from (values
  ('Alert','Origin'),('Crafter','Origin'),('Healer','Origin'),('Lucky','Origin'),('Magic Initiate','Origin'),('Musician','Origin'),('Savage Attacker','Origin'),('Skilled','Origin'),('Tavern Brawler','Origin'),('Tough','Origin'),
  ('Actor','General'),('Athlete','General'),('Charger','General'),('Chef','General'),('Crossbow Expert','General'),('Crusher','General'),('Defensive Duelist','General'),('Dual Wielder','General'),('Durable','General'),('Elemental Adept','General'),('Fey-Touched','General'),('Grappler','General'),('Great Weapon Master','General'),('Heavily Armored','General'),('Heavy Armor Master','General'),('Inspiring Leader','General'),('Keen Mind','General'),('Lightly Armored','General'),('Mage Slayer','General'),('Martial Weapon Training','General'),('Medium Armor Master','General'),('Moderately Armored','General'),('Mounted Combatant','General'),('Observant','General'),('Piercer','General'),('Poisoner','General'),('Polearm Master','General'),('Resilient','General'),('Ritual Caster','General'),('Sentinel','General'),('Shadow-Touched','General'),('Sharpshooter','General'),('Shield Master','General'),('Skill Expert','General'),('Skulker','General'),('Slasher','General'),('Speedy','General'),('Spell Sniper','General'),('Telekinetic','General'),('Telepathic','General'),('War Caster','General'),('Weapon Master','General')
) fallback(name,category)
on conflict(option_key) do update set category=excluded.category,description=excluded.description,prerequisite_text=excluded.prerequisite_text,metadata=excluded.metadata,updated_at=now();

insert into public.character_option_catalog(
  option_key,option_type,name,source,category,description,prerequisite_text,metadata,updated_at
)
select
  'boon:' || lower(regexp_replace(regexp_replace(name,'[’'']','','g'),'[^a-zA-Z0-9]+','-','g')) || '|CAMPAIGN',
  'boon',name,'CAMPAIGN','Epic Boon',
  'Campaign fallback Epic Boon. Import the reviewed 5etools character-option batches to replace this with the preferred source description and metadata.',
  'Level 19+ under standard progression; the Game Master may grant it as a campaign reward.',
  jsonb_build_object('minimumLevel',19,'fallback',true),now()
from (values
  ('Boon of Combat Prowess'),('Boon of Dimensional Travel'),('Boon of Energy Resistance'),('Boon of Fate'),('Boon of Fortitude'),('Boon of Irresistible Offense'),('Boon of Recovery'),('Boon of Skill'),('Boon of Speed'),('Boon of Spell Recall'),('Boon of the Night Spirit'),('Boon of Truesight')
) fallback(name)
on conflict(option_key) do update set category=excluded.category,description=excluded.description,prerequisite_text=excluded.prerequisite_text,metadata=excluded.metadata,updated_at=now();
