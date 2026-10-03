import { API_BASE } from "./config";

// fetch() never times out on its own — a stalled connection would hang sync
// forever (infinite "syncing" spinner). Abort after `timeoutMs` so the caller
// rejects, the sync guard resets, and the next tick retries cleanly.
export async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function req(path: string, opts: RequestInit = {}, timeoutMs = 8000) {
  let res: Response;
  try {
    res = await fetchWithTimeout(API_BASE + path, {
      ...opts,
      headers: { "content-type": "application/json", ...(opts.headers || {}) },
    }, timeoutMs);
  } catch (e: any) {
    throw new Error(e?.name === "AbortError" ? "Request timed out" : (e?.message || "Network error"));
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export type Role = "admin" | "reviewer" | "poc";

export interface LoginResp {
  token: string;
  username: string;
  role: Role;
  blockSize: number;
  blocks: { start: number; end: number }[];
}

export const apiLogin = (username: string, password: string): Promise<LoginResp> =>
  req("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });

// NOTE: the token is sent in the BODY (not just the Authorization header)
// because CloudFront strips Authorization but always forwards the POST body.
export const apiAllocate = (token: string) =>
  req("/api/id-blocks/allocate", { method: "POST", body: JSON.stringify({ token }) });

export const apiSync = (token: string, payload: object) =>
  req("/api/sync", { method: "POST", body: JSON.stringify({ token, ...payload }) });

export const apiPull = (token: string): Promise<{ farmers: any[]; farms: any[]; plots: any[]; media?: any[]; soilSamples?: any[]; soilTextureTests?: any[]; waterTDSTests?: any[]; villages?: any[] }> =>
  req("/api/pull", { method: "POST", body: JSON.stringify({ token }) });

export const apiPresignMedia = (
  token: string,
  mediaId: string,
  mimeType: string
): Promise<{ uploadUrl: string; s3Key: string }> =>
  req("/api/media/presign", { method: "POST", body: JSON.stringify({ token, mediaId, mimeType }) });

// Elevation lookup — proxied through our backend so the Google Maps API key
// never ships to the client. Used to auto-fetch real elevation data for a
// farm boundary's corners (falls back to GPS altitude if this fails/offline).
export interface ElevationPoint {
  lat: number;
  lng: number;
  elevation: number;
  resolution?: number | null;
}
export const apiElevation = (
  token: string,
  points: { lat: number; lng: number }[]
): Promise<{ elevations: ElevationPoint[] }> =>
  req("/api/elevation", { method: "POST", body: JSON.stringify({ token, points }) }, 8000);

// ---- Admin: user management ----
export interface AdminUser {
  id: number;
  username: string;
  role: Role;
  created_at: string;
}

// NOTE: the token rides in the JSON body (not just the Authorization header),
// same reason apiSync/apiPull/apiAllocate do it — CloudFront strips the
// Authorization header but always forwards the body. Listing uses the POST
// alias (not the plain GET) because a body isn't reliably forwarded on GET.
export const apiListUsers = (token: string): Promise<{ users: AdminUser[] }> =>
  req("/api/admin/users/list", { method: "POST", body: JSON.stringify({ token }) });

export const apiCreateUser = (
  token: string,
  body: { username: string; password: string; role: Role }
): Promise<{ user: AdminUser }> =>
  req("/api/admin/users", { method: "POST", body: JSON.stringify({ token, ...body }) });

export const apiUpdateUser = (
  token: string,
  id: number,
  body: { username?: string; password?: string; role?: Role }
): Promise<{ user: AdminUser }> =>
  req(`/api/admin/users/${id}`, { method: "PUT", body: JSON.stringify({ token, ...body }) });

export const apiDeleteUser = (token: string, id: number): Promise<{ ok: true }> =>
  req(`/api/admin/users/${id}`, { method: "DELETE", body: JSON.stringify({ token }) });

// ---- Admin: dynamic-field version history (read-only) ----
export type EntityType = "farmer" | "farm" | "plot";
export type VersionStatus = "pending" | "current" | "rejected" | "retired";

export interface EntityVersion {
  id: number;
  entity_type: EntityType;
  entity_id: string;
  version_no: number;
  status: VersionStatus;
  data: Record<string, any>;
  // The same entity's immediately-prior version (version_no - 1), regardless
  // of its own status — null for version 1. Used to show what actually
  // changed rather than re-listing the whole current snapshot.
  previous_data: Record<string, any> | null;
  submitted_by: string | null;
  // BIGINT columns come back from the pg driver as strings, not numbers —
  // callers should coerce with Number(...) before treating these as epoch ms.
  submitted_at: number | string | null;
  reviewed_by: string | null;
  reviewed_at: number | string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntityVersionFilters {
  status?: VersionStatus | "all";
  entityType?: EntityType | "all";
  entityId?: string;
  submittedBy?: string;
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
}

// Read-only history across every farmer/farm/plot dynamic-field version —
// no edit/approve/reject affordance here, that lives on the review queue.
export const apiListEntityVersions = (
  token: string,
  filters: EntityVersionFilters = {}
): Promise<{ versions: EntityVersion[]; total: number }> =>
  req("/api/admin/entity-versions/list", { method: "POST", body: JSON.stringify({ token, ...filters }) });

// Admin's own direct edit to an entity's dynamic fields — skips the pending
// queue entirely and becomes the current version immediately (see the
// direct: true path of submitEntityVersion on the backend).
export interface DirectUpdatePayload {
  entityType: EntityType;
  entityId: string;
  dynamicData: Record<string, any>;
}
export const apiDirectUpdateEntityVersion = (
  token: string,
  payload: DirectUpdatePayload
): Promise<{ ok: true }> =>
  req("/api/admin/entity-versions/direct-update", { method: "POST", body: JSON.stringify({ token, ...payload }) });

// ---- Admin: pending-version review queue (approve/reject) ----
// A POC's submission sits as `pending` until admin approves (becomes
// `current`, retiring whatever was `current` before it) or rejects it
// (stays around as `rejected` for the audit trail, entity is untouched).
export const apiApproveEntityVersion = (
  token: string,
  id: number,
  note?: string
): Promise<{ ok: true }> =>
  req(`/api/admin/entity-versions/${id}/approve`, { method: "POST", body: JSON.stringify({ token, note }) });

export const apiRejectEntityVersion = (
  token: string,
  id: number,
  note?: string
): Promise<{ ok: true }> =>
  req(`/api/admin/entity-versions/${id}/reject`, { method: "POST", body: JSON.stringify({ token, note }) });

// Bulk counterpart of apiApproveEntityVersion — approves every still-pending
// submission matching these filters (same shape as apiListEntityVersions,
// minus status which is always implicitly "pending") in one call.
export interface ApproveAllFilters {
  entityType?: EntityType | "all";
  entityId?: string;
  submittedBy?: string;
  from?: number;
  to?: number;
  note?: string;
}
export interface ApproveAllResult {
  approved: number;
  total: number;
  failed: { id: number; entityType: EntityType; entityId: string; error: string }[];
}
export const apiApproveAllEntityVersions = (
  token: string,
  filters: ApproveAllFilters = {}
): Promise<ApproveAllResult> =>
  req("/api/admin/entity-versions/approve-all", { method: "POST", body: JSON.stringify({ token, ...filters }) });

// ---- Admin: Publish to TerraOS ----
// Onboarding backend → uc-core (TerraOS). Separate from apiSync/apiPull,
// which move data between this device and the onboarding backend.
export type PublishEntityType =
  | "village" | "farmer" | "farm" | "plot" | "cultivation"
  | "soil_sample" | "soil_texture_test" | "water_tds_test";
export type PublishChange = "new" | "changed" | "deleted";
export type PublishStatus =
  | "would_create" | "would_update" | "would_delete"
  | "created" | "updated" | "deleted" | "skipped"
  | "conflict" | "error";

export interface PublishConflict {
  kind: "name" | "modified" | "missing" | "unlinked";
  message: string;
  candidates?: { id: string; label: string }[];
  terraos?: Record<string, any>;
}

export interface PublishItem {
  type: PublishEntityType;
  sourceId: string;
  label: string;
  change?: PublishChange;
  status: PublishStatus;
  conflict: PublishConflict | null;
  error: string | null;
  warnings: string[];
  /** Preview only: fails just because this parent isn't in TerraOS yet — fix the parent. */
  waitingFor?: { type: PublishEntityType; sourceId: string; label: string; skipped?: boolean };
  onboarding?: Record<string, any>;
  /** The record as sent (or, in a preview, as it will be sent) to TerraOS. */
  sent?: {
    type: PublishEntityType;
    sourceId: string;
    deleted?: boolean;
    data: Record<string, any>;
    source?: Record<string, any>;
    photos?: { mediaId: string; mimeType?: string }[];
    resolution?: PublishResolution;
  } | null;
  targetId?: string | null;
  /** Run history only: where this record stands right now. */
  current?: PublishCurrent | null;
  /** Preview only: how this change can be undone in onboarding if TerraOS won't take it. */
  revert?: "discard" | "restore" | "skip" | null;
}

export type PublishCurrentState =
  | "up_to_date" | "changed" | "conflict" | "error" | "skipped"
  | "deleted" | "discarded" | "not_published" | "gone";

export interface PublishCurrent {
  now: PublishCurrentState;
  inTerraos: boolean;
  targetId: string | null;
  publishedAt: string | null;
  revert: { action: "discard" | "restore" | "skip" | "unskip"; by: string; at: string } | null;
}

export type PublishResolution = "overwrite" | "create_new" | "skip" | { linkTo: string };

export interface PublishRun {
  id: number;
  started_by: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "completed" | "failed";
  counts: Partial<Record<PublishStatus, number>> | null;
  results: PublishItem[] | null;
  error: string | null;
  progress?: PublishProgress | null;
}

// Preview and publish run as background jobs on the server (they can take
// minutes — longer than CloudFront waits), so these start one and poll it.
export type PublishProgress = { done: number; total: number };
const POLL_MS = 2000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function apiPublishPreview(
  token: string,
  onProgress?: (p: PublishProgress) => void
): Promise<{ upToDate: number; counts: Partial<Record<PublishStatus, number>>; items: PublishItem[] }> {
  const { jobId } = await req("/api/admin/publish/preview", { method: "POST", body: JSON.stringify({ token }) });
  for (;;) {
    await sleep(POLL_MS);
    const j = await req(`/api/admin/publish/preview/${jobId}`, { method: "POST", body: JSON.stringify({ token }) });
    if (j.progress) onProgress?.(j.progress);
    if (j.status === "done") return j;
    if (j.status === "failed") throw new Error(j.error || "Check failed");
  }
}

export async function apiPublishRun(
  token: string,
  resolutions: Record<string, PublishResolution>,
  onProgress?: (p: PublishProgress) => void,
  /** Publish only these "type:sourceId" keys (+ parents they need); omit for all. */
  only?: string[]
): Promise<PublishRun> {
  const { runId } = await req("/api/admin/publish/run", { method: "POST", body: JSON.stringify({ token, resolutions, only }) });
  for (;;) {
    await sleep(POLL_MS);
    const run: PublishRun = await req(`/api/admin/publish/runs/${runId}/status`, { method: "POST", body: JSON.stringify({ token }) });
    if (run.progress) onProgress?.(run.progress);
    if (run.status === "completed") return run;
    if (run.status === "failed") throw new Error(run.error || "Publish failed");
  }
}

export const apiPublishRuns = (token: string, limit = 20): Promise<{ configured: boolean; runs: PublishRun[] }> =>
  req("/api/admin/publish/runs", { method: "POST", body: JSON.stringify({ token, limit }) });

export const apiPublishRunItems = (
  token: string,
  runId: number,
  filters: { status?: string; type?: string; search?: string; limit?: number; offset?: number } = {}
): Promise<{ run: PublishRun; total: number; items: PublishItem[] }> =>
  req(`/api/admin/publish/runs/${runId}/items`, { method: "POST", body: JSON.stringify({ token, ...filters }) });

// Undo a pending change in ONBOARDING (TerraOS untouched): "discard" soft-
// deletes a never-published record; "restore" puts it back to what TerraOS has.
export const apiPublishRevert = (
  token: string,
  type: PublishEntityType,
  sourceId: string
): Promise<{ ok: true; action: "discard" | "restore" | "skip" }> =>
  req("/api/admin/publish/revert", { method: "POST", body: JSON.stringify({ token, type, sourceId }) }, 60000);

// Skipped records are treated as done and never sent again unless they
// change; un-skipping sends them on the next check/publish.
export interface SkippedRecord {
  type: PublishEntityType;
  sourceId: string;
  label: string;
  inTerraos: boolean;
  skippedAt: string;
  current: boolean;   // false = changed since the skip, so already pending again
  children: number;   // records under it (they can't publish without it)
}
export const apiPublishSkipped = (token: string): Promise<{ skipped: SkippedRecord[] }> =>
  req("/api/admin/publish/skipped", { method: "POST", body: JSON.stringify({ token }) }, 60000);
export const apiPublishUnskip = (token: string, keys: string[]): Promise<{ ok: true; unskipped: number }> =>
  req("/api/admin/publish/unskip", { method: "POST", body: JSON.stringify({ token, keys }) });

// ---- Admin: edit any record directly (applies immediately, no approval) ----
// `changes` may hold any editable field — names, phone, farm/plot name, survey
// fields, crop… — null or "" clears it. Versioned fields become a new current
// version, so Version History still shows the edit.
export const apiAdminUpdateRecord = (
  token: string,
  entityType: EntityType,
  entityId: string,
  changes: Record<string, any>
): Promise<{ ok: true; record: Record<string, any> }> =>
  req("/api/admin/records/update", { method: "POST", body: JSON.stringify({ token, entityType, entityId, changes }) });

// ---- Admin: villages (name / block / district / state; region + ID code locked) ----
export interface AdminVillage {
  code: string; name: string; block: string; idCode: string; region: string; state: string; district: string;
  createdBy?: string | null; preset: boolean; edited: boolean; farmers: number;
}
export const apiAdminListVillages = (token: string): Promise<{ villages: AdminVillage[] }> =>
  req("/api/admin/villages/list", { method: "POST", body: JSON.stringify({ token }) });
export const apiAdminUpdateVillage = (
  token: string,
  code: string,
  changes: Partial<Pick<AdminVillage, "name" | "block" | "district" | "state">>
): Promise<{ ok: true; village: AdminVillage }> =>
  req("/api/admin/villages/update", { method: "POST", body: JSON.stringify({ token, code, changes }) });

// ---- Admin: plot cultivations (admin-only; supervisors never see them) ----
export interface Cultivation {
  id: string;
  plotId: string;
  farmId: string;
  farmerId: string | null;
  crop: string;
  variety: string;
  cropPlan: string;
  startDate: string;       // YYYY-MM-DD (sowing)
  endDate: string | null;  // set when the season is closed
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}
export type CultivationInput = Pick<Cultivation, "crop" | "variety" | "cropPlan" | "startDate"> & {
  endDate?: string | null;
  notes?: string | null;
};

export const apiListCultivations = (token: string, filter: { plotId?: string; farmId?: string } = {}): Promise<{ cultivations: Cultivation[] }> =>
  req("/api/admin/cultivations/list", { method: "POST", body: JSON.stringify({ token, ...filter }) });

export const apiCreateCultivation = (token: string, plotId: string, body: CultivationInput): Promise<{ cultivation: Cultivation }> =>
  req("/api/admin/cultivations/create", { method: "POST", body: JSON.stringify({ token, plotId, ...body }) });

export const apiUpdateCultivation = (token: string, id: string, body: Partial<CultivationInput>): Promise<{ cultivation: Cultivation }> =>
  req(`/api/admin/cultivations/${encodeURIComponent(id)}/update`, { method: "POST", body: JSON.stringify({ token, ...body }) });

export const apiDeleteCultivation = (token: string, id: string): Promise<{ ok: true }> =>
  req(`/api/admin/cultivations/${encodeURIComponent(id)}/delete`, { method: "POST", body: JSON.stringify({ token }) });

// ---- Admin: crop plans (per farm; must be defined before cultivations) ----
// name = "<Season> <Year> <Farm ID>", built by the server.
export interface CropPlan {
  id: number;
  farmId: string;
  season: string;
  year: number;
  name: string;
  createdBy: string | null;
  createdAt: string;
  cultivations: number;  // how many (non-deleted) cultivations use it
}

export const apiListCropPlans = (token: string, farmId?: string): Promise<{ cropPlans: CropPlan[] }> =>
  req("/api/admin/crop-plans/list", { method: "POST", body: JSON.stringify({ token, farmId }) });

export const apiCreateCropPlan = (token: string, farmId: string, season: string, year: number): Promise<{ cropPlan: CropPlan }> =>
  req("/api/admin/crop-plans/create", { method: "POST", body: JSON.stringify({ token, farmId, season, year }) });

export const apiDeleteCropPlan = (token: string, id: number): Promise<{ ok: true }> =>
  req(`/api/admin/crop-plans/${id}/delete`, { method: "POST", body: JSON.stringify({ token }) });
