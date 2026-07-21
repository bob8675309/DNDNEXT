import { ABILITY_KEYS, ABILITY_LABELS } from "../utils/characterCreation";
import { ABILITY_DESCRIPTIONS } from "../utils/characterCreationGuidance";
import { formatPlayerFacingText } from "../utils/playerFacingText";
import { hasDedicatedSpeciesArtwork, handleSpeciesArtworkError, speciesArtworkFor } from "../utils/speciesArtwork";
import { speciesFlavorLore } from "../utils/speciesLore";
import { backgroundStoryDescription } from "../utils/backgroundPresentation";

const SIZE_LABELS = { T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan" };

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

function SpeciesTraitDetails({ details = [], traits = [] }) {
  const described = details.filter((entry) => entry?.name && entry?.description);
  const describedNames = new Set(described.map((entry) => entry.name));
  const concise = traits.filter((trait) => trait && !describedNames.has(trait));
  if (!described.length && !concise.length) return null;
  return (
    <div className="npc-forge-context-section npc-forge-species-features">
      <span>Species features</span>
      {described.length ? <div className="npc-forge-species-feature-list">{described.map((entry, index) => (
        <details key={`${entry.name}-${index}`} open={index < 2}>
          <summary>{entry.name}</summary>
          <p>{formatPlayerFacingText(entry.description)}</p>
        </details>
      ))}</div> : null}
      {concise.length ? <div className="npc-forge-context-chips">{concise.slice(0, 12).map((trait) => <b key={trait}>{trait}</b>)}</div> : null}
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
  const activeSpecies = detail?.type === "species" && detail.option ? detail.option : step === 0 ? selectedSpecies : null;
  const activeBackground = detail?.type === "background" && detail.option ? detail.option : step === 1 ? selectedBackground : null;
  const activeClass = detail?.type === "class" && detail.option ? detail.option : step === 2 ? selectedClass : null;

  if (activeSpecies) {
    const option = activeSpecies;
    const hasDedicatedArtwork = hasDedicatedSpeciesArtwork(option.name);
    return (
      <div className="npc-forge-context-card is-origin is-species">
        <figure className="npc-forge-species-artwork">
          <img src={speciesArtworkFor(option.name)} onError={handleSpeciesArtworkError} alt={`Original ${option.name} species reference artwork`} />
          <figcaption>
            <span>{option.name} reference</span>
            {!hasDedicatedArtwork ? <small>Neutral reference art</small> : null}
          </figcaption>
        </figure>
        <div className="npc-forge-species-lore">
          <span>In the world</span>
          <p>{speciesFlavorLore(option.name)}</p>
        </div>
        <InfoRows rows={[
          { label: "Speed", value: option.speed ? `${option.speed} ft.` : "Varies" },
          { label: "Size", value: labelList(option.size, SIZE_LABELS) || "Source default" },
          { label: "Creature type", value: labelList(option.creatureTypes) || "Humanoid" },
          { label: "Darkvision", value: option.darkvision ? `${option.darkvision} ft.` : "Not listed" },
          { label: "Lineage", value: labelList(option.lineages) || "None required" },
          { label: "Languages", value: labelList(option.languages) || safeText(draft.languagesText) || "Chosen for character" },
        ]} />
        <SpeciesTraitDetails details={option.traitDetails} traits={option.traits} />
        <div className="npc-forge-context-note">Species describes ancestry and innate traits. Background and class are selected separately.</div>
      </div>
    );
  }

  if (activeBackground) {
    const option = activeBackground;
    return (
      <div className="npc-forge-context-card is-origin">
        <DetailHeader eyebrow="Background" title={option.name} source={option.source} />
        <div className="npc-forge-background-story">
          <span>Before adventuring</span>
          {backgroundStoryDescription(option).split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
        <InfoRows rows={[
          { label: "Skills", value: labelList(option.backgroundSkills) || "See source description" },
          { label: "Tools", value: labelList(option.tools) || "None listed" },
          { label: "Origin feat", value: option.originFeat || "None listed" },
        ]} />
        <div className="npc-forge-context-note">Use this history to choose former allies, obligations, rivals, and unfinished business that can matter during play.</div>
      </div>
    );
  }

  if (activeClass) {
    const option = activeClass;
    return (
      <div className="npc-forge-context-card is-class">
        <DetailHeader eyebrow="Class" title={option.class_name} source={option.source} />
        <p>{formatPlayerFacingText(option.summary, "No class summary is available.")}</p>
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
        <DetailHeader eyebrow="Species" title="Choose a species" />
        <p>Select a species to see its original reference artwork, source description, physical profile, lineage choices, and innate features.</p>
        <div className="npc-forge-context-note">Species establishes ancestry and innate traits only. Background and class remain separate decisions.</div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="npc-forge-context-card is-origin">
        <DetailHeader eyebrow="Background" title="Choose a formative background" />
        <p>Select a background to read the life story it suggests, along with trained skills, tools, origin feat, and useful campaign hooks.</p>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="npc-forge-context-card is-class">
        <DetailHeader eyebrow="Class" title={selectedClass?.class_name || "Choose a class"} />
        <p>Choose a class to inspect hit dice, primary abilities, saving throws, spellcasting, and rules source.</p>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="npc-forge-context-card is-ability">
        <DetailHeader eyebrow="Ability Scores" title="Roll, then allocate" />
        <p>Each rolled score uses 4d6 and discards the lowest die. Six totals are produced, then each total is assigned to one ability.</p>
        <div className="npc-forge-context-ability-list">{ABILITY_KEYS.map((key) => <div key={key}><strong>{ABILITY_LABELS[key]}</strong><span>{ABILITY_DESCRIPTIONS[key]}</span></div>)}</div>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="npc-forge-context-card is-training">
        <DetailHeader eyebrow="Training" title="Skills and professions" />
        <p>Select a skill or profession on the left to see what it governs and how it contributes to the sheet.</p>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="npc-forge-context-card is-story">
        <DetailHeader eyebrow="Characterization" title="Build useful campaign hooks" />
        <p>Write details players can perceive first, then private motivations, bonds, flaws, and secrets. Concise entries are easier to use during play.</p>
        <div className="npc-forge-context-ability-list"><div><strong>Description</strong><span>What players see immediately.</span></div><div><strong>Motivation</strong><span>What the NPC wants right now.</span></div><div><strong>Bond</strong><span>Who or what they will protect.</span></div><div><strong>Secret</strong><span>Information the party can uncover.</span></div></div>
      </div>
    );
  }

  if (step === 6) {
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
