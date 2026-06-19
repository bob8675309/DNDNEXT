import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const itemsPath = path.join(process.cwd(), "pages", "items.js");
let source = fs.readFileSync(itemsPath, "utf8");
let changed = false;

const beforeError = '  const crafterQueryError = requestedCrafterId && !requestedCrafter ? "The requested crafter could not be loaded." : "";';
const afterError = '  const crafterQueryError = requestedCrafterId && !loading && !requestedCrafter ? "The requested crafter could not be loaded. Please go back to town and open the workshop again." : "";';
if (source.includes(beforeError)) {
  source = replaceOnce(source, beforeError, afterError, "defer crafter load error until data settles");
  changed = true;
}

const providerBefore = [
  '          <div className="craft-kicker">NPC-Assisted Workshop</div>',
  '          <h3>Working with {crafterContext.character.name}</h3>',
  '          <p>{crafterContext.character.role || crafterContext.character.affiliation || "Town crafter"}</p>',
  '        </div>',
  '        <span className={cls("craft-status-pill", providerValid ? "known" : "danger")}>{providerValid ? "Profession ready" : "Configuration required"}</span>'
].join('\n');
const providerAfter = [
  '          <div className="craft-kicker">Crafter\'s Counter</div>',
  '          <h3>Commission work from {crafterContext.character.name}</h3>',
  '          <p>{crafterContext.character.role || crafterContext.character.affiliation || "Town crafter"} • The crafter handles the skill check; you choose the job and materials.</p>',
  '        </div>',
  '        <span className={cls("craft-status-pill", providerValid ? "known" : "danger")}>{providerValid ? "Ready for commission" : "Service unavailable"}</span>'
].join('\n');
if (source.includes(providerBefore)) {
  source = replaceOnce(source, providerBefore, providerAfter, "customer-facing crafter heading");
  changed = true;
}

const unavailableBefore = '      {!providerOffersRequestedProfession ? <div className="craft-plan-alert danger">This NPC does not offer {recipe.discipline}.</div> : null}';
const unavailableAfter = '      {!providerOffersRequestedProfession ? <div className="craft-plan-alert danger">This crafter does not currently offer {recipe.discipline} commissions.</div> : null}';
if (source.includes(unavailableBefore)) {
  source = replaceOnce(source, unavailableBefore, unavailableAfter, "customer-facing unavailable copy");
  changed = true;
}

if (changed) {
  fs.writeFileSync(itemsPath, source, "utf8");
  console.log("Applied customer-facing crafter shop presentation patch.");
} else {
  console.log("Crafter shop presentation already current.");
}

for (const token of [
  "!loading && !requestedCrafter",
  "Crafter's Counter",
  "Ready for commission",
  "does not currently offer",
]) {
  if (!source.includes(token)) throw new Error(`Crafter shop presentation validation failed: ${token}`);
}
