import { useAppStore } from '@/store/appStore';
import { clearPrecacheFlag, isPrecached, precacheAllSurahs, warmMemoryCache } from '@/data/quranApi';

// Treat a flagged-but-undersized cache as stale and trigger a re-download.
// Anything under this threshold means an earlier precache crashed mid-write
// (or AsyncStorage was partially cleared) and search would silently miss
// most surahs without ever recovering.
const PRECACHE_MIN_OK = 110;

export async function bootstrapQuranCache(): Promise<void> {
  const { translationId: translation, arabicScript: script } = useAppStore.getState().settings;
  const setPrecache = useAppStore.getState().setPrecache;
  const warmed = await warmMemoryCache(translation, script);
  const flagged = await isPrecached(translation, script);
  // Healthy cache: flag set AND payload count looks complete. Sync the
  // Settings card to reality (post-restart precache state is zeroed by default).
  if (flagged && warmed >= PRECACHE_MIN_OK) {
    setPrecache({ loaded: warmed, total: 114, running: false, error: null });
    return;
  }
  // Flag claims "cached" but the underlying data is gone/short — purge the
  // flag so the bulk download below isn't short-circuited again next time.
  if (flagged) await clearPrecacheFlag(translation, script);
  setPrecache({ running: true, loaded: warmed, total: 114, error: null });
  try {
    await precacheAllSurahs(translation, (p) => {
      setPrecache({ loaded: p.loaded, total: p.total, running: !p.done, error: p.error ?? null });
    }, script);
  } catch (e) {
    // If the user already has a usable offline cache from a previous run,
    // the bulk refresh failing is non-fatal — swallow it silently so the
    // home screen doesn't sprout a scary red banner. Otherwise surface the
    // error so the dismissible banner can offer a Retry.
    if (warmed >= PRECACHE_MIN_OK) {
      setPrecache({ running: false, loaded: warmed, total: 114, error: null });
    } else {
      setPrecache({ running: false, error: String((e as Error)?.message ?? e) });
    }
  }
}
