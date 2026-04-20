// Shared constants for the Design Model Photo Studio feature.
// Used by both the UI (DesignModelTool) and the API route (generate-design-model).

export interface DesignModel {
  id: string;
  name: string;
  origin: "slavic" | "french";
  hairColor: "blonde" | "brunette";
  style: string;
  promptDescription: string;
  gradient: string;    // Tailwind gradient classes for UI card bg
  accentColor: string; // Tailwind border class for selected state
  letter: string;      // Avatar letter
  portraitPath: string; // Path to pre-generated portrait image in /public
}

export interface DesignBackground {
  id: string;
  label_en: string;
  label_hu: string;
  type: "studio" | "lifestyle";
  promptDescription: string;
  gradient: string;
  dot: string;
  imagePath: string; // Pre-generated preview image in /public
}

export interface DesignPose {
  id: string;
  label_en: string;
  label_hu: string;
  promptDescription: string;
  icon: string;
}

export const DESIGN_MODELS: DesignModel[] = [
  {
    id: "zoya",
    name: "Zoya",
    origin: "slavic",
    hairColor: "blonde",
    style: "Editorial",
    promptDescription: "Eastern European female model, sharp high cheekbones, ice-blonde straight hair shoulder-length or longer, striking pale grey-blue eyes, porcelain skin tone, editorial and refined face",
    gradient: "from-slate-800/80 via-slate-900 to-stone-950",
    accentColor: "border-slate-400",
    letter: "Z",
    portraitPath: "/models/zoya.png",
  },
  {
    id: "mila",
    name: "Mila",
    origin: "slavic",
    hairColor: "blonde",
    style: "Ethereal",
    promptDescription: "Slavic female model, ethereal soft features, platinum wavy blonde hair shoulder-length or longer, gentle full lips, wide-set light eyes, porcelain skin tone",
    gradient: "from-violet-900/70 via-stone-900 to-stone-950",
    accentColor: "border-violet-400",
    letter: "M",
    portraitPath: "/models/mila.png",
  },
  {
    id: "katya",
    name: "Katya",
    origin: "slavic",
    hairColor: "blonde",
    style: "Athletic",
    promptDescription: "Russian female model, strong defined jaw, golden-blonde layered hair, pronounced brow arch, athletic yet elegant build, confident expression, fair skin",
    gradient: "from-amber-900/70 via-stone-900 to-stone-950",
    accentColor: "border-amber-400",
    letter: "K",
    portraitPath: "/models/katya.png",
  },
  {
    id: "vera",
    name: "Vera",
    origin: "slavic",
    hairColor: "brunette",
    style: "Minimal",
    promptDescription: "Czech female model, dark chestnut brown hair straight or slightly wavy, angular sharp facial features, deep-set dark eyes, minimal and refined aesthetic, fair skin tone",
    gradient: "from-stone-700/70 via-stone-900 to-stone-950",
    accentColor: "border-stone-400",
    letter: "V",
    portraitPath: "/models/vera.png",
  },
  {
    id: "natasha",
    name: "Natasha",
    origin: "slavic",
    hairColor: "brunette",
    style: "Power",
    promptDescription: "Ukrainian female model, rich dark brown hair, bold pronounced brows, full lips, powerful and expressive face, strong presence, medium-fair skin tone",
    gradient: "from-rose-900/70 via-stone-900 to-stone-950",
    accentColor: "border-rose-400",
    letter: "N",
    portraitPath: "/models/natasha.png",
  },
  {
    id: "sasha",
    name: "Sasha",
    origin: "slavic",
    hairColor: "brunette",
    style: "Street",
    promptDescription: "Polish female model, warm brown shoulder-length hair, androgynous clean facial features, soft jawline, effortless street-fashion aesthetic, light skin tone",
    gradient: "from-emerald-900/70 via-stone-900 to-stone-950",
    accentColor: "border-emerald-400",
    letter: "S",
    portraitPath: "/models/sasha.png",
  },
  {
    id: "celeste",
    name: "Céleste",
    origin: "french",
    hairColor: "blonde",
    style: "Chic",
    promptDescription: "Parisian female model, sandy golden-blonde tousled medium-length hair, effortless French-girl features, slightly upturned nose, natural charm, light skin with golden undertone",
    gradient: "from-yellow-900/70 via-stone-900 to-stone-950",
    accentColor: "border-yellow-400",
    letter: "C",
    portraitPath: "/models/celeste.png",
  },
  {
    id: "margaux",
    name: "Margaux",
    origin: "french",
    hairColor: "blonde",
    style: "Elegance",
    promptDescription: "French female model, golden-blonde blunt bob haircut, refined classical facial features, subtle prominent cheekbones, editorial elegance, fair porcelain skin",
    gradient: "from-pink-900/70 via-stone-900 to-stone-950",
    accentColor: "border-pink-400",
    letter: "G",
    portraitPath: "/models/margaux.png",
  },
  {
    id: "ines",
    name: "Inès",
    origin: "french",
    hairColor: "brunette",
    style: "Classic",
    promptDescription: "Parisian female model, deep chestnut brown bob, Brigitte Bardot-inspired classic French beauty, delicate refined features, timeless elegance, fair warm skin tone",
    gradient: "from-teal-900/70 via-stone-900 to-stone-950",
    accentColor: "border-teal-400",
    letter: "I",
    portraitPath: "/models/ines.png",
  },
  {
    id: "violette",
    name: "Violette",
    origin: "french",
    hairColor: "brunette",
    style: "Avant-Garde",
    promptDescription: "French female model, rich dark brown wavy hair, avant-garde beauty, strong expressive eyebrows, unconventional striking face, artistic and bold presence, medium skin tone",
    gradient: "from-indigo-900/70 via-stone-900 to-stone-950",
    accentColor: "border-indigo-400",
    letter: "O",
    portraitPath: "/models/violette.png",
  },
];

