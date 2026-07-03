import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, LogIn, LogOut, CalendarDays, Users, Timer,
  MapPin, AlertCircle, Radio, ChevronDown, ChevronUp,
  WifiOff, Wifi, CloudUpload, Camera, RefreshCw, CheckCircle2, X, ZoomIn,
  ShieldCheck, ShieldAlert, ShieldQuestion, ScanFace, UserCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch as apiFetchBase } from "@/lib/utils";

const PING_INTERVAL_MS = 30 * 60 * 1000;
const QUEUE_KEY = "attendance_ping_queue";
const CAPTURE_WIDTH = 320;
const CAPTURE_HEIGHT = 240;

// ─── Offline queue ────────────────────────────────────────────────────────────
interface QueuedPing { lat: number; lng: number; recordedAt: string }
type LatLng = { lat: number; lng: number } | null;

function readQueue(): QueuedPing[] { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]"); } catch { return []; } }
function writeQueue(q: QueuedPing[]) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }
function enqueuePing(ping: QueuedPing) { writeQueue([...readQueue(), ping]); }
function clearQueue() { localStorage.removeItem(QUEUE_KEY); }

// ─── API ──────────────────────────────────────────────────────────────────────
async function apiFetch(url: string, opts: RequestInit = {}) {
  const r = await apiFetchBase(url, opts);
  if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error ?? "Request failed"); }
  return r.json();
}

