import { NextResponse } from "next/server";
import { parseKnowledgeFile, type KnowledgeImportDraft } from "@/lib/knowledge-import";
import { buildStyleProfileFromSources } from "@/lib/mail";
import { readData, writeData } from "@/lib/store";
import type { KnowledgeItem } from "@/lib/types";

const maxUploadBytes = 10 * 1024 * 1024;

function normalizeDrafts(value: unknown): KnowledgeImportDraft[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = item as Record<string, unknown>;
      return {
        title: String(record.title ?? "").trim(),
        question: String(record.question ?? "").trim(),
        answer: String(record.answer ?? "").trim(),
        tags: Array.isArray(record.tags) ? record.tags.map(String).filter(Boolean) : []
      };
    })
    .filter((item) => item.question && item.answer);
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "请选择要导入的文件。" }, { status: 400 });
      }
      if (file.size > maxUploadBytes) {
        return NextResponse.json({ error: "文件不能超过 10 MB。" }, { status: 413 });
      }
      const filename = file.name || "knowledge.txt";
      const extension = filename.toLowerCase().split(".").pop();
      if (!["docx", "eml", "txt", "md", "markdown", "csv", "json"].includes(extension ?? "")) {
        return NextResponse.json({ error: "支持 Word .docx、邮件 .eml、TXT、Markdown、CSV 和 JSON 文件。" }, { status: 415 });
      }
      const drafts = await parseKnowledgeFile(filename, Buffer.from(await file.arrayBuffer()));
      if (!drafts.length) {
        return NextResponse.json({ error: "没有识别出问答内容。请使用“问题/答案”或“Q/A”格式整理文件。" }, { status: 422 });
      }
      return NextResponse.json({ filename, items: drafts, count: drafts.length });
    }

    const payload = await request.json();
    const drafts = normalizeDrafts(payload.items);
    if (!drafts.length) {
      return NextResponse.json({ error: "没有可保存的问答内容。" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const items: KnowledgeItem[] = drafts.map((draft) => ({
      id: crypto.randomUUID(),
      title: draft.title || draft.question.slice(0, 36),
      question: draft.question,
      answer: draft.answer,
      tags: draft.tags,
      enabled: true,
      createdAt: now,
      updatedAt: now
    }));
    const data = await readData();
    data.knowledge = [...items, ...data.knowledge];
    data.styleProfile = buildStyleProfileFromSources(data.examples, data.knowledge, data.styleProfile);
    await writeData(data);
    return NextResponse.json({ imported: items.length, items, styleProfile: data.styleProfile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "文件解析失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
