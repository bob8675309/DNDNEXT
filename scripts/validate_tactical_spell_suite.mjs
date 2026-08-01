import { spawnSync } from "node:child_process";

const validators = [
  "scripts/validate_tactical_spell_foundation.mjs",
  "scripts/validate_tactical_spell_casting.mjs",
  "scripts/validate_tactical_spell_ui.mjs",
  "scripts/validate_tactical_core_action_guides.mjs",
  "scripts/validate_tactical_turn_reconciliation.mjs",
  "scripts/validate_tactical_attack_result_ui.mjs",
  "scripts/validate_shared_equipment_effects_pipeline.mjs",
  "scripts/validate_character_sheet_rules.mjs",
  "scripts/validate_tactical_save_spell.mjs",
  "scripts/validate_tactical_save_spell_ui.mjs",
  "scripts/validate_tactical_toll_the_dead.mjs",
  "scripts/validate_tactical_toll_the_dead_ui.mjs",
  "scripts/validate_tactical_poison_spray.mjs",
  "scripts/validate_tactical_poison_spray_ui.mjs",
  "scripts/validate_tactical_false_life.mjs",
  "scripts/validate_tactical_false_life_ui.mjs",
  "scripts/validate_tactical_inflict_wounds.mjs",
  "scripts/validate_tactical_inflict_wounds_ui.mjs",
  "scripts/validate_tactical_shocking_grasp.mjs",
  "scripts/validate_tactical_shocking_grasp_ui.mjs",
  "scripts/validate_tactical_ray_of_frost.mjs",
  "scripts/validate_tactical_ray_of_frost_ui.mjs",
  "scripts/validate_tactical_chill_touch.mjs",
  "scripts/validate_tactical_chill_touch_ui.mjs",
  "scripts/validate_tactical_mind_sliver.mjs",
  "scripts/validate_tactical_mind_sliver_ui.mjs",
  "scripts/validate_tactical_word_of_radiance.mjs",
  "scripts/validate_tactical_word_of_radiance_ui.mjs",
  "scripts/validate_tactical_attack_roll_modifiers.mjs",
  "scripts/validate_tactical_guiding_bolt.mjs",
  "scripts/validate_tactical_guiding_bolt_ui.mjs",
  "scripts/validate_tactical_legacy_attack_spell_hardening.mjs",
  "scripts/validate_tactical_vicious_mockery.mjs",
  "scripts/validate_tactical_vicious_mockery_ui.mjs",
  "scripts/validate_tactical_healing_word.mjs",
  "scripts/validate_tactical_healing_word_ui.mjs",
  "scripts/validate_tactical_acid_splash.mjs",
  "scripts/validate_tactical_acid_splash_ui.mjs",
  "scripts/validate_tactical_magic_missile.mjs",
  "scripts/validate_tactical_magic_missile_ui.mjs",
  "scripts/validate_tactical_burning_hands.mjs",
  "scripts/validate_tactical_burning_hands_ui.mjs",
  "scripts/validate_tactical_lightning_bolt.mjs",
  "scripts/validate_tactical_lightning_bolt_ui.mjs",
];

for (const validator of validators) {
  console.log(`\n> node ${validator}`);
  const result = spawnSync(process.execPath, [validator], {
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log("\nTactical spell validator suite passed.");
