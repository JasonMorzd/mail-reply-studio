import { NextResponse } from "next/server";
import { readData, updateExamples } from "@/lib/store";

export async function GET() {
  const data = await readData();
  return NextResponse.json(data.examples);
}

export async function PATCH(request: Request) {
  const patch = await request.json();
  const data = await readData();
  const id = String(patch.id ?? "");
  const examples = data.examples.map((example) => example.id === id ? {
    ...example,
    ...patch,
    updatedAt: new Date().toISOString()
  } : example);
  await updateExamples(examples);
  return NextResponse.json(examples.find((example) => example.id === id) ?? null);
}
