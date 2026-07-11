"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ActionIcon, Box, Button, Center, Container, Divider, Group, Loader, Paper, Select,
  Stack, Text, TextInput, Textarea, ThemeIcon, Title,
} from "@mantine/core";
import {
  ArrowLeft, QrCode, Keyboard, Flask, CheckCircle, WarningCircle, PaperPlaneTilt, ArrowClockwise,
} from "@phosphor-icons/react";
import { notifications } from "@mantine/notifications";
import SessionGate from "@/providers/SessionGate";
import { db } from "@/lib/db";
import { VILLAGES, villageByCode } from "@/lib/villages";
import { CROPS } from "@/lib/crops";
import { looksLikeSoilCode, looksLikeFarmerCode } from "@/lib/qr";
import { CROP_API_VALUE, FIXED, operatorNote, neoperkFarmerName, submitPlotData, type PlotResult } from "@/lib/neoperk";
import QrScanner from "@/components/QrScanner";

type Stage = "input" | "form" | "result";

interface FormState {
  code: string;
  farmerCode: string;      // RJ code
  farmerName: string;      // farmer full name
  coName: string;          // care-of name
  villageCode: string;     // drives village name + block
  crop: string;            // app label
  lat: number | null;
  lng: number | null;
  collectedAt: number;
  operatorNote: string;
  alreadySentId: string;   // Neoperk sample_id if this sample was already submitted
}

