import { NextResponse } from "next/server";
import { readData, updateKnowledge } from "@/lib/store";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const patch = await request.json();
  const data = await readData();
  const knowledge = data.knowledge.map((item) => item.id === id ? {
    ...item,
    ...patch,
    updatedAt: new Date().toISOString()
  } : item);
  await updateKnowledge(knowledge);
  return NextResponse.json(knowledge.find((item) => item.id === id) ?? null);
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const data = await readData();
  await updateKnowledge(data.knowledge.filter((item) => item.id !== id));
  return NextResponse.json({ ok: true });
}
