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
}

export interface Farm {
  id: string;            // RJ{village}F{seq}  e.g. RJ001F001
  farmerId: string;
  villageCode: string;
  photoId: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  createdAt: number;
  updatedAt: number;
  synced: boolean;
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
  createdAt: number;
  updatedAt: number;
  synced: boolean;
}

export interface Media {
  id: string;            // uuid-ish
  blob: Blob;
  createdAt: number;
  synced?: boolean;
  s3Key?: string;        // set after successful S3 upload
}

export interface SessionLocation {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
}
