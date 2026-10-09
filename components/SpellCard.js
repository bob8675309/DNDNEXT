import React from "react";
import SourceRuleContent from "./SourceRuleContent";

const SCHOOL_ACCENTS = {
  Abjuration: "spell-school-abjuration",
  Conjuration: "spell-school-conjuration",
  Divination: "spell-school-divination",
  Enchantment: "spell-school-enchantment",
  Evocation: "spell-school-evocation",
  Illusion: "spell-school-illusion",
  Necromancy: "spell-school-necromancy",
  Transmutation: "spell-school-transmutation",
};

function levelLabel(level) {
  const numeric = Number(level || 0);
  return numeric === 0 ? "Cantrip" : `Level ${numeric}`;
}

function joinValues(values) {
  if (!Array.isArray(values)) return values || "—";
  return values.length ? values.join(", ") : "—";
}

function safeJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try { return JSON.parse(String(value)); } catch { return null; }
}

function scalingProfile(spell = {}) {
  const direct = spell?.raw_payload?.scalingLevelDice || safeJson(spell?.scaling_json) || safeJson(spell?.scaling_text);
  if (!direct || typeof direct !== "object" || !direct.scaling || typeof direct.scaling !== "object") return null;
  const rows = Object.entries(direct.scaling)
    .map(([level, value]) => ({ level: Number(level), value: String(value || "").trim() }))
    .filter((entry) => Number.isFinite(entry.level) && entry.value)
    .sort((a, b) => a.level - b.level);
  return rows.length ? { label: String(direct.label || "Effect").trim(), rows } : null;
}

function progressionEntries(spell = {}) {
  const entries = spell?.raw_payload?.entriesHigherLevel;
  return Array.isArray(entries) && entries.length ? entries : null;
}

export default function SpellCard({ spell, compact = false, dense = false, compressed = false, headerAction = null }) {
  if (!spell) return null;

  const school = spell.school || "Spell";
  const accent = SCHOOL_ACCENTS[school] || "spell-school-generic";
  const components = [
    spell.components_v ? "V" : null,
    spell.components_s ? "S" : null,
    spell.components_m ? `M${spell.material_text ? ` (${spell.material_text})` : ""}` : null,
  ].filter(Boolean).join(", ");
  const damageTypes = Array.isArray(spell.damage_types) ? spell.damage_types : [];
  const showDamage = Boolean(spell.damage_dice || damageTypes.length);
  const showArea = Boolean(spell.area_type);
  const ruleEntries = Array.isArray(spell?.raw_payload?.entries) && spell.raw_payload.entries.length
    ? spell.raw_payload.entries
    : null;
  const progression = progressionEntries(spell);
  const scaling = scalingProfile(spell);
  const progressionText = spell.higher_level_text || (!safeJson(spell.scaling_text) ? spell.scaling_text : "");
  const hasProgression = Boolean(progression || scaling || progressionText);

  return (
    <article className={`spell-card ${accent} ${compact ? "spell-card--compact" : ""} ${dense ? "spell-card--dense" : ""} ${compressed ? "spell-card--compressed" : ""}`}>
      <header className="spell-card__header">
        <div>
          <div className="spell-card__eyebrow">{levelLabel(spell.level)} • {school}</div>
          <h3 className="spell-card__title">{spell.name}</h3>
        </div>
        <div className="spell-card__header-actions">
          <div className="spell-card__source">{spell.source || "—"}</div>
          {headerAction ? <div className="spell-card__header-action">{headerAction}</div> : null}
        </div>
      </header>

      <div className="spell-card__badges">
        {spell.concentration ? <span>Concentration</span> : null}
        {spell.ritual ? <span>Ritual</span> : null}
        {spell.attack_type ? <span>{spell.attack_type}</span> : null}
        {Array.isArray(spell.saving_throw_abilities) && spell.saving_throw_abilities.length ? <span>Save: {spell.saving_throw_abilities.join(" / ")}</span> : null}
      </div>

      <dl className="spell-card__grid">
        <div><dt>Casting Time</dt><dd>{spell.casting_time || "—"}</dd></div>
        <div><dt>Range</dt><dd>{spell.range_text || "—"}</dd></div>
        <div><dt>Components</dt><dd>{components || "—"}</dd></div>
        <div><dt>Duration</dt><dd>{spell.duration_text || "—"}</dd></div>
        {!dense || showDamage ? <div><dt>Damage</dt><dd>{spell.damage_dice || "—"} {joinValues(spell.damage_types)}</dd></div> : null}
        {!dense || showArea ? <div><dt>Area</dt><dd>{spell.area_type ? `${spell.area_size || ""} ${spell.area_unit || ""} ${spell.area_type}`.trim() : "—"}</dd></div> : null}
      </dl>

      <div className="spell-card__body">
        {ruleEntries || spell.description ? <section className="spell-card__description">
          <SourceRuleContent entries={ruleEntries} text={spell.description || ""} />
        </section> : null}

        {hasProgression ? <details className="spell-card__higher spell-card__progression">
          <summary><span>Spell Progression</span><small>Higher-level effects and scaling</small></summary>
          <div className="spell-card__progression-body">
            {scaling ? <div className="spell-card__scaling-table" role="table" aria-label={`${spell.name} progression`}>
              <div role="row" className="spell-card__scaling-head"><span role="columnheader">Character level</span><span role="columnheader">{scaling.label}</span></div>
              {scaling.rows.map((entry) => <div role="row" key={entry.level}><span role="cell">{entry.level}</span><strong role="cell">{entry.value}</strong></div>)}
            </div> : null}
            {progression || progressionText ? <SourceRuleContent entries={progression} text={progressionText || ""} /> : null}
          </div>
        </details> : null}

        <footer className="spell-card__footer">
          <span>Classes: {joinValues(spell.classes)}</span>
          {spell.page ? <span>p. {spell.page}</span> : null}
        </footer>
      </div>
    </article>
  );
}
