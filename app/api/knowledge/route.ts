import { NextResponse } from "next/server";
import { buildStyleProfileFromSources } from "@/lib/mail";
import { readData, writeData } from "@/lib/store";
import type { KnowledgeItem } from "@/lib/types";

export async function GET() {
  const data = await readData();
  return NextResponse.json(data.knowledge);
}

export async function POST(request: Request) {
  const input = await request.json();
  const question = String(input.question ?? "").trim();
  const answer = String(input.answer ?? "").trim();
  if (!question || !answer) {
    return NextResponse.json({ error: "问题和答案不能为空。" }, { status: 400 });
  }
  const now = new Date().toISOString();
  const item: KnowledgeItem = {
    id: crypto.randomUUID(),
    title: String(input.title ?? "").trim() || question.slice(0, 36),
    question,
    answer,
    tags: Array.isArray(input.tags) ? input.tags.map(String).filter(Boolean) : [],
    enabled: input.enabled !== false,
    createdAt: now,
    updatedAt: now
  };
  const data = await readData();
  data.knowledge = [item, ...data.knowledge];
  data.styleProfile = buildStyleProfileFromSources(data.examples, data.knowledge, data.styleProfile);
  await writeData(data);
  return NextResponse.json({ item, styleProfile: data.styleProfile }, { status: 201 });
}
