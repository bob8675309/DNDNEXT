from pathlib import Path


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    source = path.read_text(encoding="utf-8")
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    path.write_text(source.replace(old, new, 1), encoding="utf-8")


actions = Path("utils/characterSheetActions.js")
replace_once(
    actions,
    '''function cleanRulesText(value) {
  return safeText(value)
    .replace(/\\{@(?:damage|dice|hit|chance)\\s+([^}|]+)(?:\\|[^}]*)?}/gi, "$1")
    .replace(/\\{@(?:spell|item|creature|condition|skill|action|sense|language|race|class|subclass|feat|filter|book|adventure|variantrule)\\s+([^}|]+)(?:\\|[^}]*)?}/gi, "$1")
    .replace(/\\{@(?:b|i|u|note|atk|h|dc)\\s+([^}]*)}/gi, "$1")
    .replace(/\\{@[a-zA-Z]+\\s+([^}]*)}/g, "$1")
    .replace(/\\s+/g, " ")
    .trim();
}''',
    '''export function cleanCharacterSheetRulesText(value) {
  return safeText(value)
    .replace(/\\{@(?:damage|dice|hit|chance)\\s+([^}|]+)(?:\\|[^}]*)?}/gi, "$1")
    .replace(/\\{@(?:spell|item|creature|condition|skill|action|sense|language|race|class|subclass|feat|filter|book|adventure|variantrule)\\s+([^}|]+)(?:\\|[^}]*)?}/gi, "$1")
    .replace(/\\{@(?:b|i|u|note|atk|h|dc)\\s+([^}]*)}/gi, "$1")
    .replace(/\\{@[a-zA-Z]+\\s+([^}]*)}/g, "$1")
    .replace(/\\|[A-Z][A-Z0-9]{1,15}\\b/g, "")
    .replace(/\\[(?:[A-Z][A-Z0-9]{1,15})\\]/g, "")
    .replace(/\\s+([,.;:!?])/g, "$1")
    .replace(/\\s+/g, " ")
    .trim();
}

export function formatSpellActionCost(value) {
  const raw = cleanCharacterSheetRulesText(value);
  const normalized = raw.toLowerCase();
  if (normalized === "action" || normalized.startsWith("1 action")) return "Action";
  if (normalized === "bonus action" || normalized === "1 bonus" || normalized.startsWith("1 bonus action")) return "Bonus Action";
  if (normalized === "reaction" || normalized.startsWith("1 reaction")) return "Reaction";
  return raw;
}''',
    "rules text sanitizer",
)
source = actions.read_text(encoding="utf-8").replace("cleanRulesText(", "cleanCharacterSheetRulesText(")
actions.write_text(source, encoding="utf-8")
replace_once(
    actions,
    '''  const recharge = safeText(row?.recharge).replace(/_/g, " ");
  const pactSlots = Number(sheet?.spellcasting?.pactSlots);''',
    '''  const recharge = safeText(row?.recharge).replace(/_/g, " ");
  const actionCost = formatSpellActionCost(spell?.casting_time);
  const pactSlots = Number(sheet?.spellcasting?.pactSlots);''',
    "spell action cost variable",
)
replace_once(
    actions,
    '''  const kind = isAttack ? "spell-attack" : saveAbilities.length ? "spell-save" : healingDice ? "spell-healing" : "spell-effect";
  const resolution = isAttack
    ? `${attackBonus >= 0 ? "+" : ""}${attackBonus} spell attack`
    : saveAbilities.length
      ? `${saveAbilities.map((value) => value.toUpperCase()).join("/")} save DC ${saveDc}`
      : healingDice
        ? `${healingDice} healing`
        : "Resolve spell effect";''',
    '''  const hasTypedDamage = Boolean(damageDice && damageTypes.length);
  const kind = isAttack ? "spell-attack" : saveAbilities.length ? "spell-save" : hasTypedDamage ? "spell-damage" : healingDice ? "spell-healing" : "spell-effect";
  const resolution = isAttack
    ? `${attackBonus >= 0 ? "+" : ""}${attackBonus} spell attack`
    : saveAbilities.length
      ? `${saveAbilities.map((value) => value.toUpperCase()).join("/")} save DC ${saveDc}`
      : hasTypedDamage
        ? `${damageDice} ${damageTypes.join("/")} damage`
        : healingDice
          ? `${healingDice} healing`
          : "Resolve spell effect";''',
    "spell damage/healing resolution",
)
replace_once(
    actions,
    '''    summary: [resolution, safeText(spell?.range_text), safeText(spell?.casting_time), resourceText].filter(Boolean).join(" • "),
    detail: [resolution, safeText(spell?.range_text), safeText(spell?.casting_time), resourceText].filter(Boolean).join(" • "),''',
    '''    summary: [resolution, safeText(spell?.range_text), actionCost, resourceText].filter(Boolean).join(" • "),
    detail: [resolution, safeText(spell?.range_text), actionCost, resourceText].filter(Boolean).join(" • "),''',
    "spell concise summary",
)
replace_once(
    actions,
    '''    details: [
      level === 0 ? "Cantrip" : `Level ${level} spell`,
      resourceText || null,
    ].filter(Boolean),''',
    '''    details: [
      level === 0 ? "Cantrip" : `Level ${level} spell`,
      actionCost ? `Cost: ${actionCost}` : null,
      resourceText || null,
    ].filter(Boolean),''',
    "spell detail cost",
)

