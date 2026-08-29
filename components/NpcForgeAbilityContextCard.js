import { ABILITY_KEYS, ABILITY_LABELS } from "../utils/characterCreation";
import { ABILITY_DESCRIPTIONS } from "../utils/characterCreationGuidance";

function modifier(score) {
  const value = Math.floor((Number(score || 10) - 10) / 2);
  return value >= 0 ? `+${value}` : String(value);
}

export default function NpcForgeAbilityContextCard({ detail = null, draft = {}, finalAbilities = {} }) {
  const activeKey = detail?.type === "ability" ? detail.key : "";
  const activeLabel = activeKey ? ABILITY_LABELS[activeKey] : "";

  return <div className="npc-forge-context-card npc-forge-ability-finalize-card">
    <div className="npc-forge-ability-finalize-card__head">
      <span>3 • Finalize</span>
      <h3>Review final ability scores</h3>
      <p>Base scores are assigned on the left. Species Bonus choices below are applied afterward.</p>
    </div>
    <div className="npc-forge-ability-final-grid">
      {ABILITY_KEYS.map((key) => {
        const base = Number(draft?.baseAbilities?.[key] ?? 10);
        const final = Number(finalAbilities?.[key] ?? base);
        return <div key={key} className={activeKey === key ? "is-active" : ""}>
          <span>{ABILITY_LABELS[key]}</span>
          <strong>{final}</strong>
          <em>{modifier(final)}</em>
          <small>Base {base}</small>
        </div>;
      })}
    </div>
    <div className="npc-forge-ability-finalize-card__inspect">
      <strong>{activeLabel || "Ability guide"}</strong>
      <p>{activeKey ? ABILITY_DESCRIPTIONS[activeKey] : "Hover an ability on the left to review what it governs while you place your scores."}</p>
    </div>
    <div className="npc-forge-ability-finalize-card__note">Species Bonus is resolved directly below this summary. Feats and persistent class choices remain in Training.</div>
    <style jsx global>{`
      .npc-forge-ability-finalize-card{display:grid;gap:10px!important}.npc-forge-ability-finalize-card__head{display:grid;gap:3px}.npc-forge-ability-finalize-card__head>span{color:#8de9de;font-size:.52rem;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.npc-forge-ability-finalize-card__head h3{margin:0;color:#fff;font-size:1rem}.npc-forge-ability-finalize-card__head p{margin:0;color:rgba(255,255,255,.58);font-size:.66rem;line-height:1.4}.npc-forge-ability-final-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.npc-forge-ability-final-grid>div{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:3px 7px;min-height:50px;padding:7px 8px;border:1px solid rgba(255,255,255,.085);border-radius:8px;background:rgba(255,255,255,.026)}.npc-forge-ability-final-grid>div.is-active{border-color:rgba(88,214,199,.58);background:rgba(88,214,199,.07)}.npc-forge-ability-final-grid span{color:rgba(255,255,255,.66);font-size:.57rem;font-weight:750}.npc-forge-ability-final-grid strong{color:#fff3ce;font-size:.9rem}.npc-forge-ability-final-grid em{color:#8de9de;font-size:.58rem;font-style:normal;font-weight:850}.npc-forge-ability-final-grid small{grid-column:1/-1;color:rgba(255,255,255,.4);font-size:.46rem}.npc-forge-ability-finalize-card__inspect{padding:9px 10px;border:1px solid rgba(168,108,255,.22);border-radius:8px;background:rgba(126,72,199,.07)}.npc-forge-ability-finalize-card__inspect strong{color:#e4d1ff;font-size:.61rem}.npc-forge-ability-finalize-card__inspect p{margin:4px 0 0;color:rgba(255,255,255,.62);font-size:.56rem;line-height:1.42}.npc-forge-ability-finalize-card__note{padding:8px 9px;border-left:3px solid #58d6c7;border-radius:6px;color:rgba(224,255,250,.68);background:rgba(88,214,199,.055);font-size:.52rem;line-height:1.4}@media(max-width:900px){.npc-forge-ability-final-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:620px){.npc-forge-ability-final-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `}</style>
  </div>;
}
