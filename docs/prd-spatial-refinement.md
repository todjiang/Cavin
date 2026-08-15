# PRD: Spatial Browsing & Human Refinement of an AI-Clustered Knowledge Base

## Problem Statement

An AI system (agent or batch importer) continuously produces knowledge notes with embeddings. Today these notes are dumped into flat lists or opaque vector stores — the human has no way to *see* the machine's organization, spot where it went wrong, or correct it. The result: the knowledge base drifts, errors accumulate silently, and the human's mental model of "what's in there and where" diverges from the machine's.

The user needs a **spatial map** of the machine's clustering — a browsable, zoomable star-map where notes cluster into wings/rooms by similarity and nest into rooms-within-rooms by hierarchy — plus **refinement tools** to fix the machine's mistakes (misplaced notes, wrong parent links, noise) and **mark what has been human-confirmed** so future machine imports don't undo it.

## Solution

A zoomable canvas ("memory palace") where:

- Every note is a **dot + title label**; machine clustering renders notes as a star-map of wings (top-level domains) and rooms (topic clusters), positioned by embedding similarity.
- **Hierarchy is zoom-driven**: wheel-zooming toward a note opens it like a room — its children spread onto an inner ring, the parent's label becomes a nameplate on the room boundary, and deeper levels open as rooms-within-rooms. Zoom = granularity.
- **Refinement is direct-manipulation**: click opens a detail panel; drag moves a note (and its subtree); drag onto another note re-parents it; lock marks "human-confirmed" (blocks both accidental edits and future machine overwrites); delete cascades with lock shielding.
- **Navigation**: search-to-fly with match highlighting, plus a minimap with wing/room name labels for orientation and jump-to-region.
- **State model**: bulk import lands as the initial "machine draft"; human refinement converges it to a "final draft"; afterwards small increments auto-place by the same clustering logic, with locked nodes untouched.

The prototype phase is **single-user, local-first** (no real data pipeline, no backend), focused on nailing the browsing and refinement interaction. Architecture keeps the storage layer behind an interface so a future multi-user backend can replace localStorage without touching the UI.

## User Stories

### Browsing the machine draft

1. As a knowledge curator, I want to see all my notes as a zoomable star-map, so that I can grasp the whole knowledge base at a glance.
2. As a curator, I want notes clustered into labeled wings and rooms by topic, so that I can navigate by domain.
3. As a curator, I want to wheel-zoom into a note to open it like a room and see its children spread out inside, so that I can explore hierarchy by zooming.
4. As a curator, I want deeper nesting levels to reveal progressively as I zoom (rooms within rooms), so that deep hierarchies are explorable without being overwhelmed.
5. As a curator, I want only the family near my viewport center to open, so that zooming opens rooms one at a time instead of all at once.
6. As a curator, I want parent notes to show a ring/boundary when open, so that I can see the extent of a room.
7. As a curator, I want to dim older notes with a time slider, so that I can focus on recent knowledge.
8. As a curator, I want a minimap with region labels, so that I can orient myself and jump to a wing/room.
9. As a curator, I want to search notes by title/tags/body with highlighted matches, so that I can fly straight to a known note.
10. As a curator, I want a breadcrumb of my current region, so that I always know where I am.
11. As a curator, I want my camera position reflected in the URL, so that I can share or restore a view.
12. As a curator, I want my LOD thresholds and time filter to persist across sessions, so that my preferred granularity survives reloads.

### Refining the draft

