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
import { VILLAGES, villageByCode, NEOPERK_STATES, DISTRICTS_BY_STATE, stateLabel, districtLabel, villageNameLabel } from "@/lib/villages";
import { CROPS, cropLabel } from "@/lib/crops";
import { looksLikeSoilCode, looksLikeFarmerCode } from "@/lib/qr";
import { CROP_API_VALUE, FIXED, operatorNote, neoperkFarmerName, submitPlotData, type PlotResult } from "@/lib/neoperk";
import QrScanner from "@/components/QrScanner";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { displayName } from "@/lib/transliterate";

type Stage = "input" | "form" | "result";

interface FormState {
  code: string;
  farmerCode: string;      // RJ code
  farmerName: string;      // farmer full name
  coName: string;          // care-of name
  villageCode: string;     // drives village name (and default state/district/block)
  state: string;           // Neoperk state (selects the project token)
  district: string;        // Neoperk district (validated enum)
  block: string;           // Neoperk block (free-text, editable)
  crop: string;            // app label
  lat: number | null;
  lng: number | null;
  collectedAt: number;
  operatorNote: string;
  alreadySentId: string;   // Neoperk sample_id if this sample was already submitted
}

function ScanSampleInner() {
  const router = useRouter();
  const { t, language } = useLanguage();
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
      notifications.show({ color: "red", message: t("scanSample_farmerQrError", { code }) });
      return;
    }
    if (!looksLikeSoilCode(code)) {
      notifications.show({ color: "red", message: t("scanSample_invalidSoilCode", { code }) });
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
      // upcoming crop = the sampled plot's crop; older farm-level samples fall
      // back to the farm's first non-deleted plot crop
      const samplePlot = sample.plotId ? await db.plots.get(sample.plotId) : undefined;
      if (samplePlot?.crop) {
        crop = samplePlot.crop;
      } else if (sample.farmId) {
        const plots = (await db.plots.where("farmId").equals(sample.farmId).toArray()).filter((p) => !p.deleted);
        crop = plots.find((p) => p.crop)?.crop || "";
      }
    } else {
      notifications.show({ color: "yellow", message: t("scanSample_notOnDevice") });
    }

    // If we still have no village, derive it from the code's abbreviation
    // (RJ-AMOD-… → Aamod) so state/district/block prefill even for a sample
    // that isn't on this device.
    if (!villageCode) {
      const ab = code.split("-")[1] || "";
      villageCode = VILLAGES.find((v) => v.idCode.toUpperCase() === ab)?.code || "";
    }

    const v0 = villageCode ? villageByCode(villageCode) : undefined;
    setOverride(false);
    setForm({
      code, farmerCode, farmerName, coName, villageCode,
      state: v0?.state || "", district: v0?.district || "", block: v0?.block || "",
      crop, lat, lng, collectedAt,
      operatorNote: operatorNote(code),
      alreadySentId: sample?.neoperkSampleId || "",
    });
    setStage("form");
  };

  const village = form ? villageByCode(form.villageCode) : undefined;
  const cropApi = form ? CROP_API_VALUE[form.crop] : undefined;
  const districtOptions = form && form.state ? (DISTRICTS_BY_STATE[form.state] || []) : [];
  const districtValid = !!(form && form.district && districtOptions.includes(form.district));
  const blockedAsSent = !!(form && form.alreadySentId && !override);
  const canSend = !!(
    form && form.farmerCode.trim() && form.villageCode && village &&
    form.state && districtValid && form.block.trim() &&
    form.crop && cropApi && form.operatorNote.trim()
  ) && !blockedAsSent;

  const send = async () => {
    if (!form || !village || !cropApi) return;
    setSending(true);
    try {
      const res = await submitPlotData({
        farmer_name: neoperkFarmerName(form.farmerName, form.coName, form.farmerCode.trim()),
        state: form.state,
        district: form.district,
        village: village.name,
        block: form.block.trim(),
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
            <ActionIcon variant="subtle" color="gray.0" size="lg" onClick={() => router.push("/home/")} aria-label={t("common_back")}>
              <ArrowLeft size={22} />
            </ActionIcon>
            <div>
              <Text fw={700} fz={9} style={{ letterSpacing: 1, opacity: 0.85 }}>{t("common_brand")}</Text>
              <Title order={4} lh={1.1}>{t("scanSample_title")}</Title>
            </div>
          </Group>
        </Container>
      </Box>

      <Container size="sm" py="lg">
        {stage === "input" && (
          <Stack gap="md">
            <Text c="dimmed" size="sm">{t("scanSample_intro")}</Text>
            <Button size="lg" leftSection={<QrCode size={22} />} onClick={() => setScanOpen(true)}>{t("scanSample_scanQr")}</Button>
            <Divider label={t("scanSample_or")} labelPosition="center" />
            <TextInput
              label={t("scanSample_enterCodeLabel")} placeholder={t("scanSample_enterCodePlaceholder")} value={manual}
              onChange={(e) => setManual(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); resolveCode(manual); } }}
              autoCapitalize="characters" leftSection={<Keyboard size={16} />}
            />
            <Button variant="light" leftSection={<Flask size={18} />} onClick={() => resolveCode(manual)} disabled={!manual.trim()}>
              {t("scanSample_lookup")}
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
                {form.lat != null && form.lng != null ? `${form.lat.toFixed(6)}, ${form.lng.toFixed(6)}` : t("scanSample_noLocation")}
              </Text>
            </Paper>

            <TextInput
              label={t("scanSample_farmerCodeLabel")} required withAsterisk value={form.farmerCode}
              placeholder={t("scanSample_farmerCodePlaceholder")}
              onChange={(e) => setForm({ ...form, farmerCode: e.currentTarget.value.toUpperCase() })}
              description={form.farmerName ? displayName(form.farmerName, language) : undefined}
            />

            <Select
              label={t("scanSample_villageLabel")} required withAsterisk placeholder={t("scanSample_villagePlaceholder")}
              data={VILLAGES.map((v) => ({ value: v.code, label: `${villageNameLabel(v, language)} · ${stateLabel(v.state, language)}` }))}
              value={form.villageCode || null}
              onChange={(v) => {
                const vv = v ? villageByCode(v) : undefined;
                // Re-derive state/district/block from the newly picked village.
                setForm({
                  ...form, villageCode: v || "",
                  state: vv?.state || form.state,
                  district: vv?.district || "",
                  block: vv?.block || "",
                });
              }}
              comboboxProps={{ withinPortal: true }} checkIconPosition="right"
            />

            <Select
              label={t("scanSample_stateLabel")} required withAsterisk placeholder={t("scanSample_statePlaceholder")}
              data={NEOPERK_STATES.map((s) => ({ value: s, label: stateLabel(s, language) }))}
              value={form.state || null}
              onChange={(s) => setForm({ ...form, state: s || "", district: "" })}
              comboboxProps={{ withinPortal: true }} checkIconPosition="right"
              description={t("scanSample_stateDescription")}
            />

            <Group grow>
              <Select
                label={t("scanSample_districtLabel")} required withAsterisk placeholder={form.state ? t("scanSample_districtPlaceholder") : t("scanSample_pickStateFirst")}
                data={districtOptions.map((d) => ({ value: d, label: districtLabel(d, language) }))}
                value={form.district || null}
                onChange={(d) => setForm({ ...form, district: d || "" })}
                disabled={!form.state} searchable
                comboboxProps={{ withinPortal: true }} checkIconPosition="right"
                error={form.district && !districtValid ? t("scanSample_districtInvalid") : undefined}
              />
              <TextInput label={t("scanSample_blockLabel")} required withAsterisk value={form.block}
                placeholder={t("scanSample_blockPlaceholder")} onChange={(e) => setForm({ ...form, block: e.currentTarget.value })} />
            </Group>

            <Select
              label={t("scanSample_cropLabel")} required withAsterisk placeholder={t("scanSample_cropPlaceholder")}
              data={CROPS.map((c) => ({ value: c, label: cropLabel(c, language) }))}
              value={form.crop || null}
              onChange={(v) => setForm({ ...form, crop: v || "" })}
              comboboxProps={{ withinPortal: true }} checkIconPosition="right"
              error={form.crop && !cropApi ? t("scanSample_cropInvalid") : undefined}
            />

            <Textarea label={t("scanSample_operatorNoteLabel")} autosize minRows={2} value={form.operatorNote}
              onChange={(e) => setForm({ ...form, operatorNote: e.currentTarget.value })} />

            <Text size="xs" c="dimmed">
              {t("scanSample_mobileSendingTo", { mobile: FIXED.mobile_number, state: form.state ? stateLabel(form.state, language) : "—", districtSuffix: form.district ? ` · ${districtLabel(form.district, language)}` : "" })}
            </Text>

            {form.alreadySentId && (
              <Paper withBorder radius="md" p="sm" style={{ background: "var(--mantine-color-orange-0)", borderColor: "var(--mantine-color-orange-3)" }}>
                <Group gap={8} align="flex-start" wrap="nowrap">
                  <WarningCircle size={18} weight="fill" color="var(--mantine-color-orange-6)" />
                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={600}>{t("scanSample_alreadySentTitle")}</Text>
                    <Text size="xs" c="dimmed">{t("scanSample_alreadySentBody", { id: form.alreadySentId })}</Text>
                    {!override && (
                      <Button size="xs" variant="light" color="orange" mt={8} onClick={() => setOverride(true)}>
                        {t("scanSample_sendAnyway")}
                      </Button>
                    )}
                  </div>
                </Group>
              </Paper>
            )}

            <Button size="md" leftSection={<PaperPlaneTilt size={18} />} onClick={send} loading={sending} disabled={!canSend}>
              {t("scanSample_confirmSend")}
            </Button>
            {blockedAsSent ? (
              <Text size="xs" c="dimmed" ta="center">{t("scanSample_alreadySentHint")}</Text>
            ) : !canSend && (
              <Text size="xs" c="dimmed" ta="center">{t("scanSample_fillRequiredHint")}</Text>
            )}
            <Button variant="subtle" color="gray" onClick={reset}>{t("common_cancel")}</Button>
          </Stack>
        )}

        {stage === "result" && result && (
          <Stack gap="md" align="center" pt="lg">
            <ThemeIcon size={64} radius="xl" variant="light" color={result.success ? "teal" : "red"}>
              {result.success ? <CheckCircle size={40} weight="fill" /> : <WarningCircle size={40} weight="fill" />}
            </ThemeIcon>
            <Title order={4}>{result.success ? t("scanSample_submitted") : t("scanSample_submissionFailed")}</Title>
            {result.success ? (
              <Paper withBorder radius="md" p="md" w="100%" ta="center">
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{t("scanSample_scannerSampleId")}</Text>
                <Text fw={700} size="xl">{result.sample_id || "—"}</Text>
                <Text size="xs" c="dimmed" mt={4}>{t("scanSample_useInScannerApp")}</Text>
              </Paper>
            ) : (
              <Paper withBorder radius="md" p="md" w="100%">
                <Text c="red" fw={500} size="sm">{result.message || t("scanSample_couldNotSubmit")}</Text>
                {result.errors?.length ? (
                  <Stack gap={2} mt={6}>{result.errors.map((e, i) => <Text key={i} size="xs" c="dimmed">• {e}</Text>)}</Stack>
                ) : null}
              </Paper>
            )}
            <Button fullWidth size="md" leftSection={<ArrowClockwise size={18} />} onClick={reset}>{t("scanSample_sendAnother")}</Button>
            {!result.success && (
              <Button fullWidth variant="light" onClick={() => setStage("form")}>{t("scanSample_backToDetails")}</Button>
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
