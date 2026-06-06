"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button, Center, PasswordInput, Paper, Stack, Text, TextInput, ThemeIcon, Title,
} from "@mantine/core";
import { Plant, SignIn } from "@phosphor-icons/react";
import { login } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const u = login(username, password);
    if (u) {
      router.replace("/home");
    } else {
      setErr("Invalid username or password");
      setLoading(false);
    }
  };

  return (
    <Center mih="100dvh" p="lg" style={{ background: "linear-gradient(160deg,#06854f,#013a24)" }}>
      <Paper radius="lg" p="xl" shadow="xl" maw={400} w="100%">
        <Stack gap="lg">
          <Stack align="center" gap={6}>
            <ThemeIcon size={64} radius="xl" variant="light" color="green">
              <Plant size={36} weight="duotone" />
            </ThemeIcon>
            <Title order={2} ta="center">Farmer Onboarding</Title>
            <Text c="dimmed" size="sm" ta="center">Sign in to start field onboarding</Text>
          </Stack>

          <form onSubmit={submit}>
            <Stack gap="md">
              <TextInput
                label="Username" placeholder="username" size="md"
                value={username} onChange={(e) => setUsername(e.currentTarget.value)}
                autoCapitalize="none" autoComplete="username" required
              />
              <PasswordInput
                label="Password" placeholder="password" size="md"
                value={password} onChange={(e) => setPassword(e.currentTarget.value)}
                autoComplete="current-password" required
              />
              {err && <Text c="red" size="sm">{err}</Text>}
              <Button type="submit" size="md" fullWidth loading={loading} leftSection={<SignIn size={18} />}>
                Sign in
              </Button>
            </Stack>
          </form>

          <Text c="dimmed" size="xs" ta="center">Works offline · data stays on this device</Text>
        </Stack>
      </Paper>
    </Center>
  );
}
