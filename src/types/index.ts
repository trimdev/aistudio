export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ── Database row types ────────────────────────────────────────────────────────

export type WorkspaceModule = "fashion" | "furniture";

export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  gemini_api_key: string | null;
  role: "user" | "admin";
  modules: WorkspaceModule[];
  created_at: string;
  updated_at: string;
}

export interface ProjectCollection {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectCollectionWithMeta extends ProjectCollection {
  photoCount: number;
  completedCount: number;
  thumbnailUrl: string | null;
  lastActivity: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  collection_id: string | null;
  name: string;
  status: "pending" | "processing" | "completed" | "failed";
  input_images: string[];
  output_image: string | null;
  prompt_used: string | null;
  model_used: string;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithUrls extends Project {
  input_image_urls: string[];
  output_image_url: string | null;
  output_image_full_url: string | null;
}

export interface ProjectVersion {
  id: string;
  project_id: string;
  version_number: number;
  output_image: string;
  feedback: string | null;
  created_by: "user" | "ai";
  description: string;
  created_at: string;
}

export interface ProjectVersionWithUrl extends ProjectVersion {
  output_image_url: string;
  output_image_thumb_url: string;
}

export interface ChatMessage {
  id: string;
  workspace_id: string;
  project_id: string | null;
  role: "user" | "assistant";
  content: string;
  created_at: string;
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
  collectionId?: string | null;
  mimeType: string;
  generatedAt: Date;
  versionNumber?: number;
}
