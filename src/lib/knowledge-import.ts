import { inflateRawSync } from "node:zlib";
import type { KnowledgeItem } from "./types";

export type KnowledgeImportDraft = Pick<KnowledgeItem, "title" | "question" | "answer" | "tags">;

type MimeHeaders = Record<string, string>;

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function decodeMimeBytes(bytes: Buffer, charset = "utf-8") {
  const normalized = charset.toLowerCase().replace(/["']/g, "").trim();
  const decoderName = normalized === "gb2312" || normalized === "gbk" ? "gb18030" : normalized;
  try {
    return new TextDecoder(decoderName).decode(bytes);
  } catch {
    return bytes.toString("utf8");
  }
}

function decodeMimeHeader(value: string) {
  return value.replace(
    /=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g,
    (_, charset: string, encoding: string, encoded: string) => {
      try {
        const bytes = encoding.toLowerCase() === "b"
          ? Buffer.from(encoded, "base64")
          : Buffer.from(
              encoded
                .replace(/_/g, " ")
                .replace(/=([0-9A-F]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))),
              "latin1"
            );
        return decodeMimeBytes(bytes, charset);
      } catch {
        return encoded;
      }
    }
  );
}

function readMimeHeaders(buffer: Buffer): { headers: MimeHeaders; body: Buffer } {
  const text = buffer.toString("latin1");
  const crlfIndex = text.indexOf("\r\n\r\n");
  const lfIndex = text.indexOf("\n\n");
  const separatorIndex = crlfIndex >= 0 ? crlfIndex : lfIndex;
  const separatorLength = crlfIndex >= 0 ? 4 : 2;
  if (separatorIndex < 0) return { headers: {}, body: buffer };

  const headerText = text.slice(0, separatorIndex)
    .replace(/\r\n[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, " ");
  const headers: MimeHeaders = {};
  for (const line of headerText.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = decodeMimeHeader(line.slice(colon + 1).trim());
    headers[name] = headers[name] ? `${headers[name]}, ${value}` : value;
  }
  return {
    headers,
    body: Buffer.from(text.slice(separatorIndex + separatorLength), "latin1")
  };
}

function decodeTransferEncoding(buffer: Buffer, encoding = "") {
  const normalized = encoding.toLowerCase().trim();
  if (normalized === "base64") {
    return Buffer.from(buffer.toString("ascii").replace(/\s+/g, ""), "base64");
  }
  if (normalized === "quoted-printable") {
    const source = buffer.toString("latin1").replace(/=\r?\n/g, "");
    const bytes: number[] = [];
    for (let index = 0; index < source.length; index += 1) {
      if (source[index] === "=" && /^[0-9A-F]{2}$/i.test(source.slice(index + 1, index + 3))) {
        bytes.push(parseInt(source.slice(index + 1, index + 3), 16));
        index += 2;
      } else {
        bytes.push(source.charCodeAt(index));
      }
    }
    return Buffer.from(bytes);
  }
  return buffer;
}

function stripHtml(value: string) {
  return decodeXml(
    value
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|li|tr|h[1-6])\s*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractMimeText(buffer: Buffer): { plain: string; html: string } {
  const { headers, body } = readMimeHeaders(buffer);
  const contentType = headers["content-type"] ?? "text/plain";
  const mediaType = contentType.split(";")[0].trim().toLowerCase();
  const charset = contentType.match(/charset\s*=\s*"?([^";\s]+)"?/i)?.[1] ?? "utf-8";
  const transferDecoded = decodeTransferEncoding(body, headers["content-transfer-encoding"]);

  if (mediaType.startsWith("multipart/")) {
    const boundary = contentType.match(/boundary\s*=\s*"?([^";]+)"?/i)?.[1];
    if (!boundary) return { plain: "", html: "" };
    const parts = body.toString("latin1").split(`--${boundary}`);
    return parts.reduce(
      (result, part) => {
        const trimmed = part.replace(/^\r?\n/, "").replace(/\r?\n--\s*$/, "").trim();
        if (!trimmed || trimmed === "--") return result;
        const child = extractMimeText(Buffer.from(trimmed, "latin1"));
        return {
          plain: result.plain || child.plain,
          html: result.html || child.html
        };
      },
      { plain: "", html: "" }
    );
  }

  if (mediaType === "text/html" || mediaType === "application/xhtml+xml") {
    return { plain: "", html: stripHtml(decodeMimeBytes(transferDecoded, charset)) };
  }
  if (mediaType === "text/plain") {
    return { plain: decodeMimeBytes(transferDecoded, charset), html: "" };
  }
  return { plain: "", html: "" };
}

function splitEmailConversation(body: string, subject: string) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const separatorIndex = lines.findIndex((line) =>
    /^\s*>/.test(line)
    || /^\s*(?:on .+wrote:|在.+写道[:：]|-----original message-----|原始邮件)/i.test(line)
  );

  if (separatorIndex >= 0) {
    const answer = lines.slice(0, separatorIndex).join("\n").trim();
    const question = lines
      .slice(separatorIndex)
      .map((line) => line.replace(/^\s*>\s?/, ""))
      .filter((line) => !/^\s*(?:on .+wrote:|在.+写道[:：]|from:|发件人:|sent:|发送时间:|to:|收件人:|subject:|主题:)/i.test(line))
      .join("\n")
      .trim();
    if (answer && question) return { question, answer };
  }

  return {
    question: subject || "这封邮件主要说明什么？",
    answer: body.trim()
  };
}

