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
import { diffDynamicFields, dynamicFieldRows, fieldLabel, formatFieldValue } from "@/lib/dynamicFieldMeta";

// Read-only history of every dynamic-field version across farmers, farms and
// plots. There is no edit/approve/reject action here on purpose — this page
// is an audit trail; the review queue (approve/reject) lives elsewhere.

const STATUS_COLOR: Record<VersionStatus, string> = {
  pending: "yellow", current: "green", rejected: "red", retired: "gray",
};
const STATUS_LABEL: Record<VersionStatus, string> = {
  pending: "Pending", current: "Current", rejected: "Rejected", retired: "Retired",
};
const ENTITY_LABEL: Record<EntityType, string> = { farmer: "Farmer", farm: "Farm", plot: "Plot" };
const ENTITY_COLOR: Record<EntityType, string> = { farmer: "grape", farm: "blue", plot: "teal" };

const PAGE_SIZE = 20;

// submitted_at/reviewed_at are BIGINT columns in Postgres, which node-postgres
// returns as strings (not numbers) — new Date("1756...") tries to parse that
// as a date STRING and fails ("Invalid Date"), rather than treating it as an
// epoch. Coerce defensively, same fix already used for soil_samples elsewhere
// in this app's backend.
function fmtDate(ms: number | string | null | undefined) {
  if (ms === null || ms === undefined || ms === "") return "—";
  const n = typeof ms === "number" ? ms : Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return new Date(n).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}

// Compact one-line preview of what this version actually CHANGED relative
// to the version right before it (not just a re-listing of every field it
// carries) — the full before/after breakdown is available via "view".
function summarize(row: EntityVersion) {
  const diff = diffDynamicFields(row.data, row.previous_data);
  if (diff.length === 0) return row.version_no === 1 ? "—" : "No changes recorded";
  const text = diff
    .map(({ key, before, after }) => {
      const afterText = formatFieldValue(key, after);
      const beforeText = formatFieldValue(key, before);
      if (beforeText === "—") return `${fieldLabel(key)}: ${afterText}`;
      if (afterText === "—") return `${fieldLabel(key)}: cleared`;
      return `${fieldLabel(key)}: ${beforeText} → ${afterText}`;
    })
    .join(" · ");
  return text.length > 90 ? text.slice(0, 90) + "…" : text;
}

