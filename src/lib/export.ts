import JSZip from "jszip";
import { saveAs } from "file-saver";
import { db } from "./db";
import { villageByCode } from "./villages";
import { KG_PER_PACKET, seedsTotal } from "./seeds";
import type { Farmer } from "./types";

const seedsText = (seeds?: { seed: string; qty: number }[]) =>
  (seeds || []).map((s) => {
    const kg = KG_PER_PACKET[s.seed];
    return kg ? `${s.seed} x${s.qty} (${s.qty * kg} kg)` : `${s.seed} x${s.qty}`;
  }).join("; ");

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const toCSV = (head: string[], rows: unknown[][]) =>
  [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");

const fmtTs = (n: number) => new Date(n).toISOString();
const FARMER_HEADERS = ["Farmer ID", "Farmer First Name", "Farmer Last Name", "C/o First", "C/o Last", "C/o Relation"];
const farmerValues = (f?: Farmer) => [
  f?.id || "",
  f?.firstName || "",
  f?.lastName || "",
  f?.coFirstName || "",
  f?.coLastName || "",
  f?.coRelation || "",
];
const safeFileSegment = (s: string) =>
  (s || "")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
const farmerFileName = (f: Farmer) =>
  `${safeFileSegment(f.id)}_${safeFileSegment([f.firstName, f.lastName].filter(Boolean).join("_"))}`;
const farmerPhotoFile = (f: Farmer) => `photos/farmers/${farmerFileName(f)}.jpg`;
const farmPhotoFile = (farmId: string, farmer?: Farmer) =>
  `photos/farms/${safeFileSegment(farmId)}_${farmer ? farmerFileName(farmer) : "unknown_farmer"}.jpg`;

// Build a ZIP: CSV data plus farmer/farm photos named with the owning farmer.
export async function exportAllZip(): Promise<{ farmers: number }> {
  const [farmersAll, farmsAll, plotsAll, media, soilSamplesAll] = await Promise.all([
    db.farmers.toArray(),
    db.farms.toArray(),
    db.plots.toArray(),
    db.media.toArray(),
    db.soilSamples.toArray(),
  ]);
  // Exclude soft-deleted rows and any child rows whose parent is hidden.
  const farmers = farmersAll.filter((x) => !x.deleted);
  const farmerById = new Map(farmers.map((f) => [f.id, f]));
  const farms = farmsAll.filter((x) => !x.deleted && farmerById.has(x.farmerId));
  const farmById = new Map(farms.map((f) => [f.id, f]));
  const plots = plotsAll.filter((x) => !x.deleted && farmerById.has(x.farmerId) && farmById.has(x.farmId));
  const soilSamples = soilSamplesAll.filter((x) => !x.deleted && farmerById.has(x.farmerId) && farmById.has(x.farmId));
  const mediaMap = new Map(media.map((m) => [m.id, m.blob]));
  const zip = new JSZip();

  // farmers.csv
  zip.file(
    "farmers.csv",
    toCSV(
      ["Farmer ID","First Name","Last Name","C/o First","C/o Last","Relation","Phone","Smartphone","Note","Seeds","Total Packages","Village","Block","Bio Complete","Photo File","Created","Updated"],
      farmers.map((f) => {
        const v = villageByCode(f.villageCode);
        return [
          f.id, f.firstName, f.lastName, f.coFirstName, f.coLastName, f.coRelation,
          f.phone, f.hasSmartphone == null ? "" : f.hasSmartphone ? "Yes" : "No", f.note || "",
          seedsText(f.seeds), seedsTotal(f.seeds) || "",
          v?.name || f.villageCode, v?.block || "", f.bioComplete ? "Yes" : "No",
          f.photoId ? farmerPhotoFile(f) : "", fmtTs(f.createdAt), fmtTs(f.updatedAt),
        ];
      })
    )
  );

  // farms.csv
  zip.file(
    "farms.csv",
    toCSV(
      ["Farm ID", ...FARMER_HEADERS, "Village", "Latitude", "Longitude", "Accuracy (m)", "Boundary Points", "Boundary Coords", "Photo File", "Created"],
      farms.map((fm) => {
        const v = villageByCode(fm.villageCode);
        const farmer = farmerById.get(fm.farmerId);
        const bnd = fm.boundary || [];
        return [
          fm.id, ...farmerValues(farmer), v?.name || fm.villageCode, fm.lat ?? "", fm.lng ?? "",
          fm.accuracy ?? "",
          bnd.length || "",
          bnd.map((p) => `${p.lat.toFixed(6)} ${p.lng.toFixed(6)}`).join("; "),
          fm.photoId ? farmPhotoFile(fm.id, farmer) : "", fmtTs(fm.createdAt),
        ];
      })
    )
  );

  // plots.csv
  zip.file(
    "plots.csv",
    toCSV(
      ["Plot ID", "Farm ID", ...FARMER_HEADERS, "Plot No", "Crop", "Latitude", "Longitude", "Accuracy (m)", "Created"],
      plots.map((p) => [
        p.id, p.farmId, ...farmerValues(farmerById.get(p.farmerId)), p.seq, p.crop, p.lat ?? "", p.lng ?? "",
        p.accuracy ?? "", fmtTs(p.createdAt),
      ])
    )
  );

  // soil-samples.csv
  zip.file(
    "soil-samples.csv",
    toCSV(
      ["Sample Code", "Farm ID", ...FARMER_HEADERS, "Village", "Previous Crop", "Latitude", "Longitude", "Accuracy (m)", "Collected At"],
      soilSamples.map((s) => {
        const v = villageByCode(s.villageCode);
        return [
          s.code, s.farmId, ...farmerValues(farmerById.get(s.farmerId)), v?.name || s.villageCode, s.pastCrops || "",
          s.lat ?? "", s.lng ?? "", s.accuracy ?? "", fmtTs(s.createdAt),
        ];
      })
    )
  );

  // Photos are exported only for visible farmers/farms.
  const farmerPhotos = zip.folder("photos/farmers")!;
  const farmPhotos = zip.folder("photos/farms")!;
  for (const f of farmers) {
    if (f.photoId && mediaMap.has(f.photoId)) farmerPhotos.file(`${farmerFileName(f)}.jpg`, mediaMap.get(f.photoId)!);
  }
  for (const fm of farms) {
    const farmer = farmerById.get(fm.farmerId);
    if (fm.photoId && mediaMap.has(fm.photoId)) farmPhotos.file(`${safeFileSegment(fm.id)}_${farmer ? farmerFileName(farmer) : "unknown_farmer"}.jpg`, mediaMap.get(fm.photoId)!);
  }

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  saveAs(blob, `farmer-onboarding-export_${stamp}.zip`);
  return { farmers: farmers.length };
}
