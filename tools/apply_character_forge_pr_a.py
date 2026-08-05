from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one exact match, found {count}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str, flags: int = 0) -> None:
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{path}: expected one regex match, found {count}: {pattern[:160]!r}")
    write(path, updated)


def append_once(path: str, marker: str, block: str) -> None:
    text = read(path)
    if marker in text:
        return
    write(path, text.rstrip() + "\n\n" + block.strip() + "\n")


# ---------------------------------------------------------------------------
# Canonical Forge: explicit mode, non-destructive Close, Reset, and submit hook.
# ---------------------------------------------------------------------------
replace_once(
    "components/NewNpcModalV3Refined.js",
    'export default function NewNpcModalV3Refined({ show, onClose, onCreated, locations = [] }) {',
    'export default function NewNpcModalV3Refined({ show, onClose, onCreated, locations = [], mode = "npc", createCharacter = null, onReset = null }) {',
)
replace_once(
    "components/NewNpcModalV3Refined.js",
    '  const [portraitPickerOpen, setPortraitPickerOpen] = useState(false);',
    '  const [portraitPickerOpen, setPortraitPickerOpen] = useState(false);\n  const playerMode = mode === "player";',
)
replace_once(
    "components/NewNpcModalV3Refined.js",
    '  const selectedProfessionServices = PROFESSION_KEYS.filter((key) => draft.professions?.[key]?.offersService);',
    '  const selectedProfessionServices = PROFESSION_KEYS.filter((key) => draft.professions?.[key]?.offersService);\n  const selectedTrainedProfessions = PROFESSION_KEYS.filter((key) => Number(draft.professions?.[key]?.rank || 0) > 0);',
)
replace_once(
    "components/NewNpcModalV3Refined.js",
    '    setRolls(nextRolls); setAllocation({}); setSelectedRollId(""); setDetail(null); setPortraitPickerOpen(false);',
    '    setRolls(nextRolls); setAllocation({}); setSelectedRollId(""); setDetail(null); setPortraitPickerOpen(false);\n    onReset?.();',
)
replace_once(
    "components/NewNpcModalV3Refined.js",
    '  function handleClose() { if (creating) return; resetForm(); onClose?.(); }',
    '  function handleClose() { if (creating) return; onClose?.(); }\n  function handleReset() {\n    if (creating) return;\n    const confirmed = typeof window === "undefined" || window.confirm("Reset this Character Forge draft? All entries and selections will be cleared.");\n    if (confirmed) resetForm();\n  }',
)
replace_once(
    "components/NewNpcModalV3Refined.js",
    '      const rpcPromise = supabase.rpc("create_character_v1", { p_payload: createPayload });',
    '      const rpcPromise = createCharacter ? createCharacter(createPayload) : supabase.rpc("create_character_v1", { p_payload: createPayload });',
)
replace_once(
    "components/NewNpcModalV3Refined.js",
    '''  return <div className="npc-forge-backdrop" role="presentation"><div className="npc-forge-modal npc-forge-modal-v2" role="dialog" aria-modal="true" aria-labelledby="npc-forge-title">
    <header className="npc-forge-header"><div><div className="npc-forge-kicker">Canonical character system</div><h2 id="npc-forge-title">NPC Forge</h2><p>Build the rules first, then finish identity and placement. Story generation uses the identity you establish before it.</p></div><button type="button" className="btn btn-sm btn-outline-light" onClick={handleClose} disabled={creating}>Close</button></header>
    <nav className="npc-forge-steps" aria-label="NPC creation steps">{STEP_LABELS.map((label, index) => <button key={label} type="button" className={`${index === step ? "is-current" : ""} ${index < step ? "is-complete" : ""}`} onClick={() => { if (index <= step) { setStep(index); setDetail(null); setError(""); } }} disabled={creating || index > step}><span>{index + 1}</span>{label}</button>)}</nav>
    <div className="npc-forge-body"><section className="npc-forge-workspace">''',
    '''  return <div className="npc-forge-backdrop" role="presentation"><div className={`npc-forge-modal npc-forge-modal-v2 ${playerMode ? "is-player-mode" : "is-npc-mode"}`} role="dialog" aria-modal="true" aria-labelledby={playerMode ? "player-forge-title" : "npc-forge-title"}>
    <header className="npc-forge-header"><div><div className="npc-forge-kicker">Canonical character system</div><h2 id={playerMode ? "player-forge-title" : "npc-forge-title"}>{playerMode ? "Player Character Forge" : "NPC Forge"}</h2><p>{playerMode ? "Build a player-owned character with the shared canonical Forge. Starting level may be set from 1 to 20." : "Build the rules first, then finish identity and placement. Story generation uses the identity you establish before it."}</p></div><div className="npc-forge-header-actions"><button type="button" className="btn btn-sm btn-outline-warning" onClick={handleReset} disabled={creating}>Reset</button><button type="button" className="btn btn-sm btn-outline-light" onClick={handleClose} disabled={creating}>Close</button></div></header>
    <nav className="npc-forge-steps" aria-label={playerMode ? "Player character creation steps" : "NPC creation steps"}>{STEP_LABELS.map((label, index) => <button key={label} type="button" className={`${index === step ? "is-current" : ""} ${index < step ? "is-complete" : ""}`} onClick={() => { if (index <= step) { setStep(index); setDetail(null); setError(""); } }} disabled={creating || index > step}><span>{index + 1}</span>{label}</button>)}</nav>
    <div className={`npc-forge-body npc-forge-step-${step} ${playerMode ? "is-player-mode" : "is-npc-mode"}`}><section className="npc-forge-workspace">''',
)
replace_once(
    "components/NewNpcModalV3Refined.js",
    '<span>Identity &amp; placement</span><h3>Name and place the finished character</h3>',
    '{playerMode ? <><span>Identity</span><h3>Name and define the character</h3></> : <><span>Identity &amp; placement</span><h3>Name and place the finished character</h3></>}',
)
replace_once(
    "components/NewNpcModalV3Refined.js",
    '<button type="button" onClick={generateStory}>Generate NPC story &amp; world fit</button><p>Uses {draft.name || "the character"}\'s identity, role, affiliation, tags, and selected location.</p>',
    '<button type="button" onClick={generateStory}>{playerMode ? "Generate character story & world fit" : "Generate NPC story & world fit"}</button><p>{playerMode ? `Uses ${draft.name || "the character"}\'s identity, class, background, and affiliation.` : `Uses ${draft.name || "the character"}\'s identity, role, affiliation, tags, and selected location.`}</p>',
)
replace_once(
    "components/NewNpcModalV3Refined.js",
    '<span>Review</span><h3>Confirm the canonical character</h3>',
    '<span>Review</span><h3>{playerMode ? "Confirm your player character" : "Confirm the canonical character"}</h3>',
)
replace_once(
    "components/NewNpcModalV3Refined.js",
    '<div className="npc-forge-review-hero"><div><span>{draft.kind === "merchant" ? "Merchant" : "NPC"}</span>',
    '<div className="npc-forge-review-hero"><div><span>{playerMode ? "Player Character" : draft.kind === "merchant" ? "Merchant" : "NPC"}</span>',
)
replace_once(
    "components/NewNpcModalV3Refined.js",
    '<article><span>Workshops</span><strong>{selectedProfessionServices.length ? selectedProfessionServices.map((key) => PROFESSION_DEFINITIONS[key].label).join(", ") : "No services"}</strong><p>Only explicitly enabled services appear as workshop providers.</p></article>',
    '<article><span>{playerMode ? "Professions" : "Workshops"}</span><strong>{playerMode ? (selectedTrainedProfessions.length ? selectedTrainedProfessions.map((key) => PROFESSION_DEFINITIONS[key].label).join(", ") : "No trained professions") : (selectedProfessionServices.length ? selectedProfessionServices.map((key) => PROFESSION_DEFINITIONS[key].label).join(", ") : "No services")}</strong><p>{playerMode ? "Profession training is recorded for the campaign crafting system." : "Only explicitly enabled services appear as workshop providers."}</p></article>',
)
replace_once(
    "components/NewNpcModalV3Refined.js",
    '<article><span>Placement</span><strong>{(locations || []).find((location) => String(location.id) === String(draft.locationId))?.name || "Not listed"}</strong><p>Created off-map. {draft.kind === "merchant" && draft.storefrontEnabled ? "Storefront enabled." : "No storefront."}</p></article>',
    '<article><span>{playerMode ? "Campaign status" : "Placement"}</span><strong>{playerMode ? "Player-owned • off-map" : ((locations || []).find((location) => String(location.id) === String(draft.locationId))?.name || "Not listed")}</strong><p>{playerMode ? "Class, species, background, and trained-profession tags are assigned automatically." : <>Created off-map. {draft.kind === "merchant" && draft.storefrontEnabled ? "Storefront enabled." : "No storefront."}</>}</p></article>',
)
replace_once(
    "components/NewNpcModalV3Refined.js",
    '{creating ? "Forging Character..." : `Create ${draft.kind === "merchant" ? "Merchant" : "NPC"}`}',
    '{creating ? "Forging Character..." : playerMode ? "Create Player Character" : `Create ${draft.kind === "merchant" ? "Merchant" : "NPC"}`}',
)

