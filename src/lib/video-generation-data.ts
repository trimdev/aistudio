// Shared constants for the Video Generation Studio feature.
// Used by both the UI (VideoGenerationTool) and the API route (generate-video).

export interface MotionStyle {
  id: string;
  name: string;
  description_en: string;
  description_hu: string;
  icon: string;
  promptDescription: string;
  durationRange: [number, number]; // min/max seconds
  gradient: string;
}

export const MOTION_STYLES: MotionStyle[] = [
  {
    id: "slow-cinematic",
    name: "Slow & Cinematic",
    description_en: "Smooth, editorial elegance with gentle camera drift",
    description_hu: "Lassú, szerkesztői elegancia lágy kameramozgással",
    icon: "🎬",
    promptDescription: "slow cinematic camera movement, smooth dolly, editorial elegance, gentle drift",
    durationRange: [4, 8],
    gradient: "from-slate-700 to-slate-900",
  },
  {
    id: "dynamic-energy",
    name: "Dynamic Energy",
    description_en: "Energetic movement with bold camera work",
    description_hu: "Energikus mozgás merész kameramunkával",
    icon: "⚡",
    promptDescription: "dynamic energetic movement, bold camera work, fast cuts, vibrant motion",
    durationRange: [3, 6],
    gradient: "from-orange-600 to-red-700",
  },
  {
    id: "runway-walk",
    name: "Runway Walk",
    description_en: "Model walks forward on a fashion runway",
    description_hu: "A modell előresétál a kifutón",
    icon: "👠",
    promptDescription: "fashion model walking on runway, confident stride, frontal approach, fashion show atmosphere",
    durationRange: [4, 8],
    gradient: "from-purple-700 to-pink-600",
  },
  {
    id: "360-spin",
    name: "360° Product Spin",
    description_en: "Full rotation showing every angle of the garment",
    description_hu: "Teljes forgás, ami a ruha minden szögét megmutatja",
    icon: "🔄",
    promptDescription: "smooth 360 degree rotation, product turntable spin, all angles visible, steady rotation",
    durationRange: [4, 6],
    gradient: "from-cyan-600 to-blue-700",
  },
  {
    id: "parallax-depth",
    name: "Parallax Depth",
    description_en: "Multi-layer depth effect with subtle motion",
    description_hu: "Többrétegű mélységhatás finom mozgással",
    icon: "🌊",
    promptDescription: "parallax depth effect, multi-layer motion, foreground and background separation, subtle 3D depth",
    durationRange: [3, 5],
    gradient: "from-teal-600 to-emerald-700",
  },
  {
    id: "zoom-reveal",
    name: "Zoom Reveal",
    description_en: "Dramatic zoom from full shot to detail close-up",
    description_hu: "Drámai zoom teljes képtől közeli részletig",
    icon: "🔍",
    promptDescription: "dramatic zoom in from wide shot to close-up detail, revealing fabric texture and stitching quality",
    durationRange: [3, 5],
    gradient: "from-amber-600 to-yellow-700",
  },
  {
    id: "lifestyle-casual",
    name: "Casual & Effortless",
    description_en: "Natural, relaxed movement in everyday settings",
    description_hu: "Természetes, laza mozgás hétköznapi környezetben",
    icon: "☀️",
    promptDescription: "casual natural movement, relaxed and effortless, everyday lifestyle, candid feel",
    durationRange: [4, 8],
    gradient: "from-green-600 to-lime-700",
  },
  {
    id: "editorial-pose",
    name: "Editorial Pose Shift",
    description_en: "Model transitions between editorial poses",
    description_hu: "A modell szerkesztői pózok között vált",
    icon: "📸",
    promptDescription: "fashion model shifting between editorial poses, deliberate posing transitions, high fashion photography in motion",
    durationRange: [4, 6],
    gradient: "from-rose-600 to-pink-700",
  },
  {
    id: "fabric-flow",
    name: "Fabric Flow",
    description_en: "Emphasizes garment movement and fabric draping",
    description_hu: "A ruha mozgását és az anyag esését hangsúlyozza",
    icon: "🪭",
    promptDescription: "fabric flowing in gentle breeze, cloth draping and movement, texture emphasis, garment billowing naturally",
    durationRange: [3, 6],
    gradient: "from-violet-600 to-indigo-700",
  },
  {
    id: "split-before-after",
    name: "Before & After Split",
    description_en: "Split-screen transition from flat lay to on-model",
    description_hu: "Osztott képernyős átmenet terítékből modellen lévőre",
    icon: "↔️",
    promptDescription: "split screen transition effect, before and after comparison, flat lay transforming to on-model view",
    durationRange: [4, 6],
    gradient: "from-stone-600 to-neutral-800",
  },
];

