import React, { useState, useMemo, useEffect, useRef } from "react";
import { conversations as initialConversations, agents, getChannelIcon, getChannelColor, getStatusColor, Conversation, Message } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Filter, MoreVertical, Send, CheckCircle, Clock, Paperclip, Smile, Archive, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Inbox() {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.id || null);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyText, setReplyText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedConv = useMemo(() => conversations.find(c => c.id === selectedId), [conversations, selectedId]);

  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      if (filter !== "all" && c.status !== filter) return false;
      if (searchQuery) {
        return c.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
               c.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()));
      }
      return true;
    }).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }, [conversations, filter, searchQuery]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedConv?.messages]);

  const handleSend = () => {
    if (!replyText.trim() || !selectedId) return;

    const newMessage: Message = {
      id: `m_${Date.now()}`,
      sender: 'agent',
      content: replyText,
      timestamp: new Date().toISOString()
    };

    setConversations(prev => prev.map(c => {
      if (c.id === selectedId) {
        return {
          ...c,
          messages: [...c.messages, newMessage],
          lastMessageAt: newMessage.timestamp,
          status: c.status === 'open' ? 'pending' : c.status
        };
      }
      return c;
    }));
    setReplyText("");
  };

  const handleStatusChange = (id: string, status: Conversation['status']) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, status } : c));
  };

  const handleAssignAgent = (convId: string, agentId: string) => {
    const agent = agents.find(a => a.id === agentId) || null;
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, assignedAgent: agent } : c));
  };

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* Left Panel: Conversation List */}
      <div className="w-[380px] border-r flex flex-col bg-card shrink-0">
        <div className="p-4 border-b flex flex-col gap-4">
          <h2 className="font-semibold text-lg">Inbox</h2>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                className="pl-9 bg-muted/50 border-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-inbox"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[110px] bg-muted/50 border-none" data-testid="select-filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="divide-y">
            {filteredConversations.map((conv) => {
              const Icon = getChannelIcon(conv.channel);
              const isSelected = conv.id === selectedId;
              const lastMessage = conv.messages[conv.messages.length - 1];

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    setSelectedId(conv.id);
                    if (conv.unreadCount > 0) {
                      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c));
                    }
                  }}
                  className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'}`}
                  data-testid={`conversation-item-${conv.id}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-sm">{conv.customer.name}</div>
                      <Icon className={`h-3 w-3 ${getChannelColor(conv.channel)}`} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(conv.lastMessageAt), "HH:mm")}
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <div className="text-sm text-muted-foreground truncate pr-4 flex-1">
                      <span className={lastMessage?.sender === 'agent' ? "text-primary/70" : ""}>
                        {lastMessage?.sender === 'agent' ? 'You: ' : ''}
                      </span>
                      {lastMessage?.content}
                    </div>
                    {conv.unreadCount > 0 && (
                      <Badge variant="default" className="h-5 min-w-[20px] flex items-center justify-center rounded-full px-1.5 shrink-0">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 ${getStatusColor(conv.status)}`}>
                      {conv.status}
                    </Badge>
                    {conv.assignedAgent && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-muted/50 border-none">
                        {conv.assignedAgent.name.split(' ')[0]}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredConversations.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No conversations found.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel: Chat Thread */}
      {selectedConv ? (
        <div className="flex-1 flex flex-col bg-background">
          {/* Chat Header */}
          <div className="h-[72px] border-b flex items-center justify-between px-6 bg-card shrink-0">
            <div className="flex items-center gap-4">
              <Avatar className="h-10 w-10 border">
                <AvatarImage src={selectedConv.customer.avatar} />
                <AvatarFallback>{selectedConv.customer.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold flex items-center gap-2">
                  {selectedConv.customer.name}
                  {React.createElement(getChannelIcon(selectedConv.channel), { className: `h-4 w-4 ${getChannelColor(selectedConv.channel)}` })}
                </div>
                <div className="text-sm text-muted-foreground">{selectedConv.customer.phone}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Select value={selectedConv.assignedAgent?.id || "unassigned"} onValueChange={(val) => handleAssignAgent(selectedConv.id, val === "unassigned" ? "" : val)}>
                <SelectTrigger className="w-[160px] h-9" data-testid="select-assign-agent">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{selectedConv.assignedAgent?.name || "Unassigned"}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedConv.status} onValueChange={(val: any) => handleStatusChange(selectedConv.id, val)}>
                <SelectTrigger className={`w-[130px] h-9 ${getStatusColor(selectedConv.status)} border-none`} data-testid="select-change-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="button-chat-options">
                    <MoreVertical className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>View Profile</DropdownMenuItem>
                  <DropdownMenuItem>Block Contact</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">Delete Conversation</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Messages Area */}
          <div 
            className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/20" 
            ref={scrollRef}
          >
            {selectedConv.messages.map((msg, i) => {
              const isMe = msg.sender === 'agent';
              const isBot = msg.sender === 'bot';
              
              let showDateDivider = false;
              if (i === 0) {
                showDateDivider = true;
              } else {
                const prevDate = new Date(selectedConv.messages[i-1].timestamp).toDateString();
                const currDate = new Date(msg.timestamp).toDateString();
                showDateDivider = prevDate !== currDate;
              }

              return (
                <React.Fragment key={msg.id}>
                  {showDateDivider && (
                    <div className="flex justify-center my-6">
                      <div className="bg-muted/50 px-3 py-1 rounded-full text-xs text-muted-foreground font-medium">
                        {format(new Date(msg.timestamp), "MMMM d, yyyy")}
                      </div>
                    </div>
                  )}
                  
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      isMe 
                        ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                        : isBot 
                          ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 rounded-tl-sm'
                          : 'bg-card border shadow-sm text-card-foreground rounded-tl-sm'
                    }`}>
                      <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 px-1">
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(msg.timestamp), "HH:mm")}
                      </span>
                      {isMe && <CheckCircle className="h-3 w-3 text-primary/60" />}
                      {isBot && <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Automated</span>}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Reply Area */}
          <div className="p-4 bg-card border-t shrink-0">
            <div className="flex items-end gap-2 bg-muted/30 rounded-xl border p-2 focus-within:ring-1 focus-within:ring-ring transition-all">
              <div className="flex gap-1 pb-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground">
                  <Smile className="h-4 w-4" />
                </Button>
              </div>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message... (Press Enter to send)"
                className="flex-1 bg-transparent border-none resize-none outline-none max-h-32 min-h-[40px] py-2 px-2 text-sm"
                rows={1}
                data-testid="textarea-reply"
              />
              <Button 
                onClick={handleSend} 
                disabled={!replyText.trim()}
                className="h-10 px-4 rounded-lg bg-primary hover:bg-primary/90"
                data-testid="button-send-reply"
              >
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-muted/10">
          <div className="text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Select a conversation to start chatting</p>
          </div>
        </div>
      )}
    </div>
  );
}
