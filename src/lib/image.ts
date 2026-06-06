// Compress a captured photo to keep storage + export size reasonable.
// Resizes so the longest edge <= maxDim and re-encodes as JPEG.
export async function compressImage(file: Blob, maxDim = 1280, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  return new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob || file),
      "image/jpeg",
      quality
    );
  });
}

export function blobToURL(blob: Blob | null | undefined): string | null {
  return blob ? URL.createObjectURL(blob) : null;
}
