"use client";

import { useEffect, useRef } from "react";
import { Box } from "@mantine/core";
import L from "leaflet";
import type { BoundaryPoint } from "@/lib/types";
import { ESRI_ATTRIBUTION, ESRI_TILE_URL } from "@/lib/offlineTiles";

const FALLBACK_CENTER: [number, number] = [23.0451, 72.5321];

interface Props {
  boundary?: BoundaryPoint[];
  markerLat?: number | null;
  markerLng?: number | null;
  height?: number;
}

export default function FarmBoundaryPreview({ boundary, markerLat, markerLng, height = 220 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: false });
    mapRef.current = map;
    L.tileLayer(ESRI_TILE_URL, { attribution: ESRI_ATTRIBUTION, maxZoom: 19 }).addTo(map);

    const hasBoundary = boundary && boundary.length >= 3;
    let bounds: L.LatLngBounds | null = null;
    if (hasBoundary) {
      const poly = L.polygon(boundary!.map((p) => L.latLng(p.lat, p.lng)), {
        color: "#f59e0b",
        weight: 3,
        fillOpacity: 0.16,
      }).addTo(map);
      bounds = poly.getBounds();
    }
    if (markerLat != null && markerLng != null) {
      const marker = L.circleMarker([markerLat, markerLng], {
        radius: 6,
        color: "#047857",
        weight: 2,
        fillColor: "#10b981",
        fillOpacity: 0.9,
      }).addTo(map);
      bounds = bounds ? bounds.extend(marker.getLatLng()) : L.latLngBounds([marker.getLatLng()]);
    }

    if (bounds) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 18 });
    else map.setView(FALLBACK_CENTER, 15);
    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box>
      <div ref={containerRef} style={{ height, width: "100%", borderRadius: 8, overflow: "hidden" }} />
    </Box>
  );
}
