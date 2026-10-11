import { NextResponse } from "next/server";
import { fallbackDraft, fallbackInstantDraft, rankExamples, detectLanguage } from "@/lib/mail";
import { readData, searchExamples, searchKnowledge } from "@/lib/store";
import type { DraftRequest, DraftResult, KnowledgeSource } from "@/lib/types";

function extractJson(text: string) {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned) as DraftResult;
}

export async function POST(request: Request) {
  const input = await request.json() as DraftRequest;
  if (!input.thread?.length) return NextResponse.json({ error: "缺少需要回复的内容。" }, { status: 400 });
  const mode = input.mode === "instant" ? "instant" : "email";
  const data = await readData();
  const ftsReferences = await searchExamples(input.thread);
  const references = ftsReferences.length ? ftsReferences : rankExamples(input.thread, data.examples);
  const knowledge = await searchKnowledge(input.thread);
  const knowledgeSources: KnowledgeSource[] = knowledge.map((item) => ({
    id: item.id,
    title: item.title,
    question: item.question,
    answerExcerpt: item.answer.length > 120 ? `${item.answer.slice(0, 120)}…` : item.answer
  }));
  const language = input.language === "auto"
    ? (detectLanguage(input.thread.map((item) => item.body).join("\n")) === "zh" ? "zh" : "en")
    : input.language;

  const apiKey = data.settings.apiKey || process.env.OPENAI_API_KEY;
  const baseUrl = data.settings.baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = data.settings.model || process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    const fallback = mode === "instant"
      ? fallbackInstantDraft(input.thread, language, knowledge)
      : fallbackDraft(input.thread, data.styleProfile, language, knowledge);
    const result: DraftResult = {
      body: fallback.body,
      language,
      uncertaintyItems: fallback.uncertaintyItems,
      usedExamples: references.map((example) => example.subject || "未命名对话"),
      usedKnowledge: knowledgeSources
    };
    return NextResponse.json({ ...result, source: "demo" });
  }

  const prompt = {
    role: "user",
    content: [
      mode === "instant"
        ? "You draft a reply to an instant message or social media comment for the user. Return JSON only with body, language, uncertaintyItems, and usedExamples."
        : "You draft an email reply for the user. Return JSON only with body, language, uncertaintyItems, and usedExamples.",
      "Write a natural reply in the user's learned voice. Do not mention being an AI. Do not add a meta-introduction.",
      "Do not invent dates, prices, people, attachments, commitments, status, or facts. Put unsupported specifics in uncertaintyItems instead.",
      "Avoid generic AI phrases unless they appear in the user's examples. Keep the reply plain text.",
      "Use identity and knowledge entries as factual context. If a knowledge entry answers the incoming question, use that answer instead of inventing a new fact.",
      "Do not mention the knowledge base in the email body. The server will show the source references beside the draft.",
      ...(mode === "instant"
        ? [
            "This is an instant reply, not an email. Output exactly one continuous paragraph.",
            "Do not use a subject, greeting block, sign-off block, bullet points, headings, analysis, or line breaks.",
            `Platform: ${input.platform ?? "other"}.`
          ]
        : []),
      `Language: ${language}. Length: ${input.length}. Tone mode: ${input.toneMode}.`,
      `Identity profile: ${JSON.stringify(data.identityProfile)}`,
      `Style profile: ${JSON.stringify(data.styleProfile)}`,
      `Incoming thread: ${JSON.stringify(input.thread)}`,
      `Reference examples: ${JSON.stringify(references)}`,
      `Knowledge entries: ${JSON.stringify(knowledge)}`
    ].join("\n\n")
  };

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.55,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a careful email drafting assistant." },
          prompt
        ]
      }),
      signal: AbortSignal.timeout(45_000)
    });
    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: `模型服务返回错误（${response.status}）。`, detail }, { status: 502 });
    }
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("模型没有返回内容");
    const result = extractJson(content);
    return NextResponse.json({
      ...result,
      body: mode === "instant" ? result.body.replace(/\s*\n+\s*/g, " ").trim() : result.body,
      usedKnowledge: knowledgeSources,
      source: "model"
    });
  } catch {
    return NextResponse.json({ error: "模型暂时不可用。你的来信和已有草稿没有被清除，请检查 API 设置后重试。" }, { status: 502 });
  }
}
