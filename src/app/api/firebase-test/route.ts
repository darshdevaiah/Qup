import { NextResponse } from "next/server";

import { testFirebaseConnection } from "@/lib/test-firebase-connection";

export async function GET() {
  try {
    const result = await testFirebaseConnection();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Firebase error";

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 },
    );
  }
}