export interface CameraAngle {
  id: string;
  name: string;
  description_hu: string;
  promptDescription: string;
  icon: string;
}

export const CAMERA_ANGLES: CameraAngle[] = [
  { id: "front", name: "Front", description_hu: "Elölnézet", promptDescription: "straight-on frontal angle, eye level", icon: "⬛" },
  { id: "three-quarter", name: "3/4 Angle", description_hu: "3/4-es szög", promptDescription: "three-quarter angle view, slightly angled from front", icon: "◪" },
  { id: "side-profile", name: "Side Profile", description_hu: "Oldalnézet", promptDescription: "side profile view, 90 degree angle", icon: "▶" },
  { id: "low-angle", name: "Low Angle", description_hu: "Alsó szög", promptDescription: "low angle looking up, dramatic perspective, powerful stance", icon: "⬆" },
  { id: "high-angle", name: "High Angle", description_hu: "Felső szög", promptDescription: "high angle looking down, editorial birds-eye perspective", icon: "⬇" },
  { id: "dutch-tilt", name: "Dutch Tilt", description_hu: "Döntött kamera", promptDescription: "dutch angle tilt, creative diagonal framing, dynamic composition", icon: "⟋" },
  { id: "over-shoulder", name: "Over Shoulder", description_hu: "Váll fölötti", promptDescription: "over-the-shoulder perspective, depth of field, detail focus", icon: "👁" },
  { id: "orbiting", name: "Orbiting", description_hu: "Keringő", promptDescription: "camera orbiting around subject, smooth circular motion, all-around view", icon: "🔁" },
];

export interface MusicMood {
  id: string;
  name: string;
  description_hu: string;
  bpm: string;
  genre: string;
  gradient: string;
}

export const MUSIC_MOODS: MusicMood[] = [
  { id: "none", name: "No Music", description_hu: "Zene nélkül", bpm: "-", genre: "Silent", gradient: "from-gray-400 to-gray-500" },
  { id: "minimal-electronic", name: "Minimal Electronic", description_hu: "Minimalista elektronikus", bpm: "100–120", genre: "Electronic", gradient: "from-cyan-500 to-blue-600" },
  { id: "luxury-ambient", name: "Luxury Ambient", description_hu: "Luxus ambient", bpm: "60–80", genre: "Ambient", gradient: "from-amber-500 to-yellow-600" },
  { id: "upbeat-pop", name: "Upbeat Pop", description_hu: "Vidám pop", bpm: "120–140", genre: "Pop", gradient: "from-pink-500 to-rose-600" },
  { id: "deep-house", name: "Deep House", description_hu: "Deep House", bpm: "120–125", genre: "House", gradient: "from-purple-500 to-violet-600" },
  { id: "cinematic-orchestral", name: "Cinematic Orchestral", description_hu: "Filmes zenekari", bpm: "70–90", genre: "Orchestral", gradient: "from-slate-500 to-stone-700" },
  { id: "hip-hop-trap", name: "Hip-Hop / Trap", description_hu: "Hip-Hop / Trap", bpm: "130–160", genre: "Hip-Hop", gradient: "from-red-500 to-orange-600" },
  { id: "lofi-chill", name: "Lo-Fi Chill", description_hu: "Lo-Fi nyugis", bpm: "80–100", genre: "Lo-Fi", gradient: "from-green-500 to-teal-600" },
];

export interface VideoTemplate {
  id: string;
  name: string;
  description_en: string;
  description_hu: string;
  motionStyleId: string;
  cameraAngleId: string;
  musicMoodId: string;
  duration: number;
  aspectRatio: "9:16" | "16:9" | "1:1" | "4:5";
  gradient: string;
  icon: string;
}

