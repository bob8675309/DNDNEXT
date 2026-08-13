import {
  equipmentCategoryLabel,
  equipmentChoiceKey,
  equipmentPartCategory,
  equipmentPartLabel,
  equipmentPartNeedsChoice,
  formatCopper,
  higherLevelWealthRule,
  magicAllowanceLabel,
  normalizeEquipmentOptions,
  startingCurrencyCopper,
} from "../utils/playerForgeStartingEquipment";

function safeText(value) {
  return String(value ?? "").trim();
}

function selectedOption(options = [], key = "") {
  return options.find((option) => option.key === safeText(key).toUpperCase()) || options[0] || null;
}

function categoryOptions(model, part) {
  const byKey = new Map();
  for (const category of equipmentPartCategory(part)) {
    for (const item of Array.isArray(model?.choiceOptions?.[category]) ? model.choiceOptions[category] : []) {
      if (item?.itemKey && !byKey.has(item.itemKey)) byKey.set(item.itemKey, { ...item, category });
    }
  }
  return [...byKey.values()].sort((a, b) => safeText(a.name).localeCompare(safeText(b.name)));
}

function PackageOption({ scope, option, model, selection, active, onSelect, onChoice }) {
  return <div className={`npc-forge-equipment-option ${active ? "is-active" : ""}`}>
    <button type="button" className="npc-forge-equipment-option__pick" onClick={onSelect}>
      <span>Package {option.key}</span>
      <strong>{option.parts.some((part) => Number.isFinite(Number(part?.value))) ? "Source package" : "Equipment package"}</strong>
    </button>
    {active ? <div className="npc-forge-equipment-parts">
      {option.parts.map((part, index) => {
        const categories = equipmentPartCategory(part);
        const choiceKey = equipmentChoiceKey(scope, option.key, index);
        const options = categoryOptions(model, part);
        return <div key={`${option.key}-${index}`} className="npc-forge-equipment-part">
          <span>{equipmentPartLabel(part)}</span>
          {equipmentPartNeedsChoice(part) ? <label>
            <small>{categories.map(equipmentCategoryLabel).join(" or ")}</small>
            <select value={selection?.choices?.[choiceKey] || ""} onChange={(event) => onChoice(choiceKey, event.target.value)}>
              <option value="">Choose source-legal item…</option>
              {options.map((item) => <option key={item.itemKey} value={item.itemKey}>{item.name} • {item.source || "Source"}</option>)}
            </select>
          </label> : null}
        </div>;
      })}
    </div> : null}
  </div>;
}

function PackageGroup({ title, sourceLabel, scope, rawOptions, model, selection, selectedKey, onChange }) {
  const options = normalizeEquipmentOptions(rawOptions);
  if (!options.length) return <section className="npc-forge-equipment-group"><header><div><span>{title}</span><strong>{sourceLabel || "No imported source package"}</strong></div></header><p className="npc-forge-equipment-note">No structured starting-equipment package is imported for this source. The Forge will not invent gear.</p></section>;
  return <section className="npc-forge-equipment-group">
    <header><div><span>{title}</span><strong>{sourceLabel}</strong></div><small>Choose one source package.</small></header>
    <div className="npc-forge-equipment-options">{options.map((option) => <PackageOption
      key={option.key}
      scope={scope}
      option={option}
      model={model}
      selection={selection}
      active={option.key === selectedKey}
      onSelect={() => onChange({ ...selection, [scope === "class" ? "classOption" : "backgroundOption"]: option.key })}
      onChoice={(choiceKey, value) => onChange({ ...selection, choices: { ...(selection?.choices || {}), [choiceKey]: value } })}
    />)}</div>
  </section>;
}