export function parseEml(buffer: Buffer): KnowledgeImportDraft[] {
  const { headers } = readMimeHeaders(buffer);
  const mimeText = extractMimeText(buffer);
  const body = mimeText.plain || mimeText.html;
  if (!body.trim()) return [];

  const subject = headers.subject?.trim() ?? "";
  const conversation = splitEmailConversation(body, subject);
  return [{
    title: subject || conversation.question.slice(0, 36),
    question: conversation.question,
    answer: conversation.answer,
    tags: ["邮件"]
  }];
}

function extractZipEntry(buffer: Buffer, entryName: string) {
  const endOfCentralDirectory = 0x06054b50;
  const centralDirectoryHeader = 0x02014b50;
  const localFileHeader = 0x04034b50;
  let endOffset = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65_557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === endOfCentralDirectory) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new Error("无法读取 Word 文件结构。");

  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  let offset = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== centralDirectoryHeader) break;
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const filename = buffer.subarray(offset + 46, offset + 46 + filenameLength).toString("utf8");
    if (filename === entryName) {
      if (buffer.readUInt32LE(localOffset) !== localFileHeader) throw new Error("Word 文件内容损坏。");
      const localFilenameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localFilenameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      if (compressionMethod === 0) return compressed;
      if (compressionMethod === 8) return inflateRawSync(compressed);
      throw new Error("当前 Word 文件使用了不支持的压缩方式。");
    }
    offset += 46 + filenameLength + extraLength + commentLength;
  }
  throw new Error("Word 文件中没有找到正文。");
}

