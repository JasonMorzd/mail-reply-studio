import { NextResponse } from "next/server";
import { parseKnowledgeText, type KnowledgeImportDraft } from "@/lib/knowledge-import";
import { readData } from "@/lib/store";

const maxInputLength = 80_000;

function extractJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  return JSON.parse(cleaned);
}

function normalizeItems(value: unknown): KnowledgeImportDraft[] {
  const record = value as { items?: unknown };
  const items = Array.isArray(record.items) ? record.items : Array.isArray(value) ? value : [];
  return items
    .map((item) => {
      const entry = item as Record<string, unknown>;
      const question = String(entry.question ?? entry.问题 ?? "").trim();
      const answer = String(entry.answer ?? entry.答案 ?? "").trim();
      const title = String(entry.title ?? entry.标题 ?? question.slice(0, 36)).trim();
      const rawTags = entry.tags ?? entry.标签 ?? [];
      const tags = Array.isArray(rawTags)
        ? rawTags.map(String).map((tag) => tag.trim()).filter(Boolean)
        : String(rawTags).split(/[,，|、\n]/).map((tag) => tag.trim()).filter(Boolean);
      return { title, question, answer, tags };
    })
    .filter((item) => item.question && item.answer);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const rawText = String(payload.text ?? "").trim();
    if (!rawText) {
      return NextResponse.json({ error: "请先粘贴需要整理的内容。" }, { status: 400 });
    }
    if (rawText.length > maxInputLength) {
      return NextResponse.json({ error: "内容太长了，请先分成几段导入。" }, { status: 413 });
    }

    const data = await readData();
    const apiKey = data.settings.apiKey || process.env.OPENAI_API_KEY;
    const baseUrl = data.settings.baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const model = data.settings.model || process.env.OPENAI_MODEL || "gpt-4o-mini";

    if (!apiKey) {
      const fallbackItems = parseKnowledgeText(rawText);
      if (fallbackItems.length) {
        return NextResponse.json({
          filename: "AI 整理导入",
          items: fallbackItems,
          count: fallbackItems.length,
          source: "rules",
          warning: "还没有配置模型密钥，已先用基础规则解析。"
        });
      }
      return NextResponse.json({ error: "还没有配置模型 API 密钥。请在设置里填写 DeepSeek API Key 后再用 AI 整理。" }, { status: 400 });
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "你是一个知识库整理助手，只返回 JSON。"
          },
          {
            role: "user",
            content: [
              "请从下面这段原始内容中提取可复用的问答知识，用于之后回复邮件、WhatsApp、微信或社媒留言。",
              "要求：",
              "1. 识别客户/对方真实会问的问题，合并重复问题。",
              "2. 只把原文中有依据的内容写进答案，不要编造价格、日期、承诺、负责人、库存、附件或政策。",
              "3. 答案要保留用户原本回答过的事实和措辞，但整理得更清楚。",
              "4. 如果一段内容不是稳定知识，或者只是寒暄/情绪/临时安排，不要入库。",
              "5. 每条必须有 question 和 answer；title 简短；tags 用中文关键词。",
              "6. 返回 JSON，格式为：{\"items\":[{\"title\":\"\",\"question\":\"\",\"answer\":\"\",\"tags\":[\"\"]}]}。",
              "",
              "原始内容：",
              rawText
            ].join("\n")
          }
        ]
      }),
      signal: AbortSignal.timeout(60_000)
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: `模型服务返回错误（${response.status}）。`, detail }, { status: 502 });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    if (!content) throw new Error("模型没有返回内容");
    const items = normalizeItems(extractJson(content));
    if (!items.length) {
      return NextResponse.json({ error: "AI 没有整理出可入库的问答。可以补充更多上下文后再试。" }, { status: 422 });
    }
    return NextResponse.json({ filename: "AI 整理导入", items, count: items.length, source: "model" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 整理失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
