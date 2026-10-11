import { promises as fs } from "node:fs";
import path from "node:path";
import {
  AppData,
  ConversationExample,
  defaultAppData,
  IdentityProfile,
  KnowledgeItem,
  StyleProfile
} from "./types";
import type { EmailMessage } from "./types";

const dataDir = path.join(process.cwd(), ".mail-reply-data");
const dbFile = path.join(dataDir, "mail-reply-studio.sqlite");

type Statement = {
  run: (...args: unknown[]) => unknown;
  get: (...args: unknown[]) => Record<string, unknown> | undefined;
  all: (...args: unknown[]) => Array<Record<string, unknown>>;
};

type Database = {
  exec: (sql: string) => void;
  prepare: (sql: string) => Statement;
  close: () => void;
};

const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (filename: string) => Database;
};

async function ensureStore() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function openDb() {
  await ensureStore();
  const db = new DatabaseSync(dbFile);
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS examples (
      id TEXT PRIMARY KEY,
      subject TEXT,
      language TEXT NOT NULL,
      tags TEXT NOT NULL,
      included INTEGER NOT NULL,
      messages TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS example_fts USING fts5(
      id UNINDEXED,
      subject,
      body
    );
    CREATE TABLE IF NOT EXISTS knowledge_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      tags TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
      id UNINDEXED,
      title,
      question,
      answer,
      tags
    );
  `);
  const seed = db.prepare("INSERT OR IGNORE INTO kv (key, value) VALUES (?, ?)");
  seed.run("styleProfile", JSON.stringify(defaultAppData.styleProfile));
  seed.run("identityProfile", JSON.stringify(defaultAppData.identityProfile));
  seed.run("settings", JSON.stringify(defaultAppData.settings));
  return db;
}

function readJson<T>(db: Database, key: string, fallback: T): T {
  const row = db.prepare("SELECT value FROM kv WHERE key = ?").get(key);
  if (!row?.value) return structuredClone(fallback);
  try {
    return { ...structuredClone(fallback), ...JSON.parse(String(row.value)) };
  } catch {
    return structuredClone(fallback);
  }
}

export async function readData(): Promise<AppData> {
  const db = await openDb();
  try {
    const rows = db.prepare("SELECT * FROM examples ORDER BY updatedAt DESC").all();
    const examples = rows.map((row) => ({
      id: String(row.id),
      subject: row.subject ? String(row.subject) : undefined,
      messages: JSON.parse(String(row.messages)),
      language: row.language as AppData["examples"][number]["language"],
      tags: JSON.parse(String(row.tags)),
      included: Boolean(row.included),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt)
    }));
    const knowledgeRows = db.prepare("SELECT * FROM knowledge_items ORDER BY updatedAt DESC").all();
    const knowledge = knowledgeRows.map((row): KnowledgeItem => ({
      id: String(row.id),
      title: String(row.title),
      question: String(row.question),
      answer: String(row.answer),
      tags: JSON.parse(String(row.tags)),
      enabled: Boolean(row.enabled),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt)
    }));
    return {
      examples,
      styleProfile: readJson(db, "styleProfile", defaultAppData.styleProfile),
      identityProfile: readJson(db, "identityProfile", defaultAppData.identityProfile),
      knowledge,
      settings: readJson(db, "settings", defaultAppData.settings)
    };
  } finally {
    db.close();
  }
}

export async function writeData(data: AppData) {
  const db = await openDb();
  try {
    db.exec("BEGIN");
    db.prepare("DELETE FROM examples").run();
    db.prepare("DELETE FROM example_fts").run();
    db.prepare("DELETE FROM knowledge_items").run();
    db.prepare("DELETE FROM knowledge_fts").run();
    const insertExample = db.prepare(`
      INSERT INTO examples (id, subject, language, tags, included, messages, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertFts = db.prepare("INSERT INTO example_fts (id, subject, body) VALUES (?, ?, ?)");
    for (const example of data.examples) {
      insertExample.run(
        example.id,
        example.subject ?? null,
        example.language,
        JSON.stringify(example.tags),
        example.included ? 1 : 0,
        JSON.stringify(example.messages),
        example.createdAt,
        example.updatedAt
      );
      insertFts.run(
        example.id,
        example.subject ?? "",
        example.messages.map((message) => message.body).join("\n")
      );
    }
    const insertKnowledge = db.prepare(`
      INSERT INTO knowledge_items (id, title, question, answer, tags, enabled, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertKnowledgeFts = db.prepare("INSERT INTO knowledge_fts (id, title, question, answer, tags) VALUES (?, ?, ?, ?, ?)");
    for (const item of data.knowledge) {
      insertKnowledge.run(
        item.id,
        item.title,
        item.question,
        item.answer,
        JSON.stringify(item.tags),
        item.enabled ? 1 : 0,
        item.createdAt,
        item.updatedAt
      );
      insertKnowledgeFts.run(item.id, item.title, item.question, item.answer, item.tags.join(" "));
    }
    const upsert = db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    upsert.run("styleProfile", JSON.stringify(data.styleProfile));
    upsert.run("identityProfile", JSON.stringify(data.identityProfile));
    upsert.run("settings", JSON.stringify(data.settings));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
}

export async function updateExamples(examples: ConversationExample[]) {
  const data = await readData();
  data.examples = examples;
  await writeData(data);
  return data;
}

export async function updateStyleProfile(styleProfile: StyleProfile) {
  const data = await readData();
  data.styleProfile = styleProfile;
  await writeData(data);
  return data;
}

export async function updateIdentityProfile(identityProfile: IdentityProfile) {
  const data = await readData();
  data.identityProfile = identityProfile;
  await writeData(data);
  return data;
}

export async function updateKnowledge(knowledge: KnowledgeItem[]) {
  const data = await readData();
  data.knowledge = knowledge;
  await writeData(data);
  return data;
}

export async function resetData() {
  await writeData(structuredClone(defaultAppData));
}

export async function searchExamples(thread: EmailMessage[], limit = 5): Promise<ConversationExample[]> {
  const db = await openDb();
  try {
    const tokens = thread
      .map((message) => `${message.subject ?? ""} ${message.body}`)
      .join(" ")
      .toLowerCase()
      .split(/[\s,，。！？.!?;；:：()[\]{}]+/)
      .map((token) => token.replace(/["*:^()-]/g, "").trim())
      .filter((token) => token.length > 1)
      .slice(0, 24);
    if (!tokens.length) return [];
    const query = tokens.map((token) => `"${token}"`).join(" OR ");
    const rows = db.prepare(`
      SELECT examples.*
      FROM example_fts
      JOIN examples ON examples.id = example_fts.id
      WHERE example_fts MATCH ? AND examples.included = 1
      ORDER BY bm25(example_fts)
      LIMIT ?
    `).all(query, limit);
    return rows.map((row) => ({
      id: String(row.id),
      subject: row.subject ? String(row.subject) : undefined,
      messages: JSON.parse(String(row.messages)),
      language: row.language as AppData["examples"][number]["language"],
      tags: JSON.parse(String(row.tags)),
      included: Boolean(row.included),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt)
    }));
  } finally {
    db.close();
  }
}

export async function searchKnowledge(thread: EmailMessage[], limit = 5): Promise<KnowledgeItem[]> {
  const data = await readData();
  const query = thread.map((message) => `${message.subject ?? ""}\n${message.body}`).join("\n").toLowerCase();
  const queryTokens = query
    .split(/[\s,，。！？.!?;；:：()[\]{}"'“”‘’]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
  const uniqueTokens = [...new Set(queryTokens)];
  return data.knowledge
    .filter((item) => item.enabled)
    .map((item) => {
      const searchable = `${item.title}\n${item.question}\n${item.answer}\n${item.tags.join(" ")}`.toLowerCase();
      const question = item.question.toLowerCase();
      let score = 0;
      if (question && (query.includes(question) || question.includes(query.trim()))) score += 100;
      for (const token of uniqueTokens) {
        if (searchable.includes(token)) score += token.length > 3 ? 4 : 2;
      }
      for (let index = 0; index < query.length - 1; index += 1) {
        const pair = query.slice(index, index + 2).trim();
        if (pair.length === 2 && searchable.includes(pair)) score += 1;
      }
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}
