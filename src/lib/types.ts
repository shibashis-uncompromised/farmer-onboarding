// ---- Core domain types ----
// Designed local-first (IndexedDB). A future backend sync can reuse these
// shapes; `synced`/`updatedAt` fields are included with that in mind.

export type OnboardingStatus = "not_started" | "pending" | "completed";

// Farmer profile attributes (bio data)
export type FinancialCapacity = "low" | "medium" | "high";
export type Landholding = "lt_2_5" | "between_2_5_10" | "gt_10";
export type AdoptionLevel = "basic" | "improved" | "progressive" | "advanced";

// A seed package handed to / allocated for a farmer (e.g. Groundnut ×2).
export interface SeedPackage {
  seed: string;
  qty: number;
}

// A user-created village. Static preset villages live in villages.ts; these are
// added in the field, synced, and visible to their creator + admin only.
export interface CustomVillage {
  code: string;        // unique key (e.g. "v_ab12cd") — used as villageCode on records
  name: string;
  block: string;
  idCode: string;      // ID abbreviation for human IDs: <REGION>-<idCode>-U###
  region: string;      // "RJ" | "MP" | "GJ"
  state: string;       // Neoperk state
  district: string;    // Neoperk district
  createdBy: string;   // username of the creator
  createdAt: number;
  updatedAt: number;
  synced: boolean;
  deleted?: boolean;
}

export interface Farmer {
  id: string;            // RJ{village}U{seq}  e.g. RJ001U001
  villageCode: string;   // "001"
  firstName: string;
  lastName: string;
  coFirstName: string;   // care-of (guardian/spouse) first name
  coLastName: string;
  coRelation: string;    // e.g. S/o, W/o, D/o
  phone: string;
  hasSmartphone: boolean | null;
  farmerType?: "lead" | "existing";   // lead (prospect) vs existing farmer
  note: string;             // optional note from the onboarding team
  photoId: string | null;   // -> media table
  seeds?: SeedPackage[];    // seed packages for this farmer (rides in the synced record)
  financialCapacity?: FinancialCapacity | null;
  landholding?: Landholding | null;
  adoptionLevel?: AdoptionLevel | null;
  bioComplete: boolean;
  createdAt: number;
  updatedAt: number;
  synced: boolean;
  deleted?: boolean;       // soft delete — hidden from all views when true
}

// ---- Farm attribute enums (data-collection groups) ----
// Group: Physical Fieldwork
export type MobileCoverage = "good" | "weak" | "none";
export type FarmShape = "rectangle" | "square" | "trapezoid" | "irregular";

// Group: From Farmer
// How often the FARMER visits this farm.
export type FarmerFocus = "daily" | "twice_weekly" | "weekly_plus";
export type WaterSource = "rainfed" | "borewell" | "open_well" | "farm_pond" | "anicut_river";
export type IrrigationAvailable = "none" | "flood" | "sprinkler" | "drip";
export type Season = "kharif" | "rabi" | "zaid" | "other";
export type KnownIssue = "termites" | "nematodes" | "frost" | "flooding" | "other";
export type AnimalPressure = "nilgai" | "boar" | "monkey" | "rabbit" | "birds" | "other";
export type Accessibility = "tractor" | "small_machinery" | "hand_tools";
export type BenchmarkComparison = "above" | "at" | "below";
// Tools/equipment the farmer has access to for this farm.
export type FarmTool = "tractor" | "power_tiller" | "pump_set" | "sprayer" | "thresher" | "plough" | "hand_tools" | "other";

// Group: Supervisor Observation
// Gradient/Sunlight are recorded as the % measured/estimated on visit.
export type Gradient = "lt_5" | "5_10" | "10_30" | "gt_30";
export type WaterloggingProbability = "low" | "medium" | "high";
export type SunlightAvailability = "lt_5" | "5_10" | "10_30" | "30_50" | "gt_50";
export type FencingAvailability = "none" | "natural" | "stone_pitch" | "wire_fence" | "boundary_wall";

// Farmer-reported production for the previous crop on this farm.
export interface PreviousCropProduction {
  quintals: number | null;
  vsBenchmark: BenchmarkComparison | null;
}

export interface Farm {
  id: string;            // RJ{village}F{seq}  e.g. RJ001F001
  alias?: string;        // sanitized sequential id per village (F001…); see farm-aliases/ map
  name?: string;         // display name — set by admin (falls back to alias, then id)
  farmerId: string;
  villageCode: string;
  photoId: string | null;       // first/primary photo — kept for back-compat & thumbnails
  photoIds?: string[];          // all farm photos (media ids); photoId === photoIds[0]
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  note?: string;                // optional note about this farm
  boundary?: BoundaryPoint[];   // optional polygon: GPS points captured at corners

  // ---- Physical Fieldwork (captured on-site with GPS/boundary tools) ----
  treeCountBig?: number | null;
  treeCountSmall?: number | null;
  mobileCoverage?: MobileCoverage | null;
  shapeOverride?: FarmShape | null;      // auto-detected from the boundary once it has 3+ points; supervisor can override
  plotSizeSqFtOverride?: number | null;  // sq ft — auto-computed from the boundary, or entered by hand
  /** @deprecated briefly used hectares — kept only so farms saved during that window still read back correctly */
  plotSizeHectOverride?: number | null;