# ---------------------------------------------------------------------------
# Shared adapter: explicit submit function and server-compatible derived tags.
# ---------------------------------------------------------------------------
replace_once(
    "components/NewNpcModalV3.js",
    'import { useCallback, useEffect, useMemo, useRef, useState } from "react";',
    'import { useCallback, useEffect, useMemo, useState } from "react";',
)
replace_once(
    "components/NewNpcModalV3.js",
    '''function playerPayload(payload = {}) {
  const tags = Array.isArray(payload.tags) ? payload.tags : [];
  const sheet = payload.sheet && typeof payload.sheet === "object" ? payload.sheet : {};
  const casting = Boolean(sheet.spellcasting?.ability || sheet.spellcasting?.abilityLabel);''',
    '''function tagSlug(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function playerPayload(payload = {}) {
  const sheet = payload.sheet && typeof payload.sheet === "object" ? payload.sheet : {};
  const meta = sheet.meta && typeof sheet.meta === "object" ? sheet.meta : {};
  const professions = sheet.professions && typeof sheet.professions === "object" ? sheet.professions : {};
  const tags = [
    "player-character",
    tagSlug(meta.speciesKey || sheet.species || sheet.race) ? `species:${tagSlug(meta.speciesKey || sheet.species || sheet.race)}` : "",
    tagSlug(meta.classKey || sheet.classKey || sheet.className || sheet.class) ? `class:${tagSlug(meta.classKey || sheet.classKey || sheet.className || sheet.class)}` : "",
    tagSlug(meta.backgroundKey || sheet.background) ? `background:${tagSlug(meta.backgroundKey || sheet.background)}` : "",
    ...Object.entries(professions)
      .filter(([, entry]) => Number(entry?.rank || 0) > 0)
      .map(([key]) => `profession:${tagSlug(key)}`),
  ].filter(Boolean);
  const casting = Boolean(sheet.spellcasting?.ability || sheet.spellcasting?.abilityLabel);''',
)
replace_once(
    "components/NewNpcModalV3.js",
    '    tags: [...new Set([...tags, "player-character"])],',
    '    tags: [...new Set(tags)],',
)
regex_once(
    "components/NewNpcModalV3.js",
    r'function setText\(node, value\) \{.*?\n\}\n\nfunction adaptPlayerForge\(root\) \{.*?\n\}\n\nexport default function NewNpcModalV3',
    'export default function NewNpcModalV3',
    re.S,
)
replace_once("components/NewNpcModalV3.js", '  const rootRef = useRef(null);\n', '')
replace_once("components/NewNpcModalV3.js", '  const originalRpcRef = useRef(null);\n', '')
regex_once(
    "components/NewNpcModalV3.js",
    r'  useEffect\(\(\) => \{\n    if \(!show \|\| !playerMode\) return undefined;\n    const originalMethod = supabase\.rpc;.*?\n  \}, \[playerMode, show\]\);\n\n',
    '',
    re.S,
)
regex_once(
    "components/NewNpcModalV3.js",
    r'  useEffect\(\(\) => \{\n    if \(!show \|\| !playerMode \|\| typeof MutationObserver === "undefined"\) return undefined;.*?\n  \}, \[playerMode, show\]\);\n\n',
    '',
    re.S,
)
replace_once(
    "components/NewNpcModalV3.js",
    '  const contextValue = useMemo(() => ({ state: speciesChoiceState, registerSpecies, selectChoice }), [registerSpecies, selectChoice, speciesChoiceState]);',
    '''  const contextValue = useMemo(() => ({ state: speciesChoiceState, registerSpecies, selectChoice }), [registerSpecies, selectChoice, speciesChoiceState]);
  const createCharacter = useCallback((payload) => {
    if (!playerMode) return supabase.rpc("create_character_v1", { p_payload: payload });
    return supabase.rpc("create_player_character_v2", {
      p_payload: playerPayload(payload),
      p_spell_choices: [],
    });
  }, [playerMode]);''',
)
replace_once(
    "components/NewNpcModalV3.js",
    '''      <div ref={rootRef} className={playerMode ? "unified-player-character-forge" : undefined}>
        <NewNpcModalV3Refined {...props} onCreated={handleCreated} />
      </div>''',
    '''      <div className={playerMode ? "unified-player-character-forge" : undefined}>
        <NewNpcModalV3Refined
          {...props}
          mode={playerMode ? "player" : "npc"}
          createCharacter={createCharacter}
          onReset={() => setSpeciesChoiceState({ speciesId: "", speciesName: "", rules: [], selections: {} })}
          onCreated={handleCreated}
        />
      </div>''',
)
replace_once(
    "components/NewNpcModalV3.js",
    '.unified-player-character-forge .npc-forge-choice-grid.two,.unified-player-character-forge .npc-forge-profession-list,.unified-player-character-forge .npc-forge-merchant-box{display:none!important}',
    '.unified-player-character-forge .npc-forge-choice-grid.two,.unified-player-character-forge .npc-forge-merchant-box{display:none!important}',
)

