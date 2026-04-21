/** Image MIME types accepted by upload endpoints. */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

/** 10 MB — maximum allowed file size for image uploads. */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