  // ---- From Farmer (interview/questionnaire) ----
  farmerFocus?: FarmerFocus | null;
  waterSource?: WaterSource[];    // a farm can draw on more than one source (e.g. borewell + farm pond)
  irrigationAvailable?: IrrigationAvailable[];   // a farm can have more than one irrigation method available
  seasonsPossible?: Season[];
  seasonsPossibleOther?: string;  // free-text detail when seasonsPossible includes "other"
  knownIssues?: KnownIssue[];
  knownIssuesOther?: string;      // free-text detail when knownIssues includes "other"
  previousCrop?: string;
  previousCropProduction?: PreviousCropProduction | null;
  animalPressure?: AnimalPressure[];
  animalPressureOther?: string;   // free-text detail when animalPressure includes "other"
  accessibility?: Accessibility | null;
  toolsAvailable?: FarmTool[];     // tools/equipment the farmer has access to
  toolsAvailableOther?: string;   // free-text detail when toolsAvailable includes "other"

  // ---- Supervisor Observation (visual assessment on visit) ----
  gradient?: Gradient | null;
  waterloggingProbability?: WaterloggingProbability | null;
  sunlightAvailability?: SunlightAvailability | null;
  fencingAvailability?: FencingAvailability | null;

  createdAt: number;
  updatedAt: number;
  synced: boolean;
  deleted?: boolean;       // soft delete
}

// A single corner/deviation point of a farm boundary.
export interface BoundaryPoint {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
  alt?: number | null;         // GPS altitude (m), when the device reports one
  altAccuracy?: number | null; // reported altitude accuracy (m) — typically much
                                // noisier than horizontal accuracy
}

export interface Plot {
  id: string;            // {farmId}/{seq}  e.g. RJ-VELA-F001/001
  farmId: string;
  farmerId: string;
  seq: string;           // "001"
  name?: string;         // display name — set by admin (falls back to "Plot {seq}")
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  // Optional: Plot 1 is created automatically (empty) with every new farm;
  // the crop is filled in later by editing the plot.
  crop?: string;
  sowingDate?: string;     // when the crop was sown (YYYY-MM-DD)

  // ---- Tests ----
  // Neither water TDS nor soil type (clay/sand/silt) lives here — both are
  // recorded many times over a plot's life, so each reading is its own
  // WaterTDSTest / SoilTextureTest record instead of a single field on Plot
  // that would overwrite its own history.

  createdAt: number;
  updatedAt: number;
  synced: boolean;
  deleted?: boolean;       // soft delete
}

// A soil type (texture) reading for a plot — clay/sand/silt %, recorded
// whenever the plot is tested. Kept as its own repeatable record (like
// SoilSample) rather than a single field on Plot, since a plot can be
// tested many times over its life and each reading should stay in history.
export interface SoilTextureTest {
  id: string;             // local uid
  plotId: string;
  farmId: string;
  farmerId: string;
  soilTexture: SoilTexture;
  testReportMediaId?: string | null;     // -> media table (photo/scan of the lab report)
  createdAt: number;      // when the test was recorded
  updatedAt: number;
  synced: boolean;
  deleted?: boolean;       // soft delete
}

// A water TDS reading for a plot — ppm, recorded whenever the plot's water
// is tested. Kept as its own repeatable record (like SoilTextureTest) rather
// than a single field on Plot, since a plot can be tested many times over
// its life and each reading should stay in history.
export interface WaterTDSTest {
  id: string;             // local uid
  plotId: string;
  farmId: string;
  farmerId: string;
  waterTDS: number | null;               // ppm
  testReportMediaId?: string | null;     // -> media table (photo/scan of the water test report)
  createdAt: number;      // when the test was recorded
  updatedAt: number;
  synced: boolean;
  deleted?: boolean;       // soft delete
}

export interface Media {
  id: string;            // uuid-ish
  blob?: Blob;           // the actual image — absent on field devices (fetched lazily on view)
  createdAt: number;
  synced?: boolean;
  s3Key?: string;        // set after successful S3 upload
  s3Url?: string;        // presigned GET URL (from pull) for lazy fetch-on-view
  s3UrlAt?: number;      // when s3Url was issued (presigned URLs expire ~1h)
}

// A soil sample collected from a farm — the code comes from a scanned QR, and
// we record when (and, best-effort, where) it was taken.
export interface SoilSample {
  id: string;            // local uid
  code: string;          // scanned QR payload (soil sample code)
  // The plot the sample was taken from. Samples recorded before plot-level
  // sampling have no plotId — they're kept on the farm as history.
  plotId?: string;
  farmId: string;
  farmerId: string;
  villageCode: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  pastCrops?: string;    // previous crop on this plot
  neoperkSampleId?: string;   // sample_id returned after submitting to the Neoperk scanner system
  submittedAt?: number;       // when submitted to Neoperk

  // Test results (water TDS in WaterTDSTest, soil type in SoilTextureTest)
  // live elsewhere — both are independent of whether a soil sample was taken.

  createdAt: number;     // when scanned
  updatedAt: number;
  synced: boolean;
  deleted?: boolean;       // soft delete
}

// Soil texture as % clay / sand / silt (sum to 100). The %s are derived from the
// jar/sedimentation test layer heights, which are kept for traceability.
export interface SoilTexture {
  clayPct: number | null;
  sandPct: number | null;
  siltPct: number | null;
  // Raw settled-layer heights from the jar test (unitless); total = their sum.
  clayHeight?: number | null;
  sandHeight?: number | null;
  siltHeight?: number | null;
}

export interface SessionLocation {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
  alt?: number | null;
  altAccuracy?: number | null;
}
