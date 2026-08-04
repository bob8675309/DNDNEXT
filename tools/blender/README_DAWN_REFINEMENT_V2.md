# Dawn Whiteflame Visual Refinement v2

This pass is procedural and runs automatically between the base Dawn model builder and scene preparation.

It changes only visual source data:

- shorter/narrower robe and cape;
- larger separated boots and shins;
- stronger four-pose grounded walk;
- restrained right-hand staff motion;
- stronger ivory/gold/hair/dark-metal value separation;
- orthographic scale `4.0` instead of `4.4`;
- model/manifest marker `dawn_grounded_walk_v2`.

No rendered frame is edited manually. Use `build_and_publish_dawn_whiteflame.ps1`; publication remains blocked unless automatic QA passes.
