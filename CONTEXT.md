# CONTEXT.md — Cavin glossary

Cavin is a framework for **spatial progressive editing**: hierarchical,
relational data edited on a zoomable canvas where zoom is the granularity
axis. This file is a glossary of the domain language, nothing else.

## Spatial Progressive Editing

The core interaction thesis. Hierarchical data is presented as space, not
as a folder tree: zooming toward a parent *opens* its room (children spread
onto a ring), zooming out folds families back into the star field. Opening
IS focusing — only families near the viewport center open. Canonical term
for the product's one-sentence claim.

*Avoid / deprecated alias:* "progressive data editing" (the earlier term in
`docs/architecture-generic-framework.md`) — too vague; progressive
disclosure is a pre-existing UX concept and "data editing" carries no
spatial meaning. Use it only when referring to that document.

## Room

A node that has children. Its boundary circle grows as it opens and fades
once the camera passes through (pass-through), after which the children own
the view.

## Wing

A top-level group of rooms — the outermost spatial cluster, drawn as a blob
in the star-field view.

## Constellation

The render-time-only rearrangement around a selected node: confirmed
neighbors gather onto an outer ring, the selected node's children onto an
inner ring. Positions are never persisted; ESC disperses everything home.

## Dataset

A named, loadable world (the demo registry: `memory-palace`, `sanguo`).
Switching datasets replaces the world; each dataset owns its own generation
or curation and its placement.

## Suggested Edge / Confirmed Edge

A *suggested edge* is a machine draft (cross-wing embedding similarity),
recomputed on every derive, never persisted. A *confirmed edge* is a
human-confirmed connection, persisted, and shadows its suggestion. Edges
are undirected: the pair is the identity.

## Focus Mode

The state while a selection has confirmed edges: only the selection's
neighborhood (neighbors, children, ancestors) is drawn; cluster labels dim.
The constellation animates in within it.
