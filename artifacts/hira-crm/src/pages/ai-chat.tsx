import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, Bot, User, Trash2, Settings2, Sparkles, Upload, FileText, FileType2, Trash, Eye, X, BookOpen, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { apiGet, apiDelete, getBaseUrl } from "@/lib/api";

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

const DEFAULT_SYSTEM = `You are CommsBot, an intelligent customer service AI assistant.
You help customers with their queries efficiently, professionally, and empathetically.
You can handle questions about orders, products, returns, complaints, and general support.
Always be polite, helpful, and concise. If you cannot resolve an issue, offer to escalate to a human agent.`;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType: string) {
  if (mimeType === "application/pdf") return <FileType2 className="h-5 w-5 text-red-500" />;
  return <FileText className="h-5 w-5 text-blue-500" />;
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
  const [previewDoc, setPreviewDoc] = useState<{ name: string; content: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

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
    onError: () => toast({ title: "Failed to delete document", variant: "destructive" }),
  });

  const uploadFile = useCallback(async (file: File) => {
    const allowed = ["application/pdf", "text/plain", "text/markdown", "text/csv"];
    const allowedExt = [".pdf", ".txt", ".md", ".csv"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(file.type) && !allowedExt.includes(ext)) {
      toast({ title: "Unsupported file type", description: "Please upload PDF, TXT, MD, or CSV files.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 10 MB.", variant: "destructive" });
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
      toast({ title: "Document uploaded!", description: `"${file.name}" is now part of the AI knowledge base.` });
    } catch (err: unknown) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  }, [qc, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(uploadFile);
  }, [uploadFile]);

  const previewDocument = async (doc: KnowledgeDoc) => {
    try {
      const token = localStorage.getItem("crm_token");
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/ai/knowledge-base/${doc.id}/preview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setPreviewDoc({ name: doc.originalName, content: data.content });
    } catch {
      toast({ title: "Could not load preview", variant: "destructive" });
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: ChatMessage = { id: Date.now().toString(), role: "user", content: input.trim(), timestamp: new Date() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", timestamp: new Date(), isStreaming: true }]);

    try {
      const token = localStorage.getItem("crm_token");
      const baseUrl = getBaseUrl();
      abortRef.current = new AbortController();

      const response = await fetch(`${baseUrl}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ systemPrompt, messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })) }),
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
                setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: fullContent, isStreaming: !data.done } : m));
              }
              if (data.done) setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, isStreaming: false } : m));
            } catch {}
          }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== "AbortError") {
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: "Sorry, I encountered an error. Please try again.", isStreaming: false } : m));
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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-6 w-6 text-blue-500" />
            AI Assistant
          </h1>
          <p className="text-muted-foreground mt-1">Configure CommsBot, manage your knowledge base, and test AI responses.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="gap-1.5 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
            <Sparkles className="h-3 w-3" /> Powered by Gemini
          </Badge>
          {docs.length > 0 && (
            <Badge variant="secondary" className="gap-1.5">
              <BookOpen className="h-3 w-3" /> {docs.length} doc{docs.length !== 1 ? "s" : ""} in KB
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="knowledge">
        <TabsList className="mb-6">
          <TabsTrigger value="knowledge" className="gap-2">
            <BookOpen className="h-4 w-4" /> Knowledge Base
            {docs.length > 0 && <span className="ml-0.5 h-2 w-2 rounded-full bg-green-500 inline-block" />}
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-2">
            <MessageSquare className="h-4 w-4" /> Test Chat
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings2 className="h-4 w-4" /> Bot Settings
          </TabsTrigger>
        </TabsList>

        {/* Knowledge Base Tab */}
        <TabsContent value="knowledge">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Upload Documents & SOPs</CardTitle>
                  <CardDescription>
                    Upload PDF, TXT, MD, or CSV files. The AI will reference these when responding to customers — the more specific your SOPs, the better the answers.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
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
                      onChange={(e) => Array.from(e.target.files || []).forEach(uploadFile)}
                    />
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-10 w-10 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground">Extracting and indexing document...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                          <Upload className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">Drop files here or click to browse</p>
                          <p className="text-sm text-muted-foreground mt-1">Supports PDF, TXT, MD, CSV · Max 10 MB per file</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Uploaded documents list */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Uploaded Documents</span>
                    <Badge variant="secondary">{docs.length} file{docs.length !== 1 ? "s" : ""}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {docsLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : docs.length === 0 ? (
                    <div className="text-center py-10">
                      <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No documents yet. Upload your SOPs, FAQs, product guides, or policies above.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {docs.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors group">
                          {fileIcon(doc.mimeType)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.originalName}</p>
                            <p className="text-xs text-muted-foreground">{formatBytes(doc.sizeBytes)} · {format(new Date(doc.createdAt), "MMM d, yyyy")}</p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => previewDocument(doc)}>
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

            {/* Right panel: how it works */}
            <div className="space-y-4">
              <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-blue-700 dark:text-blue-400">
                    <Sparkles className="h-4 w-4" /> Powered by Gemini
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-blue-700 dark:text-blue-400 space-y-2">
                  <p>CommsBot uses <strong>Google Gemini 2.5 Flash</strong> for all AI responses — including auto-replies, reply suggestions, and the test chat.</p>
                  <p>No API key required. Usage is billed to your Replit credits.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">How the knowledge base works</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3 text-xs text-muted-foreground">
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">1</Badge>
                    <span>Upload your documents: SOPs, FAQs, product info, return policies, pricing guides</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">2</Badge>
                    <span>The AI reads and references all uploaded documents when generating responses</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">3</Badge>
                    <span>Customer questions get answers grounded in your actual company policies</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">4</Badge>
                    <span>Use the Test Chat tab to verify the AI knows your content before going live</span>
                  </div>
                  <Separator />
                  <p className="font-medium text-foreground">Best practices</p>
                  <ul className="space-y-1 list-disc pl-4">
                    <li>Keep documents concise and factual</li>
                    <li>Use clear headings in your SOPs</li>
                    <li>Upload one file per topic for better organization</li>
                    <li>Update documents when policies change</li>
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
                        Active · Gemini 2.5 Flash{docs.length > 0 ? ` · ${docs.length} KB doc${docs.length !== 1 ? "s" : ""}` : ""}
                      </p>
                    </div>
                  </div>
                  {messages.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearChat} className="gap-1.5 text-xs">
                      <Trash2 className="h-3.5 w-3.5" /> Clear
                    </Button>
                  )}
                </div>
              </CardHeader>

              <ScrollArea className="flex-1 px-4 py-4" ref={scrollRef as unknown as React.Ref<HTMLDivElement>}>
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                      <Sparkles className="h-8 w-8 text-blue-500" />
                    </div>
                    <p className="font-medium text-foreground mb-1">CommsBot is ready</p>
                    <p className="text-sm text-muted-foreground max-w-xs mb-4">
                      Test how the AI responds. {docs.length > 0 ? `It has access to ${docs.length} knowledge base document${docs.length !== 1 ? "s" : ""}.` : "Upload documents in the Knowledge Base tab to improve responses."}
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {["What are your business hours?", "How do I return a product?", "I have a complaint"].map((q) => (
                        <button key={q} onClick={() => setInput(q)} className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 border text-muted-foreground hover:text-foreground transition-colors">
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                        <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                          <AvatarFallback className={msg.role === "assistant" ? "bg-blue-100 dark:bg-blue-900/30" : "bg-primary/10"}>
                            {msg.role === "assistant" ? <Bot className="h-4 w-4 text-blue-600" /> : <User className="h-4 w-4 text-primary" />}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`max-w-[75%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                          <div className={`rounded-2xl px-4 py-2.5 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm"}`}>
                            {msg.content || (msg.isStreaming && (
                              <div className="flex gap-1 items-center py-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                              </div>
                            ))}
                            {!msg.content && !msg.isStreaming && <span className="text-muted-foreground italic">Empty response</span>}
                          </div>
                          <span className="text-[11px] text-muted-foreground px-1">{format(msg.timestamp, "HH:mm")}</span>
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
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Type a test message..."
                    disabled={isStreaming}
                    className="bg-muted/50 border-none"
                  />
                  <Button onClick={sendMessage} disabled={!input.trim() || isStreaming} size="icon">
                    {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">How this works</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  <li className="flex gap-2"><Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">1</Badge> Customer sends a message on WhatsApp/FB/Instagram</li>
                  <li className="flex gap-2"><Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">2</Badge> CommsBot auto-responds using your system prompt + knowledge base</li>
                  <li className="flex gap-2"><Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">3</Badge> If unresolved, bot escalates to a human agent</li>
                  <li className="flex gap-2"><Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">4</Badge> Agent replies with AI-suggested messages (also KB-aware)</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Bot Settings Tab */}
        <TabsContent value="settings">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">System Prompt</CardTitle>
                <CardDescription>This defines CommsBot's personality, tone, and behavior. The knowledge base content is automatically appended to this prompt.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={12}
                  className="text-sm resize-none bg-muted/50 border-none font-mono"
                  placeholder="Define how CommsBot should behave..."
                />
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setSystemPrompt(DEFAULT_SYSTEM)}>
                    Reset to Default
                  </Button>
                  <Button onClick={() => toast({ title: "System prompt saved for this session" })}>
                    Save Prompt
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">AI Model</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium">Gemini 2.5 Flash</p>
                        <p className="text-xs text-muted-foreground">Google · Fast & capable</p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 text-xs">Active</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Gemini 2.5 Flash is optimized for customer service: fast responses, multi-turn conversation, and excellent instruction following.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Knowledge Base Status</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  {docs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No documents uploaded yet. Go to the Knowledge Base tab to add SOPs and reference materials.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {docs.slice(0, 5).map((d) => (
                        <div key={d.id} className="flex items-center gap-2 text-xs">
                          {fileIcon(d.mimeType)}
                          <span className="truncate text-muted-foreground">{d.originalName}</span>
                          <span className="ml-auto text-muted-foreground shrink-0">{formatBytes(d.sizeBytes)}</span>
                        </div>
                      ))}
                      {docs.length > 5 && <p className="text-xs text-muted-foreground">+{docs.length - 5} more</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Document Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {previewDoc?.name}
            </DialogTitle>
            <DialogDescription>Preview of extracted document content (first 2000 characters)</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-96 w-full rounded-md border bg-muted/30 p-4">
            <pre className="text-xs whitespace-pre-wrap font-mono text-foreground">{previewDoc?.content}</pre>
          </ScrollArea>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setPreviewDoc(null)}>
              <X className="h-4 w-4 mr-2" /> Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
