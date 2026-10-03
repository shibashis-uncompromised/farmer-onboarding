"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Button, Center, Checkbox, Group, Loader, Stack, Table, Text } from "@mantine/core";
import { WarningCircle } from "@phosphor-icons/react";
import { notifications } from "@mantine/notifications";
import AppModal from "@/components/AppModal";
import { apiPublishSkipped, apiPublishUnskip, type SkippedRecord } from "@/lib/api";
import { getSession } from "@/lib/session";
import { PUBLISH_TYPE_COLOR, PUBLISH_TYPE_LABEL_KEY, publishItemKey } from "@/lib/publishMeta";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface Props {
  opened: boolean;
  onClose: () => void;
  onUnskipped: () => void;
}

// Records the admin skipped on the Publish page. A skip is treated as done
// for that version, so a skipped village (and everything under it) would
// otherwise never reach TerraOS — this is the way back.
export default function PublishSkippedModal({ opened, onClose, onUnskipped }: Props) {
  const { t } = useLanguage();
  const [rows, setRows] = useState<SkippedRecord[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!opened) return;
    const session = getSession();
    if (!session) return;
    setRows(null);
    setError("");
    setSelected(new Set());
    apiPublishSkipped(session.token)
      .then(({ skipped }) => setRows(skipped))
      .catch((e) => setError(e?.message || t("adminPublish_unskipError")));
  }, [opened]);

  const selectable = (rows || []).filter((r) => r.current);
  const toggle = (key: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const unskip = async () => {
    const session = getSession();
    if (!session || !selected.size) return;
    setBusy(true);
    try {
      const { unskipped } = await apiPublishUnskip(session.token, [...selected]);
      notifications.show({ color: "green", message: t("adminPublish_unskippedCount", { n: unskipped }) });
      onClose();
      onUnskipped();
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || t("adminPublish_unskipError") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppModal opened={opened} onClose={onClose} title={t("adminPublish_skippedTitle")} size="xl">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">{t("adminPublish_skippedIntro")}</Text>
        {error && <Alert color="red" icon={<WarningCircle size={18} />}>{error}</Alert>}
        {!rows && !error ? (
          <Center py="lg"><Loader /></Center>
        ) : rows && rows.length === 0 ? (
          <Text ta="center" c="dimmed" py="md">{t("adminPublish_skippedEmpty")}</Text>
        ) : rows && (
          <Table.ScrollContainer minWidth={560}>
            <Table verticalSpacing="xs" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={36}>
                    <Checkbox
                      aria-label="select all"
                      checked={selectable.length > 0 && selected.size === selectable.length}
                      indeterminate={selected.size > 0 && selected.size < selectable.length}
                      onChange={(e) => setSelected(e.currentTarget.checked ? new Set(selectable.map(publishItemKey)) : new Set())}
                    />
                  </Table.Th>
                  <Table.Th />
                  <Table.Th />
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((r) => {
                  const key = publishItemKey(r);
                  return (
                    <Table.Tr key={key} onClick={() => r.current && toggle(key)} style={{ cursor: r.current ? "pointer" : "default" }}>
                      <Table.Td onClick={(e) => e.stopPropagation()}>
                        <Checkbox aria-label={r.label} disabled={!r.current} checked={selected.has(key)} onChange={() => toggle(key)} />
                      </Table.Td>
                      <Table.Td>
                        <Group gap={6} wrap="nowrap">
                          <Badge size="sm" variant="light" color={PUBLISH_TYPE_COLOR[r.type]}>{t(PUBLISH_TYPE_LABEL_KEY[r.type])}</Badge>
                          <Text size="sm">{r.label}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={0}>
                          <Text size="xs" c={r.inTerraos ? "green" : "dimmed"}>
                            {t(r.inTerraos ? "adminPublish_skippedInTerraos" : "adminPublish_skippedNotInTerraos")}
                          </Text>
                          {r.children > 0 && <Text size="xs" c="orange">{t("adminPublish_skippedChildren", { n: r.children })}</Text>}
                          {!r.current && <Text size="xs" c="dimmed">{t("adminPublish_skippedChanged")}</Text>}
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">{t("adminPublish_skippedAt", { at: new Date(r.skippedAt).toLocaleString() })}</Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>{t("common_cancel")}</Button>
          <Button onClick={unskip} loading={busy} disabled={!selected.size}>
            {t("adminPublish_unskipSelected", { n: selected.size })}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  );
}
