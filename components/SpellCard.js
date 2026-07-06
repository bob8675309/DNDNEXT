import React from "react";

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

export default function SpellCard({ spell, compact = false }) {
  if (!spell) return null;

  const school = spell.school || "Spell";
  const accent = SCHOOL_ACCENTS[school] || "spell-school-generic";
  const components = [
    spell.components_v ? "V" : null,
    spell.components_s ? "S" : null,
    spell.components_m ? `M${spell.material_text ? ` (${spell.material_text})` : ""}` : null,
  ].filter(Boolean).join(", ");

  return (
    <article className={`spell-card ${accent} ${compact ? "spell-card--compact" : ""}`}>
      <header className="spell-card__header">
        <div>
          <div className="spell-card__eyebrow">{levelLabel(spell.level)} • {school}</div>
          <h3 className="spell-card__title">{spell.name}</h3>
        </div>
        <div className="spell-card__source">{spell.source || "—"}</div>
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
        <div><dt>Damage</dt><dd>{spell.damage_dice || "—"} {joinValues(spell.damage_types)}</dd></div>
        <div><dt>Area</dt><dd>{spell.area_type ? `${spell.area_size || ""} ${spell.area_unit || ""} ${spell.area_type}`.trim() : "—"}</dd></div>
      </dl>

      {spell.description ? <p className="spell-card__description">{spell.description}</p> : null}
      {spell.higher_level_text ? <section className="spell-card__higher"><strong>At Higher Levels.</strong> {spell.higher_level_text}</section> : null}

      <footer className="spell-card__footer">
        <span>Classes: {joinValues(spell.classes)}</span>
        {spell.page ? <span>p. {spell.page}</span> : null}
      </footer>
    </article>
  );
}
