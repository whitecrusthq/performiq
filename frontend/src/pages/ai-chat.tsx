import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import {
  Send,
  Loader2,
  Bot,
  User,
  Trash2,
  Settings2,
  Sparkles,
  Upload,
  FileText,
  FileType2,
  Trash,
  Eye,
  X,
  BookOpen,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Eye as EyeOn,
  EyeOff,
  ChevronDown,
  Zap,
  Key,
  ShieldBan,
  Plus,
  Pencil,
} from "lucide-react";
import { format } from "date-fns";
import { apiGet, apiPost, apiPut, apiDelete, getBaseUrl } from "@/lib/api";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface KnowledgeDoc {
  id: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

interface AiException {
  id: number;
  type: "exception" | "compliance";
  phrase: string;
  reason: string | null;
  content: string | null;
  isActive: boolean;
  createdAt: string;
}

interface AiProviderSettings {
  id: number;
  provider: string;
  model: string;
  hasApiKey: boolean;
  baseUrl: string | null;
  temperature: number;
  maxTokens: number;
}

const DEFAULT_SYSTEM = `You are CommsBot, an intelligent customer service AI assistant.
You help customers with their queries efficiently, professionally, and empathetically.
You can handle questions about orders, products, returns, complaints, and general support.
Always be polite, helpful, and concise. If you cannot resolve an issue, offer to escalate to a human agent.`;

const PROVIDER_META: Record<
  string,
  {
    label: string;
    color: string;
    icon: string;
    models: string[];
    defaultModel: string;
    needsKey: boolean;
    needsUrl: boolean;
    keyPlaceholder: string;
    urlPlaceholder: string;
    hint: string;
  }
> = {
  gemini: {
    label: "Gemini (Built-in)",
    color: "bg-blue-500",
    icon: "✦",
    models: [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-3-flash-preview",
      "gemini-3-pro-preview",
    ],
    defaultModel: "gemini-2.5-flash",
    needsKey: false,
    needsUrl: false,
    keyPlaceholder: "",
    urlPlaceholder: "",
    hint: "Uses Replit's built-in Gemini integration — no API key needed. Usage is billed to your Replit credits.",
  },
  gemini_own: {
    label: "Gemini (Own Key)",
    color: "bg-blue-600",
    icon: "✦",
    models: [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
    ],
    defaultModel: "gemini-2.5-flash",
    needsKey: true,
    needsUrl: false,
    keyPlaceholder: "AIzaSy...",
    urlPlaceholder: "",
    hint: "Use your own Google AI Studio API key. Get one at aistudio.google.com.",
  },
  openai: {
    label: "OpenAI",
    color: "bg-emerald-500",
    icon: "⬡",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
    defaultModel: "gpt-4o-mini",
    needsKey: true,
    needsUrl: false,
    keyPlaceholder: "sk-...",
    urlPlaceholder: "",
    hint: "Use your OpenAI API key from platform.openai.com/api-keys.",
  },
  anthropic: {
    label: "Anthropic Claude",
    color: "bg-amber-600",
    icon: "◈",
    models: [
      "claude-opus-4-5",
      "claude-sonnet-4-5",
      "claude-haiku-4-5",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
    ],
    defaultModel: "claude-haiku-4-5",
    needsKey: true,
    needsUrl: false,
    keyPlaceholder: "sk-ant-...",
    urlPlaceholder: "",
    hint: "Use your Anthropic API key from console.anthropic.com/settings/keys.",
  },
  custom: {
    label: "Custom / OpenAI-compatible",
    color: "bg-purple-600",
    icon: "⚙",
    models: [],
    defaultModel: "",
    needsKey: true,
    needsUrl: true,
    keyPlaceholder: "sk-...",
    urlPlaceholder: "https://api.example.com/v1",
    hint: "Any OpenAI-compatible API endpoint — Ollama, Azure OpenAI, LM Studio, Together AI, Groq, etc.",
  },
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType: string) {
  if (mimeType === "application/pdf")
    return <FileType2 className="h-5 w-5 text-red-500" />;
  return <FileText className="h-5 w-5 text-blue-500" />;
}

function providerLabel(provider: string) {
  return PROVIDER_META[provider]?.label ?? provider;
}

export default function AiChat() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Knowledge base state
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{
    name: string;
    content: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Exception state
  const [exceptionPhrase, setExceptionPhrase] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");
  const [editingException, setEditingException] = useState<AiException | null>(
    null,
  );
  const [showExceptionForm, setShowExceptionForm] = useState(false);
  const [isUploadingExceptions, setIsUploadingExceptions] = useState(false);
  const [exceptionViewType, setExceptionViewType] = useState<
    "exception" | "compliance"
  >("exception");
  const [previewCompliance, setPreviewCompliance] = useState<{
    name: string;
    content: string;
  } | null>(null);
  const exceptionFileRef = useRef<HTMLInputElement>(null);
  const complianceFileRef = useRef<HTMLInputElement>(null);

  // Provider settings form state
  const [editProvider, setEditProvider] = useState("gemini");
  const [editModel, setEditModel] = useState("gemini-2.5-flash");
  const [editApiKey, setEditApiKey] = useState("");
  const [editBaseUrl, setEditBaseUrl] = useState("");
  const [editTemp, setEditTemp] = useState(0.7);
  const [editMaxTokens, setEditMaxTokens] = useState(8192);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Load AI provider settings
  const { data: aiSettings } = useQuery<AiProviderSettings>({
    queryKey: ["ai-settings"],
    queryFn: () => apiGet("/ai/settings"),
    onSuccess: (data) => {
      setEditProvider(data.provider);
      setEditModel(data.model);
      setEditBaseUrl(data.baseUrl ?? "");
      setEditTemp(data.temperature);
      setEditMaxTokens(data.maxTokens);
    },
  } as Parameters<typeof useQuery>[0]);

  const saveSettingsMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPut("/ai/settings", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-settings"] });
      setTestResult(null);
      toast({
        title: "AI settings saved!",
        description: `Now using ${providerLabel(editProvider)} · ${editModel}`,
      });
    },
    onError: () =>
      toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  // Knowledge base queries
  const { data: docs = [], isLoading: docsLoading } = useQuery<KnowledgeDoc[]>({
    queryKey: ["knowledge-docs"],
    queryFn: () => apiGet("/ai/knowledge-base"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/ai/knowledge-base/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge-docs"] });
      toast({ title: "Document removed from knowledge base" });
    },
    onError: () =>
      toast({ title: "Failed to delete document", variant: "destructive" }),
  });

  const { data: exceptions = [], isLoading: exceptionsLoading } = useQuery<
    AiException[]
  >({
    queryKey: ["ai-exceptions"],
    queryFn: () => apiGet("/ai/exceptions"),
  });

  const createExceptionMutation = useMutation({
    mutationFn: (data: { phrase: string; reason?: string }) =>
      apiPost("/ai/exceptions", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-exceptions"] });
      setExceptionPhrase("");
      setExceptionReason("");
      setShowExceptionForm(false);
      toast({ title: "Exception added" });
    },
    onError: () =>
      toast({ title: "Failed to add exception", variant: "destructive" }),
  });

  const updateExceptionMutation = useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: number;
      phrase?: string;
      reason?: string;
      isActive?: boolean;
    }) => apiPut(`/ai/exceptions/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-exceptions"] });
      setEditingException(null);
      setExceptionPhrase("");
      setExceptionReason("");
      setShowExceptionForm(false);
      toast({ title: "Exception updated" });
    },
    onError: () =>
      toast({ title: "Failed to update exception", variant: "destructive" }),
  });

  const deleteExceptionMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/ai/exceptions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-exceptions"] });
      toast({ title: "Exception removed" });
    },
    onError: () =>
      toast({ title: "Failed to delete exception", variant: "destructive" }),
  });

  const uploadExceptionFile = useCallback(
    async (
      file: File,
      uploadType: "exception" | "compliance" = "exception",
    ) => {
      const allowed = [
        "application/pdf",
        "text/plain",
        "text/markdown",
        "text/csv",
      ];
      const allowedExt = [".pdf", ".txt", ".md", ".csv"];
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!allowed.includes(file.type) && !allowedExt.includes(ext)) {
        toast({
          title: "Unsupported file type",
          description: "Please upload PDF, TXT, MD, or CSV files.",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 10 MB.",
          variant: "destructive",
        });
        return;
      }
      setIsUploadingExceptions(true);
      try {
        const token = localStorage.getItem("crm_token");
        const baseUrl = getBaseUrl();
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", uploadType);
        const res = await fetch(`${baseUrl}/ai/exceptions/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Upload failed");
        }
        const data = await res.json();
        qc.invalidateQueries({ queryKey: ["ai-exceptions"] });
        if (uploadType === "compliance") {
          toast({
            title: "Compliance document uploaded!",
            description: `"${file.name}" is now active.`,
          });
        } else {
          toast({
            title: "Exceptions imported!",
            description: `${data.imported} added, ${data.skipped} skipped (duplicates).`,
          });
        }
      } catch (err: unknown) {
        toast({
          title: "Upload failed",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsUploadingExceptions(false);
        if (exceptionFileRef.current) exceptionFileRef.current.value = "";
        if (complianceFileRef.current) complianceFileRef.current.value = "";
      }
    },
    [qc, toast],
  );

  const uploadFile = useCallback(
    async (file: File) => {
      const allowed = [
        "application/pdf",
        "text/plain",
        "text/markdown",
        "text/csv",
      ];
      const allowedExt = [".pdf", ".txt", ".md", ".csv"];
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!allowed.includes(file.type) && !allowedExt.includes(ext)) {
        toast({
          title: "Unsupported file type",
          description: "Please upload PDF, TXT, MD, or CSV files.",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 10 MB.",
          variant: "destructive",
        });
        return;
      }
      setIsUploading(true);
      try {
        const token = localStorage.getItem("crm_token");
        const baseUrl = getBaseUrl();
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`${baseUrl}/ai/knowledge-base`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Upload failed");
        }
        qc.invalidateQueries({ queryKey: ["knowledge-docs"] });
        toast({
          title: "Document uploaded!",
          description: `"${file.name}" is now part of the AI knowledge base.`,
        });
      } catch (err: unknown) {
        toast({
          title: "Upload failed",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [qc, toast],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      Array.from(e.dataTransfer.files).forEach(uploadFile);
    },
    [uploadFile],
  );

  const previewDocument = async (doc: KnowledgeDoc) => {
    try {
      const token = localStorage.getItem("crm_token");
      const baseUrl = getBaseUrl();
      const res = await fetch(
        `${baseUrl}/ai/knowledge-base/${doc.id}/preview`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      setPreviewDoc({ name: doc.originalName, content: data.content });
    } catch {
      toast({ title: "Could not load preview", variant: "destructive" });
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const token = localStorage.getItem("crm_token");
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/ai/settings/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: editProvider,
          model: editModel,
          apiKey: editApiKey || undefined,
          baseUrl: editBaseUrl || undefined,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({
        ok: false,
        message: "Network error — could not reach the backend.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const saveSettings = () => {
    saveSettingsMutation.mutate({
      provider: editProvider,
      model: editModel,
      apiKey: editApiKey || undefined,
      baseUrl: editBaseUrl || undefined,
      temperature: editTemp,
      maxTokens: editMaxTokens,
    });
  };

  const handleProviderChange = (p: string) => {
    setEditProvider(p);
    const meta = PROVIDER_META[p];
    if (meta?.defaultModel) setEditModel(meta.defaultModel);
    setEditApiKey("");
    setTestResult(null);
  };

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsStreaming(true);
    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      },
    ]);
    try {
      const token = localStorage.getItem("crm_token");
      const baseUrl = getBaseUrl();
      abortRef.current = new AbortController();
      const response = await fetch(`${baseUrl}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          systemPrompt,
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: abortRef.current.signal,
      });
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value).split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullContent += data.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: fullContent, isStreaming: !data.done }
                      : m,
                  ),
                );
              }
              if (data.done)
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, isStreaming: false } : m,
                  ),
                );
            } catch {}
          }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: "Sorry, I encountered an error. Please try again.",
                  isStreaming: false,
                }
              : m,
          ),
        );
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const clearChat = () => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setIsStreaming(false);
  };
  const currentMeta = PROVIDER_META[aiSettings?.provider ?? "gemini"];

  return (
    <div className="p-6 max-w-5xl mx-auto h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-6 w-6 text-blue-500" />
            AI Assistant
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure your AI provider, manage the knowledge base, and test
            responses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {aiSettings && (
            <Badge className="gap-1.5 bg-muted border text-foreground">
              <span className="font-bold">{currentMeta?.icon}</span>
              {providerLabel(aiSettings.provider)} · {aiSettings.model}
            </Badge>
          )}
          {docs.length > 0 && (
            <Badge variant="secondary" className="gap-1.5">
              <BookOpen className="h-3 w-3" /> {docs.length} KB doc
              {docs.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="settings">
        <TabsList className="mb-6">
          <TabsTrigger
            value="settings"
            className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <Settings2 className="h-4 w-4" /> AI Provider
          </TabsTrigger>
          <TabsTrigger
            value="knowledge"
            className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <BookOpen className="h-4 w-4" /> Knowledge Base
            {docs.length > 0 && (
              <span className="ml-0.5 h-2 w-2 rounded-full bg-green-500 inline-block" />
            )}
          </TabsTrigger>
          <TabsTrigger
            value="chat"
            className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <MessageSquare className="h-4 w-4" /> Test Chat
          </TabsTrigger>
          <TabsTrigger
            value="exceptions"
            className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <ShieldBan className="h-4 w-4" /> Exceptions
            {exceptions.filter((e) => e.isActive).length > 0 && (
              <span className="ml-0.5 h-2 w-2 rounded-full bg-orange-500 inline-block" />
            )}
          </TabsTrigger>
          <TabsTrigger
            value="prompt"
            className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <Zap className="h-4 w-4" /> System Prompt
          </TabsTrigger>
        </TabsList>

        {/* AI Provider Tab */}
        <TabsContent value="settings">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
            <div className="space-y-5">
              {/* Provider selector */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">AI Provider</CardTitle>
                  <CardDescription>
                    Choose which AI service powers CommsBot's replies,
                    suggestions, and auto-responses.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(PROVIDER_META).map(([key, meta]) => (
                      <button
                        key={key}
                        onClick={() => handleProviderChange(key)}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${editProvider === key ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/40 hover:bg-muted/30"}`}
                      >
                        <div
                          className={`h-9 w-9 rounded-lg ${meta.color} flex items-center justify-center text-white font-bold text-lg shrink-0`}
                        >
                          {meta.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight">
                            {meta.label}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {meta.needsKey
                              ? "Requires API key"
                              : "No key needed"}
                          </p>
                        </div>
                        {editProvider === key && (
                          <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>

                  {PROVIDER_META[editProvider]?.hint && (
                    <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground flex items-start gap-2">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-500" />
                      {PROVIDER_META[editProvider].hint}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Model + credentials */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Model & Credentials
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Model selector */}
                  <div>
                    <Label className="text-sm">Model</Label>
                    {PROVIDER_META[editProvider]?.models.length > 0 ? (
                      <div className="relative mt-1.5">
                        <select
                          className="w-full h-9 rounded-md border bg-background px-3 pr-8 text-sm appearance-none"
                          value={editModel}
                          onChange={(e) => setEditModel(e.target.value)}
                        >
                          {PROVIDER_META[editProvider].models.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="h-4 w-4 absolute right-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                      </div>
                    ) : (
                      <Input
                        className="mt-1.5"
                        placeholder="e.g. llama3.2, mistral, deepseek-r1"
                        value={editModel}
                        onChange={(e) => setEditModel(e.target.value)}
                      />
                    )}
                  </div>

                  {/* API Key */}
                  {PROVIDER_META[editProvider]?.needsKey && (
                    <div>
                      <Label className="text-sm flex items-center gap-1.5">
                        <Key className="h-3.5 w-3.5" /> API Key
                        {aiSettings?.hasApiKey && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-4"
                          >
                            stored
                          </Badge>
                        )}
                      </Label>
                      <div className="relative mt-1.5">
                        <Input
                          type={showApiKey ? "text" : "password"}
                          placeholder={
                            aiSettings?.hasApiKey
                              ? "••••••••• (leave blank to keep existing)"
                              : PROVIDER_META[editProvider].keyPlaceholder
                          }
                          value={editApiKey}
                          onChange={(e) => setEditApiKey(e.target.value)}
                          className="pr-10"
                        />
                        <button
                          onClick={() => setShowApiKey((v) => !v)}
                          className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                        >
                          {showApiKey ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <EyeOn className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Base URL */}
                  {PROVIDER_META[editProvider]?.needsUrl && (
                    <div>
                      <Label className="text-sm">Base URL</Label>
                      <Input
                        className="mt-1.5"
                        placeholder={PROVIDER_META[editProvider].urlPlaceholder}
                        value={editBaseUrl}
                        onChange={(e) => setEditBaseUrl(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        The root URL of the OpenAI-compatible API (without
                        /chat/completions)
                      </p>
                    </div>
                  )}

                  {/* Advanced */}
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">
                        Temperature{" "}
                        <span className="text-muted-foreground">
                          ({editTemp})
                        </span>
                      </Label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={editTemp}
                        onChange={(e) =>
                          setEditTemp(parseFloat(e.target.value))
                        }
                        className="w-full mt-2"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                        <span>Precise</span>
                        <span>Creative</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm">Max Tokens</Label>
                      <Input
                        type="number"
                        min="256"
                        max="32768"
                        step="256"
                        value={editMaxTokens}
                        onChange={(e) =>
                          setEditMaxTokens(parseInt(e.target.value))
                        }
                        className="mt-1.5"
                      />
                    </div>
                  </div>

                  {/* Test result */}
                  {testResult && (
                    <div
                      className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${testResult.ok ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/20 dark:border-green-900 dark:text-green-400" : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900 dark:text-red-400"}`}
                    >
                      {testResult.ok ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      )}
                      <span>{testResult.message}</span>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={testConnection}
                      disabled={isTesting}
                      className="gap-2"
                    >
                      {isTesting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                      Test Connection
                    </Button>
                    <Button
                      onClick={saveSettings}
                      disabled={saveSettingsMutation.isPending}
                      className="gap-2"
                    >
                      {saveSettingsMutation.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Save & Apply
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: guide */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    Which provider should I use?
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-3">
                  <div>
                    <p className="font-medium text-foreground mb-1">
                      ✦ Gemini (Built-in)
                    </p>
                    <p>
                      Fastest to get started, no API key required. Powered by
                      Replit's integration.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">
                      ✦ Gemini (Own Key)
                    </p>
                    <p>
                      Use your Google AI Studio key for higher rate limits and
                      model access.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">⬡ OpenAI</p>
                    <p>
                      GPT-4o is excellent for complex reasoning. GPT-4o-mini is
                      faster and cheaper.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">
                      ◈ Anthropic Claude
                    </p>
                    <p>
                      Strong at following instructions and nuanced tone. Great
                      for customer service.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">⚙ Custom</p>
                    <p>
                      Connect any OpenAI-compatible API — Ollama (local), Groq,
                      Together AI, Azure OpenAI, LM Studio, and more.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    Current configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1.5">
                  {aiSettings ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Provider</span>
                        <span className="font-medium">
                          {providerLabel(aiSettings.provider)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Model</span>
                        <span className="font-medium">{aiSettings.model}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">API Key</span>
                        <span
                          className={
                            aiSettings.hasApiKey
                              ? "text-green-600"
                              : "text-muted-foreground"
                          }
                        >
                          {aiSettings.hasApiKey
                            ? "Stored ✓"
                            : aiSettings.provider === "gemini"
                              ? "Built-in"
                              : "Not set"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Temperature
                        </span>
                        <span className="font-medium">
                          {aiSettings.temperature}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Max tokens
                        </span>
                        <span className="font-medium">
                          {aiSettings.maxTokens.toLocaleString()}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Loading…</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Knowledge Base Tab */}
        <TabsContent value="knowledge">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Upload Documents & SOPs
                  </CardTitle>
                  <CardDescription>
                    Upload PDF, TXT, MD, or CSV files. The AI will reference
                    these when responding to customers.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.txt,.md,.csv"
                      multiple
                      className="hidden"
                      onChange={(e) =>
                        Array.from(e.target.files || []).forEach(uploadFile)
                      }
                    />
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-10 w-10 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground">
                          Extracting and indexing document...
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                          <Upload className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">
                            Drop files here or click to browse
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Supports PDF, TXT, MD, CSV · Max 10 MB per file
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Uploaded Documents</span>
                    <Badge variant="secondary">
                      {docs.length} file{docs.length !== 1 ? "s" : ""}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {docsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : docs.length === 0 ? (
                    <div className="text-center py-10">
                      <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No documents yet. Upload your SOPs, FAQs, product
                        guides, or policies above.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {docs.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors group"
                        >
                          {fileIcon(doc.mimeType)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {doc.originalName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatBytes(doc.sizeBytes)} ·{" "}
                              {format(new Date(doc.createdAt), "MMM d, yyyy")}
                            </p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => previewDocument(doc)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteMutation.mutate(doc.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-blue-700 dark:text-blue-400">
                    <Sparkles className="h-4 w-4" /> How the knowledge base
                    works
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-blue-700 dark:text-blue-400 space-y-2">
                  <p>
                    Every document you upload is automatically injected into the
                    AI's context. The AI references them when replying to
                    customers.
                  </p>
                  <p className="font-medium mt-2">Best for:</p>
                  <ul className="space-y-1 list-disc pl-4">
                    <li>Return / refund policies</li>
                    <li>Product FAQs</li>
                    <li>Support SOPs</li>
                    <li>Pricing guides</li>
                    <li>Company info</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Test Chat Tab */}
        <TabsContent value="chat">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
            <Card className="flex flex-col h-[600px]">
              <CardHeader className="py-3 px-4 border-b shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">CommsBot</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                        {aiSettings
                          ? `${providerLabel(aiSettings.provider)} · ${aiSettings.model}`
                          : "Loading..."}
                        {docs.length > 0
                          ? ` · ${docs.length} KB doc${docs.length !== 1 ? "s" : ""}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  {messages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearChat}
                      className="gap-1.5 text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Clear
                    </Button>
                  )}
                </div>
              </CardHeader>

              <ScrollArea
                className="flex-1 px-4 py-4"
                ref={scrollRef as unknown as React.Ref<HTMLDivElement>}
              >
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                      <Sparkles className="h-8 w-8 text-blue-500" />
                    </div>
                    <p className="font-medium text-foreground mb-1">
                      CommsBot is ready
                    </p>
                    <p className="text-sm text-muted-foreground max-w-xs mb-4">
                      {docs.length > 0
                        ? `It has access to ${docs.length} knowledge base document${docs.length !== 1 ? "s" : ""}.`
                        : "Upload documents in the Knowledge Base tab to improve responses."}
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {[
                        "What are your business hours?",
                        "How do I return a product?",
                        "I have a complaint",
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => setInput(q)}
                          className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 border text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                      >
                        <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                          <AvatarFallback
                            className={
                              msg.role === "assistant"
                                ? "bg-blue-100 dark:bg-blue-900/30"
                                : "bg-primary/10"
                            }
                          >
                            {msg.role === "assistant" ? (
                              <Bot className="h-4 w-4 text-blue-600" />
                            ) : (
                              <User className="h-4 w-4 text-primary" />
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={`max-w-[75%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}
                        >
                          <div
                            className={`rounded-2xl px-4 py-2.5 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm"}`}
                          >
                            {msg.content ||
                              (msg.isStreaming && (
                                <div className="flex gap-1 items-center py-1">
                                  <span
                                    className="h-1.5 w-1.5 rounded-full bg-current animate-bounce"
                                    style={{ animationDelay: "0ms" }}
                                  />
                                  <span
                                    className="h-1.5 w-1.5 rounded-full bg-current animate-bounce"
                                    style={{ animationDelay: "150ms" }}
                                  />
                                  <span
                                    className="h-1.5 w-1.5 rounded-full bg-current animate-bounce"
                                    style={{ animationDelay: "300ms" }}
                                  />
                                </div>
                              ))}
                            {!msg.content && !msg.isStreaming && (
                              <span className="text-muted-foreground italic">
                                Empty response
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground px-1">
                            {format(msg.timestamp, "HH:mm")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <div className="p-3 border-t">
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type a test message..."
                    disabled={isStreaming}
                    className="bg-muted/50 border-none"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!input.trim() || isStreaming}
                    size="icon"
                  >
                    {isStreaming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">How this works</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li className="flex gap-2">
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-4 px-1 shrink-0"
                      >
                        1
                      </Badge>{" "}
                      Customer sends a message
                    </li>
                    <li className="flex gap-2">
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-4 px-1 shrink-0"
                      >
                        2
                      </Badge>{" "}
                      CommsBot auto-responds using your prompt + knowledge base
                    </li>
                    <li className="flex gap-2">
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-4 px-1 shrink-0"
                      >
                        3
                      </Badge>{" "}
                      Unresolved issues escalate to a human agent
                    </li>
                    <li className="flex gap-2">
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-4 px-1 shrink-0"
                      >
                        4
                      </Badge>{" "}
                      Agent replies with AI-suggested messages
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Exceptions Tab */}
        <TabsContent value="exceptions">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => {
                setExceptionViewType("exception");
                setShowExceptionForm(false);
                setEditingException(null);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${exceptionViewType === "exception" ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}
            >
              <ShieldBan className="h-4 w-4 inline mr-1.5 -mt-0.5" />
              Blocked Topics
              {exceptions.filter((e) => e.type === "exception").length > 0 && (
                <span className="ml-1.5 text-xs bg-background/20 px-1.5 py-0.5 rounded-full">
                  {exceptions.filter((e) => e.type === "exception").length}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setExceptionViewType("compliance");
                setShowExceptionForm(false);
                setEditingException(null);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${exceptionViewType === "compliance" ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}
            >
              <FileText className="h-4 w-4 inline mr-1.5 -mt-0.5" />
              Compliance Documents
              {exceptions.filter((e) => e.type === "compliance").length > 0 && (
                <span className="ml-1.5 text-xs bg-background/20 px-1.5 py-0.5 rounded-full">
                  {exceptions.filter((e) => e.type === "compliance").length}
                </span>
              )}
            </button>
          </div>

          {exceptionViewType === "exception" && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        Blocked Topics
                      </CardTitle>
                      <CardDescription>
                        Topics and phrases the AI will refuse to discuss or
                        respond to.
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isUploadingExceptions}
                        onClick={() => exceptionFileRef.current?.click()}
                      >
                        {isUploadingExceptions ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-1" />
                        )}
                        Upload File
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditingException(null);
                          setExceptionPhrase("");
                          setExceptionReason("");
                          setShowExceptionForm(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add Topic
                      </Button>
                    </div>
                    <input
                      ref={exceptionFileRef}
                      type="file"
                      accept=".pdf,.txt,.md,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadExceptionFile(file, "exception");
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {showExceptionForm && (
                    <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                      <div>
                        <Label className="text-sm">Topic / Phrase</Label>
                        <Input
                          className="mt-1.5"
                          placeholder='e.g. "competitor pricing", "internal salary info"'
                          value={exceptionPhrase}
                          onChange={(e) => setExceptionPhrase(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Reason (optional)</Label>
                        <Input
                          className="mt-1.5"
                          placeholder="Why this topic is restricted..."
                          value={exceptionReason}
                          onChange={(e) => setExceptionReason(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={
                            !exceptionPhrase.trim() ||
                            createExceptionMutation.isPending ||
                            updateExceptionMutation.isPending
                          }
                          onClick={() => {
                            if (editingException) {
                              updateExceptionMutation.mutate({
                                id: editingException.id,
                                phrase: exceptionPhrase,
                                reason: exceptionReason || undefined,
                              });
                            } else {
                              createExceptionMutation.mutate({
                                phrase: exceptionPhrase,
                                reason: exceptionReason || undefined,
                              });
                            }
                          }}
                        >
                          {(createExceptionMutation.isPending ||
                            updateExceptionMutation.isPending) && (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          )}
                          {editingException ? "Update" : "Add"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowExceptionForm(false);
                            setEditingException(null);
                            setExceptionPhrase("");
                            setExceptionReason("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {exceptionsLoading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />{" "}
                      Loading...
                    </div>
                  ) : exceptions.filter((e) => e.type === "exception")
                      .length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <ShieldBan className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm font-medium">
                        No blocked topics yet
                      </p>
                      <p className="text-xs mt-1">
                        Add topics or phrases the AI should never respond to.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {exceptions
                        .filter((e) => e.type === "exception")
                        .map((ex) => (
                          <div
                            key={ex.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${ex.isActive ? "bg-background" : "bg-muted/30 opacity-60"}`}
                          >
                            <Switch
                              checked={ex.isActive}
                              onCheckedChange={(checked) =>
                                updateExceptionMutation.mutate({
                                  id: ex.id,
                                  isActive: checked,
                                })
                              }
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {ex.phrase}
                              </p>
                              {ex.reason && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {ex.reason}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  setEditingException(ex);
                                  setExceptionPhrase(ex.phrase);
                                  setExceptionReason(ex.reason || "");
                                  setShowExceptionForm(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                onClick={() =>
                                  deleteExceptionMutation.mutate(ex.id)
                                }
                              >
                                <Trash className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      How blocked topics work
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-2">
                    <p>
                      • Add topics or phrases the AI should refuse to discuss
                    </p>
                    <p>• Active items are injected into every AI prompt</p>
                    <p>
                      • The AI will politely decline and offer to help with
                      something else
                    </p>
                    <p>• Toggle items on/off without deleting them</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      Upload file format
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-2">
                    <p>Upload a file with one topic per line.</p>
                    <p>Optionally add a reason with a separator:</p>
                    <p className="font-mono bg-muted rounded px-1.5 py-0.5">
                      competitor pricing — Confidential
                    </p>
                    <p>Duplicates are skipped automatically.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {exceptionViewType === "compliance" && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        Compliance Documents
                      </CardTitle>
                      <CardDescription>
                        Upload regulatory, policy, or compliance documents the
                        AI must follow when responding.
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      disabled={isUploadingExceptions}
                      onClick={() => complianceFileRef.current?.click()}
                    >
                      {isUploadingExceptions ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-1" />
                      )}
                      Upload Document
                    </Button>
                    <input
                      ref={complianceFileRef}
                      type="file"
                      accept=".pdf,.txt,.md,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadExceptionFile(file, "compliance");
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {exceptionsLoading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />{" "}
                      Loading...
                    </div>
                  ) : exceptions.filter((e) => e.type === "compliance")
                      .length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm font-medium">
                        No compliance documents yet
                      </p>
                      <p className="text-xs mt-1">
                        Upload documents the AI must follow (GDPR, industry
                        regulations, company policies, etc.).
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {exceptions
                        .filter((e) => e.type === "compliance")
                        .map((doc) => (
                          <div
                            key={doc.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${doc.isActive ? "bg-background" : "bg-muted/30 opacity-60"}`}
                          >
                            <Switch
                              checked={doc.isActive}
                              onCheckedChange={(checked) =>
                                updateExceptionMutation.mutate({
                                  id: doc.id,
                                  isActive: checked,
                                })
                              }
                            />
                            <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
                              <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {doc.phrase}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {doc.content
                                  ? `${(doc.content.length / 1024).toFixed(1)} KB`
                                  : "No content"}{" "}
                                · Added{" "}
                                {format(new Date(doc.createdAt), "MMM d, yyyy")}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {doc.content && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() =>
                                    setPreviewCompliance({
                                      name: doc.phrase,
                                      content:
                                        doc.content?.slice(0, 3000) +
                                          (doc.content &&
                                          doc.content.length > 3000
                                            ? "\n\n..."
                                            : "") || "",
                                    })
                                  }
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                onClick={() =>
                                  deleteExceptionMutation.mutate(doc.id)
                                }
                              >
                                <Trash className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      How compliance documents work
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-2">
                    <p>
                      • Upload full compliance, regulatory, or policy documents
                    </p>
                    <p>
                      • The AI will strictly follow these rules when responding
                    </p>
                    <p>
                      • If a response could violate compliance, the AI will
                      adjust or explain why it cannot provide that information
                    </p>
                    <p>• Toggle documents on/off without deleting them</p>
                    <p>• Supports PDF, TXT, MD, and CSV files up to 10 MB</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Example documents</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-2">
                    <p>• GDPR data handling policy</p>
                    <p>• Industry-specific regulations</p>
                    <p>• Company communication guidelines</p>
                    <p>• Refund and return policies</p>
                    <p>• Data retention requirements</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* System Prompt Tab */}
        <TabsContent value="prompt">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">System Prompt</CardTitle>
                <CardDescription>
                  Defines CommsBot's personality, tone, and behavior. Knowledge
                  base content is appended automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={14}
                  className="text-sm resize-none bg-muted/50 border-none font-mono"
                  placeholder="Define how CommsBot should behave..."
                />
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setSystemPrompt(DEFAULT_SYSTEM)}
                  >
                    Reset to Default
                  </Button>
                  <Button
                    onClick={() =>
                      toast({ title: "System prompt saved for this session" })
                    }
                  >
                    Save Prompt
                  </Button>
                </div>
              </CardContent>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    Tips for a good system prompt
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-2">
                  <p>• State the bot's name and role clearly</p>
                  <p>• Specify the tone (professional, friendly, formal)</p>
                  <p>• List what it can and cannot do</p>
                  <p>• Tell it when to escalate to a human</p>
                  <p>• Mention the company name and industry</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!previewDoc}
        onOpenChange={(o) => !o && setPreviewDoc(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {previewDoc?.name}
            </DialogTitle>
            <DialogDescription>
              Preview of extracted document content (first 2000 characters)
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-96 w-full rounded-md border bg-muted/30 p-4">
            <pre className="text-xs whitespace-pre-wrap font-mono text-foreground">
              {previewDoc?.content}
            </pre>
          </ScrollArea>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setPreviewDoc(null)}>
              <X className="h-4 w-4 mr-2" /> Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!previewCompliance}
        onOpenChange={(o) => !o && setPreviewCompliance(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-600" />
              {previewCompliance?.name}
            </DialogTitle>
            <DialogDescription>
              Compliance document content (first 3000 characters)
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-96 w-full rounded-md border bg-muted/30 p-4">
            <pre className="text-xs whitespace-pre-wrap font-mono text-foreground">
              {previewCompliance?.content}
            </pre>
          </ScrollArea>
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => setPreviewCompliance(null)}
            >
              <X className="h-4 w-4 mr-2" /> Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
