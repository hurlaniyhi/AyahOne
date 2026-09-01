# AyahOne — Web / PWA deployment

AyahOne's web version is **not a separate app or codebase** — it's the same
Expo/React Native app, compiled for the browser via Expo's web target
(`react-native-web`, already a dependency). Same screens, same components,
same business logic, same data layer. This file only exists because that
build target needed a few web-only additions (PWA manifest, service worker,
a server-side proxy for one API key) — none of which touch iOS/Android.

## What was added (all additive — nothing native-facing was changed)

- `public/index.html` — the web page shell Expo's exporter uses as a
  template for the SPA build (see `webTemplate.js` in `@expo/cli` if you're
  ever unsure why this file works the way it does: it substitutes
  `%LANG_ISO_CODE%`/`%WEB_TITLE%` and appends the hashed JS bundle's
  `<script>` tag right before `</body>` automatically). Adds the PWA
  manifest link, iOS "Add to Home Screen" meta tags, and service worker
  registration on top of Expo's default template.
- `public/manifest.json`, `public/icons/icon-{192,512}.png`,
  `public/apple-touch-icon.png` — PWA installability. Icons are rendered
  from the same `assets/source/icon.svg` master the native app icons come
  from (see `scripts/build-icons.mjs`, extended to also emit these).
- `public/sw.js` — a minimal service worker: caches the static build output
  (content-hashed, so cache-first is safe) so the installed PWA can relaunch
  offline. It does **not** cache Quran text/audio or any API call — that's
  already handled by the app's own AsyncStorage-based data layer.
- `api/gemini.ts` — a Vercel Edge Function. Read the "Ask-AI key" section
  below; it's the one thing here you must configure before the Ask-AI /
  tafsir features will work on the deployed site.
- `vercel.json` — build command (`expo export --platform web`), output
  directory (`dist`), and a SPA fallback rewrite so client-side routes
  (`/read/2`, etc.) resolve to `index.html` instead of 404ing.
- `src/lib/islamicAi.ts` — one `Platform.OS === 'web'` branch (see below).

## Deploying to Vercel

1. Import this repo into a new Vercel project (vercel.com → Add New →
   Project). Vercel will read `vercel.json` and configure the build
   automatically — no framework preset to pick.
2. **Before the first deploy that needs Ask-AI/tafsir to work**: in the
   Vercel project's Settings → Environment Variables, add:
   - `GEMINI_API_KEY` = your Gemini API key (no `EXPO_PUBLIC_` prefix).
3. Deploy. That's it — `public/` is copied into the static output verbatim,
   and `/api/gemini.ts` deploys as an Edge Function automatically alongside
   the static site.

Once deployed, visiting the site on a phone and using the browser's "Add to
Home Screen" (iOS Safari) / install prompt (Android Chrome) installs it as a
standalone PWA using the manifest/icons above.

### ⚠️ Do NOT set `EXPO_PUBLIC_GEMINI_API_KEY` on Vercel

`EXPO_PUBLIC_*` variables are inlined into the client JS bundle at build
time — that's how the native app gets its key today, and it's an acceptable
risk for a compiled binary. It is **not** an acceptable risk for a public
website: anyone visiting the page could read it straight out of the bundle
and spend your Gemini quota. That's exactly why `api/gemini.ts` exists —
only ever set the server-side `GEMINI_API_KEY` name on Vercel.

### How native stays unaffected

`callGeminiJson()` in `src/lib/islamicAi.ts` branches on `Platform.OS`:
web POSTs to `/api/gemini` (which holds the real key server-side and
forwards to Gemini, returning its response byte-for-byte so all of the
existing retry/error-parsing logic keeps working unmodified); every other
platform calls Gemini directly with `EXPO_PUBLIC_GEMINI_API_KEY`, exactly as
before. The full existing `islamicAi.test.ts` suite (which exercises the
native path) passes unchanged.

## Verified so far

- `npx expo export --platform web` builds cleanly (no errors).
- Every static asset (`index.html`, `manifest.json`, `sw.js`, icons, the JS
  bundle) serves correctly and the bundle is syntactically valid.
- `islamicAi.ts`'s full test suite (15 tests, native path) still passes.

## Not yet verified (needs a real browser / device — outside what I can
check in this environment)

- Visual/interaction fidelity screen-by-screen. `react-native-web` is
  mature and this reuses the exact same components, so it should track
  native closely, but it hasn't been clicked through live.
- **Local audio recording** (recitation practice / hifz mic input) —
  `expo-audio`'s web recording support should work via the browser's
  microphone APIs, but hasn't been exercised here.
- **Scheduled local notifications** (daily goal reminder, Friday Al-Kahf
  reminder) — background-scheduled local notifications are fundamentally
  limited on web/PWA (especially iOS Safari) compared to native. These
  features will likely be degraded or inactive on web; there's no code fix
  for this, it's a platform limitation.
- `expo-haptics` silently no-ops on web (expected/harmless).
- `expo-blur` has web support (CSS `backdrop-filter`) but may not look
  pixel-identical to native.
- First-load size: the bundled JS is ~23.6 MB uncompressed (Vercel serves it
  gzipped/brotli, so actual transfer is far smaller, but this hasn't been
  measured). If first-load time matters, this is the place to look at
  route-based code splitting later — not something this pass attempted.
