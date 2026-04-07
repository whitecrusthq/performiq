import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import {
  Star, MessageSquare, ThumbsUp, ThumbsDown, Search, Plus, TrendingUp,
  Copy, Check, QrCode, Link2, Mail, Smartphone, Share2, Download, Globe,
} from "lucide-react";
import { SiWhatsapp as WhatsApp } from "react-icons/si";
import { format } from "date-fns";
import { getChannelIcon, getChannelColor } from "@/lib/mock-data";

interface FeedbackEntry {
  id: number;
  rating: number;
  comment: string | null;
  channel: string;
  createdAt: string;
  customer: { id: number; name: string; phone: string | null } | null;
  agent: { id: number; name: string } | null;
}

interface FeedbackResponse {
  total: number;
  avgRating: number;
  feedback: FeedbackEntry[];
}

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const sz = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`${sz} ${s <= rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

function getRatingLabel(r: number) {
  if (r >= 5) return { label: "Excellent", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
  if (r >= 4) return { label: "Good", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
  if (r >= 3) return { label: "Neutral", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" };
  if (r >= 2) return { label: "Poor", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" };
  return { label: "Terrible", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="outline" size="sm" onClick={copy} className="gap-1.5 shrink-0">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : (label ?? "Copy")}
    </Button>
  );
}

function CollectFeedbackTab() {
  const { toast } = useToast();
  const qrRef = useRef<HTMLDivElement>(null);
  const feedbackUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/feedback-form`;

  const embedCode = `<iframe
  src="${feedbackUrl}"
  width="100%"
  height="600"
  style="border:none;border-radius:12px;"
  title="Feedback Form">
</iframe>`;

  const whatsappMsg = encodeURIComponent(`Hi! We'd love to hear your feedback 😊\nPlease rate your experience here:\n${feedbackUrl}`);
  const emailBody = encodeURIComponent(`Hi,\n\nThank you for connecting with us! We'd love to hear how your experience was.\n\nPlease take 30 seconds to share your feedback:\n${feedbackUrl}\n\nYour feedback helps us serve you better.\n\nWarm regards,\nCustomer Service Team`);
  const smsBody = encodeURIComponent(`We'd love your feedback! Rate your experience: ${feedbackUrl}`);

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 400; canvas.height = 400;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, 400, 400);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 400, 400);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = "feedback-qr-code.png";
      a.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* QR Code */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              QR Code
            </CardTitle>
            <p className="text-sm text-muted-foreground">Print or display at your service desk, reception, or point of sale. Customers scan to leave feedback instantly.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div ref={qrRef} className="flex justify-center">
              <div className="p-4 bg-white rounded-2xl border shadow-sm inline-block">
                <QRCodeSVG
                  value={feedbackUrl}
                  size={200}
                  level="H"
                  includeMargin={false}
                  fgColor="#4F46E5"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadQR}>
                <Download className="h-3.5 w-3.5" />
                Download PNG
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                const svg = qrRef.current?.querySelector("svg");
                if (!svg) return;
                const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "feedback-qr-code.svg"; a.click();
              }}>
                <Download className="h-3.5 w-3.5" />
                Download SVG
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Share Link */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                Shareable Link
              </CardTitle>
              <p className="text-sm text-muted-foreground">Share this link anywhere — email, SMS, social media, or your website.</p>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input value={feedbackUrl} readOnly className="font-mono text-xs bg-muted/40" />
                <CopyButton value={feedbackUrl} />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full gap-2"
                onClick={() => window.open(feedbackUrl, "_blank")}
              >
                <Globe className="h-3.5 w-3.5" />
                Open Preview
              </Button>
            </CardContent>
          </Card>

          {/* Channel Share Buttons */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Share2 className="h-4 w-4 text-primary" />
                Share via Channel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <a
                href={`https://wa.me/?text=${whatsappMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-[#25D366]/5 hover:border-[#25D366]/30 transition-colors cursor-pointer"
              >
                <div className="h-9 w-9 rounded-full bg-[#25D366]/10 flex items-center justify-center shrink-0">
                  <WhatsApp className="h-4 w-4 text-[#25D366]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">WhatsApp</p>
                  <p className="text-xs text-muted-foreground">Send a pre-written message with the link</p>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">Template ready</Badge>
              </a>

              <a
                href={`mailto:?subject=We'd love your feedback!&body=${emailBody}`}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-900/10 transition-colors cursor-pointer"
              >
                <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <Mail className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-xs text-muted-foreground">Opens your email client with a template</p>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">Template ready</Badge>
              </a>

              <a
                href={`sms:?&body=${smsBody}`}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-purple-50 hover:border-purple-200 dark:hover:bg-purple-900/10 transition-colors cursor-pointer"
              >
                <div className="h-9 w-9 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                  <Smartphone className="h-4 w-4 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">SMS / Text</p>
                  <p className="text-xs text-muted-foreground">Opens your SMS app with the link pre-filled</p>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">Template ready</Badge>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Embed Code */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Embed on Your Website
          </CardTitle>
          <p className="text-sm text-muted-foreground">Paste this HTML snippet into any webpage to embed the feedback form directly.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <pre className="bg-muted/50 rounded-lg p-4 text-xs font-mono overflow-x-auto border whitespace-pre-wrap break-all">{embedCode}</pre>
          </div>
          <CopyButton value={embedCode} label="Copy Embed Code" />
        </CardContent>
      </Card>

      {/* WhatsApp Message Template */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Message Templates
          </CardTitle>
          <p className="text-sm text-muted-foreground">Copy these templates to send manually through WhatsApp, Facebook, or Instagram.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            {
              name: "Short & Friendly",
              text: `Hi! 😊 How was your experience with us today?\nWe'd love your feedback: ${feedbackUrl}`,
            },
            {
              name: "Professional",
              text: `Dear valued customer,\n\nThank you for choosing us. We are committed to providing the best service possible and your opinion matters.\n\nPlease take a moment to share your experience: ${feedbackUrl}\n\nWe appreciate your time.`,
            },
            {
              name: "Post-Chat",
              text: `Thanks for chatting with us today! 🙏 We hope we were able to help you.\n\nWould you mind rating your experience? It only takes 30 seconds:\n${feedbackUrl}`,
            },
          ].map((t) => (
            <div key={t.name} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.name}</span>
                <CopyButton value={t.text} label="Copy" />
              </div>
              <p className="text-sm text-foreground/80 whitespace-pre-line">{t.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function FeedbackPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [newChannel, setNewChannel] = useState("whatsapp");
  const [hoverRating, setHoverRating] = useState(0);

  const { data, isLoading } = useQuery<FeedbackResponse>({
    queryKey: ["feedback"],
    queryFn: () => apiGet("/feedback"),
    refetchInterval: 30000,
  });

  const addMutation = useMutation({
    mutationFn: () => apiPost("/feedback", { rating: newRating, comment: newComment || undefined, channel: newChannel }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feedback"] });
      toast({ title: "Feedback recorded" });
      setShowAddDialog(false);
      setNewComment("");
      setNewRating(5);
    },
    onError: () => toast({ title: "Failed to save feedback", variant: "destructive" }),
  });

  const allFeedback = data?.feedback ?? [];
  const filtered = allFeedback.filter((f) => {
    const matchSearch = !search || (f.customer?.name ?? "").toLowerCase().includes(search.toLowerCase()) || (f.comment ?? "").toLowerCase().includes(search.toLowerCase());
    const matchRating = ratingFilter === "all" || f.rating === parseInt(ratingFilter);
    const matchChannel = channelFilter === "all" || f.channel === channelFilter;
    return matchSearch && matchRating && matchChannel;
  });

  const satisfied = allFeedback.filter((f) => f.rating >= 4).length;
  const unsatisfied = allFeedback.filter((f) => f.rating <= 2).length;
  const ratingCounts = [5, 4, 3, 2, 1].map((r) => ({ r, count: allFeedback.filter((f) => f.rating === r).length }));

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customer Feedback</h1>
          <p className="text-muted-foreground text-sm">CSAT ratings and reviews from your customers</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Feedback
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-2 bg-blue-50 dark:bg-blue-950/30 p-1">
          <TabsTrigger
            value="overview"
            className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-blue-600 dark:data-[state=inactive]:text-blue-400"
          >
            <MessageSquare className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger
            value="collect"
            className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-blue-600 dark:data-[state=inactive]:text-blue-400"
          >
            <Share2 className="h-3.5 w-3.5" /> Collect Feedback
          </TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW TAB ──────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Responses</p>
                    <p className="text-3xl font-bold mt-1">{data?.total ?? 0}</p>
                  </div>
                  <MessageSquare className="h-5 w-5 text-muted-foreground mt-1" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Rating</p>
                    <p className="text-3xl font-bold mt-1">{data?.avgRating?.toFixed(1) ?? "—"}</p>
                    <StarRating rating={Math.round(data?.avgRating ?? 0)} />
                  </div>
                  <TrendingUp className="h-5 w-5 text-muted-foreground mt-1" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Satisfied (4–5★)</p>
                    <p className="text-3xl font-bold mt-1 text-green-600">{satisfied}</p>
                    <p className="text-xs text-muted-foreground">{data?.total ? Math.round(satisfied / data.total * 100) : 0}% of responses</p>
                  </div>
                  <ThumbsUp className="h-5 w-5 text-green-500 mt-1" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Unsatisfied (1–2★)</p>
                    <p className="text-3xl font-bold mt-1 text-red-500">{unsatisfied}</p>
                    <p className="text-xs text-muted-foreground">{data?.total ? Math.round(unsatisfied / data.total * 100) : 0}% of responses</p>
                  </div>
                  <ThumbsDown className="h-5 w-5 text-red-500 mt-1" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Rating Breakdown */}
            <Card className="md:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Rating Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ratingCounts.map(({ r, count }) => (
                  <div key={r} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">{r}</span>
                    <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400 shrink-0" />
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${data?.total ? (count / data.total) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-5 text-right">{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Feedback List */}
            <div className="md:col-span-3 space-y-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by customer or comment..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Select value={ratingFilter} onValueChange={setRatingFilter}>
                  <SelectTrigger className="w-[130px]"><SelectValue placeholder="Rating" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ratings</SelectItem>
                    <SelectItem value="5">5 Stars</SelectItem>
                    <SelectItem value="4">4 Stars</SelectItem>
                    <SelectItem value="3">3 Stars</SelectItem>
                    <SelectItem value="2">2 Stars</SelectItem>
                    <SelectItem value="1">1 Star</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={channelFilter} onValueChange={setChannelFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Channel" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All channels</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="web">Web Form</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isLoading ? (
                <div className="py-12 text-center text-muted-foreground text-sm">Loading feedback...</div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">No feedback found.</div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((fb) => {
                    const { label, color } = getRatingLabel(fb.rating);
                    const Icon = getChannelIcon(fb.channel);
                    return (
                      <Card key={fb.id} className="shadow-sm">
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
                                {(fb.customer?.name ?? "?").charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm">{fb.customer?.name ?? "Anonymous"}</span>
                                  <Icon className={`h-3.5 w-3.5 ${getChannelColor(fb.channel)}`} />
                                  <Badge className={`text-[10px] px-1.5 py-0 h-4 ${color}`}>{label}</Badge>
                                  {fb.channel === "web" && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">Web Form</Badge>}
                                </div>
                                {fb.comment && (
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">"{fb.comment}"</p>
                                )}
                                <div className="flex items-center gap-3 mt-2">
                                  <StarRating rating={fb.rating} />
                                  {fb.agent && <span className="text-xs text-muted-foreground">Handled by {fb.agent.name.split(" ")[0]}</span>}
                                  <span className="text-xs text-muted-foreground">{format(new Date(fb.createdAt), "MMM d, yyyy")}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── COLLECT TAB ───────────────────────────────────────────────────── */}
        <TabsContent value="collect" className="mt-4">
          <CollectFeedbackTab />
        </TabsContent>
      </Tabs>

      {/* Add Feedback Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Customer Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label>Rating</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onMouseEnter={() => setHoverRating(s)} onMouseLeave={() => setHoverRating(0)} onClick={() => setNewRating(s)} className="p-1">
                    <Star className={`h-7 w-7 transition-colors ${s <= (hoverRating || newRating) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`} />
                  </button>
                ))}
                <span className="ml-2 text-sm text-muted-foreground self-center">{getRatingLabel(hoverRating || newRating).label}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={newChannel} onValueChange={setNewChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Comment (optional)</Label>
              <Textarea placeholder="Customer's feedback..." value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending ? "Saving..." : "Save Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
