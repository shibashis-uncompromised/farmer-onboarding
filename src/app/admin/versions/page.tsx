"use client";

import { useEffect, useState } from "react";
import {
  ActionIcon, Badge, Center, Divider, Group, Loader, Pagination, Paper, ScrollArea,
  Select, Stack, Table, Text, TextInput, Title, Tooltip,
} from "@mantine/core";
import { ClockCounterClockwise, Eye, MagnifyingGlass, WarningCircle } from "@phosphor-icons/react";
import AppModal from "@/components/AppModal";
import {
  apiListEntityVersions, type EntityVersion, type EntityType, type VersionStatus,
} from "@/lib/api";
import { getSession } from "@/lib/session";
import {
  diffDynamicFields, dynamicFieldRows, fieldLabel, formatFieldValue,
  ENTITY_LABEL_KEY, ENTITY_COLOR, STATUS_LABEL_KEY, STATUS_COLOR, fmtVersionDate as fmtDate,
  type TFunc,
} from "@/lib/dynamicFieldMeta";
import { useLanguage, type Language } from "@/lib/i18n/LanguageContext";

// Read-only history of every dynamic-field version across farmers, farms and
// plots. There is no edit/approve/reject action here on purpose — this page
// is an audit trail; the review queue (approve/reject) lives on /admin/approvals.

const PAGE_SIZE = 20;

// Compact one-line preview of what this version actually CHANGED relative
// to the version right before it (not just a re-listing of every field it
// carries) — the full before/after breakdown is available via "view".
function summarize(row: EntityVersion, t: TFunc, language: Language) {
  const diff = diffDynamicFields(row.data, row.previous_data);
  if (diff.length === 0) return row.version_no === 1 ? "—" : t("adminVersions_summaryNoChanges");
  const text = diff
    .map(({ key, before, after }) => {
      const afterText = formatFieldValue(key, after, t, language);
      const beforeText = formatFieldValue(key, before, t, language);
      if (beforeText === "—") return `${fieldLabel(key, t)}: ${afterText}`;
      if (afterText === "—") return `${fieldLabel(key, t)}: ${t("adminVersions_clearedText")}`;
      return `${fieldLabel(key, t)}: ${beforeText} → ${afterText}`;
    })
    .join(" · ");
  return text.length > 90 ? text.slice(0, 90) + "…" : text;
}

