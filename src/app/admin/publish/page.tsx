"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Badge, Button, Center, Checkbox, Group, Loader, Paper, Select,
  Stack, Table, Text, Title, Tooltip,
} from "@mantine/core";
import {
  ArrowCounterClockwise, ArrowsClockwise, CloudArrowUp, ClipboardText, Info, SkipForward, Trash, WarningCircle,
} from "@phosphor-icons/react";
import { notifications } from "@mantine/notifications";
import AppModal from "@/components/AppModal";
import {
  apiPublishPreview, apiPublishRevert, apiPublishRun, apiPublishRuns,
  type PublishEntityType, type PublishItem, type PublishProgress, type PublishResolution, type PublishRun, type PublishStatus,
} from "@/lib/api";
import { getSession } from "@/lib/session";
import {
  PUBLISH_CHANGE_KEY, PUBLISH_CONFLICT_KEY, PUBLISH_STATUS_META, PUBLISH_TYPE_COLOR, PUBLISH_TYPE_LABEL_KEY,
  publishItemKey,
} from "@/lib/publishMeta";
import PublishRecordDetail from "@/components/admin/PublishRecordDetail";
import PublishRunDetail from "@/components/admin/PublishRunDetail";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// Publish to TerraOS: onboarding backend → uc-core. Deliberately never called
// "sync" in the UI — sync is the device ⇄ onboarding-backend step.
//
// Flow: "Check for changes" runs a dry run against uc-core and lists every
// pending record with its verdict. Conflicts (same-name records in TerraOS,
// or TerraOS edits since the last publish) get a per-record decision; any
// left undecided are held back. "Publish all" then sends everything else.

const TYPE_LABEL_KEY = PUBLISH_TYPE_LABEL_KEY;
const TYPE_COLOR = PUBLISH_TYPE_COLOR;
const STATUS_META = PUBLISH_STATUS_META;
const CHANGE_KEY = PUBLISH_CHANGE_KEY;
const CONFLICT_KEY = PUBLISH_CONFLICT_KEY;

// Onboarding field ↔ TerraOS snapshot field, for the side-by-side compare.
const COMPARE_FIELDS: Record<PublishEntityType, { label: string; ob: string; tos: string }[]> = {
  village: [{ label: "Name", ob: "name", tos: "name" }, { label: "State", ob: "stateName", tos: "state" }],
  farmer: [
    { label: "First name", ob: "firstName", tos: "firstName" },
    { label: "Last name", ob: "lastName", tos: "lastName" },
    { label: "Phone", ob: "phone", tos: "contactNo" },
    { label: "Care of", ob: "careOf", tos: "careOf" },
  ],
  farm: [{ label: "Name", ob: "name", tos: "name" }, { label: "Area (acres)", ob: "areaAcres", tos: "area" }],
  plot: [{ label: "Code", ob: "code", tos: "code" }, { label: "Name", ob: "name", tos: "name" }],
  soil_sample: [
    { label: "Code", ob: "code", tos: "code" },
    { label: "Previous crop", ob: "previousCrop", tos: "previousCrop" },
    { label: "Neoperk sample ID", ob: "neoperkSampleId", tos: "neoperkSampleId" },
  ],
  soil_texture_test: [
    { label: "Clay %", ob: "clayPct", tos: "clayPct" },
    { label: "Sand %", ob: "sandPct", tos: "sandPct" },
    { label: "Silt %", ob: "siltPct", tos: "siltPct" },
  ],
  water_tds_test: [{ label: "TDS (ppm)", ob: "tdsPpm", tos: "tdsPpm" }],
  cultivation: [
    { label: "Crop", ob: "crop", tos: "crop" },
    { label: "Variety", ob: "variety", tos: "variety" },
    { label: "Crop plan", ob: "cropPlan", tos: "cropPlan" },
    { label: "Sowing date", ob: "startDate", tos: "startDate" },
    { label: "End date", ob: "endDate", tos: "endDate" },
  ],
};

const itemKey = publishItemKey;

