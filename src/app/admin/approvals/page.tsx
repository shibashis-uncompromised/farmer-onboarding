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
  ENTITY_LABEL, ENTITY_COLOR, fmtVersionDate as fmtDate,
} from "@/lib/dynamicFieldMeta";

// The action counterpart to /admin/versions (which is read-only): every
// still-`pending` dynamic-field submission across farmers, farms and plots,
// waiting on an admin to approve (becomes `current`) or reject it. Approving
// here is the only way a POC's field submission ever reaches `current` —
// admin's own direct edits on /admin/records skip this queue entirely.

const PAGE_SIZE = 20;

export default function AdminApprovalsPage() {
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
    const t = setTimeout(async () => {
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
        setError(e?.message || "Could not load pending submissions");
      }
    }, 300); // light debounce so typing in the search fields doesn't fire a request per keystroke
    return () => { cancelled = true; clearTimeout(t); };
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
        message: `${ENTITY_LABEL[reviewing.entity_type]} ${reviewing.entity_id} v${reviewing.version_no} ${kind === "approve" ? "approved" : "rejected"}`,
      });
      setReviewing(null);
      setNote("");
      setReloadTick((n) => n + 1);
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || `Could not ${kind} this submission` });
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
        notifications.show({ color: "green", message: `Approved ${result.approved} submission${result.approved === 1 ? "" : "s"}` });
      } else {
        notifications.show({
          color: "yellow",
          message: `Approved ${result.approved} of ${result.total} — ${result.failed.length} failed (someone may have just reviewed them)`,
        });
      }
      setApproveAllOpen(false);
      setApproveAllNote("");
      setReloadTick((n) => n + 1);
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not approve all submissions" });
    } finally {
      setApprovingAll(false);
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Title order={3}>Approvals</Title>
          <Text c="dimmed" size="sm">
            Field submissions from POCs waiting on review. Approving replaces the entity&apos;s current
            values; rejecting leaves them untouched and keeps the submission on record as rejected.
          </Text>
        </div>
        <Button
          color="green" leftSection={<Checks size={16} />}
          disabled={!versions || versions.length === 0}
          onClick={() => setApproveAllOpen(true)}
        >
          Approve all{total > 0 ? ` (${total})` : ""}
        </Button>
      </Group>

      <Group wrap="wrap" gap="sm" align="flex-end">
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
              <Text c="dimmed" size="sm">Nothing waiting on review right now</Text>
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
                  <Table.Th>What changed</Table.Th>
                  <Table.Th>Submitted</Table.Th>
                  <Table.Th w={170} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {versions.map((v) => {
                  const diff = diffDynamicFields(v.data, v.previous_data);
                  const summary = diff.length === 0
                    ? (v.version_no === 1 ? "—" : "No changes recorded")
                    : diff.map(({ key, after }) => `${fieldLabel(key)}: ${formatFieldValue(key, after)}`).join(" · ");
                  return (
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
                      <Table.Td maw={340}>
                        <Text size="sm" c="dimmed" truncate>{summary.length > 100 ? summary.slice(0, 100) + "…" : summary}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{v.submitted_by || "—"}</Text>
                        <Text size="xs" c="dimmed">{fmtDate(v.submitted_at)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={6} wrap="nowrap" justify="flex-end">
                          <Tooltip label="Review">
                            <ActionIcon variant="subtle" color="gray" onClick={() => openReview(v)}>
                              <Eye size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Button size="xs" color="green" variant="light" leftSection={<CheckCircle size={14} />} onClick={() => openReview(v)}>
                            Review
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
        title={reviewing ? `${ENTITY_LABEL[reviewing.entity_type]} ${reviewing.entity_id} — v${reviewing.version_no}` : "Review submission"}
        size="md"
        closeOnClickOutside={!acting}
        withCloseButton={!acting}
      >
        {reviewing && (
          <Stack gap="md">
            <Text size="sm">
              Submitted by <Text span fw={600}>{reviewing.submitted_by || "—"}</Text>
              <Text span c="dimmed"> · {fmtDate(reviewing.submitted_at)}</Text>
            </Text>

            <Divider label={reviewing.version_no === 1 ? "Initial values" : "What changed from the current version"} labelPosition="left" />
            {(() => {
              const diff = diffDynamicFields(reviewing.data, reviewing.previous_data);
              if (diff.length === 0) {
                return (
                  <Text size="sm" c="dimmed">
                    {reviewing.version_no === 1 ? "No dynamic fields were recorded for this version." : "No changes recorded relative to the current version."}
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

            <Divider label="Full snapshot in this submission" labelPosition="left" />
            {dynamicFieldRows(reviewing.data).length === 0 ? (
              <Text size="sm" c="dimmed">No dynamic fields recorded.</Text>
            ) : (
              <Table verticalSpacing={6} withRowBorders={false}>
                <Table.Tbody>
                  {dynamicFieldRows(reviewing.data).map(([k, v]) => (
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
            )}

            <Textarea
              label="Review note (optional)"
              placeholder="Visible on the version history audit trail"
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
                Reject
              </Button>
              <Button
                color="green" leftSection={<CheckCircle size={16} />}
                loading={acting === "approve"} disabled={acting === "reject"}
                onClick={() => act("approve")}
              >
                Approve
              </Button>
            </Group>
          </Stack>
        )}
      </AppModal>

      <AppModal
        opened={approveAllOpen}
        onClose={() => { if (!approvingAll) { setApproveAllOpen(false); setApproveAllNote(""); } }}
        title="Approve all matching submissions"
        size="sm"
        closeOnClickOutside={!approvingAll}
        withCloseButton={!approvingAll}
      >
        <Stack gap="md">
          <Text size="sm">
            This approves <Text span fw={600}>{total}</Text> pending submission{total === 1 ? "" : "s"} matching the
            current filters — each becomes the entity&apos;s current version, retiring whatever was current before it.
            This can&apos;t be undone from here.
          </Text>
          <Textarea
            label="Review note (optional)"
            placeholder="Applied to every submission approved in this batch"
            value={approveAllNote}
            onChange={(e) => setApproveAllNote(e.currentTarget.value)}
            autosize minRows={2} maxRows={4}
            disabled={approvingAll}
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" disabled={approvingAll} onClick={() => { setApproveAllOpen(false); setApproveAllNote(""); }}>
              Cancel
            </Button>
            <Button color="green" leftSection={<Checks size={16} />} loading={approvingAll} onClick={runApproveAll}>
              Approve all
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  );
}
