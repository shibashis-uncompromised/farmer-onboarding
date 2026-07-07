import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";

// Resolve a photo (media id) to a displayable object URL, lazily:
//   1. If the image blob is already local → use it (works offline).
//   2. Else, if we have a presigned URL and we're online → fetch it ON VIEW,
//      cache the blob locally for next time, and show it.
//   3. Else → null (caller shows an avatar/placeholder). Never blocks; a failed
//      or offline fetch just yields null, so no step ever hangs on an image.
export function useMediaUrl(photoId: string | null | undefined): string | null {
  const media = useLiveQuery(() => (photoId ? db.media.get(photoId) : undefined), [photoId]);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objUrl: string | null = null;

    const show = (blob: Blob) => {
      objUrl = URL.createObjectURL(blob);
      if (!cancelled) setUrl(objUrl);
    };

    (async () => {
      if (!media) { setUrl(null); return; }
      if (media.blob) { show(media.blob); return; }

      // No local blob — fetch lazily from the presigned URL (view time only).
      if (media.s3Url && typeof navigator !== "undefined" && navigator.onLine) {
        try {
          const res = await fetch(media.s3Url);
          if (res.ok && !cancelled) {
            const blob = await res.blob();
            // Cache for next time (and for offline viewing once seen).
            db.media.update(media.id, { blob } as any).catch(() => {});
            show(blob);
            return;
          }
        } catch {
          // offline / expired URL / network error → fall through to placeholder
        }
      }
      if (!cancelled) setUrl(null);
    })();

    return () => {
      cancelled = true;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [media?.id, media?.blob, media?.s3Url]);

  return url;
}
