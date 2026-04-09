export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---- Database row types ----

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
  input_images: string[];   // Supabase Storage paths
  output_image: string | null; // Supabase Storage path
  prompt_used: string | null;
  model_used: string;
  created_at: string;
  updated_at: string;
}

// ---- UI / Client types ----

export interface ProjectWithUrls extends Project {
  input_image_urls: string[];
  output_image_url: string | null;
}

export interface GenerateRequest {
  projectId: string;
  inputImages: File[];
  customPrompt?: string;
}

export type GenerationStatus = "idle" | "uploading" | "generating" | "done" | "error";
