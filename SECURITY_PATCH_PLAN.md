# Security Patch Plan
**Audit Date:** 2026-04-10  
**Last Updated:** 2026-04-21  
**Status:** In Progress (4 of 13 items completed)

---

## IMMEDIATE — Do within 24 hours

### 1. ~~Revoke & rotate exposed credentials (CRITICAL)~~ DONE
The `.env.local` file contains real keys committed to git:
- `SUPABASE_SERVICE_ROLE_KEY` — revoke in Supabase Dashboard → Settings → API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — rotate in Supabase Dashboard
- `GEMINI_API_KEY` (AIzaSyD8UkcbjlLC95u-SOIJivomXtP8KvUqVsg) — revoke in Google Cloud Console

**Then:**
```bash
# Remove from git history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env.local' \
  --prune-empty --tag-name-filter cat -- --all
```
Add `.env.local` to `.gitignore` if not already present.

---

## HIGH PRIORITY — Within 1 week

### 2. ~~Fix IDOR in /api/versions (HIGH)~~ DONE (2026-04-21)
**File:** `src/app/api/versions/route.ts`  
`getProject(projectId)` already filters by `workspace_id` via `getEffectiveWorkspace()`, so cross-tenant access was already blocked. Additionally hardened the error response to return a generic message instead of raw `err.message`.

### 3. ~~Fix prompt injection in /api/agent & /api/refine (HIGH)~~ DONE (2026-04-21)
**Files:** `src/app/api/agent/route.ts`, `src/app/api/refine/route.ts`  
- Added `MAX_MESSAGE_LENGTH = 2000` / `MAX_FEEDBACK_LENGTH = 2000` validation with 400 response
- Replaced raw `err.message` / `err.toString()` with generic error messages in all catch blocks
- Also hardened error responses in `/api/generate-model/route.ts`

### 4. ~~Fix rate limit message mismatch in /api/generate-model (MEDIUM)~~ DONE (2026-04-21)
**File:** `src/app/api/generate-model/route.ts`  
Fixed: message now correctly says "Up to 100 model generations per hour" matching the actual `RATE_LIMIT` of 100.

### 5. Replace in-memory rate limiting with persistent store (HIGH)
**Files:** `src/app/api/generate/route.ts`, `src/app/api/generate-model/route.ts`  
Use Supabase or Upstash Redis instead of `Map<string, ...>` which resets on restart and doesn't work across instances.

### 6. Add input validation in /api/settings (MEDIUM)
**File:** `src/app/api/settings/route.ts`  
- Validate `workspaceName` is a string, max 256 chars
- Validate `geminiApiKey` format if provided (must start with `AIza`)
- Use Zod schema instead of manual casting

---

## MEDIUM PRIORITY — Within 2 weeks

### 7. Add security headers (LOW → foundational)
**File:** `next.config.ts`  
```typescript
headers: async () => [{
  source: "/(.*)",
  headers: [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  ],
}]
```

### 8. Add magic byte file type validation (MEDIUM)
**Files:** `src/app/api/generate/route.ts`, `src/app/api/generate-model/route.ts`  
Install `file-type` package and verify actual file signatures alongside MIME type.

### 9. Add audit logging for admin impersonation (MEDIUM)
**File:** `src/app/admin/actions.ts`  
Log `enterWorkspace` calls to an `audit_log` table with admin_id, target_workspace_id, timestamp.

### 10. Return generic errors from API routes (MEDIUM)
**Files:** All routes in `src/app/api/`  
Replace `{ error: err.message }` with `{ error: "Processing failed. Please try again." }` — log full error server-side only.

---

## LOW PRIORITY — Within 1 month

### 11. Add pagination to admin endpoints (LOW)
**Files:** `src/app/admin/page.tsx`, `src/app/admin/workspace/[id]/page.tsx`  
Add `.limit(50)` to all Supabase queries fetching workspaces/projects lists.

### 12. Add rate limiting to /api/projects (LOW)
**File:** `src/app/api/projects/route.ts`  
Reuse the existing rate limiting pattern.

### 13. Remove redundant localStorage session flags (LOW)
**File:** `src/app/(auth)/login/page.tsx`  
`gs-temp-session` and `gs-temp-user` are redundant since Supabase manages auth via httpOnly cookies.

---

## Bug Fixes (from separate audit)

### HIGH — Missing error state in version fetch
**File:** `src/components/studio/GhostStudioTool.tsx`  
`fetchVersions()` silently fails. Add error state and display to user.

### HIGH — Use AbortController instead of boolean flag
**File:** `src/components/studio/ModelStudioTool.tsx`  
Replace `abortRef.current = true` flag with a proper `AbortController` to cancel in-flight requests on unmount.

### MEDIUM — Fix race condition in settings save
**File:** `src/app/studio/settings/page.tsx`  
Debounce or disable button during in-flight PATCH request.

### MEDIUM — Fix hardcoded "hu-HU" locale in date formatting
**Files:** `src/app/admin/page.tsx`, `src/app/studio/page.tsx`  
Use `useLanguage()` to derive locale for `toLocaleDateString()` calls.

### MEDIUM — Fix rate limit message in generate-model
**File:** `src/app/api/generate-model/route.ts`, line 38  
Change "10" → "100" to match actual `RATE_LIMIT` constant.