sheet = Path("components/CharacterSheet5e.js")
replace_once(
    sheet,
    '''  onActionCommand = null,
  actionBusyKey = "",
}) {''',
    '''  onActionCommand = null,
  actionBusyKey = "",
  onPinDescription = null,
}) {''',
    "sheet pin prop",
)
replace_once(
    sheet,
    '''  function cycleActionMode(action) {
    const modes = Array.isArray(action?.modes) ? action.modes : [];''',
    '''  function toggleActionDetails(action, resolvedAction, expanded) {
    const nextExpanded = !expanded;
    setExpandedActionId(nextExpanded ? action.id : "");
    if (!nextExpanded || typeof onPinDescription !== "function") return;
    const description = safeStr(resolvedAction?.description)
      || (Array.isArray(resolvedAction?.details) ? resolvedAction.details.filter(Boolean).join(" ") : "")
      || resolvedAction?.summary
      || resolvedAction?.detail
      || "No imported description is available for this action.";
    onPinDescription({
      type: String(action?.kind || "").startsWith("spell-") ? "Spell" : (action?.group || "Action"),
      title: action?.label || "Action",
      description,
    });
  }

  function cycleActionMode(action) {
    const modes = Array.isArray(action?.modes) ? action.modes : [];''',
    "action detail pin helper",
)
replace_once(
    sheet,
    '''                                onClick={() => setExpandedActionId(expanded ? "" : action.id)}''',
    '''                                onClick={() => toggleActionDetails(action, resolvedAction, expanded)}''',
    "details button handler",
)
replace_once(
    sheet,
    '''                              {resolvedAction.description ? <p>{resolvedAction.description}</p> : null}
                              {Array.isArray(resolvedAction.details) && resolvedAction.details.length ? (''',
    '''                              {resolvedAction.description && !String(action.kind || "").startsWith("spell-") ? <p>{resolvedAction.description}</p> : null}
                              {resolvedAction.description && String(action.kind || "").startsWith("spell-") ? <p>Full spell description pinned in Description.</p> : null}
                              {Array.isArray(resolvedAction.details) && resolvedAction.details.length ? (''',
    "spell inline detail replacement",
)

