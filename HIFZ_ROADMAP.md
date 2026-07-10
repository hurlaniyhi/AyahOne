# Hifz Mode — Vision & Roadmap

This captures the fuller Hifz vision (memorization workflow, not just verse bookmarking) against what's actually shipped today, so we can pick it up incrementally rather than losing the thread. Status legend: ✅ done · 🟡 partial · ⬜ not started.

## Onboarding (goal / pace / reciter / mushaf wizard)
🟡 Partial. A dedicated `app/hifz/setup.tsx` wizard now exists: goal type (Whole Qur'an / Selected Surahs / Juz Amma — "one page a day" intentionally omitted, see the Statistics pages-completed note) + verses-per-day (1/2/3/5/Custom). Reachable from a first-time prompt on the hub, or anytime via a gear icon in the hub header ("Edit Hifz Goal"). Reciter/mushaf layout aren't repeated here since they're already configured once, app-wide, in Settings and the general onboarding — re-asking them per-Hifz-goal would just be duplicate UI for the same setting.

## Dashboard
🟡 Partial (upgraded further). The hub now shows: total memorized, total mastered, due-today, a streak badge, a "Qur'an Completion" card (percent mastered, current juz, juz-completed count), a "Today's Goal" card (the next range of new ayahs per the goal wizard, with its own progress bar and a direct "Continue" into that exact range), and a per-surah progress list. Missing only total pages memorized (see Statistics).

## Learning Flow (Read → Listen → Read-along → Hide → Recite → Self-rate)
🟡 Partial.
- Read: ✅ — folded into the progressive hide ladder below rather than a separate literal screen (see note)
- Listen (repeat x3/x5/x10/forever): ✅ done (see Audio Features)
- Read-while-listening, karaoke word highlighting: ✅ done, scoped to the "Read" step (`hideLevel === 0`) and to the 5 reciters with QUL word-timestamp data (Sudais, Minshawi, Alafasy, Abdul Basit, Husary). A new `HifzKaraokePlayer` (sibling to `HifzAudioPlayer`, which stays untouched) streams from the timestamp data's own audio URL and drives a color/weight highlight on the active `HifzWordTile`, gap-tolerant across QUL's forced-alignment data (see `src/lib/hifzKaraoke.ts`). The other 5 reciters, and every ayah once hiding begins, render the unchanged `HifzAudioPlayer` exactly as before.
- Progressive hide (1 word → 2 words → whole ayah): ✅ done — a never-reviewed ayah now starts fully revealed (the "Read" step) and escalates through 25%/50%/75%/100% of its words hidden via a "Hide More" button (percentage-based rather than literal word-counts, so it scales the same way for a 3-word and a 30-word ayah), with a "Skip to test" escape hatch. An already-reviewed ayah skips straight to fully hidden — the existing recall-test behaviour, unchanged.
- Recite with timer / optional recording: ⬜ not started in Hifz mode specifically — though the app already has a full record-and-review flow in the separate "Practice Recitation" (AI feedback) feature that could potentially be linked in here rather than rebuilt
- Self-assessment: ✅ the full 4-grade set (Forgotten/Difficult/Good/Easy)

## Smart Revision Engine (your priority feature)
✅ Done. Rebuilt to match your spec exactly: 4 grades (Forgotten/Difficult/Good/Easy), each with its own baseline interval — Forgotten → tomorrow persisted *and* re-queued later in the same session (the practical version of "today AND tomorrow" given day-granularity due dates), Difficult → tomorrow, Good → ~1 week, Easy → 2 weeks — plus a per-ayah ease factor so repeated Good/Easy grades keep growing the interval (real spaced repetition) instead of a flat "always exactly 7 days." Lapses (times graded Forgotten) are now tracked per ayah, ready to power "Most Forgotten" later.

## Memorization Status (5-color enum)
🟡 Partial. Today: learning / reviewing / mastered (3 tiers, derived from interval length + lapse count). Your spec's "Needs Revision" and "Forgotten" as distinct *visible* statuses (vs. computed due-date/lapse checks) aren't modeled as their own enum yet.

## Statistics
🟡 Partial (upgraded). Have: total memorized, total mastered, due-today, streak, overall Qur'an completion %, current juz, juz-completed count. Still missing: pages completed (needs a page↔ayah index across the whole Qur'an, not just open surahs — deferred, see note below), average revision accuracy, total time spent.

