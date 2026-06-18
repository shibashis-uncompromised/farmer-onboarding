import { useEffect, useState } from "react";

// Create an object URL for a blob and ALWAYS revoke it when the blob changes or
// the component unmounts. Using URL.createObjectURL() directly in render leaks
// memory (every render makes a new URL that's never freed), which shows up as
// gradual lag/jank. This hook frees each URL, so memory stays flat.
export function useBlobUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) { setUrl(null); return; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
