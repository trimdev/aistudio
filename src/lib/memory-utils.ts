import type { WorkspaceMemory } from "./workspace-memory";

/** Returns a formatted block to prepend to AI prompts, or empty string if no memories. */
export function buildMemoryPromptBlock(memories: WorkspaceMemory[]): string {
  if (memories.length === 0) return "";
  const lines = memories.map((m) => `- ${m.note}`).join("\n");
  return `\n\nWORKSPACE PERSISTENT MEMORY — ALWAYS APPLY (these are standing preferences the user has saved):\n${lines}\n`;
}
