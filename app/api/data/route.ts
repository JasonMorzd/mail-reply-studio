import { NextResponse } from "next/server";
import { resetData } from "@/lib/store";

export async function DELETE() {
  await resetData();
  return NextResponse.json({ ok: true });
}
