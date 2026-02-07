# BATASnatin Docs Chit-Chat — TODO

> Checklist for shipping the app to production. Items are grouped by priority.
> Check off items as you complete them.

---

## A — Critical Blockers

_Must be resolved before any deployment._

- [ ] Replace all placeholder API keys in `.env.local` (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`)
- [ ] Set real Supabase URL and anon key (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — current values are placeholders
- [ ] Run `supabase-migration.sql` on the shared Supabase instance to create `docschat_conversations` and `docschat_messages` tables
- [ ] Verify the `profiles` table exists in Supabase (shared with batasnatin.com) — the app reads `id`, `email`, `full_name`, `avatar_url`, `tier` from it (`src/contexts/AuthContext.tsx`)
- [ ] Register the OAuth callback URL (`https://<deploy-domain>/auth/callback`) in Supabase dashboard → Authentication → Providers → Google
- [ ] Add the deploy domain to Supabase Auth → URL Configuration → Redirect URLs

---

## B — Security Hardening

- [ ] Sanitize error responses in `api/chat.ts` and `api/suggestions.ts` — the 500 response currently includes raw provider error messages in the `details` array; replace with generic messages
- [ ] Add rate limiting to serverless functions (per user, check `profiles.tier`) — currently no throttling on `/api/chat` or `/api/suggestions`
- [ ] Validate and sanitize file content in `api/chat.ts` before forwarding to AI providers — currently the file `text` and `data` fields are passed through without validation
- [ ] Review Supabase anon key permissions in dashboard — ensure the key only allows access to the intended tables and RPC functions

---

## C — Reliability Improvements

- [ ] Bundle the PDF.js worker locally instead of loading from `esm.sh` CDN — see `src/components/KnowledgeBaseManager.tsx` where the worker URL is set; a CDN outage breaks PDF parsing
- [ ] Add env var validation in `src/lib/supabase.ts` — currently `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` can be empty strings, creating a broken Supabase client with no error
- [ ] Add request timeout handling in `src/services/geminiService.ts` — `fetch()` calls have no `AbortController` or timeout; they rely solely on Vercel's function timeout
- [ ] Handle `profiles` table not existing gracefully in `src/contexts/AuthContext.tsx` — if the table is missing, the profile fetch fails silently and `profile` stays `null`

---

## D — UX & Feature Improvements

- [ ] Add conversation search/filter in `src/components/ConversationSidebar.tsx`
- [ ] Add conversation pagination — `chatHistoryService.ts` `getConversations()` loads all conversations at once with no limit
- [ ] Add message virtualization for long conversations in `src/components/ChatInterface.tsx` (e.g., `react-window` or `@tanstack/react-virtual`)
- [ ] Add conversation export (PDF / plain text) — download button per conversation
- [ ] Add typing indicator / streaming responses — currently the full response appears at once after the AI finishes
- [ ] Add file drag-and-drop directly to the chat input area, not just the knowledge base panel (`KnowledgeBaseManager.tsx`)
- [ ] Show toast notifications for errors instead of inline system messages in the chat

---

## E — Accessibility

- [ ] Add focus trap to `UserMenu` dropdown (`src/components/UserMenu.tsx`) — currently focus can escape the open menu
- [ ] Add skip-to-content link in `src/App.tsx` or `BrandedHeader.tsx`
- [ ] Add ARIA live regions (`aria-live="polite"`) for new chat messages in `src/components/ChatInterface.tsx`
- [ ] Ensure all interactive elements have visible focus indicators (check `src/index.css` for `:focus-visible` styles)

---

## F — DevOps & Monitoring

- [ ] Set up Vercel environment variables for production (all vars from `.env.example`)
- [ ] Configure custom domain `chat.batasnatin.com` in Vercel project settings
- [ ] Add error tracking (Sentry or similar) — currently errors are only logged to `console.error`
- [ ] Add basic analytics (Vercel Analytics or PostHog)
- [ ] Set up CI build check (GitHub Actions or Vercel Git integration) — run `npm run build` on PRs

---

## G — Polish

- [ ] Update `README.md` with full setup, development, and deployment instructions — current README is a placeholder from AI Studio
- [ ] Add favicon and Open Graph meta tags in `index.html`
- [ ] Add PWA manifest + service worker for installability
- [ ] Optimize `highlight.js` bundle — `src/components/MessageItem.tsx` imports `highlight.js/lib/core` but registers many languages; import only the languages actually needed
