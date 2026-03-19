import { NextResponse } from 'next/server';

// TODO (Phase 3): Implement OpenAI Trigger & Cache flow
// 1. Check ai_insights cache (7-day window)
// 2. If miss → aggregate energy_logs → call OpenAI → cache result
// 3. Return Taglish insight message
export async function POST() {
  return NextResponse.json(
    { error: 'Not implemented — AI insights coming in Phase 3' },
    { status: 501 }
  );
}
