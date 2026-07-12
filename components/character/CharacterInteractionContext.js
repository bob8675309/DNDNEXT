import { createContext, useContext } from "react";

export const CharacterInteractionContext = createContext({
  characterId: null,
  canManageCharacter: false,
});

export function useCharacterInteractionContext() {
  return useContext(CharacterInteractionContext);
}
