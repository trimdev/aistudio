"use server";

import { createSupabaseAdminClient } from "./supabase/server";
import { auth } from "@clerk/nextjs/server";

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
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  // Path: {userId}/{projectId}/{fileName}
  const path = `${userId}/${projectId}/${fileName}`;

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
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  const path = `${userId}/${projectId}/${fileName}`;

  const { error } = await adminStorage()
    .from(OUTPUT_BUCKET)
    .upload(path, file, { contentType: mimeType, upsert: true });

  if (error) throw error;
  return path;
}

export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600
): Promise<string> {
  const { data, error } = await adminStorage()
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
