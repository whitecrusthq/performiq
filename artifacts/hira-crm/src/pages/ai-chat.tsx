import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Send, Loader2, Bot, User, Trash2, Settings2, ChevronDown, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { getBaseUrl } from "@/lib/api";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

const DEFAULT_SYSTEM = `You are HiraBot, an intelligent customer service AI assistant.
You help customers with their queries efficiently, professionally, and empathetically.
You can handle questions about orders, products, returns, complaints, and general support.
Always be polite, helpful, and concise. If you cannot resolve an issue, offer to escalate to a human agent.`;

export default function AiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM);
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, assistantMessage]);

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
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
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

          const text = decoder.decode(value);
          const lines = text.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullContent += data.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: fullContent, isStreaming: !data.done } : m
                  )
                );
              }
              if (data.done) {
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
                );
              }
            } catch {}
          }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Sorry, I encountered an error. Please try again.", isStreaming: false }
              : m
          )
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-6 w-6 text-blue-500" />
            Test AI Chat
          </h1>
          <p className="text-muted-foreground mt-1">Preview how HiraBot responds to your customers.</p>
        </div>
        <div className="flex gap-2">
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearChat} className="gap-2">
              <Trash2 className="h-4 w-4" /> Clear
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Chat Window */}
        <Card className="flex flex-col h-[600px]">
          <CardHeader className="py-3 px-4 border-b shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">HiraBot</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                  Active · Powered by Claude
                </p>
              </div>
            </div>
          </CardHeader>

          <ScrollArea className="flex-1 px-4 py-4" ref={scrollRef as unknown as React.Ref<HTMLDivElement>}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-blue-500" />
                </div>
                <p className="font-medium text-foreground mb-1">HiraBot is ready</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Start a conversation to test how the AI handles customer queries. Customize the bot's behavior in the settings panel.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {["What are your business hours?", "I have a complaint about my order", "How can I return a product?"].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); }}
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
                  <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                      <AvatarFallback className={msg.role === "assistant" ? "bg-blue-100 dark:bg-blue-900/30" : "bg-primary/10"}>
                        {msg.role === "assistant" ? <Bot className="h-4 w-4 text-blue-600" /> : <User className="h-4 w-4 text-primary" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[75%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                      <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted text-foreground rounded-tl-sm"
                      }`}>
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

        {/* Settings Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings2 className="h-4 w-4" /> Bot Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">System Prompt</Label>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={8}
                  className="text-xs resize-none bg-muted/50 border-none"
                  placeholder="Define how HiraBot should behave..."
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => setSystemPrompt(DEFAULT_SYSTEM)}
              >
                Reset to Default
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="px-4 py-3 space-y-2">
              <p className="text-xs font-medium">How this works</p>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li className="flex gap-2"><Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">1</Badge> Customer sends a message on WhatsApp/FB/Instagram</li>
                <li className="flex gap-2"><Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">2</Badge> HiraBot auto-responds using the system prompt</li>
                <li className="flex gap-2"><Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">3</Badge> If unresolved, bot escalates to a human agent</li>
                <li className="flex gap-2"><Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">4</Badge> Agent replies with AI-suggested messages</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