# ---------------------------------------------------------------------------
# Profile host: keep the Forge mounted while closed, but clear it on refresh/auth.
# ---------------------------------------------------------------------------
replace_once(
    "components/PlayerCharacterProfilePanelUnified.js",
    '  const closePanel = useCallback(() => {\n    setOpen(false);\n    setCreatingCharacter(false);',
    '  const closePanel = useCallback(() => {\n    setOpen(false);',
)
regex_once(
    "components/PlayerCharacterProfilePanelUnified.js",
    r'  const cancelCreator = useCallback\(\(\) => \{\n    if \(characters\.length\) \{.*?\n  \}, \[characters\.length, closePanel\]\);',
    '  const cancelCreator = useCallback(() => {\n    closePanel();\n  }, [closePanel]);',
    re.S,
)
replace_once(
    "components/PlayerCharacterProfilePanelUnified.js",
    '''  if (!isLoggedIn || !open) return null;
  return (
    <div className="npc-page-profile-panel-backdrop" onMouseDown={(event) => event.target === event.currentTarget ? closePanel() : null}>
      <div className={`npc-page-profile-panel-shell ${creatingCharacter || !character ? "is-player-character-forge" : ""}`}>{panelContent}</div>
    </div>
  );''',
    '''  const keepCreatorMounted = creatingCharacter || !character;
  if (!isLoggedIn || (!open && !keepCreatorMounted)) return null;
  return (
    <div className={`npc-page-profile-panel-backdrop ${!open ? "is-forge-suspended" : ""}`} onMouseDown={(event) => open && event.target === event.currentTarget ? closePanel() : null} aria-hidden={!open}>
      <div className={`npc-page-profile-panel-shell ${keepCreatorMounted ? "is-player-character-forge" : ""}`}>{panelContent}</div>
    </div>
  );''',
)

