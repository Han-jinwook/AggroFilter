import { NextResponse } from 'next/server';
import { standardizeTopic } from '@/lib/gemini';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const inputTopic = searchParams.get('topic');
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

  if (!inputTopic) {
    return NextResponse.json({ error: "Missing 'topic' query parameter" }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ error: "API Key not configured" }, { status: 500 });
  }

  try {
    const result = await standardizeTopic(inputTopic, apiKey);
    return NextResponse.json({
      input: inputTopic,
      ...result
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
