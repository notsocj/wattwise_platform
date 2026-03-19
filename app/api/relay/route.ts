import { NextResponse } from 'next/server';

// TODO (Phase 2): Implement MQTT relay command publisher
// This route will publish ON/OFF commands to the ESP32-S3 via MQTT broker
export async function POST() {
  return NextResponse.json(
    { error: 'Not implemented — relay control coming in Phase 2' },
    { status: 501 }
  );
}
