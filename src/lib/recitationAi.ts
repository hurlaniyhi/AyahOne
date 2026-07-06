// Tajweed-teacher feedback for a user's spoken recitation of a single ayah,
// powered by the same Gemini backend as Ask AyahOne (see islamicAi.ts).
// Gemini's multimodal `generateContent` endpoint accepts inline base64 audio
// alongside text in the same request — no separate transcription step.

import { callGeminiJson, hasApiKey, IslamicAiError, type GeminiContent } from './islamicAi';
import { parseTajweed, TAJWEED_LABELS, type TajweedRule } from './tajweed';

export { hasApiKey, IslamicAiError };

export type WordStatus = 'correct' | 'mispronounced' | 'missed' | 'unclear';
export type TajweedRuleStatus = 'applied' | 'missed' | 'partial';

export interface WordFeedback {
  word: string;
  status: WordStatus;
  note?: string;
}

export interface TajweedNote {
  rule: TajweedRule;
  status: TajweedRuleStatus;
  note?: string;
}

export interface RecitationFeedback {
  recognizedSpeech: boolean;
  accuracyScore: number;
  summary: string;
  // Concrete, specific mistakes worth calling out — empty when the
  // recitation had none. Surfaced as its own "what to work on" section so
  // the user sees exactly what went wrong without having to tap through
  // every word/rule individually.
  issues: string[];
  words: WordFeedback[];
  tajweedNotes: TajweedNote[];
  encouragement: string;
}

const SYSTEM_PROMPT = [
  'You are a kind, patient Tajweed teacher listening to a student recite a single ayah of the Qur’an aloud.',
  'You will be given the expected Arabic text of the ayah, a list of the tajweed rules present in it, and an audio recording of the student reciting it.',
  '',
  'Task:',
  '- Listen to the audio and compare it word-by-word against the expected Arabic text.',
  '- For each word in the expected text, decide whether the student said it correctly, mispronounced it, missed it entirely (skipped/inaudible), or if it was unclear (background noise, cut off, etc).',
  '- For each tajweed rule listed, judge whether the student’s recitation applied it correctly, missed it, or applied it only partially, based on what you hear (e.g. lengthening a madd, the bounce of a qalqalah letter, a nasal ghunnah).',
  '- If the audio contains no intelligible recitation at all (silence, unrelated speech, wrong ayah entirely), set `recognizedSpeech` to false, `accuracyScore` to 0, leave `words` and `tajweedNotes` empty, and gently explain in `summary` that you could not make out a recitation of this ayah — encourage them to try again in a quiet space.',
  '',
  'Tone:',
  '- Be warm, encouraging, and specific — like a beloved teacher, never harsh or discouraging.',
  '- Praise what was done well before noting what to improve.',
  '- Never be vague. Every non-correct word/rule and every entry in `issues` must name the SPECIFIC thing that was wrong and how to fix it (e.g. "The qalqalah bounce on the ق in this word was too soft — let it bounce more clearly" rather than just "needs work" or "try again").',
  '',
  'Output: return STRICT JSON matching the supplied responseSchema. No prose outside the JSON.',
  '- `accuracyScore` is an integer 0-100 reflecting overall pronunciation + tajweed accuracy.',
  '- `summary` is 1-2 sentences giving the overall verdict. If there were mistakes, name the single most important one here too, not just a generic score comment.',
  '- `issues`: a prioritized list (most important first, at most 5) of the SPECIFIC mistakes found, each one concrete and actionable sentence covering pronunciation and/or tajweed. Empty array ONLY if the recitation was fully correct.',
  '- `encouragement` is one short, warm closing sentence (may reference the effort of practicing recitation).',
  '- Only include a `note` for a word/rule when its status is not the fully-correct/applied state, and make that note specific per the tone rules above.',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    recognizedSpeech: { type: 'BOOLEAN' },
    accuracyScore: { type: 'INTEGER' },
    summary: { type: 'STRING' },
    issues: { type: 'ARRAY', items: { type: 'STRING' } },
    words: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          word: { type: 'STRING' },
          status: { type: 'STRING' },
          note: { type: 'STRING' },
        },
        required: ['word', 'status'],
      },
    },
    tajweedNotes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          rule: { type: 'STRING' },
          status: { type: 'STRING' },
          note: { type: 'STRING' },
        },
        required: ['rule', 'status'],
      },
    },
    encouragement: { type: 'STRING' },
  },
  required: ['recognizedSpeech', 'accuracyScore', 'summary', 'issues', 'words', 'tajweedNotes', 'encouragement'],
} as const;

