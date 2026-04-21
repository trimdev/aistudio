/**
 * Normalize a MIME type string for use with the Gemini API.
 *
 * - Strips parameters (e.g. `; charset=utf-8`)
 * - Lower-cases the result
 * - Maps non-standard variants (`image/jpg`, `image/pjpeg`) to `image/jpeg`
 */
export function normalizeMime(type: string): string {
  const base = type.split(";")[0].trim().toLowerCase();
  if (base === "image/jpg" || base === "image/pjpeg") return "image/jpeg";
  return base;
}
