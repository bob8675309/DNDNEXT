import assert from "node:assert/strict";
import fs from "node:fs";
import { referenceTagBoundarySpacing } from "../utils/sourceRuleTextSpacing.js";
import { formatPlayerFacingText } from "../utils/playerFacingText.js";

const tag=/\{@(?:condition|creature|quickref|action)\s+([^}]+)\}/gi;
function renderAccessibleProse(raw) {
  const nodes=[];
  let cursor=0;
  for(const match of raw.matchAll(tag)) {
    const text=formatPlayerFacingText(raw.slice(cursor,match.index),"");
    if(text)nodes.push(text);
    const space=referenceTagBoundarySpacing(raw,match.index,match[0].length);
    if(space.before && nodes.at(-1)!==" ")nodes.push(" ");
    nodes.push(match[1].split("|")[0].trim());
    if(space.after)nodes.push(" ");
    cursor=match.index+match[0].length;
  }
  const tail=formatPlayerFacingText(raw.slice(cursor),"");
  if(tail)nodes.push(tail);
  return nodes.join("");
}
for(const [input,output] of [
  ["The target has the {@condition Prone} condition.","The target has the Prone condition."],
  ["The target has the{@condition Prone}condition.","The target has the Prone condition."],
  ["The target has the {@condition Prone}condition.","The target has the Prone condition."],
  ["The target has the{@condition Prone} condition.","The target has the Prone condition."],
  ["The {@condition Prone}, {@condition Incapacitated}, and {@condition Charmed} conditions.","The Prone, Incapacitated, and Charmed conditions."],
  ["A {@action Attack}action follows.","A Attack action follows."],
  ["They have {@condition Prone} {@condition Incapacitated} effects.","They have Prone Incapacitated effects."],
  ["({@condition Prone}) and [{@condition Stunned}].","(Prone) and [Stunned]."],
  ["{@condition Prone}. The target stands.","Prone. The target stands."],
  ["Has {@quickref Opportunity Attack|XPHB} now.","Has Opportunity Attack now."],
]) assert.equal(renderAccessibleProse(input),output,input);
const source=fs.readFileSync("components/SourceRuleContent.js","utf8");
assert.match(source,/referenceTagBoundarySpacing\(raw, match\.index, match\[0\]\.length\)/);
assert.match(source,/if \(boundary\.before && nodes\[nodes\.length - 1\] !== " "\) nodes\.push\(" "\)/);
assert.match(source,/if \(boundary\.after\) nodes\.push\(" "\)/);
console.log("Inline condition/action/quickref word boundaries and punctuation validated.");
