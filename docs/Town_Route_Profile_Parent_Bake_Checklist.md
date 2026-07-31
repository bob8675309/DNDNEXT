# Town Route Profile Parent — Current Source Checklist

Last reconciled: 2026-07-30

Status: **SOURCE-OWNED / PATCH-CHAIN CHECKLIST RETIRED**

The former intermediate `NpcPanel` bake state is obsolete. The town route should now be checked against its final source-owned contract.

## Required current state

- `pages/town/[id].js` owns the active town-profile character and active view.
- The town route renders the shared `CharacterInteractionPanel` boundary.
- `TownSheet` receives the parent profile/open-view callback.
- Profile, Shop, and Craft requests remain inside the shared side-panel experience.
- Crafter profession data is normalized before entering the Craft surface.
- No iframe is used.
- No build-time mutator converts an intermediate town panel into the final panel.

## Validation

Run the focused town/profile/crafter validators listed by `scripts/vercel_build_v2.mjs`, followed by:

```text
npm run build:vercel
```

## Guardrails

- Do not restore the intermediate `NpcPanel` bake contract.
- Do not change world movement, route advancement, travel windows, camps, weather, crafting rules, merchant stock, wallet behavior, inventory grants, or inventory consumption in a town-panel presentation patch.
