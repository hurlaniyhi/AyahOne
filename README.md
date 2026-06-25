# AyahOne

An Expo + React Native Qur'an companion app: read in Uthmani / IndoPak / Tajweed scripts,
track hasanat (rewards) and streaks, search verses, and ask scholarly questions to an
Islamic AI assistant grounded in the Qur'an, the Sunnah, and the classical madhāhib.

## Features

- **Read** the Qur'an in Uthmani, IndoPak, or Tajweed-colored script with adjustable font size.
- **Translations & transliteration** toggles per-user.
- **Hasanat tracking** — 10 rewards per Arabic letter, per the well-known Tirmidhi narration.
- **Streaks & daily goals** with a celebratory modal on goal completion.
- **Search** Arabic text across the whole muṣḥaf.
- **Ask AyahOne** — an Islamic Q&A assistant powered by Google Gemini, with a strict
  source hierarchy (Qur'an → Ṣaḥīḥayn → Sunan → madhāhib → contemporary councils),
  citation enforcement, and explicit handling of scholarly differences (ikhtilāf).
- **i18n**: English, Arabic, French.
- **Themes**: system / light / dark; "Mihrab" palette (Emerald / Parchment / Brass).

## Tech stack

- Expo SDK 54 (New Architecture enabled), Expo Router, React Native 0.81
- React 19, TypeScript 5.9
- Zustand for state (persisted to AsyncStorage)
- Google Gemini (`gemini-3.5-flash` with automatic fallback to `gemini-2.5-flash`)
- Jest + jest-expo for tests

## Prerequisites

- **Node 22** (matches the project's tested toolchain)
- **npm 10+**
- For native builds: an Expo account and the EAS CLI (`npm i -g eas-cli`)
- A **Google Gemini API key** (free tier works) — get one at [Google AI Studio](https://aistudio.google.com/app/apikey)

## Local setup

```bash
# Clone, install
git clone https://github.com/hurlaniyhi/AyahOne.git
cd AyahOne
npm install

# Configure the Gemini key for local dev
echo 'EXPO_PUBLIC_GEMINI_API_KEY=YOUR_KEY_HERE' > .env

# Start Metro
npm run start
```

Then press `a` for Android, `i` for iOS simulator, or scan the QR with Expo Go.

> The `EXPO_PUBLIC_*` prefix is required so the value is inlined into the JS bundle.
> Without the key the **Ask** tab will show a "not configured" notice; the rest of the
> app still works.

## Scripts

| Command | What it does |
|---|---|
| `npm run start` | Expo dev server (offline mode) |
| `npm run android` / `ios` / `web` | Platform-specific dev launchers |
| `npm test` | Jest test suite |
| `npm run icons` | Regenerate app icons from `assets/source` |

## Testing

```bash
npm test
```

Tests cover the Gemini wrapper (retries, model fallback, parsing), hasanat math, tajweed
coloring, and the Qur'an API/cache layer.

## Building with EAS

The project ships an `eas-build-pre-install` hook that **fails the build loudly** if any
required `EXPO_PUBLIC_*` env var is missing on EAS — so a broken APK never gets distributed.

### One-time: register the Gemini key per environment

```bash
eas env:create \
  --environment preview \
  --name EXPO_PUBLIC_GEMINI_API_KEY \
  --value 'YOUR_REAL_KEY' \
  --visibility sensitive --type string
```

Repeat with `--environment development` / `production` as needed. Verify with:

```bash
eas env:list --environment preview
```

### Build

```bash
# Internal-distribution APK for QA
eas build --profile preview --platform android

# Production
eas build --profile production --platform android
eas build --profile production --platform ios
```

Each build profile in `eas.json` is bound to a matching EAS environment (`development`,
`preview`, `production`), so env vars resolve automatically.

> **Note on `EXPO_PUBLIC_*` secrecy**: these values are embedded into the JS bundle in
> clear text. That's acceptable for client-side keys with strict server-side restrictions
> (recommended: lock the Gemini key to the Android package + SHA-1 in Google Cloud Console,
> and set a daily quota). For tighter security, front the API with a small proxy that
> holds the real key server-side.

## Project structure

```
app/                 # Expo Router routes
  (tabs)/            # Home, Reading, Ask, Search, Settings
  read/              # Per-surah reading screen
  settings/          # Sub-routes for theme, language, etc.
src/
  components/        # Reusable UI (cards, tab bar, message bubble, …)
  data/              # Qur'an API client, surah metadata, translations
  i18n/              # English / Arabic / French strings
  lib/               # Hasanat, tajweed, Gemini client, formatters
  store/             # Zustand store (persisted) + selectors
  theme/             # Palette + ThemeProvider (Mihrab identity)
scripts/             # Build-time tooling (icon generation, EAS env guard)
assets/              # Icons, splash, source SVGs
```

## License

See [LICENSE](./LICENSE).
