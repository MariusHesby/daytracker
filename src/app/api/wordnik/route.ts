import { NextRequest, NextResponse } from 'next/server';

const WORDNIK_API_KEY = process.env.WORDNIK_API_KEY || '';

export async function GET(request: NextRequest) {
  if (!WORDNIK_API_KEY) {
    return NextResponse.json({ error: 'Wordnik API key not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date'); // yyyy-MM-dd

  const url = new URL('https://api.wordnik.com/v4/words.json/wordOfTheDay');
  url.searchParams.set('api_key', WORDNIK_API_KEY);
  if (date) {
    url.searchParams.set('date', date);
  }

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      return NextResponse.json({ error: 'Wordnik API error' }, { status: response.status });
    }

    const data = await response.json();
    const word = data.word || '';
    const firstDef = data.definitions?.[0];
    const definition = firstDef?.text || '';
    const partOfSpeech = firstDef?.partOfSpeech || '';

    return NextResponse.json({ word, definition, partOfSpeech });
  } catch (error) {
    console.error('Wordnik API error:', error);
    return NextResponse.json({ error: 'Failed to fetch word of the day' }, { status: 500 });
  }
}
