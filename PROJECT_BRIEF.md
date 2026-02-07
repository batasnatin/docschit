# BATASnatin Docs Chit-Chat — Project Brief

## 1. Overview

BATASnatin Docs Chit-Chat is an AI-powered legal document analysis chat application. Users upload legal documents (PDF, DOCX, TXT, images) or provide URLs, then ask questions analyzed from a formal legal perspective. The AI assistant — named **BATASnatin** — specializes in jurisprudence, statutes, and case law.

The app is a companion to the main [batasnatin.com](https://batasnatin.com) platform and shares its Supabase database for authentication and user profiles.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────┐
│  Frontend (React SPA)                           │
│  Vite + React 19 + TypeScript + Tailwind CSS    │
│  Deployed as static files on Vercel             │
└──────────────────┬──────────────────────────────┘
                   │  fetch /api/*
                   ▼
┌─────────────────────────────────────────────────┐
│  Serverless API (Vercel Functions)              │
│  /api/chat.ts        — AI chat endpoint         │
│  /api/suggestions.ts — Query suggestions        │
│  /api/_utils/auth.ts — Token validation helper  │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
   ┌─────────┐ ┌────────┐ ┌────────┐
   │ Gemini  │ │DeepSeek│ │ OpenAI │
   │(primary)│ │(fb #1) │ │(fb #2) │
   └─────────┘ └────────┘ └────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Supabase (shared with batasnatin.com)          │
│  PostgreSQL + Auth + Row Level Security         │
│  Tables: docschat_conversations,                │
│          docschat_messages, profiles (shared)   │
└─────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.1.0 |
| Language | TypeScript | 5.8.2 |
| Build tool | Vite | 6.2.0 |
| Styling | Tailwind CSS | 3.4.17 |
| Routing | React Router | 7.1.0 |
| Database / Auth | Supabase JS | 2.49.0 |
| AI — Primary | Google GenAI (`gemini-2.5-flash`) | 1.39.0 |
| AI — Fallback 1 | DeepSeek (`deepseek-chat`) via OpenAI SDK | 6.17.0 |
| AI — Fallback 2 | OpenAI (`gpt-4o-mini`) | 6.17.0 |
| PDF parsing | pdfjs-dist | 4.4.171 |
| DOCX parsing | mammoth | 1.8.0 |
| Markdown | marked | 13.0.2 |
| Syntax highlight | highlight.js | 11.9.0 |
| HTML sanitizer | DOMPurify | 3.2.4 |
| Icons | lucide-react | 0.417.0 |
| Serverless runtime | @vercel/node | 5.5.28 |
| Deployment | Vercel | — |

---

## 4. Directory Structure

```
batasnatin-docs-chit-chat/
├── api/                          # Vercel serverless functions
│   ├── chat.ts                   #   POST /api/chat — AI chat
│   ├── suggestions.ts            #   POST /api/suggestions — query ideas
│   └── _utils/
│       └── auth.ts               #   Bearer token validation
├── src/
│   ├── App.tsx                   # Root component, routing
│   ├── index.tsx                 # Entry point
│   ├── index.css                 # Tailwind + CSS variables (themes)
│   ├── types.ts                  # Shared TypeScript types
│   ├── components/
│   │   ├── AuthGuard.tsx         # Route protection
│   │   ├── BrandedHeader.tsx     # Top nav bar
│   │   ├── ChatInterface.tsx     # Main chat area
│   │   ├── ConversationSidebar.tsx # Left sidebar — history
│   │   ├── ErrorBoundary.tsx     # React error boundary
│   │   ├── KnowledgeBaseManager.tsx # URL + file upload
│   │   ├── LoginPage.tsx         # Google OAuth login
│   │   ├── MessageItem.tsx       # Single chat bubble
│   │   ├── ThemeSwitcher.tsx     # Light / dark toggle
│   │   └── UserMenu.tsx          # Avatar dropdown
│   ├── contexts/
│   │   ├── AuthContext.tsx       # Auth state + Google sign-in
│   │   └── ThemeContext.tsx      # Theme state
│   ├── hooks/
│   │   ├── useAuth.ts            # Auth context hook
│   │   ├── useConversations.ts   # Conversation CRUD hook
│   │   └── useTheme.ts           # Theme context hook
│   ├── lib/
│   │   └── supabase.ts           # Supabase client init
│   └── services/
│       ├── chatHistoryService.ts # Supabase conversation/message ops
│       └── geminiService.ts      # Frontend → API layer
├── supabase-migration.sql        # DB schema for docschat tables
├── .env.example                  # Env var template
├── .env.local                    # Local env vars (gitignored)
├── index.html                    # Vite HTML entry
├── package.json
├── vite.config.ts
├── vercel.json                   # Vercel routing + security headers
├── tailwind.config.ts
├── tsconfig.json
└── postcss.config.js
```

---

## 5. Feature Inventory

| Feature | Status | Key files |
|---------|--------|-----------|
| Google OAuth login (PKCE) | Done | `AuthContext.tsx`, `LoginPage.tsx` |
| Shared `profiles` table with batasnatin.com | Done | `AuthContext.tsx` |
| Multi-provider AI chat (Gemini → DeepSeek → OpenAI) | Done | `api/chat.ts` |
| URL context analysis (Gemini only) | Done | `api/chat.ts`, `KnowledgeBaseManager.tsx` |
| PDF / DOCX / TXT / image upload & parsing | Done | `KnowledgeBaseManager.tsx` |
| Conversation persistence (Supabase) | Done | `chatHistoryService.ts`, `useConversations.ts` |
| Conversation sidebar with date grouping | Done | `ConversationSidebar.tsx` |
| Auto-titling from first message | Done | `useConversations.ts` |
| Query suggestions from knowledge base | Done | `api/suggestions.ts`, `ChatInterface.tsx` |
| Markdown rendering + syntax highlighting | Done | `MessageItem.tsx` |
| Dark / light theme with persistence | Done | `ThemeContext.tsx`, `ThemeSwitcher.tsx` |
| Responsive layout (mobile sidebar) | Done | `ChatInterface.tsx`, `ConversationSidebar.tsx` |
| AI safety filters (Gemini) | Done | `api/chat.ts` |
| Security headers (Vercel) | Done | `vercel.json` |
| RLS on all user data tables | Done | `supabase-migration.sql` |
| Error boundary | Done | `ErrorBoundary.tsx` |

---

## 6. Environment Variables

### Client-side (`VITE_` prefix — bundled into frontend)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `VITE_COOKIE_DOMAIN` | Cookie domain (`.batasnatin.com`) |
| `VITE_MAIN_DOMAIN_URL` | Main site URL (`https://batasnatin.com`) |

### Server-side (Vercel Functions only)

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Google Gemini API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `DEEPSEEK_API_KEY` | DeepSeek API key |

Template: `.env.example`

---

## 7. Database Schema

All tables are prefixed with `docschat_` to avoid collisions with the shared batasnatin.com database.

### `docschat_conversations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | `gen_random_uuid()` |
| `user_id` | UUID (FK → auth.users) | CASCADE delete |
| `title` | TEXT | Default `'New Conversation'` |
| `knowledge_group_name` | TEXT | Nullable |
| `created_at` | TIMESTAMPTZ | Default `now()` |
| `updated_at` | TIMESTAMPTZ | Auto-updated via trigger |

### `docschat_messages`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | `gen_random_uuid()` |
| `conversation_id` | UUID (FK) | CASCADE delete |
| `user_id` | UUID (FK → auth.users) | CASCADE delete |
| `text` | TEXT | Message content |
| `sender` | TEXT | `'user'`, `'model'`, or `'system'` |
| `url_context_metadata` | JSONB | Nullable |
| `ai_provider` | TEXT | Nullable |
| `created_at` | TIMESTAMPTZ | Default `now()` |

### Row Level Security

All tables have RLS enabled. Policies restrict SELECT, INSERT, UPDATE, DELETE to `auth.uid() = user_id`.

### Shared table

The `profiles` table (columns: `id`, `email`, `full_name`, `avatar_url`, `tier`) is owned by the main batasnatin.com app. This app reads from it but does not create or migrate it.

---

## 8. Auth Flow

1. User clicks **Sign in with Google** on `/login`.
2. `supabase.auth.signInWithOAuth({ provider: 'google' })` redirects to Google.
3. Google redirects back to `/auth/callback` with auth code.
4. Supabase exchanges code for session tokens via PKCE flow.
5. `AuthContext` detects session via `onAuthStateChange`, fetches the user's `profiles` row.
6. All API calls include `Authorization: Bearer <access_token>`.
7. Serverless functions validate the token with `supabase.auth.getUser(token)` (`api/_utils/auth.ts`).
8. On sign-out, `supabase.auth.signOut()` clears session.

---

## 9. AI Provider Fallback Chain

```
Request arrives at /api/chat or /api/suggestions
    │
    ├─► tryGemini()   — gemini-2.5-flash
    │     ├─ Success → return response (provider: 'gemini')
    │     └─ Failure → continue
    │
    ├─► tryDeepSeek()  — deepseek-chat via OpenAI SDK
    │     ├─ Success → return response (provider: 'deepseek')
    │     └─ Failure → continue
    │
    └─► tryOpenAI()    — gpt-4o-mini
          ├─ Success → return response (provider: 'openai')
          └─ Failure → return 500 with all error details
```

- **Gemini** supports multimodal input (images, file parts, URL context tool).
- **DeepSeek / OpenAI** receive text-only context (file text appended to prompt).
- Max tokens for DeepSeek and OpenAI: 4096.

---

## 10. Security Measures

| Measure | Where |
|---------|-------|
| PKCE OAuth flow | `supabase.ts` — `flowType: 'pkce'` |
| Bearer token validation on all API routes | `api/_utils/auth.ts` |
| Row Level Security on all tables | `supabase-migration.sql` |
| POST-only API endpoints | `api/chat.ts`, `api/suggestions.ts` |
| HTML sanitization (DOMPurify) | `MessageItem.tsx` |
| Gemini safety settings (BLOCK_MEDIUM_AND_ABOVE) | `api/chat.ts` |
| `X-Content-Type-Options: nosniff` | `vercel.json` |
| `X-Frame-Options: DENY` | `vercel.json` |
| `Referrer-Policy: strict-origin-when-cross-origin` | `vercel.json` |
| File type & size validation (1.5 MB limit) | `KnowledgeBaseManager.tsx` |
| URL count limit (20) and file count limit (5) | `KnowledgeBaseManager.tsx` |
| `.env.local` gitignored | `.gitignore` |

---

## 11. Deployment Checklist

1. Set all environment variables in Vercel project settings (see Section 6).
2. Run `supabase-migration.sql` on the shared Supabase instance.
3. Register the deploy domain in Supabase Auth → Google provider → Authorized redirect URIs.
4. Add deploy domain to Supabase Auth → URL Configuration → Redirect URLs.
5. Verify the `profiles` table exists (shared with batasnatin.com).
6. Push to the connected Git repository or run `vercel --prod`.
7. Verify Google OAuth callback works on the production URL.
8. Test AI fallback chain by sending a chat message.

---

## 12. Known Limitations

- **No streaming responses** — messages appear only after the full AI response is received.
- **No rate limiting** — serverless functions have no per-user throttle.
- **PDF.js worker loaded from CDN** — `esm.sh` is used at runtime; a CDN outage breaks PDF parsing.
- **All conversations loaded at once** — no pagination; may be slow for heavy users.
- **DeepSeek / OpenAI lose multimodal context** — images and URL context are only supported by Gemini.
- **No conversation search** — users must scroll through the sidebar to find old chats.
- **No message export** — conversations cannot be downloaded as PDF or text.
- **`profiles` table dependency** — if the table doesn't exist, `AuthContext` fails silently.
- **Env var validation absent** — missing `VITE_SUPABASE_URL` creates a broken Supabase client with no error.
- **Error responses may leak provider details** — the 500 response in `api/chat.ts` includes raw error messages from providers.
- **No request timeout** — `geminiService.ts` fetch calls have no explicit timeout; they rely on Vercel's function timeout (default 10s on Hobby, 60s on Pro).
