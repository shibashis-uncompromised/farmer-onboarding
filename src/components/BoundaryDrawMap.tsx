"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet-draw"; // extends the global L with L.Control.Draw / L.Draw.Event
import { Box, Text } from "@mantine/core";
import type { BoundaryPoint } from "@/lib/types";


import "leaflet/dist/leaflet.css";

import "leaflet-draw/dist/leaflet.draw.css";

// Bundlers strip the default marker icon paths — point them at a CDN.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const FALLBACK_CENTER: [number, number] = [23.0451, 72.5321];
const DEFAULT_ZOOM = 17;

const ESRI_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";

interface Props {
  points: BoundaryPoint[];
  onChange: (points: BoundaryPoint[]) => void;
  centerHint?: { lat: number; lng: number } | null;
}

function layerToPoints(layer: L.Layer): BoundaryPoint[] {
  const latlngs = (layer as L.Polygon).getLatLngs()[0] as L.LatLng[];
  const now = Date.now();
  return latlngs.map((p, i) => ({
    lat: Number(p.lat.toFixed(6)),
    lng: Number(p.lng.toFixed(6)),
    accuracy: 0,
    at: now + i,
  }));
}

export default function BoundaryDrawMap({ points, onChange, centerHint }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    const center: [number, number] = centerHint
      ? [centerHint.lat, centerHint.lng]
      : FALLBACK_CENTER;
    const map = L.map(containerRef.current).setView(center, DEFAULT_ZOOM);
    mapRef.current = map;

    L.tileLayer(ESRI_TILE_URL, { attribution: ESRI_ATTRIBUTION, maxZoom: 19 }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    if (points.length >= 3) {
      const latlngs = points.map((p) => L.latLng(p.lat, p.lng));
      L.polygon(latlngs, { color: "#ffe14d" }).addTo(drawnItems);
    }

    const drawControl = new (L.Control as any).Draw({
      draw: {
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false,
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: { color: "#ffe14d" },
        },
      },
      edit: { featureGroup: drawnItems, remove: true },
    });
    map.addControl(drawControl);

    map.on((L as any).Draw.Event.CREATED, (e: any) => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);
      onChangeRef.current(layerToPoints(e.layer));
    });
    map.on((L as any).Draw.Event.EDITED, (e: any) => {
      e.layers.eachLayer((layer: L.Layer) => onChangeRef.current(layerToPoints(layer)));
    });
    map.on((L as any).Draw.Event.DELETED, () => {
      onChangeRef.current([]);
    });

    if (!centerHint && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled || mapRef.current !== map) return;
          try {
            map.setView([pos.coords.latitude, pos.coords.longitude], DEFAULT_ZOOM, { animate: false });
          } catch {
            // ignore
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }

    return () => {
      cancelled = true;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter if centerHint changes AFTER the map already exists (e.g. typing
  // manual coordinates after the modal already opened and initialized).
  // Skipped once a boundary has been drawn, so it won't yank the view away
  // from in-progress work.
  useEffect(() => {
    if (!mapRef.current || !centerHint) return;
    if (points.length === 0) {
      mapRef.current.setView([centerHint.lat, centerHint.lng], DEFAULT_ZOOM);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerHint?.lat, centerHint?.lng]);

  return (
    <Box>
      <div ref={containerRef} style={{ height: 320, width: "100%", borderRadius: 8 }} />
      <Text size="xs" c="dimmed" mt={6}>
        Tap the polygon tool, then trace the boundary corner by corner. Tap the
        first point again to close the shape.
      </Text>
    </Box>
  );
}
