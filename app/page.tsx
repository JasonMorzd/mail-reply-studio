"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Archive,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Clipboard,
  FileDown,
  FileText,
  Inbox,
  Menu,
  MessageCircle,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  X
} from "lucide-react";
import type {
  ConversationExample,
  DraftResult,
  EmailMessage,
  IdentityProfile,
  KnowledgeItem,
  ModelSettings,
  PublicModelSettings,
  StyleProfile
} from "@/lib/types";
import type { KnowledgeImportDraft } from "@/lib/knowledge-import";

type View = "draft" | "instant" | "library" | "knowledge" | "settings";

const emptyMessage: EmailMessage = {
  role: "received",
  sender: "",
  recipients: [""],
  subject: "",
  body: ""
};

function formatCount(value: number) {
  return `${value} 条对话`;
}

export default function Home() {
  const [view, setView] = useState<View>("draft");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [thread, setThread] = useState<EmailMessage[]>([{ ...emptyMessage }]);
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<DraftResult | null>(null);
  const [instantBody, setInstantBody] = useState("");
  const [instantDraft, setInstantDraft] = useState("");
  const [instantResult, setInstantResult] = useState<DraftResult | null>(null);
  const [instantPlatform, setInstantPlatform] = useState<"whatsapp" | "wechat" | "social-dm" | "social-comment" | "other">("whatsapp");
  const [examples, setExamples] = useState<ConversationExample[]>([]);
  const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(null);
  const [identityProfile, setIdentityProfile] = useState<IdentityProfile | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [modelSettings, setModelSettings] = useState<PublicModelSettings | null>(null);
  const [language, setLanguage] = useState<"auto" | "zh" | "en">("auto");
  const [length, setLength] = useState<"short" | "normal" | "detailed">("normal");
  const [toneMode, setToneMode] = useState<"learned" | "direct" | "polite" | "concise">("learned");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExample, setSelectedExample] = useState<ConversationExample | null>(null);
  const [importPreview, setImportPreview] = useState<{ filename: string; content: string; examples: ConversationExample[] } | null>(null);
  const [knowledgeImportPreview, setKnowledgeImportPreview] = useState<{ filename: string; items: KnowledgeImportDraft[] } | null>(null);
  const [knowledgeAiLoading, setKnowledgeAiLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const knowledgeFileInputRef = useRef<HTMLInputElement>(null);

  const latest = thread.at(-1) ?? emptyMessage;
  const knowledgeCount = examples.filter((item) => item.included).length;
  const factCount = knowledge.filter((item) => item.enabled).length;
  const filteredExamples = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return examples;
    return examples.filter((example) => `${example.subject ?? ""} ${example.messages.map((item) => item.body).join(" ")}`.toLowerCase().includes(query));
  }, [examples, searchTerm]);

  useEffect(() => {
    void refreshData();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function refreshData() {
    const [examplesResponse, styleResponse, identityResponse, knowledgeResponse] = await Promise.all([
      fetch("/api/examples"),
      fetch("/api/style-profile"),
      fetch("/api/identity"),
      fetch("/api/knowledge")
    ]);
    if (examplesResponse.ok) setExamples(await examplesResponse.json());
    if (styleResponse.ok) setStyleProfile(await styleResponse.json());
    if (identityResponse.ok) setIdentityProfile(await identityResponse.json());
    if (knowledgeResponse.ok) setKnowledge(await knowledgeResponse.json());
    const settingsResponse = await fetch("/api/settings");
    if (settingsResponse.ok) setModelSettings(await settingsResponse.json());
  }

  function updateLatest(patch: Partial<EmailMessage>) {
    setThread((current) => current.map((message, index) => index === current.length - 1 ? { ...message, ...patch } : message));
  }

  function resetComposer() {
    setThread([{ ...emptyMessage, recipients: [""] }]);
    setDraft("");
    setResult(null);
  }

  function resetInstantComposer() {
    setInstantBody("");
    setInstantDraft("");
    setInstantResult(null);
  }

  async function generateDraft() {
    if (!latest.body.trim()) {
      setToast("先粘贴一封需要回复的邮件。");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread, language, length, toneMode })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "生成失败");
      setResult(payload);
      setDraft(payload.body);
      setToast(payload.source === "demo" ? "已生成演示草稿。配置模型后可获得完整生成结果。" : "草稿已生成。");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "生成失败，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }

  async function generateInstantReply() {
    if (!instantBody.trim()) {
      setToast("先粘贴一条需要回复的即时消息。");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread: [{ role: "received", subject: instantPlatform, body: instantBody }],
          language,
          length,
          toneMode,
          mode: "instant",
          platform: instantPlatform
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "生成失败");
      setInstantResult(payload);
      setInstantDraft(payload.body);
      setToast(payload.source === "demo" ? "已生成演示回复。配置模型后可获得完整生成结果。" : "即时回复已生成。");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "生成失败，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }

  async function copyDraft() {
    await navigator.clipboard.writeText(draft);
    setToast("草稿已复制。");
  }

  async function copyInstantDraft() {
    await navigator.clipboard.writeText(instantDraft);
    setToast("即时回复已复制。");
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, content, preview: true })
    });
    const payload = await response.json();
    if (!response.ok) {
      setToast(payload.error ?? "导入失败");
      return;
    }
    setImportPreview({ filename: file.name, content, examples: payload.examples });
    setToast(`已解析 ${payload.imported} 条历史对话，请确认后入库。`);
    event.target.value = "";
  }

  async function confirmImport() {
    if (!importPreview) return;
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: importPreview.filename, content: importPreview.content, examples: importPreview.examples })
    });
    const payload = await response.json();
    if (!response.ok) {
      setToast(payload.error ?? "导入失败");
      return;
    }
    setExamples(payload.examples);
    setStyleProfile(payload.styleProfile);
    setImportPreview(null);
    setToast(`已导入 ${payload.imported} 条历史对话。`);
  }

  async function deleteExample(id: string) {
    const response = await fetch(`/api/examples/${id}`, { method: "DELETE" });
    if (response.ok) {
      setExamples((current) => current.filter((example) => example.id !== id));
      if (selectedExample?.id === id) setSelectedExample(null);
      setToast("历史对话已删除。");
    }
  }

  async function exportData() {
    const response = await fetch("/api/export", { method: "POST" });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mail-reply-studio-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setToast("知识库已导出。");
  }

  async function clearData() {
    if (!window.confirm("确定清空全部本地历史对话和语气档案吗？")) return;
    const response = await fetch("/api/data", { method: "DELETE" });
    if (response.ok) {
      await refreshData();
      setToast("本地数据已清空。");
    }
  }

  async function updateExample(example: ConversationExample) {
    const response = await fetch(`/api/examples/${example.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(example)
    });
    if (response.ok) {
      const updated = await response.json();
      setExamples((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelectedExample(updated);
      setToast("历史对话已保存。");
    }
  }

  async function saveModelSettings(settings: ModelSettings) {
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
    if (response.ok) {
      setModelSettings(await response.json());
      setToast("模型设置已保存。");
    }
  }

  async function saveIdentityProfile(profile: IdentityProfile) {
    const response = await fetch("/api/identity", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile)
    });
    if (response.ok) {
      setIdentityProfile(await response.json());
      setToast("身份档案已保存。");
    }
  }

  async function createKnowledgeItem(input: Pick<KnowledgeItem, "title" | "question" | "answer" | "tags">) {
    const response = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    const payload = await response.json();
    if (response.ok) {
      setKnowledge((current) => [payload.item, ...current]);
      if (payload.styleProfile) setStyleProfile(payload.styleProfile);
      setToast("问答已加入知识库。");
    } else {
      setToast(payload.error ?? "保存知识失败。");
    }
  }

  async function updateKnowledgeItem(item: KnowledgeItem) {
    const response = await fetch(`/api/knowledge/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item)
    });
    if (response.ok) {
      const payload = await response.json();
      setKnowledge((current) => current.map((entry) => entry.id === payload.item.id ? payload.item : entry));
      if (payload.styleProfile) setStyleProfile(payload.styleProfile);
      setToast("知识条目已保存。");
    }
  }

  async function deleteKnowledgeItem(id: string) {
    const response = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    if (response.ok) {
      const payload = await response.json();
      setKnowledge((current) => current.filter((item) => item.id !== id));
      if (payload.styleProfile) setStyleProfile(payload.styleProfile);
      setToast("知识条目已删除。");
    }
  }

  async function importKnowledgeFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/knowledge/import", { method: "POST", body: formData });
    const payload = await response.json();
    if (!response.ok) {
      setToast(payload.error ?? "知识文件解析失败。");
      event.target.value = "";
      return;
    }
    setKnowledgeImportPreview({ filename: payload.filename, items: payload.items });
    setToast(`已解析 ${payload.count} 条问答，请确认后加入知识库。`);
    event.target.value = "";
  }

  async function importKnowledgeWithAi(text: string) {
    const content = text.trim();
    if (!content) {
      setToast("先粘贴一段需要整理的内容。");
      return;
    }
    setKnowledgeAiLoading(true);
    try {
      const response = await fetch("/api/knowledge/ai-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "AI 整理失败。");
      setKnowledgeImportPreview({ filename: payload.filename, items: payload.items });
      setToast(payload.warning ?? `AI 已整理出 ${payload.count} 条问答，请确认后加入知识库。`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "AI 整理失败，请检查模型设置。");
    } finally {
      setKnowledgeAiLoading(false);
    }
  }

  async function confirmKnowledgeImport() {
    if (!knowledgeImportPreview) return;
    const response = await fetch("/api/knowledge/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: knowledgeImportPreview.items })
    });
    const payload = await response.json();
    if (!response.ok) {
      setToast(payload.error ?? "知识导入失败。");
      return;
    }
    setKnowledge((current) => [...payload.items, ...current]);
    if (payload.styleProfile) setStyleProfile(payload.styleProfile);
    setKnowledgeImportPreview(null);
    setToast(`已加入 ${payload.imported} 条问答知识。`);
  }

  function openView(nextView: View) {
    setView(nextView);
    setMobileNavOpen(false);
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Sparkles size={16} strokeWidth={2.4} /></div>
          <span>用你的语气回复</span>
        </div>
        <button className="new-draft" onClick={() => { resetComposer(); openView("draft"); }}>
          <span>+</span> 新建回复
        </button>
        <nav className="nav-list">
          <button className={view === "draft" ? "nav-item active" : "nav-item"} onClick={() => openView("draft")}><FileText size={17} /> 写回复</button>
          <button className={view === "instant" ? "nav-item active" : "nav-item"} onClick={() => openView("instant")}><MessageCircle size={17} /> 即时回复</button>
          <button className={view === "library" ? "nav-item active" : "nav-item"} onClick={() => openView("library")}><Archive size={17} /> 语气库 <span className="nav-count">{knowledgeCount}</span></button>
          <button className={view === "knowledge" ? "nav-item active" : "nav-item"} onClick={() => openView("knowledge")}><BookOpen size={17} /> 知识库 <span className="nav-count">{factCount}</span></button>
          <button className={view === "settings" ? "nav-item active" : "nav-item"} onClick={() => openView("settings")}><Settings size={17} /> 设置</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note"><span className="status-dot" /> 本地工作区</div>
          <p>你的草稿、语气库和知识库只保存在这台设备上。</p>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNavOpen((open) => !open)} aria-label="打开导航"><Menu size={19} /></button>
          <div>
            <p className="eyebrow">{view === "instant" ? "即时消息回复助手" : "邮件回复助手"}</p>
            <h1>{view === "draft" ? "写一封回复" : view === "instant" ? "即时回复" : view === "library" ? "语气库" : view === "knowledge" ? "知识库" : "设置"}</h1>
          </div>
          <div className="topbar-actions">
            <span className="local-pill"><span className="status-dot" /> 已保存在本地</span>
            {view === "draft" && <button className="quiet-button" onClick={resetComposer}><RefreshCw size={15} /> 重置</button>}
            {view === "instant" && <button className="quiet-button" onClick={resetInstantComposer}><RefreshCw size={15} /> 重置</button>}
          </div>
        </header>

        {view === "draft" && (
          <div className="workspace-grid">
            <section className="composer-column">
              <div className="section-heading">
                <div><span className="step">01</span><div><p className="section-kicker">收到的邮件</p><h2>你想回复哪封邮件？</h2></div></div>
                <span className="tiny-label">纯文本</span>
              </div>
              <div className="email-card">
                <div className="email-meta-grid">
                  <label>发件人<input value={latest.sender ?? ""} placeholder="name@company.com" onChange={(event) => updateLatest({ sender: event.target.value })} /></label>
                  <label>收件人<input value={latest.recipients?.[0] ?? ""} placeholder="you@company.com" onChange={(event) => updateLatest({ recipients: [event.target.value] })} /></label>
                  <label className="full-field">主题<input value={latest.subject ?? ""} placeholder="填写主题，便于找到相似历史对话" onChange={(event) => updateLatest({ subject: event.target.value })} /></label>
                </div>
                <label className="body-label">邮件正文<textarea className="incoming-textarea" value={latest.body} placeholder={"把邮件粘贴到这里…\n\n可以包含完整邮件线程。助手会保留上下文，只起草你的回复。"} onChange={(event) => updateLatest({ body: event.target.value })} /></label>
                <div className="card-footer"><span><Inbox size={14} /> 内容只保留在当前浏览器</span><span>{latest.body.length} 字</span></div>
              </div>

              <div className="section-heading preferences-heading">
                <div><span className="step">02</span><div><p className="section-kicker">回复偏好</p><h2>先定好长度，保留你的语气</h2></div></div>
              </div>
              <div className="preference-row">
                <div className="preference-control"><span>语言</span><select value={language} onChange={(event) => setLanguage(event.target.value as typeof language)}><option value="auto">自动识别</option><option value="zh">中文</option><option value="en">英文</option></select></div>
                <div className="preference-control"><span>长度</span><select value={length} onChange={(event) => setLength(event.target.value as typeof length)}><option value="short">简短</option><option value="normal">正常</option><option value="detailed">详细</option></select></div>
                <div className="preference-control"><span>语气</span><select value={toneMode} onChange={(event) => setToneMode(event.target.value as typeof toneMode)}><option value="learned">保持我的语气</option><option value="direct">更直接</option><option value="polite">更客气</option><option value="concise">更简洁</option></select></div>
              </div>
              <button className="generate-button" onClick={() => void generateDraft()} disabled={loading}><Sparkles size={17} /> {loading ? "正在起草…" : "生成回复"} <ArrowUpRight size={16} /></button>

              <div className="section-heading result-heading">
                <div><span className="step">03</span><div><p className="section-kicker">你的草稿</p><h2>发送前，再改成你自己的话</h2></div></div>
                {result && <button className="copy-button" onClick={() => void copyDraft()}><Clipboard size={15} /> 复制</button>}
              </div>
              <div className={`draft-card ${draft ? "draft-ready" : ""}`}>
                {draft ? <textarea value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="可编辑的回复草稿" /> : <div className="empty-draft"><Sparkles size={20} /><p>你的回复会显示在这里</p><span>我们会尽量贴近你过去的表达。</span></div>}
                {draft && <div className="card-footer"><span><Check size={14} /> 可编辑草稿</span><span>{draft.length} 字</span></div>}
              </div>
            </section>

            <aside className="insight-column">
              <div className="insight-panel">
                <div className="panel-heading"><div><span className="panel-label">语气匹配</span><h3>在上下文里保持你的语气</h3></div><span className="match-score">{styleProfile && (knowledgeCount > 0 || factCount > 0) ? "已启用" : "待学习"}</span></div>
                <div className="voice-bars"><div><span>直接程度</span><i><b style={{ width: styleProfile?.formality === "formal" ? "46%" : "72%" }} /></i></div><div><span>亲和程度</span><i><b style={{ width: toneMode === "polite" ? "78%" : "58%" }} /></i></div><div><span>详细程度</span><i><b style={{ width: length === "detailed" ? "82%" : length === "short" ? "34%" : "57%" }} /></i></div></div>
                <div className="profile-note"><span className="note-mark">↗</span><p>{knowledgeCount ? `已从语气库中的 ${formatCount(knowledgeCount)} 学习。` : "导入几封你发出的历史邮件，让助手学习你的表达节奏。"}</p></div>
              </div>
              <div className="insight-panel references-panel">
                <div className="panel-heading"><div><span className="panel-label">参考对话</span><h3>最接近的历史回复</h3></div><button className="text-button" onClick={() => openView("library")}>查看全部 <ArrowUpRight size={13} /></button></div>
                {result?.usedExamples?.length ? result.usedExamples.map((item) => <div className="reference-item" key={item}><span className="reference-dot" /><span>{item}</span></div>) : <div className="empty-reference"><Search size={16} /><span>生成回复后，相关历史对话会显示在这里。</span></div>}
              </div>
              <div className="insight-panel knowledge-panel">
                <div className="panel-heading"><div><span className="panel-label">知识库依据</span><h3>这封回复用了什么事实</h3></div><BookOpen size={17} /></div>
                {result?.usedKnowledge?.length ? result.usedKnowledge.map((item) => <div className="knowledge-reference" key={item.id}><strong>{item.title}</strong><span>{item.answerExcerpt}</span></div>) : <div className="empty-reference"><BookOpen size={16} /><span>匹配到的身份和问答内容会显示在这里。</span></div>}
              </div>
              <div className="insight-panel uncertainty-panel"><div className="panel-heading"><div><span className="panel-label">发送前检查</span><h3>需要确认的内容</h3></div><AlertCircle size={17} /></div>{result?.uncertaintyItems?.length ? result.uncertaintyItems.map((item) => <div className="uncertainty-item" key={item.text}><AlertCircle size={14} /><div><strong>{item.text}</strong><span>{item.reason}</span></div></div>) : <div className="clear-state"><Check size={16} /><span>目前没有待确认项。发现具体信息需要核实时，我们会在这里提醒你。</span></div>}</div>
            </aside>
          </div>
        )}

        {view === "instant" && (
          <InstantReplyView
            body={instantBody}
            setBody={setInstantBody}
            platform={instantPlatform}
            setPlatform={setInstantPlatform}
            language={language}
            setLanguage={setLanguage}
            length={length}
            setLength={setLength}
            toneMode={toneMode}
            setToneMode={setToneMode}
            draft={instantDraft}
            setDraft={setInstantDraft}
            result={instantResult}
            loading={loading}
            onGenerate={() => void generateInstantReply()}
            onCopy={() => void copyInstantDraft()}
            onOpenLibrary={() => openView("library")}
            styleProfile={styleProfile}
            knowledgeCount={knowledgeCount}
            factCount={factCount}
          />
        )}

        {view === "library" && <LibraryView examples={filteredExamples} searchTerm={searchTerm} setSearchTerm={setSearchTerm} onImport={() => fileInputRef.current?.click()} onExport={() => void exportData()} onSelect={setSelectedExample} onDelete={(id) => void deleteExample(id)} />}
        {view === "knowledge" && <KnowledgeView identityProfile={identityProfile} knowledge={knowledge} aiLoading={knowledgeAiLoading} onImport={() => knowledgeFileInputRef.current?.click()} onAiImport={importKnowledgeWithAi} onSaveIdentity={saveIdentityProfile} onCreate={createKnowledgeItem} onSave={updateKnowledgeItem} onDelete={deleteKnowledgeItem} />}
        {view === "settings" && <SettingsView styleProfile={styleProfile} modelSettings={modelSettings} onSave={async (profile) => { const response = await fetch("/api/style-profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) }); if (response.ok) { setStyleProfile(profile); setToast("语气设置已保存。"); } }} onSaveModel={saveModelSettings} onClear={() => void clearData()} onExport={() => void exportData()} />}
      </section>

      <input ref={fileInputRef} type="file" accept=".txt,.md,.markdown,.csv,.json" hidden onChange={(event) => void importFile(event)} />
      <input ref={knowledgeFileInputRef} type="file" accept=".docx,.eml,.txt,.md,.markdown,.csv,.json,message/rfc822" hidden onChange={(event) => void importKnowledgeFile(event)} />
      {selectedExample && <ExampleModal example={selectedExample} onClose={() => setSelectedExample(null)} onSave={updateExample} />}
      {importPreview && <ImportPreviewModal preview={importPreview} onCancel={() => setImportPreview(null)} onConfirm={() => void confirmImport()} onChange={(examples) => setImportPreview({ ...importPreview, examples })} />}
      {knowledgeImportPreview && <KnowledgeImportModal preview={knowledgeImportPreview} onCancel={() => setKnowledgeImportPreview(null)} onConfirm={() => void confirmKnowledgeImport()} onChange={(items) => setKnowledgeImportPreview({ ...knowledgeImportPreview, items })} />}
      {toast && <div className="toast"><Check size={15} /> {toast}</div>}
    </main>
  );
}

function InstantReplyView({
  body,
  setBody,
  platform,
  setPlatform,
  language,
  setLanguage,
  length,
  setLength,
  toneMode,
  setToneMode,
  draft,
  setDraft,
  result,
  loading,
  onGenerate,
  onCopy,
  onOpenLibrary,
  styleProfile,
  knowledgeCount,
  factCount
}: {
  body: string;
  setBody: (value: string) => void;
  platform: "whatsapp" | "wechat" | "social-dm" | "social-comment" | "other";
  setPlatform: (value: "whatsapp" | "wechat" | "social-dm" | "social-comment" | "other") => void;
  language: "auto" | "zh" | "en";
  setLanguage: (value: "auto" | "zh" | "en") => void;
  length: "short" | "normal" | "detailed";
  setLength: (value: "short" | "normal" | "detailed") => void;
  toneMode: "learned" | "direct" | "polite" | "concise";
  setToneMode: (value: "learned" | "direct" | "polite" | "concise") => void;
  draft: string;
  setDraft: (value: string) => void;
  result: DraftResult | null;
  loading: boolean;
  onGenerate: () => void;
  onCopy: () => void;
  onOpenLibrary: () => void;
  styleProfile: StyleProfile | null;
  knowledgeCount: number;
  factCount: number;
}) {
  return (
    <div className="workspace-grid instant-workspace">
      <section className="composer-column">
        <div className="section-heading">
          <div><span className="step">01</span><div><p className="section-kicker">即时消息</p><h2>你想回复哪条留言？</h2></div></div>
          <span className="tiny-label">WhatsApp · 微信 · 社媒</span>
        </div>
        <div className="email-card instant-input-card">
          <div className="instant-platform-row">
            <label>平台<select value={platform} onChange={(event) => setPlatform(event.target.value as typeof platform)}>
              <option value="whatsapp">WhatsApp</option>
              <option value="wechat">微信</option>
              <option value="social-dm">社媒私信</option>
              <option value="social-comment">社媒评论</option>
              <option value="other">其他</option>
            </select></label>
          </div>
          <label className="body-label">对方的消息<textarea className="incoming-textarea instant-incoming-textarea" value={body} placeholder={"把对方的消息粘贴到这里…\n\n可以是一条 WhatsApp、微信、私信或评论。"} onChange={(event) => setBody(event.target.value)} /></label>
          <div className="card-footer"><span><MessageCircle size={14} /> 只输出一整段回复</span><span>{body.length} 字</span></div>
        </div>

        <div className="section-heading preferences-heading">
          <div><span className="step">02</span><div><p className="section-kicker">回复偏好</p><h2>自然一点，像你平时发消息</h2></div></div>
        </div>
        <div className="preference-row">
          <div className="preference-control"><span>语言</span><select value={language} onChange={(event) => setLanguage(event.target.value as typeof language)}><option value="auto">自动识别</option><option value="zh">中文</option><option value="en">英文</option></select></div>
          <div className="preference-control"><span>长度</span><select value={length} onChange={(event) => setLength(event.target.value as typeof length)}><option value="short">简短</option><option value="normal">正常</option><option value="detailed">详细</option></select></div>
          <div className="preference-control"><span>语气</span><select value={toneMode} onChange={(event) => setToneMode(event.target.value as typeof toneMode)}><option value="learned">保持我的语气</option><option value="direct">更直接</option><option value="polite">更客气</option><option value="concise">更简洁</option></select></div>
        </div>
        <button className="generate-button" onClick={onGenerate} disabled={loading}><Sparkles size={17} /> {loading ? "正在生成…" : "生成即时回复"} <ArrowUpRight size={16} /></button>

        <div className="section-heading result-heading">
          <div><span className="step">03</span><div><p className="section-kicker">你的回复</p><h2>复制前，按需要改几处</h2></div></div>
          {result && <button className="copy-button" onClick={onCopy}><Clipboard size={15} /> 复制回复</button>}
        </div>
        <div className={`draft-card instant-draft-card ${draft ? "draft-ready" : ""}`}>
          {draft ? <textarea value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="可编辑的即时回复" /> : <div className="empty-draft"><MessageCircle size={20} /><p>你的即时回复会显示在这里</p><span>输出会保持为一整段，不带邮件主题和落款。</span></div>}
          {draft && <div className="card-footer"><span><Check size={14} /> 可编辑回复</span><span>{draft.length} 字</span></div>}
        </div>
      </section>

      <aside className="insight-column">
        <div className="insight-panel">
          <div className="panel-heading"><div><span className="panel-label">即时语气</span><h3>保留你的聊天习惯</h3></div><span className="match-score">{styleProfile && (knowledgeCount > 0 || factCount > 0) ? "已启用" : "待学习"}</span></div>
          <div className="voice-bars"><div><span>直接程度</span><i><b style={{ width: styleProfile?.formality === "formal" ? "46%" : "72%" }} /></i></div><div><span>亲和程度</span><i><b style={{ width: toneMode === "polite" ? "78%" : "58%" }} /></i></div><div><span>详细程度</span><i><b style={{ width: length === "detailed" ? "82%" : length === "short" ? "34%" : "57%" }} /></i></div></div>
          <div className="profile-note"><span className="note-mark">↗</span><p>{knowledgeCount ? `已从语气库中的 ${formatCount(knowledgeCount)} 学习。` : "导入过去的回复，让助手学习你的表达节奏。"}</p></div>
        </div>
        <div className="insight-panel references-panel">
          <div className="panel-heading"><div><span className="panel-label">参考回复</span><h3>最接近的历史表达</h3></div><button className="text-button" onClick={onOpenLibrary}>查看全部 <ArrowUpRight size={13} /></button></div>
          {result?.usedExamples?.length ? result.usedExamples.map((item) => <div className="reference-item" key={item}><span className="reference-dot" /><span>{item}</span></div>) : <div className="empty-reference"><Search size={16} /><span>生成后，相关历史回复会显示在这里。</span></div>}
        </div>
        <div className="insight-panel knowledge-panel">
          <div className="panel-heading"><div><span className="panel-label">知识库依据</span><h3>这条回复用了什么内容</h3></div><BookOpen size={17} /></div>
          {result?.usedKnowledge?.length ? result.usedKnowledge.map((item) => <div className="knowledge-reference" key={item.id}><strong>{item.title}</strong><span>{item.answerExcerpt}</span></div>) : <div className="empty-reference"><BookOpen size={16} /><span>匹配到的问答内容会显示在这里。</span></div>}
        </div>
        <div className="insight-panel uncertainty-panel"><div className="panel-heading"><div><span className="panel-label">发送前检查</span><h3>需要确认的内容</h3></div><AlertCircle size={17} /></div>{result?.uncertaintyItems?.length ? result.uncertaintyItems.map((item) => <div className="uncertainty-item" key={item.text}><AlertCircle size={14} /><div><strong>{item.text}</strong><span>{item.reason}</span></div></div>) : <div className="clear-state"><Check size={16} /><span>目前没有待确认项。具体信息需要核实时，我们会在这里提醒你。</span></div>}</div>
      </aside>
    </div>
  );
}

function LibraryView({ examples, searchTerm, setSearchTerm, onImport, onExport, onSelect, onDelete }: { examples: ConversationExample[]; searchTerm: string; setSearchTerm: (value: string) => void; onImport: () => void; onExport: () => void; onSelect: (example: ConversationExample) => void; onDelete: (id: string) => void }) {
  return <div className="library-layout"><div className="library-toolbar"><div className="search-box"><Search size={16} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="搜索历史对话…" /></div><div className="toolbar-actions"><button className="quiet-button" onClick={onExport}><FileDown size={15} /> 导出</button><button className="generate-button small" onClick={onImport}><Upload size={15} /> 导入历史邮件</button></div></div><div className="library-header-row"><span>语气库中有 {formatCount(examples.length)}</span><span>语气特征与知识库共用来源</span></div>{examples.length ? <div className="thread-list">{examples.map((example) => <button className="thread-row" key={example.id} onClick={() => onSelect(example)}><div className="thread-icon"><MailIcon /></div><div className="thread-main"><strong>{example.subject || "未命名对话"}</strong><span>{example.messages.at(-1)?.body.slice(0, 120) || "空邮件"}</span></div><div className="thread-tags"><span>{example.language === "zh" ? "中文" : example.language === "en" ? "英文" : "中英混合"}</span><span>{example.messages.length} 条消息</span></div><button className="row-delete" aria-label="删除历史对话" onClick={(event) => { event.stopPropagation(); onDelete(example.id); }}><Trash2 size={15} /></button></button>)}</div> : <div className="large-empty"><Archive size={24} /><h3>语气库还是空的</h3><p>导入几封过去的邮件，或在知识库添加问答，我们就能学习你的表达方式。</p><button className="generate-button small" onClick={onImport}><Upload size={15} /> 导入历史邮件</button></div>}</div>;
}

function KnowledgeView({
  identityProfile,
  knowledge,
  aiLoading,
  onImport,
  onAiImport,
  onSaveIdentity,
  onCreate,
  onSave,
  onDelete
}: {
  identityProfile: IdentityProfile | null;
  knowledge: KnowledgeItem[];
  aiLoading: boolean;
  onImport: () => void;
  onAiImport: (text: string) => Promise<void>;
  onSaveIdentity: (profile: IdentityProfile) => Promise<void>;
  onCreate: (input: Pick<KnowledgeItem, "title" | "question" | "answer" | "tags">) => Promise<void>;
  onSave: (item: KnowledgeItem) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [identity, setIdentity] = useState<IdentityProfile | null>(identityProfile);
  const [newItem, setNewItem] = useState({ title: "", question: "", answer: "", tags: "" });
  const [rawKnowledgeText, setRawKnowledgeText] = useState("");
  const [expandedKnowledgeId, setExpandedKnowledgeId] = useState<string | null>(null);
  useEffect(() => setIdentity(identityProfile), [identityProfile]);
  if (!identity) return <div className="loading-state">正在加载知识库…</div>;

  async function addItem() {
    if (!newItem.question.trim() || !newItem.answer.trim()) return;
    await onCreate({
      title: newItem.title.trim(),
      question: newItem.question.trim(),
      answer: newItem.answer.trim(),
      tags: newItem.tags.split(/[,，\n]/).map((tag) => tag.trim()).filter(Boolean)
    });
    setNewItem({ title: "", question: "", answer: "", tags: "" });
  }

  return <div className="knowledge-layout">
    <div className="knowledge-intro">
      <div><span className="panel-label">身份与事实</span><h2>让助手知道“你是谁”，也知道“该怎么答”。</h2><p>身份档案会参与每次生成；启用的问答条目会被检索，也会同时参与语气提取，不需要重复导入到语气库。</p></div>
      <div className="knowledge-stats"><span><strong>{knowledge.filter((item) => item.enabled).length}</strong> 条启用知识</span><span><strong>{knowledge.filter((item) => !item.enabled).length}</strong> 条已停用</span></div>
    </div>
    <section className="identity-card">
      <div className="knowledge-section-heading"><div><span className="step">01</span><div><p className="section-kicker">身份档案</p><h3>回复时，你代表谁？</h3></div></div><BookOpen size={18} /></div>
      <div className="identity-grid">
        <label>姓名或称呼<input value={identity.name} onChange={(event) => setIdentity({ ...identity, name: event.target.value })} placeholder="例如：张三" /></label>
        <label>身份角色<input value={identity.role} onChange={(event) => setIdentity({ ...identity, role: event.target.value })} placeholder="例如：产品负责人、顾问、招聘经理" /></label>
        <label>公司或组织<input value={identity.organization} onChange={(event) => setIdentity({ ...identity, organization: event.target.value })} placeholder="例如：某某科技" /></label>
        <label>擅长领域<input value={identity.expertise} onChange={(event) => setIdentity({ ...identity, expertise: event.target.value })} placeholder="用逗号分隔多个领域" /></label>
        <label className="full-field">补充背景<textarea value={identity.context} onChange={(event) => setIdentity({ ...identity, context: event.target.value })} placeholder="填写长期有效的背景、职责边界或回复时需要注意的事实。" /></label>
      </div>
      <button className="generate-button small" onClick={() => void onSaveIdentity(identity)}><Check size={15} /> 保存身份档案</button>
    </section>
    <section className="knowledge-section">
      <div className="knowledge-section-heading"><div><span className="step">02</span><div><p className="section-kicker">AI 整理</p><h3>直接丢一整段内容进来</h3></div></div><div className="knowledge-heading-actions"><span className="tiny-label">DeepSeek / OpenAI-compatible</span><button className="quiet-button" onClick={onImport}><Upload size={15} /> 从文件导入</button></div></div>
      <div className="knowledge-ai-import">
        <label>原始内容<textarea value={rawKnowledgeText} onChange={(event) => setRawKnowledgeText(event.target.value)} placeholder={"把客户聊天记录、邮件往来、产品说明、你以前回答过的内容直接粘贴到这里。\n\nAI 会自动识别哪些内容适合沉淀成问答知识；整理结果会先给你预览，不会直接入库。"} /></label>
        <div className="knowledge-ai-footer">
          <span>{rawKnowledgeText.length} 字</span>
          <div className="toolbar-actions">
            <button className="quiet-button" onClick={() => setRawKnowledgeText("")}>清空</button>
            <button className="generate-button small" disabled={aiLoading || !rawKnowledgeText.trim()} onClick={() => void onAiImport(rawKnowledgeText)}><Sparkles size={15} /> {aiLoading ? "AI 正在整理…" : "AI 整理为问答"}</button>
          </div>
        </div>
      </div>
    </section>
    <section className="knowledge-section">
      <div className="knowledge-section-heading"><div><span className="step">03</span><div><p className="section-kicker">手动补充</p><h3>也可以单独添加一条问答</h3></div></div><span className="tiny-label">可检索</span></div>
      <div className="knowledge-create">
        <label>标题<input value={newItem.title} onChange={(event) => setNewItem({ ...newItem, title: event.target.value })} placeholder="例如：服务介绍" /></label>
        <label>问题<textarea value={newItem.question} onChange={(event) => setNewItem({ ...newItem, question: event.target.value })} placeholder="别人通常会怎么问？" /></label>
        <label>标准答案<textarea value={newItem.answer} onChange={(event) => setNewItem({ ...newItem, answer: event.target.value })} placeholder="你希望助手依据什么内容来回答？" /></label>
        <label>标签<input value={newItem.tags} onChange={(event) => setNewItem({ ...newItem, tags: event.target.value })} placeholder="例如：产品、价格、合作" /></label>
        <button className="generate-button small" onClick={() => void addItem()}><span>+</span> 添加问答</button>
      </div>
    </section>
    <section className="knowledge-section">
      <div className="knowledge-section-heading"><div><span className="step">04</span><div><p className="section-kicker">已入库</p><h3>之后回复会引用这些内容</h3></div></div><span className="tiny-label">{knowledge.length} 条 · 点击展开</span></div>
      <div className="knowledge-list">
        {knowledge.length ? knowledge.map((item) => <KnowledgeRow key={item.id} item={item} expanded={expandedKnowledgeId === item.id} onToggle={() => setExpandedKnowledgeId((current) => current === item.id ? null : item.id)} onSave={onSave} onDelete={onDelete} />) : <div className="large-empty knowledge-empty"><BookOpen size={24} /><h3>还没有问答知识</h3><p>把你经常解释的内容写成问题和答案，之后相同问题就能直接复用。</p></div>}
      </div>
    </section>
  </div>;
}

function KnowledgeRow({ item, expanded, onToggle, onSave, onDelete }: { item: KnowledgeItem; expanded: boolean; onToggle: () => void; onSave: (item: KnowledgeItem) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [draft, setDraft] = useState(item);
  useEffect(() => setDraft(item), [item]);
  return <article className={`knowledge-row ${draft.enabled ? "" : "disabled"} ${expanded ? "expanded" : ""}`}>
    <div className="knowledge-row-summary">
      <button className="knowledge-row-toggle" type="button" onClick={onToggle} aria-expanded={expanded}>
        <ChevronDown size={17} className="knowledge-row-chevron" />
        <span className="knowledge-row-summary-copy">
          <strong>{draft.title || draft.question || "未命名知识"}</strong>
          <span>{draft.question || "没有填写问题"}{draft.answer ? ` · ${draft.answer.slice(0, 100)}${draft.answer.length > 100 ? "…" : ""}` : ""}</span>
        </span>
      </button>
      <div className="knowledge-row-actions">
        <span className="knowledge-status">{draft.enabled ? "已启用" : "已停用"}</span>
        <label className="checkbox-label"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} /> 用于生成</label>
        <button className="row-delete" aria-label="删除知识条目" onClick={() => void onDelete(draft.id)}><Trash2 size={15} /></button>
      </div>
    </div>
    {expanded && <div className="knowledge-row-details">
      <label className="knowledge-row-title-field">标题<input className="knowledge-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <div className="knowledge-row-grid"><label>问题<textarea value={draft.question} onChange={(event) => setDraft({ ...draft, question: event.target.value })} /></label><label>答案<textarea value={draft.answer} onChange={(event) => setDraft({ ...draft, answer: event.target.value })} /></label></div>
      <div className="knowledge-row-footer"><input value={draft.tags.join("，")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) })} placeholder="标签" /><button className="quiet-button" onClick={() => void onSave(draft)}><Check size={14} /> 保存条目</button></div>
    </div>}
  </article>;
}

