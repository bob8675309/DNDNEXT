import assert from "node:assert/strict";
import { buildSpeciesSourceChoiceGroups } from "../utils/playerForgeSpeciesChoices.js";

const animalEnhancement = {
  name: "Animal Enhancement",
  entries: [
    "Your body has been altered to incorporate certain animal characteristics. You choose one animal enhancement now and a second enhancement at 5th level.",
    {
      type: "list",
      items: [
        { type: "item", name: "Manta Glide", entries: ["You have ray-like fins that you can use as wings to slow your fall or allow you to glide."] },
        { type: "item", name: "Nimble Climber", entries: ["You have a climbing speed equal to your walking speed."] },
        { type: "item", name: "Underwater Adaptation", entries: ["You can breathe air and water, and you have a swimming speed equal to your walking speed."] },
      ],
    },
    {
      type: "list",
      items: [
        { type: "item", name: "Grappling Appendages", entries: ["You have two special appendages growing alongside your arms that can be used to grapple creatures."] },
        { type: "item", name: "Carapace", entries: ["Your skin in places is covered by a thick shell. You gain a +1 bonus to AC when you aren't wearing heavy armor."] },
        { type: "item", name: "Acid Spit", entries: ["As an action, you can spray acid from glands in your mouth, targeting one creature or object you can see within 30 feet of you."] },
      ],
    },
  ],
};

const species = { name: "Simic Hybrid", source: "GGR", metadata: { traits: [animalEnhancement] } };
const level1 = buildSpeciesSourceChoiceGroups({ species, level: 1 });
const level5 = buildSpeciesSourceChoiceGroups({ species, level: 5 });
const group1 = level1.find((group) => group.label === "Animal Enhancement");
const group5 = level5.find((group) => group.label === "Animal Enhancement");
assert.ok(group1, "Simic Hybrid must expose Animal Enhancement at level 1");
assert.ok(group5, "Simic Hybrid must expose Animal Enhancement at level 5");
const first = group1.fields.find((field) => field.id === "level-1-enhancement");
const later = group5.fields.find((field) => field.id === "level-5-enhancement");
assert.deepEqual(first.options.map((option) => option.label), ["Manta Glide", "Nimble Climber", "Underwater Adaptation"], "level-1 Animal Enhancement keys/order must remain source-backed");
assert.ok(first.options.every((option) => option.description.length > 20), "every level-1 Animal Enhancement option must retain its source description");
assert.ok(first.options.every((option) => option.metadata?.sourceItem), "level-1 Animal Enhancement options must retain rich source-item metadata");
assert.deepEqual(later.options.map((option) => option.label), ["Manta Glide", "Nimble Climber", "Underwater Adaptation", "Grappling Appendages", "Carapace", "Acid Spit"], "level-5 choice pool must retain both source lists without duplicate keys");
assert.ok(later.options.every((option) => option.description.length > 20), "every level-5 Animal Enhancement option must retain its source description");
assert.equal(later.distinctFromFieldId, "level-1-enhancement", "the level-5 pick must remain distinct from the level-1 pick");

console.log("Simic Hybrid Animal Enhancement descriptions validated without changing choice keys, level gates, or distinct-choice authority.");