function ScanSampleInner() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("input");
  const [scanOpen, setScanOpen] = useState(false);
  const [manual, setManual] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<PlotResult | null>(null);
  const [override, setOverride] = useState(false);   // "send anyway" for an already-sent sample

  // Resolve a scanned/typed soil code → prefill everything we can from the app's data.
  const resolveCode = async (raw: string) => {
    const code = (raw || "").trim().toUpperCase();
    setScanOpen(false);
    if (!code) return;
    if (looksLikeFarmerCode(code)) {
      notifications.show({ color: "red", message: `${code} is a farmer QR — scan a soil-sample code` });
      return;
    }
    if (!looksLikeSoilCode(code)) {
      notifications.show({ color: "red", message: `Invalid soil code: ${code} (expected e.g. RJ-AMOD-SA001)` });
      return;
    }

    const sample = (await db.soilSamples.toArray())
      .find((s) => !s.deleted && (s.code || "").toUpperCase() === code);
    let farmerCode = "", farmerName = "", coName = "", villageCode = "", crop = "", lat: number | null = null, lng: number | null = null;
    let collectedAt = Date.now();
    if (sample) {
      farmerCode = sample.farmerId || "";
      villageCode = sample.villageCode || "";
      lat = sample.lat; lng = sample.lng; collectedAt = sample.createdAt || Date.now();
      const farmer = farmerCode ? await db.farmers.get(farmerCode) : undefined;
      if (farmer) {
        farmerName = `${farmer.firstName || ""} ${farmer.lastName || ""}`.trim();
        coName = `${farmer.coFirstName || ""} ${farmer.coLastName || ""}`.trim();
      }
      // best-effort upcoming crop = the farm's first non-deleted plot crop
      if (sample.farmId) {
        const plots = (await db.plots.where("farmId").equals(sample.farmId).toArray()).filter((p) => !p.deleted);
        crop = plots.find((p) => p.crop)?.crop || "";
      }
    } else {
      notifications.show({ color: "yellow", message: "Sample not on this device — enter the details below" });
    }

    setOverride(false);
    setForm({
      code, farmerCode, farmerName, coName, villageCode, crop, lat, lng, collectedAt,
      operatorNote: operatorNote(code),
      alreadySentId: sample?.neoperkSampleId || "",
    });
    setStage("form");
  };

  const village = form ? villageByCode(form.villageCode) : undefined;
  const cropApi = form ? CROP_API_VALUE[form.crop] : undefined;
  const blockedAsSent = !!(form && form.alreadySentId && !override);
  const canSend = !!(form && form.farmerCode.trim() && form.villageCode && village && form.crop && cropApi && form.operatorNote.trim()) && !blockedAsSent;

  const send = async () => {
    if (!form || !village || !cropApi) return;
    setSending(true);
    try {
      const res = await submitPlotData({
        farmer_name: neoperkFarmerName(form.farmerName, form.coName, form.farmerCode.trim()),
        village: village.name,
        block: village.block,
        upcoming_crop_cycle: cropApi,
        operator_note: form.operatorNote.trim(),
      });
      setResult(res);
      setStage("result");
      // Record the returned sample_id on the local soil sample (if present).
      if (res.success && res.sample_id) {
        const s = (await db.soilSamples.toArray()).find((x) => !x.deleted && (x.code || "").toUpperCase() === form.code);
        if (s) await db.soilSamples.update(s.id, { neoperkSampleId: res.sample_id, submittedAt: Date.now(), synced: false } as any);
      }
    } finally {
      setSending(false);
    }
  };

  const reset = () => { setForm(null); setResult(null); setManual(""); setOverride(false); setStage("input"); };

  return (
    <Box mih="100dvh" style={{ background: "var(--mantine-color-gray-0)" }}>
      <Box style={{ background: "linear-gradient(135deg,#06854f,#013a24)", color: "#fff", paddingTop: "max(14px, env(safe-area-inset-top))", position: "sticky", top: 0, zIndex: 20 }}>
        <Container size="sm" pb="md" pt="xs">
          <Group gap="xs" wrap="nowrap">
            <ActionIcon variant="subtle" color="gray.0" size="lg" onClick={() => router.push("/home/")} aria-label="Back">
              <ArrowLeft size={22} />
            </ActionIcon>
            <div>
              <Text fw={700} fz={9} style={{ letterSpacing: 1, opacity: 0.85 }}>UNCOMPROMISED</Text>
              <Title order={4} lh={1.1}>Scan sample</Title>
            </div>
          </Group>
        </Container>
      </Box>

      <Container size="sm" py="lg">
        {stage === "input" && (
          <Stack gap="md">
            <Text c="dimmed" size="sm">Scan a soil-sample QR or type its code to submit it to the scanner system.</Text>
            <Button size="lg" leftSection={<QrCode size={22} />} onClick={() => setScanOpen(true)}>Scan QR code</Button>
            <Divider label="or" labelPosition="center" />
            <TextInput
              label="Enter sample code" placeholder="e.g. RJ-AMOD-SA001" value={manual}
              onChange={(e) => setManual(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); resolveCode(manual); } }}
              autoCapitalize="characters" leftSection={<Keyboard size={16} />}
            />
            <Button variant="light" leftSection={<Flask size={18} />} onClick={() => resolveCode(manual)} disabled={!manual.trim()}>
              Look up sample
            </Button>
          </Stack>
        )}

        {stage === "form" && form && (
          <Stack gap="md">
            <Paper withBorder radius="md" p="sm">
              <Group gap={8} mb={4}>
                <ThemeIcon variant="light" color="orange" radius="xl"><Flask size={16} weight="fill" /></ThemeIcon>
                <Text fw={700}>{form.code}</Text>
              </Group>
              <Text size="xs" c="dimmed">
                {form.lat != null && form.lng != null ? `${form.lat.toFixed(6)}, ${form.lng.toFixed(6)}` : "No location on record"}
              </Text>
            </Paper>

            <TextInput
              label="Farmer (RJ code)" required withAsterisk value={form.farmerCode}
              placeholder="e.g. RJ-UDAI-U012"
              onChange={(e) => setForm({ ...form, farmerCode: e.currentTarget.value.toUpperCase() })}
              description={form.farmerName || undefined}
            />

            <Select
              label="Village" required withAsterisk placeholder="Select village"
              data={VILLAGES.map((v) => ({ value: v.code, label: `${v.name} · ${v.block}` }))}
              value={form.villageCode || null}
              onChange={(v) => setForm({ ...form, villageCode: v || "" })}
              comboboxProps={{ withinPortal: true }} checkIconPosition="right"
            />

            <Group grow>
              <TextInput label="District" value={FIXED.district} readOnly variant="filled" />
              <TextInput label="Block" value={village?.block || ""} readOnly variant="filled"
                placeholder="from village" error={form.villageCode && !village ? "unknown" : undefined} />
            </Group>

            <Select
              label="Upcoming crop" required withAsterisk placeholder="Select crop"
              data={CROPS.map((c) => ({ value: c, label: c }))}
              value={form.crop || null}
              onChange={(v) => setForm({ ...form, crop: v || "" })}
              comboboxProps={{ withinPortal: true }} checkIconPosition="right"
              error={form.crop && !cropApi ? "not accepted by the API" : undefined}
            />

            <Textarea label="Operator note" autosize minRows={2} value={form.operatorNote}
              onChange={(e) => setForm({ ...form, operatorNote: e.currentTarget.value })} />

            <Text size="xs" c="dimmed">Mobile {FIXED.mobile_number} · {FIXED.state} (fixed)</Text>

            {form.alreadySentId && (
              <Paper withBorder radius="md" p="sm" style={{ background: "var(--mantine-color-orange-0)", borderColor: "var(--mantine-color-orange-3)" }}>
                <Group gap={8} align="flex-start" wrap="nowrap">
                  <WarningCircle size={18} weight="fill" color="var(--mantine-color-orange-6)" />
                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={600}>Already sent to the scanner</Text>
                    <Text size="xs" c="dimmed">Scanner sample ID <b>{form.alreadySentId}</b>. Sending again will create a duplicate record.</Text>
                    {!override && (
                      <Button size="xs" variant="light" color="orange" mt={8} onClick={() => setOverride(true)}>
                        Send anyway
                      </Button>
                    )}
                  </div>
                </Group>
              </Paper>
            )}

            <Button size="md" leftSection={<PaperPlaneTilt size={18} />} onClick={send} loading={sending} disabled={!canSend}>
              Confirm & send to scanner
            </Button>
            {blockedAsSent ? (
              <Text size="xs" c="dimmed" ta="center">This sample was already sent — tap “Send anyway” above to re-submit.</Text>
            ) : !canSend && (
              <Text size="xs" c="dimmed" ta="center">Fill the required fields (farmer code, village, crop) to enable sending.</Text>
            )}
            <Button variant="subtle" color="gray" onClick={reset}>Cancel</Button>
          </Stack>
        )}

        {stage === "result" && result && (
          <Stack gap="md" align="center" pt="lg">
            <ThemeIcon size={64} radius="xl" variant="light" color={result.success ? "teal" : "red"}>
              {result.success ? <CheckCircle size={40} weight="fill" /> : <WarningCircle size={40} weight="fill" />}
            </ThemeIcon>
            <Title order={4}>{result.success ? "Sample submitted" : "Submission failed"}</Title>
            {result.success ? (
              <Paper withBorder radius="md" p="md" w="100%" ta="center">
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Scanner sample ID</Text>
                <Text fw={700} size="xl">{result.sample_id || "—"}</Text>
                <Text size="xs" c="dimmed" mt={4}>Use this in the Scanner App.</Text>
              </Paper>
            ) : (
              <Paper withBorder radius="md" p="md" w="100%">
                <Text c="red" fw={500} size="sm">{result.message || "Could not submit."}</Text>
                {result.errors?.length ? (
                  <Stack gap={2} mt={6}>{result.errors.map((e, i) => <Text key={i} size="xs" c="dimmed">• {e}</Text>)}</Stack>
                ) : null}
              </Paper>
            )}
            <Button fullWidth size="md" leftSection={<ArrowClockwise size={18} />} onClick={reset}>Send another sample</Button>
            {!result.success && (
              <Button fullWidth variant="light" onClick={() => setStage("form")}>Back to details</Button>
            )}
          </Stack>
        )}
      </Container>

      <QrScanner opened={scanOpen} onClose={() => setScanOpen(false)} onScan={resolveCode} onManual={() => setScanOpen(false)} />
    </Box>
  );
}

export default function ScanSamplePage() {
  return (
    <SessionGate>
      <ScanSampleInner />
    </SessionGate>
  );
}
