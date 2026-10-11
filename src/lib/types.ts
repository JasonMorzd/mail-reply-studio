export type EmailRole = "received" | "sent";
export type Language = "zh" | "en" | "mixed";

export type EmailMessage = {
  id?: string;
  role: EmailRole;
  sender?: string;
  recipients?: string[];
  subject?: string;
  body: string;
  sentAt?: string;
};

export type ConversationExample = {
  id: string;
  subject?: string;
  messages: EmailMessage[];
  language: Language;
  tags: string[];
  included: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StyleProfile = {
  preferredOpenings: string[];
  preferredClosings: string[];
  commonPhrases: string[];
  sentenceLength: "short" | "medium" | "long";
  formality: "casual" | "neutral" | "formal";
  usesBullets: boolean;
  avoidPhrases: string[];
};

export type IdentityProfile = {
  name: string;
  role: string;
  organization: string;
  expertise: string;
  context: string;
};

export type KnowledgeItem = {
  id: string;
  title: string;
  question: string;
  answer: string;
  tags: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeSource = {
  id: string;
  title: string;
  question: string;
  answerExcerpt: string;
};

export type DraftRequest = {
  thread: EmailMessage[];
  language: "auto" | "zh" | "en";
  length: "short" | "normal" | "detailed";
  toneMode: "learned" | "direct" | "polite" | "concise";
  mode?: "email" | "instant";
  platform?: "whatsapp" | "wechat" | "social-dm" | "social-comment" | "other";
};

export type DraftResult = {
  body: string;
  language: "zh" | "en";
  uncertaintyItems: Array<{ text: string; reason: string }>;
  usedExamples: string[];
  usedKnowledge: KnowledgeSource[];
};

export type AppData = {
  examples: ConversationExample[];
  styleProfile: StyleProfile;
  identityProfile: IdentityProfile;
  knowledge: KnowledgeItem[];
  settings: {
    provider: string;
    baseUrl: string;
    model: string;
    apiKey: string;
  };
};

export type ModelSettings = AppData["settings"];

export type PublicModelSettings = Omit<ModelSettings, "apiKey"> & {
  hasApiKey: boolean;
};

export const defaultIdentityProfile: IdentityProfile = {
  name: "",
  role: "",
  organization: "",
  expertise: "",
  context: ""
};

export const defaultStyleProfile: StyleProfile = {
  preferredOpenings: [],
  preferredClosings: [],
  commonPhrases: [],
  sentenceLength: "medium",
  formality: "neutral",
  usesBullets: false,
  avoidPhrases: [
    "希望这封邮件一切顺利",
    "感谢您的耐心等待",
    "如有任何问题，请随时联系我",
    "综上所述",
    "I hope this email finds you well",
    "Please do not hesitate to contact me"
  ]
};

export const defaultAppData: AppData = {
  examples: [],
  styleProfile: defaultStyleProfile,
  identityProfile: defaultIdentityProfile,
  knowledge: [],
  settings: {
    provider: "OpenAI-compatible",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    apiKey: ""
  }
};
