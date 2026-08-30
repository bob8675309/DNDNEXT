import { useState } from "react";
import { ABILITY_KEYS, ABILITY_LABELS, abilityModifierForScore } from "../utils/characterCreation";
import NpcForgeAbilityGlyph, { ABILITY_DETAILED_GUIDE, ABILITY_SHORT_GUIDE } from "./NpcForgeAbilityGlyph";

function modifierLabel(score) {
  const modifier = abilityModifierForScore(score);
  return modifier >= 0 ? `+${modifier}` : String(modifier);
}

export default function NpcForgeAbilityContextCard({ detail = null, draft = {}, finalAbilities = {} }) {
  const [collapsed, setCollapsed] = useState(false);
  const activeKey = detail?.type === "ability" ? detail.key : "";
  const activeGuide = ABILITY_DETAILED_GUIDE[activeKey] || null;
  const activeScore = activeKey ? Number(finalAbilities?.[activeKey] ?? draft?.baseAbilities?.[activeKey] ?? 10) : null;

  return <section className={`npc-forge-ability-guide${collapsed ? " is-collapsed" : ""}`}>
    <header className="npc-forge-ability-guide__head">
      <span>Ability Guide</span>
      <button type="button" onClick={() => setCollapsed((value) => !value)}>{collapsed ? "Expand" : "Collapse"}</button>
    </header>
    {collapsed ? null : <>
      {activeGuide ? <div className={`npc-forge-ability-guide__focus is-${activeKey}`}>
        <div className="npc-forge-ability-guide__focus-head">
          <NpcForgeAbilityGlyph ability={activeKey} />
          <div>
            <span>Focused ability</span>
            <strong>{ABILITY_LABELS[activeKey]}</strong>
            <small>Score {activeScore} &nbsp;•&nbsp; Modifier {modifierLabel(activeScore)}</small>
          </div>
        </div>
        <p>{activeGuide.description}</p>
        <ul>{activeGuide.uses.map((use) => <li key={use}>{use}</li>)}</ul>
      </div> : <p>Hover over or click an ability on the left to see what it governs. Abilities influence checks, saves, attacks, and class features.</p>}
      <div className="npc-forge-ability-guide__list">
        {ABILITY_KEYS.map((key) => <div key={key} className={activeKey === key ? "is-active" : ""}>
          <NpcForgeAbilityGlyph ability={key} compact />
          <strong>{ABILITY_LABELS[key]}</strong>
          <span>{ABILITY_SHORT_GUIDE[key]}</span>
        </div>)}
      </div>
    </>}
  </section>;
}