export default function NpcForgeEquipmentStep({ model, selection = {}, onChange }) {
  if (!model || model.loading) return <div className="npc-forge-body npc-forge-step-equipment is-player-mode"><section className="npc-forge-workspace"><div className="npc-forge-section"><div className="npc-forge-section-heading"><div><span>Equipment</span><h3>Loading source-backed starting equipment…</h3></div></div></div></section></div>;
  if (!model.catalogReady) return <div className="npc-forge-body npc-forge-step-equipment is-player-mode"><section className="npc-forge-workspace"><div className="npc-forge-catalog-warning">{model.error || "Source-backed starting equipment is unavailable."}</div></section></div>;

  const classOptions = normalizeEquipmentOptions(model.classOptions);
  const backgroundOptions = normalizeEquipmentOptions(model.backgroundOptions);
  const classOption = selectedOption(classOptions, selection.classOption);
  const backgroundOption = selectedOption(backgroundOptions, selection.backgroundOption);
  const rule = higherLevelWealthRule(model.level);
  const totalCopper = startingCurrencyCopper(model, selection);

  return <div className="npc-forge-body npc-forge-step-equipment is-player-mode">
    <section className="npc-forge-workspace">
      <div className="npc-forge-section">
        <div className="npc-forge-section-heading"><div><span>Equipment</span><h3>Starting gear & character currency</h3></div><p>Normal class and Background equipment remain the base at every starting level.</p></div>
        <div className="npc-forge-workspace-note mb-3">Items selected here become canonical character-scoped inventory. They start unequipped so the existing inventory/equipment system remains the only authority for AC, attacks, and other equipment-derived effects.</div>
        <div className="npc-forge-equipment-layout">
          <PackageGroup title="Class package" sourceLabel={[model.className, model.classSource].filter(Boolean).join(" • ")} scope="class" rawOptions={model.classOptions} model={model} selection={selection} selectedKey={classOption?.key || ""} onChange={onChange} />
          <PackageGroup title="Background package" sourceLabel={[model.backgroundName, model.backgroundSource].filter(Boolean).join(" • ")} scope="background" rawOptions={model.backgroundOptions} model={model} selection={selection} selectedKey={backgroundOption?.key || ""} onChange={onChange} />
        </div>
        <section className="npc-forge-equipment-wealth mt-3">
          <header><div><span>Starting wealth</span><strong>Level {model.level}</strong></div><b>{formatCopper(totalCopper)}</b></header>
          {rule.rollRequired ? <div className="npc-forge-equipment-roll"><p>Higher-level creation adds {rule.baseGp.toLocaleString()} gp + 1d10 × {rule.multiplierGp.toLocaleString()} gp to the normal package currency.</p><button type="button" onClick={() => onChange({ ...selection, wealthRoll: 1 + Math.floor(Math.random() * 10) })}>Roll 1d10 Starting Wealth</button><strong>{selection.wealthRoll ? `d10 = ${selection.wealthRoll}` : "Roll required"}</strong></div> : <p className="npc-forge-equipment-note">No extra cash roll is added below level 5; normal class and Background package currency still applies.</p>}
        </section>
      </div>
    </section>
    <aside className="npc-forge-preview npc-forge-context-panel">
      <div className="npc-forge-context-card"><div className="npc-forge-context-header"><span>Creation summary</span><h4>Equipment authority</h4></div><dl className="npc-forge-equipment-summary"><div><dt>Class</dt><dd>Package {classOption?.key || "—"}</dd></div><div><dt>Background</dt><dd>Package {backgroundOption?.key || "—"}</dd></div><div><dt>Currency</dt><dd>{formatCopper(totalCopper)}</dd></div><div><dt>Higher-level magic</dt><dd>{magicAllowanceLabel(model.level)}</dd></div></dl><p className="npc-forge-equipment-note"><strong>DM guide only:</strong> the higher-level magic-item allowance is recorded for review but is not randomly or automatically granted by the Forge.</p></div>
    </aside>
    <style jsx global>{`
      .npc-forge-body.npc-forge-step-equipment{grid-template-columns:minmax(0,72fr) minmax(300px,28fr)}.npc-forge-equipment-layout{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.npc-forge-equipment-group{display:grid;align-content:start;gap:10px;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:rgba(255,255,255,.025)}.npc-forge-equipment-group>header,.npc-forge-equipment-wealth>header{display:flex;justify-content:space-between;gap:10px;align-items:center}.npc-forge-equipment-group>header>div,.npc-forge-equipment-wealth>header>div{display:grid;gap:2px}.npc-forge-equipment-group header span,.npc-forge-equipment-wealth header span{color:#d7bfff;font-size:.61rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.npc-forge-equipment-group header strong,.npc-forge-equipment-wealth header strong{color:#fff;font-size:.77rem}.npc-forge-equipment-group header small{color:rgba(255,255,255,.5);font-size:.62rem}.npc-forge-equipment-options{display:grid;gap:8px}.npc-forge-equipment-option{border:1px solid rgba(255,255,255,.09);border-radius:9px;background:rgba(8,10,18,.3);overflow:hidden}.npc-forge-equipment-option.is-active{border-color:rgba(168,108,255,.62);background:rgba(126,72,199,.09)}.npc-forge-equipment-option__pick{width:100%;display:flex;justify-content:space-between;gap:10px;padding:9px 10px;border:0;background:transparent;color:#fff;text-align:left}.npc-forge-equipment-option__pick span{color:#eadfff;font-weight:800}.npc-forge-equipment-option__pick strong{font-size:.64rem;color:rgba(255,255,255,.52)}.npc-forge-equipment-parts{display:grid;gap:6px;padding:0 9px 9px}.npc-forge-equipment-part{display:grid;gap:4px;padding:7px 8px;border-radius:7px;background:rgba(255,255,255,.035);color:rgba(255,255,255,.78);font-size:.68rem}.npc-forge-equipment-part label{display:grid;gap:3px}.npc-forge-equipment-part small,.npc-forge-equipment-note{color:rgba(255,255,255,.58);font-size:.64rem;line-height:1.45}.npc-forge-equipment-part select{width:100%;padding:6px 7px;border:1px solid rgba(255,255,255,.15);border-radius:7px;background:#10131d;color:#fff;font-size:.68rem}.npc-forge-equipment-wealth{display:grid;gap:9px;padding:12px;border:1px solid rgba(88,214,199,.2);border-radius:11px;background:rgba(88,214,199,.05)}.npc-forge-equipment-wealth header>b{color:#9ff8ec}.npc-forge-equipment-roll{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center}.npc-forge-equipment-roll p{margin:0;color:rgba(255,255,255,.65);font-size:.68rem}.npc-forge-equipment-roll button{padding:7px 10px;border:1px solid rgba(88,214,199,.42);border-radius:8px;background:rgba(42,136,124,.12);color:#c9fff7;font-size:.68rem}.npc-forge-equipment-roll strong{color:#fff3ce;font-size:.72rem}.npc-forge-equipment-summary{display:grid;gap:7px;margin:10px 0}.npc-forge-equipment-summary>div{display:grid;grid-template-columns:90px minmax(0,1fr);gap:8px}.npc-forge-equipment-summary dt{color:rgba(255,255,255,.48);font-size:.61rem;text-transform:uppercase}.npc-forge-equipment-summary dd{margin:0;color:#fff;font-size:.7rem}@media(max-width:980px){.npc-forge-body.npc-forge-step-equipment,.npc-forge-equipment-layout{grid-template-columns:1fr}.npc-forge-equipment-roll{grid-template-columns:1fr}.npc-forge-equipment-roll button{justify-self:start}}
    `}</style>
  </div>;
}
