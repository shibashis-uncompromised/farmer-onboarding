// ---- Core domain types ----
// Designed local-first (IndexedDB). A future backend sync can reuse these
// shapes; `synced`/`updatedAt` fields are included with that in mind.

export type OnboardingStatus = "not_started" | "pending" | "completed";

// A seed package handed to / allocated for a farmer (e.g. Groundnut ×2).
export interface SeedPackage {
  seed: string;
  qty: number;
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
// How often the SUPERVISOR needs to check in on this farm (not how often the
// farmer themselves works it).
export type FarmerFocus = "daily" | "twice_weekly" | "weekly_plus";
export type WaterSource = "rainfed" | "borewell" | "open_well" | "farm_pond" | "anicut_river";
export type IrrigationAvailable = "none" | "flood" | "sprinkler" | "drip";
export type Season = "kharif" | "rabi" | "zaid";
export type KnownIssue = "termites" | "nematodes" | "frost" | "flooding";
export type AnimalPressure = "nilgai" | "boar" | "monkey" | "rabbit" | "birds";
export type Accessibility = "tractor" | "small_machinery" | "hand_tools";
export type BenchmarkComparison = "above" | "at" | "below";

// Group: Supervisor Observation
export type Gradient = "flat" | "slight" | "significant";
export type WaterloggingProbability = "low" | "medium" | "high";
export type SunlightAvailability = "unobstructed" | "partial" | "low";
export type FencingAvailability = "none" | "natural" | "stone_pitch" | "wire_fence" | "boundary_wall";

// Farmer-reported production for the previous crop on this farm.
export interface PreviousCropProduction {
  quintals: number | null;
  vsBenchmark: BenchmarkComparison | null;
}

export interface Farm {
  id: string;            // RJ{village}F{seq}  e.g. RJ001F001
  alias?: string;        // sanitized sequential id per village (F001…); see farm-aliases/ map
  farmerId: string;
  villageCode: string;
  photoId: string | null;
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
  irrigationAvailable?: IrrigationAvailable | null;
  seasonsPossible?: Season[];
  knownIssues?: KnownIssue[];
  previousCrop?: string;
  previousCropProduction?: PreviousCropProduction | null;
  animalPressure?: AnimalPressure[];
  accessibility?: Accessibility | null;

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
  id: string;            // {farmId}-{seq}  e.g. RJ001F001-001
  farmId: string;
  farmerId: string;
  seq: string;           // "001"
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  crop: string;
  sowingDate?: string;     // when the crop was sown (YYYY-MM-DD)

  // ---- Tests ----
  // Two independent tests, both live on the plot — different plots on the
  // same farm can have different readings, and either can be recorded
  // whether or not a soil sample was ever taken.
  waterTDS?: number | null;              // ppm
  soilTexture?: SoilTexture | null;
  testReportMediaId?: string | null;     // -> media table (photo/scan of the lab report)

  createdAt: number;
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
  farmId: string;
  farmerId: string;
  villageCode: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  pastCrops?: string;    // previous crop on this plot
  neoperkSampleId?: string;   // sample_id returned after submitting to the Neoperk scanner system
  submittedAt?: number;       // when submitted to Neoperk

  // Test results (water TDS, soil texture, lab report) live on the Farm
  // instead — both are independent of whether a soil sample was taken.

  createdAt: number;     // when scanned
  updatedAt: number;
  synced: boolean;
  deleted?: boolean;       // soft delete
}

// Soil texture as % clay / sand / silt (should sum to ~100, not enforced here).
export interface SoilTexture {
  clayPct: number | null;
  sandPct: number | null;
  siltPct: number | null;
}

export interface SessionLocation {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
  alt?: number | null;
  altAccuracy?: number | null;
}
