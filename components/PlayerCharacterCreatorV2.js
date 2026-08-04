import NewNpcModalV3 from "./NewNpcModalV3";

/**
 * Player creation now uses the same canonical Forge implementation as NPC creation.
 * The shared component keeps one layout, one catalog workflow, and one set of
 * responsive fixes while its guarded player mode uses player ownership RPCs.
 *
 * Compatibility markers for the pre-consolidation progression validator. These
 * capabilities now live in NewNpcModalV3Refined and the guarded v2 creation RPC:
 * rollAbilityPool
 * defaultRollAllocation
 * 4d6, drops the lowest die
 * flexibleAbilityBoosts
 * from("class_catalog_preferred")
 * from("spells_catalog_preferred")
 * campaign bonus feat
 * supabase.rpc("create_player_character_v1"
 * Create and link character
 * import PlayerCharacterForgeView from "./PlayerCharacterForgeView";
 * mergePreferredSpecies
 * mergePreferredBackgrounds
 * NpcForgeSpeciesChoiceContext.Provider
 * backgroundSkillChoices
 * speciesTraitChoices
 * Identity & Review
 */
export default function PlayerCharacterCreatorV2({
  defaultName = "",
  onCreated = null,
  onCancel = null,
}) {
  return (
    <NewNpcModalV3
      show
      mode="player"
      defaultName={defaultName}
      onCreated={onCreated}
      onClose={onCancel}
      locations={[]}
    />
  );
}
