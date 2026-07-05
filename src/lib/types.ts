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
  note: string;             // optional note from the onboarding team
  photoId: string | null;   // -> media table
  seeds?: SeedPackage[];    // seed packages for this farmer (rides in the synced record)
  bioComplete: boolean;
  createdAt: number;
  updatedAt: number;
  synced: boolean;
  deleted?: boolean;       // soft delete — hidden from all views when true
}

export interface Farm {
  id: string;            // RJ{village}F{seq}  e.g. RJ001F001
  farmerId: string;
  villageCode: string;
  photoId: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  boundary?: BoundaryPoint[];   // optional polygon: GPS points captured at corners
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
  createdAt: number;
  updatedAt: number;
  synced: boolean;
  deleted?: boolean;       // soft delete
}

export interface Media {
  id: string;            // uuid-ish
  blob: Blob;
  createdAt: number;
  synced?: boolean;
  s3Key?: string;        // set after successful S3 upload
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
  createdAt: number;     // when scanned
  updatedAt: number;
  synced: boolean;
  deleted?: boolean;       // soft delete
}

export interface SessionLocation {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
}
