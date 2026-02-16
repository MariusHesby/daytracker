import { NextRequest, NextResponse } from 'next/server';

const API_BASE = 'https://api.football-data.org/v4';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');
  const token = request.headers.get('x-football-token');

  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint parameter' }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: 'Missing API token' }, { status: 401 });
  }

  // Build the target URL, forwarding all params except 'endpoint'
  const targetUrl = new URL(`${API_BASE}${endpoint}`);
  searchParams.forEach((value, key) => {
    if (key !== 'endpoint') {
      targetUrl.searchParams.set(key, value);
    }
  });

  try {
    const res = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'X-Auth-Token': token,
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('Football proxy error:', err);
    return NextResponse.json({ error: 'Failed to fetch from football-data.org' }, { status: 500 });
  }
}
