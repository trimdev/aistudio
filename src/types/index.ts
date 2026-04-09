export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ── Database row types ────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  clerk_user_id: string;
  name: string;
  gemini_api_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  status: "pending" | "processing" | "completed" | "failed";
  input_images: string[];
  output_image: string | null;
  prompt_used: string | null;
  model_used: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithUrls extends Project {
  input_image_urls: string[];
  output_image_url: string | null;
}

// ── Ghost Studio Tool types ───────────────────────────────────────────────────

export interface UploadedImages {
  front: File | null;
  back: File | null;
  side: File | null;
}

export interface UploadedPreviews {
  front: string | null;
  back: string | null;
  side: string | null;
}

export type GenerationStep =
  | "idle"
  | "uploading"
  | "analyzing"
  | "removing"
  | "preserving"
  | "compositing"
  | "finalizing"
  | "done"
  | "error";

export interface GenerationResult {
  outputUrl: string;
  outputPath: string;
  projectId: string;
  mimeType: string;
  generatedAt: Date;
}
