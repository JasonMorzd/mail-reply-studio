import { NextResponse } from "next/server";
import { readData, updateIdentityProfile } from "@/lib/store";

export async function GET() {
  const data = await readData();
  return NextResponse.json(data.identityProfile);
}

export async function PATCH(request: Request) {
  const profile = await request.json();
  const data = await updateIdentityProfile(profile);
  return NextResponse.json(data.identityProfile);
}