export const DESIGN_BACKGROUNDS: DesignBackground[] = [
  {
    id: "studio_white",
    label_en: "Studio White",
    label_hu: "Fehér stúdió",
    type: "studio",
    promptDescription: "Pure white seamless studio backdrop, soft diffused even studio lighting, zero shadows, clean professional fashion e-commerce setting",
    gradient: "from-gray-200 to-white",
    dot: "bg-gray-400",
    imagePath: "/backgrounds/studio_white.png",
  },
  {
    id: "studio_warm",
    label_en: "Warm Studio",
    label_hu: "Meleg stúdió",
    type: "studio",
    promptDescription: "Warm light grey seamless studio backdrop, soft warm-toned diffused studio lighting, elegant neutral atmosphere",
    gradient: "from-stone-300 to-stone-200",
    dot: "bg-stone-500",
    imagePath: "/backgrounds/studio_warm.png",
  },
  {
    id: "paris_street",
    label_en: "Paris Street",
    label_hu: "Párizsi utca",
    type: "lifestyle",
    promptDescription: "Cobblestone Parisian street, golden hour afternoon light casting warm tones, blurred Haussmann-style buildings with ornate iron balconies in background, sophisticated urban atmosphere",
    gradient: "from-amber-700 to-stone-800",
    dot: "bg-amber-400",
    imagePath: "/backgrounds/paris_street.png",
  },
  {
    id: "montmartre",
    label_en: "Montmartre",
    label_hu: "Montmartre",
    type: "lifestyle",
    promptDescription: "Outdoor setting in Montmartre Paris, white-washed walls with artistic details, warm natural daylight, bohemian and artistic Parisian atmosphere",
    gradient: "from-rose-800 to-stone-900",
    dot: "bg-rose-400",
    imagePath: "/backgrounds/montmartre.png",
  },
  {
    id: "forest_path",
    label_en: "Forest Path",
    label_hu: "Erdei ösvény",
    type: "lifestyle",
    promptDescription: "Dappled golden light filtering through lush green forest canopy, soft natural light, rich green foliage in background, organic fresh and natural atmosphere",
    gradient: "from-emerald-800 to-green-950",
    dot: "bg-emerald-400",
    imagePath: "/backgrounds/forest_path.png",
  },
  {
    id: "modern_interior",
    label_en: "Modern Interior",
    label_hu: "Modern belső",
    type: "lifestyle",
    promptDescription: "Minimalist contemporary living room interior, large floor-to-ceiling windows flooding space with soft natural daylight, white walls with light oak wood accents, clean and sophisticated",
    gradient: "from-sky-800 to-slate-900",
    dot: "bg-sky-400",
    imagePath: "/backgrounds/modern_interior.png",
  },
  {
    id: "industrial_loft",
    label_en: "Industrial Loft",
    label_hu: "Ipari loft",
    type: "lifestyle",
    promptDescription: "Urban industrial loft space, exposed brick walls, metal ceiling beams, warm Edison bulb lighting creating a moody atmospheric glow, edgy and raw urban energy",
    gradient: "from-orange-900 to-stone-950",
    dot: "bg-orange-500",
    imagePath: "/backgrounds/industrial_loft.png",
  },
  {
    id: "beach_boardwalk",
    label_en: "Beach Boardwalk",
    label_hu: "Tengerparti sétány",
    type: "lifestyle",
    promptDescription: "Coastal wooden boardwalk setting, ocean or sea visible in background, bright natural coastal sunlight, fresh airy atmosphere with light sea breeze quality",
    gradient: "from-cyan-600 to-blue-900",
    dot: "bg-cyan-400",
    imagePath: "/backgrounds/beach_boardwalk.png",
  },
  {
    id: "rooftop_city",
    label_en: "Rooftop City",
    label_hu: "Tetőterasz",
    type: "lifestyle",
    promptDescription: "Upscale rooftop terrace overlooking modern city skyline, late afternoon warm golden light, urban contemporary atmosphere with architectural buildings visible behind",
    gradient: "from-indigo-700 to-slate-900",
    dot: "bg-indigo-400",
    imagePath: "/backgrounds/rooftop_city.png",
  },
  {
    id: "evening_boulevard",
    label_en: "Evening Boulevard",
    label_hu: "Esti boulevard",
    type: "lifestyle",
    promptDescription: "Parisian evening boulevard, warm golden street lights reflected on wet cobblestones, soft golden bokeh in background, romantic and sophisticated nocturnal atmosphere",
    gradient: "from-yellow-900 to-stone-950",
    dot: "bg-yellow-500",
    imagePath: "/backgrounds/evening_boulevard.png",
  },
];

