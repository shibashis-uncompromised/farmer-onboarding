import { db } from "./db";
import { REGION_PREFIX, villageByCode } from "./villages";

const pad3 = (n: number) => String(n).padStart(3, "0");

// village (numeric) code -> ID abbreviation (e.g. "001" -> "VELA")
const idCodeOf = (villageCode: string) => villageByCode(villageCode)?.idCode || villageCode;

// Next farmer id: RJ-{idCode}-U{seq}. Sequence is per idCode, so villages that
// share an idCode (Belua 1 & 2 → BELU) share one running sequence.
export async function nextFarmerId(villageCode: string): Promise<string> {
  const ab = idCodeOf(villageCode);
  const re = new RegExp(`^${REGION_PREFIX}-${ab}-U(\\d+)$`);
  const farmers = await db.farmers.toArray();
  const max = farmers.reduce((m, f) => {
    const mm = f.id.match(re);
    return mm ? Math.max(m, parseInt(mm[1], 10)) : m;
  }, 0);
  return `${REGION_PREFIX}-${ab}-U${pad3(max + 1)}`;
}

// Next farm id: RJ-{idCode}-F{seq}
export async function nextFarmId(villageCode: string): Promise<string> {
  const ab = idCodeOf(villageCode);
  const re = new RegExp(`^${REGION_PREFIX}-${ab}-F(\\d+)$`);
  const farms = await db.farms.toArray();
  const max = farms.reduce((m, f) => {
    const mm = f.id.match(re);
    return mm ? Math.max(m, parseInt(mm[1], 10)) : m;
  }, 0);
  return `${REGION_PREFIX}-${ab}-F${pad3(max + 1)}`;
}

// Next plot id within a farm: {farmId}/{seq}  e.g. RJ-FTHP-F001/001
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
