import {
  ConversationExample,
  EmailMessage,
  KnowledgeItem,
  Language,
  StyleProfile
} from "./types";

export function detectLanguage(text: string): Language {
  const chinese = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (chinese > 0 && latin > 0) return "mixed";
  return chinese > latin ? "zh" : "en";
}

export function parsePlainText(raw: string): ConversationExample {
  const normalized = raw.replace(/\r\n/g, "\n").trim();
  const subject = normalized.match(/^(?:Subject|主题)\s*:\s*(.+)$/im)?.[1]?.trim();
  const lines = normalized.split("\n");
  const messages: EmailMessage[] = [];
  let currentRole: "received" | "sent" = "received";
  let current: string[] = [];

  const flush = () => {
    const body = current.join("\n").trim();
    if (body) messages.push({ role: currentRole, body });
    current = [];
  };

  for (const line of lines) {
    if (/^(?:Subject|主题)\s*:/i.test(line)) continue;
    const marker = line.match(/^\s*(?:---\s*)?(?:from|发件人|sender)\s*:\s*(.+)$/i);
    const replyMarker = line.match(/^\s*(?:my reply|我的回复|我方回复|reply)\s*:?\s*$/i);
    const receivedMarker = line.match(/^\s*(?:incoming|来信|received|收到的邮件)\s*:?\s*$/i);
    if (replyMarker) {
      flush();
      currentRole = "sent";
      continue;
    }
    if (receivedMarker) {
      flush();
      currentRole = "received";
      continue;
    }
    if (marker && current.length === 0) {
      continue;
    }
    current.push(line);
  }
  flush();

  if (messages.length === 0) {
    messages.push({ role: "received", body: normalized });
  }

  const language = detectLanguage(messages.map((message) => message.body).join("\n"));
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    subject,
    messages,
    language,
    tags: [],
    included: true,
    createdAt: now,
    updatedAt: now
  };
}

export function parseJson(raw: string): ConversationExample[] {
  const value = JSON.parse(raw) as unknown;
  const items = Array.isArray(value) ? value : [value];
  return items.map((item) => {
    if (typeof item === "string") return parsePlainText(item);
    const record = item as Record<string, unknown>;
    const messages = Array.isArray(record.messages)
      ? (record.messages as EmailMessage[])
      : [{
          role: (record.role === "sent" ? "sent" : "received") as "sent" | "received",
          body: String(record.body ?? record.text ?? "")
        }];
    const now = new Date().toISOString();
    return {
      id: String(record.id ?? crypto.randomUUID()),
      subject: record.subject ? String(record.subject) : undefined,
      messages,
      language: detectLanguage(messages.map((message) => message.body).join("\n")),
      tags: Array.isArray(record.tags) ? record.tags.map(String) : [],
      included: record.included !== false,
      createdAt: String(record.createdAt ?? now),
      updatedAt: now
    };
  });
}

export function parseCsv(raw: string): ConversationExample[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((item) => item.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((item) => item.trim().replace(/^"|"$/g, ""));
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    const incoming = record.received || record.incoming || record.body || "";
    const sent = record.sent || record.reply || record["my reply"] || "";
    const messages: EmailMessage[] = [
      ...(incoming ? [{ role: "received" as const, body: incoming }] : []),
      ...(sent ? [{ role: "sent" as const, body: sent }] : [])
    ];
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      subject: record.subject,
      messages: messages.length ? messages : [{ role: "received", body: line }],
      language: detectLanguage(line),
      tags: [],
      included: true,
      createdAt: now,
      updatedAt: now
    };
  });
}

export function buildStyleProfile(examples: ConversationExample[], existing: StyleProfile): StyleProfile {
  const sentBodies = examples
    .filter((example) => example.included)
    .flatMap((example) => example.messages.filter((message) => message.role === "sent").map((message) => message.body.trim()))
    .filter(Boolean);
  if (!sentBodies.length) return existing;

  const openings = sentBodies
    .map((body) => body.split(/\n+/).find(Boolean)?.trim())
    .filter((value): value is string => Boolean(value && value.length < 80));
  const closings = sentBodies
    .map((body) => body.split(/\n+/).filter(Boolean).at(-1)?.trim())
    .filter((value): value is string => Boolean(value && value.length < 80));
  const phrases = sentBodies
    .flatMap((body) => body.split(/[，。！？,.!?\n]/).map((part) => part.trim()))
    .filter((part) => part.length >= 4 && part.length <= 48);
  const sentenceCount = sentBodies.reduce((sum, body) => sum + body.split(/[。！？.!?]+/).filter(Boolean).length, 0);
  const avgLength = sentBodies.reduce((sum, body) => sum + body.length, 0) / sentBodies.length;

  return {
    ...existing,
    preferredOpenings: [...new Set([...openings, ...existing.preferredOpenings])].slice(0, 8),
    preferredClosings: [...new Set([...closings, ...existing.preferredClosings])].slice(0, 8),
    commonPhrases: [...new Set([...phrases, ...existing.commonPhrases])].slice(0, 18),
    sentenceLength: avgLength < 90 ? "short" : avgLength > 220 ? "long" : "medium",
    usesBullets: sentBodies.filter((body) => /^\s*[-*•]\s/m.test(body)).length > sentBodies.length / 3,
    formality: sentenceCount > 0 && avgLength > 180 ? "formal" : existing.formality
  };
}

