// Islamic Q&A backend powered by Google Gemini's free tier. The system
// instruction is the only guardrail keeping responses scoped to Islam +
// grounded in primary sources; tweaking it changes the assistant's
// behaviour everywhere it's used.
//
// Setup: add `EXPO_PUBLIC_GEMINI_API_KEY=...` to a `.env` at the repo root.
// Expo Router exposes that value to the bundled app via `process.env`.

// gemini-2.0-flash was shut down on 2026-06-01; the recommended replacement
// is gemini-3.5-flash. Same v1beta endpoint, same `x-goog-api-key` header,
// same generationConfig + responseSchema shape, so only the model id changes.
const ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';

// Multi-paragraph system prompt assembled in one place so the prompt is
// auditable. Order matters: identity → scope refusal → source hierarchy →
// citation contract → ikhtilāf handling → safety disclaimer → output shape.
const SYSTEM_PROMPT = [
  'You are an Islamic assistant. Answer only questions related to Islam.',
  "If a question is unrelated to Islam, politely inform the user that you can only assist with Islamic topics, and do not attempt to answer it.",
  '',
  'Authoritative source hierarchy (use in this order, never invent citations):',
  '1. The Qur\u2019an \u2014 cite as "Qur\u2019an Surah:Ayah" (e.g. "Qur\u2019an 2:255").',
  '2. Sahih al-Bukhari and Sahih Muslim \u2014 cite as "Sahih al-Bukhari, Hadith #" or "Sahih Muslim, Hadith #".',
  '3. The other authentic Sunan collections: Abu Dawud, al-Tirmidhi, al-Nasa\u2019i, Ibn Majah, Muwatta Malik, Musnad Ahmad.',
  '4. Rulings from the four established Sunni schools (Hanafi, Maliki, Shafi\u2019i, Hanbali) and well-known classical scholars (al-Nawawi, Ibn Taymiyyah, Ibn Kathir, etc.).',
  '5. Contemporary fatwa councils (AMJA, European Council for Fatwa and Research, IslamQA, Dar al-Ifta of Egypt) where classical sources are silent.',
  '',
  'Citation contract:',
  '- Every factual claim about Islamic ruling, belief, or practice MUST be supported by at least one reference from the hierarchy above.',
  '- Quote the source briefly when it adds clarity; otherwise just cite it.',
  '- Never fabricate verse numbers, hadith numbers, or scholar attributions. If you are uncertain about a specific number or wording, say so and cite the source by name only.',
  '',
  'Scholarly differences (ikhtilaf):',
  '- Many issues have multiple valid opinions. When that is the case, present the major positions side by side, attribute them to their schools/scholars, and note which is the majority view if one exists.',
  '- Do not present one madhhab as the only correct view unless there is genuine consensus (ijma\u2019).',
  '',
  'Tone & safety:',
  '- Be respectful, humble, and clear. Use simple English unless the user writes in another language, in which case match their language.',
  '- Never issue a binding fatwa. Frame answers as educational explanations of what scholars have said.',
  '- For sensitive personal matters (divorce, inheritance shares, complex worship makeups, medical issues), explicitly recommend consulting a qualified local scholar in addition to your answer.',
  '- Refuse politely if asked about non-Islamic religions other than to state Islam\u2019s respectful position on them; never disparage other faiths or their followers.',
  '',
  'Output: return STRICT JSON matching the supplied responseSchema. No prose outside the JSON.',
  '- `inScope` is false ONLY when the question has nothing to do with Islam. In that case put the polite refusal in `answer` and leave `references`/`opinions` empty.',
  '- `answer` is the main reply rendered to the user. Write a COMPLETE, self-contained explanation \u2014 never end mid-sentence, mid-list, or with a trailing colon. Use concise paragraphs separated by blank lines; no Markdown headers.',
  '- `references`: at most 5 entries, ordered by relevance. Each entry has `source` (e.g. "Qur\u2019an", "Sahih al-Bukhari", "Sahih Muslim", "Abu Dawud", "Ibn Kathir Tafsir") and `citation` (e.g. "2:255", "Hadith 6018", "Vol. 1, p. 230").',
  '- The `quote` field is optional and must be a SHORT, COMPLETE excerpt (one full sentence or a single clause ending in proper punctuation, max ~25 words). If you cannot fit a complete excerpt, OMIT the `quote` field for that reference \u2014 never emit a quote that ends mid-word, mid-sentence, or with a trailing comma/colon.',
  '- `opinions` is non-empty ONLY when scholars genuinely differ. Each entry names the position holder (e.g. "Hanafi school", "Majority"), summarises the view in one sentence, and lists supporting references the same way.',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    inScope: { type: 'BOOLEAN' },
    answer:  { type: 'STRING' },
    references: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          source:   { type: 'STRING' },
          citation: { type: 'STRING' },
          quote:    { type: 'STRING' },
        },
        required: ['source', 'citation'],
      },
    },
    opinions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          holder:  { type: 'STRING' },
          view:    { type: 'STRING' },
          references: {
            type: 'ARRAY',
            items: { type: 'OBJECT', properties: { source: { type: 'STRING' }, citation: { type: 'STRING' } }, required: ['source', 'citation'] },
          },
        },
        required: ['holder', 'view'],
      },
    },
  },
  required: ['inScope', 'answer', 'references', 'opinions'],
} as const;