function SettingsView({ styleProfile, modelSettings, onSave, onSaveModel, onClear, onExport }: { styleProfile: StyleProfile | null; modelSettings: PublicModelSettings | null; onSave: (profile: StyleProfile) => Promise<void>; onSaveModel: (settings: ModelSettings) => Promise<void>; onClear: () => void; onExport: () => void }) {
  const [draft, setDraft] = useState<StyleProfile | null>(styleProfile);
  const [modelDraft, setModelDraft] = useState<ModelSettings | null>(modelSettings ? { ...modelSettings, apiKey: "" } : null);
  useEffect(() => setDraft(styleProfile), [styleProfile]);
  useEffect(() => setModelDraft(modelSettings ? { ...modelSettings, apiKey: "" } : null), [modelSettings]);
  if (!draft || !modelDraft) return <div className="loading-state">正在加载设置…</div>;
  return <div className="settings-layout"><div className="settings-intro"><span className="panel-label">个人校准</span><h2>让每一封回复都像你写的。</h2><p>这些设置会影响每次生成。助手会从你导入的历史回复中学习，也允许你随时修正它的习惯。</p></div><div className="settings-section"><label>常用开头<textarea value={draft.preferredOpenings.join("\n")} onChange={(event) => setDraft({ ...draft, preferredOpenings: event.target.value.split("\n").filter(Boolean) })} placeholder="每行填写一个表达" /></label><label>常用结尾<textarea value={draft.preferredClosings.join("\n")} onChange={(event) => setDraft({ ...draft, preferredClosings: event.target.value.split("\n").filter(Boolean) })} placeholder="每行填写一个表达" /></label><label>需要避免的表达<textarea value={draft.avoidPhrases.join("\n")} onChange={(event) => setDraft({ ...draft, avoidPhrases: event.target.value.split("\n").filter(Boolean) })} placeholder="每行填写一个表达" /></label><div className="setting-grid"><label>正式程度<select value={draft.formality} onChange={(event) => setDraft({ ...draft, formality: event.target.value as StyleProfile["formality"] })}><option value="casual">偏口语</option><option value="neutral">中性</option><option value="formal">正式</option></select></label><label>句子长度<select value={draft.sentenceLength} onChange={(event) => setDraft({ ...draft, sentenceLength: event.target.value as StyleProfile["sentenceLength"] })}><option value="short">短句</option><option value="medium">适中</option><option value="long">长句</option></select></label></div><label className="checkbox-label"><input type="checkbox" checked={draft.usesBullets} onChange={(event) => setDraft({ ...draft, usesBullets: event.target.checked })} /> 内容合适时使用项目符号</label><button className="generate-button small" onClick={() => void onSave(draft)}><Check size={15} /> 保存语气设置</button></div><div className="settings-section model-settings"><div><span className="panel-label">模型连接</span><h3>可选的云端模型</h3><p>留空表示保留当前密钥。密钥只保存在本机，不会返回到浏览器。</p></div><label>服务商<input value={modelDraft.provider} onChange={(event) => setModelDraft({ ...modelDraft, provider: event.target.value })} /></label><label>接口地址<input value={modelDraft.baseUrl} onChange={(event) => setModelDraft({ ...modelDraft, baseUrl: event.target.value })} /></label><label>模型名称<input value={modelDraft.model} onChange={(event) => setModelDraft({ ...modelDraft, model: event.target.value })} /></label><label>API 密钥<input type="password" value={modelDraft.apiKey} onChange={(event) => setModelDraft({ ...modelDraft, apiKey: event.target.value })} placeholder={modelSettings?.hasApiKey ? "密钥已保存在本机，输入新密钥可替换" : "sk-…"} /></label><button className="generate-button small" onClick={() => void onSaveModel(modelDraft)}><Check size={15} /> 保存模型设置</button></div><div className="danger-zone"><div><span className="panel-label">数据管理</span><h3>你的本地数据</h3><p>清空前建议先导出备份。清空会删除本地语气库和语气设置。</p></div><div className="toolbar-actions"><button className="quiet-button" onClick={onExport}><FileDown size={15} /> 导出备份</button><button className="danger-button" onClick={onClear}><Trash2 size={15} /> 清空全部数据</button></div></div></div>;
}