export default function AdminVersionsPage() {
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
    const t = setTimeout(async () => {
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
        setError(e?.message || "Could not load version history");
      }
    }, 300); // light debounce so typing in the search fields doesn't fire a request per keystroke
    return () => { cancelled = true; clearTimeout(t); };
  }, [status, entityType, entityId, submittedBy, from, to, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Stack gap="lg">
      <div>
        <Title order={3}>Version History</Title>
        <Text c="dimmed" size="sm">
          Every dynamic-field submission across farmers, farms and plots — pending, current, rejected or
          retired. Read-only audit trail; nothing here can be edited.
        </Text>
      </div>

      <Group wrap="wrap" gap="sm" align="flex-end">
        <Select
          label="Status" value={status} onChange={(v) => onStatus((v as VersionStatus | "all") || "all")}
          data={[
            { value: "all", label: "All statuses" },
            { value: "pending", label: "Pending" },
            { value: "current", label: "Current" },
            { value: "rejected", label: "Rejected" },
            { value: "retired", label: "Retired" },
          ]}
          allowDeselect={false}
          w={150}
        />
        <Select
          label="Entity type" value={entityType} onChange={(v) => onEntityType((v as EntityType | "all") || "all")}
          data={[
            { value: "all", label: "All types" },
            { value: "farmer", label: "Farmer" },
            { value: "farm", label: "Farm" },
            { value: "plot", label: "Plot" },
          ]}
          allowDeselect={false}
          w={140}
        />
        <TextInput
          label="Entity ID" placeholder="e.g. RJ001U001"
          leftSection={<MagnifyingGlass size={14} />}
          value={entityId} onChange={(e) => onEntityId(e.currentTarget.value)}
          w={170}
        />
        <TextInput
          label="Submitted by" placeholder="username"
          value={submittedBy} onChange={(e) => onSubmittedBy(e.currentTarget.value)}
          w={150}
        />
        <TextInput
          label="From" type="date"
          value={from} onChange={(e) => onFrom(e.currentTarget.value)}
          w={150}
        />
        <TextInput
          label="To" type="date"
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
              <Text c="dimmed" size="sm">No version history matches these filters</Text>
            </Stack>
          </Center>
        )}
        {versions && !error && versions.length > 0 && (
          <Table.ScrollContainer minWidth={900}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Entity</Table.Th>
                  <Table.Th>Version</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>What changed</Table.Th>
                  <Table.Th>Submitted</Table.Th>
                  <Table.Th>Reviewed</Table.Th>
                  <Table.Th w={50} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {versions.map((v) => (
                  <Table.Tr key={v.id}>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <Badge color={ENTITY_COLOR[v.entity_type]} variant="light" radius="sm">
                          {ENTITY_LABEL[v.entity_type]}
                        </Badge>
                        <Text size="sm" fw={500}>{v.entity_id}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td><Text size="sm" c="dimmed">v{v.version_no}</Text></Table.Td>
                    <Table.Td>
                      <Badge color={STATUS_COLOR[v.status]} variant="light">{STATUS_LABEL[v.status]}</Badge>
                    </Table.Td>
                    <Table.Td maw={320}>
                      <Text size="sm" c="dimmed" truncate>{summarize(v)}</Text>
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
                      <Tooltip label="View full snapshot">
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
        title={detail ? `${ENTITY_LABEL[detail.entity_type]} ${detail.entity_id}` : "Version snapshot"}
        size="md"
      >
        {detail && (
          <Stack gap="md">
            <Group gap={8} wrap="wrap">
              <Badge color={ENTITY_COLOR[detail.entity_type]} variant="light" radius="sm">{ENTITY_LABEL[detail.entity_type]}</Badge>
              <Badge color={STATUS_COLOR[detail.status]} variant="light" radius="sm">{STATUS_LABEL[detail.status]}</Badge>
              <Badge color="gray" variant="outline" radius="sm">Version {detail.version_no}</Badge>
            </Group>

            <Stack gap={2}>
              <Text size="sm">
                Submitted by <Text span fw={600}>{detail.submitted_by || "—"}</Text>
                <Text span c="dimmed"> · {fmtDate(detail.submitted_at)}</Text>
              </Text>
              {detail.reviewed_by && (
                <Text size="sm">
                  Reviewed by <Text span fw={600}>{detail.reviewed_by}</Text>
                  <Text span c="dimmed"> · {fmtDate(detail.reviewed_at)}</Text>
                </Text>
              )}
            </Stack>

            {detail.review_note && (
              <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-yellow-0)">
                <Text size="sm"><Text span fw={600}>Review note: </Text>{detail.review_note}</Text>
              </Paper>
            )}

            <Divider label={detail.version_no === 1 ? "Initial values" : "What changed from the previous version"} labelPosition="left" />
            {(() => {
              const diff = diffDynamicFields(detail.data, detail.previous_data);
              if (diff.length === 0) {
                return (
                  <Text size="sm" c="dimmed">
                    {detail.version_no === 1 ? "No dynamic fields were recorded for this version." : "No changes recorded relative to the previous version."}
                  </Text>
                );
              }
              return (
                <Table verticalSpacing={8} withRowBorders={false}>
                  <Table.Tbody>
                    {diff.map(({ key, before, after }) => {
                      const afterText = formatFieldValue(key, after);
                      const beforeText = formatFieldValue(key, before);
                      return (
                        <Table.Tr key={key}>
                          <Table.Td w="38%" style={{ verticalAlign: "top" }}>
                            <Text size="sm" c="dimmed">{fieldLabel(key)}</Text>
                          </Table.Td>
                          <Table.Td>
                            {beforeText === "—" ? (
                              <Text size="sm" fw={500}>{afterText}</Text>
                            ) : afterText === "—" ? (
                              <Group gap={6} wrap="nowrap">
                                <Text size="sm" td="line-through" c="dimmed">{beforeText}</Text>
                                <Badge size="xs" color="red" variant="light">cleared</Badge>
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

            <Divider label="Full snapshot at this version" labelPosition="left" />
            {dynamicFieldRows(detail.data).length === 0 ? (
              <Text size="sm" c="dimmed">No dynamic fields recorded.</Text>
            ) : (
              <ScrollArea.Autosize mah={280}>
                <Table verticalSpacing={6} withRowBorders={false}>
                  <Table.Tbody>
                    {dynamicFieldRows(detail.data).map(([k, v]) => (
                      <Table.Tr key={k}>
                        <Table.Td w="42%" style={{ verticalAlign: "top" }}>
                          <Text size="sm" c="dimmed">{fieldLabel(k)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>{formatFieldValue(k, v)}</Text>
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
