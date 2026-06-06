// ---- Core domain types ----
// Designed local-first (IndexedDB). A future backend sync can reuse these
// shapes; `synced`/`updatedAt` fields are included with that in mind.

export type OnboardingStatus = "not_started" | "pending" | "completed";

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
  photoId: string | null;   // -> media table
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
}

export interface SessionLocation {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
}
