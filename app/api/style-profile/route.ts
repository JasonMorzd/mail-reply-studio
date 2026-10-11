import { NextResponse } from "next/server";
import { readData, updateStyleProfile } from "@/lib/store";

export async function GET() {
  const data = await readData();
  return NextResponse.json(data.styleProfile);
}

export async function PATCH(request: Request) {
  const profile = await request.json();
  const data = await updateStyleProfile(profile);
  return NextResponse.json(data.styleProfile);
}
