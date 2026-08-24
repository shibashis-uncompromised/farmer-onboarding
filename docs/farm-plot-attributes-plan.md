# Farm Plot Data Collection — Implementation Plan

**App:** `farmer-onboarding` (Next.js/Mantine PWA, local-first via IndexedDB) + `farmer-onboarding-backend` (Express/Postgres)
**Goal:** add the 23 farm-plot attributes, grouped into 4 collection sections, to the existing "Add/Edit Farm" flow.
**Decisions already made:** one combined Add/Edit Farm form with the 4 groups as labeled sections; the 3 "Tests" fields attach to the existing soil-sample record, not to the Farm.

This is a plan only — no code has been written yet.

## 1. Why this fits the current app cleanly

Farms, plots and soil samples already sync as a single JSONB blob (`data` column) to Postgres — the backend stores and returns whatever object the app sends. That means every new field below is a **pure frontend change**: extend the TypeScript types, add form inputs, and the existing sync path (`sync.ts` → `POST /api/sync` → Postgres `data` column → pull → Dexie) carries it through with no migration required. The only backend edit worth doing is widening `/api/export.csv` so the new fields show up in the CSV report your team already downloads.

## 2. Data model changes

### `Farm` (in `src/lib/types.ts`) — new optional fields

| Field | Type | Group |
|---|---|---|
| `treeCountBig` / `treeCountSmall` | `number \| null` | Physical Fieldwork |
| `mobileCoverage` | `"good" \| "weak" \| "none" \| null` | Physical Fieldwork |
| `farmerFocus` | `"primary" \| "secondary" \| "minimal" \| null` | From Farmer |
| `waterSource` | `"rainfed" \| "borewell" \| "open_well" \| "farm_pond" \| "anicut_river" \| null` | From Farmer |
| `irrigationAvailable` | `"none" \| "flood" \| "sprinkler" \| "drip" \| null` | From Farmer |
| `seasonsPossible` | `("kharif" \| "rabi" \| "zaid")[]` | From Farmer |
| `knownIssues` | `("termites" \| "nematodes" \| "frost" \| "flooding")[]` | From Farmer |
| `previousCrop` | `string` (free text/autocomplete, reuses `PREVIOUS_CROPS`) | From Farmer |
| `previousCropProduction` | `{ quintals: number \| null; vsBenchmark: "above" \| "at" \| "below" \| null }` | From Farmer |
| `animalPressure` | `("nilgai" \| "boar" \| "monkey" \| "rabbit" \| "birds")[]` | From Farmer |
| `accessibility` | `"tractor" \| "small_machinery" \| "hand_tools" \| null` | From Farmer |
| `gradient` | `"flat" \| "slight" \| "significant" \| null` | Supervisor Observation |
| `waterloggingProbability` | `"low" \| "medium" \| "high" \| null` | Supervisor Observation |
| `sunlightAvailability` | `"unobstructed" \| "partial" \| "low" \| null` | Supervisor Observation |
| `fencingAvailability` | `"none" \| "natural" \| "stone_pitch" \| "wire_fence" \| "boundary_wall" \| null` | Supervisor Observation |

Already covered by existing fields — no change needed: geotagged location (`lat`/`lng`), boundary (`boundary[]`), farmer name (`Farmer.firstName/lastName`).

**Derived, not stored as raw input:** Shape and Plot Size. Both can be computed from `boundary[]` (shoelace formula for area; corner-angle check for square/rectangle/trapezoid) whenever ≥3 boundary points exist, shown as read-only in the Physical Fieldwork section with a manual override (`shapeOverride`, `plotSizeSqFt`) for the common case where a farm has no walked boundary yet.

### `SoilSample` (in `src/lib/types.ts`) — new optional fields (the "Tests" group)

| Field | Type |
|---|---|
| `waterTDS` | `number \| null` (ppm) |
| `soilTexture` | `{ clayPct: number \| null; sandPct: number \| null; siltPct: number \| null }` |
| `testReportMediaId` | `string \| null` (reuses the existing `Media`/`db.media` pattern used for farm/farmer photos, so a scanned lab report image attaches the same way a photo does) |

## 3. UI changes

