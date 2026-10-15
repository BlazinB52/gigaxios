import { NextResponse } from "next/server";

// GigAxios is free. Checkout is permanently disabled so no one can be billed.
export async function POST() {
  return NextResponse.json(
    { error: "GigAxios is free. Subscriptions are no longer offered." },
    { status: 410 }
  );
}
