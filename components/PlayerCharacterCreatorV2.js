import NewNpcModalV3 from "./NewNpcModalV3";

/**
 * Player creation now uses the same canonical Forge implementation as NPC creation.
 * The shared component keeps one layout, one catalog workflow, and one set of
 * responsive fixes while its guarded player mode uses player ownership RPCs.
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
