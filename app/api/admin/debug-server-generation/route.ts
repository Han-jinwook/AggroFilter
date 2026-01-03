import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getEmbeddingRest(text: string, apiKey: string, title?: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_DOCUMENT",
      title: title || text
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.embedding.values;
}

export async function GET() {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API Key" });

  try {
    // Scenario 1: AI Topics (Problematic)
    const k1 = "AI 농업";
    const k2 = "AI 전망";
    
    // Test A: With Title (Current Logic)
    const vA1 = await getEmbeddingRest(k1, apiKey, k1);
    const vA2 = await getEmbeddingRest(k2, apiKey, k2);
    const sameA = vA1.every((val: number, i: number) => val === vA2[i]);

    // Test B: Without Title
    const vB1 = await getEmbeddingRest(k1, apiKey); // getEmbeddingRest handles undefined title
    const vB2 = await getEmbeddingRest(k2, apiKey);
    const sameB = vB1.every((val: number, i: number) => val === vB2[i]);

    // Test C: SEMANTIC_SIMILARITY taskType (Modify getEmbeddingRest temporarily or just trust me, I'll stick to A/B first)
    // actually let's modify the helper slightly to allow taskType override if needed, but for now let's just see A vs B.

    return NextResponse.json({
      test_topics: [k1, k2],
      with_title: { identical: sameA, v1_sample: vA1.slice(0,5) },
      without_title: { identical: sameB, v1_sample: vB1.slice(0,5) },
    });

  } catch (error) {
    return NextResponse.json({ error: String(error) });
  }
}