panel = Path("components/CharacterSheetPanel.js")
replace_once(
    panel,
    '''  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");''',
    '''  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [pinnedInfo, setPinnedInfo] = useState(null);''',
    "panel pinned state",
)
replace_once(
    panel,
    '''    setSaveErr("");
    setSaving(false);''',
    '''    setSaveErr("");
    setSaving(false);
    setPinnedInfo(null);''',
    "panel pin reset",
)
replace_once(
    panel,
    '''        onActionCommand={onActionCommand}
        actionBusyKey={actionBusyKey}
      />
      <CharacterSheetEnhancements rootRef={sheetRootRef} sheet={draft || {}} featureRows={featureRows || []} onSheetUpdated={(nextSheet) => nextSheet ? setDraft(deepClone(nextSheet)) : null} />''',
    '''        onActionCommand={onActionCommand}
        actionBusyKey={actionBusyKey}
        onPinDescription={setPinnedInfo}
      />
      <CharacterSheetEnhancements
        rootRef={sheetRootRef}
        sheet={draft || {}}
        featureRows={featureRows || []}
        pinnedInfo={pinnedInfo}
        onPinnedInfoChange={setPinnedInfo}
        onSheetUpdated={(nextSheet) => nextSheet ? setDraft(deepClone(nextSheet)) : null}
      />''',
    "panel pin bridge",
)

enhancements = Path("components/CharacterSheetEnhancements.js")
replace_once(
    enhancements,
    'import { supabase } from "../utils/supabaseClient";',
    'import { supabase } from "../utils/supabaseClient";\nimport { cleanCharacterSheetRulesText } from "../utils/characterSheetActions";',
    "enhancement sanitizer import",
)
replace_once(
    enhancements,
    '''export default function CharacterSheetEnhancements({ rootRef, sheet = {}, featureRows = [], onSheetUpdated = null }) {''',
    '''export default function CharacterSheetEnhancements({
  rootRef,
  sheet = {},
  featureRows = [],
  onSheetUpdated = null,
  pinnedInfo: controlledPinnedInfo,
  onPinnedInfoChange = null,
}) {''',
    "enhancement props",
)
replace_once(
    enhancements,
    '''  const [traitTarget, setTraitTarget] = useState(null);
  const [descriptionTarget, setDescriptionTarget] = useState(null);
  const [pinnedInfo, setPinnedInfo] = useState(null);
  const [hpOpen, setHpOpen] = useState(false);''',
    '''  const [traitTarget, setTraitTarget] = useState(null);
  const [descriptionTarget, setDescriptionTarget] = useState(null);
  const [internalPinnedInfo, setInternalPinnedInfo] = useState(null);
  const [hpOpen, setHpOpen] = useState(false);
  const pinnedInfo = controlledPinnedInfo === undefined ? internalPinnedInfo : controlledPinnedInfo;
  const pinInfo = useCallback((next) => {
    if (typeof onPinnedInfoChange === "function") onPinnedInfoChange(next);
    else setInternalPinnedInfo(next);
  }, [onPinnedInfoChange]);''',
    "enhancement controlled pin state",
)
source = enhancements.read_text(encoding="utf-8")
source = source.replace("setPinnedInfo(", "pinInfo(")
source = source.replace("safeText(row.description)", "cleanCharacterSheetRulesText(row.description)")
source = source.replace("safeText(species?.description)", "cleanCharacterSheetRulesText(species?.description)")
source = source.replace("safeText(row?.description)\n          ||", "cleanCharacterSheetRulesText(row?.description)\n          ||")
enhancements.write_text(source, encoding="utf-8")
replace_once(
    enhancements,
    '''  }, [canManageCharacter, descriptions, rootRef]);''',
    '''  }, [canManageCharacter, descriptions, pinInfo, rootRef]);''',
    "enhancement callback dependency",
)

