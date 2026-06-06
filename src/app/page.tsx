"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Center, Loader } from "@mantine/core";
import { currentUser } from "@/lib/auth";

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    router.replace(currentUser() ? "/home" : "/login");
  }, [router]);
  return (
    <Center h="100dvh">
      <Loader color="green" />
    </Center>
  );
}
