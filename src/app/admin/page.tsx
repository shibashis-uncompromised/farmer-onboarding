"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// /admin/ has nothing of its own yet — land on Users, the only section so far.
export default function AdminIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/users/");
  }, [router]);
  return null;
}
