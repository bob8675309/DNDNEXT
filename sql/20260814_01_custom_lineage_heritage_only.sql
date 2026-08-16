-- Custom Lineage uses the Grim Hollow 2024 Heritage Trait economy in the canonical Forge.
-- Preserve raw_payload/source fidelity; only the normalized player-facing metadata is changed.
update public.character_option_catalog
set description = 'Build this Custom Lineage entirely from Heritage Traits. Choose exactly eight Heritage Trait picks. Combat, Exploration, and Roleplaying organize the available traits but do not impose quotas. A trait may be chosen again only when its rules allow an improved or repeated benefit, and each selection spends one of the eight picks.',
    metadata = (metadata - 'darkvision' - 'languages')
      || jsonb_build_object('heritageOnly', true, 'heritagePickCount', 8)
where option_type = 'species'
  and name = 'Custom Lineage'
  and source = 'TCE'
  and metadata ? 'heritageTraitCatalog';
