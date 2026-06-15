import { db } from "./db";
import { REGION_PREFIX, villageByCode } from "./villages";
import { allocateNumber, getSession } from "./session";

const pad3 = (n: number) => String(n).padStart(3, "0");
const ab = (villageCode: string) => villageByCode(villageCode)?.idCode || villageCode;

// ID prefix resolution. The demo account uses DEMO- so its data is clearly
// separate; otherwise the prefix comes from the village's region (RJ / MP),
// falling back to the default REGION_PREFIX.
const PREFIX_BY_USER: Record<string, string> = { demo: "DEMO" };
const regionPrefix = (villageCode: string) => {
  const userPrefix = PREFIX_BY_USER[(getSession()?.username || "").toLowerCase()];
  if (userPrefix) return userPrefix;
  return villageByCode(villageCode)?.region || REGION_PREFIX;
};

// Farmer & farm numbers come from the user's allocated ID block, so two offline
// devices never produce the same id. The village abbreviation is the label.
//   Farmer: RJ-VELA-U001 (Rajasthan)   ·   MP-SUND-U001 (Madhya Pradesh)
export async function nextFarmerId(villageCode: string): Promise<string> {
  const n = await allocateNumber();
  return `${regionPrefix(villageCode)}-${ab(villageCode)}-U${pad3(n)}`;
}

export async function nextFarmId(villageCode: string): Promise<string> {
  const n = await allocateNumber();
  return `${regionPrefix(villageCode)}-${ab(villageCode)}-F${pad3(n)}`;
}

// Plots are scoped to their farm, so a local per-farm sequence is collision-safe:
//   {farmId}/{seq}   e.g. RJ-VELA-F001/001
export async function nextPlotId(farmId: string): Promise<{ id: string; seq: string }> {
  const existing = await db.plots.where("farmId").equals(farmId).toArray();
  const max = existing.reduce((m, p) => {
    const n = parseInt(p.seq, 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  const seq = pad3(max + 1);
  return { id: `${farmId}/${seq}`, seq };
}

export const uid = () =>
  "m_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
