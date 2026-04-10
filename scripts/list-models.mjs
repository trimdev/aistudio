import { readFileSync } from "fs";
import { resolve } from "path";

const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const apiKey = env.match(/^GEMINI_API_KEY=(.+)$/m)?.[1]?.trim();

const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`
);
const { models } = await res.json();

// Show only models that support generateContent and have image-related names
const relevant = models?.filter(m =>
  m.supportedGenerationMethods?.includes("generateContent") &&
  (m.name.includes("flash") || m.name.includes("imagen") || m.name.includes("image"))
);

console.log("Image-capable / Flash models:\n");
relevant?.forEach(m => {
  console.log(" •", m.name);
  console.log("   methods:", m.supportedGenerationMethods?.join(", "));
});
