import { createContext, useContext } from "react";

const NpcForgeControllerContext = createContext(null);

export function NpcForgeControllerProvider({ controller, children }) {
  return <NpcForgeControllerContext.Provider value={controller}>{children}</NpcForgeControllerContext.Provider>;
}

export function useNpcForgeControllerContext() {
  return useContext(NpcForgeControllerContext);
}
