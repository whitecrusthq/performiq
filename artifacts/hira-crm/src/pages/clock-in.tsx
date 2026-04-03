import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, LogIn, LogOut, CalendarDays, Users, Timer,
  MapPin, AlertCircle, Radio, ChevronDown, ChevronUp,
  WifiOff, Wifi, CloudUpload, Camera, RefreshCw, CheckCircle2,
  ZoomIn, ShieldCheck, ShieldAlert, ShieldQuestion, ScanFace, UserCircle2,
  Activity, MessageSquare, CheckCheck, Hourglass, WifiOff as WifiOffIcon,
  CalendarClock, Plus, Pencil, Trash2, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiFetch, apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";

const PING_INTERVAL_MS = 30 * 60 * 1000;
const QUEUE_KEY = "crm_attendance_ping_queue";
const CAPTURE_WIDTH = 320;
const CAPTURE_HEIGHT = 240;

// ── Offline queue ─────────────────────────────────────────────────────────────
interface QueuedPing { lat: number; lng: number; recordedAt: string }
type LatLng = { lat: number; lng: number } | null;

function readQueue(): QueuedPing[] { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]"); } catch { return []; } }
function writeQueue(q: QueuedPing[]) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }
function enqueuePing(ping: QueuedPing) { writeQueue([...readQueue(), ping]); }
function clearQueue() { localStorage.removeItem(QUEUE_KEY); }

// ── API helpers ───────────────────────────────────────────────────────────────
async function crmFetch(path: string, opts: RequestInit = {}) {
  const r = await apiFetch(path, opts);
  if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error ?? "Request failed"); }
  return r.json();
}