export const DESIGN_POSES: DesignPose[] = [
  {
    id: "standing_natural",
    label_en: "Standing Natural",
    label_hu: "Természetes állás",
    promptDescription: "Standing tall and relaxed, arms softly at sides, facing directly toward camera, confident neutral expression, full body shot head to toe",
    icon: "↕",
  },
  {
    id: "walking",
    label_en: "Walking",
    label_hu: "Séta",
    promptDescription: "Natural confident walking pose mid-stride, subtle dynamic movement, arms in natural motion, slight smile, full body shot head to toe",
    icon: "→",
  },
  {
    id: "three_quarter",
    label_en: "Three-Quarter Turn",
    label_hu: "¾ Fordulat",
    promptDescription: "Three-quarter body turn to the right, looking back over left shoulder, elegant and refined pose, full body shot head to toe",
    icon: "↗",
  },
  {
    id: "editorial_lean",
    label_en: "Editorial Lean",
    label_hu: "Támaszkodás",
    promptDescription: "Leaning lightly against an architectural element or wall, sophisticated editorial pose, one leg slightly crossed in front, full body shot head to toe",
    icon: "⟋",
  },
  {
    id: "sitting",
    label_en: "Sitting",
    label_hu: "Ülés",
    promptDescription: "Sitting elegantly on a stool or surface appropriate to the scene, legs crossed at ankle or knees together, relaxed refined posture, full body visible",
    icon: "⊥",
  },
  {
    id: "power_stance",
    label_en: "Power Stance",
    label_hu: "Erős póz",
    promptDescription: "One hand resting on hip, strong confident direct gaze toward camera, empowered editorial stance, full body shot head to toe",
    icon: "✦",
  },
  {
    id: "candid_walk",
    label_en: "Candid Walk",
    label_hu: "Természetes séta",
    promptDescription: "Candid mid-walk pose, looking slightly off-camera with genuine natural expression, fabric in subtle motion, authentic and spontaneous feel, full body shot head to toe",
    icon: "~",
  },
  {
    id: "close_frame",
    label_en: "Waist-Up",
    label_hu: "Derékig",
    promptDescription: "Elegant close frame from waist up, both hands visible and expressively positioned, detailed shot showing garment details clearly, confident expression",
    icon: "⊡",
  },
];