export function extractDocxText(buffer: Buffer) {
  const xml = extractZipEntry(buffer, "word/document.xml").toString("utf8");
  const text = xml
    .replace(/<w:tab\s*\/>/g, "\t")
    .replace(/<w:br\s*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((line) => decodeXml(line).replace(/\s+/g, " ").trim())
    .join("\n");
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeLine(line: string) {
  return line
    .replace(/^\uFEFF/, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+$/g, "")
    .trim();
}

function isQuestionLike(line: string) {
  return /[?？]\s*$/.test(line)
    || /^(?:请问|如何|怎么|什么|哪些|能否|是否|多久|多少|为什么|可以|你们|我想|支持|what|how|can|do|does|is|are|will|when|where|why|who|could|would|please)\b/i.test(line);
}

function cleanQuestion(line: string) {
  return line
    .replace(/^\s*(?:[-*•]|\d+[.)、])\s*/, "")
    .replace(/^(?:问题|问|question)\s*[:：]\s*/i, "")
    .trim();
}

function cleanAnswer(line: string) {
  return line
    .replace(/^(?:答案|答|回复|标准答案|我的回答|a|answer)\s*[:：]\s*/i, "")
    .trim();
}

function makeDraft(question: string, answerLines: string[], index: number): KnowledgeImportDraft | null {
  const answer = answerLines.join("\n").trim();
  if (!question.trim() || !answer) return null;
  return {
    title: question.length > 36 ? `${question.slice(0, 36)}…` : question,
    question: cleanQuestion(question),
    answer: cleanAnswer(answer),
    tags: []
  };
}

export function parseKnowledgeText(text: string): KnowledgeImportDraft[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(normalizeLine);
  const drafts: KnowledgeImportDraft[] = [];
  let question = "";
  let answerLines: string[] = [];
  let answerStarted = false;

  const flush = () => {
    const draft = makeDraft(question, answerLines, drafts.length);
    if (draft) drafts.push(draft);
    question = "";
    answerLines = [];
    answerStarted = false;
  };

  for (const rawLine of lines) {
    if (!rawLine) {
      if (question && answerStarted) answerLines.push("");
      continue;
    }
    const questionMatch = rawLine.match(/^(?:问题|问|question|q)\s*[:：]\s*(.+)$/i);
    const answerMatch = rawLine.match(/^(?:答案|答|回复|标准答案|我的回答|answer|a)\s*[:：]\s*(.*)$/i);
    const numberedQuestion = rawLine.match(/^\s*(?:\d+[.)、])\s*(.+)$/)?.[1] ?? "";
    const looksLikeQuestion = isQuestionLike(rawLine) || (Boolean(numberedQuestion) && isQuestionLike(numberedQuestion));

    if (questionMatch || (looksLikeQuestion && (!question || answerStarted))) {
      if (question) flush();
      question = cleanQuestion(questionMatch?.[1] ?? (numberedQuestion || rawLine));
      continue;
    }
    if (answerMatch && question) {
      answerStarted = true;
      if (answerMatch[1]) answerLines.push(answerMatch[1]);
      continue;
    }
    if (question) {
      answerStarted = true;
      answerLines.push(rawLine);
    }
  }
  if (question) flush();

  if (drafts.length) return drafts;

  const blocks = text.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  for (const block of blocks) {
    const blockLines = block.split("\n").map(normalizeLine).filter(Boolean);
    if (blockLines.length >= 2 && isQuestionLike(blockLines[0])) {
      const draft = makeDraft(blockLines[0], blockLines.slice(1), drafts.length);
      if (draft) drafts.push(draft);
    }
  }
  return drafts;
}

export function parseKnowledgeCsv(text: string): KnowledgeImportDraft[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((item) => item.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((item) => item.trim().replace(/^"|"$/g, ""));
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    const question = record.question || record.questiontext || record.问题 || "";
    const answer = record.answer || record.answertext || record.答案 || "";
    return {
      title: record.title || record.标题 || question.slice(0, 36),
      question,
      answer,
      tags: (record.tags || record.标签 || "").split(/[|，,]/).map((tag) => tag.trim()).filter(Boolean)
    };
  }).filter((item) => item.question && item.answer);
}

export function parseKnowledgeJson(text: string): KnowledgeImportDraft[] {
  const parsed = JSON.parse(text) as unknown;
  const records = Array.isArray(parsed) ? parsed : [parsed];
  return records.map((record) => {
    const item = record as Record<string, unknown>;
    const question = String(item.question ?? item.问题 ?? "");
    const answer = String(item.answer ?? item.答案 ?? item.response ?? "");
    return {
      title: String(item.title ?? item.标题 ?? question.slice(0, 36)),
      question,
      answer,
      tags: Array.isArray(item.tags) ? item.tags.map(String) : String(item.tags ?? item.标签 ?? "").split(/[|，,]/).filter(Boolean)
    };
  }).filter((item) => item.question.trim() && item.answer.trim());
}

export async function parseKnowledgeFile(filename: string, buffer: Buffer): Promise<KnowledgeImportDraft[]> {
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "eml") return parseEml(buffer);
  if (extension === "docx") return parseKnowledgeText(extractDocxText(buffer));
  const text = buffer.toString("utf8");
  if (extension === "csv") return parseKnowledgeCsv(text);
  if (extension === "json") return parseKnowledgeJson(text);
  return parseKnowledgeText(text);
}
