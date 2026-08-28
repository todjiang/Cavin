# Sanguo example

Three Kingdoms test scenario for Cavin.

This example is a **consumer** of the framework. Nothing under `packages/*`
may import from this directory.

## Run

```bash
npm run dev:sanguo
```

## Data model

- `groupPath[0]` — camp: 魏 / 蜀 / 吴 / 群雄
- `groupPath[1]` — role: 君主 / 宗室 / 武将 / 谋士 / 文臣 / 女性 / 方技
- `parentId` — family or succession link, used to exercise rooms-within-rooms
- `src/relations.ts` — explicit cross-person relationships (君臣、师徒、对手、同僚 etc.), persisted as confirmed edges
- `attributes.timeSpan` — `{ start?: birthYear, end?: deathYear, peak?: peakYear }`

## Source files

| File | Purpose |
|---|---|
| `src/types.ts` | example-owned data types and timeline constants |
| `src/personae.ts` | curated people (288 records) |
| `src/generate.ts` | deterministic `generateSanguoNodes()` + time-span helpers |
| `src/relations.ts` | explicit relationship edges (339 relations) |
| `src/placement.ts` | deterministic camp/role/era placement |
| `src/placement.test.ts` | placement invariants |
| `src/adapter.ts` | `sanguoAdapter` — the SchemaAdapter plug |
| `src/app-data.ts` | generator → placed `CavinNode[]` + confirmed edges |
| `src/main.tsx` | `<CavinCanvas adapter={sanguoAdapter} … />` |
| `src/adapter.test.ts` | adapter conformance + label invariants |
| `src/generate.test.ts` | data invariants |
| `src/relations.test.ts` | relationship invariants |

The generator leaves positions at `[0, 0]`; `src/app-data.ts` assigns the
deterministic placement before the world mounts.
