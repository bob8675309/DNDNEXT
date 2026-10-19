import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  buildPrintableCharacterSheetModel,
  formatPrintableModifier,
} from "../utils/printableCharacterSheet";
import styles from "../styles/PrintableCharacterSheet.module.css";

function valueOrDash(value) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function modeMark(mode) {
  if (mode === "adv") return "A";
  if (mode === "dis") return "D";
  return "";
}

function Section({ title, children, className = "" }) {
  return (
    <section className={[styles.section, className].filter(Boolean).join(" ")}>
      <h2>{title}</h2>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function TextField({ label, value, wide = false }) {
  if (!String(value ?? "").trim()) return null;
  return (
    <div className={wide ? styles.textFieldWide : styles.textField}>
      <strong>{label}</strong>
      <div>{value}</div>
    </div>
  );
}

function CompactList({ values = [] }) {
  const rows = (Array.isArray(values) ? values : []).filter(Boolean);
  if (!rows.length) return <span className={styles.muted}>—</span>;
  return <span>{rows.join(", ")}</span>;
}

function PrintableHeader({ model }) {
  const profile = model.profile;
  const identity = [
    profile.species,
    profile.lineage,
    profile.size,
    profile.alignment,
    profile.className ? `${profile.className}${profile.subclass ? ` — ${profile.subclass}` : ""}${profile.level ? ` ${profile.level}` : ""}` : "",
    profile.background,
  ].filter(Boolean);

  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        {profile.portraitUrl ? (
          <img className={styles.portrait} src={profile.portraitUrl} alt="" />
        ) : (
          <div className={styles.portraitPlaceholder} aria-hidden="true" />
        )}
        <div className={styles.identityCopy}>
          <div className={styles.kicker}>DNDNext Character Sheet</div>
          <h1>{profile.name}</h1>
          <div className={styles.identityLine}>{identity.join(" • ") || "Character"}</div>
          <div className={styles.identityLineSecondary}>
            {[profile.role, profile.affiliation, profile.location, profile.status].filter(Boolean).join(" • ")}
          </div>
        </div>
      </div>
      <div className={styles.headerFacts}>
        <div><span>Level</span><strong>{profile.level || "—"}</strong></div>
        <div><span>XP</span><strong>{model.xp == null ? "—" : model.xpNext == null ? model.xp : `${model.xp}/${model.xpNext}`}</strong></div>
        <div><span>Hit Dice</span><strong>{valueOrDash(model.hp.hitDice)}</strong></div>
      </div>
    </header>
  );
}

function CombatSummary({ model }) {
  const cards = [
    ["Armor Class", model.armorClass],
    ["Hit Points", `${model.hp.current}/${model.hp.max || "—"}${model.hp.temp ? ` (+${model.hp.temp} temp)` : ""}`],
    ["Speed", model.speed],
    ["Initiative", formatPrintableModifier(model.initiative)],
    ["Proficiency", formatPrintableModifier(model.proficiencyBonus)],
    ["Passive Perception", model.passivePerception],
  ];
  return (
    <div className={styles.combatGrid}>
      {cards.map(([label, value]) => (
        <div className={styles.combatCard} key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function AbilityBlock({ model }) {
  return (
    <div className={styles.abilityGrid}>
      {model.abilities.map((ability) => (
        <div className={styles.abilityCard} key={ability.key}>
          <span>{ability.short}</span>
          <strong>{ability.score}</strong>
          <b>{formatPrintableModifier(ability.modifier)}</b>
          <small>
            Save {ability.saveProficient ? "●" : "○"} {formatPrintableModifier(ability.saveModifier)}
            {modeMark(ability.saveMode) ? ` ${modeMark(ability.saveMode)}` : ""}
          </small>
        </div>
      ))}
    </div>
  );
}

function Skills({ model }) {
  return (
    <div className={styles.skillGrid}>
      {model.skills.map((skill) => (
        <div className={styles.skillRow} key={skill.key}>
          <span className={styles.profMark}>{skill.expertise ? "◆" : skill.proficient ? "●" : "○"}</span>
          <span className={styles.skillName}>{skill.name}</span>
          <span className={styles.skillAbility}>{skill.ability.toUpperCase()}</span>
          <strong>{formatPrintableModifier(skill.modifier)}</strong>
          <span className={styles.modeMark}>{modeMark(skill.mode)}</span>
        </div>
      ))}
    </div>
  );
}

function Actions({ model }) {
  if (!model.actions.length && !model.legacy.attacks) {
    return <div className={styles.muted}>No attacks or actions are recorded.</div>;
  }
  const groups = new Map();
  for (const action of model.actions) {
    const group = action.group || "Actions";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(action);
  }
  return (
    <div className={styles.actionGroups}>
      {[...groups.entries()].map(([group, rows]) => (
        <div className={styles.actionGroup} key={group}>
          <h3>{group}</h3>
          {rows.map((action) => (
            <div className={styles.actionRow} key={action.id || `${group}-${action.label}`}>
              <div className={styles.actionHead}>
                <strong>{action.label}</strong>
                <span>
                  {action.statusLabel || ""}
                  {action.attackBonus != null ? ` • Attack ${formatPrintableModifier(action.attackBonus)}` : ""}
                  {action.saveDc != null ? ` • DC ${action.saveDc}${action.saveAbilities.length ? ` ${action.saveAbilities.join("/")}` : ""}` : ""}
                </span>
              </div>
              <div className={styles.actionText}>
                {[action.damage ? `${action.damage}${action.damageType ? ` ${action.damageType}` : ""}` : "", action.healing ? `${action.healing} healing` : "", action.summary, action.detail]
                  .filter(Boolean)
                  .join(" • ")}
              </div>
            </div>
          ))}
        </div>
      ))}
      {model.legacy.attacks ? <div className={styles.legacyText}><strong>Additional attacks:</strong> {model.legacy.attacks}</div> : null}
    </div>
  );
}

function Features({ model }) {
  if (!model.features.length && !model.legacy.featsTraits) return <div className={styles.muted}>No resolved features are recorded.</div>;
  return (
    <div className={styles.featureList}>
      {model.features.map((feature) => (
        <article className={styles.feature} key={feature.id || `${feature.category}-${feature.name}`}>
          <div className={styles.featureHead}>
            <strong>{feature.name}</strong>
            <span>{[feature.category, feature.level != null ? `Level ${feature.level}` : "", feature.origin, feature.source].filter(Boolean).join(" • ")}</span>
          </div>
          {feature.description ? <p>{feature.description}</p> : null}
        </article>
      ))}
      {!model.features.length && model.legacy.featsTraits ? <div className={styles.legacyText}>{model.legacy.featsTraits}</div> : null}
    </div>
  );
}

function Spellbook({ model }) {
  if (!model.spells.length && !model.legacy.spells) return <div className={styles.muted}>No spells are recorded.</div>;
  return (
    <div className={styles.spellList}>
      {model.spells.map((spell) => (
        <article className={styles.spell} key={spell.id || spell.name}>
          <div className={styles.spellHead}>
            <strong>{spell.name}</strong>
            <span>{spell.levelLabel}{spell.prepared ? " • Prepared" : ""}{spell.alwaysAvailable ? " • Always available" : ""}</span>
          </div>
          <div className={styles.spellMeta}>
            {[spell.castingTime, spell.range, spell.duration, spell.resource].filter(Boolean).join(" • ")}
          </div>
          <div className={styles.spellMeta}>
            {[spell.attackType, spell.saveAbilities.length ? `Save: ${spell.saveAbilities.join("/")}` : "", spell.damage ? `Damage: ${spell.damage}` : "", spell.healing ? `Healing: ${spell.healing}` : ""].filter(Boolean).join(" • ")}
          </div>
          {spell.description ? <p>{spell.description}</p> : null}
        </article>
      ))}
      {!model.spells.length && model.legacy.spells ? <div className={styles.legacyText}>{model.legacy.spells}</div> : null}
    </div>
  );
}

function Inventory({ model }) {
  if (!model.inventory.length && !model.legacy.equipment && !model.legacy.treasure) return <div className={styles.muted}>No inventory is recorded.</div>;
  return (
    <div>
      {model.inventory.length ? (
        <table className={styles.inventoryTable}>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>State</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {model.inventory.map((item) => (
              <tr key={item.id || item.name}>
                <td><strong>{item.name}</strong>{item.category ? <small>{item.category}</small> : null}</td>
                <td>{item.quantity}</td>
                <td>{item.equipped ? `Equipped${item.equipSlot ? ` — ${item.equipSlot}` : ""}` : ""}</td>
                <td>{item.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {model.equipmentBreakdown.length ? (
        <div className={styles.compactText}><strong>Equipment effects:</strong> {model.equipmentBreakdown.join(" • ")}</div>
      ) : null}
      {model.legacy.equipment ? <div className={styles.compactText}><strong>Legacy equipment:</strong> {model.legacy.equipment}</div> : null}
      {model.legacy.treasure ? <div className={styles.compactText}><strong>Treasure:</strong> {model.legacy.treasure}</div> : null}
    </div>
  );
}

function Narrative({ model }) {
  const p = model.profile;
  return (
    <div className={styles.narrativeGrid}>
      <TextField label="Description" value={p.description} wide />
      <TextField label="Appearance" value={p.appearance} />
      <TextField label="Background" value={p.background} />
      <TextField label="Motivation" value={p.motivation} />
      <TextField label="Traits" value={p.traits} />
      <TextField label="Ideals" value={p.ideals} />
      <TextField label="Bonds" value={p.bonds} />
      <TextField label="Flaws" value={p.flaws} />
      <TextField label="Quirk" value={p.quirk} />
      <TextField label="Mannerism" value={p.mannerism} />
      <TextField label="Voice" value={p.voice} />
      <TextField label="Secret" value={p.secret} wide />
      {p.tags.length ? <TextField label="Tags" value={p.tags.join(", ")} wide /> : null}
    </div>
  );
}

function Training({ model }) {
  return (
    <div className={styles.trainingGrid}>
      <div><strong>Languages</strong><CompactList values={model.languages} /></div>
      <div><strong>Tools</strong><CompactList values={model.tools} /></div>
      <div><strong>Weapons</strong><CompactList values={model.weapons} /></div>
      <div><strong>Armor</strong><CompactList values={model.armorProficiencies} /></div>
      {model.professions.length ? (
        <div className={styles.trainingWide}>
          <strong>Professions</strong>
          <span>{model.professions.map((entry) => `${entry.name} rank ${entry.rank}${entry.ability ? ` (${entry.ability})` : ""}`).join(", ")}</span>
        </div>
      ) : null}
    </div>
  );
}

function Notes({ model }) {
  if (!model.notes.length) return <div className={styles.muted}>No authorized notes are loaded for this character.</div>;
  return (
    <div className={styles.notes}>
      {model.notes.map((note) => (
        <article key={note.id || note.body}>
          <div>{note.body}</div>
          <small>{[note.scope, note.createdAt].filter(Boolean).join(" • ")}</small>
        </article>
      ))}
    </div>
  );
}

export default function PrintableCharacterSheet({
  open = false,
  onClose = null,
  sheet = {},
  profile = {},
  itemBonuses = null,
  inventoryItems = [],
  spellActions = [],
  featureRows = [],
  notes = [],
  locationLabel = "",
  equipmentBreakdown = [],
}) {
  const model = useMemo(() => buildPrintableCharacterSheetModel({
    sheet,
    profile,
    itemBonuses,
    inventoryItems,
    spellActions,
    featureRows,
    notes,
    locationLabel,
    equipmentBreakdown,
  }), [equipmentBreakdown, featureRows, inventoryItems, itemBonuses, locationLabel, notes, profile, sheet, spellActions]);

  useEffect(() => {
    if (!open || typeof window === "undefined" || typeof document === "undefined") return undefined;

    const body = document.body;
    let closed = false;
    let timer = null;
    const close = () => {
      if (closed) return;
      closed = true;
      body.classList.remove("printing-character-sheet");
      onClose?.();
    };
    const onAfterPrint = () => close();

    body.classList.add("printing-character-sheet");
    window.addEventListener("afterprint", onAfterPrint);
    timer = window.setTimeout(() => {
      try {
        window.print();
      } catch {
        close();
      }
    }, 120);

    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("afterprint", onAfterPrint);
      body.classList.remove("printing-character-sheet");
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.printPortal}>
      <main className={styles.sheet}>
        <PrintableHeader model={model} />
        <CombatSummary model={model} />

        <div className={styles.twoColumn}>
          <div>
            <Section title="Abilities & Saving Throws">
              <AbilityBlock model={model} />
            </Section>
            <Section title="Skills">
              <Skills model={model} />
            </Section>
          </div>
          <div>
            <Section title="Training & Proficiencies">
              <Training model={model} />
            </Section>
            <Section title="Attacks, Actions & Combat Options">
              <Actions model={model} />
            </Section>
          </div>
        </div>

        <div className={styles.pageBreak} />

        <div className={styles.twoColumn}>
          <div>
            <Section title="Features & Traits">
              <Features model={model} />
            </Section>
          </div>
          <div>
            <Section title="Spellbook">
              <Spellbook model={model} />
            </Section>
          </div>
        </div>

        <Section title="Inventory & Equipment">
          <Inventory model={model} />
        </Section>

        <Section title="Character Details">
          <Narrative model={model} />
        </Section>

        <Section title="Notes">
          <Notes model={model} />
        </Section>

        <footer className={styles.footer}>
          Printed from DNDNext • Values reflect the currently loaded character sheet and authorized character data.
        </footer>
      </main>
    </div>,
    document.body
  );
}
