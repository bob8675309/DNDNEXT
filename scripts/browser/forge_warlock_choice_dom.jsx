// J169: isolated headless-browser test surface. Imports UNMODIFIED shipped
// source-choice UI and rule utilities. Never included in Next.js pages/runtime.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import SourceChoiceFields from "../../components/SourceChoiceFields";
import {
  normalizeSourceChoiceSelections,
  sourceChoiceGroupsComplete,
  toggleSourceChoiceSelection,
  serializeSourceChoices,
  foundationChoiceSummary,
} from "../../utils/playerForgeSourceChoices";
import { buildWarlockInvocationSourceGroups } from "../../utils/warlockInvocationChoices";
import manifest from "../fixtures/forge_seeded_warlock_child_completion_v1.json";

const live = manifest.live;
if (live.classKey !== "warlock" || live.classSource !== "XPHB" ||
    live.level !== 2 || live.slots !== 3) {
  throw new Error("J169 canonical Warlock2 specimen moved; stop and review.");
}
const selectedClass = { class_key: live.classKey, source: live.classSource };
const optionRows = live.invocations.map((inv) => ({
  id: inv.id, option_key: inv.key, option_type: "eldritch-invocation",
  class_key: live.classKey, source: live.classSource, name: inv.name,
  repeatable: false, prerequisites: inv.prerequisites || {},
  choice_schema: inv.choiceSchema || {},
}));
const build = (selections) => buildWarlockInvocationSourceGroups({
  selectedClass, level: live.level, optionRows, spells: live.spells,
  featOptions: [], selections,
});

function BrowserChoiceHarness() {
  const [selections, setSelections] = useState({});
  const groups = useMemo(() => build(selections), [selections]);
  const toggleChoice = useCallback((groupId, fieldId, optionKey) => {
    setSelections((previous) => toggleSourceChoiceSelection(
      build(previous), previous, groupId, fieldId, optionKey
    ));
  }, []);
  const normalized = useMemo(() =>
    normalizeSourceChoiceSelections(groups, selections), [groups, selections]);
  const complete = sourceChoiceGroupsComplete(groups, normalized, {
    ownerType: "class-option",
  });
  const sourceChoices = useMemo(() =>
    serializeSourceChoices(groups, normalized), [groups, normalized]);
  const sourceChoiceSummary = useMemo(() =>
    foundationChoiceSummary(groups, normalized), [groups, normalized]);

  useEffect(() => {
    // Local fixture data only: no JWT, identity, Supabase connection, or
    // network request capture. This bridge is never shipped to the app.
    window.__DNDNEXT_J169_CHOICE_WIRE__ = {
      ready: groups.length === live.slots,
      complete, sourceChoices, sourceChoiceSummary,
    };
  }, [groups.length, complete, sourceChoices, sourceChoiceSummary]);

  return <main className="npc-forge-modal-v2">
    <header><h1>Isolated Warlock source-choice browser acceptance</h1>
      <p>Fixture only — no account, no database or live game connection.</p></header>
    <div aria-label="Forge choice completion" data-complete={complete ? "true" : "false"}>
      {complete ? "All required source choices complete" : "Required source choices incomplete"}
    </div>
    <SourceChoiceFields groups={groups} selections={normalized}
      title="Warlock source-owned Invocations" compact={false}
      onToggle={toggleChoice}
      onSet={(groupId, fieldId, optionKeys) => {
        // Use the original utility on this selection surface, not a
        // custom browser-only selection or eligibility algorithm.
        setSelections((previous) => {
          const currentGroups = build(previous);
          const matching = currentGroups.find((entry) => entry.id === groupId)
            ?.fields.find((field) => field.id === fieldId);
          if (!matching) return previous;
          let next = previous;
          for (const optionKey of optionKeys) {
            if (!next?.[groupId]?.[fieldId]?.includes(optionKey)) {
              next = toggleSourceChoiceSelection(build(next), next, groupId, fieldId, optionKey);
            }
          }
          return next;
        });
      }}
    />
  </main>;
}

const mount = document.getElementById("j169-app");
if (!mount) throw new Error("J169 must mount into its isolated local fixture document.");
createRoot(mount).render(<BrowserChoiceHarness />);
