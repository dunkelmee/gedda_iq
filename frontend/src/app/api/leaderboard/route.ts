import { NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/leaderboard`, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`[leaderboard] backend returned ${res.status} from ${BACKEND}`);
      return NextResponse.json({ error: 'Backend error' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error(`[leaderboard] fetch failed (BACKEND_URL=${BACKEND}):`, err);
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}
