// Fetches the app's DEFAULT reading combo (Uthmani Arabic + Saheeh
// International translation + Latin transliteration) from the quran.com API v4
// and writes the per-surah JSON files this app bundles for full offline reading
// on first launch, then regenerates the require-map manifest.
//
// Only the default combo is bundled — other scripts/translations remain
// download-on-demand (handled at runtime by precacheAllSurahs). Re-run this
// script to refresh the bundled data.
//
// Usage:
//   node scripts/build-offline-quran.mjs
//
// Output per-surah shape (src/data/offlineQuran/<surah>.json) mirrors the app's
// SurahContent type exactly so getSurahContent can return it as-is:
//   {"number":1,"ayahs":[{"numberInSurah":1,"arabic":"…","translation":"…",
//                         "transliteration":"…","page":1}, …]}

import fs from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DATA_DIR = path.join(ROOT, 'src', 'data', 'offlineQuran');
const MANIFEST_PATH = path.join(ROOT, 'src', 'data', 'offlineQuranManifest.ts');

// quran.com API v4 resource ids for the app's DEFAULT combo. The Arabic is the
// endpoint's Uthmani text (text_uthmani); Saheeh International (20) is the
// default translation and Transliteration (57) the default transliteration.
// The bundled data is only valid for this exact combo — see getSurahContent.
const SAHEEH_ID = 20;
const TRANSLITERATION_ID = 57;
const TOTAL = 114;

// Minimal JSON GET over https so the script runs on Node versions without a
// global fetch (this repo's tooling targets Node 16).
function getJson(url) {
  return new Promise((resolve, reject) => {
    // A User-Agent is required — the API resets connections (ECONNRESET) for
    // requests without one. gzip keeps the ~4 MB whole-Quran payloads small.
    const options = {
      headers: {
        'User-Agent': 'AyahOne-offline-quran-build',
        Accept: 'application/json',
      },
    };
    https.get(url, options, res => {
      const { statusCode } = res;
      if (statusCode !== 200) {
        res.resume();
        reject(new Error(`Request failed: ${url} → ${statusCode}`));
        return;
      }
      res.setEncoding('utf8');
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// GET with a few retries + backoff to ride out transient network hiccups
// across the ~250 requests a full build makes.
async function getJsonRetry(url) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await getJson(url);
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// Saheeh International translation carries inline footnote markup
// (<sup foot_note=…>N</sup>); drop each footnote element *including its inner
// digit* so the bundled text matches the app's on-demand source (alquran.cloud's
// en.sahih, which has no footnote numbers), then strip any remaining tags and
// decode the handful of HTML entities that appear so the text is plain.
function stripHtml(s) {
  return String(s)
    .replace(/<sup[^>]*>.*?<\/sup>/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Pulls every verse of a surah from quran.com in one paginated pass, with the
// Uthmani text, Madinah-mushaf page number, and both translation resources
// (Saheeh International + transliteration) aligned per verse.
async function fetchChapterVerses(surah) {
  const out = [];
  let page = 1;
  for (;;) {
    const url =
      `https://api.quran.com/api/v4/verses/by_chapter/${surah}` +
      `?fields=text_uthmani,page_number` +
      `&translations=${SAHEEH_ID},${TRANSLITERATION_ID}` +
      `&per_page=50&page=${page}`;
    const json = await getJsonRetry(url);
    const batch = json?.verses;
    if (!Array.isArray(batch)) throw new Error(`Malformed verses payload for surah ${surah}`);
    out.push(...batch);
    if (!json.pagination || json.pagination.next_page == null) break;
    page = json.pagination.next_page;
  }
  return out;
}

async function buildData() {
  await fs.rm(DATA_DIR, { recursive: true, force: true });
  await fs.mkdir(DATA_DIR, { recursive: true });

  const written = [];
  let totalAyahs = 0;
  for (let surah = 1; surah <= TOTAL; surah++) {
    const verses = await fetchChapterVerses(surah);
    const ayahs = verses.map(v => {
      const tr = (v.translations ?? []).find(t => t.resource_id === SAHEEH_ID);
      const tl = (v.translations ?? []).find(t => t.resource_id === TRANSLITERATION_ID);
      return {
        numberInSurah: Number(v.verse_key.split(':')[1]),
        arabic: v.text_uthmani,
        translation: stripHtml(tr?.text ?? ''),
        transliteration: stripHtml(tl?.text ?? ''),
        page: v.page_number,
      };
    });
    const content = { number: surah, ayahs };
    await fs.writeFile(path.join(DATA_DIR, `${surah}.json`), JSON.stringify(content));
    written.push(surah);
    totalAyahs += ayahs.length;
    if (surah % 10 === 0 || surah === TOTAL) console.log(`  …surah ${surah}/${TOTAL}`);
  }

  console.log(`Wrote ${written.length} surah file(s) (${totalAyahs} ayahs) → ${path.relative(ROOT, DATA_DIR)}`);
  return written;
}

async function regenerateManifest(surahNumbers) {
  const entries = surahNumbers
    .map(n => `  ${n}: () => require('./offlineQuran/${n}.json') as SurahContent,`)
    .join('\n');

  const body = `// AUTO-GENERATED by scripts/build-offline-quran.mjs — do not hand-edit.
// Bundled default reading combo (Uthmani + Saheeh International + Latin
// transliteration) so first-time users can read the whole Qur'an fully
// offline. Regenerate with: node scripts/build-offline-quran.mjs
import type { SurahContent } from './quranApi';

export const OFFLINE_QURAN_MODULES: Partial<Record<number, () => SurahContent>> = {
${entries}
};
`;

  await fs.writeFile(MANIFEST_PATH, body);
  console.log(`Regenerated ${path.relative(ROOT, MANIFEST_PATH)} (${surahNumbers.length} surah(s))`);
}

async function main() {
  const surahNumbers = await buildData();
  await regenerateManifest(surahNumbers);
}

main().catch(e => {
  console.error('Offline Quran data build failed:', e);
  process.exit(1);
});