/**
 * Build the Gemini prompt for a single Design Model photo.
 * All variables come from the pre-defined catalogues above.
 */
export function buildDesignModelPrompt(
  model: DesignModel,
  background: DesignBackground,
  pose: DesignPose,
  extraPrompt?: string,
  seriesInfo?: { index: number; total: number }
): string {
  const isStudio = background.type === "studio";
  const lightingNote = isStudio
    ? "Soft even diffused studio lighting. Zero harsh shadows."
    : "Natural lighting that is appropriate and consistent with the scene. Realistic light quality.";

  const seriesNote = seriesInfo && seriesInfo.total > 1
    ? `\n\nSCENE CONSISTENCY (MANDATORY — Photo ${seriesInfo.index + 1} of ${seriesInfo.total}):\nThis is part of a series of ${seriesInfo.total} photos taken in the EXACT SAME location. The background scene must be PERFECTLY IDENTICAL across all ${seriesInfo.total} photos — same floor material and texture, same walls, same furniture and props, same lighting direction, same camera angle and height, same depth of field. ONLY the model's pose differs. You are shooting multiple takes in the same studio/location setup without moving anything. Do NOT vary any background element whatsoever.`
    : "";

  return `Generate a professional high-end fashion editorial photograph.

OUTPUT: ONE single standalone photograph — NOT a collage, NOT a triptych, NOT a grid. One image, one pose, one scene.

══════════════════════════════════════════════════
GARMENT — MANDATORY COPY TASK (highest priority):
══════════════════════════════════════════════════
The uploaded photo(s) show the ACTUAL PHYSICAL GARMENT that must appear in this photo.
This is NOT a creative brief. You are NOT asked to imagine, design, or interpret a garment.
You must COPY the uploaded garment onto the model with 100% accuracy.

COPY THESE EXACT ATTRIBUTES from the uploaded photo(s):
  • Garment TYPE and LENGTH (e.g. short puffer jacket, NOT a long coat)
  • Silhouette and fit (cropped, oversized, fitted, etc.)
  • Color — exact hue, saturation, brightness (do NOT darken, shift, or reinterpret)
  • Fabric texture and sheen (matte, glossy, quilted, etc.)
  • All hardware: zipper style, button placement, buckles, snap count
  • Collar type — copy EXACTLY
  • Pocket placement, shape, and count
  • Pattern / print / stitching lines
  • Sleeve length, cuff style, and any trim
  • Hem shape and length

PROHIBITED:
  ✗ Do NOT substitute a different garment style
  ✗ Do NOT change garment length or silhouette
  ✗ Do NOT add or remove any garment details
  ✗ Do NOT reinterpret or "upgrade" the garment
  ✗ Do NOT apply any stylistic interpretation to the garment
  If you cannot see a detail clearly, leave it as-is — never improvise

MODEL APPEARANCE:
${model.promptDescription}. Natural makeup, neutral to confident expression.
Full body shot, head to toe. Arms slightly away from body so garment silhouette is fully visible.

POSE:
${pose.promptDescription}

SETTING / BACKGROUND:
${background.promptDescription}

LIGHTING:
${lightingNote}

TECHNICAL:
Photorealistic. High resolution. Sharp focus on the garment. Commercial fashion editorial style.
Medium format camera aesthetic, 85mm focal length equivalent.${extraPrompt ? `\n\nAdditional instructions: ${extraPrompt.trim()}` : ""}${seriesNote}`;
}
