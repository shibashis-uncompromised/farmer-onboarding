"use client";

import { Fragment, useEffect, useState } from "react";
import {
  ActionIcon, Badge, Button, Center, Checkbox, Divider, Group, Loader, Pagination, Paper,
  Stack, Table, Text, Textarea, TextInput, Title, Tooltip,
} from "@mantine/core";
import {
  ArrowsClockwise, CaretDown, CaretRight, Check, CheckCircle, Checks, ClipboardText, Eye, MagnifyingGlass,
  WarningCircle, X, XCircle,
} from "@phosphor-icons/react";
import { notifications } from "@mantine/notifications";
import AppModal from "@/components/AppModal";
import {
  apiApproveAllEntityVersions, apiApproveEntityVersion, apiListEntityVersions, apiRejectEntityVersion,
  type EntityVersion, type EntityType,
} from "@/lib/api";
import { getSession } from "@/lib/session";
import {
  diffDynamicFields, dynamicFieldRows, fieldLabel, formatFieldValue,
  ENTITY_LABEL_KEY, ENTITY_COLOR, fmtVersionDate as fmtDate,
} from "@/lib/dynamicFieldMeta";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// The action counterpart to /admin/versions (which is read-only): every
// still-`pending` dynamic-field submission across farmers, farms and plots,
// waiting on an admin to approve (becomes `current`) or reject it. Approving
// here is the only way a POC's field submission ever reaches `current` —
// admin's own direct edits on /admin/records skip this queue entirely.

const PAGE_SIZE = 20;

