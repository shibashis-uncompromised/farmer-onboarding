"use client";

import { useEffect, useState } from "react";
import {
  ActionIcon, Badge, Button, Center, Divider, Group, Loader, Pagination, Paper,
  Select, Stack, Table, Text, Textarea, TextInput, Title, Tooltip,
} from "@mantine/core";
import { CheckCircle, Checks, ClipboardText, Eye, MagnifyingGlass, WarningCircle, XCircle } from "@phosphor-icons/react";
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Title order={3}>{t("adminApprovals_title")}</Title>
          <Text c="dimmed" size="sm">
            {t("adminApprovals_subtitle")}
          </Text>
        </div>
        <Button
          color="green" leftSection={<Checks size={16} />}
          disabled={!versions || versions.length === 0}
          onClick={() => setApproveAllOpen(true)}
        >
          {t("adminApprovals_approveAll")}{total > 0 ? ` (${total})` : ""}
        </Button>
      </Group>

      <Group wrap="wrap" gap="sm" align="flex-end">
        <Select
          label={t("adminVersions_entityTypeLabel")} value={entityType} onChange={(v) => onEntityType((v as EntityType | "all") || "all")}
          data={[
            { value: "all", label: t("adminVersions_allTypes") },
            { value: "farmer", label: t(ENTITY_LABEL_KEY.farmer) },
            { value: "farm", label: t(ENTITY_LABEL_KEY.farm) },
            { value: "plot", label: t(ENTITY_LABEL_KEY.plot) },
          ]}
          allowDeselect={false}
          w={140}
        />
        <TextInput
          label={t("adminVersions_entityIdLabel")} placeholder={t("adminVersions_entityIdPlaceholder")}
          leftSection={<MagnifyingGlass size={14} />}
          value={entityId} onChange={(e) => onEntityId(e.currentTarget.value)}
          w={170}
        />
        <TextInput
          label={t("adminVersions_submittedByLabel")} placeholder={t("adminVersions_usernamePlaceholder")}
          value={submittedBy} onChange={(e) => onSubmittedBy(e.currentTarget.value)}
          w={150}
        />
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
            </Stack>
          </Center>
        )}
        {versions && !error && versions.length > 0 && (
          <Table.ScrollContainer minWidth={900}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("adminVersions_colEntity")}</Table.Th>
                  <Table.Th>{t("adminVersions_colVersion")}</Table.Th>
                  <Table.Th>{t("adminVersions_colWhatChanged")}</Table.Th>
                  <Table.Th>{t("adminVersions_colSubmitted")}</Table.Th>
                  <Table.Th w={170} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {versions.map((v) => {
                  const diff = diffDynamicFields(v.data, v.previous_data);
                  const summary = diff.length === 0
                    ? (v.version_no === 1 ? "—" : t("adminVersions_summaryNoChanges"))
                    : diff.map(({ key, after }) => `${fieldLabel(key, t)}: ${formatFieldValue(key, after, t, language)}`).join(" · ");
                  return (
                    <Table.Tr key={v.id}>
                      <Table.Td>
                        <Group gap={6} wrap="nowrap">
                          <Badge color={ENTITY_COLOR[v.entity_type]} variant="light" radius="sm">
                            {t(ENTITY_LABEL_KEY[v.entity_type])}
                          </Badge>
                          <Text size="sm" fw={500}>{v.entity_id}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td><Text size="sm" c="dimmed">v{v.version_no}</Text></Table.Td>
                      <Table.Td maw={340}>
                        <Text size="sm" c="dimmed" truncate>{summary.length > 100 ? summary.slice(0, 100) + "…" : summary}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{v.submitted_by || "—"}</Text>
                        <Text size="xs" c="dimmed">{fmtDate(v.submitted_at)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={6} wrap="nowrap" justify="flex-end">
                          <Tooltip label={t("adminApprovals_review")}>
                            <ActionIcon variant="subtle" color="gray" onClick={() => openReview(v)}>
                              <Eye size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Button size="xs" color="green" variant="light" leftSection={<CheckCircle size={14} />} onClick={() => openReview(v)}>
                            {t("adminApprovals_review")}
                          </Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
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