# ---------------------------------------------------------------------------
# Portrait picker: reject SVG rows even before the migration has run.
# ---------------------------------------------------------------------------
replace_once(
    "components/NpcForgePortraitPickerModal.js",
    '        setPortraits(portraitRes.data || []);',
    '        setPortraits((portraitRes.data || []).filter((row) => !/\\.svg(?:$|[?#])/i.test(portraitUrl(row))));',
)

# ---------------------------------------------------------------------------
# Responsive/content-driven layout and full-width player-only steps.
# ---------------------------------------------------------------------------
append_once(
    "styles/character-forge-responsive.css",
    "Character Forge PR A: content-driven player layouts",
    r'''
/* Character Forge PR A: content-driven player layouts */
.npc-forge-header-actions{display:flex;align-items:center;justify-content:flex-end;gap:.55rem;flex-wrap:wrap}
.npc-page-profile-panel-backdrop.is-forge-suspended{display:none!important}
.npc-forge-body.is-player-mode.npc-forge-step-0,
.npc-forge-body.is-player-mode.npc-forge-step-1,
.npc-forge-body.is-player-mode.npc-forge-step-2{grid-template-columns:minmax(250px,30fr) minmax(0,70fr)!important}
.npc-forge-body.is-player-mode.npc-forge-step-3{grid-template-columns:minmax(0,72fr) minmax(270px,28fr)!important}
.npc-forge-body.is-player-mode.npc-forge-step-4{grid-template-columns:minmax(0,64fr) minmax(310px,36fr)!important}
.npc-forge-body.is-player-mode.npc-forge-step-5,
.npc-forge-body.is-player-mode.npc-forge-step-6,
.npc-forge-body.is-player-mode.npc-forge-step-7{grid-template-columns:minmax(0,1fr)!important}
.npc-forge-body.is-player-mode.npc-forge-step-5>.npc-forge-context-panel,
.npc-forge-body.is-player-mode.npc-forge-step-6>.npc-forge-context-panel,
.npc-forge-body.is-player-mode.npc-forge-step-7>.npc-forge-context-panel{display:none!important}
.npc-forge-body.is-player-mode.npc-forge-step-5 .npc-forge-add-row,
.npc-forge-body.is-player-mode.npc-forge-step-5 .npc-forge-add-row+.npc-forge-chip-row,
.npc-forge-body.is-player-mode.npc-forge-step-5 .npc-forge-subheading:has(+.npc-forge-add-row),
.npc-forge-body.is-player-mode.npc-forge-step-5 .npc-forge-subheading:has(+.npc-forge-form-grid),
.npc-forge-body.is-player-mode.npc-forge-step-5 .npc-forge-subheading:has(+.npc-forge-form-grid)+.npc-forge-form-grid,
.npc-forge-body.is-player-mode.npc-forge-step-5 .npc-forge-merchant-box{display:none!important}
.npc-forge-body.is-player-mode.npc-forge-step-5 .npc-forge-workspace,
.npc-forge-body.is-player-mode.npc-forge-step-6 .npc-forge-workspace,
.npc-forge-body.is-player-mode.npc-forge-step-7 .npc-forge-workspace{max-width:none!important;width:100%!important}
.npc-forge-body.is-player-mode.npc-forge-step-7 .npc-forge-review-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
.npc-forge-body.is-player-mode.npc-forge-step-7 .npc-forge-review-hero{padding:1.35rem 1.5rem!important}
@media(max-width:980px){
  .npc-forge-body.is-player-mode{grid-template-columns:minmax(0,1fr)!important}
  .npc-forge-body.is-player-mode>.npc-forge-context-panel{min-height:0!important}
  .npc-forge-body.is-player-mode.npc-forge-step-7 .npc-forge-review-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
}
@media(max-width:640px){
  .npc-forge-header-actions{width:100%;justify-content:flex-start}
  .npc-forge-body.is-player-mode.npc-forge-step-7 .npc-forge-review-grid{grid-template-columns:minmax(0,1fr)!important}
}
''',
)

