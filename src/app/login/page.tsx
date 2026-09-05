"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button, Center, Group, Image, PasswordInput, Paper, Stack, Text, TextInput, Title,
} from "@mantine/core";
import { SignIn } from "@phosphor-icons/react";
import { login } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(username, password);
      // Go straight to Home — do NOT wait on a sync here, or slow internet
      // would block the login transition. SessionGate runs the first sync in
      // the background once home mounts. Admins land here too, same as
      // everyone else; Home's menu has an "Admin view" option for them.
      router.replace("/home/");
    } catch (err: any) {
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      setErr(offline ? t("login_offlineError") : (err?.message || t("login_genericError")));
      setLoading(false);
    }
  };

  return (
    <Center mih="100dvh" p="lg" style={{ background: "linear-gradient(160deg,#06854f,#013a24)" }}>
      <Paper radius="lg" p="xl" shadow="xl" maw={400} w="100%" pos="relative">
        <Group justify="flex-end" pos="absolute" top={16} right={16}>
          <LanguageToggle />
        </Group>
        <Stack gap="lg">
          <Stack align="center" gap={6}>
            <Image src="/icons/logo.png" alt="Uncompromised" w={68} h={68} radius="lg" />
            <Text fw={700} size="xs" c="green.7" style={{ letterSpacing: 1.4 }}>{t("common_brand")}</Text>
            <Title order={2} ta="center">{t("common_appName")}</Title>
            <Text c="dimmed" size="sm" ta="center">{t("login_tagline")}</Text>
          </Stack>

          <form onSubmit={submit}>
            <Stack gap="md">
              <TextInput
                label={t("login_usernameLabel")} placeholder={t("login_usernamePlaceholder")} size="md"
                value={username} onChange={(e) => setUsername(e.currentTarget.value)}
                autoCapitalize="none" autoComplete="username" required
              />
              <PasswordInput
                label={t("login_passwordLabel")} placeholder={t("login_passwordPlaceholder")} size="md"
                value={password} onChange={(e) => setPassword(e.currentTarget.value)}
                autoComplete="current-password" required
              />
              {err && <Text c="red" size="sm">{err}</Text>}
              <Button type="submit" size="md" fullWidth loading={loading} leftSection={<SignIn size={18} />}>
                {t("login_submit")}
              </Button>
            </Stack>
          </form>

          <Text c="dimmed" size="xs" ta="center">{t("login_footer")}</Text>
        </Stack>
      </Paper>
    </Center>
  );
}
