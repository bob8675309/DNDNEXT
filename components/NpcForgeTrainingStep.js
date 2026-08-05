import { ABILITY_LABELS } from "../utils/characterCreation";
import { PROFESSION_DEFINITIONS, PROFESSION_KEYS } from "../utils/craftingProfessions";

export default function NpcForgeTrainingStep({
  playerMode,
  backgroundSkills = [],
  classSkillConfig,
  selectedClass,
  selectedClassSkills = [],
  professions = {},
  titleForSkill,
  onToggleClassSkill,
  onToggleExpertise,
  expertiseSkills = [],
  onSetProfession,
  onDetail,
}) {
  const selectedSkillKeys = [...new Set([...backgroundSkills, ...selectedClassSkills])];
  return <div className="npc-forge-section npc-forge-training-step">
    <div className="npc-forge-section-heading"><div><span>Training</span><h3>Skills and crafting professions</h3></div><p>Background and class training are combined here; each source is identified below.</p></div>
    <div className="npc-forge-training-explainer">
      <div><strong>Background grants</strong><span>{backgroundSkills.length ? `${backgroundSkills.length} skill${backgroundSkills.length === 1 ? "" : "s"} are already trained by the selected background.` : "This background does not list fixed skills."}</span></div>
      <div><strong>Class choices</strong><span>Choose exactly {classSkillConfig.count} skill{classSkillConfig.count === 1 ? "" : "s"} from the {selectedClass?.class_name || "class"} skill pool. A background-granted skill does not consume another class choice.</span></div>
      <div><strong>Expertise</strong><span>{playerMode ? "Expertise is not self-assigned during creation. It is granted by class, subclass, feat, training, or the Game Master." : "NPC expertise can be assigned directly when building a bespoke NPC."}</span></div>
    </div>

    <div className="npc-forge-subheading mt-3">Background skills</div>
    <div className="npc-forge-chip-row">{backgroundSkills.length ? backgroundSkills.map((key) => <button key={key} type="button" className="is-fixed" onClick={() => onDetail({ type: "skill", key })}>{titleForSkill(key)}</button>) : <span className="is-fixed">No fixed background skills</span>}</div>

    <div className="npc-forge-subheading mt-4">Class skills <small>Choose {classSkillConfig.count} • {selectedClassSkills.length}/{classSkillConfig.count} selected</small></div>
    <div className="npc-forge-skill-grid">{classSkillConfig.options.map((key) => {
      const selected = selectedClassSkills.includes(key);
      const backgroundGranted = backgroundSkills.includes(key);
      return <button key={key} type="button" className={`${selected ? "is-active" : ""} ${backgroundGranted ? "is-background" : ""}`} onClick={() => backgroundGranted ? onDetail({ type: "skill", key }) : onToggleClassSkill(key)}><span>{titleForSkill(key)}</span><small>{backgroundGranted ? "Already granted by Background" : selected ? "Class choice selected" : "Available from class pool"}</small></button>;
    })}</div>

    {!playerMode ? <><div className="npc-forge-subheading mt-4">Expertise <small>NPC-only direct assignment</small></div><div className="npc-forge-chip-row">{selectedSkillKeys.map((key) => <button key={key} type="button" className={expertiseSkills.includes(key) ? "is-active" : ""} onClick={() => onToggleExpertise(key)}>{titleForSkill(key)}</button>)}</div></> : null}

    <div className="npc-forge-subheading mt-4">Crafting professions</div>
    {playerMode ? <div className="npc-forge-crafting-house-rule"><strong>Campaign crafting house rule</strong><p>Player characters can pursue a profession and create a crafting plan. They contribute work during an eligible Short or Long Rest and make the required roll when the project is ready to advance. Large projects can require several rests. Some recipes require a physical work site—such as a forge, laboratory, scriptorium, enchanting station, or a properly deployed caravan workshop.</p></div> : null}
    <div className="npc-forge-profession-list">{PROFESSION_KEYS.map((key) => {
      const definition = PROFESSION_DEFINITIONS[key];
      const profession = professions?.[key] || { rank: 0, ability: definition.abilities[0], offersService: false };
      return <div key={key} className={`npc-forge-profession ${profession.offersService ? "is-provider" : ""}`} onMouseEnter={() => onDetail({ type: "profession", key })}><div><strong>{definition.label}</strong><small>{definition.tool}</small></div><label><span>Rank</span><select value={profession.rank} onChange={(event) => onSetProfession(key, "rank", Number(event.target.value))}><option value={0}>Untrained</option><option value={1}>Proficient</option>{!playerMode ? <option value={2}>Expertise</option> : null}</select></label><label><span>Ability</span><select value={profession.ability} onChange={(event) => onSetProfession(key, "ability", event.target.value)}>{definition.abilities.map((ability) => <option key={ability} value={ability}>{ABILITY_LABELS[ability]}</option>)}</select></label>{!playerMode ? <label className="npc-forge-service-toggle"><input type="checkbox" checked={Boolean(profession.offersService)} disabled={Number(profession.rank || 0) === 0} onChange={(event) => onSetProfession(key, "offersService", event.target.checked)} /><span>Offers workshop service</span></label> : null}</div>;
    })}</div>

    <style jsx global>{`
      .npc-forge-training-explainer{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:4px}.npc-forge-training-explainer>div{display:grid;gap:5px;padding:11px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:rgba(255,255,255,.025)}.npc-forge-training-explainer strong{color:#fff;font-size:.75rem}.npc-forge-training-explainer span{color:rgba(255,255,255,.62);font-size:.69rem;line-height:1.45}.npc-forge-crafting-house-rule{margin-bottom:10px;padding:12px 14px;border-left:3px solid #58d6c7;border-radius:9px;background:rgba(88,214,199,.075)}.npc-forge-crafting-house-rule strong{color:#bffbf3}.npc-forge-crafting-house-rule p{margin:5px 0 0;color:rgba(255,255,255,.72);font-size:.75rem;line-height:1.58}@media(max-width:900px){.npc-forge-training-explainer{grid-template-columns:1fr}}
    `}</style>
  </div;
}
