"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon, Alert, Badge, Button, Center, Group, Loader, Paper, SegmentedControl, Select, Stack, Table,
  Text, TextInput, Title, Tooltip,
} from "@mantine/core";
import { LockSimple, MagnifyingGlass, MapPin, PencilSimple, WarningCircle } from "@phosphor-icons/react";
import { notifications } from "@mantine/notifications";
import AppModal from "@/components/AppModal";
import { apiAdminListVillages, apiAdminUpdateVillage, type AdminVillage } from "@/lib/api";
import { getSession } from "@/lib/session";
import { NEOPERK_STATES, DISTRICTS_BY_STATE, stateOpts, districtLabel, stateLabel } from "@/lib/villages";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function AdminVillagesPage() {
  const { t, language } = useLanguage();
  const [villages, setVillages] = useState<AdminVillage[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("all");
  const [editing, setEditing] = useState<AdminVillage | null>(null);

  const load = async () => {
    const session = getSession();
    if (!session) return;
    setError("");
    try {
      const { villages } = await apiAdminListVillages(session.token);
      setVillages(villages);
    } catch (e: any) {
      setError(e?.message || t("adminVillages_couldNotLoad"));
    }
  };

  useEffect(() => { load(); }, []);

  const regions = useMemo(() => Array.from(new Set((villages || []).map((v) => v.region))).sort(), [villages]);

  const filtered = useMemo(() => {
    if (!villages) return [];
    const q = query.trim().toLowerCase();
    return villages.filter((v) =>
      (region === "all" || v.region === region) &&
      (!q || [v.name, v.code, v.idCode, v.block, v.district, v.state].some((x) => (x || "").toLowerCase().includes(q)))
    );
  }, [villages, query, region]);

  return (
    <Stack gap="md">
      <div>
        <Title order={3}>{t("adminVillages_title")}</Title>
        <Text size="sm" c="dimmed">{t("adminVillages_subtitle")}</Text>
      </div>

      <Group gap="sm" wrap="wrap">
        <TextInput
          style={{ flex: 1, minWidth: 220 }}
          leftSection={<MagnifyingGlass size={16} />}
          placeholder={t("adminVillages_search")}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
        {regions.length > 1 && (
          <SegmentedControl
            value={region}
            onChange={setRegion}
            data={[{ value: "all", label: t("adminVillages_all") }, ...regions.map((r) => ({ value: r, label: r }))]}
          />
        )}
      </Group>

      {error && <Alert color="red" icon={<WarningCircle size={18} />}>{error}</Alert>}

      {!villages && !error ? (
        <Center py="xl"><Loader /></Center>
      ) : villages && (
        <Paper withBorder radius="md" style={{ overflowX: "auto" }}>
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("adminVillages_colVillage")}</Table.Th>
                <Table.Th>{t("adminVillages_colIdCode")}</Table.Th>
                <Table.Th>{t("adminVillages_colBlock")}</Table.Th>
                <Table.Th>{t("adminVillages_colDistrict")}</Table.Th>
                <Table.Th>{t("adminVillages_colState")}</Table.Th>
                <Table.Th ta="right">{t("adminVillages_colFarmers")}</Table.Th>
                <Table.Th>{t("adminVillages_colSource")}</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length === 0 ? (
                <Table.Tr><Table.Td colSpan={8}><Text ta="center" c="dimmed" py="md">{t("adminVillages_empty")}</Text></Table.Td></Table.Tr>
              ) : filtered.map((v) => (
                <Table.Tr key={v.code}>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <MapPin size={16} />
                      <div>
                        <Text fw={500} size="sm">{v.name}</Text>
                        <Text size="xs" c="dimmed">{v.code}</Text>
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td><Text size="sm" ff="monospace">{v.region}-{v.idCode}</Text></Table.Td>
                  <Table.Td><Text size="sm">{v.block || "—"}</Text></Table.Td>
                  <Table.Td><Text size="sm">{v.district ? districtLabel(v.district, language) : "—"}</Text></Table.Td>
                  <Table.Td><Text size="sm">{v.state ? stateLabel(v.state, language) : "—"}</Text></Table.Td>
                  <Table.Td ta="right"><Text size="sm">{v.farmers}</Text></Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      {v.preset
                        ? <Badge variant="light" color="gray">{t("adminVillages_preset")}</Badge>
                        : <Badge variant="light" color="blue">{t("adminVillages_createdBy", { user: v.createdBy || "—" })}</Badge>}
                      {v.edited && <Badge variant="light" color="orange">{t("adminVillages_edited")}</Badge>}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label={t("common_edit")}>
                      <ActionIcon variant="subtle" onClick={() => setEditing(v)} aria-label={t("common_edit")}>
                        <PencilSimple size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <EditVillageModal village={editing} onClose={() => setEditing(null)} onSaved={load} />
    </Stack>
  );
}

function EditVillageModal({ village, onClose, onSaved }: { village: AdminVillage | null; onClose: () => void; onSaved: () => void }) {
  const { t, language } = useLanguage();
  const [name, setName] = useState("");
  const [block, setBlock] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!village) return;
    setName(village.name || "");
    setBlock(village.block || "");
    setState(village.state || "");
    setDistrict(village.district || "");
  }, [village]);

  // Keep a district that isn't in the list (e.g. typed before the list existed) selectable.
  const districts = useMemo(() => {
    const list = DISTRICTS_BY_STATE[state] || [];
    const all = district && !list.includes(district) ? [district, ...list] : list;
    return all.map((value) => ({ value, label: districtLabel(value, language) }));
  }, [state, district, language]);

  const states = useMemo(() => {
    const opts = stateOpts(language);
    return state && !(NEOPERK_STATES as readonly string[]).includes(state) ? [{ value: state, label: state }, ...opts] : opts;
  }, [state, language]);

  const save = async () => {
    if (!village) return;
    const session = getSession();
    if (!session) return;
    if (!name.trim()) {
      notifications.show({ color: "red", message: t("adminVillages_nameRequired") });
      return;
    }
    const changes: Record<string, string> = {};
    if (name.trim() !== (village.name || "")) changes.name = name.trim();
    if (block.trim() !== (village.block || "")) changes.block = block.trim();
    if (state !== (village.state || "")) changes.state = state;
    if (district !== (village.district || "")) changes.district = district;
    if (!Object.keys(changes).length) {
      notifications.show({ message: t("adminVillages_noChanges") });
      onClose();
      return;
    }
    setSaving(true);
    try {
      await apiAdminUpdateVillage(session.token, village.code, changes);
      notifications.show({ color: "green", message: t("adminVillages_savedToast", { code: village.code }) });
      onSaved();
      onClose();
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || t("editFarm_saveError") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal opened={!!village} onClose={onClose} title={village ? t("adminVillages_editTitle", { code: village.code }) : ""}>
      {village && (
        <Stack gap="sm">
          <Alert variant="light" color="gray" icon={<LockSimple size={18} />}>
            {t("adminVillages_lockedNote", { region: village.region, idCode: village.idCode })}
          </Alert>
          <TextInput label={t("adminVillages_name")} required value={name} onChange={(e) => setName(e.currentTarget.value)} />
          <TextInput label={t("adminVillages_colBlock")} value={block} onChange={(e) => setBlock(e.currentTarget.value)} />
          <Select
            label={t("adminVillages_colState")}
            data={states}
            value={state || null}
            onChange={(v) => { setState(v || ""); if (v !== state) setDistrict(""); }}
          />
          <Select
            label={t("adminVillages_colDistrict")}
            data={districts}
            value={district || null}
            searchable
            onChange={(v) => setDistrict(v || "")}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose}>{t("common_cancel")}</Button>
            <Button onClick={save} loading={saving}>{t("common_save")}</Button>
          </Group>
        </Stack>
      )}
    </AppModal>
  );
}
