import JSZip from "jszip";
import { saveAs } from "file-saver";
import { db } from "./db";
import { villageByCode } from "./villages";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const toCSV = (head: string[], rows: unknown[][]) =>
  "﻿" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");

const fmtTs = (n: number) => new Date(n).toISOString();

// Build a ZIP: farmers.csv, farms.csv, plots.csv + photos named by ID.
export async function exportAllZip(): Promise<{ farmers: number }> {
  const [farmers, farms, plots, media] = await Promise.all([
    db.farmers.toArray(),
    db.farms.toArray(),
    db.plots.toArray(),
    db.media.toArray(),
  ]);
  const mediaMap = new Map(media.map((m) => [m.id, m.blob]));
  const zip = new JSZip();

  // farmers.csv
  zip.file(
    "farmers.csv",
    toCSV(
      ["Farmer ID","First Name","Last Name","C/o First","C/o Last","Relation","Phone","Smartphone","Village","Block","Bio Complete","Photo File","Created","Updated"],
      farmers.map((f) => {
        const v = villageByCode(f.villageCode);
        return [
          f.id, f.firstName, f.lastName, f.coFirstName, f.coLastName, f.coRelation,
          f.phone, f.hasSmartphone == null ? "" : f.hasSmartphone ? "Yes" : "No",
          v?.name || f.villageCode, v?.block || "", f.bioComplete ? "Yes" : "No",
          f.photoId ? `photos/${f.id}.jpg` : "", fmtTs(f.createdAt), fmtTs(f.updatedAt),
        ];
      })
    )
  );

  // farms.csv
  zip.file(
    "farms.csv",
    toCSV(
      ["Farm ID","Farmer ID","Village","Latitude","Longitude","Accuracy (m)","Photo File","Created"],
      farms.map((fm) => {
        const v = villageByCode(fm.villageCode);
        return [
          fm.id, fm.farmerId, v?.name || fm.villageCode, fm.lat ?? "", fm.lng ?? "",
          fm.accuracy ?? "", fm.photoId ? `photos/${fm.id}.jpg` : "", fmtTs(fm.createdAt),
        ];
      })
    )
  );

  // plots.csv
  zip.file(
    "plots.csv",
    toCSV(
      ["Plot ID","Farm ID","Farmer ID","Plot No","Crop","Latitude","Longitude","Accuracy (m)","Created"],
      plots.map((p) => [
        p.id, p.farmId, p.farmerId, p.seq, p.crop, p.lat ?? "", p.lng ?? "",
        p.accuracy ?? "", fmtTs(p.createdAt),
      ])
    )
  );

  // photos named by their owning ID
  const photos = zip.folder("photos")!;
  for (const f of farmers) {
    if (f.photoId && mediaMap.has(f.photoId)) photos.file(`${f.id}.jpg`, mediaMap.get(f.photoId)!);
  }
  for (const fm of farms) {
    if (fm.photoId && mediaMap.has(fm.photoId)) photos.file(`${fm.id}.jpg`, mediaMap.get(fm.photoId)!);
  }

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  saveAs(blob, `farmer-onboarding-export_${stamp}.zip`);
  return { farmers: farmers.length };
}