// The way out for a record TerraOS can't take (see backend /revert).
const REVERT_META = {
  discard: { label: "adminPublish_revertDiscard", title: "adminPublish_revertDiscardTitle", text: "adminPublish_revertDiscardText", done: "adminPublish_revertDoneDiscard", color: "red" },
  restore: { label: "adminPublish_revertRestore", title: "adminPublish_revertRestoreTitle", text: "adminPublish_revertRestoreText", done: "adminPublish_revertDoneRestore", color: "orange" },
  skip: { label: "adminPublish_revertSkip", title: "adminPublish_revertSkipTitle", text: "adminPublish_revertSkipText", done: "adminPublish_revertDoneSkip", color: "gray" },
} as const;
const revertIcon = (a: keyof typeof REVERT_META, size: number) =>
  a === "discard" ? <Trash size={size} /> : a === "restore" ? <ArrowCounterClockwise size={size} /> : <SkipForward size={size} />;
const show = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return String(Math.round(v * 10000) / 10000);
  return String(v);
};
const fmtWhen = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

// Encode a resolution as a Select value and back.
const encodeRes = (r: PublishResolution | undefined) => (!r ? "" : typeof r === "object" ? `link:${r.linkTo}` : r);
const decodeRes = (v: string | null): PublishResolution | undefined =>
  !v ? undefined : v.startsWith("link:") ? { linkTo: v.slice(5) } : (v as PublishResolution);