export default function AdminApprovalsPage() {
  const { t, language } = useLanguage();
  const [versions, setVersions] = useState<EntityVersion[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [reviewing, setReviewing] = useState<EntityVersion | null>(null);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState<"approve" | "reject" | null>(null);

  const [approveAllOpen, setApproveAllOpen] = useState(false);
  const [approveAllNote, setApproveAllNote] = useState("");
  const [approvingAll, setApprovingAll] = useState(false);

  const [entityType, setEntityType] = useState<EntityType | "all">("all");
  const [entityId, setEntityId] = useState("");
  const [submittedBy, setSubmittedBy] = useState("");
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);
  // Interactive bits: pending counts per type (the filter buttons), ticked
  // rows for bulk actions, expanded rows showing the change inline, and the
  // row(s) currently being approved/rejected.
  const [counts, setCounts] = useState<Record<EntityType | "all", number> | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<"approve" | "reject" | null>(null);

  const updateFilter = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };
  const onEntityType = updateFilter<EntityType | "all">(setEntityType);
  const onEntityId = updateFilter<string>(setEntityId);
  const onSubmittedBy = updateFilter<string>(setSubmittedBy);

  useEffect(() => {
    const session = getSession();
    if (!session) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setError("");
      try {
        const { versions, total } = await apiListEntityVersions(session.token, {
          status: "pending",
          entityType,
          entityId: entityId.trim() || undefined,
          submittedBy: submittedBy.trim() || undefined,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        });
        if (cancelled) return;
        setVersions(versions);
        setTotal(total);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || t("adminApprovals_couldNotLoad"));
      }
    }, 300); // light debounce so typing in the search fields doesn't fire a request per keystroke
    return () => { cancelled = true; clearTimeout(timer); };
  }, [entityType, entityId, submittedBy, page, reloadTick]);

  // Pending counts for the filter buttons (cheap: limit 1, only totals used).
  useEffect(() => {
    const session = getSession();
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const types: (EntityType | "all")[] = ["all", "farmer", "farm", "plot"];
        const totals = await Promise.all(types.map((et) =>
          apiListEntityVersions(session.token, { status: "pending", entityType: et, limit: 1 }).then((r) => r.total)));
        if (!cancelled) setCounts(Object.fromEntries(types.map((et, i) => [et, totals[i]])) as Record<EntityType | "all", number>);
      } catch { /* counts are a nicety — the list shows its own error */ }
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);
  // Selections only make sense for rows on screen.
  useEffect(() => { setSelected(new Set()); }, [entityType, entityId, submittedBy, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const toggle = (setter: typeof setSelected, id: number) =>
    setter((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const label = (v: EntityVersion) => `${t(ENTITY_LABEL_KEY[v.entity_type])} ${v.entity_id} v${v.version_no}`;

  // One-click approve / reject from the row (no note).
  const quick = async (v: EntityVersion, kind: "approve" | "reject") => {
    const session = getSession();
    if (!session) return;
    setBusy((b) => new Set(b).add(v.id));
    try {
      if (kind === "approve") await apiApproveEntityVersion(session.token, v.id);
      else await apiRejectEntityVersion(session.token, v.id);
      notifications.show({
        color: kind === "approve" ? "green" : "red",
        message: `${label(v)} ${kind === "approve" ? t("adminApprovals_approvedWord") : t("adminApprovals_rejectedWord")}`,
      });
      setReloadTick((n) => n + 1);
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || (kind === "approve" ? t("adminApprovals_couldNotApprove") : t("adminApprovals_couldNotReject")) });
    } finally {
      setBusy((b) => { const n = new Set(b); n.delete(v.id); return n; });
    }
  };

  // Approve / reject every ticked row, one by one, then summarize.
  const bulk = async (kind: "approve" | "reject") => {
    const session = getSession();
    if (!session || !versions) return;
    const targets = versions.filter((v) => selected.has(v.id));
    if (kind === "reject" && !window.confirm(t("adminApprovals_rejectSelectedConfirm", { n: targets.length }))) return;
    setBulkBusy(kind);
    let ok = 0, failed = 0;
    for (const v of targets) {
      try {
        if (kind === "approve") await apiApproveEntityVersion(session.token, v.id);
        else await apiRejectEntityVersion(session.token, v.id);
        ok++;
      } catch { failed++; }
    }
    setBulkBusy(null);
    setSelected(new Set());
    notifications.show({
      color: failed ? "yellow" : kind === "approve" ? "green" : "red",
      message: t(kind === "approve" ? "adminApprovals_bulkApproved" : "adminApprovals_bulkRejected", { n: ok })
        + (failed ? ` · ${t("adminApprovals_bulkFailed", { n: failed })}` : ""),
    });
    setReloadTick((n) => n + 1);
  };

  const openReview = (v: EntityVersion) => { setReviewing(v); setNote(""); };
  const closeReview = () => { if (!acting) { setReviewing(null); setNote(""); } };

  const act = async (kind: "approve" | "reject") => {
    if (!reviewing) return;
    const session = getSession();
    if (!session) return;
    setActing(kind);
    try {
      if (kind === "approve") await apiApproveEntityVersion(session.token, reviewing.id, note.trim() || undefined);
      else await apiRejectEntityVersion(session.token, reviewing.id, note.trim() || undefined);
      notifications.show({
        color: kind === "approve" ? "green" : "red",
        message: `${t(ENTITY_LABEL_KEY[reviewing.entity_type])} ${reviewing.entity_id} v${reviewing.version_no} ${kind === "approve" ? t("adminApprovals_approvedWord") : t("adminApprovals_rejectedWord")}`,
      });
      setReviewing(null);
      setNote("");
      setReloadTick((n) => n + 1);
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || (kind === "approve" ? t("adminApprovals_couldNotApprove") : t("adminApprovals_couldNotReject")) });
    } finally {
      setActing(null);
    }
  };

  const runApproveAll = async () => {
    const session = getSession();
    if (!session) return;
    setApprovingAll(true);
    try {
      const result = await apiApproveAllEntityVersions(session.token, {
        entityType,
        entityId: entityId.trim() || undefined,
        submittedBy: submittedBy.trim() || undefined,
        note: approveAllNote.trim() || undefined,
      });
      if (result.failed.length === 0) {
        notifications.show({ color: "green", message: t("adminApprovals_approvedCountToast", { n: result.approved }) });
      } else {
        notifications.show({
          color: "yellow",
          message: t("adminApprovals_approvedPartialToast", { approved: result.approved, total: result.total, failed: result.failed.length }),
        });
      }
      setApproveAllOpen(false);
      setApproveAllNote("");
      setReloadTick((n) => n + 1);
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || t("adminApprovals_couldNotApproveAll") });
    } finally {
      setApprovingAll(false);
    }
  };

  const allOnPage = (versions || []).map((v) => v.id);
  const allTicked = allOnPage.length > 0 && allOnPage.every((id) => selected.has(id));
  const typeFilters: { value: EntityType | "all"; key: Parameters<typeof t>[0]; color: string }[] = [
    { value: "all", key: "adminApprovals_filterAll", color: "gray" },
    { value: "farmer", key: ENTITY_LABEL_KEY.farmer, color: ENTITY_COLOR.farmer },
    { value: "farm", key: ENTITY_LABEL_KEY.farm, color: ENTITY_COLOR.farm },
    { value: "plot", key: ENTITY_LABEL_KEY.plot, color: ENTITY_COLOR.plot },
  ];

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div style={{ maxWidth: 760 }}>
          <Title order={3}>{t("adminApprovals_title")}</Title>
          <Text c="dimmed" size="sm">{t("adminApprovals_subtitle")}</Text>
        </div>
        <Group gap="sm">
          <Button variant="default" leftSection={<ArrowsClockwise size={16} />} onClick={() => setReloadTick((n) => n + 1)}>
            {t("adminRecords_refresh")}
          </Button>
          <Button
            color="green" leftSection={<Checks size={16} />}
            disabled={!versions || versions.length === 0}
            onClick={() => setApproveAllOpen(true)}
          >
            {t("adminApprovals_approveAll")}{total > 0 ? ` (${total})` : ""}
          </Button>
        </Group>
      </Group>

      {/* Pending counts per type — click to filter. */}
      <Group gap="sm">
        {typeFilters.map((f) => (
          <Button
            key={f.value} size="compact-sm" radius="xl" color={f.color}
            variant={entityType === f.value ? "filled" : "light"} aria-pressed={entityType === f.value}
            onClick={() => onEntityType(f.value)}
          >
            {t(f.key)}{counts ? `: ${counts[f.value]}` : ""}
          </Button>
        ))}
      </Group>

      <Group wrap="wrap" gap="sm" align="flex-end">
        <TextInput
          label={t("adminVersions_entityIdLabel")} placeholder={t("adminVersions_entityIdPlaceholder")}
          leftSection={<MagnifyingGlass size={14} />}
          value={entityId} onChange={(e) => onEntityId(e.currentTarget.value)}
          w={190}
        />
        <TextInput
          label={t("adminVersions_submittedByLabel")} placeholder={t("adminVersions_usernamePlaceholder")}
          value={submittedBy} onChange={(e) => onSubmittedBy(e.currentTarget.value)}
          w={170}
        />
        {selected.size > 0 && (
          <Group gap="sm" ml="auto">
            <Text size="sm" fw={500}>{t("adminApprovals_selectedN", { n: selected.size })}</Text>
            <Button size="sm" color="green" leftSection={<Check size={16} />} loading={bulkBusy === "approve"}
              disabled={bulkBusy === "reject"} onClick={() => bulk("approve")}>
              {t("adminApprovals_approveSelected")}
            </Button>
            <Button size="sm" color="red" variant="light" leftSection={<X size={16} />} loading={bulkBusy === "reject"}
              disabled={bulkBusy === "approve"} onClick={() => bulk("reject")}>
              {t("adminApprovals_rejectSelected")}
            </Button>
          </Group>
        )}
      </Group>

      <Paper withBorder radius="lg" p={0}>
        {!versions && !error && (
          <Center p="xl"><Loader color="green" /></Center>
        )}
        {error && (
          <Center p="xl">
            <Stack align="center" gap={6}>
              <WarningCircle size={28} color="var(--mantine-color-red-6)" />
              <Text c="red" size="sm">{error}</Text>
            </Stack>
          </Center>
        )}
        {versions && !error && versions.length === 0 && (
          <Center p="xl">
            <Stack align="center" gap={6}>
              <ClipboardText size={28} color="var(--mantine-color-gray-5)" />
              <Text c="dimmed" size="sm">{t("adminApprovals_nothingPending")}</Text>
              {(entityType !== "all" || entityId.trim() || submittedBy.trim()) && (
                <Button size="xs" variant="subtle" onClick={() => { onEntityType("all"); onEntityId(""); onSubmittedBy(""); }}>
                  {t("adminApprovals_clearFilters")}
                </Button>
              )}
            </Stack>
          </Center>
        )}
        {versions && !error && versions.length > 0 && (
          <>
            <Text size="xs" c="dimmed" px="md" pt="sm">{t("adminApprovals_clickHint")}</Text>
            <Table.ScrollContainer minWidth={900}>
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={36}>
                      <Checkbox
                        aria-label={t("adminPublish_selectAll")}
                        checked={allTicked}
                        indeterminate={!allTicked && allOnPage.some((id) => selected.has(id))}
                        onChange={(e) => setSelected(e.currentTarget.checked ? new Set(allOnPage) : new Set())}
                      />
                    </Table.Th>
                    <Table.Th>{t("adminVersions_colEntity")}</Table.Th>
                    <Table.Th>{t("adminVersions_colWhatChanged")}</Table.Th>
                    <Table.Th>{t("adminVersions_colSubmitted")}</Table.Th>
                    <Table.Th w={190} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {versions.map((v) => {
                    const diff = diffDynamicFields(v.data, v.previous_data);
                    const summary = diff.length === 0
                      ? (v.version_no === 1 ? "—" : t("adminVersions_summaryNoChanges"))
                      : diff.map(({ key, after }) => `${fieldLabel(key, t)}: ${formatFieldValue(key, after, t, language)}`).join(" · ");
                    const open = expanded.has(v.id);
                    const isBusy = busy.has(v.id);
                    return (
                      <Fragment key={v.id}>
                        <Table.Tr style={{ cursor: "pointer" }} onClick={() => toggle(setExpanded, v.id)}
                          bg={selected.has(v.id) ? "var(--mantine-color-green-light)" : undefined}>
                          <Table.Td onClick={(e) => e.stopPropagation()}>
                            <Checkbox aria-label={label(v)} checked={selected.has(v.id)} onChange={() => toggle(setSelected, v.id)} />
                          </Table.Td>
                          <Table.Td>
                            <Group gap={6} wrap="nowrap">
                              {open ? <CaretDown size={14} /> : <CaretRight size={14} />}
                              <Badge color={ENTITY_COLOR[v.entity_type]} variant="light" radius="sm">{t(ENTITY_LABEL_KEY[v.entity_type])}</Badge>
                              <div>
                                <Text size="sm" fw={500}>{v.entity_id}</Text>
                                <Text size="xs" c="dimmed">v{v.version_no}</Text>
                              </div>
                            </Group>
                          </Table.Td>
                          <Table.Td maw={360}>
                            <Text size="sm" c="dimmed" lineClamp={open ? undefined : 1}>{summary}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{v.submitted_by || "—"}</Text>
                            <Text size="xs" c="dimmed">{fmtDate(v.submitted_at)}</Text>
                          </Table.Td>
                          <Table.Td onClick={(e) => e.stopPropagation()}>
                            <Group gap={6} wrap="nowrap" justify="flex-end">
                              <Tooltip label={t("adminApprovals_approveButton")}>
                                <ActionIcon variant="light" color="green" size="lg" loading={isBusy} onClick={() => quick(v, "approve")}
                                  aria-label={t("adminApprovals_approveButton")}>
                                  <Check size={18} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label={t("adminApprovals_rejectButton")}>
                                <ActionIcon variant="light" color="red" size="lg" disabled={isBusy} onClick={() => quick(v, "reject")}
                                  aria-label={t("adminApprovals_rejectButton")}>
                                  <X size={18} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label={t("adminApprovals_reviewWithNote")}>
                                <ActionIcon variant="subtle" color="gray" size="lg" disabled={isBusy} onClick={() => openReview(v)}
                                  aria-label={t("adminApprovals_review")}>
                                  <Eye size={18} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                        {open && (
                          <Table.Tr>
                            <Table.Td />
                            <Table.Td colSpan={4} bg="var(--mantine-color-gray-0)">
                              {diff.length === 0 ? (
                                <Text size="sm" c="dimmed">
                                  {v.version_no === 1 ? t("adminVersions_noFieldsThisVersion") : t("adminApprovals_noChangesFromCurrent")}
                                </Text>
                              ) : (
                                <Table verticalSpacing={4} withRowBorders={false}>
                                  <Table.Tbody>
                                    {diff.map(({ key, before, after }) => {
                                      const b = formatFieldValue(key, before, t, language);
                                      const a = formatFieldValue(key, after, t, language);
                                      return (
                                        <Table.Tr key={key}>
                                          <Table.Td w="30%"><Text size="sm" c="dimmed">{fieldLabel(key, t)}</Text></Table.Td>
                                          <Table.Td>
                                            <Group gap={6} wrap="wrap">
                                              {b !== "—" && <Text size="sm" c="dimmed" td="line-through">{b}</Text>}
                                              {b !== "—" && <Text size="sm" c="dimmed">→</Text>}
                                              {a === "—"
                                                ? <Badge size="xs" color="red" variant="light">{t("adminVersions_clearedText")}</Badge>
                                                : <Text size="sm" fw={600}>{a}</Text>}
                                            </Group>
                                          </Table.Td>
                                        </Table.Tr>
                                      );
                                    })}
                                  </Table.Tbody>
                                </Table>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </Fragment>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </>
        )}
        {versions && !error && versions.length > 0 && totalPages > 1 && (
          <Group justify="center" p="md">
            <Pagination value={page} onChange={setPage} total={totalPages} color="green" />
          </Group>
        )}
      </Paper>

      <AppModal
        opened={!!reviewing} onClose={closeReview}
        title={reviewing ? `${t(ENTITY_LABEL_KEY[reviewing.entity_type])} ${reviewing.entity_id} — v${reviewing.version_no}` : t("adminApprovals_reviewSubmissionTitle")}
        size="md"
        closeOnClickOutside={!acting}
        withCloseButton={!acting}
      >
        {reviewing && (
          <Stack gap="md">
            <Text size="sm">
              {t("adminVersions_submittedByPrefix")}: <Text span fw={600}>{reviewing.submitted_by || "—"}</Text>
              <Text span c="dimmed"> · {fmtDate(reviewing.submitted_at)}</Text>
            </Text>

            <Divider label={reviewing.version_no === 1 ? t("adminVersions_initialValues") : t("adminApprovals_whatChangedFromCurrent")} labelPosition="left" />
            {(() => {
              const diff = diffDynamicFields(reviewing.data, reviewing.previous_data);
              if (diff.length === 0) {
                return (
                  <Text size="sm" c="dimmed">
                    {reviewing.version_no === 1 ? t("adminVersions_noFieldsThisVersion") : t("adminApprovals_noChangesFromCurrent")}
                  </Text>
                );
              }
              return (
                <Table verticalSpacing={8} withRowBorders={false}>
                  <Table.Tbody>
                    {diff.map(({ key, before, after }) => {
                      const afterText = formatFieldValue(key, after, t, language);
                      const beforeText = formatFieldValue(key, before, t, language);
                      return (
                        <Table.Tr key={key}>
                          <Table.Td w="38%" style={{ verticalAlign: "top" }}>
                            <Text size="sm" c="dimmed">{fieldLabel(key, t)}</Text>
                          </Table.Td>
                          <Table.Td>
                            {beforeText === "—" ? (
                              <Text size="sm" fw={500}>{afterText}</Text>
                            ) : afterText === "—" ? (
                              <Group gap={6} wrap="nowrap">
                                <Text size="sm" td="line-through" c="dimmed">{beforeText}</Text>
                                <Badge size="xs" color="red" variant="light">{t("adminVersions_clearedText")}</Badge>
                              </Group>
                            ) : (
                              <Group gap={6} wrap="wrap">
                                <Text size="sm" c="dimmed" td="line-through">{beforeText}</Text>
                                <Text size="sm" c="dimmed">→</Text>
                                <Text size="sm" fw={500}>{afterText}</Text>
                              </Group>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              );
            })()}

            <Divider label={t("adminApprovals_fullSnapshotInSubmission")} labelPosition="left" />
            {dynamicFieldRows(reviewing.data).length === 0 ? (
              <Text size="sm" c="dimmed">{t("adminVersions_noFieldsRecorded")}</Text>
            ) : (
              <Table verticalSpacing={6} withRowBorders={false}>
                <Table.Tbody>
                  {dynamicFieldRows(reviewing.data).map(([k, v]) => (
                    <Table.Tr key={k}>
                      <Table.Td w="42%" style={{ verticalAlign: "top" }}>
                        <Text size="sm" c="dimmed">{fieldLabel(k, t)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>{formatFieldValue(k, v, t, language)}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}

            <Textarea
              label={t("adminApprovals_reviewNoteLabel")}
              placeholder={t("adminApprovals_reviewNotePlaceholder")}
              value={note}
              onChange={(e) => setNote(e.currentTarget.value)}
              autosize minRows={2} maxRows={4}
              disabled={!!acting}
            />

            <Group justify="flex-end" gap="sm">
              <Button
                variant="light" color="red" leftSection={<XCircle size={16} />}
                loading={acting === "reject"} disabled={acting === "approve"}
                onClick={() => act("reject")}
              >
                {t("adminApprovals_rejectButton")}
              </Button>
              <Button
                color="green" leftSection={<CheckCircle size={16} />}
                loading={acting === "approve"} disabled={acting === "reject"}
                onClick={() => act("approve")}
              >
                {t("adminApprovals_approveButton")}
              </Button>
            </Group>
          </Stack>
        )}
      </AppModal>

      <AppModal
        opened={approveAllOpen}
        onClose={() => { if (!approvingAll) { setApproveAllOpen(false); setApproveAllNote(""); } }}
        title={t("adminApprovals_approveAllModalTitle")}
        size="sm"
        closeOnClickOutside={!approvingAll}
        withCloseButton={!approvingAll}
      >
        <Stack gap="md">
          <Text size="sm">
            {t("adminApprovals_approveAllConfirmText", { n: total })}
          </Text>
          <Textarea
            label={t("adminApprovals_reviewNoteLabel")}
            placeholder={t("adminApprovals_approveAllNotePlaceholder")}
            value={approveAllNote}
            onChange={(e) => setApproveAllNote(e.currentTarget.value)}
            autosize minRows={2} maxRows={4}
            disabled={approvingAll}
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" disabled={approvingAll} onClick={() => { setApproveAllOpen(false); setApproveAllNote(""); }}>
              {t("common_cancel")}
            </Button>
            <Button color="green" leftSection={<Checks size={16} />} loading={approvingAll} onClick={runApproveAll}>
              {t("adminApprovals_approveAll")}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  );
}
