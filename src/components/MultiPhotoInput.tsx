"use client";

import { useEffect, useRef, useState } from "react";
import { ActionIcon, Box, Group, Image, Loader, Text } from "@mantine/core";
import { Camera, Plus, Trash } from "@phosphor-icons/react";
import { compressImage } from "@/lib/image";
import { uid } from "@/lib/ids";
import { useMediaUrl } from "@/lib/useMediaUrl";

// A photo already saved (existing media id) or a freshly-picked blob not yet saved.
export interface PhotoItem {
  key: string;         // stable list key
  blob?: Blob;         // set for a newly-picked photo
  mediaId?: string;    // set for an existing saved photo
}

// One thumbnail. Existing photos resolve their blob lazily via useMediaUrl;
// new photos use a live object URL. A tap on the ✕ removes it from the list.
function Thumb({ item, onRemove }: { item: PhotoItem; onRemove: () => void }) {
  const existingUrl = useMediaUrl(item.mediaId);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!item.blob) { setBlobUrl(null); return; }
    const u = URL.createObjectURL(item.blob);
    setBlobUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [item.blob]);
  const url = item.blob ? blobUrl : existingUrl;

  return (
    <Box pos="relative" w={92} h={92} style={{ flex: "0 0 auto" }}>
      {url
        ? <Image src={url} w={92} h={92} radius="md" fit="cover" alt="farm photo" />
        : <Box w={92} h={92} bg="gray.1" style={{ borderRadius: 8, display: "grid", placeItems: "center" }}><Loader size="xs" color="green" /></Box>}
      <ActionIcon
        size="sm" radius="xl" color="red" variant="filled" onClick={onRemove}
        aria-label="Remove photo"
        style={{ position: "absolute", top: -6, right: -6, boxShadow: "0 1px 4px rgba(0,0,0,.3)" }}
      >
        <Trash size={12} weight="bold" />
      </ActionIcon>
    </Box>
  );
}

export default function MultiPhotoInput({
  items, onChange, label = "Photos", max = 12,
}: {
  items: PhotoItem[];
  onChange: (items: PhotoItem[]) => void;
  label?: string;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const atMax = items.length >= max;

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      const room = Math.max(0, max - items.length);
      const picked = files.slice(0, room);
      const added: PhotoItem[] = [];
      for (const f of picked) {
        const blob = await compressImage(f);
        added.push({ key: uid(), blob });
      }
      onChange([...items, ...added]);
    } finally {
      setBusy(false);
    }
  };

  const remove = (key: string) => onChange(items.filter((i) => i.key !== key));

  return (
    <div>
      <Group justify="space-between" mb={6} align="baseline">
        <Text size="sm" fw={500}>{label}</Text>
        <Text size="xs" c="dimmed">{items.length}/{max}</Text>
      </Group>
      <Group gap="sm">
        {items.map((it) => <Thumb key={it.key} item={it} onRemove={() => remove(it.key)} />)}
        {!atMax && (
          <Box
            component="button" type="button" onClick={() => inputRef.current?.click()}
            w={92} h={92}
            style={{
              flex: "0 0 auto", border: "2px dashed var(--mantine-color-gray-4)", borderRadius: 8,
              background: "var(--mantine-color-gray-0)", cursor: "pointer",
              display: "grid", placeItems: "center", color: "var(--mantine-color-green-7)",
            }}
          >
            {busy
              ? <Loader size="sm" color="green" />
              : <Group gap={2} style={{ flexDirection: "column" }}>
                  {items.length ? <Plus size={22} /> : <Camera size={24} />}
                  <Text size="10px" c="dimmed">{items.length ? "Add" : "Add photos"}</Text>
                </Group>}
          </Box>
        )}
      </Group>
      <input
        ref={inputRef} type="file" accept="image/*" capture="environment" multiple
        hidden onChange={onFiles}
      />
    </div>
  );
}
