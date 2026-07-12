import { ABILITY_KEYS, ABILITY_LABELS } from "../utils/characterCreation";
import { ABILITY_DESCRIPTIONS } from "../utils/characterCreationGuidance";

function safeText(value) {
  return String(value ?? "").trim();
}

function sourceLabel(source = "") {
  if (source === "XPHB") return "2024 Player's Handbook";
  if (source === "PHB") return "2014 Player's Handbook";
  if (source === "CAMPAIGN") return "Campaign";
  return source || "Source unknown";
}

function labelList(values = [], labels = {}) {
  return (Array.isArray(values) ? values : []).map((value) => labels[value] || value).filter(Boolean).join(", ");
}

function DetailHeader({ eyebrow, title, source }) {
  return (
    <div className="npc-forge-context-head">
      <div>
        <span>{eyebrow}</span>
        <h3>{title}</h3>
      </div>
      {source ? <span className="npc-forge-context-source">{sourceLabel(source)}</span> : null}
    </div>
  );
}

function InfoRows({ rows = [] }) {
  return (
    <div className="npc-forge-context-rows">
      {rows.filter((row) => row?.value !== undefined && row?.value !== null && row?.value !== "").map((row) => (
        <div key={row.label}>
          <span>{row.label}</span>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function NpcForgeContextPanel({
  step = 0,
  detail = null,
  selectedSpecies = null,
  selectedBackground = null,
  selectedClass = null,
  selectedSkill = null,
  selectedProfession = null,
  rolls = [],
  allocation = {},
  finalAbilities = {},
  draft = {},
}) {
  if (detail?.type === "species" && detail.option) {
    const option = detail.option;
    return (
      <div className="npc-forge-context-card is-origin">
        <DetailHeader eyebrow="Species" title={option.name} source={option.source} />
        <p>{option.description || "No source description is available."}</p>
        <InfoRows rows={[
          { label: "Speed", value: option.speed ? `${option.speed} ft.` : "Varies" },
          { label: "Size", value: labelList(option.size) || "Source default" },
          { label: "Lineage", value: labelList(option.lineages) || "None required" },
        ]} />
        {option.traits?.length ? <div className="npc-forge-context-section"><span>Notable traits</span><div className="npc-forge-context-chips">{option.traits.slice(0, 10).map((trait) => <b key={trait}>{trait}</b>)}</div></div> : null}
        <div className="npc-forge-context-note">Species describes ancestry and innate traits. Background and class are selected separately.</div>
      </div>
    );
  }

  if (detail?.type === "background" && detail.option) {
    const option = detail.option;
    return (
      <div className="npc-forge-context-card is-origin">
        <DetailHeader eyebrow="Background" title={option.name} source={option.source} />
        <p>{option.description || "No source description is available."}</p>
        <InfoRows rows={[
          { label: "Suggested abilities", value: labelList(option.recommendedAbilities, ABILITY_LABELS) || "Any ability" },
          { label: "Skills", value: labelList(option.backgroundSkills) || "See source description" },
          { label: "Tools", value: labelList(option.tools) || "None listed" },
          { label: "Origin feat", value: option.originFeat || "None listed" },
        ]} />
        <div className="npc-forge-context-note">Campaign rule: the +2/+1 or three +1 increases may be assigned to any abilities. Suggested abilities are guidance, not a lock.</div>
      </div>
    );
  }

  if (detail?.type === "class" && detail.option) {
    const option = detail.option;
    return (
      <div className="npc-forge-context-card is-class">
        <DetailHeader eyebrow="Class" title={option.class_name} source={option.source} />
        <p>{option.summary || "No class summary is available."}</p>
        <InfoRows rows={[
          { label: "Hit Die", value: `d${option.hit_die || 8}` },
          { label: "Primary abilities", value: labelList(option.primary_abilities, ABILITY_LABELS) || "Varies" },
          { label: "Saving throws", value: labelList(option.saving_throws, ABILITY_LABELS) || "Varies" },
          { label: "Spellcasting", value: ABILITY_LABELS[option.spellcasting_ability] || "None at base class" },
          { label: "Rules", value: option.ruleset || sourceLabel(option.source) },
        ]} />
        <div className="npc-forge-context-note">Class controls combat progression and class features. It never replaces the NPC's in-world title, trade, or affiliation.</div>
      </div>
    );
  }

  if (detail?.type === "ability" && detail.key) {
    const key = detail.key;
    return (
      <div className="npc-forge-context-card is-ability">
        <DetailHeader eyebrow="Ability" title={ABILITY_LABELS[key] || key.toUpperCase()} />
        <p>{ABILITY_DESCRIPTIONS[key] || "This ability contributes to checks, saving throws, and class features."}</p>
        <InfoRows rows={[
          { label: "Base score", value: draft.baseAbilities?.[key] ?? 10 },
          { label: "Final score", value: finalAbilities?.[key] ?? draft.baseAbilities?.[key] ?? 10 },
          { label: "Assigned roll", value: allocation?.[key] ? rolls.find((roll) => roll.id === allocation[key])?.total : "Not assigned" },
        ]} />
        <div className="npc-forge-context-note">A score of 10–11 is average. Every 2 points above or below 10 changes the modifier by 1.</div>
      </div>
    );
  }

  if (detail?.type === "skill" && selectedSkill) {
    return (
      <div className="npc-forge-context-card is-training">
        <DetailHeader eyebrow="Skill" title={selectedSkill.label} source={selectedSkill.source} />
        <p>{selectedSkill.description || "No source description is available."}</p>
        <InfoRows rows={[{ label: "Governing ability", value: ABILITY_LABELS[selectedSkill.ability] || selectedSkill.ability?.toUpperCase() }]} />
        <div className="npc-forge-context-note">Proficiency adds the character's proficiency bonus. Expertise doubles that bonus.</div>
      </div>
    );
  }

  if (detail?.type === "profession" && selectedProfession) {
    return (
      <div className="npc-forge-context-card is-training">
        <DetailHeader eyebrow="Profession" title={selectedProfession.label} />
        <p>{selectedProfession.description || `Professional training using ${selectedProfession.tool || "specialized tools"}.`}</p>
        <InfoRows rows={[
          { label: "Tool", value: selectedProfession.tool },
          { label: "Abilities", value: labelList(selectedProfession.abilities, ABILITY_LABELS) },
        ]} />
        <div className="npc-forge-context-note">Workshop service remains an explicit toggle. A title such as “smith” does not grant crafting access by itself.</div>
      </div>
    );
  }

  if (step === 0) {
    return (
      <div className="npc-forge-context-card is-origin">
        <DetailHeader eyebrow="Origin" title={selectedSpecies?.name || selectedBackground?.name || "Choose an origin"} />
        <p>Select a species or background to read its source description, traits, proficiencies, suggested abilities, and feat.</p>
        <div className="npc-forge-context-note">The Forge now reads the full preferred character-option catalog. Duplicate names display one preferred version, with 2024 first.</div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="npc-forge-context-card is-class">
        <DetailHeader eyebrow="Class" title={selectedClass?.class_name || "Choose a class"} />
        <p>Choose a class to inspect hit dice, primary abilities, saving throws, spellcasting, and rules source.</p>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="npc-forge-context-card is-ability">
        <DetailHeader eyebrow="Ability Scores" title="Roll, then allocate" />
        <p>Each rolled score uses 4d6 and discards the lowest die. Six totals are produced, then each total is assigned to one ability.</p>
        <div className="npc-forge-context-ability-list">{ABILITY_KEYS.map((key) => <div key={key}><strong>{ABILITY_LABELS[key]}</strong><span>{ABILITY_DESCRIPTIONS[key]}</span></div>)}</div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="npc-forge-context-card is-training">
        <DetailHeader eyebrow="Training" title="Skills and professions" />
        <p>Select a skill or profession on the left to see what it governs and how it contributes to the sheet.</p>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="npc-forge-context-card is-story">
        <DetailHeader eyebrow="Characterization" title="Build useful campaign hooks" />
        <p>Write details players can perceive first, then private motivations, bonds, flaws, and secrets. Concise entries are easier to use during play.</p>
        <div className="npc-forge-context-ability-list"><div><strong>Description</strong><span>What players see immediately.</span></div><div><strong>Motivation</strong><span>What the NPC wants right now.</span></div><div><strong>Bond</strong><span>Who or what they will protect.</span></div><div><strong>Secret</strong><span>Information the party can uncover.</span></div></div>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="npc-forge-context-card is-identity">
        <DetailHeader eyebrow="Identity & Placement" title={draft.name || "Name the character"} />
        <p>Name generation uses the selected species and gender presentation. Role/title and affiliation remain narrative fields and never grant class or workshop capabilities.</p>
        <InfoRows rows={[
          { label: "Species", value: selectedSpecies?.name || "Not selected" },
          { label: "Gender presentation", value: draft.gender || "Neutral" },
          { label: "Type", value: draft.kind === "merchant" ? "Merchant" : "NPC" },
        ]} />
      </div>
    );
  }

  return (
    <div className="npc-forge-context-card is-review">
      <DetailHeader eyebrow="Review" title={draft.name || "Unnamed character"} />
      <p>Review is the only place that summarizes the completed sheet. Return to any previous step to revise a choice before creation.</p>
    </div>
  );
}