// ── Geo ───────────────────────────────────────────────────────────────────────
function getLocation(): Promise<LatLng> {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 30000 }
    );
  });
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtTime(ts?: string | null) { if (!ts) return "—"; return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function fmtDuration(mins?: number | null) { if (!mins) return "—"; const h = Math.floor(mins / 60); const m = mins % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; }
function fmtDate(d: string) { return new Date(d + "T00:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }); }
function fmtCoords(lat?: string | null, lng?: string | null) { if (!lat || !lng) return null; return `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`; }
function mapsUrl(lat: string | number, lng: string | number) { return `https://www.google.com/maps?q=${lat},${lng}`; }
function fmtCountdown(secs: number) { const m = Math.floor(secs / 60); const s = secs % 60; return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`; }

// ── Face Capture Modal ────────────────────────────────────────────────────────
interface FaceCaptureProps {
  open: boolean;
  action: "clock-in" | "clock-out";
  onConfirm: (faceImage: string | null, photoTime: string | null) => void;
  onCancel: () => void;
}

function FaceCaptureModal({ open, action, onConfirm, onCancel }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [photoTime, setPhotoTime] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setStarting(true);
    setCamError(null);
    setCaptured(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: CAPTURE_WIDTH }, height: { ideal: CAPTURE_HEIGHT } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCamError("Camera access denied. You can skip photo capture and continue.");
    } finally {
      setStarting(false);
    }
  }, []);

  useEffect(() => {
    if (open) startCamera();
    return () => { stopCamera(); setCaptured(null); setPhotoTime(null); setCamError(null); };
  }, [open, startCamera, stopCamera]);

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const snapTime = new Date().toISOString();
    canvas.width = CAPTURE_WIDTH;
    canvas.height = CAPTURE_HEIGHT;
    const ctx = canvas.getContext("2d")!;
    ctx.save();
    ctx.translate(CAPTURE_WIDTH, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);
    ctx.restore();
    const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    setCaptured(dataUrl);
    setPhotoTime(snapTime);
    stopCamera();
  };

  const retake = () => { setCaptured(null); setPhotoTime(null); startCamera(); };

  if (!open) return null;

  const label = action === "clock-in" ? "Clock In" : "Clock Out";
  const ringColor = action === "clock-in" ? "ring-green-400" : "ring-red-400";

  return (
    <Dialog open={open} onOpenChange={() => { stopCamera(); onCancel(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-4 h-4" /> Face Capture — {label}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Take a quick selfie to verify your identity</p>
        </DialogHeader>

        <div className="relative bg-black mx-5 rounded-xl overflow-hidden" style={{ aspectRatio: "4/3" }}>
          {!captured ? (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
                playsInline muted autoPlay
              />
              {starting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                </div>
              )}
              {camError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-4 text-center">
                  <AlertCircle className="w-8 h-8 text-yellow-400" />
                  <p className="text-white text-sm">{camError}</p>
                </div>
              )}
              {!starting && !camError && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className={`w-36 h-44 rounded-full border-2 border-dashed ${ringColor} opacity-70`} />
                </div>
              )}
            </>
          ) : (
            <img src={captured} alt="Captured face" className="w-full h-full object-cover" />
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="px-5 pb-5 pt-4 flex flex-col gap-3">
          {!captured ? (
            <div className="flex gap-2">
              {!camError ? (
                <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={capturePhoto} disabled={starting}>
                  <Camera className="w-4 h-4" /> Capture Photo
                </Button>
              ) : (
                <Button variant="outline" className="flex-1 gap-2" onClick={startCamera}>
                  <RefreshCw className="w-4 h-4" /> Retry Camera
                </Button>
              )}
              <Button variant="ghost" className="gap-1 text-muted-foreground text-xs" onClick={() => onConfirm(null, null)}>
                Skip
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={() => onConfirm(captured, photoTime)}>
                <CheckCircle2 className="w-4 h-4" /> Looks Good — {label}
              </Button>
              <Button variant="outline" size="icon" onClick={retake} title="Retake">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          )}
          <button className="text-xs text-muted-foreground underline text-center" onClick={() => { stopCamera(); onCancel(); }}>
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Face thumbnail ────────────────────────────────────────────────────────────
function FaceThumb({ src, label, photoTime }: { src: string; label: string; photoTime?: string | null }) {
  const [zoom, setZoom] = useState(false);
  return (
    <>
      <button
        className="group relative w-9 h-9 rounded-full overflow-hidden border-2 border-border hover:border-primary transition-colors"
        onClick={() => setZoom(true)}
        title={`View ${label} photo`}
      >
        <img src={src} alt={label} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <ZoomIn className="w-3 h-3 text-white" />
        </div>
      </button>
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-xs p-4 text-center">
          <DialogHeader>
            <DialogTitle className="text-sm">{label}</DialogTitle>
            {photoTime && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Photo taken at {new Date(photoTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} on {new Date(photoTime).toLocaleDateString()}
              </p>
            )}
          </DialogHeader>
          <img src={src} alt={label} className="w-full rounded-xl mt-2" />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Face review badge ─────────────────────────────────────────────────────────
function FaceReviewBadge({ status }: { status?: string | null }) {
  if (!status || status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-medium">
        <ShieldQuestion className="w-3 h-3" /> Pending
      </span>
    );
  }
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
        <ShieldCheck className="w-3 h-3" /> Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">
      <ShieldAlert className="w-3 h-3" /> Flagged
    </span>
  );
}

// ── Face Review Modal ─────────────────────────────────────────────────────────
function FaceReviewModal({ log, isManager, open, onClose, onReview, reviewing }: {
  log: any; isManager: boolean; open: boolean; onClose: () => void;
  onReview: (logId: number, status: "verified" | "flagged" | "pending") => void; reviewing: boolean;
}) {
  if (!log) return null;
  const profilePhoto = log.agent?.avatar;
  const hasAnyPhoto = profilePhoto || log.faceImageIn || log.faceImageOut;
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace className="w-5 h-5" />
            Face Identity Review — {log.agent?.name ?? "Agent"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground pt-1">
            {new Date(log.date + "T00:00:00").toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </DialogHeader>

        {!hasAnyPhoto && (
          <div className="text-center py-8 text-muted-foreground">
            <ScanFace className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No photos available for this record.</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mt-2">
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reference Photo</p>
            {profilePhoto ? (
              <img src={profilePhoto} alt="Reference" className="w-full aspect-square object-cover rounded-xl border-2 border-primary/40" />
            ) : (
              <div className="w-full aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 bg-muted/30">
                <UserCircle2 className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-[11px] text-muted-foreground text-center px-2">No reference photo set for this agent</p>
              </div>
            )}
            <span className="text-[10px] text-muted-foreground">Profile on file</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Clock-In Selfie</p>
            {log.faceImageIn ? (
              <img src={log.faceImageIn} alt="Clock-in" className="w-full aspect-square object-cover rounded-xl border-2 border-green-400/50" />
            ) : (
              <div className="w-full aspect-square rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
                <p className="text-[11px] text-muted-foreground">No clock-in photo</p>
              </div>
            )}
            {log.clockInPhotoTime && (
              <span className="text-[10px] text-muted-foreground">
                {new Date(log.clockInPhotoTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
          </div>

          <div className="flex flex-col items-center gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Clock-Out Selfie</p>
            {log.faceImageOut ? (
              <img src={log.faceImageOut} alt="Clock-out" className="w-full aspect-square object-cover rounded-xl border-2 border-orange-400/50" />
            ) : (
              <div className="w-full aspect-square rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
                <p className="text-[11px] text-muted-foreground">No clock-out photo</p>
              </div>
            )}
            {log.clockOutPhotoTime && (
              <span className="text-[10px] text-muted-foreground">
                {new Date(log.clockOutPhotoTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2 mt-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Review Status:</span>
            <FaceReviewBadge status={log.faceReviewStatus} />
          </div>
          {log.faceReviewedAt && (
            <span className="text-[10px] text-muted-foreground">
              Reviewed {new Date(log.faceReviewedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {isManager && (
          <div className="flex gap-2 mt-1">
            <Button
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1.5"
              disabled={reviewing || log.faceReviewStatus === "verified"}
              onClick={() => onReview(log.id, "verified")}
            >
              <ShieldCheck className="w-4 h-4" />
              {reviewing ? "Saving…" : "Verify — Photos Match"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1 gap-1.5"
              disabled={reviewing || log.faceReviewStatus === "flagged"}
              onClick={() => onReview(log.id, "flagged")}
            >
              <ShieldAlert className="w-4 h-4" />
              {reviewing ? "Saving…" : "Flag — Suspicious"}
            </Button>
            {log.faceReviewStatus !== "pending" && (
              <Button size="sm" variant="outline" disabled={reviewing} onClick={() => onReview(log.id, "pending")} title="Reset to pending">
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ log }: { log: any }) {
  if (!log) return <Badge variant="outline">Not clocked in</Badge>;
  if (log.clockIn && !log.clockOut) return <Badge className="bg-green-500 text-white">Clocked In</Badge>;
  if (log.clockOut) return <Badge variant="secondary">Clocked Out</Badge>;
  return <Badge variant="outline">—</Badge>;
}

function ShiftBenchmarkBadge({ log }: { log: any }) {
  const diff = log?.clockInDiffMinutes;
  const grace = log?.shiftGraceMinutes ?? 15;
  const expected = log?.shiftStartExpected;
  if (diff == null || expected == null) return <span className="text-[11px] text-muted-foreground">No shift set</span>;
  if (diff < -5) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-400">
        <CheckCircle2 className="w-3 h-3" /> Early {Math.abs(diff)}m
        <span className="text-muted-foreground font-normal">({expected})</span>
      </span>
    );
  }
  if (diff <= grace) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 dark:text-green-400">
        <CheckCircle2 className="w-3 h-3" /> On Time
        <span className="text-muted-foreground font-normal">({expected})</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-600 dark:text-orange-400">
      <AlertCircle className="w-3 h-3" /> Late {diff}m
      <span className="text-muted-foreground font-normal">({expected})</span>
    </span>
  );
}

function PingsCell({ logId }: { logId: number }) {
  const [open, setOpen] = useState(false);
  const { data: pings = [] } = useQuery({
    queryKey: ["crm-pings", logId],
    queryFn: () => apiGet(`/attendance/${logId}/pings`),
    enabled: open,
  } as Parameters<typeof useQuery>[0]);
  return (
    <div>
      <button className="text-xs flex items-center gap-1 text-primary hover:underline" onClick={() => setOpen(o => !o)}>
        <Radio className="w-3 h-3" />
        {open ? "Hide" : "Show"} pings
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="mt-2 space-y-1 max-h-36 overflow-y-auto pr-1">
          {(pings as any[]).length === 0
            ? <p className="text-xs text-muted-foreground">No periodic pings recorded</p>
            : (pings as any[]).map((p: any, i: number) => {
              const prev = i > 0 ? (pings as any[])[i - 1] : null;
              const gapMins = prev ? Math.round((new Date(p.recordedAt).getTime() - new Date(prev.recordedAt).getTime()) / 60000) : null;
              const isLargeGap = gapMins !== null && gapMins > 60;
              return (
                <div key={p.id}>
                  {isLargeGap && (
                    <div className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400 py-0.5">
                      <AlertCircle className="w-3 h-3" /> {Math.round(gapMins / 60)}h gap — possible offline period
                    </div>
                  )}
                  <a href={mapsUrl(p.lat, p.lng)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {new Date(p.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {" — "}{parseFloat(p.lat).toFixed(4)}, {parseFloat(p.lng).toFixed(4)}
                  </a>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

function LocationCell({ log }: { log: any }) {
  const inCoords = fmtCoords(log.clockInLat, log.clockInLng);
  const outCoords = fmtCoords(log.clockOutLat, log.clockOutLng);
  return (
    <div className="flex flex-col gap-1.5">
      {inCoords
        ? <a href={mapsUrl(log.clockInLat, log.clockInLng)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline">
            <MapPin className="w-3 h-3" /> In: {inCoords}
          </a>
        : <span className="text-xs text-muted-foreground">In: —</span>}
      {outCoords
        ? <a href={mapsUrl(log.clockOutLat, log.clockOutLng)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 hover:underline">
            <MapPin className="w-3 h-3" /> Out: {outCoords}
          </a>
        : log.clockOut ? <span className="text-xs text-muted-foreground">Out: —</span> : null}
      <PingsCell logId={log.id} />
    </div>
  );
}

function FaceCell({ log, isManager, onReviewClick }: { log: any; isManager: boolean; onReviewClick?: (log: any) => void }) {
  const fmtPhotoTime = (t: string | null | undefined) =>
    t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-3">
        {log.faceImageIn
          ? <div className="flex flex-col items-center gap-0.5">
              <FaceThumb src={log.faceImageIn} label="Clock-in photo" photoTime={log.clockInPhotoTime} />
              <span className="text-[10px] text-green-600 font-medium">In</span>
              {log.clockInPhotoTime && <span className="text-[10px] text-muted-foreground">{fmtPhotoTime(log.clockInPhotoTime)}</span>}
            </div>
          : <div className="flex flex-col items-center gap-0.5">
              <div className="w-9 h-9 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground">In</span>
              </div>
            </div>}
        {log.faceImageOut
          ? <div className="flex flex-col items-center gap-0.5">
              <FaceThumb src={log.faceImageOut} label="Clock-out photo" photoTime={log.clockOutPhotoTime} />
              <span className="text-[10px] text-orange-600 font-medium">Out</span>
              {log.clockOutPhotoTime && <span className="text-[10px] text-muted-foreground">{fmtPhotoTime(log.clockOutPhotoTime)}</span>}
            </div>
          : log.clockOut
            ? <div className="flex flex-col items-center gap-0.5">
                <div className="w-9 h-9 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                  <span className="text-[10px] text-muted-foreground">Out</span>
                </div>
              </div>
            : null}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <FaceReviewBadge status={log.faceReviewStatus} />
        {isManager && (
          <button onClick={() => onReviewClick?.(log)} className="text-[10px] flex items-center gap-0.5 text-primary hover:underline">
            <ScanFace className="w-3 h-3" /> Review
          </button>
        )}
      </div>
    </div>
  );
}

// ── Activity Status helpers ───────────────────────────────────────────────────
type ActivityStatus = "active" | "away" | "idle" | "offline" | "clocked-out";

const STATUS_META: Record<ActivityStatus, { label: string; dot: string; badge: string }> = {
  active:      { label: "Active",      dot: "bg-green-500",  badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  away:        { label: "Away",        dot: "bg-yellow-400", badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  idle:        { label: "Idle",        dot: "bg-orange-400", badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  offline:     { label: "Offline",     dot: "bg-gray-400",   badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  "clocked-out": { label: "Clocked Out", dot: "bg-blue-400", badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
};

function fmtIdleTime(mins: number | null) {
  if (mins === null) return "No data";
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60); const m = mins % 60;
  return `${h}h ${m}m ago`;
}

function AgentStatusCard({ agent }: { agent: any }) {
  const status: ActivityStatus = agent.activityStatus ?? "offline";
  const meta = STATUS_META[status];
  const initials = (agent.name ?? "?").split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="relative shrink-0">
            {agent.avatar ? (
              <img src={agent.avatar} alt={agent.name} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground">
                {initials}
              </div>
            )}
            {/* Status dot */}
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${meta.dot}`} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-semibold truncate">{agent.name}</p>
              <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${meta.badge}`}>
                {meta.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground capitalize">{agent.role}</p>

            {/* Stats row */}
            <div className="flex items-center gap-3 mt-2 text-xs">
              {status !== "clocked-out" && (
                <>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MessageSquare className="w-3 h-3" />
                    {agent.activeConversations ?? 0} open
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <CheckCheck className="w-3 h-3" />
                    {agent.resolvedToday ?? 0} resolved
                  </span>
                </>
              )}
              {status === "clocked-out" && (
                <span className="text-muted-foreground">
                  {fmtDuration(agent.durationMinutes)} shift · {agent.resolvedToday ?? 0} resolved
                </span>
              )}
            </div>

            {/* Last active / idle time */}
            {status !== "clocked-out" && (
              <div className="mt-1.5 flex items-center gap-1 text-xs">
                {status === "active" ? (
                  <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Active now
                  </span>
                ) : status === "offline" ? (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <WifiOff className="w-3 h-3" /> {fmtIdleTime(agent.idleMinutes)}
                  </span>
                ) : (
                  <span className={`flex items-center gap-1 ${status === "idle" ? "text-orange-500" : "text-yellow-500"}`}>
                    <Hourglass className="w-3 h-3" /> Idle {fmtIdleTime(agent.idleMinutes)}
                  </span>
                )}
                <span className="text-muted-foreground ml-auto">
                  In: {fmtTime(agent.clockIn)}
                  {agent.shiftDurationMinutes != null && ` · ${fmtDuration(agent.shiftDurationMinutes)}`}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Shift Schedules (admin/supervisor only) ────────────────────────────────────
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ShiftSchedules({ agents }: { agents: any[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editShift, setEditShift] = useState<any>(null);
  const [form, setForm] = useState({
    agentId: "",
    shiftName: "",
    startTime: "09:00",
    endTime: "17:00",
    daysOfWeek: [1, 2, 3, 4, 5],
    graceMinutes: 15,
  });

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["crm-shifts"],
    queryFn: () => apiGet<any[]>("/attendance/shifts"),
  } as Parameters<typeof useQuery>[0]);

  const resetForm = () => {
    setForm({ agentId: "", shiftName: "", startTime: "09:00", endTime: "17:00", daysOfWeek: [1, 2, 3, 4, 5], graceMinutes: 15 });
    setEditShift(null);
    setShowForm(false);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiPost("/attendance/shifts", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-shifts"] }); toast({ title: "Shift created" }); resetForm(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiPut(`/attendance/shifts/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-shifts"] }); toast({ title: "Shift updated" }); resetForm(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/attendance/shifts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-shifts"] }); toast({ title: "Shift deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openEdit = (shift: any) => {
    setEditShift(shift);
    let days: number[] = [1,2,3,4,5];
    try { days = JSON.parse(shift.daysOfWeek); } catch {}
    setForm({
      agentId: String(shift.agentId),
      shiftName: shift.shiftName,
      startTime: shift.startTime,
      endTime: shift.endTime,
      daysOfWeek: days,
      graceMinutes: shift.graceMinutes,
    });
    setShowForm(true);
  };

  const toggleDay = (d: number) => {
    setForm(f => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(d) ? f.daysOfWeek.filter(x => x !== d) : [...f.daysOfWeek, d].sort(),
    }));
  };

  const handleSubmit = () => {
    if (!form.agentId || !form.shiftName || !form.startTime || !form.endTime) {
      toast({ title: "Fill in all required fields", variant: "destructive" }); return;
    }
    const payload = { ...form, agentId: parseInt(form.agentId) };
    if (editShift) updateMutation.mutate({ id: editShift.id, data: payload });
    else createMutation.mutate(payload);
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold">Shift Schedules</h2>
          <span className="text-xs text-muted-foreground">· benchmark clock-in punctuality</span>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="w-3.5 h-3.5" /> Add Shift
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      ) : (shifts as any[]).length === 0 && !showForm ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <CalendarClock className="w-7 h-7 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No shift schedules yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add shifts to benchmark agent clock-in times as early, on-time, or late.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Agent</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Shift</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Hours</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Days</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Grace</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(shifts as any[]).map((s: any) => {
                let days: number[] = [];
                try { days = JSON.parse(s.daysOfWeek); } catch {}
                return (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{s.agent?.name ?? "—"}</td>
                    <td className="px-4 py-2.5">{s.shiftName}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{s.startTime} – {s.endTime}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-0.5">
                        {DAYS.map((d, i) => (
                          <span key={d} className={`text-[10px] px-1 py-0.5 rounded ${days.includes(i) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{d}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{s.graceMinutes}m</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(s)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(s.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit form */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4" />
              {editShift ? "Edit Shift" : "Add Shift Schedule"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <Label className="text-sm mb-1.5 block">Agent</Label>
              <Select value={form.agentId} onValueChange={v => setForm(f => ({ ...f, agentId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select agent…" /></SelectTrigger>
                <SelectContent>
                  {agents.map((a: any) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name ?? a.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Shift Name</Label>
              <Input placeholder="e.g. Morning Shift" value={form.shiftName} onChange={e => setForm(f => ({ ...f, shiftName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm mb-1.5 block">Start Time</Label>
                <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">End Time</Label>
                <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-sm mb-2 block">Working Days</Label>
              <div className="flex gap-1.5 flex-wrap">
                {DAYS.map((d, i) => (
                  <button key={d} type="button"
                    onClick={() => toggleDay(i)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors border ${
                      form.daysOfWeek.includes(i)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary/50"
                    }`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Grace Period (minutes)</Label>
              <Input type="number" min={0} max={60} value={form.graceMinutes}
                onChange={e => setForm(f => ({ ...f, graceMinutes: parseInt(e.target.value) || 0 }))} />
              <p className="text-[11px] text-muted-foreground mt-1">How many minutes late is still counted as "on time"</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isBusy} className="gap-1.5">
              {isBusy && <div className="w-3.5 h-3.5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />}
              {editShift ? "Save Changes" : "Create Shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Activity Monitor Section (admin/supervisor only) ──────────────────────────
function ActivityMonitor() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["crm-attendance-monitor"],
    queryFn: () => apiGet<any>("/attendance/monitor"),
    refetchInterval: 30000,
  } as Parameters<typeof useQuery>[0]);

  const summary = data?.summary ?? {};
  const clockedIn: any[] = data?.clockedIn ?? [];
  const clockedOut: any[] = data?.clockedOut ?? [];
  const hasAnyone = clockedIn.length > 0 || clockedOut.length > 0;

  const summaryItems = [
    { label: "Active",      value: summary.active ?? 0,    colour: "text-green-600 dark:text-green-400",   dot: "bg-green-500" },
    { label: "Away",        value: summary.away ?? 0,      colour: "text-yellow-600 dark:text-yellow-400", dot: "bg-yellow-400" },
    { label: "Idle",        value: summary.idle ?? 0,      colour: "text-orange-600 dark:text-orange-400", dot: "bg-orange-400" },
    { label: "Offline",     value: summary.offline ?? 0,   colour: "text-muted-foreground",                dot: "bg-gray-400" },
    { label: "Clocked Out", value: summary.clockedOut ?? 0,colour: "text-blue-600 dark:text-blue-400",     dot: "bg-blue-400" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold">Activity Monitor</h2>
          {!isLoading && (
            <span className="text-xs text-muted-foreground">· refreshes every 30s</span>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs"
          onClick={() => qc.invalidateQueries({ queryKey: ["crm-attendance-monitor"] })}>
          <RefreshCw className="w-3 h-3" /> Refresh
        </Button>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2">
        {summaryItems.map(item => (
          <div key={item.label} className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
            <span className={`w-2 h-2 rounded-full ${item.dot}`} />
            <span className={`font-semibold ${item.colour}`}>{item.value}</span>
            <span className="text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      ) : !hasAnyone ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No agents have clocked in today yet</p>
        </div>
      ) : (
        <>
          {/* Currently on shift */}
          {clockedIn.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                On Shift ({clockedIn.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {clockedIn.map(agent => (
                  <AgentStatusCard key={agent.logId} agent={agent} />
                ))}
              </div>
            </div>
          )}

          {/* Clocked out today */}
          {clockedOut.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Clocked Out Today ({clockedOut.length})
              </p>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {clockedOut.map((agent: any) => (
                      <tr key={agent.logId} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            {agent.avatar ? (
                              <img src={agent.avatar} alt={agent.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                                {(agent.name ?? "?").split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase()}
                              </div>
                            )}
                            <span className="font-medium">{agent.name}</span>
                            <span className="text-xs text-muted-foreground capitalize">{agent.role}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {fmtTime(agent.clockIn)} → {fmtTime(agent.clockOut)}
                        </td>
                        <td className="px-4 py-2.5 text-xs">{fmtDuration(agent.durationMinutes)}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{agent.resolvedToday} resolved</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_META["clocked-out"].badge}`}>
                            Clocked Out
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ClockIn() {
  const { agent } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isManager = agent?.role === "admin" || agent?.role === "supervisor";

  const [filterDate, setFilterDate] = useState("");
  const [filterAgentId, setFilterAgentId] = useState("");
  const [elapsed, setElapsed] = useState("");

  const [captureOpen, setCaptureOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"clock-in" | "clock-out" | null>(null);
  const [reviewLog, setReviewLog] = useState<any>(null);

  const [pingCount, setPingCount] = useState(0);
  const [nextPingIn, setNextPingIn] = useState<number | null>(null);
  const [queuedCount, setQueuedCount] = useState(() => readQueue().length);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPingTimeRef = useRef<number | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: today, isLoading: todayLoading } = useQuery({
    queryKey: ["crm-attendance-today"],
    queryFn: () => apiGet("/attendance/today"),
    refetchInterval: 30000,
  } as Parameters<typeof useQuery>[0]);

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["crm-attendance", filterDate, filterAgentId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterDate) { params.set("startDate", filterDate); params.set("endDate", filterDate); }
      if (filterAgentId) params.set("agentId", filterAgentId);
      return apiGet(`/attendance?${params}`);
    },
  } as Parameters<typeof useQuery>[0]);

  const { data: agents = [] } = useQuery({
    queryKey: ["crm-agents-list"],
    queryFn: () => apiGet("/agents"),
    enabled: isManager,
  } as Parameters<typeof useQuery>[0]);

  const isClockedIn = today?.clockIn && !today?.clockOut;

  // ── Flush offline queue ───────────────────────────────────────────────────
  const flushQueue = useCallback(async () => {
    const queue = readQueue();
    if (queue.length === 0) return;
    setIsSyncing(true);
    try {
      const result = await crmFetch("/attendance/location-ping/batch", {
        method: "POST",
        body: JSON.stringify({ pings: queue }),
      });
      clearQueue(); setQueuedCount(0); setPingCount(c => c + (result.saved ?? 0));
      qc.invalidateQueries({ queryKey: ["crm-attendance"] });
      qc.invalidateQueries({ queryKey: ["crm-attendance-today"] });
      if (result.saved > 0) toast({ title: "Location updates synced", description: `${result.saved} queued ping${result.saved !== 1 ? "s" : ""} uploaded.` });
    } catch { /* Still offline */ } finally { setIsSyncing(false); }
  }, [qc, toast]);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); flushQueue(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if (navigator.onLine && readQueue().length > 0) flushQueue();
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, [flushQueue]);

  // ── Ping interval ─────────────────────────────────────────────────────────
  const sendPing = useCallback(async () => {
    const loc = await getLocation();
    if (!loc) return;
    const recordedAt = new Date().toISOString();
    if (!navigator.onLine) { enqueuePing({ lat: loc.lat, lng: loc.lng, recordedAt }); setQueuedCount(c => c + 1); return; }
    try {
      await crmFetch("/attendance/location-ping", { method: "POST", body: JSON.stringify({ lat: loc.lat, lng: loc.lng, recordedAt }) });
      setPingCount(c => c + 1); qc.invalidateQueries({ queryKey: ["crm-attendance"] });
    } catch { enqueuePing({ lat: loc.lat, lng: loc.lng, recordedAt }); setQueuedCount(c => c + 1); }
  }, [qc]);

  const startPingSchedule = useCallback(() => {
    if (pingIntervalRef.current) return;
    pingIntervalRef.current = setInterval(sendPing, PING_INTERVAL_MS);
    lastPingTimeRef.current = Date.now();
    setNextPingIn(PING_INTERVAL_MS / 1000);
    pingCountdownRef.current = setInterval(() => {
      const passed = lastPingTimeRef.current ? (Date.now() - lastPingTimeRef.current) / 1000 : 0;
      setNextPingIn(Math.round(Math.max(0, PING_INTERVAL_MS / 1000 - passed)));
    }, 1000);
  }, [sendPing]);

  const stopPingSchedule = useCallback(() => {
    if (pingIntervalRef.current) { clearInterval(pingIntervalRef.current); pingIntervalRef.current = null; }
    if (pingCountdownRef.current) { clearInterval(pingCountdownRef.current); pingCountdownRef.current = null; }
    setNextPingIn(null);
  }, []);

  useEffect(() => {
    if (isClockedIn) startPingSchedule(); else { stopPingSchedule(); setPingCount(0); }
    return stopPingSchedule;
  }, [isClockedIn, startPingSchedule, stopPingSchedule]);

  // ── Clock in / out mutations ──────────────────────────────────────────────
  const clockIn = useMutation({
    mutationFn: async ({ faceImage, photoTime }: { faceImage: string | null; photoTime: string | null }) => {
      const loc = await getLocation();
      return crmFetch("/attendance/clock-in", {
        method: "POST",
        body: JSON.stringify({
          ...(loc ? { lat: loc.lat, lng: loc.lng } : {}),
          ...(faceImage ? { faceImage } : {}),
          ...(photoTime ? { photoTime } : {}),
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-attendance-today"] });
      qc.invalidateQueries({ queryKey: ["crm-attendance"] });
      toast({ title: "Clocked in", description: `Recorded at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Location & photo saved.` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const clockOut = useMutation({
    mutationFn: async ({ faceImage, photoTime }: { faceImage: string | null; photoTime: string | null }) => {
      const loc = await getLocation();
      return crmFetch("/attendance/clock-out", {
        method: "POST",
        body: JSON.stringify({
          ...(loc ? { lat: loc.lat, lng: loc.lng } : {}),
          ...(faceImage ? { faceImage } : {}),
          ...(photoTime ? { photoTime } : {}),
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-attendance-today"] });
      qc.invalidateQueries({ queryKey: ["crm-attendance"] });
      toast({ title: "Clocked out", description: "Have a great rest of your day!" });
      flushQueue();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const faceReviewMutation = useMutation({
    mutationFn: async ({ logId, status }: { logId: number; status: "verified" | "flagged" | "pending" }) => {
      return crmFetch(`/attendance/${logId}/face-review`, { method: "PUT", body: JSON.stringify({ status }) });
    },
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ["crm-attendance"] });
      const labels = { verified: "Verified — record marked as confirmed.", flagged: "Flagged — record marked for follow-up.", pending: "Reset to pending review." };
      toast({ title: "Review saved", description: labels[status] });
      setReviewLog((prev: any) => prev ? { ...prev, faceReviewStatus: status, faceReviewedAt: new Date().toISOString() } : null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleFaceReview = (logId: number, status: "verified" | "flagged" | "pending") => {
    faceReviewMutation.mutate({ logId, status });
  };

  const handleClockAction = () => {
    setPendingAction(isClockedIn ? "clock-out" : "clock-in");
    setCaptureOpen(true);
  };

  const handleFaceConfirm = (faceImage: string | null, photoTime: string | null) => {
    setCaptureOpen(false);
    if (pendingAction === "clock-in") clockIn.mutate({ faceImage, photoTime });
    else if (pendingAction === "clock-out") clockOut.mutate({ faceImage, photoTime });
    setPendingAction(null);
  };

  // ── Elapsed timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!today?.clockIn || today?.clockOut) { setElapsed(""); return; }
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(today.clockIn).getTime()) / 1000);
      const h = Math.floor(diff / 3600); const m = Math.floor((diff % 3600) / 60); const s = diff % 60;
      setElapsed(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [today]);

  const isBusy = clockIn.isPending || clockOut.isPending;

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agent Clock-In</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your daily clock-in and clock-out with photo verification</p>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${
          isOnline
            ? "border-green-300 bg-green-50 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300"
            : "border-red-300 bg-red-50 text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300"
        }`}>
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {isOnline ? "Online" : "Offline"}
        </div>
      </div>

      {!isOnline && isClockedIn && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-700 px-4 py-3 text-sm text-orange-800 dark:text-orange-200">
          <WifiOff className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">You're offline</p>
            <p className="mt-0.5 text-xs opacity-80">Location updates are queued locally and will sync automatically when you reconnect.</p>
          </div>
        </div>
      )}

      {isSyncing && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700 px-4 py-3 text-sm text-blue-800 dark:text-blue-200">
          <CloudUpload className="w-4 h-4 animate-bounce" />
          Uploading {queuedCount} queued location update{queuedCount !== 1 ? "s" : ""}…
        </div>
      )}

      {/* ── Clock In/Out Card ── */}
      <div className="rounded-2xl border border-border bg-card p-8 flex flex-col items-center gap-4 shadow-sm">
        {(today?.faceImageIn || today?.faceImageOut) && (
          <div className="flex items-center gap-4">
            {today.faceImageIn && (
              <div className="flex flex-col items-center gap-1">
                <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-green-400">
                  <img src={today.faceImageIn} alt="Clock-in selfie" className="w-full h-full object-cover" />
                </div>
                <span className="text-xs text-muted-foreground">In</span>
              </div>
            )}
            {today.faceImageOut && (
              <div className="flex flex-col items-center gap-1">
                <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-red-400">
                  <img src={today.faceImageOut} alt="Clock-out selfie" className="w-full h-full object-cover" />
                </div>
                <span className="text-xs text-muted-foreground">Out</span>
              </div>
            )}
          </div>
        )}

        <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-inner ${isClockedIn ? "bg-green-100 dark:bg-green-900/40" : "bg-muted"}`}>
          <Clock className={`w-10 h-10 ${isClockedIn ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`} />
        </div>

        {elapsed && <div className="text-4xl font-mono font-bold tracking-widest text-green-600 dark:text-green-400">{elapsed}</div>}

        <div className="text-center">
          <p className="text-lg font-semibold">
            {todayLoading ? "Loading…" : isClockedIn
              ? `Clocked in at ${fmtTime(today?.clockIn)}`
              : today?.clockOut ? `Done for today — clocked out at ${fmtTime(today?.clockOut)}`
              : "Not clocked in today"}
          </p>
          {today?.clockOut && <p className="text-sm text-muted-foreground mt-1">Duration: {fmtDuration(today?.durationMinutes)}</p>}
          {(today?.clockInLat || today?.clockOutLat) && (
            <div className="mt-2 flex flex-col items-center gap-1 text-xs">
              {today.clockInLat && (
                <a href={mapsUrl(today.clockInLat, today.clockInLng)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-green-600 dark:text-green-400 hover:underline">
                  <MapPin className="w-3 h-3" /> In: {fmtCoords(today.clockInLat, today.clockInLng)}
                </a>
              )}
              {today.clockOutLat && (
                <a href={mapsUrl(today.clockOutLat, today.clockOutLng)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-orange-600 dark:text-orange-400 hover:underline">
                  <MapPin className="w-3 h-3" /> Out: {fmtCoords(today.clockOutLat, today.clockOutLng)}
                </a>
              )}
            </div>
          )}
        </div>

        {isClockedIn && (
          <div className="flex flex-wrap items-center gap-3 justify-center">
            <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
              isOnline
                ? "border-green-300 bg-green-50 dark:bg-green-900/30 dark:border-green-700 text-green-700 dark:text-green-300"
                : "border-orange-300 bg-orange-50 dark:bg-orange-900/30 dark:border-orange-700 text-orange-700 dark:text-orange-300"
            }`}>
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              {isOnline ? "Tracking active" : "Queuing offline"}
              {pingCount > 0 && <span className="opacity-70">· {pingCount} sent</span>}
              {queuedCount > 0 && !isSyncing && <span className="opacity-70">· {queuedCount} queued</span>}
            </div>
            {isOnline && nextPingIn !== null && (
              <span className="text-xs text-muted-foreground">Next update in {fmtCountdown(nextPingIn)}</span>
            )}
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          {!today?.clockOut && (
            <Button
              size="lg"
              className={`gap-2 px-8 ${isClockedIn ? "bg-red-500 hover:bg-red-600 text-white" : "bg-green-600 hover:bg-green-700 text-white"}`}
              onClick={handleClockAction}
              disabled={isBusy || todayLoading}
            >
              {isBusy
                ? <><Camera className="w-5 h-5 animate-pulse" /> Processing…</>
                : isClockedIn
                ? <><LogOut className="w-5 h-5" /> Clock Out</>
                : <><LogIn className="w-5 h-5" /> Clock In</>}
            </Button>
          )}
          {!isBusy && !today?.clockOut && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Camera className="w-3 h-3" /> Photo + location captured at each clock event
            </p>
          )}
          {today?.clockOut && <p className="text-sm text-muted-foreground italic">Day complete — see you tomorrow!</p>}
        </div>
      </div>

      {/* ── Shift Schedules (admin/supervisor only) ── */}
      {isManager && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <ShiftSchedules agents={(agents as any[]).map((a: any) => ({ id: a.id, name: a.name ?? a.email }))} />
        </div>
      )}

      {/* ── Activity Monitor (admin/supervisor only) ── */}
      {isManager && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <ActivityMonitor />
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <Input type="date" className="w-40 h-9 text-sm" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          {filterDate && (
            <Button variant="ghost" size="sm" className="h-9 px-2 text-xs" onClick={() => setFilterDate("")}>Clear</Button>
          )}
        </div>
        {isManager && (
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <Select value={filterAgentId || "all"} onValueChange={v => setFilterAgentId(v === "all" ? "" : v)}>
              <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="All agents" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {(agents as any[]).map((a: any) => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.name ?? a.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ── Logs Table ── */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                {isManager && <th className="text-left px-4 py-3 font-medium text-muted-foreground">Agent</th>}
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Clock In</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Clock Out</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Duration</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Shift</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Photos</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Location</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logsLoading ? (
                <tr><td colSpan={isManager ? 9 : 8} className="text-center py-10 text-muted-foreground">Loading…</td></tr>
              ) : (logs as any[]).length === 0 ? (
                <tr>
                  <td colSpan={isManager ? 9 : 8} className="text-center py-10 text-muted-foreground">
                    <Timer className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No attendance records yet
                  </td>
                </tr>
              ) : (logs as any[]).map((log: any) => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors align-top">
                  <td className="px-4 py-3 font-medium">{fmtDate(log.date)}</td>
                  {isManager && <td className="px-4 py-3 text-muted-foreground">{log.agent?.name ?? log.agent?.email ?? "—"}</td>}
                  <td className="px-4 py-3">{fmtTime(log.clockIn)}</td>
                  <td className="px-4 py-3">{fmtTime(log.clockOut)}</td>
                  <td className="px-4 py-3">{fmtDuration(log.durationMinutes)}</td>
                  <td className="px-4 py-3"><ShiftBenchmarkBadge log={log} /></td>
                  <td className="px-4 py-3"><FaceCell log={log} isManager={isManager} onReviewClick={setReviewLog} /></td>
                  <td className="px-4 py-3"><LocationCell log={log} /></td>
                  <td className="px-4 py-3"><StatusBadge log={log} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals ── */}
      <FaceCaptureModal
        open={captureOpen}
        action={pendingAction ?? "clock-in"}
        onConfirm={handleFaceConfirm}
        onCancel={() => { setCaptureOpen(false); setPendingAction(null); }}
      />
      <FaceReviewModal
        log={reviewLog}
        isManager={isManager}
        open={!!reviewLog}
        onClose={() => setReviewLog(null)}
        onReview={handleFaceReview}
        reviewing={faceReviewMutation.isPending}
      />
    </div>
  );
}
