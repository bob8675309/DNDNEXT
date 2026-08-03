import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ABILITY_KEYS, ABILITY_LABELS } from "../utils/characterCreation";
import { ABILITY_DESCRIPTIONS, FALLBACK_SKILL_DESCRIPTIONS } from "../utils/characterCreationGuidance";
import { useCharacterInteractionContext } from "./character/CharacterInteractionContext";
import CharacterSheetResourceTracker from "./CharacterSheetResourceTracker";
import { supabase } from "../utils/supabaseClient";

function safeText(value) {
  return String(value ?? "").trim();
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeName(value) {
  return safeText(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function sheetClassKey(sheet = {}) {
  return safeText(sheet.classKey || sheet.meta?.classKey || sheet.className || sheet.class).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function sheetClassSource(sheet = {}) {
  return safeText(sheet.rulesetSource || sheet.meta?.rulesetSource || "XPHB") || "XPHB";
}

function sheetCharacterId(sheet = {}, contextCharacterId = "") {
  return safeText(contextCharacterId || sheet.characterId || sheet.meta?.characterId);
}

function rechargeInline(value) {
  return safeText(value).toLowerCase().replace(/[_-]+/g, " ");
}

function lineInfo(line, descriptions, speciesDescription) {
  const raw = safeText(line);
  const separator = raw.indexOf(":");
  const category = separator >= 0 ? safeText(raw.slice(0, separator)) : "Trait";
  const name = separator >= 0 ? safeText(raw.slice(separator + 1)) : raw;
  const direct = descriptions.get(normalizeName(name));
  const description = direct
    || (/^species$/i.test(category) ? speciesDescription : "")
    || "No imported description is available for this entry yet.";
  return { raw, category, name: name || raw, description };
}

function sectionByTitle(root, title) {
  return [...root.querySelectorAll(".csheet-section")].find(
    (section) => safeText(section.querySelector(".csheet-section-title")?.textContent) === title
  ) || null;
}

function ensureResourceTarget(root) {
  const section = sectionByTitle(root, "Attacks & Spellcasting");
  const body = section?.querySelector(".csheet-section-body");
  if (!body) return null;
  let target = body.querySelector(":scope > .csheet-resource-tracker-slot");
  if (!target) {
    target = document.createElement("div");
    target.className = "csheet-resource-tracker-slot";
    body.prepend(target);
  }
  return target;
}

function updateSpellResourceSummaries(root, profile) {
  if (!root || !profile) return;
  const slots = Array.isArray(profile.slots) ? profile.slots : [];
  const limitedUses = Array.isArray(profile.limitedSpellUses) ? profile.limitedSpellUses : [];
  const pactSlot = slots.find((slot) => safeText(slot?.poolKey) === "pact_magic") || null;
  const standardSlots = new Map(
    slots
      .filter((slot) => safeText(slot?.poolKey) === "spellcasting")
      .map((slot) => [safeNumber(slot?.slotLevel), slot])
  );
  const limitedByName = new Map(limitedUses.map((entry) => [normalizeName(entry?.name), entry]));

  for (const group of root.querySelectorAll(".csheet-action-group")) {
    const groupName = safeText(group.querySelector(".csheet-action-group__label span")?.textContent).toLowerCase();
    if (groupName !== "cantrips" && groupName !== "prepared spells") continue;

    for (const item of group.querySelectorAll(".csheet-action-item")) {
      const name = safeText(item.querySelector(".csheet-action-button__name")?.textContent);
      const detail = item.querySelector(".csheet-action-button__detail");
      if (!detail) continue;
      let text = safeText(detail.textContent);
      const limited = limitedByName.get(normalizeName(name));

      if (limited) {
        const maximum = safeNumber(limited.max);
        const remaining = safeNumber(limited.remaining, maximum);
        const recharge = rechargeInline(limited.recharge);
        const replacement = `${remaining}/${maximum} uses${recharge ? ` • ${recharge}` : ""}`;
        const next = text.replace(/\b\d+\/\d+\s+uses(?:\s*•\s*(?:short|long)\s+rest)?/i, replacement);
        if (next !== text) text = next;
      } else if (pactSlot && groupName === "prepared spells") {
        const maximum = safeNumber(pactSlot.max);
        const remaining = safeNumber(pactSlot.remaining, maximum);
        const level = safeNumber(pactSlot.slotLevel);
        const replacement = `${remaining}/${maximum} level-${level} pact slots`;
        const next = text.replace(/\b\d+(?:\/\d+)?\s+level-\d+\s+pact slots\b/i, replacement);
        if (next !== text) text = next;
      } else if (groupName === "prepared spells") {
        const tagText = safeText(item.querySelector(".csheet-action-button__tag")?.textContent);
        const levelMatch = tagText.match(/level\s+(\d+)/i);
        const spellLevel = levelMatch ? Number(levelMatch[1]) : 0;
        const slot = standardSlots.get(spellLevel);
        if (slot) {
          const maximum = safeNumber(slot.max);
          const remaining = safeNumber(slot.remaining, maximum);
          const replacement = `${remaining}/${maximum} level-${spellLevel} slots`;
          const slotPattern = /\b\d+(?:\/\d+)?\s+level-\d+\s+slots\b/i;
          text = slotPattern.test(text) ? text.replace(slotPattern, replacement) : `${text} • ${replacement}`;
        }
      }

      if (text !== detail.textContent) detail.textContent = text;
    }
  }
}

function HpAdjuster({ characterId, sheet, onUpdated, onClose }) {
  const [amount, setAmount] = useState("");
  const [tempHp, setTempHp] = useState(String(Math.max(0, Number(sheet?.tempHp || 0))));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function apply(kind) {
    const numeric = Math.abs(Number(amount || 0));
    if (!Number.isInteger(numeric) || numeric < 1) {
      setError("Enter a whole-number amount greater than zero.");
      return;
    }
    setBusy(true);
    setError("");
    const signed = kind === "damage" ? -numeric : numeric;
    const { data, error: rpcError } = await supabase.rpc("adjust_character_hit_points_v1", {
      p_character_id: characterId,
      p_amount: signed,
      p_temp_hp: null,
    });
    if (rpcError) setError(rpcError.message || "Could not update hit points.");
    else {
      onUpdated?.(data?.sheet || null);
      setAmount("");
    }
    setBusy(false);
  }

  async function applyTempHp() {
    const numeric = Number(tempHp || 0);
    if (!Number.isInteger(numeric) || numeric < 0) {
      setError("Temporary hit points must be a whole number of zero or greater.");
      return;
    }
    setBusy(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("adjust_character_hit_points_v1", {
      p_character_id: characterId,
      p_amount: 0,
      p_temp_hp: numeric,
    });
    if (rpcError) setError(rpcError.message || "Could not update temporary hit points.");
    else onUpdated?.(data?.sheet || null);
    setBusy(false);
  }

  return (
    <div className="sheet-hp-popover" role="dialog" aria-label="Adjust hit points">
      <div className="sheet-hp-popover__head">
        <div>
          <strong>Hit Points</strong>
          <small>{Number(sheet?.hp || 0)} current / {Number(sheet?.maxHp || 0)} maximum / {Number(sheet?.tempHp || 0)} temporary</small>
        </div>
        <button type="button" onClick={onClose} aria-label="Close hit point controls">×</button>
      </div>
      {error ? <div className="sheet-hp-popover__error">{error}</div> : null}
      <label>
        <span>Damage or healing amount</span>
        <input type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} autoFocus />
      </label>
      <div className="sheet-hp-popover__actions">
        <button type="button" className="is-damage" disabled={busy} onClick={() => apply("damage")}>Take Damage</button>
        <button type="button" className="is-heal" disabled={busy} onClick={() => apply("heal")}>Recover HP</button>
      </div>
      <label>
        <span>Set temporary HP</span>
        <div className="sheet-hp-popover__temp">
          <input type="number" min="0" step="1" value={tempHp} onChange={(event) => setTempHp(event.target.value)} />
          <button type="button" disabled={busy} onClick={applyTempHp}>Set</button>
        </div>
      </label>
      <small className="sheet-hp-popover__note">Damage consumes temporary HP before current HP. Healing cannot exceed maximum HP.</small>
    </div>
  );
}

export default function CharacterSheetEnhancements({ rootRef, sheet = {}, featureRows = [], onSheetUpdated = null }) {
  const { characterId: contextCharacterId, canManageCharacter } = useCharacterInteractionContext();
  const [descriptions, setDescriptions] = useState(new Map());
  const [speciesDescription, setSpeciesDescription] = useState("");
  const [traitTarget, setTraitTarget] = useState(null);
  const [descriptionTarget, setDescriptionTarget] = useState(null);
  const [resourceTarget, setResourceTarget] = useState(null);
  const [resourceProfile, setResourceProfile] = useState(null);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceError, setResourceError] = useState("");
  const [resourceBusyKey, setResourceBusyKey] = useState("");
  const [resourceAccessible, setResourceAccessible] = useState(null);
  const [pinnedInfo, setPinnedInfo] = useState(null);
  const [hpOpen, setHpOpen] = useState(false);

  const classKey = sheetClassKey(sheet);
  const classSource = sheetClassSource(sheet);
  const speciesName = safeText(sheet.species || sheet.race || sheet.meta?.species);
  const resolvedCharacterId = sheetCharacterId(sheet, contextCharacterId);

  useEffect(() => {
    let active = true;
    async function loadDescriptions() {
      const optionPromise = supabase
        .from("character_option_catalog_preferred")
        .select("option_type,name,description,metadata")
        .in("option_type", ["skill", "feat", "species"])
        .limit(3000);
      const featurePromise = classKey
        ? supabase
          .from("class_feature_catalog")
          .select("name,description,class_key,class_source")
          .eq("class_key", classKey)
          .eq("class_source", classSource)
          .limit(1000)
        : Promise.resolve({ data: [], error: null });
      const [optionResult, featureResult] = await Promise.all([optionPromise, featurePromise]);
      if (!active) return;
      const next = new Map();
      Object.entries(FALLBACK_SKILL_DESCRIPTIONS).forEach(([key, value]) => next.set(normalizeName(key), value));
      for (const row of optionResult.data || []) {
        if (row.option_type !== "species") next.set(normalizeName(row.name), safeText(row.description));
      }
      for (const row of featureResult.data || []) next.set(normalizeName(row.name), safeText(row.description));
      setDescriptions(next);
      const species = (optionResult.data || []).find((row) => row.option_type === "species" && normalizeName(row.name) === normalizeName(speciesName));
      setSpeciesDescription(safeText(species?.description));
    }
    loadDescriptions();
    return () => { active = false; };
  }, [classKey, classSource, speciesName]);

  useEffect(() => {
    let active = true;
    setResourceProfile(null);
    setResourceError("");
    setResourceAccessible(null);
    if (!resolvedCharacterId) {
      setResourceLoading(false);
      return () => { active = false; };
    }

    async function loadResourceProfile() {
      setResourceLoading(true);
      try {
        const { data, error } = await supabase.rpc("character_sheet_resource_profile_v1", {
          p_character_id: resolvedCharacterId,
        });
        if (!active) return;
        if (error) {
          if (String(error.code || "") === "42501") {
            setResourceAccessible(false);
            return;
          }
          setResourceError(error.message || "Could not load spell resources.");
          setResourceAccessible(true);
          return;
        }
        setResourceProfile(data && typeof data === "object" ? data : null);
        setResourceAccessible(true);
      } catch (error) {
        if (!active) return;
        setResourceError(error?.message || "Could not load spell resources.");
        setResourceAccessible(true);
      } finally {
        if (active) setResourceLoading(false);
      }
    }

    loadResourceProfile();
    return () => { active = false; };
  }, [resolvedCharacterId]);

  const traitLines = useMemo(() => {
    if (Array.isArray(featureRows) && featureRows.length) {
      return featureRows.map((row) => ({
        raw: `${safeText(row?.category || "Trait")}: ${safeText(row?.name)}`,
        category: safeText(row?.category || "Trait") || "Trait",
        name: safeText(row?.name),
        description: safeText(row?.description)
          || descriptions.get(normalizeName(row?.name))
          || "No imported description is available for this entry yet.",
      })).filter((row) => row.name);
    }
    return safeText(sheet.featsTraits)
      .split(/\r?\n/)
      .map((line) => lineInfo(line, descriptions, speciesDescription))
      .filter((line) => line.raw);
  }, [descriptions, featureRows, sheet.featsTraits, speciesDescription]);

  async function runResourceRpc(rpcName, args, busyKey) {
    if (!resolvedCharacterId || resourceBusyKey) return;
    setResourceBusyKey(busyKey);
    setResourceError("");
    try {
      const { data, error } = await supabase.rpc(rpcName, args);
      if (error) throw error;
      setResourceProfile(data && typeof data === "object" ? data : null);
      setResourceAccessible(true);
    } catch (error) {
      setResourceError(error?.message || "Could not update spell resources.");
    } finally {
      setResourceBusyKey("");
    }
  }

  async function handleSlotOperation(slot, operation) {
    const poolKey = safeText(slot?.poolKey);
    const slotLevel = safeNumber(slot?.slotLevel);
    await runResourceRpc("update_character_spell_slot_v1", {
      p_character_id: resolvedCharacterId,
      p_pool_key: poolKey,
      p_slot_level: slotLevel,
      p_operation: operation,
    }, `slot:${poolKey}:${slotLevel}:${operation}`);
  }

  async function handleSpellUseOperation(entry, operation) {
    const assignmentId = safeText(entry?.assignmentId);
    if (!assignmentId) return;
    await runResourceRpc("update_character_spell_use_v1", {
      p_character_id: resolvedCharacterId,
      p_assignment_id: assignmentId,
      p_operation: operation,
    }, `spell:${assignmentId}:${operation}`);
  }

  async function handleRest(restType) {
    const isLong = restType === "long_rest";
    const prompt = isLong
      ? "Complete a Long Rest? This restores all tracked spell slots and short/long-rest limited spell uses. HP, Hit Dice, class features, and encounter state are not changed yet."
      : "Complete a Short Rest? This restores Pact Magic and other short-rest spell resources. HP, Hit Dice, class features, and encounter state are not changed yet.";
    if (typeof window !== "undefined" && !window.confirm(prompt)) return;
    await runResourceRpc("complete_character_rest_v1", {
      p_character_id: resolvedCharacterId,
      p_rest_type: restType,
    }, `rest:${restType}`);
  }

  const applyDomEnhancements = useCallback(() => {
    const root = rootRef?.current;
    if (!root) return;

    const abilityByName = new Map(ABILITY_KEYS.map((key) => [normalizeName(ABILITY_LABELS[key]), key]));
    root.querySelectorAll(".csheet-ability").forEach((node) => {
      const label = safeText(node.querySelector(".csheet-ability-name")?.textContent);
      const key = abilityByName.get(normalizeName(label));
      if (!key) return;
      const description = ABILITY_DESCRIPTIONS[key] || "Ability score.";
      node.title = description;
      node.classList.add("is-description-target");
      node.setAttribute("role", "button");
      node.setAttribute("tabindex", "0");
      node.onclick = () => setPinnedInfo({ title: ABILITY_LABELS[key], description, type: "Ability" });
      node.onkeydown = (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setPinnedInfo({ title: ABILITY_LABELS[key], description, type: "Ability" });
        }
      };
    });

    const rows = [...root.querySelectorAll(".csheet-row")];
    for (const row of rows) {
      const button = row.querySelector(".csheet-rollbtn");
      if (!button) continue;
      const label = safeText(button.querySelector(".csheet-rollname")?.childNodes?.[0]?.textContent || button.querySelector(".csheet-rollname")?.textContent);
      const normalized = normalizeName(label);
      const abilityKey = abilityByName.get(normalized);
      const skillDescription = descriptions.get(normalized);
      if (abilityKey) button.title = `${ABILITY_LABELS[abilityKey]} saving throws resist effects that challenge ${ABILITY_LABELS[abilityKey].toLowerCase()}. ${ABILITY_DESCRIPTIONS[abilityKey]}`;
      else if (skillDescription) button.title = skillDescription;
    }

    const traitSection = sectionByTitle(root, "Feats & Traits");
    const source = traitSection?.querySelector(".csheet-text");
    const traitScroll = traitSection?.querySelector(".csheet-traits-scroll");
    if (traitSection && source && !source.closest(".csheet--edit")) {
      source.classList.add("csheet-traits-enhanced-source");
      setTraitTarget(traitScroll || traitSection);
    } else {
      setTraitTarget(null);
    }

    setDescriptionTarget(root.querySelector(".csheet-description-slot"));
    setResourceTarget(resourceAccessible === false ? null : ensureResourceTarget(root));
    updateSpellResourceSummaries(root, resourceProfile);

    const hpRead = root.querySelector(".csheet-hp-read");
    if (hpRead) {
      hpRead.title = canManageCharacter ? "Click to record damage, healing, or temporary hit points." : "Current, maximum, and temporary hit points.";
      hpRead.classList.toggle("is-hp-manageable", Boolean(canManageCharacter));
      hpRead.onclick = canManageCharacter ? () => setHpOpen(true) : null;
      hpRead.setAttribute("role", canManageCharacter ? "button" : "status");
      if (canManageCharacter) hpRead.setAttribute("tabindex", "0");
      else hpRead.removeAttribute("tabindex");
      hpRead.onkeydown = canManageCharacter ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setHpOpen(true);
        }
      } : null;
    }
  }, [canManageCharacter, descriptions, resourceAccessible, resourceProfile, rootRef]);

  useEffect(() => {
    applyDomEnhancements();
    const root = rootRef?.current;
    if (!root) return undefined;
    const observer = new MutationObserver(() => applyDomEnhancements());
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [applyDomEnhancements, rootRef, sheet]);

  return (
    <>
      {traitTarget && traitLines.length ? createPortal(
        <div className="csheet-trait-description-list">
          {traitLines.map((line, index) => (
            <button
              type="button"
              key={`${line.raw}-${index}`}
              className="csheet-trait-description-row"
              title={line.description}
              onClick={() => setPinnedInfo({ title: line.name, description: line.description, type: line.category })}
            >
              <span>{line.category}</span>
              <strong>{line.name}</strong>
            </button>
          ))}
        </div>,
        traitTarget
      ) : null}
      {descriptionTarget ? createPortal(
        <section className="csheet-pinned-description" aria-live="polite">
          <div className="csheet-pinned-description__head">
            <div>
              <span>{pinnedInfo?.type || "Reference"}</span>
              <strong>{pinnedInfo?.title || "Pinned Description"}</strong>
            </div>
            {pinnedInfo ? <button type="button" onClick={() => setPinnedInfo(null)}>Clear</button> : null}
          </div>
          <p>{pinnedInfo?.description || "Click an ability, feat, or trait to keep its description visible here."}</p>
        </section>,
        descriptionTarget
      ) : null}
      {resourceTarget && resolvedCharacterId && resourceAccessible !== false ? createPortal(
        <CharacterSheetResourceTracker
          profile={resourceProfile}
          loading={resourceLoading}
          error={resourceError}
          busyKey={resourceBusyKey}
          onSlotOperation={handleSlotOperation}
          onSpellUseOperation={handleSpellUseOperation}
          onRest={handleRest}
        />,
        resourceTarget
      ) : null}
      {hpOpen && canManageCharacter && resolvedCharacterId ? (
        <div className="sheet-hp-popover-backdrop" onMouseDown={(event) => event.target === event.currentTarget ? setHpOpen(false) : null}>
          <HpAdjuster characterId={resolvedCharacterId} sheet={sheet} onUpdated={(nextSheet) => { onSheetUpdated?.(nextSheet); setHpOpen(false); }} onClose={() => setHpOpen(false)} />
        </div>
      ) : null}
    </>
  );
}