export default function AdminVersionsPage() {
  const { t, language } = useLanguage();
  const [versions, setVersions] = useState<EntityVersion[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<EntityVersion | null>(null);

  const [status, setStatus] = useState<VersionStatus | "all">("all");
  const [entityType, setEntityType] = useState<EntityType | "all">("all");
  const [entityId, setEntityId] = useState("");
  const [submittedBy, setSubmittedBy] = useState("");
  const [from, setFrom] = useState(""); // yyyy-mm-dd (native date input)
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  // Any filter change jumps back to page 1, so a stale page number never
  // ends up out of range against the new, narrower result set.
  const updateFilter = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };
  const onStatus = updateFilter<VersionStatus | "all">(setStatus);
  const onEntityType = updateFilter<EntityType | "all">(setEntityType);
  const onEntityId = updateFilter<string>(setEntityId);
  const onSubmittedBy = updateFilter<string>(setSubmittedBy);
  const onFrom = updateFilter<string>(setFrom);
  const onTo = updateFilter<string>(setTo);

  useEffect(() => {
    const session = getSession();
    if (!session) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setError("");
      try {
        const { versions, total } = await apiListEntityVersions(session.token, {
          status, entityType,
          entityId: entityId.trim() || undefined,
          submittedBy: submittedBy.trim() || undefined,
          from: from ? new Date(`${from}T00:00:00`).getTime() : undefined,
          to: to ? new Date(`${to}T23:59:59`).getTime() : undefined,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        });
        if (cancelled) return;
        setVersions(versions);
        setTotal(total);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || t("adminVersions_couldNotLoad"));
      }
    }, 300); // light debounce so typing in the search fields doesn't fire a request per keystroke
    return () => { cancelled = true; clearTimeout(timer); };
  }, [status, entityType, entityId, submittedBy, from, to, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Stack gap="lg">
      <div>
        <Title order={3}>{t("adminVersions_title")}</Title>
        <Text c="dimmed" size="sm">
          {t("adminVersions_subtitle")}
        </Text>
      </div>

      <Group wrap="wrap" gap="sm" align="flex-end">
        <Select
          label={t("adminVersions_statusLabel")} value={status} onChange={(v) => onStatus((v as VersionStatus | "all") || "all")}
          data={[
            { value: "all", label: t("adminVersions_allStatuses") },
            { value: "pending", label: t(STATUS_LABEL_KEY.pending) },
            { value: "current", label: t(STATUS_LABEL_KEY.current) },
            { value: "rejected", label: t(STATUS_LABEL_KEY.rejected) },
            { value: "retired", label: t(STATUS_LABEL_KEY.retired) },
          ]}
          allowDeselect={false}
          w={150}
        />
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
        <TextInput
          label={t("adminVersions_fromLabel")} type="date"
          value={from} onChange={(e) => onFrom(e.currentTarget.value)}
          w={150}
        />
        <TextInput
          label={t("adminVersions_toLabel")} type="date"
          value={to} onChange={(e) => onTo(e.currentTarget.value)}
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
              <ClockCounterClockwise size={28} color="var(--mantine-color-gray-5)" />
              <Text c="dimmed" size="sm">{t("adminVersions_noResults")}</Text>
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
                  <Table.Th>{t("adminVersions_statusLabel")}</Table.Th>
                  <Table.Th>{t("adminVersions_colWhatChanged")}</Table.Th>
                  <Table.Th>{t("adminVersions_colSubmitted")}</Table.Th>
                  <Table.Th>{t("adminVersions_colReviewed")}</Table.Th>
                  <Table.Th w={50} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {versions.map((v) => (
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
                    <Table.Td>
                      <Badge color={STATUS_COLOR[v.status]} variant="light">{t(STATUS_LABEL_KEY[v.status])}</Badge>
                    </Table.Td>
                    <Table.Td maw={320}>
                      <Text size="sm" c="dimmed" truncate>{summarize(v, t, language)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{v.submitted_by || "—"}</Text>
                      <Text size="xs" c="dimmed">{fmtDate(v.submitted_at)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{v.reviewed_by || "—"}</Text>
                      <Text size="xs" c="dimmed">{fmtDate(v.reviewed_at)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label={t("adminVersions_viewSnapshot")}>
                        <ActionIcon variant="subtle" color="gray" onClick={() => setDetail(v)}>
                          <Eye size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
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
        opened={!!detail} onClose={() => setDetail(null)}
        title={detail ? `${t(ENTITY_LABEL_KEY[detail.entity_type])} ${detail.entity_id}` : t("adminVersions_modalTitleFallback")}
        size="md"
      >
        {detail && (
          <Stack gap="md">
            <Group gap={8} wrap="wrap">
              <Badge color={ENTITY_COLOR[detail.entity_type]} variant="light" radius="sm">{t(ENTITY_LABEL_KEY[detail.entity_type])}</Badge>
              <Badge color={STATUS_COLOR[detail.status]} variant="light" radius="sm">{t(STATUS_LABEL_KEY[detail.status])}</Badge>
              <Badge color="gray" variant="outline" radius="sm">{t("adminVersions_versionBadge", { n: detail.version_no })}</Badge>
            </Group>

            <Stack gap={2}>
              <Text size="sm">
                {t("adminVersions_submittedByPrefix")}: <Text span fw={600}>{detail.submitted_by || "—"}</Text>
                <Text span c="dimmed"> · {fmtDate(detail.submitted_at)}</Text>
              </Text>
              {detail.reviewed_by && (
                <Text size="sm">
                  {t("adminVersions_reviewedByPrefix")}: <Text span fw={600}>{detail.reviewed_by}</Text>
                  <Text span c="dimmed"> · {fmtDate(detail.reviewed_at)}</Text>
                </Text>
              )}
            </Stack>

            {detail.review_note && (
              <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-yellow-0)">
                <Text size="sm"><Text span fw={600}>{t("adminVersions_reviewNotePrefix")} </Text>{detail.review_note}</Text>
              </Paper>
            )}

            <Divider label={detail.version_no === 1 ? t("adminVersions_initialValues") : t("adminVersions_whatChangedFromPrevious")} labelPosition="left" />
            {(() => {
              const diff = diffDynamicFields(detail.data, detail.previous_data);
              if (diff.length === 0) {
                return (
                  <Text size="sm" c="dimmed">
                    {detail.version_no === 1 ? t("adminVersions_noFieldsThisVersion") : t("adminVersions_noChangesFromPrevious")}
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

            <Divider label={t("adminVersions_fullSnapshot")} labelPosition="left" />
            {dynamicFieldRows(detail.data).length === 0 ? (
              <Text size="sm" c="dimmed">{t("adminVersions_noFieldsRecorded")}</Text>
            ) : (
              <ScrollArea.Autosize mah={280}>
                <Table verticalSpacing={6} withRowBorders={false}>
                  <Table.Tbody>
                    {dynamicFieldRows(detail.data).map(([k, v]) => (
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
              </ScrollArea.Autosize>
            )}
          </Stack>
        )}
      </AppModal>
    </Stack>
  );
}