export function rankExamples(query: EmailMessage[], examples: ConversationExample[], limit = 5) {
  const haystack = query.map((item) => `${item.subject ?? ""}\n${item.body}`).join("\n").toLowerCase();
  const tokens = new Set(haystack.split(/[\s,，。！？.!?;；:：()[\]{}]+/).filter((token) => token.length > 1));
  return examples
    .filter((example) => example.included)
    .map((example) => {
      const text = `${example.subject ?? ""}\n${example.messages.map((item) => item.body).join("\n")}`.toLowerCase();
      let score = 0;
      for (const token of tokens) if (text.includes(token)) score += token.length > 4 ? 2 : 1;
      return { example, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ example }) => example);
}

export function fallbackDraft(query: EmailMessage[], style: StyleProfile, language: "zh" | "en", knowledge: KnowledgeItem[] = []): {
  body: string;
  uncertaintyItems: Array<{ text: string; reason: string }>;
} {
  const incoming = query.filter((item) => item.role === "received").at(-1)?.body ?? "";
  const hasQuestion = /\?|？|请问|能否|could you|can you|would you/i.test(incoming);
  const hasSpecificRequest = /日期|时间|价格|金额|附件|deadline|date|price|amount|attachment/i.test(incoming);
  const opening = style.preferredOpenings[0];
  const closing = style.preferredClosings[0];
  const uncertaintyItems = hasSpecificRequest
    ? [{ text: "邮件包含需要确认的具体信息", reason: "本地演示模式不会猜测日期、金额、附件或承诺。" }]
    : [];
  const matchedKnowledge = knowledge[0];
  if (matchedKnowledge) {
    return {
      body: [opening, matchedKnowledge.answer, closing].filter(Boolean).join("\n\n"),
      uncertaintyItems: []
    };
  }
  if (language === "en") {
    return {
      body: [opening, hasQuestion ? "Thanks for reaching out. I’ll review this and get back to you with the details." : "Thanks for the update. I’ve noted this and will follow up with the next step.", closing]
        .filter(Boolean)
        .join("\n\n"),
      uncertaintyItems
    };
  }
  return {
    body: [opening, hasQuestion ? "收到，谢谢。这个问题我先确认一下，再回复你具体信息。" : "收到，谢谢你的更新。我先记下，后续按这个继续。", closing]
      .filter(Boolean)
      .join("\n\n"),
    uncertaintyItems
  };
}

export function fallbackInstantDraft(query: EmailMessage[], language: "zh" | "en", knowledge: KnowledgeItem[] = []): {
  body: string;
  uncertaintyItems: Array<{ text: string; reason: string }>;
} {
  const incoming = query.filter((item) => item.role === "received").at(-1)?.body ?? "";
  const hasQuestion = /\?|？|请问|能否|可以|could you|can you|would you/i.test(incoming);
  const hasSpecificRequest = /日期|时间|价格|金额|附件|deadline|date|price|amount|attachment/i.test(incoming);
  const uncertaintyItems = hasSpecificRequest
    ? [{ text: "留言包含需要确认的具体信息", reason: "本地演示模式不会猜测日期、金额、附件或承诺。" }]
    : [];
  const matchedKnowledge = knowledge[0];
  if (matchedKnowledge) {
    return {
      body: matchedKnowledge.answer.replace(/\s*\n+\s*/g, " ").trim(),
      uncertaintyItems: []
    };
  }
  if (language === "en") {
    return {
      body: (hasQuestion ? "Thanks for reaching out. I’ll check this and get back to you with the details." : "Thanks for the update. I’ve noted it and will follow up with the next step.").replace(/\s*\n+\s*/g, " ").trim(),
      uncertaintyItems
    };
  }
  return {
    body: (hasQuestion ? "收到，谢谢。我先确认一下，再回复你具体信息。" : "收到，谢谢你的消息。我先记下，后续按这个继续。").replace(/\s*\n+\s*/g, " ").trim(),
    uncertaintyItems
  };
}
