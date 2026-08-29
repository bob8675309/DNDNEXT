import { useState } from "react";
import { ABILITY_KEYS, ABILITY_LABELS } from "../utils/characterCreation";
import NpcForgeAbilityGlyph, { ABILITY_SHORT_GUIDE } from "./NpcForgeAbilityGlyph";

export default function NpcForgeAbilityContextCard({ detail = null }) {
  const [collapsed, setCollapsed] = useState(false);
  const activeKey = detail?.type === "ability" ? detail.key : "";

  return <section className={`npc-forge-ability-guide${collapsed ? " is-collapsed" : ""}`}>
    <header className="npc-forge-ability-guide__head">
      <span>Ability Guide</span>
      <button type="button" onClick={() => setCollapsed((value) => !value)}>{collapsed ? "Expand" : "Collapse"}</button>
    </header>
    {collapsed ? null : <>
      <p>Abilities influence your checks, saving throws, attack rolls, and many class features.</p>
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
