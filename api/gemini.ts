// Server-side proxy for the web build's Ask-AI / tafsir calls to Google
// Gemini. Used ONLY by web (see src/lib/islamicAi.ts) — native calls Gemini
// directly with its embedded EXPO_PUBLIC_GEMINI_API_KEY, unchanged.
//
// Why this exists: EXPO_PUBLIC_* env vars are inlined into the client bundle.
// That's an acceptable risk for a compiled native binary, but a public
// website ships that bundle in plain text to every visitor — anyone could
// read the key out of it and spend the quota. This function keeps the real
// key server-side, in a plain (non-EXPO_PUBLIC_) Vercel env var.
//
// Deployment: set `GEMINI_API_KEY` in the Vercel project's Environment
// Variables (Project Settings → Environment Variables). Nothing else to
// configure — Vercel deploys any file under /api/ as a serverless/edge
// function automatically, independent of the static Expo web export.
export const config = { runtime: 'edge' };

const GEMINI_ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Server is missing the GEMINI_API_KEY environment variable.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  // `model` is the only field this proxy adds on top of the request body
  // src/lib/islamicAi.ts already builds (systemInstruction/contents/
  // generationConfig) — strip it out before forwarding the rest to Gemini.
  const { model, ...geminiBody } = payload ?? {};
  if (!model || typeof model !== 'string') {
    return new Response('Missing "model"', { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(GEMINI_ENDPOINT(model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(geminiBody),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Forward Gemini's status and body verbatim — the client's existing retry/
  // error handling (429/500/502/503/504, blockReason, MAX_TOKENS, …) already
  // knows how to interpret a real Gemini response and needs no changes here.
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