export const VIDEO_TEMPLATES: VideoTemplate[] = [
  {
    id: "instagram-reel",
    name: "Instagram Reel",
    description_en: "Vertical video optimized for IG Reels and Stories",
    description_hu: "Függőleges videó IG Reels-re és Stories-ra optimalizálva",
    motionStyleId: "dynamic-energy",
    cameraAngleId: "front",
    musicMoodId: "upbeat-pop",
    duration: 5,
    aspectRatio: "9:16",
    gradient: "from-fuchsia-500 to-pink-600",
    icon: "📱",
  },
  {
    id: "product-page",
    name: "Product Page Hero",
    description_en: "Clean 360° spin for e-commerce product pages",
    description_hu: "Tiszta 360°-os pörgetés webshop termékoldalakhoz",
    motionStyleId: "360-spin",
    cameraAngleId: "three-quarter",
    musicMoodId: "none",
    duration: 5,
    aspectRatio: "1:1",
    gradient: "from-slate-500 to-gray-700",
    icon: "🛍️",
  },
  {
    id: "runway-showcase",
    name: "Runway Showcase",
    description_en: "Fashion week style runway presentation",
    description_hu: "Divatheti stílusú kifutó bemutató",
    motionStyleId: "runway-walk",
    cameraAngleId: "front",
    musicMoodId: "deep-house",
    duration: 6,
    aspectRatio: "16:9",
    gradient: "from-purple-600 to-indigo-700",
    icon: "✨",
  },
  {
    id: "editorial-campaign",
    name: "Editorial Campaign",
    description_en: "Cinematic editorial for brand campaigns",
    description_hu: "Filmes szerkesztői videó márka kampányokhoz",
    motionStyleId: "slow-cinematic",
    cameraAngleId: "dutch-tilt",
    musicMoodId: "cinematic-orchestral",
    duration: 8,
    aspectRatio: "16:9",
    gradient: "from-amber-600 to-orange-700",
    icon: "🎥",
  },
  {
    id: "tiktok-viral",
    name: "TikTok Viral",
    description_en: "Fast-paced trending format for TikTok",
    description_hu: "Gyors, trendi formátum TikTok-ra",
    motionStyleId: "dynamic-energy",
    cameraAngleId: "low-angle",
    musicMoodId: "hip-hop-trap",
    duration: 4,
    aspectRatio: "9:16",
    gradient: "from-red-500 to-pink-600",
    icon: "🔥",
  },
  {
    id: "luxury-reveal",
    name: "Luxury Reveal",
    description_en: "Slow, premium unboxing / reveal moment",
    description_hu: "Lassú, prémium kicsomagolás / felfedés pillanat",
    motionStyleId: "zoom-reveal",
    cameraAngleId: "high-angle",
    musicMoodId: "luxury-ambient",
    duration: 6,
    aspectRatio: "4:5",
    gradient: "from-yellow-600 to-amber-800",
    icon: "💎",
  },
];

export interface AspectRatio {
  id: "9:16" | "16:9" | "1:1" | "4:5";
  name: string;
  description_hu: string;
  width: number;
  height: number;
  useCase: string;
}

export const ASPECT_RATIOS: AspectRatio[] = [
  { id: "9:16", name: "Vertical (9:16)", description_hu: "Függőleges", width: 1080, height: 1920, useCase: "Reels, Stories, TikTok" },
  { id: "16:9", name: "Landscape (16:9)", description_hu: "Fekvő", width: 1920, height: 1080, useCase: "YouTube, Website Hero" },
  { id: "1:1", name: "Square (1:1)", description_hu: "Négyzet", width: 1080, height: 1080, useCase: "Instagram Feed, Product Page" },
  { id: "4:5", name: "Portrait (4:5)", description_hu: "Portré", width: 1080, height: 1350, useCase: "Instagram Feed, Pinterest" },
];

export interface BrandingPosition {
  id: string;
  name: string;
  description_hu: string;
}

export const BRANDING_POSITIONS: BrandingPosition[] = [
  { id: "none", name: "No Branding", description_hu: "Nincs branding" },
  { id: "top-left", name: "Top Left", description_hu: "Bal felső" },
  { id: "top-right", name: "Top Right", description_hu: "Jobb felső" },
  { id: "bottom-left", name: "Bottom Left", description_hu: "Bal alsó" },
  { id: "bottom-right", name: "Bottom Right", description_hu: "Jobb alsó" },
  { id: "center-bottom", name: "Center Bottom", description_hu: "Közép alsó" },
];
