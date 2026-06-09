import type { KeyboardEvent } from "react";

// Pressing Enter on a text field dismisses the mobile keyboard instead of
// doing nothing / submitting. Saving stays on the explicit buttons.
export const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === "Enter") {
    e.preventDefault();
    e.currentTarget.blur();
  }
};