13. As a curator, I want to click a note to open its detail panel, so that I can read and edit it.
14. As a curator, I want to drag a note to a new position with its subtree following, so that I can fix where the machine put it.
15. As a curator, I want to drag a note onto another note to make it a child of that note, so that I can fix wrong parent links.
16. As a curator, I want to drag a note out to empty space to make it a root, so that I can promote misplaced children.
17. As a curator, I want to change a note's parent from its detail panel via a searchable picker, so that I can re-parent to a distant node I can't drag to.
18. As a curator, I want to lock a note to mark it "human-confirmed", so that I can't accidentally move/edit/delete it and future machine imports leave it alone.
19. As a curator, I want deleting a note to cascade to descendants except locked branches, so that I prune noise without losing confirmed structure.
20. As a curator, I want the delete confirm to show the real descendant count, so that I know the blast radius.
21. As a curator, I want to add a child note or a new root note anywhere, so that I can fill gaps.
22. As a curator, I want edit-mode to warn before discarding unsaved changes, so that I don't lose work.
23. As a curator, I want a free-placed note marked and returnable to its cluster/orbit home, so that I can undo manual placement.

### Growth & collaboration boundaries

24. As a curator, I want incoming notes auto-placed by the same clustering, so that the map grows without inbox debt.
25. As a curator, I want locked (confirmed) notes untouched by re-imports, so that my confirmed structure survives machine updates.
26. As a curator (future), I want to share a read-only snapshot of the map, so that collaborators can browse the same knowledge base.

## Implementation Decisions

### Modules to build / modify

- **Re-parenting interaction (new)** — drag-onto-node to re-parent with hover affordance; drag-to-empty to promote to root; detail-panel parent picker (searchable). This is the primary capability gap.
- **Storage abstraction (new)** — wrap the current localStorage persistence behind a `WorldStore` interface (load/save/clear + change subscription) so a backend/CRDT implementation can replace it later without touching UI or stores.
- **Minimap region labels (modify)** — render wing/room name text on the minimap canvas, decluttered, so regions are identifiable at a glance.
- **Lock semantics (modify)** — lock gains a "confirmed" flag consumed by a future import path; today it still blocks move/edit/delete.
- **Detail panel (modify)** — add the parent picker; keep dirty-guard/lock/children/cascade-delete behaviors.
- **Render scale (modify)** — to reach 5k–50k nodes: skip roomMorph for nodes whose ancestor room is closed or off-screen; replace the O(n²) label collision loop with a spatial index (quadtree/grid); sample labels by importance when over budget.

### Interfaces changed

- `moveNode(id, pos, { parentId })` extended to support re-parenting; deriveWorld re-anchors children of a re-parented subtree.
- `WorldStore` interface (load/save/subscribe) replaces direct localStorage calls in the world store boot.
- Minimap canvas gains a label-pass drawing wing/room names.

### Architectural decisions

- Hierarchy remains **machine-authored, human-corrected**; re-parenting edits `parentId` and re-derives.
- Zoom-driven rooms stay the only nesting visualization; `revealZoom` saturates at depth 6 so arbitrary depth is reachable spatially within `MAX_ZOOM`.
- Storage is local-first behind an interface; multi-user is a future backend swap, not a current build.

## Testing Decisions

Good tests cover **external behavior, not internals**: store reducers (move/re-parent/delete with lock shielding), deriveWorld invariants (orphan promotion, child re-anchoring), and the re-parent interaction rules (cycle prevention, locked-branch shielding). Modules to test: the world store's mutation logic and `deriveWorld`/`deletableSubtree`/`movableSubtree` (pure, currently untested, easy to test in isolation). No prior test infrastructure exists; introduce Vitest for these pure data-layer modules.

## Out of Scope

- Real data pipeline / ingestion (no actual embedding importer this phase)
- Backend, accounts, real-time multi-user collaboration (interface-reserved only)
- Mobile/pinch touch
- Feedback loop to the machine (corrections stay local)
- Test/lint/README infrastructure beyond the targeted store tests
- Undo/redo, multi-select, collapse-all commands

## Further Notes

- Deep-chain showcase data (4 × 7-level hierarchies) already exercises unlimited-depth rendering.
- Performance work done (rAF imperative label layer, dirty-checked canvases, drag coalescing) is a prerequisite for the 5k+ target but not sufficient — spatial indexing is the next step.
