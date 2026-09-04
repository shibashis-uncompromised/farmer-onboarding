"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon, Badge, Button, Center, Group, Loader, Paper, Stack, Table,
  Text, TextInput, Title, Tooltip,
} from "@mantine/core";
import { MagnifyingGlass, PencilSimple, Plus, Trash, UsersThree, WarningCircle } from "@phosphor-icons/react";
import { notifications } from "@mantine/notifications";
import AppModal from "@/components/AppModal";
import UserFormModal from "@/components/UserFormModal";
import { apiListUsers, apiDeleteUser, type AdminUser, type Role } from "@/lib/api";
import { getSession } from "@/lib/session";

const ROLE_COLOR: Record<Role, string> = { admin: "green", reviewer: "blue", poc: "gray" };
const ROLE_LABEL: Record<Role, string> = { admin: "Admin", reviewer: "Reviewer", poc: "POC" };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const session = getSession();
    if (!session) return;
    setError("");
    try {
      const { users } = await apiListUsers(session.token);
      setUsers(users);
    } catch (e: any) {
      setError(e?.message || "Could not load users");
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.username.toLowerCase().includes(q) || u.role.includes(q));
  }, [users, query]);

  const openCreate = () => { setEditingUser(null); setFormOpen(true); };
  const openEdit = (u: AdminUser) => { setEditingUser(u); setFormOpen(true); };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const session = getSession();
    if (!session) return;
    setDeleting(true);
    try {
      await apiDeleteUser(session.token, deleteTarget.id);
      notifications.show({ color: "green", message: `User "${deleteTarget.username}" deleted` });
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not delete user" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" wrap="wrap">
        <div>
          <Title order={3}>Users</Title>
          <Text c="dimmed" size="sm">Manage logins and assign roles — admin, reviewer, or POC.</Text>
        </div>
        <Button leftSection={<Plus size={18} />} onClick={openCreate}>Add user</Button>
      </Group>

      <TextInput
        placeholder="Search by username or role"
        leftSection={<MagnifyingGlass size={16} />}
        value={query} onChange={(e) => setQuery(e.currentTarget.value)}
        maw={360}
      />

      <Paper withBorder radius="lg" p={0}>
        {!users && !error && (
          <Center p="xl"><Loader color="green" /></Center>
        )}
        {error && (
          <Center p="xl">
            <Stack align="center" gap={6}>
              <WarningCircle size={28} color="var(--mantine-color-red-6)" />
              <Text c="red" size="sm">{error}</Text>
              <Button variant="light" size="xs" onClick={load}>Retry</Button>
            </Stack>
          </Center>
        )}
        {users && !error && filtered.length === 0 && (
          <Center p="xl">
            <Stack align="center" gap={6}>
              <UsersThree size={28} color="var(--mantine-color-gray-5)" />
              <Text c="dimmed" size="sm">{users.length === 0 ? "No users yet" : "No users match your search"}</Text>
            </Stack>
          </Center>
        )}
        {users && !error && filtered.length > 0 && (
          <Table.ScrollContainer minWidth={480}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Username</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th w={90} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((u) => (
                  <Table.Tr key={u.id}>
                    <Table.Td fw={500}>{u.username}</Table.Td>
                    <Table.Td>
                      <Badge color={ROLE_COLOR[u.role]} variant="light">{ROLE_LABEL[u.role]}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text c="dimmed" size="sm">
                        {new Date(u.created_at).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <Tooltip label="Edit">
                          <ActionIcon variant="subtle" color="gray" onClick={() => openEdit(u)}>
                            <PencilSimple size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon variant="subtle" color="red" onClick={() => setDeleteTarget(u)}>
                            <Trash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <UserFormModal
        opened={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        editingUser={editingUser}
      />

      <AppModal opened={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete user" size="sm">
        <Stack gap="md">
          <Text size="sm">
            Delete <b>{deleteTarget?.username}</b>? They&apos;ll no longer be able to sign in. This can&apos;t be undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button color="red" onClick={confirmDelete} loading={deleting} leftSection={<Trash size={18} />}>
              Delete
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  );
}