**`AddFarmModal` (`FarmsStep.tsx`)** — reorganize into four collapsible `Divider`-separated sections, in this order, each with a small heading and icon consistent with the app's existing style:

1. **Physical Fieldwork** — existing `LocationCapture` + `BoundaryCapture`, plus new: tree count (two `NumberInput`s), mobile coverage (`SegmentedControl`: Good/Weak/None — auto-filled from `navigator.connection` when available, editable), and the derived Shape/Plot Size display.
2. **From Farmer** — `SegmentedControl` for focus; `Select`s for water source, irrigation, accessibility; `MultiSelect`s for seasons possible, known issues, animal pressure; `Autocomplete` for previous crop (reuses `PREVIOUS_CROPS`); `NumberInput` + `Select` for previous crop production vs. benchmark.
3. **Supervisor Observation** — `Select`s for gradient, waterlogging, sunlight, fencing.
4. **Tests** — *not shown here*; see below.

Each section stays optional (matches the app's existing pattern of letting a farm save with no boundary/photo) so a fieldworker can save Section 1 today and a supervisor can complete Section 3 on a later visit without blocking on the others.

**Soil sample flow (`SoilSamplesModal` / a new `TestResultsModal` in `FarmsStep.tsx`)** — since Water TDS, Soil Texture and the Test Report typically come back from a lab *after* the sample was collected, add a small "Enter test results" action on each timeline entry in `SoilSamplesModal` (next to the existing sample info) that opens a form with: TDS `NumberInput`, three texture `NumberInput`s with a running "total: X%" hint, and a `PhotoInput` for the report. This edits the existing `SoilSample` record rather than creating a new one.

**`FarmDetailModal`** — add three read-only `Paper` blocks (Farmer-reported, Supervisor observation, and reflect test results already shown per-sample in the soil samples block) so the farm detail view surfaces everything captured.

## 4. Backend

No schema migration needed (JSONB carries new fields automatically). One recommended addition: extend the `SELECT` in `/api/export.csv` (`index.js`) to pull the new keys via `fm.data->>'gradient'`, `fm.data->>'waterSource'`, etc., and extend `soil.data->>'waterTDS'` etc. in the soil-samples CSV section, so field reports include the new attributes. This is optional for the app to function, but you'll want it before the CSV is your reporting source of truth.

## 5. Open questions to confirm before/while building

- **Sunlight wording:** your doc lists "Unobstructed, Partial (>80%), Low (<75%)" — the percentages look swapped (Partial should likely be the >80% *unobstructed* case). Flagging so it's fixed at the source rather than encoded as-is.
- **Farmer Focus** and the other "From Farmer" attributes are being stored per-**farm** (a farmer with two farms could have different water sources, focus, etc. per farm) rather than per-farmer. Confirm that's right — if "Farmer Focus" is really about the person, it belongs on `Farmer` instead.
- **Water TDS living on `SoilSample`:** that record is a *soil* sample (scanned soil-test-kit QR); TDS is a water measurement. There's no separate "water sample" entity today, so per your decision it rides along on the soil sample record. If water testing ends up on a different cadence/device (e.g., a TDS meter used independently of the soil-kit QR), a standalone `WaterSample` entity would be cleaner — worth revisiting once you see how it's used in the field.
- **Previous crop duplication:** `SoilSample.pastCrops` already exists (captured at soil-sample time) and the new `Farm.previousCrop` is a separate, farm-level field. They can drift apart. Fine to keep both, but worth deciding which one is "the" previous crop for reporting.

## 6. Suggested build order

1. Extend types (`types.ts`) — Farm + SoilSample fields above.
2. Physical Fieldwork additions in `AddFarmModal` (smallest, no new components).
3. From Farmer + Supervisor Observation sections in `AddFarmModal`.
4. Test-results entry point on `SoilSamplesModal`.
5. Surface everything read-only in `FarmDetailModal`.
6. Extend `/api/export.csv`.
7. Smoke-test: add a farm with all sections filled, sync, confirm it round-trips through Postgres and reappears correctly on pull.

---
Say the word and I'll implement this against the files already reviewed (`FarmsStep.tsx`, `types.ts`, `index.js`), or first make any adjustments above.
