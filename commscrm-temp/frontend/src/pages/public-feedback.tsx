import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Star, CheckCircle2, MessageSquare } from "lucide-react";
import { getBaseUrl } from "@/lib/api";

const LABELS: Record<number, { text: string; emoji: string; color: string }> = {
  1: { text: "Terrible",  emoji: "😞", color: "text-red-500" },
  2: { text: "Poor",      emoji: "😕", color: "text-orange-500" },
  3: { text: "Okay",      emoji: "😐", color: "text-yellow-500" },
  4: { text: "Good",      emoji: "😊", color: "text-blue-500" },
  5: { text: "Excellent", emoji: "🤩", color: "text-green-500" },
};

export default function PublicFeedback() {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const active = hover || rating;
  const info = active ? LABELS[active] : null;

  const handleSubmit = async () => {
    if (!rating) { setError("Please select a rating before submitting."); return; }
    setLoading(true);
    setError("");
    try {
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/feedback/public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment || undefined, customerName: name || undefined, channel: "web" }),
      });
      if (!res.ok) throw new Error("Submission failed");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-blue-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Thank you{name ? `, ${name.split(" ")[0]}` : ""}!</h2>
            <p className="text-muted-foreground mt-2 text-base">
              Your feedback has been submitted. We really appreciate you taking the time to let us know how we're doing.
            </p>
          </div>
          <div className="flex justify-center gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className={`h-7 w-7 ${s <= rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/20"}`} />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">You can close this page now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-blue-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 p-4">
      <div className="max-w-lg w-full">
        {/* Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-border/50 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-8 text-white text-center">
            <div className="flex justify-center mb-3">
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">Share Your Experience</h1>
            <p className="text-violet-100 mt-1 text-sm">How would you rate your recent interaction with us?</p>
          </div>

          {/* Form */}
          <div className="px-8 py-8 space-y-6">
            {/* Star Rating */}
            <div className="text-center space-y-3">
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onMouseEnter={() => setHover(s)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => { setRating(s); setError(""); }}
                    className="transition-transform hover:scale-110 active:scale-95 p-1"
                    aria-label={`Rate ${s} stars`}
                  >
                    <Star
                      className={`h-10 w-10 transition-all duration-150 ${
                        s <= active
                          ? "text-yellow-400 fill-yellow-400 drop-shadow-sm"
                          : "text-gray-200 dark:text-zinc-700"
                      }`}
                    />
                  </button>
                ))}
              </div>
              {info && (
                <p className={`text-lg font-semibold transition-all ${info.color}`}>
                  {info.emoji} {info.text}
                </p>
              )}
              {!active && (
                <p className="text-sm text-muted-foreground">Tap a star to rate</p>
              )}
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Your name <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                placeholder="e.g. Sarah"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11"
              />
            </div>

            {/* Comment */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Additional comments <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                placeholder="Tell us more about your experience..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={loading || !rating}
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
            >
              {loading ? "Submitting…" : "Submit Feedback"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Your feedback helps us improve our service. Thank you for your time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
