"use client";

import { SegmentedControl } from "@mantine/core";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// Small always-visible EN / हिं switcher. Deliberately not localized itself —
// someone who reads only Hindi still needs to recognize the English option,
// and vice versa, so both labels show in their own script regardless of the
// active language.
export default function LanguageToggle({ size = "xs" }: { size?: "xs" | "sm" }) {
  const { language, setLanguage } = useLanguage();
  return (
    <SegmentedControl
      size={size}
      value={language}
      onChange={(v) => setLanguage(v as "en" | "hi")}
      data={[
        { label: "EN", value: "en" },
        { label: "हिं", value: "hi" },
      ]}
    />
  );
}
