"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  AppShell, Avatar, Burger, Center, Group, Image, Loader, Menu, NavLink,
  Text, UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { CaretDown, CheckCircle, ClockCounterClockwise, Plant, SignOut, UsersThree } from "@phosphor-icons/react";
import { currentUser, logout, type AuthUser } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";

// Sidebar nav items. More sections (villages, farmers, reports…) land here later —
// this is the one place that needs to grow to add a new admin section.
const NAV_ITEMS: { labelKey: TranslationKey; href: string; icon: typeof UsersThree }[] = [
  { labelKey: "adminLayout_navUsers", href: "/admin/users/", icon: UsersThree },
  { labelKey: "adminLayout_navApprovals", href: "/admin/approvals/", icon: CheckCircle },
  { labelKey: "adminLayout_navRecords", href: "/admin/records/", icon: Plant },
  { labelKey: "adminLayout_navVersions", href: "/admin/versions/", icon: ClockCounterClockwise },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const [opened, { toggle }] = useDisclosure();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);

  // Only admins get past this gate. Anyone else signed in is bounced to their
  // own area; anyone not signed in goes to login.
  useEffect(() => {
    const u = currentUser();
    if (!u) { router.replace("/login/"); return; }
    if (u.role !== "admin") { router.replace("/home/"); return; }
    setUser(u);
    setChecked(true);
  }, [router]);

  if (!checked || !user) {
    return (
      <Center h="100dvh">
        <Loader color="green" />
      </Center>
    );
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 260, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Image src="/icons/logo.png" alt="Uncompromised" w={30} h={30} radius="sm" />
            <div>
              <Text fw={700} size="xs" c="green.7" style={{ letterSpacing: 1.2, lineHeight: 1 }}>
                UNCOMPROMISED
              </Text>
              <Text fw={600} size="sm" style={{ lineHeight: 1.2 }}>{t("adminLayout_title")}</Text>
            </div>
          </Group>

          <Group gap="sm" wrap="nowrap">
            <LanguageToggle size="xs" />
            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <UnstyledButton>
                  <Group gap={8} wrap="nowrap">
                    <Avatar color="green" radius="xl" size={32}>
                      {user.username.slice(0, 2).toUpperCase()}
                    </Avatar>
                    <Text size="sm" fw={500} visibleFrom="xs">{user.username}</Text>
                    <CaretDown size={14} />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  color="red"
                  leftSection={<SignOut size={16} />}
                  onClick={() => { logout(); router.replace("/login/"); }}
                >
                  {t("common_signOut")}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            label={t(item.labelKey)}
            leftSection={<item.icon size={18} />}
            active={pathname?.startsWith(item.href)}
            onClick={() => { router.push(item.href); toggle(); }}
            color="green"
            style={{ borderRadius: "var(--mantine-radius-md)" }}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
