"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Center, Loader } from "@mantine/core";
import { currentUser } from "@/lib/auth";

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    const user = currentUser();
    if (!user) router.replace("/login/");
    else if (user.role === "admin") router.replace("/admin/users/");
    else router.replace("/home/");
  }, [router]);
  return (
    <Center h="100dvh">
      <Loader color="green" />
    </Center>
  );
}
