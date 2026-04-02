import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, LogIn, LogOut, CalendarDays, Users, Timer,
  MapPin, AlertCircle, Radio, ChevronDown, ChevronUp,
  WifiOff, Wifi, CloudUpload, Camera, RefreshCw, CheckCircle2, X, ZoomIn,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

async function apiFetch(url: string, opts: RequestInit = {}) {
  const r = await fetch(url, { ...opts, headers: { ...authHeader(), ...(opts.headers ?? {}) } });
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

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ log }: { log: any }) {
  if (!log) return <Badge variant="outline">Not clocked in</Badge>;
  if (log.clockIn && !log.clockOut) return <Badge className="bg-green-500 text-white">Clocked In</Badge>;
  if (log.clockOut) return <Badge variant="secondary">Clocked Out</Badge>;
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
      <PingsCell logId={log.id} />
    </div>
  );
}

function FaceCell({ log }: { log: any }) {
  const fmtPhotoTime = (t: string | null | undefined) =>
    t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : null;

  return (
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
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Attendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isManager = user?.role === "manager" || user?.role === "admin" || user?.role === "super_admin";

  const [filterDate, setFilterDate] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [elapsed, setElapsed] = useState("");

  // Camera capture state
  const [captureOpen, setCaptureOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"clock-in" | "clock-out" | null>(null);

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
    queryKey: ["attendance", filterDate, filterUserId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterDate) { params.set("startDate", filterDate); params.set("endDate", filterDate); }
      if (filterUserId) params.set("userId", filterUserId);
      return apiFetch(`/api/attendance?${params}`);
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-list"],
    queryFn: () => apiFetch("/api/users"),
    enabled: isManager,
  });

  const isClockedIn = today?.clockIn && !today?.clockOut;

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

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <Input type="date" className="w-40 h-9 text-sm" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          {filterDate && <Button variant="ghost" size="sm" className="h-9 px-2 text-xs" onClick={() => setFilterDate("")}>Clear</Button>}
        </div>
        {isManager && (
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
        )}
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
                  <td className="px-4 py-3 font-medium">{fmtDate(log.date)}</td>
                  {isManager && <td className="px-4 py-3 text-muted-foreground">{log.user?.name ?? log.user?.email ?? "—"}</td>}
                  <td className="px-4 py-3">{fmtTime(log.clockIn)}</td>
                  <td className="px-4 py-3">{fmtTime(log.clockOut)}</td>
                  <td className="px-4 py-3">{fmtDuration(log.durationMinutes)}</td>
                  <td className="px-4 py-3"><FaceCell log={log} /></td>
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
    </div>
  );
}