# ---------------------------------------------------------------------------
# SQL migration: delete SVG portraits and enforce server-authoritative tags.
# ---------------------------------------------------------------------------
migration = r'''-- Character Forge PR A: remove SVG portrait records and make player tags server-authoritative.

-- No live character, visual asset, or suggestion references existed at audit time.
delete from public.npc_portrait_library
where lower(coalesce(public_url, '')) ~ '\.svg([?#].*)?$'
   or lower(coalesce(storage_path, '')) ~ '\.svg([?#].*)?$';

alter table public.npc_portrait_library
  drop constraint if exists npc_portrait_library_no_svg_v1;

alter table public.npc_portrait_library
  add constraint npc_portrait_library_no_svg_v1
  check (
    lower(coalesce(public_url, '')) !~ '\.svg([?#].*)?$'
    and lower(coalesce(storage_path, '')) !~ '\.svg([?#].*)?$'
  );

create or replace function private.player_character_tag_slug_v1(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select nullif(trim(both '-' from regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9]+', '-', 'g')), '');
$$;

create or replace function private.derive_player_character_tags_v1(
  p_sheet jsonb,
  p_existing_tags text[] default '{}'::text[],
  p_preserve_campaign_tags boolean default true
)
returns text[]
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_sheet jsonb := coalesce(p_sheet, '{}'::jsonb);
  v_tags text[] := '{}'::text[];
  v_species text;
  v_class text;
  v_background text;
  v_profession record;
begin
  if p_preserve_campaign_tags then
    select coalesce(array_agg(distinct lower(btrim(tag)) order by lower(btrim(tag))), '{}'::text[])
      into v_tags
    from unnest(coalesce(p_existing_tags, '{}'::text[])) as tag
    where btrim(tag) <> ''
      and lower(btrim(tag)) <> 'player-character'
      and lower(btrim(tag)) !~ '^(species|class|background|profession):';
  end if;

  v_tags := array_append(v_tags, 'player-character');
  v_species := private.player_character_tag_slug_v1(coalesce(v_sheet #>> '{meta,speciesKey}', v_sheet->>'species', v_sheet->>'race'));
  v_class := private.player_character_tag_slug_v1(coalesce(v_sheet #>> '{meta,classKey}', v_sheet->>'classKey', v_sheet->>'className', v_sheet->>'class'));
  v_background := private.player_character_tag_slug_v1(coalesce(v_sheet #>> '{meta,backgroundKey}', v_sheet->>'background'));

  if v_species is not null then v_tags := array_append(v_tags, 'species:' || v_species); end if;
  if v_class is not null then v_tags := array_append(v_tags, 'class:' || v_class); end if;
  if v_background is not null then v_tags := array_append(v_tags, 'background:' || v_background); end if;

  if jsonb_typeof(v_sheet->'professions') = 'object' then
    for v_profession in
      select key, value
      from jsonb_each(v_sheet->'professions')
    loop
      if coalesce(v_profession.value->>'rank', '') ~ '^[0-9]+$'
         and (v_profession.value->>'rank')::integer > 0 then
        v_tags := array_append(v_tags, 'profession:' || private.player_character_tag_slug_v1(v_profession.key));
      end if;
    end loop;
  end if;

  return (
    select coalesce(array_agg(distinct tag order by tag), '{}'::text[])
    from unnest(v_tags) as tag
    where tag is not null and btrim(tag) <> ''
  );
end;
$$;

create or replace function private.sync_player_character_tags_from_sheet_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_existing text[];
begin
  select c.tags into v_existing
  from public.characters c
  where c.id = new.character_id
    and 'player-character' = any(coalesce(c.tags, '{}'::text[]));

  if not found then return new; end if;

  update public.characters
  set tags = private.derive_player_character_tags_v1(
    new.sheet,
    v_existing,
    tg_op = 'UPDATE'
  )
  where id = new.character_id;

  return new;
end;
$$;

create or replace function private.guard_player_character_tag_update_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
begin
  if new.tags is distinct from old.tags
     and 'player-character' = any(coalesce(old.tags, '{}'::text[]))
     and pg_trigger_depth() = 1
     and auth.uid() is not null
     and not private.current_user_is_admin() then
    raise exception 'Player character tags are managed by campaign authority.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists character_sheets_sync_player_tags_v1 on public.character_sheets;
create trigger character_sheets_sync_player_tags_v1
after insert or update of sheet on public.character_sheets
for each row execute function private.sync_player_character_tags_from_sheet_v1();

drop trigger if exists characters_guard_player_tags_v1 on public.characters;
create trigger characters_guard_player_tags_v1
before update of tags on public.characters
for each row execute function private.guard_player_character_tag_update_v1();

-- Reconcile existing player characters while preserving any non-system campaign tags.
update public.characters c
set tags = private.derive_player_character_tags_v1(cs.sheet, c.tags, true)
from public.character_sheets cs
where cs.character_id = c.id
  and 'player-character' = any(coalesce(c.tags, '{}'::text[]));

revoke all on function private.player_character_tag_slug_v1(text) from public;
revoke all on function private.derive_player_character_tags_v1(jsonb, text[], boolean) from public;
revoke all on function private.sync_player_character_tags_from_sheet_v1() from public;
revoke all on function private.guard_player_character_tag_update_v1() from public;
'''
write("sql/20260804_03_character_forge_resilience_and_tags.sql", migration)

