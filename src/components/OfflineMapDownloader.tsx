"use client";

import { useMemo, useState } from "react";
import {
  Badge, Button, Group, NumberInput, Paper, Progress, Stack, Table, Text, Textarea, ThemeIcon,
} from "@mantine/core";
import { CloudArrowDown, MapPin, Warning, CheckCircle, XCircle } from "@phosphor-icons/react";
import { notifications } from "@mantine/notifications";
import AppModal from "./AppModal";
import { downloadTiles, boundsAroundPoint, estimateDownload } from "@/lib/offlineTiles";

const MIN_ZOOM = 14;
const MAX_ZOOM = 17; // 18 quadruples tile count for marginal extra detail — see notes below
const RADIUS_KM = 2;

interface Props {
  opened: boolean;
  onClose: () => void;
}

interface ParsedRow {
  name: string;
  lat: number | null;
  lng: number | null;
  valid: boolean;
  status: "pending" | "downloading" | "done" | "failed";
}

// Accepts pasted tab-separated rows like:
//   Farm Name    Latitude    Longitude
//   Badi         24.625546   73.642882
//   Sarai 3      N/A         N/A
// Skips a header row automatically (detected as the first line if its
// lat/lng columns don't parse as numbers), and marks N/A / unparsable rows
// invalid rather than dropping them silently, so you can see what's missing.
function parseBulkInput(text: string): ParsedRow[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const rows: ParsedRow[] = [];
  lines.forEach((line, i) => {
    const parts = line.split(/\t+/).map((p) => p.trim());
    if (parts.length < 3) return;
    const [name, latStr, lngStr] = parts;
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    const looksLikeHeader = i === 0 && Number.isNaN(lat) && Number.isNaN(lng);
    if (looksLikeHeader) return;
    const valid = !Number.isNaN(lat) && !Number.isNaN(lng);
    rows.push({
      name: name || "Unnamed",
      lat: valid ? lat : null,
      lng: valid ? lng : null,
      valid,
      status: "pending",
    });
  });
  return rows;
}

