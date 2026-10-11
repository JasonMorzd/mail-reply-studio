import { NextResponse } from "next/server";
import { buildStyleProfile, parseCsv, parseJson, parsePlainText } from "@/lib/mail";
import { readData, updateExamples, updateStyleProfile } from "@/lib/store";

export async function POST(request: Request) {
  const { filename = "", content = "", preview = false, examples: editedExamples } = await request.json();
  if (!String(content).trim()) return NextResponse.json({ error: "导入内容为空。" }, { status: 400 });

  try {
    const extension = String(filename).split(".").pop()?.toLowerCase();
    const parsed = extension === "json"
      ? parseJson(String(content))
      : extension === "csv"
        ? parseCsv(String(content))
        : [parsePlainText(String(content))];
    const imported = Array.isArray(editedExamples) ? editedExamples : parsed;
    if (!imported.length) return NextResponse.json({ error: "没有识别出可用的邮件内容。" }, { status: 400 });
    if (preview) return NextResponse.json({ imported: imported.length, examples: imported });
    const data = await readData();
    const examples = [...data.examples, ...imported];
    const styleProfile = buildStyleProfile(examples, data.styleProfile);
    await updateExamples(examples);
    await updateStyleProfile(styleProfile);
    return NextResponse.json({ imported: imported.length, examples, styleProfile });
  } catch {
    return NextResponse.json({ error: "文件格式无法解析，请检查内容后重试。" }, { status: 400 });
  }
}
