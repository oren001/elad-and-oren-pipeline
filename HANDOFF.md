# הלווינים — Handoff Brief

Updated: 2026-05-08 (post `9f1c498` — edge-cache fix)

## What this is

A Hebrew RTL group chat app for a 7-person friend group, deployed at
**https://mastulon-chat.pages.dev/**. Branded as "הלווינים". The bot
persona ("המסטולון") has its own lore (smokes 3g/day, dunks on a
character named ערן, etc.).

## Stack

- Next.js 15 (App Router, edge runtime)
- React 19 + Tailwind 3
- Cloudflare Pages (deploys via GitHub Actions → wrangler-action)
- Cloudflare KV for: room messages, profile photos, voice/photo blobs,
  daily counters, presence, push subscriptions, VAPID keys, pending
  image queue
- Leonardo Nano Banana Pro (`gemini-image-2`) for AI image generation
- Web Speech API for live voice transcription (Hebrew)
- Web Push (RFC 8291 aes128gcm, hand-rolled) for true background
  notifications

## Repo layout (active branch)

`claude/deploy-stoner-chatbot-cloudflare-mm22U`

```
src/app/page.tsx                 single-page client (~3000 lines)
src/app/layout.tsx               PWA manifest registration, SW register
src/app/manifest.ts              webmanifest
src/app/icon.tsx + icon1.tsx     dynamic icons
src/app/admin/                   owner-only admin pages (login, approve)
src/app/api/room/                main chat endpoints (send, imagine, react,
                                 photo, voice, edit, delete, system,
                                 heartbeat, finalize)
src/app/api/imagine/             image gen + upload + polling + whoami
src/app/api/photo/[id]           serve photo bytes
src/app/api/voice/[id]           serve voice bytes
src/app/api/user/profile         profile photo upload + serve
src/app/api/user/profiles        all profiles
src/app/api/push/                vapid, subscribe, unsubscribe, test
src/app/api/admin/               login + approve/deny
src/lib/room.ts                  KV-backed message store, presence, daily cap
src/lib/users.ts                 fixed 7-user list + mention parser
src/lib/profiles.ts              KV-backed profile photos
src/lib/leonardo.ts              Leonardo client + init-image upload
src/lib/auto-image.ts            absurd-prompt builder for auto-generated images
src/lib/notify.ts                push notification fan-out on @mention
src/lib/webpush.ts               full VAPID + RFC 8291 web push impl
src/lib/themes.ts                10 themes
src/lib/persona.ts               bot mood detection + reply pool
src/lib/kv.ts                    KV binding helper (getRequestContext)
src/lib/admin.ts                 owner cookie helpers
public/sw.js                     service worker (push handler)
.github/workflows/deploy.yml     CI: builds + writes wrangler.toml from
                                 KV_NAMESPACE_ID secret + deploys
```

## User list (7, fixed)

נטע, איתי, אלעד, פיליפ, מיכל, אורן, ערן

## Required secrets in GitHub Actions

- `CLOUDFLARE_API_TOKEN` — has Pages:Edit + Workers KV Storage:Edit
- `CLOUDFLARE_ACCOUNT_ID` = `b8fd79d133ae52f4b816582b0b147e9e`
- `KV_NAMESPACE_ID` = `90b583f5ef494a67adf444b4573eca7a` (CF Pages KV
  namespace bound at runtime as `MASTULON_KV` via wrangler.toml that
  CI generates per-deploy)
- `LEONARDO_API_KEY` — Leonardo Nano Banana Pro API key
- `OWNER_PASSWORD` — for /admin gated approval pages

## Deploy flow

`git push origin claude/deploy-stoner-chatbot-cloudflare-mm22U` →
GitHub Actions → npm ci → next-on-pages build → write wrangler.toml
with KV binding → `wrangler pages deploy` → live at mastulon-chat.pages.dev.

`?reset=1` query param triggers client-side full state wipe
(localStorage + SW + Cache API).

## Open issue (priority)

**Chat appears "stuck" / messages don't render** on some devices even
though `/api/room` returns 50+ messages correctly when hit directly.
Symptoms: page renders header + composer + empty state, message count
stays at 0 across refreshes for 20+ seconds (user reported up to 12
minutes). Affects at least two users (Oren, Eran).

Things tried:
- KV stale-empty tolerance (don't blow away `prev` on empty response)
- Stale pending image cleanup (mark errored after 5 min)
- Layout rolled back to `min-h-screen` + fixed composer
- SW cache versions bumped through v7
- `?reset=1` panic button + `?t=fresh*` URL cache buster
- Surface fetch errors + attempt count in empty-state UI (`f0cef64`)
- **Latest fix `9f1c498`: defeat CF edge cache** with explicit
  `cache-control: no-store` + `cdn-cache-control: no-store` +
  `cloudflare-cdn-cache-control: no-store` + `pragma: no-cache` on
  `/api/room`; client adds `?t=<now>` cache-buster, 8s AbortController
  timeout, and an inflight guard so a hung fetch can't starve the loop;
  SW v7 wipes all old caches on activate and intercepts `/api/*` GETs
  with `{cache: "no-store"}`; empty state after 3 attempts shows an
  explicit "full reset" button.

After the `9f1c498` push, user reported "Stuck again" — possible causes
still in play: (a) deploy hadn't propagated, (b) the old SW on their
device hadn't been replaced yet (SW activation lags one navigation),
(c) a different root cause we haven't isolated.

User has NOT pasted the on-screen diagnostic text. They keep saying
"stuck" without specifying what the empty-state actually says.

## Recommended first steps for the next agent

1. Re-read `src/app/page.tsx` polling effect and rendering logic
   around `messages.length === 0`
2. Confirm latest deploy is live by visiting `/api/room` and matching
   build SHA in the header badge
3. Get the user to literally type what's on the empty state (the
   diagnostic in commit `f0cef64` will say which failure mode it is)
4. If fetch is succeeding but render is empty: probably a state/prop
   issue — maybe profiles or some race condition with messages array
5. Consider a hard rollback to commit `9d04a74` (Push A: themes +
   search + lightbox + camera + reactions + reply + photos) — last
   confirmed working composite before recent layout/transcription/
   voice churn

## Future work (paused)

- Round 5: search (in repo), voice transcription primary (in repo),
  AI summarize, markdown + link previews, forward to user
- Round 6: Eran cameo bot, scoreboard, anonymous mode, polls, games
- Round 7: streaks, sound on new msg, theme picker improvements,
  birthday reminders, image gallery grid

## Quick health check URLs

- https://mastulon-chat.pages.dev/api/room — should return JSON with
  messages, daily, presence
- https://mastulon-chat.pages.dev/api/push/vapid — should return
  publicKey
- https://mastulon-chat.pages.dev/api/imagine/whoami — should return
  Leonardo account info with `leonardo_status: 200`

## Migration note

If moving to a dedicated repo (e.g., `oren001/halviinim`):
1. Mirror push the current branch as `main`
2. Copy the 5 secrets above
3. Edit `.github/workflows/deploy.yml` to trigger on `main` push
4. Cloudflare Pages project unchanged — same `mastulon-chat.pages.dev`
