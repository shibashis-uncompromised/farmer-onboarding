"use client";

import { Component, type ReactNode } from "react";
import { Paper, Stack, Text, ThemeIcon } from "@mantine/core";
import { WarningCircle } from "@phosphor-icons/react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface Props {
  children: ReactNode;
  onError?: () => void;   // e.g. auto-switch back to the GPS "Walk points" mode
  fallback?: ReactNode;
}
interface State { hasError: boolean; }

// Default fallback UI. A separate function component so it can use the
// useLanguage() hook — the enclosing MapErrorBoundary is a class component
// and hooks can't be called directly inside its render().
function DefaultMapErrorFallback() {
  const { t } = useLanguage();
  return (
    <Paper withBorder radius="md" p="md">
      <Stack align="center" gap={6}>
        <ThemeIcon variant="light" color="yellow" radius="xl"><WarningCircle size={20} /></ThemeIcon>
        <Text size="sm" ta="center">{t("mapError_unavailable")}</Text>
        <Text size="xs" c="dimmed" ta="center">{t("mapError_hint")}</Text>
      </Stack>
    </Paper>
  );
}

// Catches any runtime error from the Leaflet maps (init failure, tile/draw
// quirks, odd devices) so a map problem can NEVER blank the page. On error it
// shows a small notice and calls onError() so the caller can fall back to the
// offline GPS flow.
export default class MapErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("Map failed, falling back:", error);
    this.props.onError?.();
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <DefaultMapErrorFallback />;
    }
    return this.props.children;
  }
}