function ExampleModal({ example, onClose, onSave }: { example: ConversationExample; onClose: () => void; onSave: (example: ConversationExample) => Promise<void> }) {
  const [draft, setDraft] = useState(example);
  return <div className="modal-backdrop" onClick={onClose}><div className="example-modal" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="panel-label">参考对话</span><input className="modal-subject" value={draft.subject ?? ""} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} placeholder="未命名对话" /></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button></div><div className="modal-messages">{draft.messages.map((message, index) => <div className={`modal-message ${message.role}`} key={`${message.id ?? index}`}><select value={message.role} onChange={(event) => setDraft({ ...draft, messages: draft.messages.map((item, itemIndex) => itemIndex === index ? { ...item, role: event.target.value as EmailMessage["role"] } : item) })}><option value="received">收到的邮件</option><option value="sent">我的回复</option></select><textarea value={message.body} onChange={(event) => setDraft({ ...draft, messages: draft.messages.map((item, itemIndex) => itemIndex === index ? { ...item, body: event.target.value } : item) })} /></div>)}</div><div className="modal-actions"><button className="quiet-button" onClick={onClose}>取消</button><button className="generate-button small" onClick={() => void onSave(draft)}><Check size={15} /> 保存修改</button></div></div></div>;
}

function ImportPreviewModal({ preview, onCancel, onConfirm, onChange }: { preview: { filename: string; content: string; examples: ConversationExample[] }; onCancel: () => void; onConfirm: () => void; onChange: (examples: ConversationExample[]) => void }) {
  return <div className="modal-backdrop" onClick={onCancel}><div className="example-modal import-modal" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="panel-label">导入预览</span><h2>确认后再加入语气库</h2><p className="modal-subtitle">{preview.filename} · {preview.examples.length} 条对话</p></div><button className="icon-button" onClick={onCancel} aria-label="关闭"><X size={18} /></button></div><div className="import-preview-list">{preview.examples.map((example, index) => <div className="import-preview-row" key={example.id}><input value={example.subject ?? ""} onChange={(event) => onChange(preview.examples.map((item, itemIndex) => itemIndex === index ? { ...item, subject: event.target.value } : item))} placeholder="邮件主题" /><div className="preview-body"><select value={example.messages[0]?.role ?? "received"} onChange={(event) => onChange(preview.examples.map((item, itemIndex) => itemIndex === index ? { ...item, messages: item.messages.map((message, messageIndex) => messageIndex === 0 ? { ...message, role: event.target.value as EmailMessage["role"] } : message) } : item))}><option value="received">收到的邮件</option><option value="sent">我的回复</option></select><textarea value={example.messages[0]?.body ?? ""} onChange={(event) => onChange(preview.examples.map((item, itemIndex) => itemIndex === index ? { ...item, messages: [{ ...(item.messages[0] ?? { role: "received" }), body: event.target.value }, ...item.messages.slice(1)] } : item))} /></div></div>)}</div><div className="modal-actions"><button className="quiet-button" onClick={onCancel}>取消</button><button className="generate-button small" onClick={onConfirm}><Check size={15} /> 加入语气库</button></div></div></div>;
}