const WORD_STATUSES: WordStatus[] = ['correct', 'mispronounced', 'missed', 'unclear'];
const RULE_STATUSES: TajweedRuleStatus[] = ['applied', 'missed', 'partial'];

// Derives the unique tajweed rules actually present in an ayah from its
// tajweed-script markup, so the prompt only asks Gemini about rules that
// genuinely occur in this ayah.
export function tajweedRulesIn(tajweedArabic: string): { rule: TajweedRule; label: string }[] {
  const seen = new Set<TajweedRule>();
  for (const seg of parseTajweed(tajweedArabic)) {
    if (seg.rule) seen.add(seg.rule);
  }
  return Array.from(seen).map(rule => ({ rule, label: TAJWEED_LABELS[rule] }));
}

export async function getRecitationFeedback(
  ayahArabicPlain: string,
  rules: { rule: TajweedRule; label: string }[],
  audioBase64: string,
  mimeType: string,
): Promise<RecitationFeedback> {
  const ruleList = rules.length
    ? rules.map(r => `${r.rule}: ${r.label}`).join(', ')
    : 'none';

  const contents: GeminiContent[] = [{
    role: 'user',
    parts: [
      {
        text: [
          `Expected ayah (Arabic): ${ayahArabicPlain}`,
          `Tajweed rules present in this ayah (code: label): ${ruleList}`,
          'Listen to the attached audio recording of the student reciting this ayah and give feedback per the system instructions.',
        ].join('\n'),
      },
      { inlineData: { mimeType, data: audioBase64 } },
    ],
  }];

  const parsed = await callGeminiJson({ systemPrompt: SYSTEM_PROMPT, contents, responseSchema: RESPONSE_SCHEMA });

  const knownRuleCodes = new Set(rules.map(r => r.rule));
  const words: WordFeedback[] = Array.isArray(parsed.words)
    ? parsed.words
        .filter((w: any) => w && typeof w.word === 'string')
        .map((w: any) => ({
          word: w.word,
          status: WORD_STATUSES.includes(w.status) ? w.status : 'unclear',
          note: typeof w.note === 'string' && w.note.trim() ? w.note.trim() : undefined,
        }))
    : [];
  const tajweedNotes: TajweedNote[] = Array.isArray(parsed.tajweedNotes)
    ? parsed.tajweedNotes
        .filter((n: any) => n && knownRuleCodes.has(n.rule))
        .map((n: any) => ({
          rule: n.rule,
          status: RULE_STATUSES.includes(n.status) ? n.status : 'partial',
          note: typeof n.note === 'string' && n.note.trim() ? n.note.trim() : undefined,
        }))
    : [];

  const issues: string[] = Array.isArray(parsed.issues)
    ? parsed.issues.filter((i: any) => typeof i === 'string' && i.trim()).map((i: string) => i.trim()).slice(0, 5)
    : [];

  return {
    recognizedSpeech: !!parsed.recognizedSpeech,
    accuracyScore: Math.max(0, Math.min(100, Math.round(Number(parsed.accuracyScore) || 0))),
    summary: String(parsed.summary ?? '').trim(),
    issues,
    words,
    tajweedNotes,
    encouragement: String(parsed.encouragement ?? '').trim(),
  };
}
