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
  const rawScore = activeKey ? Number(finalAbilities?.[activeKey] ?? draft?.baseAbilities?.[activeKey] ?? 10) : null;
  const activeScore = Number.isFinite(rawScore) ? rawScore : 10;

  return <section className={`npc-forge-ability-guide${collapsed ? " is-collapsed" : ""}${activeGuide ? " has-focus" : " is-placeholder"}`}>
    <header className="npc-forge-ability-guide__head">
      <span>Ability Guide</span>
      <button type="button" onClick={() => setCollapsed((value) => !value)}>{collapsed ? "Expand" : "Collapse"}</button>
    </header>
    {collapsed ? null : <div className="npc-forge-ability-guide__body">
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
        <div className="npc-forge-ability-guide__focus-uses">
          <strong>What it commonly governs</strong>
          <ul>{activeGuide.uses.map((use) => <li key={use}>{use}</li>)}</ul>
        </div>
      </div> : <div className="npc-forge-ability-guide__placeholder">
        <p>Hover over or click an ability on the left to see what it governs. Abilities influence checks, saves, attacks, and class features.</p>
        <div className="npc-forge-ability-guide__list">
          {ABILITY_KEYS.map((key) => <div key={key}>
            <NpcForgeAbilityGlyph ability={key} compact />
            <strong>{ABILITY_LABELS[key]}</strong>
            <span>{ABILITY_SHORT_GUIDE[key]}</span>
          </div>)}
        </div>
      </div>}
    </div>}
    <style jsx global>{`
      .unified-player-character-forge .npc-forge-preview > .npc-forge-ability-guide {
        flex: 1 1 auto;
        min-height: 338px;
        grid-template-rows: auto minmax(0, 1fr);
      }
      .unified-player-character-forge .npc-forge-ability-guide.is-collapsed {
        flex: 0 0 auto;
        min-height: 0;
        grid-template-rows: auto;
      }
      .unified-player-character-forge .npc-forge-ability-guide__body {
        min-height: 0;
        height: 100%;
      }
      .unified-player-character-forge .npc-forge-ability-guide__placeholder,
      .unified-player-character-forge .npc-forge-ability-guide__focus {
        height: 100%;
        min-height: 0;
      }
      .unified-player-character-forge .npc-forge-ability-guide__placeholder {
        display: grid;
        align-content: start;
        gap: 10px;
      }
      .unified-player-character-forge .npc-forge-ability-guide__placeholder > p {
        margin: 0;
        color: rgba(255,255,255,.66);
        font-size: .58rem;
        line-height: 1.55;
      }
      .unified-player-character-forge .npc-forge-ability-guide.has-focus .npc-forge-ability-guide__focus {
        align-content: start;
        gap: 13px;
        padding: 15px 14px 16px;
      }
      .unified-player-character-forge .npc-forge-ability-guide.has-focus .npc-forge-ability-guide__focus-head {
        gap: 11px;
        padding-bottom: 2px;
      }
      .unified-player-character-forge .npc-forge-ability-guide.has-focus .npc-forge-ability-guide__focus-head .npc-forge-ability-glyph {
        width: 46px;
        height: 46px;
      }
      .unified-player-character-forge .npc-forge-ability-guide.has-focus .npc-forge-ability-guide__focus-head .npc-forge-ability-glyph svg {
        width: 22px;
        height: 22px;
      }
      .unified-player-character-forge .npc-forge-ability-guide.has-focus .npc-forge-ability-guide__focus-head span {
        font-size: .48rem;
      }
      .unified-player-character-forge .npc-forge-ability-guide.has-focus .npc-forge-ability-guide__focus-head strong {
        font-size: .94rem;
      }
      .unified-player-character-forge .npc-forge-ability-guide.has-focus .npc-forge-ability-guide__focus-head small {
        font-size: .56rem;
      }
      .unified-player-character-forge .npc-forge-ability-guide.has-focus .npc-forge-ability-guide__focus > p {
        color: rgba(255,255,255,.8);
        font-size: .63rem;
        line-height: 1.62;
      }
      .unified-player-character-forge .npc-forge-ability-guide__focus-uses {
        display: grid;
        gap: 7px;
        padding-top: 3px;
        border-top: 1px solid rgba(var(--ability-rgb), .16);
      }
      .unified-player-character-forge .npc-forge-ability-guide__focus-uses > strong {
        color: rgba(var(--ability-rgb), .94);
        font-size: .49rem;
        font-weight: 900;
        letter-spacing: .075em;
        text-transform: uppercase;
      }
      .unified-player-character-forge .npc-forge-ability-guide.has-focus .npc-forge-ability-guide__focus ul {
        gap: 7px;
        padding-left: 18px;
      }
      .unified-player-character-forge .npc-forge-ability-guide.has-focus .npc-forge-ability-guide__focus li {
        color: rgba(255,255,255,.72);
        font-size: .56rem;
        line-height: 1.55;
      }
      @media (max-width: 900px) {
        .unified-player-character-forge .npc-forge-preview > .npc-forge-ability-guide {
          min-height: 0;
        }
      }
    `}</style>
  </section>;
}
