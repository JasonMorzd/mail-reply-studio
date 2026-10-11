import { NextResponse } from "next/server";
import { readData, writeData } from "@/lib/store";
import type { PublicModelSettings } from "@/lib/types";

export async function GET() {
  const data = await readData();
  const settings: PublicModelSettings = {
    provider: data.settings.provider,
    baseUrl: data.settings.baseUrl,
    model: data.settings.model,
    hasApiKey: Boolean(data.settings.apiKey)
  };
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const patch = await request.json();
  const data = await readData();
  data.settings = {
    ...data.settings,
    provider: String(patch.provider ?? data.settings.provider),
    baseUrl: String(patch.baseUrl ?? data.settings.baseUrl),
    model: String(patch.model ?? data.settings.model),
    apiKey: patch.apiKey ? String(patch.apiKey) : data.settings.apiKey
  };
  await writeData(data);
  return NextResponse.json({
    provider: data.settings.provider,
    baseUrl: data.settings.baseUrl,
    model: data.settings.model,
    hasApiKey: Boolean(data.settings.apiKey)
  } satisfies PublicModelSettings);
}
