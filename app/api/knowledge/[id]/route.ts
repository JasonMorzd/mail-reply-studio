import { NextResponse } from "next/server";
import { buildStyleProfileFromSources } from "@/lib/mail";
import { readData, writeData } from "@/lib/store";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const patch = await request.json();
  const data = await readData();
  const knowledge = data.knowledge.map((item) => item.id === id ? {
    ...item,
    ...patch,
    updatedAt: new Date().toISOString()
  } : item);
  data.knowledge = knowledge;
  data.styleProfile = buildStyleProfileFromSources(data.examples, knowledge, data.styleProfile);
  await writeData(data);
  return NextResponse.json({ item: knowledge.find((item) => item.id === id) ?? null, styleProfile: data.styleProfile });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const data = await readData();
  data.knowledge = data.knowledge.filter((item) => item.id !== id);
  data.styleProfile = buildStyleProfileFromSources(data.examples, data.knowledge, data.styleProfile);
  await writeData(data);
  return NextResponse.json({ ok: true, styleProfile: data.styleProfile });
}