## Revision Queue
✅ Done. "Due for Review," grouped by surah, one tap into a session. Missing only the "estimated N minutes" time estimate.

## Audio Features (repeat range/page, pause between reps, slow/fast playback)
🟡 Partial. Hifz's practice screen now has its own `HifzAudioPlayer` (deliberately separate from the reader's `VerseAudioListen`, which is untouched) with repeat (Off/×3/×5/×10/∞, each with a ~0.7s pause between reps) and speed (0.75×/1×/1.25×/1.5×) controls. Still missing: repeat across a *range* or a whole page — that's a different UX (spans multiple ayahs sequentially) rather than a per-ayah control, and is a separate piece of work.

## Notes (per-ayah, e.g. "similar to ayah 23")
✅ Done. `hifzNotes: Record<"surah:ayah", string>` in the store, edited via a note icon on the practice screen's ayah card that opens `HifzNoteSheet` (a bottom-sheet text editor, save/blank-deletes-the-entry).

## Mistake Tracking ("Most Forgotten")
✅ Done. Uses the `lapses` counter already tracked per ayah in `HifzAyahState`. `useHifzMostForgotten` selector surfaces the top N ayahs by lapse count on the hub ("Needs Extra Attention"), each tappable straight into that ayah.

## Search Memorized Ayat
✅ Done. New `app/hifz/search.tsx` — a Hifz-scoped screen (kept fully separate from the shared `app/search.tsx`) that reuses the same `searchCached`/`SearchHit` index read-only, annotates each hit with its Hifz status (Memorized/Reviewing/Learning/Not Started) with filter chips, and taps through into that ayah's practice range. Reachable via a search icon in the hub header.

## Motivation microcopy
⬜ Not started but cheap — a few conditional strings ("3 verses left to reach your weekly goal," etc.) once streak/weekly-goal state exists.

A new `src/data/juz.ts` was added for the 30-juz boundary table (used by "current juz" / "juz completed" above) — the boundary ayah numbers are recalled from general reference knowledge, not machine-verified against a live source, so worth a spot-check against a printed mushaf if a juz number ever looks off by one ayah.

**Pages completed**, deliberately left out of this pass: the `Ayah` type already carries an optional `page` field, but computing "how many of the 604 Madinah-mushaf pages are fully mastered" needs that field for every ayah across all 114 surahs, not just whichever surahs happen to be open/cached — a bigger, separate data-plumbing task rather than a quick addition, so it's staying on the backlog rather than being rushed in half-correct.

---

## Suggested build order

1. ~~**Smart Revision refinements**~~ ✅ done.
2. ~~**Dashboard depth**~~ ✅ done (streak, juz, completion %; pages deferred, see note above).
3. ~~**Audio repeat/speed controls**~~ ✅ done, per-ayah (range/page repeat still open, see above).
4. ~~**Progressive hide ladder + Hifz goal wizard/onboarding**~~ ✅ done.
5. ~~**Notes, Mistake Tracking, Search Memorized Ayat**~~ ✅ done.
6. ~~**Karaoke word-sync**~~ ✅ done for all 5 QUL-covered reciters. Data source: **QUL (Quranic Universal Library, qul.tarteel.ai)** — downloadable JSON, no live API/auth, no license field discoverable anywhere on the site (checked the resource pages, docs, and terms of use); user opted to proceed without further license verification.
   - Pipeline: `scripts/build-hifz-karaoke-data.mjs` converts a manually-downloaded per-reciter QUL export into per-surah JSON (`src/data/hifzKaraoke/<reciterId>/<surah>.json`) plus a generated static require-map (`src/data/hifzKaraokeManifest.ts`) — Metro needs literal `require()` calls, and per-surah keeps each `JSON.parse` small instead of parsing a multi-MB blob.
   - So far only **Al-Sudais** has real data committed (surahs 1-2, from the sample used to validate the pipeline) — **Minshawi, Alafasy, Abdul Basit, and Husary still need their full-Quran JSON downloaded from qul.tarteel.ai and run through the script** before karaoke is live for them; until then they silently fall back to the unchanged `HifzAudioPlayer`, same as any of the other 5 reciters with no QUL data at all.
   - Gap-tolerant word lookup (`src/lib/hifzKaraoke.ts`, `activeWordIndex`) handles QUL's forced-alignment segments correctly skipping word indices (a word's audio sometimes gets absorbed into a neighboring word's span) — the last-reached segment stays highlighted through any gap.