export interface AskReference { source: string; citation: string; quote?: string; }
export interface AskOpinion   { holder: string; view: string; references?: AskReference[]; }
export interface AskAnswer {
  inScope: boolean;
  answer: string;
  references: AskReference[];
  opinions: AskOpinion[];
}

export interface AskTurn { role: 'user' | 'model'; text: string; }

// Persisted chat-message shape. `user` messages carry just `text`. `model`
// messages have either a parsed `answer` once the request resolved, or an
// `error` string if it failed, or `pending=true` while in flight. Pending
// messages should never be persisted — they're cleaned up at hydrate time.
export interface AskMsg {
  id: string;
  role: 'user' | 'model';
  text?: string;
  pending?: boolean;
  answer?: AskAnswer;
  error?: string;
  // Raw provider error (HTTP status + Gemini's response body) surfaced as a
  // small subtitle under `error`. Helps diagnose key/quota issues without
  // forcing the user to dig through logs.
  errorDetail?: string;
  // user-message: original question text \u2014 kept on model messages too so the
  // "retry" affordance can re-send the prompt that produced an error.
  prompt?: string;
}

export class IslamicAiError extends Error {
  constructor(message: string, public code: 'no-key' | 'network' | 'http' | 'parse' | 'blocked') { super(message); }
}

export function hasApiKey(): boolean {
  return !!process.env.EXPO_PUBLIC_GEMINI_API_KEY;
}

// Statuses where Gemini's docs explicitly recommend client-side retry:
// 429 (quota), 500/502/504 (gateway), 503 (model overloaded).
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

// Pluggable so tests can neutralise the wall-clock delays. Production uses an
// exponential schedule (~600ms, ~1.4s) with a small jitter to avoid thundering
// herd if multiple users hit a transient overload at once.
export const __retryConfig = {
  maxAttempts: MAX_ATTEMPTS,
  delayMs: (attempt: number) => 600 * Math.pow(2, attempt - 1) + Math.random() * 200,
};

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export async function askIslamicAi(history: AskTurn[]): Promise<AskAnswer> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new IslamicAiError('Missing EXPO_PUBLIC_GEMINI_API_KEY', 'no-key');

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: history.map(turn => ({ role: turn.role, parts: [{ text: turn.text }] })),
    generationConfig: {
      temperature: 0.3,
      topP: 0.9,
      // Gemini 3.5 Flash thinks by default at `medium` level, which silently
      // burns hundreds-to-thousands of output tokens before any answer text
      // is emitted. `minimal` is right for factual Q&A and frees the entire
      // budget for the visible answer + citations.
      thinkingConfig: { thinkingLevel: 'minimal' },
      // Max for Flash. With responseSchema enabled, Gemini will silently
      // truncate strings (while keeping the outer JSON valid) once the
      // budget is exhausted \u2014 so we want as much headroom as the model allows.
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  let lastError: IslamicAiError | undefined;
  for (let attempt = 1; attempt <= __retryConfig.maxAttempts; attempt++) {
    if (attempt > 1) await sleep(__retryConfig.delayMs(attempt - 1));

    let resp: Response;
    try {
      resp = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
      });
    } catch (e) {
      // Network blips (DNS, dropped Wi-Fi) are worth a couple of retries.
      lastError = new IslamicAiError(String((e as Error)?.message ?? e), 'network');
      continue;
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      const err = new IslamicAiError(`HTTP ${resp.status}: ${errText.slice(0, 200)}`, 'http');
      if (RETRYABLE_STATUSES.has(resp.status)) {
        lastError = err;
        continue;
      }
      throw err;
    }

    const json: any = await resp.json().catch(() => null);
    const candidate = json?.candidates?.[0];
    const text: string | undefined = candidate?.content?.parts?.[0]?.text;
    const finishReason: string | undefined = candidate?.finishReason;
    const blockReason: string | undefined = json?.promptFeedback?.blockReason;
    if (blockReason) throw new IslamicAiError(`Blocked: ${blockReason}`, 'blocked');
    // MAX_TOKENS with structured-output is the worst case: Gemini keeps the
    // outer JSON well-formed but silently truncates string fields, so parsing
    // succeeds while the visible answer is cut off mid-sentence. We surface
    // it as a parse error in both the "no text at all" and "text present but
    // budget exhausted" branches so the UI can prompt the user to retry.
    if (finishReason === 'MAX_TOKENS') {
      throw new IslamicAiError('Response truncated (MAX_TOKENS). Try a more specific question.', 'parse');
    }
    if (!text) throw new IslamicAiError('Empty model response', 'parse');
    try {
      // Defensive: some models occasionally wrap structured output in ```json
      // fences despite `responseMimeType: application/json`. Strip them so
      // we don't fail on otherwise-valid JSON.
      const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(cleaned) as AskAnswer;
      return {
        inScope:    !!parsed.inScope,
        answer:     String(parsed.answer ?? '').trim(),
        references: Array.isArray(parsed.references) ? parsed.references : [],
        opinions:   Array.isArray(parsed.opinions) ? parsed.opinions : [],
      };
    } catch {
      // Include a snippet so the error subtitle in the UI shows roughly where
      // parsing failed (helps catch future schema drifts).
      const snippet = text.slice(0, 120).replace(/\s+/g, ' ');
      throw new IslamicAiError(`Could not parse model JSON: ${snippet}\u2026`, 'parse');
    }
  }
  throw lastError ?? new IslamicAiError('Request failed', 'network');
}
