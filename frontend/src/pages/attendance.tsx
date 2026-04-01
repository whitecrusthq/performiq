import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, LogIn, LogOut, CalendarDays, Users, Timer,
  MapPin, AlertCircle, Radio, ChevronDown, ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const PING_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

async function apiFetch(url: string, opts: RequestInit = {}) {
  const r = await fetch(url, { ...opts, headers: { ...authHeader(), ...(opts.headers ?? {}) } });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error ?? "Request failed");
  }
  return r.json();
}

type LatLng = { lat: number; lng: number } | null;

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

function fmtTime(ts: string | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(mins: number | null | undefined) {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function fmtCoords(lat?: string | null, lng?: string | null) {
  if (!lat || !lng) return null;
  return `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`;
}

function mapsUrl(lat: string | number, lng: string | number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

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
      <button
        className="text-xs flex items-center gap-1 text-primary hover:underline"
        onClick={() => setOpen(o => !o)}
      >
        <Radio className="w-3 h-3" />
        {open ? "Hide" : "Show"} pings
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto pr-1">
          {(pings as any[]).length === 0
            ? <p className="text-xs text-muted-foreground">No pings recorded</p>
            : (pings as any[]).map((p: any) => (
              <a key={p.id} href={mapsUrl(p.lat, p.lng)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                <MapPin className="w-3 h-3 shrink-0" />
                {new Date(p.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {" — "}{parseFloat(p.lat).toFixed(4)}, {parseFloat(p.lng).toFixed(4)}
              </a>
            ))}
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
        {inCoords ? (
          <a href={mapsUrl(log.clockInLat, log.clockInLng)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline">
            <MapPin className="w-3 h-3" /> In: {inCoords}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">In: —</span>
        )}
        {outCoords ? (
          <a href={mapsUrl(log.clockOutLat, log.clockOutLng)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 hover:underline">
            <MapPin className="w-3 h-3" /> Out: {outCoords}
          </a>
        ) : log.clockOut ? (
          <span className="text-xs text-muted-foreground">Out: —</span>
        ) : null}
      </div>
      <PingsCell logId={log.id} />
    </div>
  );
}

export default function Attendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isManager = user?.role === "manager" || user?.role === "admin" || user?.role === "super_admin";

  const [filterDate, setFilterDate] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [elapsed, setElapsed] = useState("");
  const [locStatus, setLocStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const locStatusRef = useRef(locStatus);
  locStatusRef.current = locStatus;

  // Ping tracking state
  const [pingCount, setPingCount] = useState(0);
  const [nextPingIn, setNextPingIn] = useState<number | null>(null); // seconds until next ping
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPingTimeRef = useRef<number | null>(null);

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

  // Send a location ping silently
  const sendPing = useCallback(async () => {
    const loc = await getLocation();
    if (!loc) return;
    try {
      await apiFetch("/api/attendance/location-ping", {
        method: "POST",
        body: JSON.stringify({ lat: loc.lat, lng: loc.lng }),
      });
      setPingCount(c => c + 1);
      lastPingTimeRef.current = Date.now();
      qc.invalidateQueries({ queryKey: ["attendance-today"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
    } catch { /* silent — don't bother user */ }
  }, [qc]);

  // Start/stop the ping interval based on clock-in status
  const isClockedIn = today?.clockIn && !today?.clockOut;

  const startPingSchedule = useCallback(() => {
    if (pingIntervalRef.current) return; // already running

    // Set up the 30-minute ping interval
    pingIntervalRef.current = setInterval(() => {
      sendPing();
    }, PING_INTERVAL_MS);

    // Countdown display (updates every second)
    lastPingTimeRef.current = Date.now();
    setNextPingIn(PING_INTERVAL_MS / 1000);
    pingCountdownRef.current = setInterval(() => {
      const elapsed = lastPingTimeRef.current ? (Date.now() - lastPingTimeRef.current) / 1000 : 0;
      const remaining = Math.max(0, PING_INTERVAL_MS / 1000 - elapsed);
      setNextPingIn(Math.round(remaining));
    }, 1000);
  }, [sendPing]);

  const stopPingSchedule = useCallback(() => {
    if (pingIntervalRef.current) { clearInterval(pingIntervalRef.current); pingIntervalRef.current = null; }
    if (pingCountdownRef.current) { clearInterval(pingCountdownRef.current); pingCountdownRef.current = null; }
    setNextPingIn(null);
  }, []);

  useEffect(() => {
    if (isClockedIn) {
      startPingSchedule();
    } else {
      stopPingSchedule();
      setPingCount(0);
    }
    return stopPingSchedule;
  }, [isClockedIn, startPingSchedule, stopPingSchedule]);

  const clockIn = useMutation({
    mutationFn: async () => {
      setLocStatus("requesting");
      const loc = await getLocation();
      setLocStatus(loc ? "granted" : "denied");
      return apiFetch("/api/attendance/clock-in", {
        method: "POST",
        body: JSON.stringify(loc ? { lat: loc.lat, lng: loc.lng } : {}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-today"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      const locMsg = locStatusRef.current === "granted"
        ? " Location captured. Updates every 30 min."
        : " Clocked in without location.";
      toast({ title: "Clocked in", description: `Recorded at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.${locMsg}` });
      setLocStatus("idle");
    },
    onError: (e: any) => { setLocStatus("idle"); toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  const clockOut = useMutation({
    mutationFn: async () => {
      setLocStatus("requesting");
      const loc = await getLocation();
      setLocStatus(loc ? "granted" : "denied");
      return apiFetch("/api/attendance/clock-out", {
        method: "POST",
        body: JSON.stringify(loc ? { lat: loc.lat, lng: loc.lng } : {}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-today"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast({ title: "Clocked out", description: "Have a great rest of your day!" });
      setLocStatus("idle");
    },
    onError: (e: any) => { setLocStatus("idle"); toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  // Live elapsed timer
  useEffect(() => {
    if (!today?.clockIn || today?.clockOut) { setElapsed(""); return; }
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(today.clockIn).getTime()) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [today]);

  const isBusy = clockIn.isPending || clockOut.isPending;

  function fmtCountdown(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground text-sm mt-1">Track your daily clock-in and clock-out</p>
      </div>

      {/* Location denied notice */}
      {locStatus === "denied" && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Location permission was denied. Clock event recorded without coordinates. Enable location access in browser settings to capture it next time.</span>
        </div>
      )}

      {/* Clock In/Out Card */}
      <div className="rounded-2xl border border-border bg-card p-8 flex flex-col items-center gap-4 shadow-sm">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-inner ${isClockedIn ? "bg-green-100 dark:bg-green-900/40" : "bg-muted"}`}>
          <Clock className={`w-10 h-10 ${isClockedIn ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`} />
        </div>
        {elapsed && (
          <div className="text-4xl font-mono font-bold tracking-widest text-green-600 dark:text-green-400">{elapsed}</div>
        )}

        <div className="text-center">
          <p className="text-lg font-semibold">
            {todayLoading ? "Loading…" : isClockedIn
              ? `Clocked in at ${fmtTime(today?.clockIn)}`
              : today?.clockOut ? `Done for today — clocked out at ${fmtTime(today?.clockOut)}`
              : "Not clocked in today"}
          </p>
          {today?.clockOut && (
            <p className="text-sm text-muted-foreground mt-1">Duration: {fmtDuration(today?.durationMinutes)}</p>
          )}

          {/* Today's captured locations */}
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

        {/* Tracking status pill */}
        {isClockedIn && (
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <div className="flex items-center gap-2 rounded-full border border-green-300 bg-green-50 dark:bg-green-900/30 dark:border-green-700 px-3 py-1.5 text-xs text-green-700 dark:text-green-300 font-medium">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              Location tracking active
              {pingCount > 0 && <span className="ml-1 opacity-70">· {pingCount} update{pingCount !== 1 ? "s" : ""}</span>}
            </div>
            {nextPingIn !== null && (
              <span className="text-xs text-muted-foreground">
                Next update in {fmtCountdown(nextPingIn)}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          {!today?.clockOut && (
            <Button
              size="lg"
              className={`gap-2 px-8 ${isClockedIn ? "bg-red-500 hover:bg-red-600 text-white" : "bg-green-600 hover:bg-green-700 text-white"}`}
              onClick={() => isClockedIn ? clockOut.mutate() : clockIn.mutate()}
              disabled={isBusy || todayLoading}
            >
              {isBusy && locStatus === "requesting"
                ? <><MapPin className="w-5 h-5 animate-pulse" /> Getting location…</>
                : isClockedIn
                ? <><LogOut className="w-5 h-5" /> Clock Out</>
                : <><LogIn className="w-5 h-5" /> Clock In</>}
            </Button>
          )}
          {!isBusy && !today?.clockOut && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Location captured at clock-in/out and every 30 min
            </p>
          )}
          {today?.clockOut && (
            <p className="text-sm text-muted-foreground italic">Day complete — see you tomorrow!</p>
          )}
        </div>
      </div>

      {/* Filters */}
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
            <Select value={filterUserId} onValueChange={setFilterUserId}>
              <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="All employees" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All employees</SelectItem>
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
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Location</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logsLoading ? (
                <tr><td colSpan={isManager ? 7 : 6} className="text-center py-10 text-muted-foreground">Loading…</td></tr>
              ) : (logs as any[]).length === 0 ? (
                <tr>
                  <td colSpan={isManager ? 7 : 6} className="text-center py-10 text-muted-foreground">
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
                  <td className="px-4 py-3"><LocationCell log={log} /></td>
                  <td className="px-4 py-3"><StatusBadge log={log} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
