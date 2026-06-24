import { askIslamicAi, IslamicAiError, hasApiKey, __retryConfig, type AskTurn } from '../islamicAi';

// Skip the real wall-clock backoff between retries so tests stay snappy.
__retryConfig.delayMs = () => 0;

// Snapshot of the env we mutate per-test so each case starts clean.
const ORIGINAL_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

function setKey(v: string | undefined) {
  if (v === undefined) delete (process.env as any).EXPO_PUBLIC_GEMINI_API_KEY;
  else (process.env as any).EXPO_PUBLIC_GEMINI_API_KEY = v;
}

function mockFetchOnce(impl: () => Promise<any> | any) {
  (global as any).fetch = jest.fn().mockImplementation(impl);
  return (global as any).fetch as jest.Mock;
}

function geminiOk(payload: unknown) {
  // Shape that mirrors the real generateContent response: one candidate
  // whose first part carries the JSON-stringified answer.
  return {
    ok: true,
    status: 200,
    text: async () => '',
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
  };
}

const FULL_ANSWER = {
  inScope: true,
  answer: 'The pillars of Islam are five.',
  references: [{ source: 'Sahih al-Bukhari', citation: 'Hadith 8' }],
  opinions: [],
};

const HISTORY: AskTurn[] = [{ role: 'user', text: 'What are the pillars of Islam?' }];

beforeEach(() => {
  setKey('TEST_KEY');
});

afterAll(() => {
  setKey(ORIGINAL_KEY);
});

describe('hasApiKey', () => {
  it('reflects the EXPO_PUBLIC_GEMINI_API_KEY env var', () => {
    setKey('abc');
    expect(hasApiKey()).toBe(true);
    setKey(undefined);
    expect(hasApiKey()).toBe(false);
  });
});

describe('askIslamicAi', () => {
  it('throws no-key when EXPO_PUBLIC_GEMINI_API_KEY is missing', async () => {
    setKey(undefined);
    await expect(askIslamicAi(HISTORY)).rejects.toBeInstanceOf(IslamicAiError);
    setKey(undefined);
    await expect(askIslamicAi(HISTORY)).rejects.toMatchObject({ code: 'no-key' });
  });

  it('returns the parsed AskAnswer on a successful response', async () => {
    mockFetchOnce(async () => geminiOk(FULL_ANSWER));
    const out = await askIslamicAi(HISTORY);
    expect(out).toEqual(FULL_ANSWER);
  });

  it('sends the API key via x-goog-api-key and a JSON body with system + contents + schema', async () => {
    const fetchMock = mockFetchOnce(async () => geminiOk(FULL_ANSWER));
    await askIslamicAi(HISTORY);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('gemini-3.5-flash:generateContent');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['x-goog-api-key']).toBe('TEST_KEY');
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction.parts[0].text).toMatch(/Islamic assistant/i);
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'What are the pillars of Islam?' }] },
    ]);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema.required).toEqual(
      expect.arrayContaining(['inScope', 'answer', 'references', 'opinions']),
    );
  });

  it('coerces missing arrays/fields into safe defaults', async () => {
    mockFetchOnce(async () => geminiOk({ inScope: true, answer: '  hello  ' }));
    const out = await askIslamicAi(HISTORY);
    expect(out).toEqual({ inScope: true, answer: 'hello', references: [], opinions: [] });
  });

  it('throws http error immediately on a non-retryable status (e.g. 400)', async () => {
    const fetchMock = mockFetchOnce(async () => ({
      ok: false,
      status: 400,
      text: async () => 'Invalid argument',
      json: async () => ({}),
    }));
    await expect(askIslamicAi(HISTORY)).rejects.toMatchObject({ code: 'http' });
    // Non-retryable: one call, no backoff loop.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries on transient 503 and resolves once the model returns 200', async () => {
    let calls = 0;
    (global as any).fetch = jest.fn().mockImplementation(async () => {
      calls += 1;
      if (calls < 3) {
        return { ok: false, status: 503, text: async () => 'overloaded', json: async () => ({}) };
      }
      return geminiOk(FULL_ANSWER);
    });
    const out = await askIslamicAi(HISTORY);
    expect(calls).toBe(3);
    expect(out).toEqual(FULL_ANSWER);
  });

  it('gives up after maxAttempts on persistent 503', async () => {
    const fetchMock = mockFetchOnce(async () => ({
      ok: false, status: 503, text: async () => 'overloaded', json: async () => ({}),
    }));
    await expect(askIslamicAi(HISTORY)).rejects.toMatchObject({ code: 'http' });
    expect(fetchMock).toHaveBeenCalledTimes(__retryConfig.maxAttempts);
  });

  it('throws network error when fetch keeps rejecting across all attempts', async () => {
    const fetchMock = mockFetchOnce(async () => { throw new Error('offline'); });
    await expect(askIslamicAi(HISTORY)).rejects.toMatchObject({ code: 'network' });
    expect(fetchMock).toHaveBeenCalledTimes(__retryConfig.maxAttempts);
  });

  it('throws blocked when the response carries a promptFeedback.blockReason', async () => {
    mockFetchOnce(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ promptFeedback: { blockReason: 'SAFETY' } }),
    }));
    await expect(askIslamicAi(HISTORY)).rejects.toMatchObject({ code: 'blocked' });
  });

  it('throws parse error on an empty candidate response', async () => {
    mockFetchOnce(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ candidates: [] }),
    }));
    await expect(askIslamicAi(HISTORY)).rejects.toMatchObject({ code: 'parse' });
  });

  it('throws parse error when the model text is not valid JSON', async () => {
    mockFetchOnce(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }),
    }));
    await expect(askIslamicAi(HISTORY)).rejects.toBeInstanceOf(IslamicAiError);
    // second call: confirm the code is parse — re-mock since fetch was consumed.
    mockFetchOnce(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{bad json' }] } }] }),
    }));
    await expect(askIslamicAi(HISTORY)).rejects.toMatchObject({ code: 'parse' });
  });

  it('strips ```json fences around an otherwise-valid JSON response', async () => {
    const fenced = '```json\n' + JSON.stringify(FULL_ANSWER) + '\n```';
    mockFetchOnce(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ candidates: [{ content: { parts: [{ text: fenced }] } }] }),
    }));
    await expect(askIslamicAi(HISTORY)).resolves.toEqual(FULL_ANSWER);
  });

  it('reports a clear parse error when the candidate finishes with MAX_TOKENS', async () => {
    mockFetchOnce(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({
        candidates: [{
          finishReason: 'MAX_TOKENS',
          content: { parts: [{ text: '{"inScope":true,"answer":"partial' }] },
        }],
      }),
    }));
    await expect(askIslamicAi(HISTORY)).rejects.toMatchObject({
      code: 'parse',
      message: expect.stringMatching(/MAX_TOKENS/),
    });
  });
});
