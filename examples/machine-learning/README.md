# machine-learning — the built-in default dataset

The original Cavin demo palace, and the dataset the app boots when
localStorage is empty. Not a static file: `generate.ts` procedurally
generates ~540 notes (6 wings × 6 rooms × 15 drawers, plus randomly nested
children and four showcase 7-level deep chains) with a fixed mulberry32
seed, so the palace is identical on every fresh boot.

Why generated rather than checked-in JSON:

- **Synthetic embeddings**: each note's 8-dim vector clusters around its
  room's base vector — the machine-suggested edges (cosine ≥ 0.9) depend on
  that structure.
- **Fresh timestamps**: `createdAt` anchors to "today at midnight" and
  spreads back 730 days, so the time-depth slider always has something to
  show.
- **Size**: the parameter space (wings/rooms/drawers, nesting odds, deep
  chains) is tunable in one place instead of diffing a megabyte of JSON.

Consumed by the app through the dataset registry in `src/demo/datasets.ts`.