validator = Path("scripts/validate_player_sheet_actions.mjs")
replace_once(
    validator,
    '''  buildCharacterSheetActions,
  formatInventoryEquipmentText,
  resolveCharacterSheetActionMode,
  rollCharacterSheetDamage,
} from "../utils/characterSheetActions.js";''',
    '''  buildCharacterSheetActions,
  cleanCharacterSheetRulesText,
  formatInventoryEquipmentText,
  formatSpellActionCost,
  resolveCharacterSheetActionMode,
  rollCharacterSheetDamage,
} from "../utils/characterSheetActions.js";''',
    "validator imports",
)
replace_once(
    validator,
    '''expectEqual(rollCharacterSheetDamage("not dice"), null, "damage roller rejects unsupported formulas");''',
    '''expectEqual(rollCharacterSheetDamage("not dice"), null, "damage roller rejects unsupported formulas");
expectEqual(cleanCharacterSheetRulesText("Hit Points|XPHB and {@spell healing word|XPHB}"), "Hit Points and healing word", "rules text sanitizer removes residual source payloads");
expectEqual(formatSpellActionCost("1 action"), "Action", "spell cost normalizes actions");
expectEqual(formatSpellActionCost("1 bonus"), "Bonus Action", "spell cost normalizes bonus actions");
expectEqual(formatSpellActionCost("1 reaction, which you take when hit"), "Reaction", "spell cost normalizes reactions");''',
    "validator sanitizer assertions",
)
replace_once(
    validator,
    '''      spell: { id: "witch-bolt", name: "Witch Bolt", level: 1, attack_type: "ranged", damage_dice: "2d12", damage_types: ["lightning"], range_text: "60 ft." },''',
    '''      spell: { id: "witch-bolt", name: "Witch Bolt", level: 1, attack_type: "ranged", damage_dice: "2d12", damage_types: ["lightning"], range_text: "60 ft.", casting_time: "1 action", description: "Deal damage to Hit Points|XPHB." },''',
    "validator spell fixture",
)
replace_once(
    validator,
    '''expect(witchBolt?.detail.includes("2 level-3 pact slots"), "prepared pact spell shows slot availability");''',
    '''expect(witchBolt?.detail.includes("2 level-3 pact slots"), "prepared pact spell shows slot availability");
expect(witchBolt?.detail.includes("Action"), "prepared spell concise detail shows normalized action cost");
expectEqual(witchBolt?.description, "Deal damage to Hit Points.", "prepared spell description removes source payloads");''',
    "validator spell expectations",
)
replace_once(
    validator,
    '''const enhancementSource = fs.readFileSync(path.join(root, "components/CharacterSheetEnhancements.js"), "utf8");''',
    '''const enhancementSource = fs.readFileSync(path.join(root, "components/CharacterSheetEnhancements.js"), "utf8");
const panelSource = fs.readFileSync(path.join(root, "components/CharacterSheetPanel.js"), "utf8");''',
    "validator panel source",
)
source = validator.read_text(encoding="utf-8")
anchor = 'expect(sheetSource.includes("function CollapsibleActionGroup")'
index = source.find(anchor)
if index < 0:
    raise RuntimeError("validator action group anchor missing")
insertion = '''expect(sheetSource.includes("onPinDescription") && sheetSource.includes("toggleActionDetails"), "Details must pin the selected action into the Description panel");
expect(sheetSource.includes("Full spell description pinned in Description."), "spell details must not duplicate the full description inline");
expect(panelSource.includes("pinnedInfo={pinnedInfo}") && panelSource.includes("onPinDescription={setPinnedInfo}"), "CharacterSheetPanel must bridge action Details to the pinned description");
expect(enhancementSource.includes("cleanCharacterSheetRulesText") && enhancementSource.includes("onPinnedInfoChange"), "enhancements must sanitize imported descriptions and accept the shared pinned state");
'''
validator.write_text(source[:index] + insertion + source[index:], encoding="utf-8")

docs = Path("docs/Deferred_UI_Polish_Backlog.md")
replace_once(
    docs,
    '- Live spell descriptions contain no literal bracketed source marker such as `[XPHB]`; 75 class-feature catalog rows still lack descriptions and remain content-repair debt rather than a sheet-layout defect.',
    '- Sheet spell and feature descriptions strip residual source payloads such as `|XPHB` and bracketed source markers at render time.\n- Spell quick-action summaries show normalized Action, Bonus Action, or Reaction costs; Details pins the full spell text in the existing Description panel instead of duplicating it inline.\n- Seventy-five class-feature catalog rows still lack descriptions and remain content-repair debt rather than a sheet-layout defect.',
    "documentation status",
)

print("Spell detail patch applied.")
