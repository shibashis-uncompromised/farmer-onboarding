"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// /admin/ has no page of its own — land on Publish to TerraOS, the main admin task.
export default function AdminIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/publish/");
  }, [router]);
  return null;
}
