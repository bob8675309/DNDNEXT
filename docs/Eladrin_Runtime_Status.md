# Eladrin Runtime Status

Status reconciled: 2026-09-15

Historical implementation chain:

- PR #170 — runtime foundation — merged at `599c4de7397ba6e4bbbb0a061d551d80c3570be7`;
- PR #171 — Species presentation continuation — **merged** at `ed93331b946dffee1e63183e969f115d0c8a1a18`.

The former “PR #171 open/unmerged” statement is obsolete. Current `main` and live Supabase are authority.

## Purpose

Eladrin has two runtime-choice families that must not be converted into permanent one-time Character Forge locks:

1. **Season** — an initial Species choice that persists but may be changed after a qualifying Long Rest.
2. **Trance training** — temporary post-Long-Rest proficiencies that expire at the next Long Rest.

They use independent runtime rows/keys so persistent season state cannot be overwritten by temporary training state.

## Season authority

Feature key: `eladrin-season`.

Shared Player Forge collects one initial season:

- Autumn
- Winter
- Spring
- Summer

The initial choice is source-owned runtime-initial state and is materialized into character runtime-choice authority after creation. The current season persists through rests until a newer completed Long Rest opens one replacement opportunity.

Durable rules:

- same-season replacement is a no-op and should be rejected;
- one qualifying Long Rest permits at most one replacement;
- another replacement requires a newer Long Rest;
- at level 3+, season affects Fey Step’s extra effect presentation/rules data;
- tactical Fey Step execution is a separate combat concern and must not be implemented by the Species creator/runtime panel merely because season state exists.

The Species UI may present the four season descriptions as the selectable creation choices, but presentation must preserve the stored source keys and lifecycle.

## Trance training authority

Feature key: `eladrin-trance-training`.

Trance training is **not** a creation-time permanent choice.

After a completed Long Rest/Trance, an eligible Eladrin chooses exactly two distinct source-legal PHB weapon/tool proficiencies. The pair is stored as temporary runtime proficiency state and consumed additively by the normal proficiency resolver.

Durable rules:

- unavailable before a qualifying completed Long Rest;
- choices must be distinct and source-legal;
- permanent Species/Class/Background/Feat training is not rewritten;
- the runtime pair expires/deletes when the next Long Rest completes;
- the new rest then opens a fresh configuration opportunity;
- active-encounter/ownership/admin guards remain in force.

## UI / reachability

The Eladrin runtime controls remain part of the downstream Species runtime-panel composition and must stay reachable independently of whether unrelated Species runtime families are eligible.

The panel should expose:

- current season;
- post-Long-Rest season replacement when available;
- current temporary Trance pair;
- post-rest two-choice Trance configuration when available.

Do not make Eladrin runtime controls depend on Githyanki/Khoravar proficiency state or High Elf/Khoravar cantrip state.

## Security / RPC boundary

Public runtime RPCs for Eladrin season/trance are authenticated/service-role only; helper/materializer functions remain private/service-role as designed. Mutations must honor character ownership/admin authority and existing active-encounter restrictions.

Canonical rest timing continues through the existing `character_rest_log`/long-rest authority rather than a second client rest clock.

## Historical migration note

The original implementation was delivered as migration 68 and validated with rollback fixtures. The live migration ledger has since advanced to **214 rows**, latest `20260814161314 grim_hollow_heritage_catalog_support`.

Migration 68 remains the historical implementation anchor; it is not the current migration ceiling.

## Current acceptance stance

The Eladrin runtime model is considered established. Re-open it only for a reproduced defect or an explicit feature request. Preserve the key lifecycle distinction: initial/persistent season with post-rest replacement versus temporary post-rest Trance proficiencies.

## Protected boundaries

Eladrin runtime work does not authorize world-map, town/city-map, route/travel/weather/camp/clock, crafting, inventory, merchant, economy, or unrelated tactical changes. Fey Step combat execution remains separate from this runtime-choice ledger.
