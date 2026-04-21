import type { UploadedPreviews } from "@/types";

/**
 * Client-side image compression.
 *
 * Vercel serverless functions have a 4.5 MB request body limit.
 * Compress each image to fit comfortably (default: max 1.5 MB, max 1920 px).
 */
export async function compressImage(file: File, maxMB = 1.5, maxPx = 1920): Promise<File> {
  return new Promise((resolve) => {
    if (file.size <= maxMB * 1024 * 1024) { resolve(file); return; }
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > maxPx || h > maxPx) {
        const r = Math.min(maxPx / w, maxPx / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      let quality = 0.85;
      const attempt = () => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          if (blob.size > maxMB * 1024 * 1024 && quality > 0.45) {
            quality = Math.round((quality - 0.1) * 10) / 10;
            attempt();
          } else {
            resolve(new File([blob], file.name, { type: "image/jpeg" }));
          }
        }, "image/jpeg", quality);
      };
      attempt();
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(file); };
    img.src = blobUrl;
  });
}

/**
 * Download a file from a URL by fetching it as a blob first (to support
 * cross-origin URLs and force the browser download dialog). Falls back to
 * a simple anchor click if the fetch fails.
 */
export async function downloadFile(url: string, filename: string) {
  try {
    const blob = await fetch(url).then((r) => r.blob());
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
}

/**
 * Revoke all non-null blob-URL previews for the standard three-slot layout.
 */
export function revokePreviews(prev: UploadedPreviews) {
  if (prev.front) URL.revokeObjectURL(prev.front);
  if (prev.back)  URL.revokeObjectURL(prev.back);
  if (prev.side)  URL.revokeObjectURL(prev.side);
}
