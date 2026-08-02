from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one exact anchor, found {count}: {old[:120]!r}")
    write(path, content.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str) -> None:
    content = read(path)
    updated, count = re.subn(pattern, replacement, content, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{path}: expected one regex anchor, found {count}: {pattern[:120]!r}")
    write(path, updated)


ROLL_COMPONENT = r'''function safeText(value) {
  return String(value ?? "").trim();
}

export function formatCharacterSheetRoll(roll) {
  if (!roll) return "";
  if (roll.summary && !Number.isFinite(Number(roll.total))) return String(roll.summary);

  const modifier = Number(roll.mod || 0);
  const modifierText = modifier >= 0 ? `+ ${modifier}` : `- ${Math.abs(modifier)}`;
  const mode = roll.mode && roll.mode !== "normal" ? String(roll.mode).toLowerCase() : "normal";
  const rolls = Array.isArray(roll.rolls) ? roll.rolls.map(Number).filter(Number.isFinite) : [];

  if (rolls.length >= 2 && mode !== "normal") {
    return `${roll.label || "Roll"}: d20 ${mode === "adv" ? "(Advantage)" : "(Disadvantage)"} [${rolls.join(", ")}] → ${roll.roll} ${modifierText} = ${roll.total}`;
  }

  if (Number.isFinite(Number(roll.roll)) && Number.isFinite(Number(roll.total))) {
    return `${roll.label || "Roll"}: d20 ${roll.roll} ${modifierText} = ${roll.total}`;
  }

  return safeText(roll.summary || roll.label || "Roll resolved.");
}

export function formatCharacterSheetDamage(roll) {
  const damage = roll?.damage;
  if (!damage || !Number.isFinite(Number(damage.total))) return "";

  const rolls = Array.isArray(damage.rolls) && damage.rolls.length ? ` [${damage.rolls.join(", ")}]` : "";
  const modifier = Number(damage.modifier || 0);
  const modifierText = modifier ? ` ${modifier > 0 ? "+" : "-"} ${Math.abs(modifier)}` : "";
  const dice = Number(damage.diceCount) > 0 && Number(damage.dieSize) > 0
    ? `${damage.diceCount}d${damage.dieSize}`
    : safeText(damage.formula) || "Damage";
  const type = safeText(damage.type);
  return `${dice}${rolls}${modifierText} = ${damage.total}${type ? ` ${type}` : ""}`;
}

export default function CharacterSheetRollResult({ roll, className = "", label = "Last roll" }) {
  if (!roll) return null;
  const damageText = formatCharacterSheetDamage(roll);

  return (
    <div className={`sheet-last-roll ${damageText ? "has-damage" : ""} ${className}`.trim()} role="status" aria-live="polite">
      <div className="sheet-last-roll__attack">
        <strong>{label}:</strong> {formatCharacterSheetRoll(roll)}
      </div>
      {damageText ? (
        <div className="sheet-last-roll__damage">
          <strong>Damage:</strong> {damageText}
        </div>
      ) : null}
    </div>
  );
}
'''

ACTION_HOOK = r'''import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { buildCharacterSheetFeatures } from "../utils/characterSheetFeatures";

function safeText(value) {
  return String(value ?? "").trim();
}

function classKeyFromSheet(sheet = {}) {
  return safeText(sheet?.classKey || sheet?.meta?.classKey || sheet?.className || sheet?.class)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sheetFeatureSignature(sheet = {}) {
  return JSON.stringify({
    classKey: sheet?.classKey || sheet?.meta?.classKey || sheet?.className || sheet?.class || "",
    classSource: sheet?.classSource || sheet?.meta?.classSource || sheet?.rulesetSource || sheet?.meta?.rulesetSource || "",
    level: sheet?.level || sheet?.meta?.level || 1,
    subclass: sheet?.subclass || sheet?.meta?.subclass || "",
    subclassSource: sheet?.subclassSource || sheet?.meta?.subclassSource || "",
    species: sheet?.species || sheet?.race || sheet?.meta?.species || "",
    feats: sheet?.feats || [],
    speciesTraits: sheet?.speciesTraits || [],
    classFeatures: sheet?.classFeatures || [],
    featsTraits: sheet?.featsTraits || "",
  });
}

const emptySnapshot = (characterId = "", loading = false) => ({
  characterId,
  inventoryRows: [],
  spellActions: [],
  featureRows: [],
  loading,
  error: "",
});

export default function useNpcSheetActionData({
  characterId,
  sheet,
  enabled = false,
  canCommand = false,
  onSheetUpdated,
  onResult,
}) {
  const id = safeText(characterId);
  const requestRef = useRef(0);
  const activeIdRef = useRef("");
  const [snapshot, setSnapshot] = useState(() => emptySnapshot());
  const [busyKey, setBusyKey] = useState("");
  const featureSignature = useMemo(() => sheetFeatureSignature(sheet || {}), [sheet]);

  useEffect(() => {
    const requestId = ++requestRef.current;
    activeIdRef.current = id;
    setBusyKey("");

    if (!id || !enabled) {
      setSnapshot(emptySnapshot(id, false));
      return undefined;
    }

    let cancelled = false;
    const isCurrent = () => !cancelled && activeIdRef.current === id && requestRef.current === requestId;
    setSnapshot(emptySnapshot(id, true));

    async function run() {
      const inventoryResult = await supabase.rpc("get_character_inventory_v1", { p_character_id: id });
      if (!isCurrent()) return;
      const inventoryRows = inventoryResult.error ? [] : inventoryResult.data || [];

      const assignmentResult = await supabase
        .from("character_spells")
        .select("id,spell_id,prepared,always_available,casting_stat,save_dc_override,attack_bonus_override,uses_max,uses_remaining,recharge")
        .eq("character_id", id);
      if (!isCurrent()) return;

      let spellActions = [];
      if (!assignmentResult.error && assignmentResult.data?.length) {
        const spellIds = [...new Set(assignmentResult.data.map((row) => row.spell_id).filter(Boolean))];
        const catalogResult = await supabase
          .from("spells_catalog")
          .select("id,name,level,attack_type,saving_throw_abilities,damage_dice,damage_types,healing_dice,casting_time,range_text,duration_text,description")
          .in("id", spellIds);
        if (!isCurrent()) return;
        if (!catalogResult.error) {
          const catalogById = new Map((catalogResult.data || []).map((row) => [String(row.id), row]));
          spellActions = assignmentResult.data
            .map((row) => ({ ...row, spell: catalogById.get(String(row.spell_id)) || null }))
            .filter((row) => row.spell);
        }
      }

      const currentSheet = sheet || {};
      const classKey = classKeyFromSheet(currentSheet);
      const speciesName = safeText(currentSheet?.species || currentSheet?.race || currentSheet?.meta?.species);
      const classFeaturePromise = classKey
        ? supabase
          .from("class_feature_catalog")
          .select("id,feature_key,feature_type,name,source,class_key,class_name,class_source,subclass_name,subclass_short_name,level,description,raw_payload")
          .eq("class_key", classKey)
          .order("level", { ascending: true })
          .order("name", { ascending: true })
          .limit(5000)
        : Promise.resolve({ data: [], error: null });
      const speciesPromise = speciesName
        ? supabase
          .from("character_option_catalog_preferred")
          .select("id,option_key,option_type,name,source,description,metadata,raw_payload")
          .eq("option_type", "species")
          .ilike("name", speciesName)
          .limit(1)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [grantResult, progressionResult, classFeatureResult, speciesResult] = await Promise.all([
        supabase.rpc("get_character_option_grants_v1", { p_character_id: id }),
        supabase.rpc("get_character_progression_v1", { p_character_id: id }),
        classFeaturePromise,
        speciesPromise,
      ]);
      if (!isCurrent()) return;

      const featureRows = buildCharacterSheetFeatures({
        sheet: currentSheet,
        grantedOptions: grantResult.error ? [] : grantResult.data || [],
        progression: progressionResult.error ? null : progressionResult.data?.progression || null,
        classRow: progressionResult.error ? null : progressionResult.data?.class || null,
        classFeatureRows: classFeatureResult.error ? [] : classFeatureResult.data || [],
        speciesOption: speciesResult.error ? null : speciesResult.data || null,
      });

      setSnapshot({
        characterId: id,
        inventoryRows,
        spellActions,
        featureRows,
        loading: false,
        error: inventoryResult.error?.message || assignmentResult.error?.message || "",
      });
    }

    void run().catch((error) => {
      if (!isCurrent()) return;
      console.warn("NPC sheet action data could not be loaded", error);
      setSnapshot({ ...emptySnapshot(id, false), error: error?.message || "Could not load sheet actions." });
    });

    return () => {
      cancelled = true;
    };
    // The signature intentionally excludes transient actionState changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, featureSignature, id]);

  const handleActionCommand = useCallback(async (action, operation) => {
    const activeId = safeText(characterId);
    if (!activeId || !canCommand || action?.kind !== "feature-toggle" || !action?.actionKey) return;

    const requestId = requestRef.current;
    setBusyKey(action.id);
    const { data, error } = await supabase.rpc("update_character_sheet_action_state_v1", {
      p_character_id: activeId,
      p_action_key: action.actionKey,
      p_operation: operation,
    });

    if (activeIdRef.current !== activeId || requestRef.current !== requestId) return;

    if (error) {
      onResult?.({
        label: action.label,
        summary: `${action.label}: ${error.message || "Could not update this feature."}`,
      });
      setBusyKey("");
      return;
    }

    if (data?.sheet) onSheetUpdated?.(data.sheet);
    const remaining = Number(data?.usesRemaining ?? data?.uses_remaining);
    const maximum = Number(data?.usesMax ?? data?.uses_max);
    const active = Boolean(data?.active);
    const stateText = operation === "reset" ? "uses reset" : active ? "active" : "ended";
    onResult?.({
      label: action.label,
      summary: `${action.label}: ${stateText}${Number.isFinite(remaining) && Number.isFinite(maximum) ? ` • ${remaining}/${maximum} uses remaining` : ""}`,
    });
    setBusyKey("");
  }, [canCommand, characterId, onResult, onSheetUpdated]);

  const current = snapshot.characterId === id;
  return {
    inventoryRows: current ? snapshot.inventoryRows : [],
    spellActions: current ? snapshot.spellActions : [],
    featureRows: current ? snapshot.featureRows : [],
    loading: Boolean(id && enabled && (!current || snapshot.loading)),
    error: current ? snapshot.error : "",
    busyKey,
    canCommand,
    handleActionCommand,
  };
}
'''

VALIDATOR = r'''import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const page = read("pages/npcs.js");
const panel = read("components/NpcPanel.js");
const sheet = read("components/CharacterSheet5e.js");
const hook = read("hooks/useNpcSheetActionData.js");
const roll = read("components/CharacterSheetRollResult.js");
const css = read("styles/character-sheet-actions.css");
const runner = read("scripts/vercel_build_v2.mjs");

assert(page.includes('useNpcSheetActionData'), "NPC page must use the guarded supplemental action-data hook");
for (const prop of ["inventoryItems={npcSheetActions.inventoryRows}", "spellActions={npcSheetActions.spellActions}", "featureRows={npcSheetActions.featureRows}", "actionsLoading={npcSheetActions.loading}", "onActionCommand={npcSheetActions.canCommand ? npcSheetActions.handleActionCommand : null}", "actionBusyKey={npcSheetActions.busyKey}"]) {
  assert(page.includes(prop), `NPC page is missing CharacterSheetPanel action prop: ${prop}`);
}
assert(page.includes('<CharacterSheetRollResult roll={lastRoll}'), "NPC page must use the shared roll-result presentation");
assert(panel.includes('<CharacterSheetRollResult roll={lastRoll}'), "NPC profile panel must use the shared roll-result presentation");
assert(roll.includes("formatCharacterSheetDamage") && roll.includes("sheet-last-roll__damage"), "Shared roll result must render damage");
assert(hook.includes("requestRef.current === requestId") && hook.includes("activeIdRef.current === id"), "Action hook must guard by request id and character identity");
assert(hook.includes('get_character_inventory_v1') && hook.includes('character_spells') && hook.includes('buildCharacterSheetFeatures'), "Action hook must load inventory, spells, and resolved features");
assert(hook.includes('update_character_sheet_action_state_v1'), "Action hook must use the guarded standalone feature RPC");
assert(sheet.includes("function CollapsibleActionGroup") && sheet.includes('<CollapsibleActionGroup key={group} title={group}>'), "Action subsections must be independently collapsible");
assert(css.includes(".csheet-action-group__body") && css.includes(".csheet-action-group__chevron"), "Action subsection styles are missing");
assert(runner.includes('validate_npc_sheet_action_parity.mjs'), "Production build runner must include the NPC action parity validator");
assert(!page.includes("MapPageClient"), "NPC parity patch must not introduce world-map code");

console.log("NPC sheet action parity validation passed.");
'''

COLLAPSIBLE_GROUP = r'''
function CollapsibleActionGroup({ title, children }) {
  const [expanded, setExpanded] = useState(true);
  const bodyId = useId();

  return (
    <div className={`csheet-action-group ${expanded ? "" : "is-collapsed"}`.trim()}>
      <button
        type="button"
        className="csheet-action-group__label"
        aria-controls={bodyId}
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        title={`${expanded ? "Collapse" : "Expand"} ${title}`}
      >
        <span>{title}</span>
        <span className="csheet-action-group__chevron" aria-hidden="true" />
      </button>
      <div id={bodyId} className="csheet-action-group__body" hidden={!expanded}>
        {children}
      </div>
    </div>
  );
}
'''

write("components/CharacterSheetRollResult.js", ROLL_COMPONENT)
write("hooks/useNpcSheetActionData.js", ACTION_HOOK)
write("scripts/validate_npc_sheet_action_parity.mjs", VALIDATOR)

replace_once(
    "pages/npcs.js",
    'import CharacterSheetPanel from "../components/CharacterSheetPanel";\n',
    'import CharacterSheetPanel from "../components/CharacterSheetPanel";\nimport CharacterSheetRollResult from "../components/CharacterSheetRollResult";\nimport useNpcSheetActionData from "../hooks/useNpcSheetActionData";\n',
)

replace_once(
    "pages/npcs.js",
    '  const effectsKey = useMemo(() => {\n    return `${selectedKey || ""}|${hashEquippedRowsForKey(equippedRows)}`;\n  }, [selectedKey, equippedRows]);\n\n',
    '  const effectsKey = useMemo(() => {\n    return `${selectedKey || ""}|${hashEquippedRowsForKey(equippedRows)}`;\n  }, [selectedKey, equippedRows]);\n\n  const npcSheetActions = useNpcSheetActionData({\n    characterId: selected?.id || "",\n    sheet,\n    enabled: !!selected?.id && (!!isAdmin || !!charPerm?.can_inventory || !!charPerm?.can_edit),\n    canCommand: !!isAdmin || !!charPerm?.can_edit,\n    onSheetUpdated: setSheet,\n    onResult: setLastRoll,\n  });\n\n',
)

regex_once(
    "pages/npcs.js",
    r'\n\s*\{lastRoll && \(\n.*?\n\s*\)\}\n\n\s*\{sheetLoading \? \(',
    '\n                    <CharacterSheetRollResult roll={lastRoll} className="mb-2" />\n\n                    {sheetLoading ? (',
)

replace_once(
    "pages/npcs.js",
    '                      effectsKey={effectsKey}\n                      onSave={async (nextSheet) => {',
    '                      effectsKey={effectsKey}\n                      inventoryItems={npcSheetActions.inventoryRows}\n                      spellActions={npcSheetActions.spellActions}\n                      featureRows={npcSheetActions.featureRows}\n                      actionsLoading={npcSheetActions.loading}\n                      onActionCommand={npcSheetActions.canCommand ? npcSheetActions.handleActionCommand : null}\n                      actionBusyKey={npcSheetActions.busyKey}\n                      onSave={async (nextSheet) => {',
)

replace_once(
    "components/NpcPanel.js",
    'import CharacterSheetPanel from "./CharacterSheetPanel";\n',
    'import CharacterSheetPanel from "./CharacterSheetPanel";\nimport CharacterSheetRollResult from "./CharacterSheetRollResult";\n',
)

regex_once(
    "components/NpcPanel.js",
    r'\n\s*\{lastRoll \? \(\n\s*<div className=\{`alert alert-dark.*?\n\s*\) : null\}\n\s*<CharacterSheetPanel',
    '\n                <CharacterSheetRollResult roll={lastRoll} className="mb-2" />\n                <CharacterSheetPanel',
)

replace_once(
    "components/CharacterSheet5e.js",
    '\n/**\n * CharacterSheet5e\n',
    f'{COLLAPSIBLE_GROUP}\n/**\n * CharacterSheet5e\n',
)

replace_once(
    "components/CharacterSheet5e.js",
    '                  <div className="csheet-action-group" key={group}>\n                    <div className="csheet-action-group__label">{group}</div>\n',
    '                  <CollapsibleActionGroup key={group} title={group}>\n',
)

replace_once(
    "components/CharacterSheet5e.js",
    '                    })}\n                  </div>\n                ))}\n',
    '                    })}\n                  </CollapsibleActionGroup>\n                ))}\n',
)

css = read("styles/character-sheet-actions.css")
css = css.replace(
'''.csheet-action-group__label {
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
''',
'''.csheet-action-group__label {
  align-items: center;
  background: transparent;
  border: 0;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  font-size: 0.62rem;
  font-weight: 800;
  justify-content: space-between;
  letter-spacing: 0.08em;
  padding: 2px 1px;
  text-align: left;
  text-transform: uppercase;
  width: 100%;
}

.csheet-action-group__label:focus-visible {
  outline: 2px solid rgba(245, 218, 132, 0.9);
  outline-offset: 2px;
}

.csheet-action-group__chevron {
  border-bottom: 1.5px solid currentColor;
  border-right: 1.5px solid currentColor;
  height: 6px;
  margin-right: 3px;
  transform: rotate(45deg) translateY(-1px);
  transition: transform 120ms ease;
  width: 6px;
}

.csheet-action-group.is-collapsed .csheet-action-group__chevron {
  transform: rotate(-45deg);
}

.csheet-action-group__body {
  display: grid;
  gap: 3px;
}
''',
1,
)
if ".csheet-action-group__body" not in css:
    raise RuntimeError("styles/character-sheet-actions.css: action-group label anchor drifted")
css = css.replace(
'''.sheet-last-roll.has-damage {
  align-items: center;
  display: grid;
''',
'''.sheet-last-roll {
  background: rgba(7, 5, 12, 0.94);
  border: 1px solid rgba(185, 133, 255, 0.52);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.94);
  line-height: 1.4;
  padding: 0.55rem 0.7rem;
}

.sheet-last-roll strong {
  color: #f5da84;
}

.sheet-last-roll.has-damage {
  align-items: center;
  display: grid;
''',
1,
)
write("styles/character-sheet-actions.css", css)

replace_once(
    "package.json",
    '    "check:player-sheet-actions": "node scripts/validate_player_sheet_actions.mjs"\n',
    '    "check:player-sheet-actions": "node scripts/validate_player_sheet_actions.mjs",\n    "check:npc-sheet-action-parity": "node scripts/validate_npc_sheet_action_parity.mjs"\n',
)

replace_once(
    "scripts/vercel_build_v2.mjs",
    '  ["node", ["scripts/validate_player_sheet_actions.mjs"]],\n',
    '  ["node", ["scripts/validate_player_sheet_actions.mjs"]],\n  ["node", ["scripts/validate_npc_sheet_action_parity.mjs"]],\n',
)

replace_once(
    "docs/NPC_Character_Sheet_Selection_Reconciliation.md",
    'Separate monotonically increasing request IDs are maintained for:\n\n- sheet reads;\n- equipped-item reads;\n- notes reads.\n',
    'Separate monotonically increasing request IDs are maintained for:\n\n- sheet reads;\n- equipped-item reads;\n- notes reads.\n\nSupplemental Sheet & Rolls action data is owned by `hooks/useNpcSheetActionData.js`. It loads full authorized inventory rows, known/prepared spell assignments, and resolved feat/species/class feature rows without taking ownership of the page\'s sheet, equipped-effect, or notes state. The hook exposes data only when its accepted character ID matches the current selection and guards every asynchronous load with both character identity and a monotonically increasing request ID.\n',
)

replace_once(
    "docs/Current_Development_Status_and_Roadmap.md",
    '- Sheet & Rolls now derives a vertical quick-action list from canonical weapons, known cantrips, and prepared spells; standalone clicks calculate or display roll math, while encounter execution remains routed through guarded tactical authority.\n',
    '- Sheet & Rolls now derives a vertical quick-action list from canonical weapons, known cantrips, prepared spells, and resolved feature rows; standalone clicks calculate or display roll math, while encounter execution remains routed through guarded tactical authority. The direct `/npcs` sheet and embedded NPC profile panel share the same action inputs and attack/damage result presentation, and each action category can be collapsed independently.\n',
)

print("NPC sheet action parity patch applied successfully.")
