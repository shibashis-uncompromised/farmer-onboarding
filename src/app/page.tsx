"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Center, Loader } from "@mantine/core";
import { currentUser } from "@/lib/auth";

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    const user = currentUser();
    // Admins land on the same onboarding Home as everyone else — Home has an
    // "Admin view" option in its menu for whoever wants the admin panel.
    if (!user) router.replace("/login/");
    else router.replace("/home/");
  }, [router]);
  return (
    <Center h="100dvh">
      <Loader color="green" />
    </Center>
  );
}
