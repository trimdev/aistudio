import { NextRequest, NextResponse } from "next/server";
import { agentChat, type AgentMessage } from "@/lib/ai/gemini";
import { getWorkspace } from "@/lib/workspace";
import { getProject } from "@/lib/projects";
import { listVersions } from "@/lib/versions";
import { getServerUser } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = await req.json() as {
    messages: AgentMessage[];
    projectId?: string;
  };

  const { messages, projectId } = body;
  if (!messages?.length) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const workspace = await getWorkspace();

  // Build context string
  let context = `You are an intelligent AI assistant for GhostStudio, a professional ghost mannequin image generation studio.
You help fashion brand owners, photographers, and e-commerce teams create perfect ghost mannequin product shots.

Current workspace: ${workspace?.name ?? "Unknown"}
User email: ${user.email ?? "Unknown"}

You understand both Hungarian and English. Always respond in the same language the user writes in.

You can:
- Answer questions about ghost mannequin photography
- Analyze the current project and suggest improvements
- When the user asks you to refine/fix/improve the image, respond with a JSON block like:
  {"action":"refine","feedback":"your specific refinement instruction"}
- Provide professional advice about garment photography

Keep responses concise and helpful.`;

  if (projectId) {
    try {
      const project = await getProject(projectId);
      if (project) {
        const versions = await listVersions(projectId);
        context += `\n\nCurrent project: "${project.name}"
Status: ${project.status}
Input images: ${project.input_images.length} uploaded
Versions generated: ${versions.length}
${versions.length > 0 ? `\nVersion history:\n${versions.map(v => `  v${v.version_number} (${new Date(v.created_at).toLocaleString("hu-HU")}): ${v.description}`).join("\n")}` : ""}`;
      }
    } catch {
      // Non-fatal
    }
  }

  // Save user message to DB
  try {
    const supabase = await createSupabaseServerClient();
    if (workspace) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === "user") {
        await supabase.from("chat_messages").insert({
          workspace_id: workspace.id,
          project_id: projectId ?? null,
          role: "user",
          content: lastMsg.text,
        });
      }
    }
  } catch {
    // Non-fatal
  }

  try {
    const reply = await agentChat(messages, context, workspace?.gemini_api_key);

    // Save assistant reply to DB
    try {
      const supabase = await createSupabaseServerClient();
      if (workspace) {
        await supabase.from("chat_messages").insert({
          workspace_id: workspace.id,
          project_id: projectId ?? null,
          role: "assistant",
          content: reply,
        });
      }
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ reply });
  } catch (err: unknown) {
    console.error("[agent]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent error" },
      { status: 500 }
    );
  }
}
