"use client";

import { useState } from "react";
import { MultiSelect, type MultiSelectProps } from "@mantine/core";

// Mantine's MultiSelect intentionally leaves its dropdown open after picking
// an option (you might want to pick several in a row) — but for the short
// "select all that apply" checklists used across the onboarding form and
// admin edit modals, that reads as unresponsive: picking one option should
// collapse the dropdown like a plain Select does, and reopening for another
// pick is still just one tap on the field. Controls `dropdownOpened`
// ourselves and closes it on every option submit; all other MultiSelect
// props pass straight through unchanged.
export default function AutoCloseMultiSelect(props: MultiSelectProps) {
  const [opened, setOpened] = useState(false);
  const { onDropdownOpen, onDropdownClose, onOptionSubmit, ...rest } = props;

  return (
    <MultiSelect
      {...rest}
      dropdownOpened={opened}
      onDropdownOpen={() => {
        setOpened(true);
        onDropdownOpen?.();
      }}
      onDropdownClose={() => {
        setOpened(false);
        onDropdownClose?.();
      }}
      onOptionSubmit={(value) => {
        setOpened(false);
        onOptionSubmit?.(value);
      }}
    />
  );
}