// ─── Geo ──────────────────────────────────────────────────────────────────────
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

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmtTime(ts?: string | null) { if (!ts) return "—"; return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function fmtDuration(mins?: number | null) { if (!mins) return "—"; const h = Math.floor(mins / 60); const m = mins % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; }
function fmtDate(d: string) { return new Date(d + "T00:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }); }
function fmtCoords(lat?: string | null, lng?: string | null) { if (!lat || !lng) return null; return `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`; }
function mapsUrl(lat: string | number, lng: string | number) { return `https://www.google.com/maps?q=${lat},${lng}`; }
function fmtCountdown(secs: number) { const m = Math.floor(secs / 60); const s = secs % 60; return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`; }

// ─── Face Capture Modal ────────────────────────────────────────────────────────
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
    if (open) { startCamera(); }
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
    // Mirror the image (selfie feel)
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

  const retake = () => {
    setCaptured(null);
    setPhotoTime(null);
    startCamera();
  };

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

        {/* Camera viewport */}
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
              {/* Face guide oval */}
              {!starting && !camError && (
                <div className={`absolute inset-0 flex items-center justify-center pointer-events-none`}>
                  <div className={`w-36 h-44 rounded-full border-2 border-dashed ${ringColor} opacity-70`} />
                </div>
              )}
            </>
          ) : (
            <img src={captured} alt="Captured face" className="w-full h-full object-cover" />
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* Actions */}
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

// ─── Face thumbnail ───────────────────────────────────────────────────────────
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

// ─── Face Review Status helpers ───────────────────────────────────────────────
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

// ─── Face Review Modal ─────────────────────────────────────────────────────────
interface FaceReviewModalProps {
  log: any;
  isManager: boolean;
  open: boolean;
  onClose: () => void;
  onReview: (logId: number, status: "verified" | "flagged" | "pending") => void;
  reviewing: boolean;
}
function FaceReviewModal({ log, isManager, open, onClose, onReview, reviewing }: FaceReviewModalProps) {
  if (!log) return null;
  const profilePhoto = log.user?.profilePhoto;
  const hasAnyPhoto = profilePhoto || log.faceImageIn || log.faceImageOut;
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace className="w-5 h-5" />
            Face Identity Review — {log.user?.name ?? "Employee"}
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
          {/* Reference photo */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reference Photo</p>
            {profilePhoto ? (
              <img src={profilePhoto} alt="Reference" className="w-full aspect-square object-cover rounded-xl border-2 border-primary/40" />
            ) : (
              <div className="w-full aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 bg-muted/30">
                <UserCircle2 className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-[11px] text-muted-foreground text-center px-2">No reference photo set for this user</p>
              </div>
            )}
            <span className="text-[10px] text-muted-foreground">Profile on file</span>
          </div>

          {/* Clock-in selfie */}
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

          {/* Clock-out selfie */}
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

        {/* Current review status */}
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

        {/* Action buttons — managers/admins only */}
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
              <Button
                size="sm"
                variant="outline"
                disabled={reviewing}
                onClick={() => onReview(log.id, "pending")}
                title="Reset to pending"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ log }: { log: any }) {
  if (!log) return <Badge variant="outline">Not clocked in</Badge>;
  if (log.clockIn && !log.clockOut) return <Badge className="bg-green-500 text-white">Clocked In</Badge>;
  if (log.clockOut) return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant="secondary">Clocked Out</Badge>
      {log.autoClockedOut && (
        <Badge className="bg-amber-500 text-white text-[10px] gap-1" title="System closed this session because the user never clocked out">
          <AlertCircle className="w-3 h-3" /> Auto clocked out
        </Badge>
      )}
    </div>
  );
  return <Badge variant="outline">—</Badge>;
}

function PingsCell({ logId }: { logId: number }) {
  const [open, setOpen] = useState(false);
  const { data: pings = [] } = useQuery({
    queryKey: ["pings", logId],
    queryFn: () => apiFetch(`/api/attendance/${logId}/pings`),
    enabled: open,
  });
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
      <div className="flex flex-col gap-0.5">
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
      </div>
      {log.autoClockedOut && (
        <div className="flex items-start gap-1 text-[11px] text-amber-600 dark:text-amber-400">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          <span>
            {log.clockOutLocationTime
              ? <>Last confirmed location at {new Date(log.clockOutLocationTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {log.clockOut && (new Date(log.clockOut).getTime() - new Date(log.clockOutLocationTime).getTime()) > 15 * 60 * 1000 ? " (stale)" : ""}</>
              : "No location recorded before auto clock-out"}
          </span>
        </div>
      )}
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
            {log.clockInPhotoTime && (
              <span className="text-[10px] text-muted-foreground">{fmtPhotoTime(log.clockInPhotoTime)}</span>
            )}
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
            {log.clockOutPhotoTime && (
              <span className="text-[10px] text-muted-foreground">{fmtPhotoTime(log.clockOutPhotoTime)}</span>
            )}
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
          <button
            onClick={() => onReviewClick?.(log)}
            className="text-[10px] flex items-center gap-0.5 text-primary hover:underline"
          >
            <ScanFace className="w-3 h-3" /> Review
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Attendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isManager = user?.role === "manager" || user?.role === "admin" || user?.role === "super_admin";

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [filterDate, setFilterDate] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [filterSiteId, setFilterSiteId] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [autoOnly, setAutoOnly] = useState(false);
  const [elapsed, setElapsed] = useState("");

  // Camera capture state
  const [captureOpen, setCaptureOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"clock-in" | "clock-out" | null>(null);

  // Face review modal state
  const [reviewLog, setReviewLog] = useState<any>(null);

  // Ping / online state
  const [pingCount, setPingCount] = useState(0);
  const [nextPingIn, setNextPingIn] = useState<number | null>(null);
  const [queuedCount, setQueuedCount] = useState(() => readQueue().length);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPingTimeRef = useRef<number | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: today, isLoading: todayLoading } = useQuery({
    queryKey: ["attendance-today"],
    queryFn: () => apiFetch("/api/attendance/today"),
    refetchInterval: 30000,
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["attendance", filterDate, filterUserId, filterSiteId, filterDepartment, autoOnly],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterDate) { params.set("startDate", filterDate); params.set("endDate", filterDate); }
      if (filterUserId) params.set("userId", filterUserId);
      if (filterSiteId) params.set("siteId", filterSiteId);
      if (filterDepartment) params.set("department", filterDepartment);
      if (autoOnly) params.set("autoClosedOnly", "true");
      return apiFetch(`/api/attendance?${params}`);
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-list"],
    queryFn: () => apiFetch("/api/users"),
    enabled: isManager,
  });

  const { data: sites = [] } = useQuery({
    queryKey: ["sites-list"],
    queryFn: () => apiFetch("/api/sites"),
    enabled: isManager,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments-list"],
    queryFn: () => apiFetch("/api/departments"),
    enabled: isManager,
  });

  const isClockedIn = today?.clockIn && !today?.clockOut;

  // ── Admin auto-clockout schedule settings ─────────────────────────────────────
  const { data: schedule } = useQuery({
    queryKey: ["attendance-schedule-settings"],
    queryFn: () => apiFetch("/api/attendance/schedule-settings"),
    enabled: isAdmin,
  });

  const [dayTimesStr, setDayTimesStr] = useState("");
  const [nightTimesStr, setNightTimesStr] = useState("");
  const [graceStr, setGraceStr] = useState("");
  const [tzStr, setTzStr] = useState("");

  useEffect(() => {
    if (!schedule?.settings) return;
    setDayTimesStr((schedule.settings.daySweepTimes ?? []).join(", "));
    setNightTimesStr((schedule.settings.nightSweepTimes ?? []).join(", "));
    setGraceStr(String(schedule.settings.graceMinutes ?? 0));
    setTzStr(schedule.settings.timezone ?? "");
  }, [schedule]);

  const saveSchedule = useMutation({
    mutationFn: () => apiFetch("/api/attendance/schedule-settings", {
      method: "PUT",
      body: JSON.stringify({
        daySweepTimes: dayTimesStr.split(",").map(s => s.trim()).filter(Boolean),
        nightSweepTimes: nightTimesStr.split(",").map(s => s.trim()).filter(Boolean),
        graceMinutes: Number(graceStr) || 0,
        timezone: tzStr.trim(),
      }),
    }),
    onSuccess: (data) => {
      qc.setQueryData(["attendance-schedule-settings"], data);
      toast({ title: "Schedule settings saved", description: "Auto clock-out schedule updated." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Flush offline queue ───────────────────────────────────────────────────────
  const flushQueue = useCallback(async () => {
    const queue = readQueue();
    if (queue.length === 0) return;
    setIsSyncing(true);
    try {
      const result = await apiFetch("/api/attendance/location-ping/batch", { method: "POST", body: JSON.stringify({ pings: queue }) });
      clearQueue(); setQueuedCount(0); setPingCount(c => c + (result.saved ?? 0));
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["attendance-today"] });
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

  // ── Ping interval ─────────────────────────────────────────────────────────────
  const sendPing = useCallback(async () => {
    const loc = await getLocation();
    if (!loc) return;
    const recordedAt = new Date().toISOString();
    if (!navigator.onLine) { enqueuePing({ lat: loc.lat, lng: loc.lng, recordedAt }); setQueuedCount(c => c + 1); return; }
    try {
      await apiFetch("/api/attendance/location-ping", { method: "POST", body: JSON.stringify({ lat: loc.lat, lng: loc.lng, recordedAt }) });
      setPingCount(c => c + 1); qc.invalidateQueries({ queryKey: ["attendance"] });
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
    if (isClockedIn) { startPingSchedule(); } else { stopPingSchedule(); setPingCount(0); }
    return stopPingSchedule;
  }, [isClockedIn, startPingSchedule, stopPingSchedule]);

  // ── One-off fresh ping just before the expected auto clock-out ─────────────────
  // Ensures the last-known location captured on an auto clock-out is as fresh as
  // possible (fires ~1 min before expectedClockOut while still clocked in).
  useEffect(() => {
    if (!isClockedIn || !today?.expectedClockOut) return;
    const delay = new Date(today.expectedClockOut).getTime() - 60_000 - Date.now();
    if (delay <= 0 || delay > 24 * 60 * 60 * 1000) return;
    const t = setTimeout(() => { void sendPing(); }, delay);
    return () => clearTimeout(t);
  }, [isClockedIn, today?.expectedClockOut, sendPing]);

  // ── Clock in / out after face capture confirmed ───────────────────────────────
  const clockIn = useMutation({
    mutationFn: async ({ faceImage, photoTime }: { faceImage: string | null; photoTime: string | null }) => {
      const loc = await getLocation();
      return apiFetch("/api/attendance/clock-in", {
        method: "POST",
        body: JSON.stringify({
          ...(loc ? { lat: loc.lat, lng: loc.lng } : {}),
          ...(faceImage ? { faceImage } : {}),
          ...(photoTime ? { photoTime } : {}),
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-today"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast({ title: "Clocked in", description: `Recorded at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Location & photo saved.` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const clockOut = useMutation({
    mutationFn: async ({ faceImage, photoTime }: { faceImage: string | null; photoTime: string | null }) => {
      const loc = await getLocation();
      return apiFetch("/api/attendance/clock-out", {
        method: "POST",
        body: JSON.stringify({
          ...(loc ? { lat: loc.lat, lng: loc.lng } : {}),
          ...(faceImage ? { faceImage } : {}),
          ...(photoTime ? { photoTime } : {}),
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-today"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast({ title: "Clocked out", description: "Have a great rest of your day!" });
      flushQueue();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const faceReviewMutation = useMutation({
    mutationFn: async ({ logId, status }: { logId: number; status: "verified" | "flagged" | "pending" }) => {
      return apiFetch(`/api/attendance/${logId}/face-review`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      const labels = { verified: "Verified — record marked as confirmed.", flagged: "Flagged — record marked for follow-up.", pending: "Reset to pending review." };
      toast({ title: "Review saved", description: labels[status] });
      // Update the reviewLog in-place so modal reflects change immediately
      setReviewLog((prev: any) => prev ? { ...prev, faceReviewStatus: status, faceReviewedAt: new Date().toISOString() } : null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleFaceReview = (logId: number, status: "verified" | "flagged" | "pending") => {
    faceReviewMutation.mutate({ logId, status });
  };

  // User clicks the main button → open camera
  const handleClockAction = () => {
    setPendingAction(isClockedIn ? "clock-out" : "clock-in");
    setCaptureOpen(true);
  };

  // Camera confirmed (faceImage and photoTime may be null if skipped)
  const handleFaceConfirm = (faceImage: string | null, photoTime: string | null) => {
    setCaptureOpen(false);
    if (pendingAction === "clock-in") clockIn.mutate({ faceImage, photoTime });
    else if (pendingAction === "clock-out") clockOut.mutate({ faceImage, photoTime });
    setPendingAction(null);
  };

  // ── Elapsed timer ─────────────────────────────────────────────────────────────
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
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your daily clock-in and clock-out</p>
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

      {/* Clock In/Out Card */}
      <div className="rounded-2xl border border-border bg-card p-8 flex flex-col items-center gap-4 shadow-sm">
        {/* Today's face captures */}
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

      {/* Admin: auto clock-out schedule settings */}
      {isAdmin && (
        <div className="rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Auto clock-out schedule</h3>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            Employees who forget to clock out are automatically clocked out at the configured time for their shift. These times are the selectable slots assigned per department (Departments page) or per user (Users page). Comma-separate multiple times in 24-hour <span className="font-mono">HH:MM</span> format.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Day-shift clock-out times</label>
              <Input value={dayTimesStr} onChange={e => setDayTimesStr(e.target.value)} placeholder="17:00, 19:00, 21:00" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Night-shift clock-out times</label>
              <Input value={nightTimesStr} onChange={e => setNightTimesStr(e.target.value)} placeholder="07:30, 08:30" className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">Night shifts cross midnight — these resolve to the next morning after clock-in.</p>
            </div>
            <div>
              <label className="text-sm font-medium">Grace period (minutes)</label>
              <Input type="number" min={0} max={240} value={graceStr} onChange={e => setGraceStr(e.target.value)} placeholder="0" className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">Extra minutes after the scheduled time before auto clock-out fires.</p>
            </div>
            <div>
              <label className="text-sm font-medium">Timezone</label>
              <Input value={tzStr} onChange={e => setTzStr(e.target.value)} placeholder="Africa/Lagos" className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">IANA timezone used to interpret clock-out times.</p>
            </div>
          </div>
          <Button onClick={() => saveSchedule.mutate()} disabled={saveSchedule.isPending} className="gap-2">
            {saveSchedule.isPending ? "Saving…" : "Save schedule settings"}
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <Input type="date" className="w-40 h-9 text-sm" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          {filterDate && <Button variant="ghost" size="sm" className="h-9 px-2 text-xs" onClick={() => setFilterDate("")}>Clear</Button>}
        </div>
        {isManager && (
          <>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <Select value={filterUserId || "all"} onValueChange={v => setFilterUserId(v === "all" ? "" : v)}>
                <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="All employees" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {(users as any[]).map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name ?? u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <Select value={filterSiteId || "all"} onValueChange={v => setFilterSiteId(v === "all" ? "" : v)}>
                <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="All sites" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sites</SelectItem>
                  {(sites as any[]).map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <Select value={filterDepartment || "all"} onValueChange={v => setFilterDepartment(v === "all" ? "" : v)}>
                <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="All departments" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {(departments as any[]).map((d: any) => (
                    <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(filterUserId || filterSiteId || filterDepartment) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 text-xs"
                onClick={() => { setFilterUserId(""); setFilterSiteId(""); setFilterDepartment(""); }}
              >
                Clear filters
              </Button>
            )}
          </>
        )}
        <Button
          variant={autoOnly ? "default" : "outline"}
          size="sm"
          className="h-9 px-3 text-xs gap-1.5"
          onClick={() => setAutoOnly(v => !v)}
          title="Show only sessions that were automatically clocked out"
        >
          <AlertCircle className="w-3.5 h-3.5" />
          {autoOnly ? "Auto clock-outs only" : "Auto clock-outs"}
        </Button>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                {isManager && <th className="text-left px-4 py-3 font-medium text-muted-foreground">Employee</th>}
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Clock In</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Clock Out</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Duration</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Photos</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Location</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logsLoading ? (
                <tr><td colSpan={isManager ? 8 : 7} className="text-center py-10 text-muted-foreground">Loading…</td></tr>
              ) : (logs as any[]).length === 0 ? (
                <tr>
                  <td colSpan={isManager ? 8 : 7} className="text-center py-10 text-muted-foreground">
                    <Timer className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No attendance records yet
                  </td>
                </tr>
              ) : (logs as any[]).map((log: any) => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors align-top">
                  <td className="px-4 py-3 font-medium">
                    {fmtDate(log.date)}
                    {log.shiftType && <div className="text-[10px] text-muted-foreground capitalize">{log.shiftType} shift</div>}
                  </td>
                  {isManager && <td className="px-4 py-3 text-muted-foreground">{log.user?.name ?? log.user?.email ?? "—"}</td>}
                  <td className="px-4 py-3">{fmtTime(log.clockIn)}</td>
                  <td className="px-4 py-3">{fmtTime(log.clockOut)}</td>
                  <td className="px-4 py-3">{fmtDuration(log.durationMinutes)}</td>
                  <td className="px-4 py-3"><FaceCell log={log} isManager={isManager} onReviewClick={setReviewLog} /></td>
                  <td className="px-4 py-3"><LocationCell log={log} /></td>
                  <td className="px-4 py-3"><StatusBadge log={log} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Face Capture Modal */}
      <FaceCaptureModal
        open={captureOpen}
        action={pendingAction ?? "clock-in"}
        onConfirm={handleFaceConfirm}
        onCancel={() => { setCaptureOpen(false); setPendingAction(null); }}
      />

      {/* Face Review Modal */}
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
