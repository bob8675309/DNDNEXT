import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const target = path.join(process.cwd(), "pages", "items.js");
let source = fs.readFileSync(target, "utf8");

if (!source.includes("crafterCharacterId")) {
  source = replaceOnce(
    source,
    '  const [targetCharacterId, setTargetCharacterId] = useState("");',
    '  const [crafterCharacterId, setCrafterCharacterId] = useState("");\n  const [targetCharacterId, setTargetCharacterId] = useState("");',
    "self-crafter state"
  );

  source = replaceOnce(
    source,
    '    setSelectedMaterials({});\n    setTargetCharacterId("");',
    '    setSelectedMaterials({});\n    setCrafterCharacterId("");\n    setTargetCharacterId("");',
    "self-crafter reset"
  );

  source = replaceOnce(
    source,
    `  const professionKey = professionForDiscipline(recipe.discipline);
  const isNpcAssisted = Boolean(crafterContext?.character);
  const crafterSnapshot = isNpcAssisted && professionKey
    ? buildCrafterProfessionSnapshot(crafterContext.character, crafterContext.sheet || {}, professionKey)
    : null;
  const providerOffersRequestedProfession = !isNpcAssisted || providerOffersProfession(crafterContext.character, professionKey);
  const providerTownValid = !isNpcAssisted || crafterContext?.townValid !== false;
  const providerValid = !isNpcAssisted || Boolean(providerOffersRequestedProfession && providerTownValid && crafterSnapshot?.configured);
  const enteredCraftRoll = Number(craftRollTotal);
  const resolvedCraftRollTotal = isNpcAssisted && craftRollTotal !== ""
    ? enteredCraftRoll + Number(crafterSnapshot?.total_modifier || 0)
    : enteredCraftRoll;
  const effectiveCrafterProficiency = isNpcAssisted
    ? Number(crafterSnapshot?.proficiency_bonus || 0)
    : Number(crafterProficiency || 0);`,
    `  const professionKey = professionForDiscipline(recipe.discipline);
  const isNpcAssisted = Boolean(crafterContext?.character);
  const selfCrafterCandidates = characters.filter((character) => character?.kind === "player" || character?.target_type === "player");
  const selfCrafter = !isNpcAssisted
    ? selfCrafterCandidates.find((character) => String(character.id) === String(crafterCharacterId)) || null
    : null;
  const activeCrafterCharacter = isNpcAssisted ? crafterContext.character : selfCrafter;
  const activeCrafterSheet = isNpcAssisted ? crafterContext.sheet || {} : selfCrafter?.character_sheet || {};
  const crafterSnapshot = activeCrafterCharacter && professionKey
    ? buildCrafterProfessionSnapshot(activeCrafterCharacter, activeCrafterSheet, professionKey)
    : null;
  const providerOffersRequestedProfession = !isNpcAssisted || providerOffersProfession(crafterContext.character, professionKey);
  const providerTownValid = !isNpcAssisted || crafterContext?.townValid !== false;
  const providerValid = !isNpcAssisted || Boolean(providerOffersRequestedProfession && providerTownValid);
  const craftingActorValid = Boolean(activeCrafterCharacter && crafterSnapshot?.configured && providerValid);
  const enteredCraftRoll = Number(craftRollTotal);
  const resolvedCraftRollTotal = craftRollTotal !== ""
    ? enteredCraftRoll + Number(crafterSnapshot?.total_modifier || 0)
    : enteredCraftRoll;
  const effectiveCrafterProficiency = Number(crafterSnapshot?.proficiency_bonus || 0);`,
    "unified crafter resolver"
  );

  source = replaceOnce(
    source,
    `    const enteredRoll = Number(craftRollTotal);
    if (!Number.isFinite(enteredRoll) || enteredRoll < 1 || (isNpcAssisted && enteredRoll > 20)) {
      setPlanError(isNpcAssisted ? "Enter the raw d20 roll from 1 to 20. The NPC profession modifier is added automatically." : "Enter the completed d20 + modifiers total before submitting this craft attempt.");
      return;
    }
    if (isNpcAssisted && !providerOffersRequestedProfession) {`,
    `    const enteredRoll = Number(craftRollTotal);
    if (!Number.isFinite(enteredRoll) || enteredRoll < 1 || enteredRoll > 20) {
      setPlanError("Enter the raw d20 roll from 1 to 20. The selected crafter's Profession modifier is added automatically.");
      return;
    }
    if (!activeCrafterCharacter) {
      setPlanError("Choose the character performing this craft attempt.");
      return;
    }
    if (isNpcAssisted && !providerOffersRequestedProfession) {`,
    "unified raw roll validation"
  );

  source = replaceOnce(
    source,
    `    if (isNpcAssisted && !crafterSnapshot?.configured) {
      setPlanError("Profession not configured for this crafter.");
      return;
    }
    const requestedRollTotal = isNpcAssisted
      ? enteredRoll + Number(crafterSnapshot?.total_modifier || 0)
      : enteredRoll;`,
    `    if (!crafterSnapshot?.configured) {
      setPlanError("Profession not configured for this crafter.");
      return;
    }
    const requestedRollTotal = enteredRoll + Number(crafterSnapshot.total_modifier || 0);`,
    "unified profession validation"
  );

  source = source.replaceAll("craft_roll_input: isNpcAssisted ? enteredRoll : null", "craft_roll_input: enteredRoll");

  source = replaceOnce(
    source,
    `      {alchemyProductPreview?.saveDcPreview ? <div className="craft-bomb-save-controls">
        {!isNpcAssisted ? <label><span>Crafter Proficiency</span><input className="form-control craft-input" type="number" min="0" max="10" value={crafterProficiency} onChange={(event) => setCrafterProficiency(event.target.value)} /></label> : null}
        <label><span>{isNpcAssisted ? "Raw d20 Roll" : "Craft Roll Total"}</span><input className="form-control craft-input" type="number" min="1" max={isNpcAssisted ? 20 : 99} value={craftRollTotal} onChange={(event) => setCraftRollTotal(event.target.value)} placeholder={isNpcAssisted ? "1–20" : \`DC \${attemptPreview.final_dc} or higher\`} /></label>`,
    `      {alchemyProductPreview?.saveDcPreview ? <div className="craft-bomb-save-controls">
        <label><span>Raw d20 Roll</span><input className="form-control craft-input" type="number" min="1" max="20" value={craftRollTotal} onChange={(event) => setCraftRollTotal(event.target.value)} placeholder="1–20" /></label>`,
    "alchemy profession roll controls"
  );

  source = replaceOnce(
    source,
    `      <div className="craft-section-title">Create Craft Plan</div>
      <label className="small text-muted mb-1">Target Character</label>`,
    `      <div className="craft-section-title">Create Craft Plan</div>
      {!isNpcAssisted ? <>
        <label className="small text-muted mb-1">Crafting Character</label>
        <select className="form-select craft-input mb-2" value={crafterCharacterId} onChange={(event) => setCrafterCharacterId(event.target.value)}>
          <option value="">Choose who performs the craft</option>
          {selfCrafterCandidates.map((character) => (
            <option key={character.id} value={character.id}>{characterName(character)}</option>
          ))}
        </select>
      </> : null}
      <label className="small text-muted mb-1">Target Character</label>`,
    "self-crafter selector"
  );

  source = replaceOnce(
    source,
    `      <label className="small text-muted mb-1">{isNpcAssisted ? "Raw d20 Roll" : "Craft Roll Total"}</label>
      <input className="form-control craft-input" type="number" min="1" max={isNpcAssisted ? 20 : 99} value={craftRollTotal} onChange={(event) => setCraftRollTotal(event.target.value)} placeholder={isNpcAssisted ? "1–20" : "d20 + modifiers"} />
      <div className="craft-form-help">{isNpcAssisted ? crafterContext.character.name + " adds " + (crafterSnapshot?.total_modifier >= 0 ? "+" : "") + (crafterSnapshot?.total_modifier || 0) + " from " + (crafterSnapshot?.profession_label || "Profession") + ". Current resolved total: " + (Number.isFinite(resolvedCraftRollTotal) && craftRollTotal !== "" ? resolvedCraftRollTotal : "—") + "." : "Submit the completed check total. The admin review modal resolves it against DC " + attemptPreview.final_dc + "."}</div>`,
    `      <label className="small text-muted mb-1">Raw d20 Roll</label>
      <input className="form-control craft-input" type="number" min="1" max="20" value={craftRollTotal} onChange={(event) => setCraftRollTotal(event.target.value)} placeholder="1–20" />
      <div className="craft-form-help">{activeCrafterCharacter ? activeCrafterCharacter.name + " adds " + (crafterSnapshot?.total_modifier >= 0 ? "+" : "") + (crafterSnapshot?.total_modifier || 0) + " from " + (crafterSnapshot?.profession_label || "Profession") + ". Current resolved total: " + (Number.isFinite(resolvedCraftRollTotal) && craftRollTotal !== "" ? resolvedCraftRollTotal : "—") + "." : "Choose the crafting character; their Profession modifier will be added automatically."}</div>`,
    "unified craft roll input"
  );

  source = replaceOnce(
    source,
    `        {targetCharacter ? <span className="craft-chip craft-chip-blue">{characterName(targetCharacter)}</span> : <span className="craft-chip">No character</span>}`,
    `        {activeCrafterCharacter ? <span className="craft-chip craft-chip-green">Crafter: {characterName(activeCrafterCharacter)}</span> : <span className="craft-chip">No crafter</span>}
        {targetCharacter ? <span className="craft-chip craft-chip-blue">Recipient: {characterName(targetCharacter)}</span> : <span className="craft-chip">No recipient</span>}`,
    "crafter and recipient chips"
  );

  source = replaceOnce(
    source,
    `      <button type="button" className="btn btn-primary mt-2 craft-primary-action" onClick={submitPreviewCraftPlan} disabled={savingPlan || !craftRollTotal || !targetCharacterId || (isNpcAssisted && !providerValid)}>`,
    `      <button type="button" className="btn btn-primary mt-2 craft-primary-action" onClick={submitPreviewCraftPlan} disabled={savingPlan || !craftRollTotal || !targetCharacterId || !craftingActorValid}>`,
    "unified submit guard"
  );

  source = replaceOnce(
    source,
    `  const crafterContextBlock = isNpcAssisted ? (
    <div className={cls("craft-section", "craft-section-card", "craft-provider-card", \`craft-theme-\${workflowTheme}\`)}>
      <div className="craft-provider-head">
        <div>
          <div className="craft-kicker">NPC-Assisted Workshop</div>
          <h3>Working with {crafterContext.character.name}</h3>
          <p>{crafterContext.character.role || crafterContext.character.affiliation || "Town crafter"}</p>
        </div>
        <span className={cls("craft-status-pill", providerValid ? "known" : "danger")}>{providerValid ? "Profession ready" : "Configuration required"}</span>`,
    `  const crafterContextBlock = activeCrafterCharacter ? (
    <div className={cls("craft-section", "craft-section-card", "craft-provider-card", \`craft-theme-\${workflowTheme}\`)}>
      <div className="craft-provider-head">
        <div>
          <div className="craft-kicker">{isNpcAssisted ? "NPC-Assisted Workshop" : "Self-Crafting Profession"}</div>
          <h3>Working with {activeCrafterCharacter.name}</h3>
          <p>{activeCrafterCharacter.role || activeCrafterCharacter.affiliation || (isNpcAssisted ? "Town crafter" : "Player crafter")}</p>
        </div>
        <span className={cls("craft-status-pill", craftingActorValid ? "known" : "danger")}>{craftingActorValid ? "Profession ready" : "Configuration required"}</span>`,
    "unified crafter context card"
  );

  fs.writeFileSync(target, source, "utf8");
  console.log("Applied Profession-based self-crafting checks.");
} else {
  console.log("Profession-based self-crafting checks already present.");
}

for (const token of [
  "crafterCharacterId",
  "selfCrafterCandidates",
  "activeCrafterCharacter",
  "craftingActorValid",
  "Choose who performs the craft",
  "Crafter: {characterName(activeCrafterCharacter)}",
  "craft_roll_input: enteredRoll",
]) {
  if (!source.includes(token)) throw new Error(`Self-crafting profession validation failed: ${token}`);
}
