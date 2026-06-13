"use client";

import { useEffect, useRef, useState } from "react";
import { ActionIcon, Box, Button, Group, Image, Stack, Text } from "@mantine/core";
import { Camera, ArrowsClockwise, Trash } from "@phosphor-icons/react";
import { compressImage } from "@/lib/image";

interface Props {
  value?: Blob | null;
  onChange: (blob: Blob | null) => void;
  height?: number;
  label?: string;
  compact?: boolean;   // small square thumbnail tile instead of a tall banner
}

export default function PhotoInput({ value, onChange, height = 200, label = "Photo", compact = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!value) { setUrl(null); return; }
    const u = URL.createObjectURL(value);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [value]);

  const pick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const compressed = await compressImage(file);
      onChange(compressed);
    } finally {
      setBusy(false);
    }
  };

  const fileInput = (
    <input
      ref={inputRef} type="file" accept="image/*" capture="environment"
      onChange={onFile} style={{ display: "none" }}
    />
  );

  // Compact: a small square tile (thumbnail or camera placeholder).
  if (compact) {
    const side = 96;
    return (
      <Stack gap={6}>
        {label && <Text size="sm" fw={500}>{label}</Text>}
        {fileInput}
        {url ? (
          <Box pos="relative" w={side} h={side}>
            <Image src={url} w={side} h={side} radius="md" fit="cover" alt="photo" onClick={pick} style={{ cursor: "pointer" }} />
            <ActionIcon
              variant="filled" color="red" size="sm" radius="xl" onClick={() => onChange(null)} aria-label="Remove"
              style={{ position: "absolute", top: -6, right: -6 }}
            >
              <Trash size={12} />
            </ActionIcon>
          </Box>
        ) : (
          <Button
            variant="light" w={side} h={side} p={0} onClick={pick} loading={busy}
            styles={{ root: { borderStyle: "dashed", borderWidth: 2 }, label: { flexDirection: "column", gap: 2 } }}
          >
            <Camera size={22} weight="duotone" />
            <Text size="9px">Photo</Text>
          </Button>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap={6}>
      {label && <Text size="sm" fw={500}>{label}</Text>}
      {fileInput}
      {url ? (
        <Box pos="relative">
          <Image src={url} h={height} radius="md" fit="cover" alt="photo" />
          <Group gap={6} pos="absolute" top={8} right={8}>
            <ActionIcon variant="filled" color="dark" onClick={pick} aria-label="Retake" loading={busy}>
              <ArrowsClockwise size={16} />
            </ActionIcon>
            <ActionIcon variant="filled" color="red" onClick={() => onChange(null)} aria-label="Remove">
              <Trash size={16} />
            </ActionIcon>
          </Group>
        </Box>
      ) : (
        <Button
          variant="light" h={height} fullWidth onClick={pick} loading={busy}
          leftSection={<Camera size={22} weight="duotone" />}
          styles={{ root: { borderStyle: "dashed", borderWidth: 2 } }}
        >
          Take / choose photo
        </Button>
      )}
    </Stack>
  );
}
