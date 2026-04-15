export interface FurnitureScene {
  key: string;
  label: string;
  description: string;
}

export const FURNITURE_SCENES: FurnitureScene[] = [
  {
    key: "living_modern",
    label: "Modern nappali",
    description: "Scandinavian-inspired living room with light oak flooring, white walls, large floor-to-ceiling windows flooding the space with diffused natural daylight. Minimal decor, low-profile coffee table, neutral tones.",
  },
  {
    key: "living_cozy",
    label: "Hangulatos nappali",
    description: "Warm, cosy living room with rich warm lighting, exposed wooden ceiling beams, a stone fireplace, layered rugs, and soft textured cushions. Earthy, inviting palette of warm beiges and terracotta.",
  },
  {
    key: "living_luxury",
    label: "Luxus nappali",
    description: "Luxury penthouse living room with floor-to-ceiling glass walls overlooking a city skyline at dusk. Marble floors, sculptural floor lamps, art on walls, muted champagne and charcoal palette.",
  },
  {
    key: "living_loft",
    label: "Ipari loft",
    description: "Industrial loft apartment with exposed concrete ceilings, steel beams, large factory windows, dark wood floors, Edison bulb pendant lights. Raw textures, muted colours.",
  },
  {
    key: "bedroom_modern",
    label: "Modern hálószoba",
    description: "Minimalist modern bedroom, soft neutral tones, linen bedding, morning light streaming through sheer curtains, bedside table with a simple lamp and a book.",
  },
  {
    key: "bedroom_boutique",
    label: "Boutique hotel szoba",
    description: "Boutique hotel room, rich dark walls, dramatic moody lighting, velvet headboard, layered textiles, a single architectural floor lamp casting warm amber light.",
  },
  {
    key: "office_home",
    label: "Otthoni iroda",
    description: "Contemporary home office with built-in shelving, a large desk, natural daylight, green plants, a cup of coffee, warm wood accents and white walls.",
  },
  {
    key: "office_corporate",
    label: "Vállalati lobbi",
    description: "Upscale corporate office reception lobby, marble reception desk in the background, high ceilings, subtle ambient lighting, corporate art on walls, polished stone floors.",
  },
  {
    key: "cafe",
    label: "Kávézó / étterem",
    description: "Stylish urban café or bistro interior, exposed brick walls, hanging Edison bulbs, a coffee bar visible in the background, morning light, small tables around, warm inviting atmosphere.",
  },
  {
    key: "hotel_lobby",
    label: "Hotel lobbi",
    description: "Grand hotel lobby with marble floors, a dramatic central floral arrangement, high coffered ceilings, ambient crystal lighting, other seating arrangements visible in the soft background.",
  },
  {
    key: "terrace",
    label: "Terasz / kültér",
    description: "Modern outdoor rooftop terrace, architectural planters with green plants, warm golden-hour sunlight, city skyline visible in the blurred distance, evening ambiance.",
  },
  {
    key: "garden",
    label: "Kert",
    description: "Lush private garden, fresh green lawn, mature trees in the background, soft natural morning light, birds audible, relaxed and peaceful outdoor setting.",
  },
];
