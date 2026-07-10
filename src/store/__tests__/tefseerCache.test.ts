import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore, hydrateAppStore } from '../appStore';
import type { TefseerResult } from '@/lib/islamicAi';

// Mirrors STORAGE_KEY in appStore.ts (not exported). Kept in sync manually —
// if the persistence key ever changes, this test will fail loudly.
const STORAGE_KEY = 'ayahone:state:v1';

const mk = (summary: string): TefseerResult => ({
  summary,
  context: '',
  reflections: ['reflect'],
  references: [{ source: 'Tafsir Ibn Kathir', citation: '1:1' }],
});

describe('setTefseer (store action)', () => {
  beforeEach(() => {
    useAppStore.setState({ tefseerCache: {} });
  });

  it('stores a result under its surah:ayah:lang key', () => {
    useAppStore.getState().setTefseer('1:1:en', mk('Al-Fatihah 1'));
    expect(useAppStore.getState().tefseerCache['1:1:en']).toEqual(mk('Al-Fatihah 1'));
  });

  it('updates an existing key in place without growing the cache', () => {
    const set = useAppStore.getState().setTefseer;
    set('2:255:en', mk('first'));
    set('2:1:en', mk('other'));
    set('2:255:en', mk('second')); // overwrite existing key
    const cache = useAppStore.getState().tefseerCache;
    expect(Object.keys(cache)).toHaveLength(2);
    expect(cache['2:255:en'].summary).toBe('second');
  });

  it('caps the cache, evicting the oldest entries while keeping the newest', () => {
    const set = useAppStore.getState().setTefseer;
    // Overfill well beyond any reasonable cap so eviction must have kicked in.
    for (let i = 0; i < 500; i++) set(`s:${i}:en`, mk(`ayah ${i}`));
    const cache = useAppStore.getState().tefseerCache;
    const size = Object.keys(cache).length;
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThan(500); // bounded — eviction happened
    // Newest survives, oldest is gone.
    expect(cache['s:499:en']).toBeDefined();
    expect(cache['s:0:en']).toBeUndefined();
  });
});

describe('tefseer cache hydration (sanitizeTefseerCache)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useAppStore.setState({ tefseerCache: {} });
  });

  it('keeps well-formed entries and drops malformed ones on hydrate', async () => {
    const raw = {
      tefseerCache: {
        // valid
        '1:1:en': {
          summary: 'good',
          context: 'a context',
          reflections: ['x', 'y'],
          references: [{ source: 'Ibn Kathir', citation: '1:1' }],
        },
        // valid but with dirty fields to be normalised
        '2:255:en': {
          summary: 'ayat al-kursi',
          context: 42, // wrong type → normalised to ''
          reflections: ['keep', 7, 'also'], // non-strings filtered out
          references: [{ source: 'al-Tabari', citation: '2:255' }],
        },
        // malformed — dropped
        '3:1:en': null,
        '4:1:en': { summary: 123, reflections: [], references: [] }, // summary not string
        '5:1:en': { summary: 'z', reflections: 'nope', references: [] }, // reflections not array
        '6:1:en': { summary: 'w', reflections: [], references: 'nope' }, // references not array
      },
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(raw));

    await hydrateAppStore();

    const cache = useAppStore.getState().tefseerCache;
    expect(Object.keys(cache).sort()).toEqual(['1:1:en', '2:255:en']);
    // Dirty fields on the surviving entry are normalised.
    expect(cache['2:255:en'].context).toBe('');
    expect(cache['2:255:en'].reflections).toEqual(['keep', 'also']);
  });

  it('defaults to an empty cache when nothing is persisted', async () => {
    await hydrateAppStore();
    expect(useAppStore.getState().tefseerCache).toEqual({});
  });

  it('defaults to an empty cache when the persisted value is not an object', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ tefseerCache: 'garbage' }));
    await hydrateAppStore();
    expect(useAppStore.getState().tefseerCache).toEqual({});
  });
});
