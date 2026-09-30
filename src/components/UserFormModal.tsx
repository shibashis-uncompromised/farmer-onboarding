"use client";

import { useEffect, useState } from "react";
import { Button, Group, PasswordInput, Select, Stack, Text, TextInput } from "@mantine/core";
import { FloppyDisk, UserPlus } from "@phosphor-icons/react";
import { notifications } from "@mantine/notifications";
import AppModal from "./AppModal";
import { apiCreateUser, apiUpdateUser, type AdminUser, type Role } from "@/lib/api";
import { getSession } from "@/lib/session";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "reviewer", label: "Reviewer" },
  { value: "poc", label: "POC" },
];

export default function UserFormModal({
  opened, onClose, onSaved, editingUser,
}: {
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingUser: AdminUser | null;
}) {
  const isEdit = !!editingUser;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened) {
      setUsername(editingUser?.username || "");
      setPassword("");
      setRole(editingUser?.role || "poc");
    }
  }, [opened, editingUser]);

  const canSave = !!(username.trim() && role && (isEdit || password.trim()));

  const save = async () => {
    const session = getSession();
    if (!session) return;
    if (!canSave) {
      notifications.show({ color: "red", message: "Username and role are required" });
      return;
    }
    setSaving(true);
    try {
      if (isEdit && editingUser) {
        await apiUpdateUser(session.token, editingUser.id, {
          username: username.trim(),
          role: role as Role,
          ...(password.trim() ? { password: password.trim() } : {}),
        });
        notifications.show({ color: "green", message: `User "${username.trim()}" updated` });
      } else {
        await apiCreateUser(session.token, {
          username: username.trim(),
          password: password.trim(),
          role: role as Role,
        });
        notifications.show({ color: "green", message: `User "${username.trim()}" created` });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not save user" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal opened={opened} onClose={onClose} title={isEdit ? "Edit user" : "Add user"}>
      <Stack gap="md">
        {!isEdit && (
          <Text size="sm" c="dimmed">Create a login for a team member and assign their role.</Text>
        )}
        <TextInput
          label="Username" placeholder="e.g. rakesh" value={username} required data-autofocus
          autoCapitalize="none" autoComplete="off"
          onChange={(e) => setUsername(e.currentTarget.value)}
        />
        <PasswordInput
          label={isEdit ? "New password" : "Password"}
          placeholder={isEdit ? "Leave blank to keep current password" : "password"}
          value={password} required={!isEdit} autoComplete="new-password"
          onChange={(e) => setPassword(e.currentTarget.value)}
        />
        <Select
          label="Role" placeholder="Select role" required
          data={ROLE_OPTIONS}
          value={role || null}
          onChange={(v) => setRole((v as Role) || "")}
          comboboxProps={{ withinPortal: true }} checkIconPosition="right"
        />
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button
            onClick={save} loading={saving} disabled={!canSave}
            leftSection={isEdit ? <FloppyDisk size={18} /> : <UserPlus size={18} />}
          >
            {isEdit ? "Save changes" : "Add user"}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  );
}