# Remove every obsolete SVG portrait file represented by the audited rows.
svg_paths = [
    "public/npc-portraits/library/enchanting/arcane-atelier-enchanter.svg",
    "public/npc-portraits/library/smithing/dwarf-forgemaster.svg",
    "public/npc-portraits/library/scribe/grayhall-archivist.svg",
    "public/npc-portraits/library/alchemy/green-apothecary.svg",
    "public/npc-portraits/library/merchants/market-factor.svg",
    "public/npc-portraits/library/monsters/orc-warlord.svg",
    "public/npc-portraits/defaults/alchemy.svg",
    "public/npc-portraits/defaults/enchanting.svg",
    "public/npc-portraits/defaults/merchant.svg",
    "public/npc-portraits/defaults/npc.svg",
    "public/npc-portraits/defaults/scribe.svg",
    "public/npc-portraits/defaults/smithing.svg",
]
for relative in svg_paths:
    target = ROOT / relative
    if target.exists():
        target.unlink()

# ---------------------------------------------------------------------------
# Regression validator and production runner coverage.
# ---------------------------------------------------------------------------
validator = r'''import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const requireToken = (text, token, label) => { if (!text.includes(token)) throw new Error(`Character Forge resilience: ${label} is missing ${token}`); };
const forbidToken = (text, token, label) => { if (text.includes(token)) throw new Error(`Character Forge resilience: ${label} still contains ${token}`); };

const forge = read("components/NewNpcModalV3Refined.js");
const adapter = read("components/NewNpcModalV3.js");
const profile = read("components/PlayerCharacterProfilePanelUnified.js");
const portraits = read("components/NpcForgePortraitPickerModal.js");
const css = read("styles/character-forge-responsive.css");
const migration = read("sql/20260804_03_character_forge_resilience_and_tags.sql");

requireToken(forge, 'mode = "npc"', "canonical Forge");
requireToken(forge, "createCharacter ? createCharacter(createPayload)", "canonical Forge");
requireToken(forge, "function handleReset()", "canonical Forge");
requireToken(forge, "function handleClose() { if (creating) return; onClose?.(); }", "canonical Forge");
forbidToken(forge, "function handleClose() { if (creating) return; resetForm();", "canonical Forge");
requireToken(forge, "Create Player Character", "canonical Forge");
requireToken(adapter, 'supabase.rpc("create_player_character_v2"', "shared player adapter");
requireToken(adapter, "profession:", "shared player adapter");
forbidToken(adapter, "supabase.rpc =", "shared player adapter");
forbidToken(adapter, "MutationObserver", "shared player adapter");
requireToken(profile, "keepCreatorMounted", "profile host");
requireToken(profile, "is-forge-suspended", "profile host");
requireToken(portraits, "/\\.svg(?:$|[?#])/i", "portrait picker");
requireToken(css, "Character Forge PR A: content-driven player layouts", "responsive stylesheet");
requireToken(css, "npc-forge-step-0", "responsive stylesheet");
requireToken(css, "npc-forge-step-3", "responsive stylesheet");
requireToken(css, "npc-forge-step-7", "responsive stylesheet");
requireToken(migration, "npc_portrait_library_no_svg_v1", "migration");
requireToken(migration, "derive_player_character_tags_v1", "migration");
requireToken(migration, "guard_player_character_tag_update_v1", "migration");

const deletedSvgPaths = [
  "public/npc-portraits/library/enchanting/arcane-atelier-enchanter.svg",
  "public/npc-portraits/library/smithing/dwarf-forgemaster.svg",
  "public/npc-portraits/library/scribe/grayhall-archivist.svg",
  "public/npc-portraits/library/alchemy/green-apothecary.svg",
  "public/npc-portraits/library/merchants/market-factor.svg",
  "public/npc-portraits/library/monsters/orc-warlord.svg",
  "public/npc-portraits/defaults/alchemy.svg",
  "public/npc-portraits/defaults/enchanting.svg",
  "public/npc-portraits/defaults/merchant.svg",
  "public/npc-portraits/defaults/npc.svg",
  "public/npc-portraits/defaults/scribe.svg",
  "public/npc-portraits/defaults/smithing.svg",
];
for (const rel of deletedSvgPaths) {
  if (fs.existsSync(path.join(root, rel))) throw new Error(`Character Forge resilience: obsolete SVG portrait still exists: ${rel}`);
}

console.log("Character Forge resilience, player authority, layout, and SVG cleanup markers validated.");
'''
write("scripts/validate_character_forge_resilience.mjs", validator)
replace_once(
    "scripts/vercel_build_v2.mjs",
    '  ["node", ["scripts/validate_unified_character_forge.mjs"]],',
    '  ["node", ["scripts/validate_unified_character_forge.mjs"]],\n  ["node", ["scripts/validate_character_forge_resilience.mjs"]],',
)

