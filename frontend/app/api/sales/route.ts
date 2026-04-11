import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const modalUrl = process.env.MODAL_API_URL;

  if (!modalUrl) {
    // Return empty data with a helpful message when not yet configured
    return NextResponse.json({
      data: [],
      last_sync: '',
      count: 0,
      _warning: 'MODAL_API_URL environment variable is not set. Add it to .env.local and restart.',
    });
  }

  try {
    const res = await fetch(modalUrl);
    if (!res.ok) {
      return NextResponse.json(
        { data: [], last_sync: '', count: 0, _error: `Upstream returned ${res.status}` },
        { status: 200 } // Return 200 so client doesn't throw — it can display the error gracefully
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { data: [], last_sync: '', count: 0, _error: `Failed to reach Modal endpoint: ${message}` },
      { status: 200 }
    );
  }
}
