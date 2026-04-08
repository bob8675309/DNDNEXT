DNDNEXT Town Sheet update bundle

Files included:
- components/TownSheet.js
- pages/town/[id].js
- utils/townData.js
- styles/town-sheet-addendum.scss

How to apply:
1. Replace these files in your repo:
   - components/TownSheet.js
   - pages/town/[id].js
   - utils/townData.js
2. Append styles/town-sheet-addendum.scss to the bottom of styles/globals.scss

What this adds:
- Layered town sheet page
- Shared scrollable drawer
- Town map panel with clickable labels
- Admin edit mode for map labels
- Admin add/delete flag workflow
- Save/load through town_map_labels and town_map_flags
- Xul-specific town content override
