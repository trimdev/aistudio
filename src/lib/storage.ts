"use server";

import { createSupabaseAdminClient } from "./supabase/server";
import { getServerUser } from "./supabase/server";

const INPUT_BUCKET = "ghost-inputs";
const OUTPUT_BUCKET = "ghost-outputs";

function adminStorage() {
  return createSupabaseAdminClient().storage;
}

export async function uploadInputImage(
  file: Buffer,
  fileName: string,
  mimeType: string,
  projectId: string
): Promise<string> {
  const user = await getServerUser();
  if (!user) throw new Error("Unauthenticated");

  const path = `${user.id}/${projectId}/${fileName}`;
  const { error } = await adminStorage()
    .from(INPUT_BUCKET)
    .upload(path, file, { contentType: mimeType, upsert: true });

  if (error) throw error;
  return path;
}

export async function uploadOutputImage(
  file: Buffer,
  fileName: string,
  mimeType: string,
  projectId: string
): Promise<string> {
  const user = await getServerUser();
  if (!user) throw new Error("Unauthenticated");

  const path = `${user.id}/${projectId}/${fileName}`;
  const { error } = await adminStorage()
    .from(OUTPUT_BUCKET)
    .upload(path, file, { contentType: mimeType, upsert: true });

  if (error) throw error;
  return path;
}

export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600,
  options?: {
    download?: string | boolean;
    cacheNonce?: string;
    transform?: {
      width?: number;
      height?: number;
      resize?: "cover" | "contain" | "fill";
      format?: "origin";
      quality?: number;
    };
  }
): Promise<string> {
  const { data, error } = await adminStorage()
    .from(bucket)
    .createSignedUrl(path, expiresIn, options);
  if (error) throw error;
  return data.signedUrl;
}
