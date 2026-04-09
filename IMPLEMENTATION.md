# GhostStudio – Implementation Guide

## Phase 1: Auth + Database ✅

### 1.1 Clerk Setup
1. Create a project at [clerk.com](https://clerk.com)
2. Enable Email/Password + Google SSO in the Clerk dashboard
3. Copy your keys to `.env.local` (see `.env.example`)
4. Clerk handles all auth UI at `/login` and `/signup`
5. `src/proxy.ts` (Next.js 16 "proxy" file) protects all `/studio/*` routes

### 1.2 Supabase Setup
1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `src/lib/supabase/schema.sql`
3. Create two **Storage buckets** in the Supabase dashboard:
   - `ghost-inputs` (private)
   - `ghost-outputs` (private)
4. Configure Storage RLS policies:
   - Users can upload/read only paths starting with their Clerk `userId`
5. Copy your Supabase keys to `.env.local`

### 1.3 Clerk ↔ Supabase JWT
Supabase RLS uses `requesting_user_id()` which reads the `sub` claim from
the JWT. To use this properly with Clerk:
- In **Supabase → Project Settings → API**, note your JWT secret
- In **Clerk → JWT Templates**, create a Supabase template with the secret
  (or use the admin client which bypasses RLS – already done in this app)

> **Current implementation**: All DB operations use the Supabase **service-role
> admin client** server-side, with Clerk auth guarding the Next.js routes.
> This is simpler and equally secure for a single-tenant-per-user model.

---

## Phase 2: UI ✅

### Stack
- **Next.js 16** App Router
- **Tailwind CSS** + **shadcn/ui** + **Radix UI**
- **next-themes** for dark/light mode support (default: light)
- **Lucide React** icons

### Key pages
| Route | File | Notes |
|-------|------|-------|
| `/` | `src/app/page.tsx` | Public landing page |
| `/login` | `src/app/(auth)/login/page.tsx` | Clerk `<SignIn>` |
| `/signup` | `src/app/(auth)/signup/page.tsx` | Clerk `<SignUp>` |
| `/studio` | `src/app/studio/page.tsx` | Dashboard (SSR) |
| `/studio/projects` | `src/app/studio/projects/page.tsx` | Project history (SSR) |
| `/studio/new` | `src/app/studio/new/page.tsx` | Generator tool (client) |
| `/studio/settings` | `src/app/studio/settings/page.tsx` | API key mgmt (client) |

---

## Phase 3: Ghost Mannequin Generator ✅

### Flow
```
User uploads 1-3 images
  → POST /api/generate (FormData)
  → Rate limit check (10/hr per user)
  → Validate files (type, size)
  → Create project record in Supabase
  → Upload images to ghost-inputs bucket
  → Call Gemini 2.5 Flash with images
  → Parse JSON response
  → Update project record (status: completed)
  → Return { result, projectId } to client
```

### AI Module (`src/lib/ai/gemini.ts`)
The AI integration is fully modular. To swap to a different model:
1. Change `MODEL_INFO.id` and the `model` parameter in `analyseGarmentImages()`
2. Or replace the entire file with a different provider (OpenAI, Anthropic, etc.)
   that exports the same `analyseGarmentImages()` function signature

### Gemini API Key Priority
1. Client's own key from workspace settings (encrypted in Supabase)
2. Falls back to `GEMINI_API_KEY` env var (your shared key)

---

## Phase 4: Polish & Production Checklist

### Security
- [x] All API routes check Clerk auth
- [x] Supabase admin client never exposed client-side
- [x] API keys stored in DB, masked in UI
- [x] Rate limiting (in-memory, 10 generations/hour)
- [ ] Upgrade rate limiting to **Upstash Redis** for multi-instance production
- [ ] Add Supabase Storage RLS policies (users can only access their own paths)
- [ ] CSP headers

### Performance
- [ ] Add `<Suspense>` boundaries for SSR data fetching
- [ ] Image optimization with Next.js `<Image>` for output thumbnails
- [ ] Signed URL caching (currently re-signed on every page load)

### Features to add
- [ ] Actual image generation using a diffusion model (DALL-E 3, Stable Diffusion, Ideogram)
  - The current Gemini step produces a **composite prompt** as the deliverable
  - Wire this prompt into an image generation API call in `src/app/api/generate/route.ts`
- [ ] Download generated images from the project view
- [ ] Bulk upload / batch processing
- [ ] Team workspaces (multiple users per workspace)
- [ ] Usage analytics / billing integration (Stripe)
- [ ] Webhook from Clerk to auto-create workspace on user sign-up

---

## Environment Variables

See `.env.example` for all required variables. Copy to `.env.local`:

```bash
cp .env.example .env.local
```

## Development

```bash
npm install
npm run dev        # http://localhost:3000
```

## Deployment (Vercel)

```bash
npx vercel         # follows prompts
```

Add all env vars in the Vercel project settings.
