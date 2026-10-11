import { NextResponse } from "next/server";
import { readData, updateExamples } from "@/lib/store";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const data = await readData();
  await updateExamples(data.examples.filter((example) => example.id !== id));
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const patch = await request.json();
  const data = await readData();
  const examples = data.examples.map((example) => example.id === id ? {
    ...example,
    ...patch,
    updatedAt: new Date().toISOString()
  } : example);
  await updateExamples(examples);
  return NextResponse.json(examples.find((example) => example.id === id) ?? null);
}
