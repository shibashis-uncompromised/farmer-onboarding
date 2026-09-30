"use client";

import { Accordion, Alert, Badge, Code, Divider, Group, Stack, Table, Text } from "@mantine/core";
import { Trash, WarningCircle } from "@phosphor-icons/react";
import AppModal from "@/components/AppModal";
import type { PublishItem } from "@/lib/api";
import {
  PUBLISH_CHANGE_KEY, PUBLISH_CONFLICT_KEY, PUBLISH_CURRENT_META, PUBLISH_STATUS_META, PUBLISH_TYPE_COLOR, PUBLISH_TYPE_LABEL_KEY,
  publishDataRows,
} from "@/lib/publishMeta";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// One record's full publish detail: result, and every field that was (or,
// in a preview, will be) sent to TerraOS — plus the raw onboarding record.
export default function PublishRecordDetail({
  item, preview, onClose,
}: { item: PublishItem | null; preview?: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const sent = item?.sent;
  const rows = publishDataRows(sent?.data ?? item?.onboarding);
  const res = sent?.resolution;

  return (
    <AppModal opened={!!item} onClose={onClose} size="lg" title={item ? item.label : ""}>
      {item && (
        <Stack gap="md">
          <Group gap={8} wrap="wrap">
            <Badge color={PUBLISH_TYPE_COLOR[item.type]} variant="light" radius="sm">{t(PUBLISH_TYPE_LABEL_KEY[item.type])}</Badge>
            <Text size="sm" fw={500}>{item.sourceId}</Text>
            {item.change && <Badge variant="outline" color="gray" radius="sm">{t(PUBLISH_CHANGE_KEY[item.change])}</Badge>}
            <Badge color={PUBLISH_STATUS_META[item.status]?.color || "gray"} variant="light" radius="sm">
              {t(PUBLISH_STATUS_META[item.status]?.key || "adminPublish_statusError")}
            </Badge>
          </Group>

          {item.current && (
            <Alert variant="light" color={PUBLISH_CURRENT_META[item.current.now].color} title={t("adminPublish_currentStatus")}>
              <Stack gap={2}>
                <Text size="sm" fw={600}>{t(PUBLISH_CURRENT_META[item.current.now].key)}</Text>
                {item.current.revert && (
                  <Text size="xs">
                    {t(item.current.revert.action === "discard" ? "adminPublish_nowRevertDiscard" : "adminPublish_nowRevertRestore", {
                      by: item.current.revert.by, at: new Date(item.current.revert.at).toLocaleString(),
                    })}
                  </Text>
                )}
                {item.current.publishedAt && (
                  <Text size="xs">{t("adminPublish_nowPublishedAt", { at: new Date(item.current.publishedAt).toLocaleString() })}</Text>
                )}
              </Stack>
            </Alert>
          )}
          {item.targetId && (
            <Text size="sm">{t("adminPublish_terraosId")}: <Code>{item.targetId}</Code></Text>
          )}
          {res && (
            <Text size="sm">{t("adminPublish_decisionUsed")}: <Code>{typeof res === "object" ? `link → ${res.linkTo}` : res}</Code></Text>
          )}
          {item.error && <Alert color="red" icon={<WarningCircle size={18} />}>{item.error}</Alert>}
          {item.conflict && (
            <Alert color="yellow" icon={<WarningCircle size={18} />}>
              {t(PUBLISH_CONFLICT_KEY[item.conflict.kind])}
              {item.conflict.candidates?.length ? ` — ${item.conflict.candidates.map((c) => c.label).join(", ")}` : ""}
            </Alert>
          )}
          {item.warnings?.length > 0 && (
            <Alert color="orange" title={t("adminPublish_warnings")}>
              {item.warnings.map((w) => <Text key={w} size="sm">{w}</Text>)}
            </Alert>
          )}
          {sent?.deleted && (
            <Alert color="gray" icon={<Trash size={18} />}>{t("adminPublish_deletedNote")}</Alert>
          )}

          <Divider label={preview ? t("adminPublish_dataToSend") : t("adminPublish_dataSent")} labelPosition="left" />
          <Table verticalSpacing={6} withRowBorders={false}>
            <Table.Tbody>
              {rows.map((r, i) => (
                <Table.Tr key={`${r.key}-${i}`}>
                  <Table.Td w="38%" style={{ verticalAlign: "top" }}><Text size="sm" c="dimmed">{r.key}</Text></Table.Td>
                  <Table.Td><Text size="sm" fw={500} style={{ wordBreak: "break-word" }}>{r.value}</Text></Table.Td>
                </Table.Tr>
              ))}
              {sent?.photos && sent.photos.length > 0 && (
                <Table.Tr>
                  <Table.Td style={{ verticalAlign: "top" }}><Text size="sm" c="dimmed">{t("adminPublish_photos")}</Text></Table.Td>
                  <Table.Td><Text size="sm" fw={500}>{sent.photos.map((p) => p.mediaId).join(", ")}</Text></Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>

          {sent?.source && (
            <Accordion variant="contained" radius="md">
              <Accordion.Item value="raw">
                <Accordion.Control><Text size="sm">{t("adminPublish_fullRecord")}</Text></Accordion.Control>
                <Accordion.Panel>
                  <Code block style={{ maxHeight: 360, overflow: "auto", fontSize: 12 }}>
                    {JSON.stringify(sent.source, null, 2)}
                  </Code>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          )}
        </Stack>
      )}
    </AppModal>
  );
}
