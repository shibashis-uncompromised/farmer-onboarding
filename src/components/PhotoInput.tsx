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
}

export default function PhotoInput({ value, onChange, height = 200, label = "Photo" }: Props) {
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

  return (
    <Stack gap={6}>
      {label && <Text size="sm" fw={500}>{label}</Text>}
      <input
        ref={inputRef} type="file" accept="image/*" capture="environment"
        onChange={onFile} style={{ display: "none" }}
      />
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
