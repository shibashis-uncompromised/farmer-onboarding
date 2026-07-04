// Pre-downloads Esri World Imagery tiles into the service worker's tile cache.
// Map drawing still works offline without tiles, but cached tiles keep the
// satellite backdrop visible in slow/no-network field conditions.

const TILE_CACHE = "map-tiles-v1";

export const ESRI_TILE_HOST = "server.arcgisonline.com";
export const ESRI_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const ESRI_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";

const tileUrl = (z: number, x: number, y: number) =>
  `https://${ESRI_TILE_HOST}/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

function lonToTileX(lon: number, zoom: number) {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}

function latToTileY(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom);
}

interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export function boundsAroundPoint(lat: number, lng: number, radiusKm = 1): Bounds {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    north: lat + latDelta,
    south: lat - latDelta,
    east: lng + lngDelta,
    west: lng - lngDelta,
  };
}

function tilesForBounds(bounds: Bounds, minZoom: number, maxZoom: number) {
  const urls: string[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const xMin = lonToTileX(bounds.west, z);
    const xMax = lonToTileX(bounds.east, z);
    const yMin = latToTileY(bounds.north, z);
    const yMax = latToTileY(bounds.south, z);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) urls.push(tileUrl(z, x, y));
    }
  }
  return urls;
}

export async function downloadTiles(
  bounds: Bounds,
  opts: { minZoom?: number; maxZoom?: number; delayMs?: number; onProgress?: (done: number, total: number) => void } = {}
) {
  if (typeof caches === "undefined") {
    throw new Error("Offline map cache is not available in this browser");
  }
  const { minZoom = 14, maxZoom = 18, delayMs = 25, onProgress } = opts;
  const urls = tilesForBounds(bounds, minZoom, maxZoom);
  const cache = await caches.open(TILE_CACHE);
  let done = 0;

  for (const url of urls) {
    const cached = await cache.match(url);
    if (!cached) {
      try {
        const res = await fetch(url);
        if (res.ok) await cache.put(url, res);
      } catch {
        // Keep going; a partial tile cache is still useful in the field.
      }
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    done++;
    onProgress?.(done, urls.length);
  }

  return { total: urls.length };
}
