import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, RefreshCw, Search, MapPin } from "lucide-react";

type Event = "" | "login_success" | "login_failed" | "logout";

interface AuditRow {
  id: number;
  userId: number | null;
  userName: string | null;
  userRole: string | null;
  email: string;
  event: "login_success" | "login_failed" | "logout";
  failureReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
}

interface AuditResponse {
  rows: AuditRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function eventBadge(ev: AuditRow["event"]) {
  if (ev === "login_success") return <Badge className="bg-green-600 hover:bg-green-600">Login success</Badge>;
  if (ev === "login_failed") return <Badge variant="destructive">Login failed</Badge>;
  return <Badge variant="secondary">Logout</Badge>;
}

function locationOf(r: AuditRow) {
  const parts = [r.city, r.region, r.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

function shortUA(ua: string | null) {
  if (!ua) return "—";
  // Pull just the browser/os hint
  const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge|Opera|Postman|curl)[\/\s]([0-9.]+)/i);
  const osMatch = ua.match(/\(([^)]+)\)/);
  const browser = browserMatch ? `${browserMatch[1]} ${browserMatch[2]}` : "Unknown";
  const os = osMatch ? osMatch[1].split(";")[0].trim() : "";
  return os ? `${browser} · ${os}` : browser;
}

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [event, setEvent] = useState<Event>("");
  const [emailFilter, setEmailFilter] = useState("");
  const [emailFilterDraft, setEmailFilterDraft] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    if (event) p.set("event", event);
    if (emailFilter) p.set("email", emailFilter);
    if (from) p.set("from", new Date(from).toISOString());
    if (to) p.set("to", new Date(to).toISOString());
    return p.toString();
  }, [page, pageSize, event, emailFilter, from, to]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<AuditResponse>({
    queryKey: ["audit-logs", queryString],
    queryFn: async () => {
      const resp = await apiFetch(`/api/security/audit-logs?${queryString}`);
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || `Request failed (${resp.status})`);
      }
      return resp.json();
    },
  });

  function applyEmailFilter() {
    setEmailFilter(emailFilterDraft.trim());
    setPage(1);
  }

  function resetFilters() {
    setEvent("");
    setEmailFilter("");
    setEmailFilterDraft("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  const rows = data?.rows ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Login Activity"
        description="Audit log of all login attempts and logouts, with IP-based location."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="event-filter">Event</Label>
              <Select value={event || "all"} onValueChange={(v) => { setEvent((v === "all" ? "" : v) as Event); setPage(1); }}>
                <SelectTrigger id="event-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All events</SelectItem>
                  <SelectItem value="login_success">Login success</SelectItem>
                  <SelectItem value="login_failed">Login failed</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-filter">Email contains</Label>
              <div className="flex gap-2">
                <Input
                  id="email-filter"
                  value={emailFilterDraft}
                  onChange={(e) => setEmailFilterDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") applyEmailFilter(); }}
                  placeholder="user@example.com"
                />
                <Button type="button" size="icon" variant="outline" onClick={applyEmailFilter} aria-label="Search">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="from">From</Label>
              <Input id="from" type="datetime-local" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">To</Label>
              <Input id="to" type="datetime-local" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={resetFilters}>Clear filters</Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {isLoading ? "Loading…" : `${total.toLocaleString()} event${total === 1 ? "" : "s"}`}
          </CardTitle>
          <div className="text-xs text-muted-foreground">
            Page {data?.page ?? 1} of {totalPages}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isError ? (
            <div className="p-4 text-sm text-red-600">
              Failed to load audit log: {error instanceof Error ? error.message : "Unknown error"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2 whitespace-nowrap">Time</th>
                    <th className="text-left px-4 py-2 whitespace-nowrap">Event</th>
                    <th className="text-left px-4 py-2 whitespace-nowrap">User</th>
                    <th className="text-left px-4 py-2 whitespace-nowrap">Reason</th>
                    <th className="text-left px-4 py-2 whitespace-nowrap">IP</th>
                    <th className="text-left px-4 py-2 whitespace-nowrap">Location</th>
                    <th className="text-left px-4 py-2 whitespace-nowrap">Device</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && !isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                        No events match these filters.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-2 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{eventBadge(r.event)}</td>
                        <td className="px-4 py-2">
                          <div className="font-medium">{r.userName ?? <span className="text-muted-foreground italic">unknown</span>}</div>
                          <div className="text-xs text-muted-foreground">{r.email}</div>
                        </td>
                        <td className="px-4 py-2 max-w-[260px]">
                          {r.failureReason ? (
                            <span className="text-xs text-red-600">{r.failureReason}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap font-mono text-xs">{r.ipAddress ?? "—"}</td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {r.country || r.city ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {locationOf(r)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 max-w-[260px] truncate" title={r.userAgent ?? ""}>
                          {shortUA(r.userAgent)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || isFetching}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          Showing {rows.length === 0 ? 0 : (page - 1) * pageSize + 1}
          {rows.length > 0 ? `–${(page - 1) * pageSize + rows.length}` : ""} of {total}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages || isFetching}
          onClick={() => setPage((p) => p + 1)}
        >
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