function KnowledgeImportModal({ preview, onCancel, onConfirm, onChange }: { preview: { filename: string; items: KnowledgeImportDraft[] }; onCancel: () => void; onConfirm: () => void; onChange: (items: KnowledgeImportDraft[]) => void }) {
  return <div className="modal-backdrop" onClick={onCancel}><div className="example-modal knowledge-import-modal" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="panel-label">知识导入预览</span><h2>检查自动解析出的问答</h2><p className="modal-subtitle">{preview.filename} · {preview.items.length} 条问答</p></div><button className="icon-button" onClick={onCancel} aria-label="关闭"><X size={18} /></button></div><div className="knowledge-import-list">{preview.items.map((item, index) => <div className="knowledge-import-card" key={`${item.question}-${index}`}><div className="knowledge-import-card-top"><span>第 {index + 1} 条</span><button className="row-delete" aria-label="移除这条问答" onClick={() => onChange(preview.items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button></div><label>标题<input value={item.title} onChange={(event) => onChange(preview.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, title: event.target.value } : entry))} /></label><label>问题<textarea value={item.question} onChange={(event) => onChange(preview.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, question: event.target.value } : entry))} /></label><label>答案<textarea value={item.answer} onChange={(event) => onChange(preview.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, answer: event.target.value } : entry))} /></label><label>标签<input value={item.tags.join("，")} onChange={(event) => onChange(preview.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, tags: event.target.value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) } : entry))} placeholder="可选，用逗号分隔" /></label></div>)}</div><div className="modal-actions"><button className="quiet-button" onClick={onCancel}>取消</button><button className="generate-button small" disabled={!preview.items.length} onClick={onConfirm}><Check size={15} /> 加入知识库</button></div></div></div>;
}

function MailIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="17" height="17"><path d="M4 5.5h16v13H4z" /><path d="m4.5 7 7.5 5 7.5-5" /></svg>;
}
