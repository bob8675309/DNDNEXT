import CraftingPage from "../pages/items";

// Phase-1 adapter: expose the existing /items workflow through a component
// without duplicating or rewriting crafting rules. Later phases will move the
// workflow internals here after this bridge is proven stable.
export default function CraftingWorkspace(props = {}) {
  return <CraftingPage {...props} />;
}