# Workflow coverage for future edits.
replace_once(
    ".github/workflows/validate-npc-forge.yml",
    '      - "scripts/validate_unified_character_forge.mjs"',
    '      - "scripts/validate_unified_character_forge.mjs"\n      - "scripts/validate_character_forge_resilience.mjs"',
)
replace_once(
    ".github/workflows/validate-npc-forge.yml",
    '      - "sql/20260804_02_player_forge_progression_upsert.sql"',
    '      - "sql/20260804_02_player_forge_progression_upsert.sql"\n      - "sql/20260804_03_character_forge_resilience_and_tags.sql"\n      - "public/npc-portraits/defaults/**"\n      - "public/npc-portraits/library/**"',
)
replace_once(
    ".github/workflows/validate-npc-forge.yml",
    '          node --check scripts/validate_unified_character_forge.mjs',
    '          node --check scripts/validate_unified_character_forge.mjs\n          node --check scripts/validate_character_forge_resilience.mjs',
)

# Runner alignment docs require every active validator to be named in both files.
append_once(
    "docs/Source_Patch_Pipeline_Audit.md",
    "scripts/validate_character_forge_resilience.mjs",
    "- `scripts/validate_character_forge_resilience.mjs` — protects non-destructive Forge close/reset behavior, explicit player submission, content-driven layouts, server-authoritative player tags, and complete SVG portrait removal.",
)
append_once(
    "docs/Town_Crafter_Current_Status.md",
    "scripts/validate_character_forge_resilience.mjs",
    "- `scripts/validate_character_forge_resilience.mjs` — Character Forge resilience and player-authority guard; it does not alter town/city-map or world-map behavior.",
)
append_once(
    "docs/Unified_Character_Forge_Status.md",
    "## PR A — resilience and player presentation",
    '''## PR A — resilience and player presentation

- Closing the Forge preserves the mounted in-memory draft; a hard refresh or auth reset clears it.
- Reset is explicit, confirmed, and creates a fresh Forge request state.
- Player creation uses an explicit submit callback instead of replacing the shared Supabase client RPC method.
- Player tabs use content-driven proportions; Identity, Story, and Review become full-width.
- Player-facing tag and placement controls are hidden. Class, species, background, and trained-profession tags are derived by database authority.
- All obsolete SVG portrait records and repository files are deleted and blocked from reintroduction.
- Future player-assigned minions remain NPCs and should use a dedicated controller/assignment relationship rather than the `player-character` tag.''',
)
append_once(
    "docs/DNDNext_Current_Handoff_Prompt.md",
    "Character Forge PR A authority",
    '''### Character Forge PR A authority

The shared Forge now preserves accidental-close progress in mounted memory, exposes a confirmed Reset action, renders player mode explicitly, and uses content-driven tab layouts. Player tags are not self-assigned: the database derives `player-character`, species, class, background, and trained-profession tags while preserving later GM campaign tags. SVG portraits were deleted and are prohibited. Future minions assigned to players remain NPCs linked through a dedicated assignment model; do not convert them into player characters.''',
)

print("Character Forge PR A patch applied successfully.")