export default function AdminPublishPage() {
  const { t } = useLanguage();
  const [configured, setConfigured] = useState(true);
  const [runs, setRuns] = useState<PublishRun[] | null>(null);
  const [preview, setPreview] = useState<{ upToDate: number; items: PublishItem[] } | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "ready" | "conflict" | "error">("all");
  const [resolutions, setResolutions] = useState<Record<string, PublishResolution>>({});
  const [comparing, setComparing] = useState<PublishItem | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [openRun, setOpenRun] = useState<PublishRun | null>(null);
  const [openItem, setOpenItem] = useState<PublishItem | null>(null);
  // Records ticked for "Publish selected"; confirmOnly = the confirm dialog is for the selection.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOnly, setConfirmOnly] = useState(false);
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const [reverting, setReverting] = useState<PublishItem | null>(null);
  const [revertBusy, setRevertBusy] = useState(false);

  const loadRuns = useCallback(async () => {
    const session = getSession();
    if (!session) return;
    try {
      const r = await apiPublishRuns(session.token);
      setConfigured(r.configured);
      setRuns(r.runs);
    } catch {
      setRuns([]);
    }
  }, []);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  const check = async () => {
    const session = getSession();
    if (!session) return;
    setChecking(true);
    setError("");
    try {
      setProgress(null);
      const r = await apiPublishPreview(session.token, setProgress);
      setPreview({ upToDate: r.upToDate, items: r.items });
      // Keep only selections that are still pending and publishable.
      setSelected((prev) => new Set([...prev].filter((k) => r.items.some((i) => itemKey(i) === k && i.status !== "error"))));
      // Keep decisions only for records that are still conflicts.
      setResolutions((prev) => {
        const next: Record<string, PublishResolution> = {};
        for (const i of r.items) if (i.status === "conflict" && prev[itemKey(i)]) next[itemKey(i)] = prev[itemKey(i)];
        return next;
      });
    } catch (e: any) {
      setError(e?.message || t("adminPublish_couldNotPreview"));
    } finally {
      setChecking(false);
      setProgress(null);
    }
  };

  const items = preview?.items ?? [];
  const conflicts = items.filter((i) => i.status === "conflict");
  const errors = items.filter((i) => i.status === "error");
  const ready = items.length - conflicts.length - errors.length;
  const decided = conflicts.filter((i) => resolutions[itemKey(i)]);
  const skipping = decided.filter((i) => resolutions[itemKey(i)] === "skip").length;
  const held = conflicts.length - decided.length;
  const sendCount = ready + decided.length - skipping;
  const visible = useMemo(
    () =>
      filter === "all" ? items
      : filter === "ready" ? items.filter((i) => i.status !== "conflict" && i.status !== "error")
      : items.filter((i) => i.status === filter),
    [filter, items],
  );

  // Rows that can be ticked (errors can't be published until fixed or reverted).
  const selectableVisible = visible.filter((i) => i.status !== "error");

  const publish = async () => {
    const session = getSession();
    if (!session) return;
    setPublishing(true);
    try {
      setProgress(null);
      const r = await apiPublishRun(session.token, resolutions, setProgress, confirmOnly ? [...selected] : undefined);
      setSelected(new Set());
      const c = r.counts || {};
      notifications.show({
        color: (c.conflict || 0) + (c.error || 0) > 0 ? "yellow" : "green",
        message: t("adminPublish_resultToast", {
          ok: (c.created || 0) + (c.updated || 0) + (c.deleted || 0),
          skipped: c.skipped || 0,
          conflicts: c.conflict || 0,
          errors: c.error || 0,
        }),
      });
      setConfirmOpen(false);
      setResolutions({});
      await Promise.all([loadRuns(), check()]);
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || t("adminPublish_couldNotPublish") });
      loadRuns();
    } finally {
      setPublishing(false);
      setProgress(null);
    }
  };

  const runRevert = async () => {
    const session = getSession();
    if (!session || !reverting) return;
    setRevertBusy(true);
    try {
      const r = await apiPublishRevert(session.token, reverting.type, reverting.sourceId);
      notifications.show({
        color: "green",
        message: t(REVERT_META[r.action].done, { label: reverting.label }),
      });
      setReverting(null);
      await check();
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || t("adminPublish_revertFailed") });
    } finally {
      setRevertBusy(false);
    }
  };

  const resolutionOptions = (i: PublishItem) => {
    const opts = [{ value: "", label: t("adminPublish_resolveHold") }];
    const c = i.conflict;
    if (c?.kind === "name" || c?.kind === "unlinked") {
      for (const cand of c.candidates || []) opts.push({ value: `link:${cand.id}`, label: t("adminPublish_resolveLink", { label: cand.label }) });
      opts.push({ value: "create_new", label: t("adminPublish_resolveCreateNew") });
    } else if (c?.kind === "modified") {
      opts.push({ value: "overwrite", label: t("adminPublish_resolveOverwrite") });
    } else if (c?.kind === "missing") {
      for (const cand of c.candidates || []) opts.push({ value: `link:${cand.id}`, label: t("adminPublish_resolveLink", { label: cand.label }) });
      opts.push({ value: "overwrite", label: t("adminPublish_resolveRecreate") });
    }
    opts.push({ value: "skip", label: t("adminPublish_resolveSkip") });
    return opts;
  };

  const statusBadge = (s: PublishStatus) => (
    <Badge color={STATUS_META[s]?.color || "gray"} variant="light" radius="sm">{t(STATUS_META[s]?.key || "adminPublish_statusError")}</Badge>
  );

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div style={{ maxWidth: 720 }}>
          <Title order={3}>{t("adminPublish_title")}</Title>
          <Text c="dimmed" size="sm">{t("adminPublish_subtitle")}</Text>
        </div>
        <Group gap="sm">
          <Button variant="default" leftSection={<ArrowsClockwise size={16} />} loading={checking} disabled={!configured || publishing} onClick={check}>
            {t("adminPublish_checkChanges")}
          </Button>
          <Button
            color="green" leftSection={<CloudArrowUp size={16} />}
            disabled={!configured || !preview || checking || sendCount + skipping === 0}
            onClick={() => { setConfirmOnly(false); setConfirmOpen(true); }}
          >
            {t("adminPublish_publishAll")}{preview && sendCount > 0 ? ` (${sendCount})` : ""}
          </Button>
          {selected.size > 0 && (
            <Button color="green" variant="light" leftSection={<CloudArrowUp size={16} />}
              disabled={!configured || checking || publishing}
              onClick={() => { setConfirmOnly(true); setConfirmOpen(true); }}>
              {t("adminPublish_publishSelected", { n: selected.size })}
            </Button>
          )}
        </Group>
      </Group>

      {(checking || publishing) && progress && progress.total > 0 && (
        <Alert color="blue" icon={<Loader size={16} />}>
          {t(publishing ? "adminPublish_progressPublishing" : "adminPublish_progressChecking", { done: progress.done, total: progress.total })}
        </Alert>
      )}

      {!configured && (
        <Alert color="yellow" icon={<WarningCircle size={18} />}>{t("adminPublish_notConfigured")}</Alert>
      )}

      {preview && (
        // The counters double as filters for the table below; "All" clears it.
        <Group gap="sm">
          {([
            { value: "all", label: t("adminPublish_filterAll"), n: items.length, color: "gray" },
            { value: "ready", label: t("adminPublish_statReady"), n: ready, color: "green" },
            { value: "conflict", label: t("adminPublish_statConflicts"), n: conflicts.length, color: "yellow" },
            { value: "error", label: t("adminPublish_statErrors"), n: errors.length, color: "red" },
          ] as const).map((f) => (
            <Button
              key={f.value}
              size="compact-sm" radius="xl" color={f.color}
              variant={filter === f.value ? "filled" : "light"}
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}: {f.n}
            </Button>
          ))}
          <Text size="sm" c="dimmed">{t("adminPublish_upToDateCount", { n: preview.upToDate })}</Text>
        </Group>
      )}

      <Paper withBorder radius="lg" p={0}>
        {checking && !preview && <Center p="xl"><Loader color="green" /></Center>}
        {error && (
          <Center p="xl">
            <Stack align="center" gap={6}>
              <WarningCircle size={28} color="var(--mantine-color-red-6)" />
              <Text c="red" size="sm">{error}</Text>
            </Stack>
          </Center>
        )}
        {!preview && !checking && !error && (
          <Center p="xl">
            <Stack align="center" gap={6}>
              <Info size={28} color="var(--mantine-color-gray-5)" />
              <Text c="dimmed" size="sm">{t("adminPublish_notChecked")}</Text>
            </Stack>
          </Center>
        )}
        {preview && !error && items.length === 0 && (
          <Center p="xl">
            <Stack align="center" gap={6}>
              <ClipboardText size={28} color="var(--mantine-color-gray-5)" />
              <Text c="dimmed" size="sm">{t("adminPublish_nothingPending")}</Text>
            </Stack>
          </Center>
        )}
        {preview && !error && items.length > 0 && (
          <>
            <Group p="sm" pb={0} justify="flex-end">
              <Text size="xs" c="dimmed">{t("adminPublish_clickHint")}</Text>
            </Group>
            {visible.length === 0 && (
              <Center p="lg">
                <Stack align="center" gap={8}>
                  <Text c="dimmed" size="sm">{t("adminPublish_noItems")}</Text>
                  <Button size="xs" variant="subtle" onClick={() => setFilter("all")}>{t("adminPublish_filterAll")}</Button>
                </Stack>
              </Center>
            )}
            <Table.ScrollContainer minWidth={900}>
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={36}>
                      <Checkbox
                        aria-label={t("adminPublish_selectAll")}
                        checked={selectableVisible.length > 0 && selectableVisible.every((i) => selected.has(itemKey(i)))}
                        indeterminate={selectableVisible.some((i) => selected.has(itemKey(i))) && !selectableVisible.every((i) => selected.has(itemKey(i)))}
                        disabled={selectableVisible.length === 0}
                        onChange={(e) => {
                          const on = e.currentTarget.checked;
                          setSelected((prev) => {
                            const next = new Set(prev);
                            for (const i of selectableVisible) on ? next.add(itemKey(i)) : next.delete(itemKey(i));
                            return next;
                          });
                        }}
                      />
                    </Table.Th>
                    <Table.Th>{t("adminPublish_colRecord")}</Table.Th>
                    <Table.Th>{t("adminPublish_colChange")}</Table.Th>
                    <Table.Th>{t("adminPublish_colResult")}</Table.Th>
                    <Table.Th w={340}>{t("adminPublish_colAction")}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {visible.map((i) => (
                    <Table.Tr key={itemKey(i)} style={{ cursor: "pointer" }} onClick={() => setOpenItem(i)}
                      bg={selected.has(itemKey(i)) ? "var(--mantine-color-green-light)" : undefined}>
                      <Table.Td onClick={(e) => e.stopPropagation()} style={{ cursor: "default" }}>
                        <Tooltip label={t("adminPublish_cantSelectError")} disabled={i.status !== "error"}>
                          <span>
                            <Checkbox
                              aria-label={i.label}
                              disabled={i.status === "error"}
                              checked={selected.has(itemKey(i))}
                              onChange={(e) => {
                                const on = e.currentTarget.checked;
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  on ? next.add(itemKey(i)) : next.delete(itemKey(i));
                                  return next;
                                });
                              }}
                            />
                          </span>
                        </Tooltip>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={6} wrap="nowrap">
                          <Badge color={TYPE_COLOR[i.type]} variant="light" radius="sm" style={{ flexShrink: 0 }}>{t(TYPE_LABEL_KEY[i.type])}</Badge>
                          <Text size="sm" fw={500}>{i.label}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">{i.change ? t(CHANGE_KEY[i.change]) : "—"}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={2}>
                          {i.waitingFor ? (
                            <>
                              <Badge color="gray" variant="light" radius="sm">{t("adminPublish_statusWaiting")}</Badge>
                              <Text size="xs" c="dimmed">
                                {t("adminPublish_waitingFor", { type: i.waitingFor.type, label: i.waitingFor.label })}
                              </Text>
                            </>
                          ) : (
                            <>
                              {statusBadge(i.status)}
                              {i.conflict && <Text size="xs" c="dimmed">{t(CONFLICT_KEY[i.conflict.kind])}</Text>}
                              {i.error && <Text size="xs" c="red">{i.error}</Text>}
                            </>
                          )}
                          {i.warnings?.length > 0 && (
                            <Tooltip label={i.warnings.join("\n")} multiline w={320}>
                              <Text size="xs" c="orange">{t("adminPublish_warnings")} ({i.warnings.length})</Text>
                            </Tooltip>
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td onClick={(e) => e.stopPropagation()} style={{ cursor: "default" }}>
                        {i.status === "conflict" ? (
                          <Group gap={6} wrap="nowrap">
                            <Select
                              size="xs"
                              style={{ flex: 1 }}
                              data={resolutionOptions(i)}
                              value={encodeRes(resolutions[itemKey(i)])}
                              onChange={(v) => setResolutions((prev) => {
                                const next = { ...prev };
                                const r = decodeRes(v);
                                if (r) next[itemKey(i)] = r; else delete next[itemKey(i)];
                                return next;
                              })}
                              allowDeselect={false}
                            />
                            {i.conflict?.kind === "modified" && (
                              <Button size="xs" variant="subtle" onClick={() => setComparing(i)}>{t("adminPublish_compare")}</Button>
                            )}
                          </Group>
                        ) : i.status === "error" && i.revert && !i.waitingFor ? (
                          <Button
                            size="xs" variant="light" color={REVERT_META[i.revert].color}
                            leftSection={revertIcon(i.revert, 14)}
                            disabled={publishing}
                            onClick={() => setReverting(i)}
                          >
                            {t(REVERT_META[i.revert].label)}
                          </Button>
                        ) : (
                          <Text size="sm" c="dimmed">—</Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </>
        )}
      </Paper>

      <Stack gap="xs">
        <Title order={5}>{t("adminPublish_historyTitle")}</Title>
        <Paper withBorder radius="lg" p={0}>
          {!runs && <Center p="lg"><Loader color="green" size="sm" /></Center>}
          {runs && runs.length === 0 && <Center p="lg"><Text c="dimmed" size="sm">{t("adminPublish_historyEmpty")}</Text></Center>}
          {runs && runs.length > 0 && (
            <Table.ScrollContainer minWidth={700}>
              <Table verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>#</Table.Th>
                    <Table.Th>{t("adminPublish_colWhen")}</Table.Th>
                    <Table.Th>{t("adminPublish_colBy")}</Table.Th>
                    <Table.Th>{t("adminPublish_colOutcome")}</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {runs.map((r) => (
                    <Table.Tr key={r.id} style={{ cursor: "pointer" }} onClick={() => setOpenRun(r)}>
                      <Table.Td><Text size="sm" c="dimmed">{r.id}</Text></Table.Td>
                      <Table.Td><Text size="sm">{fmtWhen(r.started_at)}</Text></Table.Td>
                      <Table.Td><Text size="sm">{r.started_by}</Text></Table.Td>
                      <Table.Td>
                        <Group gap={6} wrap="wrap">
                          <Badge variant="light" radius="sm" color={r.status === "completed" ? "green" : r.status === "failed" ? "red" : "blue"}>
                            {t(r.status === "completed" ? "adminPublish_runCompleted" : r.status === "failed" ? "adminPublish_runFailed" : "adminPublish_runRunning")}
                          </Badge>
                          {r.counts && Object.entries(r.counts).map(([s, n]) => (
                            <Text key={s} size="xs" c="dimmed">{t(STATUS_META[s as PublishStatus]?.key || "adminPublish_statusError")}: {n}</Text>
                          ))}
                          {r.error && <Text size="xs" c="red">{r.error}</Text>}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={6} wrap="nowrap" justify="flex-end">
                          {r.results && r.results.length > 0 && (
                            <Text size="xs" c="orange">{t("adminPublish_issuesCount", { n: r.results.length })}</Text>
                          )}
                          <Button size="xs" variant="subtle">{t("adminPublish_viewDetails")}</Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Paper>
      </Stack>

      <AppModal
        opened={confirmOpen}
        onClose={() => { if (!publishing) setConfirmOpen(false); }}
        title={t("adminPublish_confirmTitle")}
        size="sm"
        closeOnClickOutside={!publishing}
        withCloseButton={!publishing}
      >
        <Stack gap="md">
          <Text size="sm">
            {confirmOnly ? t("adminPublish_confirmSelected", { n: selected.size }) : t("adminPublish_confirmText", { n: sendCount })}
          </Text>
          {skipping > 0 && <Text size="sm" c="dimmed">{t("adminPublish_confirmSkipped", { n: skipping })}</Text>}
          {held > 0 && <Text size="sm" c="orange">{t("adminPublish_confirmHeld", { n: held })}</Text>}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" disabled={publishing} onClick={() => setConfirmOpen(false)}>{t("common_cancel")}</Button>
            <Button color="green" leftSection={<CloudArrowUp size={16} />} loading={publishing} onClick={publish}>
              {confirmOnly ? t("adminPublish_publishSelected", { n: selected.size }) : t("adminPublish_publishAll")}
            </Button>
          </Group>
        </Stack>
      </AppModal>

      <AppModal
        opened={!!comparing}
        onClose={() => setComparing(null)}
        title={comparing ? t("adminPublish_compareTitle", { label: comparing.label }) : ""}
        size="md"
      >
        {comparing && (
          <Table verticalSpacing={6}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("adminPublish_colField")}</Table.Th>
                <Table.Th>{t("adminPublish_colOnboarding")}</Table.Th>
                <Table.Th>{t("adminPublish_colTerraos")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {COMPARE_FIELDS[comparing.type].map((f) => {
                const a = show(comparing.onboarding?.[f.ob]);
                const b = show(comparing.conflict?.terraos?.[f.tos]);
                return (
                  <Table.Tr key={f.ob}>
                    <Table.Td><Text size="sm" c="dimmed">{f.label}</Text></Table.Td>
                    <Table.Td><Text size="sm" fw={a !== b ? 600 : 400}>{a}</Text></Table.Td>
                    <Table.Td><Text size="sm" fw={a !== b ? 600 : 400}>{b}</Text></Table.Td>
                  </Table.Tr>
                );
              })}
              <Table.Tr>
                <Table.Td><Text size="sm" c="dimmed">Last edited in TerraOS</Text></Table.Td>
                <Table.Td />
                <Table.Td><Text size="sm">{fmtWhen(comparing.conflict?.terraos?.updatedAt ?? null)}</Text></Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        )}
      </AppModal>

      <AppModal
        opened={!!reverting}
        onClose={() => { if (!revertBusy) setReverting(null); }}
        title={reverting?.revert ? t(REVERT_META[reverting.revert].title, { label: reverting.label }) : ""}
        size="sm"
        closeOnClickOutside={!revertBusy}
        withCloseButton={!revertBusy}
      >
        {reverting?.revert && (
          <Stack gap="md">
            {reverting.error && <Alert color="red" icon={<WarningCircle size={18} />}>{reverting.error}</Alert>}
            <Text size="sm">{t(REVERT_META[reverting.revert].text)}</Text>
            <Text size="xs" c="dimmed">{t("adminPublish_revertLogged")}</Text>
            <Group justify="flex-end" gap="sm">
              <Button variant="default" disabled={revertBusy} onClick={() => setReverting(null)}>{t("common_cancel")}</Button>
              <Button
                color={REVERT_META[reverting.revert].color} loading={revertBusy} onClick={runRevert}
                leftSection={revertIcon(reverting.revert, 16)}
              >
                {t(REVERT_META[reverting.revert].label)}
              </Button>
            </Group>
          </Stack>
        )}
      </AppModal>

      <PublishRecordDetail item={openItem} preview onClose={() => setOpenItem(null)} />
      <PublishRunDetail run={openRun} onClose={() => setOpenRun(null)} />
    </Stack>
  );
}
