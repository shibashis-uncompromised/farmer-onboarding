"use client";

import { useEffect, useState } from "react";
import { Badge, Center, Group, Loader, Pagination, Select, Stack, Table, Text, TextInput } from "@mantine/core";
import { MagnifyingGlass, WarningCircle } from "@phosphor-icons/react";
import AppModal from "@/components/AppModal";
import PublishRecordDetail from "@/components/admin/PublishRecordDetail";
import { apiPublishRunItems, type PublishItem, type PublishRun, type PublishStatus } from "@/lib/api";
import { getSession } from "@/lib/session";
import {
  PUBLISH_CHANGE_KEY, PUBLISH_CURRENT_META, PUBLISH_STATUS_META, PUBLISH_TYPE_COLOR, PUBLISH_TYPE_LABEL_KEY, publishItemKey,
} from "@/lib/publishMeta";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const PAGE_SIZE = 50;
const RESULT_STATUSES: PublishStatus[] = ["created", "updated", "deleted", "skipped", "conflict", "error"];

// Everything one publish run pushed to TerraOS — filterable, and each record
// opens its full sent data.
export default function PublishRunDetail({ run, onClose }: { run: PublishRun | null; onClose: () => void }) {
  const { t } = useLanguage();
  const [items, setItems] = useState<PublishItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<PublishItem | null>(null);

  // Reset filters whenever a different run is opened.
  useEffect(() => { setStatus("all"); setType("all"); setSearch(""); setPage(1); setItems(null); }, [run?.id]);

  useEffect(() => {
    const session = getSession();
    if (!run || !session) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setError("");
      try {
        const r = await apiPublishRunItems(session.token, run.id, {
          status, type, search: search.trim() || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE,
        });
        if (cancelled) return;
        setItems(r.items);
        setTotal(r.total);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Could not load");
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [run, status, type, search, page]);

  const totalRecords = run?.counts ? Object.values(run.counts).reduce((a, b) => a + (b || 0), 0) : 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <AppModal
        opened={!!run}
        onClose={onClose}
        size="xl"
        title={run ? t("adminPublish_runTitle", { id: run.id, when: new Date(run.started_at).toLocaleString() }) : ""}
      >
        {run && (
          <Stack gap="md">
            <Group gap={8} wrap="wrap">
              <Text size="sm" c="dimmed">{run.started_by} · {t("adminPublish_recordsCount", { n: totalRecords })}</Text>
              {run.counts && Object.entries(run.counts).map(([s, n]) => (
                <Badge key={s} variant="light" radius="sm" color={PUBLISH_STATUS_META[s as PublishStatus]?.color || "gray"}>
                  {t(PUBLISH_STATUS_META[s as PublishStatus]?.key || "adminPublish_statusError")}: {n}
                </Badge>
              ))}
            </Group>
            {run.error && <Text size="sm" c="red">{run.error}</Text>}

            <Group gap="sm" wrap="wrap" align="flex-end">
              <Select
                size="xs" w={150} allowDeselect={false} value={status}
                onChange={(v) => { setStatus(v || "all"); setPage(1); }}
                data={[{ value: "all", label: t("adminPublish_allStatuses") },
                  ...RESULT_STATUSES.map((s) => ({ value: s, label: t(PUBLISH_STATUS_META[s].key) }))]}
              />
              <Select
                size="xs" w={130} allowDeselect={false} value={type}
                onChange={(v) => { setType(v || "all"); setPage(1); }}
                data={[{ value: "all", label: t("adminPublish_allTypes") },
                  ...(["village", "farmer", "farm", "plot", "cultivation", "soil_sample", "soil_texture_test", "water_tds_test"] as const).map((x) => ({ value: x, label: t(PUBLISH_TYPE_LABEL_KEY[x]) }))]}
              />
              <TextInput
                size="xs" w={220} leftSection={<MagnifyingGlass size={14} />}
                placeholder={t("adminPublish_searchPlaceholder")}
                value={search} onChange={(e) => { setSearch(e.currentTarget.value); setPage(1); }}
              />
            </Group>
            <Text size="xs" c="dimmed">{t("adminPublish_clickHint")}</Text>

            {!items && !error && <Center p="lg"><Loader color="green" size="sm" /></Center>}
            {error && (
              <Center p="lg"><Group gap={6}><WarningCircle size={18} color="var(--mantine-color-red-6)" /><Text c="red" size="sm">{error}</Text></Group></Center>
            )}
            {items && items.length === 0 && !error && (
              <Center p="lg">
                <Text c="dimmed" size="sm">
                  {status === "all" && type === "all" && !search.trim() ? t("adminPublish_noItemsOldRun") : t("adminPublish_noItems")}
                </Text>
              </Center>
            )}
            {items && items.length > 0 && (
              <Table.ScrollContainer minWidth={760}>
                <Table verticalSpacing="xs" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t("adminPublish_colRecord")}</Table.Th>
                      <Table.Th>{t("adminPublish_colChange")}</Table.Th>
                      <Table.Th>{t("adminPublish_colResult")}</Table.Th>
                      <Table.Th>{t("adminPublish_colNow")}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {items.map((i) => (
                      <Table.Tr key={publishItemKey(i)} style={{ cursor: "pointer" }} onClick={() => setOpen(i)}>
                        <Table.Td>
                          <Group gap={6} wrap="nowrap">
                            <Badge color={PUBLISH_TYPE_COLOR[i.type]} variant="light" radius="sm" style={{ flexShrink: 0 }}>
                              {t(PUBLISH_TYPE_LABEL_KEY[i.type])}
                            </Badge>
                            <Text size="sm" fw={500}>{i.label}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td><Text size="sm" c="dimmed">{i.change ? t(PUBLISH_CHANGE_KEY[i.change]) : "—"}</Text></Table.Td>
                        <Table.Td>
                          <Stack gap={2}>
                            <Badge color={PUBLISH_STATUS_META[i.status]?.color || "gray"} variant="light" radius="sm">
                              {t(PUBLISH_STATUS_META[i.status]?.key || "adminPublish_statusError")}
                            </Badge>
                            {i.error && <Text size="xs" c="red" lineClamp={2}>{i.error}</Text>}
                            {i.warnings?.length > 0 && <Text size="xs" c="orange">{t("adminPublish_warnings")} ({i.warnings.length})</Text>}
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          {i.current ? (
                            <Badge variant="dot" radius="sm" color={PUBLISH_CURRENT_META[i.current.now].color} style={{ textTransform: "none" }}>
                              {t(PUBLISH_CURRENT_META[i.current.now].key)}
                            </Badge>
                          ) : <Text size="sm" c="dimmed">—</Text>}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
            {pages > 1 && (
              <Group justify="center"><Pagination value={page} onChange={setPage} total={pages} color="green" size="sm" /></Group>
            )}
          </Stack>
        )}
      </AppModal>
      <PublishRecordDetail item={open} onClose={() => setOpen(null)} />
    </>
  );
}