export default function OfflineMapDownloader({ opened, onClose }: Props) {
  // ---- Single coordinate ----
  const [singleLat, setSingleLat] = useState<number | "">("");
  const [singleLng, setSingleLng] = useState<number | "">("");
  const [singleDownloading, setSingleDownloading] = useState(false);
  const [singleProgress, setSingleProgress] = useState<{ done: number; total: number } | null>(null);

  const singleEstimate = useMemo(() => {
    if (singleLat === "" || singleLng === "") return null;
    const bounds = boundsAroundPoint(Number(singleLat), Number(singleLng), RADIUS_KM);
    return estimateDownload(bounds, MIN_ZOOM, MAX_ZOOM);
  }, [singleLat, singleLng]);

  const downloadSingle = async () => {
    if (singleLat === "" || singleLng === "") return;
    setSingleDownloading(true);
    setSingleProgress(null);
    try {
      const bounds = boundsAroundPoint(Number(singleLat), Number(singleLng), RADIUS_KM);
      const { total } = await downloadTiles(bounds, { minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM }, {
        onProgress: (done, total) => setSingleProgress({ done, total }),
      });
      notifications.show({ color: "green", message: `Downloaded ${total} tiles` });
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Download failed" });
    } finally {
      setSingleDownloading(false);
      setSingleProgress(null);
    }
  };

  // ---- Bulk paste ----
  const [bulkText, setBulkText] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkOverall, setBulkOverall] = useState<{ done: number; total: number } | null>(null);

  const validRows = rows.filter((r) => r.valid);
  const bulkEstimate = useMemo(() => {
    if (validRows.length === 0) return null;
    // Sum estimated tiles across all valid rows (each gets its own bounds).
    let totalTiles = 0;
    for (const r of validRows) {
      const bounds = boundsAroundPoint(r.lat as number, r.lng as number, RADIUS_KM);
      totalTiles += estimateDownload(bounds, MIN_ZOOM, MAX_ZOOM).tileCount;
    }
    return { tileCount: totalTiles, estimatedMB: Math.round((totalTiles * 20) / 1024 * 10) / 10 };
  }, [validRows]);

  const parseBulk = () => {
    const parsed = parseBulkInput(bulkText);
    setRows(parsed);
    if (parsed.length === 0) {
      notifications.show({ color: "red", message: "Couldn't parse any rows — check the pasted format" });
    }
  };

  const downloadAll = async () => {
    setBulkRunning(true);
    setBulkOverall({ done: 0, total: validRows.length });
    let completed = 0;
    for (const row of rows) {
      if (!row.valid) continue;
      setRows((prev) => prev.map((r) => (r === row ? { ...r, status: "downloading" } : r)));
      try {
        const bounds = boundsAroundPoint(row.lat as number, row.lng as number, RADIUS_KM);
        await downloadTiles(bounds, { minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM });
        setRows((prev) => prev.map((r) => (r === row ? { ...r, status: "done" } : r)));
      } catch {
        setRows((prev) => prev.map((r) => (r === row ? { ...r, status: "failed" } : r)));
      }
      completed++;
      setBulkOverall({ done: completed, total: validRows.length });
    }
    setBulkRunning(false);
    notifications.show({ color: "green", message: `Finished — ${completed} location(s) processed` });
  };

  return (
    <AppModal opened={opened} onClose={onClose} title="Offline maps">
      <Stack gap="lg">
        {/* ---- Single coordinate ---- */}
        <Paper withBorder radius="md" p="sm">
          <Text size="sm" fw={600} mb={8}>Download a single location</Text>
          <Group gap={8} grow mb={8}>
            <NumberInput
              label="Latitude" placeholder="24.625546" decimalScale={6} size="xs"
              value={singleLat} onChange={(v) => setSingleLat(v === "" ? "" : Number(v))}
            />
            <NumberInput
              label="Longitude" placeholder="73.642882" decimalScale={6} size="xs"
              value={singleLng} onChange={(v) => setSingleLng(v === "" ? "" : Number(v))}
            />
          </Group>
          {singleEstimate && (
            <Text size="xs" c="dimmed" mb={8}>
              ≈{singleEstimate.tileCount} tiles · ~{singleEstimate.estimatedMB}MB · {RADIUS_KM}km radius
            </Text>
          )}
          <Button
            size="xs" leftSection={<CloudArrowDown size={16} />} fullWidth
            onClick={downloadSingle} loading={singleDownloading}
            disabled={singleLat === "" || singleLng === ""}
          >
            Download
          </Button>
          {singleProgress && (
            <Progress value={(singleProgress.done / singleProgress.total) * 100} size="sm" mt={8} />
          )}
        </Paper>

        {/* ---- Bulk paste ---- */}
        <Paper withBorder radius="md" p="sm">
          <Text size="sm" fw={600} mb={8}>Bulk paste (Name, Latitude, Longitude)</Text>
          <Textarea
            placeholder={"Farm Name\tLatitude\tLongitude\nBadi\t24.625546\t73.642882\nBloom\t24.625851\t73.656885"}
            minRows={4} autosize maxRows={8} size="xs"
            value={bulkText} onChange={(e) => setBulkText(e.currentTarget.value)}
            styles={{ input: { fontFamily: "monospace" } }}
          />
          <Group justify="space-between" mt={8}>
            <Text size="xs" c="dimmed">Paste directly from a spreadsheet (tab-separated)</Text>
            <Button size="xs" variant="light" onClick={parseBulk}>Parse</Button>
          </Group>

          {rows.length > 0 && (
            <>
              <Table mt={12} withRowBorders={false} verticalSpacing={4} fz="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Coordinates</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((r, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{r.name}</Table.Td>
                      <Table.Td>
                        {r.valid ? `${r.lat!.toFixed(4)}, ${r.lng!.toFixed(4)}` : (
                          <Text c="dimmed" span>No coordinates</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {!r.valid && <Badge size="xs" color="gray" variant="light" leftSection={<Warning size={10} />}>Skipped</Badge>}
                        {r.valid && r.status === "pending" && <Badge size="xs" color="gray" variant="light">Pending</Badge>}
                        {r.status === "downloading" && <Badge size="xs" color="blue" variant="light">Downloading…</Badge>}
                        {r.status === "done" && <Badge size="xs" color="green" variant="light" leftSection={<CheckCircle size={10} weight="fill" />}>Done</Badge>}
                        {r.status === "failed" && <Badge size="xs" color="red" variant="light" leftSection={<XCircle size={10} weight="fill" />}>Failed</Badge>}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              {bulkEstimate && (
                <Text size="xs" c="dimmed" mt={8}>
                  {validRows.length} valid location(s) · ≈{bulkEstimate.tileCount} tiles total · ~{bulkEstimate.estimatedMB}MB
                </Text>
              )}

              <Button
                size="xs" leftSection={<CloudArrowDown size={16} />} fullWidth mt={8}
                onClick={downloadAll} loading={bulkRunning} disabled={validRows.length === 0}
              >
                Download all ({validRows.length})
              </Button>

              {bulkOverall && (
                <Progress value={(bulkOverall.done / bulkOverall.total) * 100} size="sm" mt={8} />
              )}
            </>
          )}
        </Paper>
      </Stack>
    </AppModal>
  );
}